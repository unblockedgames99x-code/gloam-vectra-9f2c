import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const gamesPath = path.join(root, "games", "index.json");
const coversPath = path.join(root, "games", "covers.json");
const rejectedPath = path.join(root, "games", "captured-covers", "_rejected.json");
const outputDir = path.join(root, "games", "captured-covers");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, "true");
  else {
    args.set(key, next);
    index += 1;
  }
}

const concurrency = Math.max(1, Math.min(8, Number(args.get("workers") || 4)));
const timeoutMs = Math.max(3000, Number(args.get("timeout") || 15000));
const limit = args.has("limit") ? Math.max(0, Number(args.get("limit") || 0)) : 0;

function saveJson(filePath, value) {
  const sorted = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) sorted[key] = value[key];
  writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\((?:video game|game)\)\s*$/i, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isGamePage(page, game) {
  if (!page?.thumbnail?.source || page.missing !== undefined) return false;
  if (normalize(page.title) !== normalize(game.name)) return false;
  const context = `${page.description || ""} ${page.extract || ""}`;
  return /\b(?:video|browser|online|arcade|flash|mobile|computer|console) game\b|\bgame developed\b|\bgame published\b/i.test(context);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Api-User-Agent": "LearningZone cover verifier/1.0 (learningzone.online)" },
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "LearningZone cover verifier/1.0 (learningzone.online)" },
    });
    if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType: response.headers.get("content-type") || "" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extensionFor(contentType, url) {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/gif/i.test(contentType)) return ".gif";
  if (/svg/i.test(contentType)) return ".svg";
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extension) ? extension.replace(".jpeg", ".jpg") : ".jpg";
}

function resolvePage(data, requestedTitle) {
  if (!data?.query?.pages) return null;
  const aliases = new Map();
  for (const item of data.query.normalized || []) aliases.set(item.from, item.to);
  for (const item of data.query.redirects || []) aliases.set(item.from, item.to);
  let resolvedTitle = requestedTitle;
  for (let index = 0; index < 4 && aliases.has(resolvedTitle); index += 1) resolvedTitle = aliases.get(resolvedTitle);
  return Object.values(data.query.pages).find((page) => page.title === resolvedTitle) || null;
}

async function queryBatch(items, suffix) {
  const titles = items.map((item) => `${item.game.name}${suffix}`);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    prop: "pageimages|extracts|description",
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail|name",
    pithumbsize: "640",
    titles: titles.join("|"),
  });
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
  return items.map((item, index) => ({ item, page: resolvePage(data, titles[index]) }));
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const games = JSON.parse(await readFile(gamesPath, "utf8"));
  const covers = JSON.parse(await readFile(coversPath, "utf8"));
  const rejected = existsSync(rejectedPath) ? JSON.parse(await readFile(rejectedPath, "utf8")) : {};
  const items = games
    .filter((game) => rejected[game.slug] && String(covers[game.slug] || "").includes("/generated-covers/"))
    .slice(0, limit || undefined)
    .map((game) => ({ game }));

  const candidates = [];
  const unresolved = [];
  for (let index = 0; index < items.length; index += 40) {
    const batch = items.slice(index, index + 40);
    const firstPass = await queryBatch(batch, "");
    const retryItems = [];
    for (const result of firstPass) {
      if (isGamePage(result.page, result.item.game)) candidates.push(result);
      else retryItems.push(result.item);
    }
    if (retryItems.length) {
      const secondPass = await queryBatch(retryItems, " (video game)");
      for (const result of secondPass) {
        if (isGamePage(result.page, result.item.game)) candidates.push(result);
        else unresolved.push(result.item.game.slug);
      }
    }
    console.log(`[query ${Math.min(index + 40, items.length)}/${items.length}] candidates ${candidates.length}`);
  }

  const queue = candidates.slice();
  const matched = [];
  const failed = [];
  async function worker() {
    while (queue.length) {
      const { item, page } = queue.shift();
      const imageUrl = page.thumbnail.source;
      const image = await fetchImage(imageUrl);
      if (!image || image.buffer.length < 500) {
        failed.push({ slug: item.game.slug, page: page.title, image: imageUrl });
        continue;
      }
      const extension = extensionFor(image.contentType, imageUrl);
      writeFileSync(path.join(outputDir, `${item.game.slug}${extension}`), image.buffer);
      covers[item.game.slug] = `/games/captured-covers/${item.game.slug}${extension}`;
      delete rejected[item.game.slug];
      matched.push({ slug: item.game.slug, title: item.game.name, page: page.title, pageId: page.pageid, image: imageUrl });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  saveJson(coversPath, covers);
  saveJson(rejectedPath, rejected);
  writeFileSync(
    path.join(outputDir, "_wikipedia-cover-report.json"),
    `${JSON.stringify({ at: new Date().toISOString(), checked: items.length, matched, failed, unresolved }, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify({ checked: items.length, candidates: candidates.length, matched: matched.length, failed: failed.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
