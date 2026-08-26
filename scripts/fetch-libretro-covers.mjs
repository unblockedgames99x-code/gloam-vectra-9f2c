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
const limit = args.has("limit") ? Math.max(0, Number(args.get("limit") || 0)) : 0;
const timeoutMs = Math.max(2000, Number(args.get("timeout") || 9000));
const force = args.has("force");

const systems = {
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

function saveJson(filePath, value) {
  const sorted = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) sorted[key] = value[key];
  writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function decodeFileName(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const baseName = decodeURIComponent(path.posix.basename(parsed.pathname));
    return baseName.replace(/\.(?:zip|7z|rar|gba|gbc?|nes|smc|sfc|nds|n64|z64|v64|bin|cue|iso|chd|md|gen|gg|sms|a26|j64|lnx|ngc?|ws|wsc)$/i, "");
  } catch {
    return "";
  }
}

function thumbnailUrl(system, collection, gameName) {
  return `https://thumbnails.libretro.com/${encodeURIComponent(system)}/${collection}/${encodeURIComponent(gameName)}.png`;
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "LearningZone cover verifier/1.0" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length >= 500 ? buffer : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const games = JSON.parse(await readFile(gamesPath, "utf8"));
  const covers = JSON.parse(await readFile(coversPath, "utf8"));
  const rejected = existsSync(rejectedPath) ? JSON.parse(await readFile(rejectedPath, "utf8")) : {};
  const queue = [];

  for (const game of games) {
    if (!rejected[game.slug]) continue;
    if (!String(covers[game.slug] || "").includes("/generated-covers/")) continue;
    const sourcePath = path.join(root, "games", path.basename(game.file));
    const source = await readFile(sourcePath, "utf8").catch(() => "");
    const core = source.match(/EJS_core\s*=\s*["']([^"']+)/i)?.[1];
    const gameUrl = source.match(/EJS_gameUrl\s*=\s*["']([^"']+)/i)?.[1];
    const system = systems[core];
    const gameName = decodeFileName(gameUrl || "");
    if (!system || !gameName) continue;
    queue.push({ game, system, gameName });
    if (limit && queue.length >= limit) break;
  }

  let processed = 0;
  let matched = 0;
  let missing = 0;
  const misses = [];

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const outputPath = path.join(outputDir, `${item.game.slug}.png`);
      if (!force && existsSync(outputPath)) {
        covers[item.game.slug] = `/games/captured-covers/${item.game.slug}.png`;
        delete rejected[item.game.slug];
        matched += 1;
        processed += 1;
        continue;
      }

      let buffer = null;
      let matchedUrl = "";
      for (const collection of ["Named_Snaps", "Named_Titles", "Named_Boxarts"]) {
        const url = thumbnailUrl(item.system, collection, item.gameName);
        buffer = await fetchImage(url);
        if (buffer) {
          matchedUrl = url;
          break;
        }
      }

      processed += 1;
      if (buffer) {
        writeFileSync(outputPath, buffer);
        covers[item.game.slug] = `/games/captured-covers/${item.game.slug}.png`;
        delete rejected[item.game.slug];
        matched += 1;
      } else {
        missing += 1;
        misses.push({ slug: item.game.slug, system: item.system, gameName: item.gameName });
      }

      if (processed % 25 === 0) {
        saveJson(coversPath, covers);
        saveJson(rejectedPath, rejected);
        console.log(`[${processed}/${processed + queue.length}] matched ${matched}, missing ${missing}${matchedUrl ? `, last ${matchedUrl}` : ""}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  saveJson(coversPath, covers);
  saveJson(rejectedPath, rejected);
  writeFileSync(
    path.join(outputDir, "_libretro-misses.json"),
    `${JSON.stringify({ at: new Date().toISOString(), processed, matched, missing, misses }, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify({ processed, matched, missing }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
