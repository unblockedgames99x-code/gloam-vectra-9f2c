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

const concurrency = Math.max(1, Math.min(6, Number(args.get("workers") || 3)));
const timeoutMs = Math.max(4000, Number(args.get("timeout") || 15000));
const limit = args.has("limit") ? Math.max(0, Number(args.get("limit") || 0)) : 0;
const offset = Math.max(0, Number(args.get("offset") || 0));
const minBytes = Math.max(500, Number(args.get("min-bytes") || 1800));

const blockedDomains = /(?:youtube\.com|youtu\.be|ytimg\.com|reddit\.com|redd\.it|pinterest\.|pinimg\.|discord(?:app)?\.com|facebook\.|instagram\.|tiktok\.|twimg\.|twitter\.|x\.com|googleusercontent\.com\/proxy)/i;
const stopWords = new Set(["the", "a", "an", "and", "of", "to", "for", "in", "on", "old", "main", "backup", "version", "game", "play", "online", "free"]);

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
    .replace(/&#x2F;/gi, "/");
}

function normalize(value) {
  return decodeEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function meaningfulTokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token && !stopWords.has(token) && (token.length >= 2 || /^\d+$/.test(token)));
}

function candidateMatches(game, candidate) {
  const tokens = meaningfulTokens(game.name);
  if (!tokens.length) return false;
  const haystack = normalize(`${candidate.t || ""} ${candidate.desc || ""} ${candidate.purl || ""} ${candidate.murl || ""}`);
  const matched = tokens.filter((token) => haystack.includes(token));
  if (tokens.length === 1) return matched.length === 1;
  const required = tokens.length <= 3 ? tokens.length : Math.ceil(tokens.length * 0.75);
  return matched.length >= required;
}

function parseCandidates(html) {
  const candidates = [];
  for (const match of html.matchAll(/<a[^>]*class="[^"]*\biusc\b[^"]*"[^>]*\bm="([^"]+)"/gi)) {
    try {
      const candidate = JSON.parse(decodeEntities(match[1]));
      if (!candidate.murl || blockedDomains.test(`${candidate.murl} ${candidate.purl || ""}`)) continue;
      candidates.push(candidate);
    } catch {
      // Ignore malformed result metadata.
    }
  }
  return candidates;
}

async function fetchResponse(url, accept = "*/*") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: accept,
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function search(game) {
  const query = `"${game.name}" game screenshot`;
  const response = await fetchResponse(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`, "text/html");
  if (!response?.ok) return { query, candidates: [] };
  const html = await response.text();
  return { query, candidates: parseCandidates(html).filter((candidate) => candidateMatches(game, candidate)) };
}

async function downloadCandidate(candidate) {
  for (const url of [candidate.murl, candidate.turl].filter(Boolean)) {
    const response = await fetchResponse(url, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8");
    const contentType = response?.headers.get("content-type") || "";
    if (!response?.ok || !contentType.startsWith("image/")) continue;
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 10_000_000) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < minBytes || buffer.length > 10_000_000) continue;
    return { buffer, contentType, downloadedFrom: url };
  }
  return null;
}

function extensionFor(contentType, url) {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/avif/i.test(contentType)) return ".avif";
  if (/gif/i.test(contentType)) return ".gif";
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"].includes(extension) ? extension.replace(".jpeg", ".jpg") : ".jpg";
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const games = JSON.parse(await readFile(gamesPath, "utf8"));
  const covers = JSON.parse(await readFile(coversPath, "utf8"));
  const rejected = existsSync(rejectedPath) ? JSON.parse(await readFile(rejectedPath, "utf8")) : {};
  const unresolved = games.filter((game) => rejected[game.slug] && String(covers[game.slug] || "").includes("/generated-covers/"));
  const queue = unresolved.slice(offset, limit ? offset + limit : undefined);
  const report = { matched: [], missing: [], failed: [] };
  let processed = 0;

  async function worker() {
    while (queue.length) {
      const game = queue.shift();
      const result = await search(game);
      const candidate = result.candidates[0];
      if (!candidate) {
        report.missing.push({ slug: game.slug, title: game.name, query: result.query });
        processed += 1;
        continue;
      }

      const image = await downloadCandidate(candidate);
      if (!image) {
        report.failed.push({ slug: game.slug, title: game.name, query: result.query, sourcePage: candidate.purl, sourceImage: candidate.murl });
        processed += 1;
        continue;
      }

      const extension = extensionFor(image.contentType, image.downloadedFrom);
      writeFileSync(path.join(outputDir, `${game.slug}${extension}`), image.buffer);
      covers[game.slug] = `/games/captured-covers/${game.slug}${extension}`;
      delete rejected[game.slug];
      report.matched.push({
        slug: game.slug,
        title: game.name,
        query: result.query,
        resultTitle: candidate.t,
        sourcePage: candidate.purl,
        sourceImage: candidate.murl,
        downloadedFrom: image.downloadedFrom,
      });
      processed += 1;

      if (processed % 25 === 0) {
        saveJson(coversPath, covers);
        saveJson(rejectedPath, rejected);
        console.log(`[${processed}/${processed + queue.length}] matched ${report.matched.length}, missing ${report.missing.length}, failed ${report.failed.length}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  saveJson(coversPath, covers);
  saveJson(rejectedPath, rejected);
  writeFileSync(
    path.join(outputDir, "_search-cover-report.json"),
    `${JSON.stringify({ at: new Date().toISOString(), offset, limit, processed, ...report }, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify({ processed, matched: report.matched.length, missing: report.missing.length, failed: report.failed.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
