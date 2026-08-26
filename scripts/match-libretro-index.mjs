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

const concurrency = Math.max(1, Math.min(16, Number(args.get("workers") || 8)));
const timeoutMs = Math.max(3000, Number(args.get("timeout") || 15000));
const threshold = Math.max(0.8, Math.min(1, Number(args.get("threshold") || 0.9)));
const limit = args.has("limit") ? Math.max(0, Number(args.get("limit") || 0)) : 0;

const coreSystems = {
  gba: "Nintendo - Game Boy Advance",
  mgba: "Nintendo - Game Boy Advance",
  nes: "Nintendo - Nintendo Entertainment System",
  snes: "Nintendo - Super Nintendo Entertainment System",
  nds: "Nintendo - Nintendo DS",
  desmume2015: "Nintendo - Nintendo DS",
  gb: "Nintendo - Game Boy",
  atari2600: "Atari - 2600",
  segaMD: "Sega - Mega Drive - Genesis",
  segaMS: "Sega - Master System - Mark III",
  segaGG: "Sega - Game Gear",
  segaCD: "Sega - Mega-CD - Sega CD",
  segaSaturn: "Sega - Saturn",
  jaguar: "Atari - Jaguar",
  parallel_n64: "Nintendo - Nintendo 64",
  n64: "Nintendo - Nintendo 64",
  psx: "Sony - PlayStation",
  lynx: "Atari - Lynx",
  ngp: "SNK - Neo Geo Pocket Color",
  mednafen_wswan: "Bandai - WonderSwan Color",
  coleco: "Coleco - ColecoVision",
};

const extensionSystems = {
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  gba: "Nintendo - Game Boy Advance",
  nes: "Nintendo - Nintendo Entertainment System",
  smc: "Nintendo - Super Nintendo Entertainment System",
  sfc: "Nintendo - Super Nintendo Entertainment System",
  nds: "Nintendo - Nintendo DS",
  n64: "Nintendo - Nintendo 64",
  z64: "Nintendo - Nintendo 64",
  v64: "Nintendo - Nintendo 64",
  md: "Sega - Mega Drive - Genesis",
  gen: "Sega - Mega Drive - Genesis",
  gg: "Sega - Game Gear",
  sms: "Sega - Master System - Mark III",
  a26: "Atari - 2600",
  j64: "Atari - Jaguar",
  lnx: "Atari - Lynx",
  ngc: "SNK - Neo Geo Pocket Color",
  ngp: "SNK - Neo Geo Pocket",
  ws: "Bandai - WonderSwan",
  wsc: "Bandai - WonderSwan Color",
};

function saveJson(filePath, value) {
  const sorted = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) sorted[key] = value[key];
  writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function htmlDecode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(?:png|zip|7z|rar|gba|gbc?|nes|smc|sfc|nds|n64|z64|v64|bin|cue|iso|chd|md|gen|gg|sms|a26|j64|lnx|ngc?|ws|wsc)$/i, "")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*(?:USA|Europe|World|Japan|En|Rev|Virtual Console|Beta|Proto|Disc|Disk|SGB|GB Compatible)[^)]*\)/gi, " ")
    .replace(/\b(?:the)\b/gi, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value) {
  return normalize(value).replace(/\s+/g, "");
}

function digits(value) {
  return normalize(value).match(/\b\d+\b/g)?.join(" ") || "";
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function similarity(left, right) {
  const a = compact(left);
  const b = compact(right);
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function parseGameSource(source) {
  const core = source.match(/EJS_core\s*=\s*["']([^"']+)/i)?.[1] || "";
  const gameUrl = source.match(/EJS_gameUrl\s*=\s*["']([^"']+)/i)?.[1] || "";
  let fileName = "";
  try {
    fileName = decodeURIComponent(path.posix.basename(new URL(gameUrl).pathname));
  } catch {
    fileName = "";
  }
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  const gameName = fileName.replace(/\.(?:zip|7z|rar)$/i, "").replace(/\.[a-z0-9]+$/i, "");
  return { core, gameUrl, gameName, extension };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "LearningZone cover verifier/1.0" } });
    return response.ok ? response.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "LearningZone cover verifier/1.0" } });
    if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length >= 500 ? buffer : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function systemIndex(system) {
  const url = `https://thumbnails.libretro.com/${encodeURIComponent(system)}/Named_Snaps/`;
  const html = await fetchText(url);
  const files = [];
  for (const match of html.matchAll(/href="([^"]+\.png)"/gi)) {
    let fileName;
    try {
      fileName = decodeURIComponent(htmlDecode(match[1]));
    } catch {
      continue;
    }
    const title = fileName.replace(/\.png$/i, "");
    files.push({ fileName, title, normalized: normalize(title), compact: compact(title) });
  }
  return files;
}

