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

const concurrency = Math.max(1, Math.min(20, Number(args.get("workers") || 10)));
const timeoutMs = Math.max(3000, Number(args.get("timeout") || 15000));

function saveJson(filePath, value) {
  const sorted = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) sorted[key] = value[key];
  writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalize(value) {
  return decodeEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:github unblocked|top vaz|play online|free online|unblocked)\b/gi, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value) {
  return normalize(value).replace(/\s+/g, "");
}

async function fetchResponse(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "LearningZone cover verifier/1.0" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const response = await fetchResponse(url);
  return response?.ok ? response.text() : "";
}

function parseJsString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

async function noahCatalog() {
  const source = await fetchText("https://noahstutoring.academy/js/games.js");
  const entries = [];
  for (const match of source.matchAll(/\{\s*title:\s*"((?:\\.|[^"])*)"[\s\S]*?image:\s*"([^"]+)"\s*}/g)) {
    entries.push({
      title: parseJsString(match[1]),
      image: new URL(match[2], "https://noahstutoring.academy/").href,
      source: "noahstutoring.academy",
    });
  }
  return entries;
}

async function coolUbgCatalog() {
  const source = await fetchText("https://coolubg2.github.io/pages.js");
  const entries = [];
  for (const block of source.split(/\n\s*},/)) {
    const name = block.match(/\bname:\s*"([^"]+)"/)?.[1];
    const title = block.match(/\bformatted_Name:\s*"([^"]+)"/)?.[1] || name;
    if (!name || !title) continue;
    entries.push({
      title,
      image: `https://coolubg2.github.io/images/games-512/${encodeURIComponent(name)}.png`,
      source: "coolubg2.github.io",
    });
  }
  return entries;
}

async function pizzaCatalog() {
  const source = await fetchText("https://thepizzaedition-games.github.io/");
  const queue = [];
  for (const match of source.matchAll(/<a\s+href="([^"]*\/play\/class-\d+\.html)"[\s\S]*?<img\s+src="([^"]+)"/gi)) {
    queue.push({ page: new URL(match[1], "https://thepizzaedition-games.github.io/").href, image: match[2] });
  }

  const entries = [];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const pageSource = await fetchText(item.page);
      const heading = pageSource.match(/<h1[^>]*class="[^"]*single-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
      const title = heading || pageSource.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
      if (!title) continue;
      entries.push({
        title: decodeEntities(title.replace(/<[^>]+>/g, " ")),
        image: new URL(item.image, item.page).href,
        source: "thepizzaedition-games.github.io",
      });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return entries;
}

function extensionFor(contentType, url) {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/avif/i.test(contentType)) return ".avif";
  if (/gif/i.test(contentType)) return ".gif";
  if (/jpe?g/i.test(contentType)) return ".jpg";
  const urlExtension = path.extname(new URL(url).pathname).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"].includes(urlExtension) ? urlExtension.replace(".jpeg", ".jpg") : ".jpg";
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const [games, covers, rejected, noah, coolUbg, pizza] = await Promise.all([
    readFile(gamesPath, "utf8").then(JSON.parse),
    readFile(coversPath, "utf8").then(JSON.parse),
    existsSync(rejectedPath) ? readFile(rejectedPath, "utf8").then(JSON.parse) : {},
    noahCatalog(),
    coolUbgCatalog(),
    pizzaCatalog(),
  ]);

  const catalog = [...noah, ...coolUbg, ...pizza];
  const byNormalized = new Map();
  const byCompact = new Map();
  for (const entry of catalog) {
    const normalized = normalize(entry.title);
    const compacted = compact(entry.title);
    if (normalized && !byNormalized.has(normalized)) byNormalized.set(normalized, entry);
    if (compacted && !byCompact.has(compacted)) byCompact.set(compacted, entry);
  }

  const queue = [];
  for (const game of games) {
    if (!rejected[game.slug] || !String(covers[game.slug] || "").includes("/generated-covers/")) continue;
    const entry = byNormalized.get(normalize(game.name)) || byCompact.get(compact(game.name));
    if (entry) queue.push({ game, entry });
  }

  const report = { catalogEntries: catalog.length, matched: [], failed: [] };
  let processed = 0;
  async function worker() {
    while (queue.length) {
      const { game, entry } = queue.shift();
      const response = await fetchResponse(entry.image);
      if (!response?.ok || !(response.headers.get("content-type") || "").startsWith("image/")) {
        report.failed.push({ slug: game.slug, title: game.name, image: entry.image, source: entry.source });
        processed += 1;
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 500) {
        report.failed.push({ slug: game.slug, title: game.name, image: entry.image, source: entry.source, error: "image too small" });
        processed += 1;
        continue;
      }
      const extension = extensionFor(response.headers.get("content-type") || "", entry.image);
      writeFileSync(path.join(outputDir, `${game.slug}${extension}`), buffer);
      covers[game.slug] = `/games/captured-covers/${game.slug}${extension}`;
      delete rejected[game.slug];
      report.matched.push({ slug: game.slug, title: game.name, source: entry.source, image: entry.image });
      processed += 1;
      if (processed % 25 === 0) console.log(`[${processed}/${processed + queue.length}] matched ${report.matched.length}, failed ${report.failed.length}`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  saveJson(coversPath, covers);
  saveJson(rejectedPath, rejected);
  writeFileSync(
    path.join(outputDir, "_known-catalog-report.json"),
    `${JSON.stringify({ at: new Date().toISOString(), ...report }, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify({ catalogEntries: catalog.length, candidates: processed, matched: report.matched.length, failed: report.failed.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