function bestMatch(item, files) {
  const targets = [item.name, item.slug.replace(/-/g, " "), item.gameName].filter(Boolean);
  for (const target of targets) {
    const targetNormalized = normalize(target);
    const targetCompact = compact(target);
    const exact = files.find((file) => file.normalized === targetNormalized || file.compact === targetCompact);
    if (exact) return { file: exact, score: 1, target, method: "exact" };
  }

  let best = null;
  for (const target of targets.slice(0, 2)) {
    for (const file of files) {
      if (digits(target) !== digits(file.title)) continue;
      const score = similarity(target, file.title);
      if (!best || score > best.score) best = { file, score, target, method: "fuzzy" };
    }
  }
  return best?.score >= threshold ? best : null;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const games = JSON.parse(await readFile(gamesPath, "utf8"));
  const covers = JSON.parse(await readFile(coversPath, "utf8"));
  const rejected = existsSync(rejectedPath) ? JSON.parse(await readFile(rejectedPath, "utf8")) : {};
  const items = [];

  for (const game of games) {
    if (!rejected[game.slug] || !String(covers[game.slug] || "").includes("/generated-covers/")) continue;
    const source = await readFile(path.join(root, "games", path.basename(game.file)), "utf8").catch(() => "");
    if (!/EJS_|emulatorjs|EmulatorJS/i.test(source)) continue;
    const parsed = parseGameSource(source);
    const system = extensionSystems[parsed.extension] || coreSystems[parsed.core];
    if (!system) continue;
    items.push({ ...game, ...parsed, system });
    if (limit && items.length >= limit) break;
  }

  const indexes = new Map();
  const systems = [...new Set(items.map((item) => item.system))];
  await Promise.all(systems.map(async (system) => indexes.set(system, await systemIndex(system))));

  const queue = items.slice();
  const report = { matched: [], missing: [] };
  let processed = 0;

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const match = bestMatch(item, indexes.get(item.system) || []);
      if (!match) {
        report.missing.push({ slug: item.slug, name: item.name, system: item.system, gameName: item.gameName });
        processed += 1;
        continue;
      }

      const url = `https://thumbnails.libretro.com/${encodeURIComponent(item.system)}/Named_Snaps/${encodeURIComponent(match.file.fileName)}`;
      const buffer = await fetchImage(url);
      if (!buffer) {
        report.missing.push({ slug: item.slug, name: item.name, system: item.system, gameName: item.gameName, matchedFile: match.file.fileName });
      } else {
        writeFileSync(path.join(outputDir, `${item.slug}.png`), buffer);
        covers[item.slug] = `/games/captured-covers/${item.slug}.png`;
        delete rejected[item.slug];
        report.matched.push({ slug: item.slug, system: item.system, file: match.file.fileName, score: match.score, method: match.method });
      }
      processed += 1;
      if (processed % 25 === 0) console.log(`[${processed}/${processed + queue.length}] matched ${report.matched.length}, missing ${report.missing.length}`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  saveJson(coversPath, covers);
  saveJson(rejectedPath, rejected);
  writeFileSync(
    path.join(outputDir, "_libretro-index-report.json"),
    `${JSON.stringify({ at: new Date().toISOString(), threshold, ...report }, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify({ processed, matched: report.matched.length, missing: report.missing.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
