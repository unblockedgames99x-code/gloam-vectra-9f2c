import { createHash } from "node:crypto";
import http from "node:http";
import { tmpdir } from "node:os";
import {
  appendFileSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const gamesDir = path.join(root, "games");
const outputDir = path.join(gamesDir, "captured-covers");
const gamesPath = path.join(gamesDir, "index.json");
const coversPath = path.join(gamesDir, "covers.json");
const rejectedPath = path.join(outputDir, "_rejected.json");
const statePath = path.join(outputDir, "_cover-state.json");
const stateJournalPath = path.join(outputDir, "_cover-state-progress.ndjson");
const auditPath = path.join(outputDir, "_cover-audit.json");
const finalReportPath = path.join(outputDir, "_cover-final-report.json");
const qaPath = path.join(outputDir, "_cover-qa.html");
const backupPath = path.join(outputDir, "_covers-before-finalization.json");
const searchReportPath = path.join(outputDir, "_search-cover-report.json");

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

const command = process.argv[2]?.startsWith("--") ? "inventory" : process.argv[2] || "inventory";
const limit = Math.max(0, Number(args.get("limit") || 0));
const concurrency = Math.max(1, Math.min(12, Number(args.get("workers") || 6)));
const force = args.has("force");
const selectedSlugs = new Set(
  String(args.get("slugs") || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
);

mkdirSync(outputDir, { recursive: true });

function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeTextAtomic(filePath, value) {
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, value, "utf8");
  try {
    renameSync(temporary, filePath);
  } catch {
    rmSync(filePath, { force: true });
    renameSync(temporary, filePath);
  }
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function saveManifest(covers) {
  writeJsonAtomic(coversPath, sortedObject(covers));
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  state.games = sortedObject(state.games);
  refreshSummary(state);
  writeJsonAtomic(statePath, state);
}

function saveProgress(covers, state) {
  saveManifest(covers);
  saveState(state);
}

function saveGameCheckpoint(covers, state, entry) {
  saveManifest(covers);
  appendFileSync(
    stateJournalPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      slug: entry.slug,
      cover: covers[entry.slug],
      entry,
      run: {
        extractedAssets: state.run.extractedAssets,
        generatedScreenshots: state.run.generatedScreenshots,
        generatedIllustrations: state.run.generatedIllustrations,
        generatedFallbacks: state.run.generatedFallbacks,
        normalizedCovers: state.run.normalizedCovers,
        suspiciousReplaced: state.run.suspiciousReplaced,
      },
    })}\n`,
    "utf8"
  );
  addRunFile(state, existsSync(stateJournalPath) ? "changed" : "created", stateJournalPath);
}

function publicPathToFile(publicPath) {
  if (!String(publicPath || "").startsWith("/")) return null;
  const clean = decodeURIComponent(String(publicPath).split(/[?#]/, 1)[0]).replace(/^\/+/, "");
  const resolved = path.resolve(root, clean);
  return resolved.startsWith(root) ? resolved : null;
}

function isRemoteCover(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isOldGeneric(value) {
  return String(value || "").includes("/generated-covers/");
}

function titleFor(game) {
  return String(game.name || game.title || game.slug || "Untitled Game").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function inferCategory(game) {
  const value = `${titleFor(game)} ${game.slug || ""} ${game.source_path || ""}`.toLowerCase();
  const groups = [
    ["rhythm", /\b(fnf|funkin|rhythm|music|dance|beat)\b/],
    ["sports", /\b(soccer|football|basket|baseball|tennis|golf|bowling|pool|hockey|wrestl|sports?)\b/],
    ["racing", /\b(race|racing|car|kart|drive|drift|moto|bike|traffic)\b/],
    ["puzzle", /\b(puzzle|2048|sudoku|word|anagram|escape|merge|match|quiz|brain|slice)\b/],
    ["strategy", /\b(strategy|tower|defen[cs]e|chess|battle|war|tycoon|idle|clicker|simulator)\b/],
    ["horror", /\b(horror|fnaf|scary|creepy|nightmare|zombie|dead|evil|haunt)\b/],
    ["platform", /\b(platform|mario|sonic|runner|jump|parkour|obby|adventure)\b/],
    ["sandbox", /\b(minecraft|sandbox|build|craft|factory|city|world)\b/],
    ["action", /\b(shoot|gun|fps|fight|combat|strike|doom|robbery|sniper|action)\b/],
    ["retro", /\b(retro|nes|snes|gba|gameboy|atari|arcade|rom|emulator)\b/],
  ];
  return groups.find(([, pattern]) => pattern.test(value))?.[0] || "arcade";
}

function initialSourceType(cover) {
  if (!cover) return "missing";
  if (isOldGeneric(cover)) return "old-generic";
  if (isRemoteCover(cover)) return "remote-existing";
  if (String(cover).includes("/captured-covers/")) return "local-existing";
  return "local-other";
}

function loadCore() {
  const games = readJson(gamesPath, []);
  const covers = readJson(coversPath, {});
  const rejected = readJson(rejectedPath, {});
  const state = readJson(statePath, {
    version: 1,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: {},
    audit: {},
    run: {
      extractedAssets: 0,
      generatedScreenshots: 0,
      generatedIllustrations: 0,
      generatedFallbacks: 0,
      normalizedCovers: 0,
      suspiciousReplaced: 0,
      filesCreated: [],
      filesChanged: [],
      filesRemoved: [],
    },
    games: {},
  });
  state.run ||= {};
  for (const [key, defaultValue] of Object.entries({
    extractedAssets: 0,
    generatedScreenshots: 0,
    generatedIllustrations: 0,
    generatedFallbacks: 0,
    normalizedCovers: 0,
    suspiciousReplaced: 0,
    filesCreated: [],
    filesChanged: [],
    filesRemoved: [],
  })) {
    state.run[key] ??= defaultValue;
  }
  state.games ||= {};
  const savedAt = Date.parse(state.updatedAt || "") || 0;
  if (existsSync(stateJournalPath)) {
    for (const line of readFileSync(stateJournalPath, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const checkpoint = JSON.parse(line);
        const checkpointAt = Date.parse(checkpoint.at || "") || 0;
        if (checkpointAt <= savedAt) continue;
        if (checkpoint.slug && checkpoint.entry) state.games[checkpoint.slug] = checkpoint.entry;
        for (const [key, value] of Object.entries(checkpoint.run || {})) state.run[key] = value;
      } catch {
        // Ignore only a trailing partial journal line from an interrupted write.
      }
    }
  }
  for (const [slug, cover] of Object.entries(covers)) {
    const entry = state.games[slug];
    if (!entry || !/-capture\.webp(?:[?#].*)?$/i.test(String(cover))) continue;
    entry.currentCover = cover;
    entry.finalSelectedCover = cover;
    entry.sourceType = "local-screenshot";
    entry.status = "complete";
    entry.generatedFallback = false;
  }
  return { games, covers, rejected, state };
}

function addRunFile(state, kind, filePath) {
  const relative = path.relative(root, filePath).replaceAll("\\", "/");
  const key = kind === "created" ? "filesCreated" : kind === "removed" ? "filesRemoved" : "filesChanged";
  const values = new Set(state.run[key] || []);
  values.add(relative);
  state.run[key] = [...values].sort();
}

function refreshSummary(state) {
  const summary = {
    total: 0,
    remote: 0,
    localExisting: 0,
    localGameArt: 0,
    localScreenshot: 0,
    localIllustrated: 0,
    localGenerated: 0,
    gameSpecific: 0,
    genericTitle: 0,
    oldGeneric: 0,
    missing: 0,
    complete: 0,
    suspicious: 0,
    unresolved: 0,
    broken: 0,
  };
  for (const entry of Object.values(state.games)) {
    summary.total += 1;
    if (entry.sourceType === "remote-existing") summary.remote += 1;
    else if (entry.sourceType === "local-existing") summary.localExisting += 1;
    else if (entry.sourceType === "local-game-art") summary.localGameArt += 1;
    else if (entry.sourceType === "local-screenshot") summary.localScreenshot += 1;
    else if (entry.sourceType === "local-generated-illustration") summary.localIllustrated += 1;
    else if (entry.sourceType === "local-generated-title") {
      summary.localGenerated += 1;
      summary.genericTitle += 1;
    }
    else if (entry.sourceType === "old-generic") summary.oldGeneric += 1;
    else if (entry.sourceType === "missing") summary.missing += 1;

    if (entry.status in summary) summary[entry.status] += 1;
  }
  summary.gameSpecific = summary.total - summary.genericTitle - summary.oldGeneric - summary.missing;
  state.run.generatedScreenshots = Object.values(state.games).filter(
    (entry) => entry.sourceType === "local-screenshot" && entry.changedDuringRun
  ).length;
  state.run.generatedIllustrations = Object.values(state.games).filter(
    (entry) => entry.sourceType === "local-generated-illustration" && entry.changedDuringRun
  ).length;
  state.summary = summary;
}

async function mapConcurrent(items, workers, operation) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, items.length || 1) }, worker));
  return results;
}

function entropy(histogram, total) {
  let value = 0;
  for (const count of histogram) {
    if (!count) continue;
    const probability = count / total;
    value -= probability * Math.log2(probability);
  }
  return value;
}

function contiguousDarkBorder(rows, fromStart = true) {
  let count = 0;
  const ordered = fromStart ? rows : [...rows].reverse();
  for (const row of ordered) {
    if (row.mean > 16 || row.deviation > 7) break;
    count += 1;
  }
  return count;
}

async function analyzeImage(filePath) {
  const input = Buffer.isBuffer(filePath) ? filePath : filePath;
  const sourceBuffer = Buffer.isBuffer(filePath) ? filePath : null;
  const fileSize = sourceBuffer ? sourceBuffer.length : statSync(filePath).size;
  const image = sharp(input, { failOn: "error", animated: false });
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) throw new Error("Image has no decodable dimensions");

  const sample = await image
    .clone()
    .rotate()
    .flatten({ background: "#000000" })
    .resize(64, 36, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const luminance = [];
  const histogram = new Array(32).fill(0);
  let nearBlack = 0;
  let nearWhite = 0;
  let sum = 0;
  for (let index = 0; index < sample.length; index += 3) {
    const value = Math.round(sample[index] * 0.2126 + sample[index + 1] * 0.7152 + sample[index + 2] * 0.0722);
    luminance.push(value);
    histogram[Math.min(31, Math.floor(value / 8))] += 1;
    sum += value;
    if (value < 12) nearBlack += 1;
    if (value > 243) nearWhite += 1;
  }
  const pixels = luminance.length;
  const mean = sum / pixels;
  const deviation = Math.sqrt(luminance.reduce((total, value) => total + (value - mean) ** 2, 0) / pixels);

  const corners = [0, 63, 35 * 64, 35 * 64 + 63];
  const cornerColor = [0, 1, 2].map((channel) =>
    corners.reduce((total, pixel) => total + sample[pixel * 3 + channel], 0) / corners.length
  );
  let contentPixels = 0;
  for (let index = 0; index < sample.length; index += 3) {
    const distance = Math.sqrt(
      (sample[index] - cornerColor[0]) ** 2 +
        (sample[index + 1] - cornerColor[1]) ** 2 +
        (sample[index + 2] - cornerColor[2]) ** 2
    );
    if (distance > 42) contentPixels += 1;
  }

  const rows = [];
  for (let y = 0; y < 36; y += 1) {
    const values = luminance.slice(y * 64, (y + 1) * 64);
    const rowMean = values.reduce((total, value) => total + value, 0) / values.length;
    rows.push({
      mean: rowMean,
      deviation: Math.sqrt(values.reduce((total, value) => total + (value - rowMean) ** 2, 0) / values.length),
    });
  }
  const darkBorderRows = contiguousDarkBorder(rows, true) + contiguousDarkBorder(rows, false);

  let transparentFraction = 0;
  if (metadata.hasAlpha) {
    const alphaSample = await image.clone().rotate().resize(32, 18, { fit: "fill" }).ensureAlpha().raw().toBuffer();
    let transparent = 0;
    for (let index = 3; index < alphaSample.length; index += 4) {
      if (alphaSample[index] < 20) transparent += 1;
    }
    transparentFraction = transparent / (alphaSample.length / 4);
  }

  const hashSample = await image.clone().rotate().resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer();
  let differenceHash = 0n;
  let bit = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (hashSample[y * 9 + x] > hashSample[y * 9 + x + 1]) differenceHash |= 1n << bit;
      bit += 1n;
    }
  }

  const aspectRatio = width / height;
  const visualEntropy = entropy(histogram, pixels);
  const blackFraction = nearBlack / pixels;
  const whiteFraction = nearWhite / pixels;
  const contentFraction = contentPixels / pixels;
  const letterboxFraction = Math.min(1, darkBorderRows / 36);
  const flags = [];
  const normalization = [];
  let qualityScore = 100;

  if (fileSize < 2400) {
    flags.push("tiny-file");
    qualityScore -= 35;
  }
  if (width < 640 || height < 360) {
    normalization.push("low-resolution");
    qualityScore -= width < 320 || height < 180 ? 28 : 10;
    if (width < 320 || height < 180) flags.push("very-low-resolution");
  }
  if (Math.abs(aspectRatio - 16 / 9) > 0.055) {
    normalization.push("non-16-9");
    qualityScore -= 8;
  }
  if (blackFraction > 0.92 && visualEntropy < 2.7) {
    flags.push("near-black");
    qualityScore -= 55;
  }
  if (whiteFraction > 0.95 && visualEntropy < 2.4) {
    flags.push("near-white");
    qualityScore -= 55;
  }
  if (visualEntropy < 1.35) {
    flags.push("low-entropy");
    qualityScore -= 45;
  } else if (visualEntropy < 2.1) {
    flags.push("weak-entropy");
    qualityScore -= 18;
  }
  if (contentFraction < 0.065 && visualEntropy < 3.1) {
    flags.push("tiny-content");
    qualityScore -= 32;
  }
  if (letterboxFraction > 0.5) {
    flags.push("extreme-letterbox");
    qualityScore -= 22;
  }
  if (transparentFraction > 0.82) {
    flags.push("mostly-transparent");
    qualityScore -= 55;
  }

  return {
    width,
    height,
    aspectRatio: Number(aspectRatio.toFixed(4)),
    fileSize,
    meanLuminance: Number(mean.toFixed(2)),
    deviation: Number(deviation.toFixed(2)),
    entropy: Number(visualEntropy.toFixed(3)),
    nearBlackFraction: Number(blackFraction.toFixed(4)),
    nearWhiteFraction: Number(whiteFraction.toFixed(4)),
    contentFraction: Number(contentFraction.toFixed(4)),
    letterboxFraction: Number(letterboxFraction.toFixed(4)),
    transparentFraction: Number(transparentFraction.toFixed(4)),
    differenceHash: differenceHash.toString(16).padStart(16, "0"),
    sha256: createHash("sha256").update(sourceBuffer || readFileSync(filePath)).digest("hex"),
    flags,
    normalization,
    qualityScore: Math.max(0, Math.round(qualityScore)),
  };
}

function hasSevereFlags(quality) {
  const severe = new Set([
    "tiny-file",
    "very-low-resolution",
    "near-black",
    "near-white",
    "low-entropy",
    "tiny-content",
    "mostly-transparent",
    "wrong-search-provenance",
    "duplicate-exact",
    "duplicate-near",
  ]);
  return (quality?.flags || []).some((flag) => severe.has(String(flag).split(":", 1)[0]));
}

function titleTokens(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !/^(old|backup|main|game|only|v|version|beta|alpha|statics?|staticd)$/.test(token))
  );
}

function titlesAreRelated(a, b) {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (!left.size || !right.size) return false;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.min(left.size, right.size) >= 0.55;
}

function classifyDuplicates(entries, key, flag, minimumGroupSize = 2) {
  const groups = new Map();
  for (const entry of entries) {
    const value = entry.quality?.[key];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(entry);
  }
  const suspiciousGroups = [];
  for (const group of groups.values()) {
    if (group.length < minimumGroupSize) continue;
    const unrelated = group.some((entry, index) =>
      group.slice(index + 1).some((other) => !titlesAreRelated(entry.title, other.title))
    );
    if (!unrelated) continue;
    suspiciousGroups.push(group.map((entry) => entry.slug));
    for (const entry of group) {
      entry.quality.flags ||= [];
      if (!entry.quality.flags.includes(flag)) entry.quality.flags.push(flag);
      entry.quality.qualityScore = Math.max(0, entry.quality.qualityScore - 30);
      entry.qualityScore = entry.quality.qualityScore;
      entry.status = "suspicious";
      entry.rejectionReason = [...new Set([entry.rejectionReason, flag].filter(Boolean))].join("; ");
    }
  }
  return suspiciousGroups;
}

async function inventory() {
  const { games, covers, rejected, state } = loadCore();
  if (!existsSync(backupPath)) {
    copyFileSync(coversPath, backupPath);
    addRunFile(state, "created", backupPath);
  }

  const duplicateSlugs = [];
  const seen = new Set();
  const referencedLocal = new Set();
  for (const game of games) {
    if (!game?.slug) continue;
    if (seen.has(game.slug)) duplicateSlugs.push(game.slug);
    seen.add(game.slug);
    const cover = covers[game.slug] || "";
    const sourceType = initialSourceType(cover);
    const previous = state.games[game.slug] || {};
    const entry = {
      ...previous,
      slug: game.slug,
      title: titleFor(game),
      file: game.file || `games/${game.slug}.html`,
      category: previous.category || inferCategory(game),
      initialCover: previous.initialCover ?? cover,
      currentCover: cover,
      finalSelectedCover: cover,
      sourceType: previous.sourceType?.startsWith("local-") && previous.changedDuringRun ? previous.sourceType : sourceType,
      attempts: Math.max(Number(previous.attempts || 0), Number(rejected[game.slug]?.attempts || 0)),
      rejectionReason: previous.rejectionReason || rejected[game.slug]?.error || "",
      status: previous.status || "complete",
      qualityScore: previous.qualityScore ?? null,
      quality: previous.quality || null,
      changedDuringRun: Boolean(previous.changedDuringRun),
    };

    if (!cover) {
      entry.status = "unresolved";
      entry.sourceType = "missing";
      entry.rejectionReason ||= "missing cover assignment";
    } else if (isOldGeneric(cover)) {
      entry.status = "unresolved";
      entry.sourceType = "old-generic";
      entry.rejectionReason ||= "old generic generated-cover fallback";
    } else if (isRemoteCover(cover)) {
      try {
        new URL(cover);
        if (!entry.changedDuringRun) entry.status = "complete";
      } catch {
        entry.status = "broken";
        entry.rejectionReason = "invalid remote cover URL";
      }
    } else {
      const localPath = publicPathToFile(cover);
      if (localPath) referencedLocal.add(path.resolve(localPath));
      if (!localPath || !existsSync(localPath)) {
        entry.status = "broken";
        entry.rejectionReason = "local cover file is missing";
      } else {
        try {
          const metadata = await sharp(localPath, { failOn: "error" }).metadata();
          if (!metadata.width || !metadata.height) throw new Error("missing dimensions");
          if (!entry.changedDuringRun) entry.status = "complete";
          entry.dimensions = { width: metadata.width, height: metadata.height };
        } catch (error) {
          entry.status = "broken";
          entry.rejectionReason = `local cover cannot be decoded: ${error.message}`;
        }
      }
    }
    state.games[game.slug] = entry;
  }

  for (const slug of Object.keys(state.games)) {
    if (!seen.has(slug)) delete state.games[slug];
  }

  const imageFiles = readFileNames(outputDir).filter((name) => /\.(?:jpe?g|png|webp|gif)$/i.test(name));
  const orphans = imageFiles
    .map((name) => path.join(outputDir, name))
    .filter((filePath) => !referencedLocal.has(path.resolve(filePath)))
    .map((filePath) => path.basename(filePath))
    .sort();
  state.inventory = {
    at: new Date().toISOString(),
    catalogEntries: games.length,
    manifestEntries: Object.keys(covers).length,
    duplicateSlugs,
    orphanedLocalImages: orphans,
  };
  addRunFile(state, "created", statePath);
  saveState(state);
  console.log(JSON.stringify({ summary: state.summary, inventory: state.inventory }, null, 2));
}

function readFileNames(directory) {
  return existsSync(directory) ? readdirSync(directory) : [];
}

async function audit() {
  const { games, covers, state } = loadCore();
  if (Object.keys(state.games).length !== games.length) throw new Error("Run inventory before audit");
  const searchReport = readJson(searchReportPath, { matched: [] });
  const suspiciousSearchSlugs = new Set((searchReport.matched || []).map((entry) => entry.slug));
  const localEntries = games
    .map((game) => state.games[game.slug])
    .filter((entry) => entry && !isRemoteCover(entry.currentCover) && !isOldGeneric(entry.currentCover))
    .filter((entry) => publicPathToFile(entry.currentCover) && existsSync(publicPathToFile(entry.currentCover)));

  let processed = 0;
  const analyzed = await mapConcurrent(localEntries, concurrency, async (entry) => {
    try {
      const quality = await analyzeImage(publicPathToFile(entry.currentCover));
      if (suspiciousSearchSlugs.has(entry.slug)) {
        quality.flags.push("wrong-search-provenance");
        quality.qualityScore = Math.max(0, quality.qualityScore - 60);
      }
      processed += 1;
      if (processed % 150 === 0) console.log(`Audited ${processed}/${localEntries.length}`);
      return { entry, quality };
    } catch (error) {
      return {
        entry,
        quality: {
          flags: ["corrupt"],
          normalization: [],
          qualityScore: 0,
          error: error.message,
        },
      };
    }
  });

  for (const { entry, quality } of analyzed) {
    entry.quality = quality;
    entry.qualityScore = quality.qualityScore;
    entry.dimensions = quality.width && quality.height ? { width: quality.width, height: quality.height } : null;
    if (hasSevereFlags(quality) || quality.flags.includes("corrupt")) {
      entry.status = "suspicious";
      entry.rejectionReason = [...new Set([entry.rejectionReason, ...quality.flags].filter(Boolean))].join("; ");
    } else if (!entry.changedDuringRun) {
      entry.status = "complete";
    }
  }

  const exactDuplicateGroups = classifyDuplicates(
    analyzed.map(({ entry }) => entry),
    "sha256",
    "duplicate-exact",
    2
  );
  const nearDuplicateGroups = classifyDuplicates(
    analyzed.map(({ entry }) => entry).filter((entry) => !entry.quality.flags.includes("duplicate-exact")),
    "differenceHash",
    "duplicate-near",
    3
  );

  const suspicious = analyzed.map(({ entry }) => entry).filter((entry) => entry.status === "suspicious");
  state.audit = {
    at: new Date().toISOString(),
    analyzed: analyzed.length,
    suspicious: suspicious.length,
    lowConfidence: analyzed.filter(({ entry }) => Number(entry.qualityScore) < 70).length,
    exactDuplicateGroups,
    nearDuplicateGroups,
  };
  addRunFile(state, "created", auditPath);
  addRunFile(state, "created", qaPath);
  writeJsonAtomic(auditPath, {
    ...state.audit,
    flagged: suspicious.map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      cover: entry.currentCover,
      qualityScore: entry.qualityScore,
      flags: entry.quality?.flags || [],
    })),
  });
  saveState(state);
  generateQaGallery(state);
  console.log(JSON.stringify(state.audit, null, 2));
}

function extractReferenceValues(html) {
  const values = [];
  const attributePattern = /\b(?:src|href|poster|content)\s*=\s*(["'])(.*?)\1/gis;
  const cssPattern = /url\(\s*(["']?)(.*?)\1\s*\)/gis;
  for (const match of html.matchAll(attributePattern)) values.push(match[2]);
  for (const match of html.matchAll(cssPattern)) values.push(match[2]);
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function resolveLocalAsset(gameFile, reference) {
  if (/^(?:https?:)?\/\//i.test(reference) || /^(?:blob|javascript|about):/i.test(reference)) return null;
  if (reference.startsWith("data:")) return { type: "data", value: reference };
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean || /\.(?:js|mjs|css|json|wasm|data|mem|unityweb|mp3|ogg|mp4)$/i.test(clean)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    decoded = clean;
  }
  const gameAbsolute = path.resolve(root, gameFile);
  const resolved = decoded.startsWith("/")
    ? path.resolve(root, decoded.replace(/^\/+/, ""))
    : path.resolve(path.dirname(gameAbsolute), decoded);
  if (!resolved.startsWith(root) || !existsSync(resolved) || !statSync(resolved).isFile()) return null;
  if (!/\.(?:png|jpe?g|webp|gif|svg)$/i.test(resolved)) return null;
  if (/captured-covers|generated-covers/i.test(resolved)) return null;
  return { type: "file", value: resolved };
}

function decodeDataImage(value) {
  const match = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) return null;
  try {
    return Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  } catch {
    return null;
  }
}

async function scoreAsset(candidate, label) {
  try {
    const input = Buffer.isBuffer(candidate) ? candidate : candidate.value;
    const metadata = await sharp(input, { failOn: "error", animated: false }).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const area = width * height;
    if (width < 160 || height < 90 || area < 40_000) return null;
    const lower = label.toLowerCase();
    if (/sprite|sheet|tiles?|particle|font|button|cursor|favicon|ico\b/.test(lower) && area < 500_000) return null;
    let score = Math.min(45, Math.log2(Math.max(1, area)) * 2);
    const ratio = width / height;
    score += Math.max(0, 22 - Math.abs(ratio - 16 / 9) * 18);
    if (/cover|splash|title|menu|background|\bbg\b|promo|loading/.test(lower)) score += 18;
    if (/logo|icon/.test(lower)) score -= 10;
    if (metadata.hasAlpha && width < 640) score -= 8;
    return { score, width, height, metadata };
  } catch {
    return null;
  }
}

async function normalizeToCover(input, outputPath) {
  const image = sharp(input, { failOn: "error", animated: false }).rotate();
  const metadata = await image.metadata();
  const ratio = (metadata.width || 1) / (metadata.height || 1);
  let rendered;
  if (ratio >= 1.35 && ratio <= 2.25 && (metadata.width || 0) >= 480 && (metadata.height || 0) >= 270) {
    rendered = await image
      .resize(960, 540, { fit: "cover", position: sharp.strategy.entropy })
      .flatten({ background: "#111111" })
      .webp({ quality: 84, effort: 4, smartSubsample: true })
      .toBuffer();
  } else {
    const sourceBuffer = await image.toBuffer();
    const background = await sharp(sourceBuffer)
      .resize(960, 540, { fit: "cover", position: sharp.strategy.entropy })
      .blur(26)
      .modulate({ brightness: 0.52, saturation: 0.78 })
      .webp({ quality: 78 })
      .toBuffer();
    const foreground = await sharp(sourceBuffer)
      .resize(840, 460, { fit: "inside", withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer({ resolveWithObject: true });
    rendered = await sharp(background)
      .composite([
        {
          input: foreground.data,
          left: Math.max(0, Math.floor((960 - foreground.info.width) / 2)),
          top: Math.max(0, Math.floor((540 - foreground.info.height) / 2)),
        },
      ])
      .flatten({ background: "#111111" })
      .webp({ quality: 84, effort: 4, smartSubsample: true })
      .toBuffer();
  }
  const quality = await analyzeImage(rendered);
  if (hasSevereFlags(quality)) {
    throw new Error(`normalized candidate failed quality checks: ${quality.flags.join(", ")}`);
  }
  await writeBufferWithRetry(outputPath, rendered);
  return quality;
}

function pendingEntries(games, state) {
  return games
    .map((game) => ({ game, entry: state.games[game.slug] }))
    .filter(({ entry }) => entry && ["unresolved", "suspicious", "broken"].includes(entry.status));
}

async function extractLocalAssets() {
  const { games, covers, state } = loadCore();
  let pending = pendingEntries(games, state).filter(({ entry }) => force || !entry.assetInspection?.checked);
  if (limit) pending = pending.slice(0, limit);
  let extracted = 0;
  let inspected = 0;
  for (const { game, entry } of pending) {
    inspected += 1;
    const gamePath = path.resolve(root, entry.file);
    if (!gamePath.startsWith(root) || !existsSync(gamePath)) {
      entry.rejectionReason = [...new Set([entry.rejectionReason, "game HTML is missing"].filter(Boolean))].join("; ");
      entry.assetInspection = { checked: true, candidates: 0, selected: null };
      continue;
    }
    const html = readFileSync(gamePath, "utf8");
    const references = extractReferenceValues(html);
    const candidates = [];
    let inlineIndex = 0;
    for (const reference of references) {
      const resolved = resolveLocalAsset(entry.file, reference);
      if (!resolved) continue;
      if (resolved.type === "data") {
        const buffer = decodeDataImage(resolved.value);
        if (!buffer) continue;
        inlineIndex += 1;
        const quality = await scoreAsset(buffer, `inline-${inlineIndex}`);
        if (quality) candidates.push({ input: buffer, label: `inline-${inlineIndex}`, ...quality });
      } else {
        const quality = await scoreAsset(resolved, resolved.value);
        if (quality) candidates.push({ input: resolved.value, label: path.relative(root, resolved.value), ...quality });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0];
    if (!selected || selected.score < 48) {
      entry.assetInspection = { checked: true, candidates: candidates.length, selected: null };
      continue;
    }
    const outputPath = path.join(outputDir, `${entry.slug}-cover.webp`);
    const existedBefore = existsSync(outputPath);
    try {
      const oldLocal = publicPathToFile(entry.currentCover);
      const quality = await normalizeToCover(selected.input, outputPath);
      const publicPath = `/games/captured-covers/${entry.slug}-cover.webp`;
      covers[entry.slug] = publicPath;
      entry.currentCover = publicPath;
      entry.finalSelectedCover = publicPath;
      entry.sourceType = "local-game-art";
      entry.status = "complete";
      entry.quality = quality;
      entry.qualityScore = quality.qualityScore;
      entry.changedDuringRun = true;
      entry.assetInspection = {
        checked: true,
        candidates: candidates.length,
        selected: selected.label,
        score: Number(selected.score.toFixed(2)),
      };
      entry.replacedCover = entry.initialCover !== publicPath ? entry.currentCoverBeforeReplacement || entry.initialCover : null;
      if (oldLocal && oldLocal !== outputPath && oldLocal.startsWith(outputDir)) entry.replacedLocalFile = path.basename(oldLocal);
      state.run.extractedAssets += 1;
      extracted += 1;
      addRunFile(state, existedBefore ? "changed" : "created", outputPath);
      saveGameCheckpoint(covers, state, entry);
    } catch (error) {
      entry.rejectionReason = [...new Set([entry.rejectionReason, `asset rejected: ${error.message}`].filter(Boolean))].join("; ");
      saveState(state);
    }
    if (inspected % 50 === 0) console.log(`Inspected ${inspected}/${pending.length}; extracted ${extracted}`);
  }
  saveState(state);
  const remainingToInspect = pendingEntries(games, state).filter(({ entry }) => !entry.assetInspection?.checked).length;
  console.log(JSON.stringify({ inspected, extracted, remainingUnresolved: pendingEntries(games, state).length, remainingToInspect }, null, 2));
}

const captureMimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".wasm", "application/wasm"],
  [".data", "application/octet-stream"],
  [".mem", "application/octet-stream"],
  [".unityweb", "application/octet-stream"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".mp4", "video/mp4"],
]);

function startCaptureServer(port) {
  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);
      const decoded = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      let filePath = path.resolve(root, decoded || "index.html");
      if (!filePath.startsWith(root)) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }
      if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": captureMimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function commitTemporaryFile(temporary, destination) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      copyFileSync(temporary, destination);
      rmSync(temporary, { force: true });
      return;
    } catch (error) {
      lastError = error;
      await sleep(90 * (attempt + 1));
    }
  }
  throw lastError;
}

async function writeBufferWithRetry(destination, buffer) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      writeFileSync(destination, buffer);
      return;
    } catch (error) {
      lastError = error;
      await sleep(90 * (attempt + 1));
    }
  }
  throw lastError;
}

function temporaryImagePath(destination) {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return path.join(tmpdir(), `learningzone-${path.basename(destination)}-${nonce}.tmp.webp`);
}

function withHardTimeout(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function decodeHtmlAttribute(value) {
  const named = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'" };
  return String(value || "").replace(
    /&#x([0-9a-f]+);|&#([0-9]+);|&(quot|amp|lt|gt|apos);/gi,
    (match, hexadecimal, decimal, entity) => {
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      return named[String(entity).toLowerCase()] || match;
    }
  );
}

function tagAttribute(tag, name) {
  const match = String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeHtmlAttribute(match[1]) : "";
}

async function loadPublisherEmbed(entry) {
  const localPath = path.resolve(root, entry.file || "");
  if (!localPath.startsWith(root) || !existsSync(localPath)) return null;
  const localHtml = readFileSync(localPath, "utf8");
  const sourceMeta = (localHtml.match(/<meta\b[^>]*>/gi) || []).find(
    (tag) => tagAttribute(tag, "name") === "learningzone-original-source"
  );
  const sourceUrl = tagAttribute(sourceMeta, "content");
  if (!/^https:\/\/sites\.google\.com\//i.test(sourceUrl)) return null;

  const iframeTag = localHtml.match(/<iframe\b[^>]*>/i)?.[0] || "";
  const iframeUrl = tagAttribute(iframeTag, "src");
  const preferredEmbedId = iframeUrl.match(/\/embeds\/([a-f0-9]+)\//i)?.[1] || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let response;
  try {
    response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (LearningZone cover capture)" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`publisher page returned ${response.status}`);
  const publisherHtml = await response.text();
  const embedded = [];
  const pairPattern = /data-url="([^"]+)"[^>]*\sdata-code="([^"]*)"/gi;
  for (const match of publisherHtml.matchAll(pairPattern)) {
    const url = decodeHtmlAttribute(match[1]);
    const html = decodeHtmlAttribute(match[2]);
    if (!/<(?:!doctype|html|head|body)\b/i.test(html)) continue;
    embedded.push({ url, html, preferred: Boolean(preferredEmbedId && url.includes(preferredEmbedId)) });
  }
  const selected = embedded.sort((left, right) => Number(right.preferred) - Number(left.preferred) || right.html.length - left.html.length)[0];
  if (!selected) throw new Error("publisher page did not expose usable embedded game HTML");

  const baseTag = `<base href="${escapeHtml(selected.url)}" target="_blank"><style>.qr-container{display:none!important}</style>`;
  const html = /<head\b[^>]*>/i.test(selected.html)
    ? selected.html.replace(/<head\b[^>]*>/i, (head) => `${head}${baseTag}`)
    : `${baseTag}${selected.html}`;
  return { html, sourceUrl, embedUrl: selected.url };
}

async function captureCandidateFrames(browser, item, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(12000);
  const frames = [];
  let pageError = "";
  page.on("pageerror", (error) => {
    pageError ||= error.message;
  });
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  context.on("page", (openedPage) => {
    if (openedPage !== page) openedPage.close().catch(() => {});
  });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (/(doubleclick|googlesyndication|google-analytics|googletagmanager|adservice|taboola|outbrain|facebook\.net|twitter\.com\/widgets)/i.test(url)) {
      route.abort().catch(() => {});
    } else route.continue().catch(() => {});
  });

  const takeFrame = async (label) => {
    try {
      const buffer = await page.screenshot({ type: "jpeg", quality: 82, fullPage: false, timeout: 7000 });
      const quality = await analyzeImage(buffer);
      const visibleText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      frames.push({ label, buffer, quality, visibleText });
    } catch {
      // A later frame may still succeed.
    }
  };

  try {
    const localUrl = `${baseUrl}/${String(item.entry.file).replaceAll("\\", "/").replace(/^\/+/, "")}`;
    await page.goto(localUrl, { waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
    let captureSource = "local-page";
    let sourceUrl = "";
    let publisherError = "";
    try {
      const publisher = await loadPublisherEmbed(item.entry);
      if (publisher) {
        await page.setContent(publisher.html, { waitUntil: "domcontentloaded", timeout: 12000 });
        captureSource = "publisher-embed-code";
        sourceUrl = publisher.sourceUrl;
      }
    } catch (error) {
      publisherError = error.message;
      await page.goto(localUrl, { waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
    }
    await sleep(1400);
    await takeFrame(captureSource === "publisher-embed-code" ? "publisher-initial" : "initial");

    const initialText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (/hardware acceleration is disabled|FAQ - Chrome Hardware Acceleration/i.test(initialText)) {
      await page.mouse.click(910, 28).catch(() => {});
      await sleep(300);
    }

    const playControl = page.getByRole("button", { name: /play|start|continue|launch|begin/i }).first();
    if (await playControl.isVisible().catch(() => false)) await playControl.click({ timeout: 2500 }).catch(() => {});
    else await page.mouse.click(480, 270).catch(() => {});
    await sleep(900);
    await page.keyboard.press("Enter").catch(() => {});
    await sleep(700);
    await takeFrame("launched");

    await page.keyboard.press("Space").catch(() => {});
    await page.keyboard.press("ArrowRight").catch(() => {});
    await sleep(1800);
    await takeFrame("interaction");

    await page.mouse.click(480, 270).catch(() => {});
    await sleep(3200);
    await takeFrame("settled");

    const bodyText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    const browserError = /(?:404|not found|site can.t be reached|refused to connect|access denied|application error)/i.test(bodyText);
    const valid = frames
      .filter((frame) => !hasSevereFlags(frame.quality))
      .filter((frame) => frame.quality.qualityScore >= 68)
      .filter(() => !browserError)
      .map((frame, index) => {
        const runtimePenalty = /hardware acceleration is disabled|FAQ - Chrome Hardware Acceleration|loading embedded activity|provider may not allow|reload activity/i.test(frame.visibleText)
          ? 45
          : 0;
        return { ...frame, selectionScore: frame.quality.qualityScore + index * 2 - runtimePenalty };
      })
      .filter((frame) => frame.selectionScore >= 68)
      .sort((a, b) => b.selectionScore - a.selectionScore)[0];
    if (!valid) {
      const best = [...frames].sort((a, b) => b.quality.qualityScore - a.quality.qualityScore)[0];
      return {
        status: "rejected",
        reason: browserError
          ? "browser error page"
          : best
            ? `best frame rejected: ${best.quality.flags.join(", ") || `score ${best.quality.qualityScore}`}`
            : publisherError || pageError || "no candidate frame",
      };
    }
    return { status: "captured", frame: valid, captureSource, sourceUrl };
  } finally {
    await context.close().catch(() => {});
  }
}

async function captureBatch() {
  const { chromium } = await import("playwright");
  const { games, covers, state } = loadCore();
  state.capture ||= { batches: [], stoppedForLowYield: false };
  if (state.capture.stoppedForLowYield && !force) {
    console.log(JSON.stringify({ skipped: true, reason: "two consecutive capture batches were below 15%" }, null, 2));
    return;
  }
  const batchLimit = Math.min(50, limit || 50);
  const available = selectedSlugs.size
    ? games
        .filter((game) => selectedSlugs.has(game.slug))
        .map((game) => ({ game, entry: state.games[game.slug] }))
        .filter(({ entry }) => entry && (force || entry.sourceType === "local-generated-title"))
    : pendingEntries(games, state);
  const candidates = available
    .filter(({ entry }) => force || Number(entry.attempts || 0) < 2)
    .slice(0, batchLimit);
  if (!candidates.length) {
    console.log(JSON.stringify({ attempted: 0, captured: 0, reason: "no matching entries remain below the two-attempt limit" }, null, 2));
    return;
  }

  const port = Math.max(1024, Number(args.get("port") || 4199));
  const hardTimeout = Math.min(45_000, Math.max(12_000, Number(args.get("hard-timeout") || 35_000)));
  const server = await startCaptureServer(port);
  let browser;
  const startedAt = Date.now();
  const results = [];
  try {
    browser = await chromium.launch({ headless: true });
    const workerCount = Math.min(4, concurrency, candidates.length);
    let cursor = 0;
    async function worker() {
      while (cursor < candidates.length) {
        const index = cursor;
        cursor += 1;
        const item = candidates[index];
        const entry = item.entry;
        entry.attempts = Number(entry.attempts || 0) + 1;
        if (selectedSlugs.size) entry.sourceCaptureAttempts = Number(entry.sourceCaptureAttempts || 0) + 1;
        const oldCover = entry.currentCover;
        try {
          const result = await withHardTimeout(
            captureCandidateFrames(browser, item, `http://127.0.0.1:${port}`),
            hardTimeout,
            entry.slug
          );
          if (result.status === "captured") {
            const outputPath = path.join(outputDir, `${entry.slug}-capture.webp`);
            const existedBefore = existsSync(outputPath);
            const rendered = await sharp(result.frame.buffer)
              .webp({ quality: 84, effort: 4, smartSubsample: true })
              .toBuffer();
            const quality = await analyzeImage(rendered);
            if (hasSevereFlags(quality)) throw new Error(`selected frame failed final check: ${quality.flags.join(", ")}`);
            await writeBufferWithRetry(outputPath, rendered);
            const publicPath = `/games/captured-covers/${entry.slug}-capture.webp`;
            covers[entry.slug] = publicPath;
            entry.currentCover = publicPath;
            entry.finalSelectedCover = publicPath;
            entry.sourceType = "local-screenshot";
            entry.status = "complete";
            entry.quality = quality;
            entry.qualityScore = quality.qualityScore;
            entry.changedDuringRun = true;
            entry.captureFrame = result.frame.label;
            entry.captureSource = result.captureSource;
            entry.captureSourceUrl = result.sourceUrl || "";
            entry.generatedFallback = false;
            entry.replacedCover = oldCover;
            const oldLocal = publicPathToFile(oldCover);
            if (oldLocal && oldLocal !== outputPath && oldLocal.startsWith(outputDir)) entry.replacedLocalFile = path.basename(oldLocal);
            entry.rejectionReason = "";
            state.run.generatedScreenshots += 1;
            addRunFile(state, existedBefore ? "changed" : "created", outputPath);
            saveProgress(covers, state);
            results.push({
              slug: entry.slug,
              status: "captured",
              score: quality.qualityScore,
              source: result.captureSource,
            });
          } else {
            entry.rejectionReason = result.reason;
            saveState(state);
            results.push({ slug: entry.slug, status: "rejected", reason: result.reason });
          }
        } catch (error) {
          entry.rejectionReason = error.message;
          saveState(state);
          results.push({ slug: entry.slug, status: "failed", reason: error.message });
        }
      }
    }
    await Promise.all(Array.from({ length: workerCount }, worker));
  } finally {
    await browser?.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }

  const captured = results.filter((result) => result.status === "captured").length;
  const rate = candidates.length ? captured / candidates.length : 0;
  const batch = {
    at: new Date().toISOString(),
    targeted: selectedSlugs.size > 0,
    attempted: candidates.length,
    captured,
    rejected: results.filter((result) => result.status === "rejected").length,
    failed: results.filter((result) => result.status === "failed").length,
    successRate: Number(rate.toFixed(4)),
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    results,
  };
  state.capture.batches.push(batch);
  const lastTwo = state.capture.batches.filter((item) => !item.targeted).slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((item) => item.successRate < 0.15)) state.capture.stoppedForLowYield = true;
  saveProgress(covers, state);
  console.log(JSON.stringify({ ...batch, stoppedForLowYield: state.capture.stoppedForLowYield }, null, 2));
}

function seededRandom(seed) {
  let value = Number.parseInt(hashText(seed).slice(0, 8), 16) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0xffffffff;
  };
}

function hsl(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function wrapTitle(title) {
  const words = title.split(/\s+/).filter(Boolean);
  let fontSize = title.length <= 18 ? 74 : title.length <= 34 ? 61 : title.length <= 55 ? 49 : title.length <= 82 ? 39 : 31;
  let maxChars = fontSize >= 70 ? 19 : fontSize >= 58 ? 24 : fontSize >= 46 ? 31 : fontSize >= 37 ? 39 : 49;
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  while (lines.length > 4 && fontSize > 24) {
    fontSize -= 3;
    maxChars += 5;
    lines.length = 0;
    line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return { lines, fontSize };
}

function motifSvg(category, random, accent, soft, variant) {
  const shapes = [];
  if (category === "puzzle" || category === "strategy") {
    for (let index = 0; index < 18; index += 1) {
      const x = 575 + Math.floor(random() * 340);
      const y = 75 + Math.floor(random() * 390);
      const size = 24 + Math.floor(random() * 70);
      shapes.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${8 + variant}" fill="none" stroke="${soft}" stroke-width="2" opacity="${(0.12 + random() * 0.28).toFixed(2)}"/>`);
    }
  } else if (category === "racing" || category === "action") {
    for (let index = 0; index < 15; index += 1) {
      const y = 60 + index * 30 + Math.floor(random() * 12);
      const width = 80 + Math.floor(random() * 260);
      shapes.push(`<path d="M ${930 - width} ${y} L 930 ${y - 24}" stroke="${index % 3 === 0 ? accent : soft}" stroke-width="${4 + (index % 4)}" opacity="${(0.12 + random() * 0.3).toFixed(2)}"/>`);
    }
  } else if (category === "rhythm") {
    for (let index = 0; index < 22; index += 1) {
      const x = 565 + index * 17;
      const height = 35 + Math.floor(random() * 230);
      shapes.push(`<rect x="${x}" y="${270 - height / 2}" width="9" height="${height}" rx="5" fill="${index % 4 === 0 ? accent : soft}" opacity="${(0.16 + random() * 0.34).toFixed(2)}"/>`);
    }
  } else if (category === "sports") {
    shapes.push(`<circle cx="765" cy="270" r="175" fill="none" stroke="${soft}" stroke-width="3" opacity=".28"/>`);
    shapes.push(`<circle cx="765" cy="270" r="72" fill="none" stroke="${accent}" stroke-width="7" opacity=".4"/>`);
    shapes.push(`<path d="M590 270h350M765 95v350" stroke="${soft}" stroke-width="3" opacity=".22"/>`);
  } else if (category === "sandbox" || category === "platform") {
    for (let index = 0; index < 15; index += 1) {
      const x = 560 + Math.floor(random() * 340);
      const y = 80 + Math.floor(random() * 360);
      const size = 28 + Math.floor(random() * 56);
      shapes.push(`<path d="M${x} ${y}l${size} ${-size / 2} ${size} ${size / 2}-${size} ${size / 2}z" fill="${index % 4 === 0 ? accent : soft}" opacity="${(0.1 + random() * 0.25).toFixed(2)}"/>`);
    }
  } else if (category === "horror") {
    for (let index = 0; index < 18; index += 1) {
      const x = 560 + index * 22;
      const top = 45 + Math.floor(random() * 160);
      shapes.push(`<path d="M${x} ${top}v${440 - top}" stroke="${index % 5 === 0 ? accent : soft}" stroke-width="${5 + Math.floor(random() * 12)}" opacity="${(0.08 + random() * 0.3).toFixed(2)}"/>`);
    }
  } else {
    for (let index = 0; index < 18; index += 1) {
      const cx = 570 + Math.floor(random() * 350);
      const cy = 70 + Math.floor(random() * 400);
      const radius = 8 + Math.floor(random() * 52);
      shapes.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${index % 4 === 0 ? accent : soft}" stroke-width="${2 + (index % 5)}" opacity="${(0.1 + random() * 0.3).toFixed(2)}"/>`);
    }
  }
  return shapes.join("");
}

function fallbackSvg(entry) {
  const digest = hashText(entry.slug);
  const random = seededRandom(entry.slug);
  const hue = Number.parseInt(digest.slice(0, 4), 16) % 360;
  const secondaryHue = (hue + 38 + (Number.parseInt(digest.slice(4, 6), 16) % 120)) % 360;
  const accentHue = (hue + 155 + (Number.parseInt(digest.slice(6, 8), 16) % 55)) % 360;
  const backgroundA = hsl(hue, 57, 14);
  const backgroundB = hsl(secondaryHue, 62, 22);
  const accent = hsl(accentHue, 84, 66);
  const soft = hsl((accentHue + 20) % 360, 70, 78);
  const variant = Number.parseInt(digest.slice(8, 10), 16) % 7;
  const { lines, fontSize } = wrapTitle(entry.title);
  const lineHeight = Math.round(fontSize * 1.08);
  const totalHeight = lines.length * lineHeight;
  const startY = 286 - totalHeight / 2 + fontSize * 0.75;
  const title = lines
    .map((line, index) => `<text x="70" y="${Math.round(startY + index * lineHeight)}" font-size="${fontSize}" font-weight="800" fill="#ffffff">${escapeHtml(line)}</text>`)
    .join("");
  const motif = motifSvg(entry.category, random, accent, soft, variant);
  const code = digest.slice(0, 6).toUpperCase();
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${backgroundA}"/>
        <stop offset="1" stop-color="${backgroundB}"/>
      </linearGradient>
      <radialGradient id="light" cx="78%" cy="45%" r="56%">
        <stop offset="0" stop-color="${accent}" stop-opacity=".28"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grain" width="38" height="38" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1" fill="#fff" opacity=".045"/>
      </pattern>
    </defs>
    <rect width="960" height="540" fill="url(#bg)"/>
    <rect width="960" height="540" fill="url(#light)"/>
    <rect width="960" height="540" fill="url(#grain)"/>
    <path d="M0 0h18v540H0z" fill="${accent}"/>
    <g>${motif}</g>
    <rect x="48" y="52" width="${155 + entry.category.length * 7}" height="34" rx="17" fill="#05070b" opacity=".62"/>
    <circle cx="68" cy="69" r="5" fill="${accent}"/>
    <text x="82" y="75" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="#ffffff">${escapeHtml(entry.category.toUpperCase())}</text>
    <g font-family="Arial, Helvetica, sans-serif">${title}</g>
    <rect x="68" y="${Math.min(445, Math.round(startY + totalHeight + 8))}" width="112" height="6" rx="3" fill="${accent}"/>
    <text x="70" y="500" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#ffffff" opacity=".76">LEARNINGZONE</text>
    <text x="890" y="500" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="1" fill="#ffffff" opacity=".42">${code}</text>
  </svg>`;
}

function illustrationConcept(entry) {
  const value = `${entry.title} ${entry.slug}`.toLowerCase();
  const rules = [
    ["factory", /factory|tycoon|idle|clicker|business|money|millionaire|mining|miner|capital|capatal/],
    ["blocks", /minecraft|craft|voxel|block|sandbox|build|construction/],
    ["horror", /zombie|horror|fnaf|freddy|scary|haunt|nightmare|dead|evil|monster|slender/],
    ["basketball", /basketball|hoop|dunk/],
    ["football", /football|yard|touchdown|quarterback|retro bowl/],
    ["soccer", /soccer|penalty|goalkeeper|world cup/],
    ["racing", /racing|race|racer|car|moto|motor|bike|drive|drift|parking|highway|traffic/],
    ["space", /space|alien|galaxy|planet|astro|rocket|orbit|star|moon/],
    ["shooter", /shoot|sniper|gun|war|battle|combat|weapon|doom|strike|fps/],
    ["puzzle", /puzzle|tetris|2048|merge|match|sudoku|maze|wordle|word|quiz|trivia|attorney|detective|escape room/],
    ["platform", /platform|mario|sonic|kirby|megaman|mega man|donkey kong|runner|run |jump|obby|vex|parkour|adventure/],
    ["flight", /flight|plane|airplane|airline|helicopter|fly|flying|bird/],
    ["food", /food|cook|cooking|burger|pizza|restaurant|sushi|cake|candy|fruit/],
    ["ocean", /ocean|fish|shark|water|pool|boat|raft|submarine/],
    ["tabletop", /chess|card|poker|solitaire|uno|monopoly|board|checkers|mahjong/],
    ["rhythm", /music|rhythm|dance|fnf|friday night|beat|piano|guitar|sound/],
    ["defense", /tower|defense|defence|castle|kingdom|strategy|army|clash/],
    ["winter", /snow|winter|ski|ice|sled|christmas|xmas/],
    ["snake", /snake|slither|worm/],
    ["fantasy", /fantasy|dragon|knight|sword|wizard|magic|dungeon|hero|zelda|pokemon|poké|poke-/],
    ["sports", /baseball|tennis|golf|volley|boxing|wrestl|sport|olympic|skate/],
  ];
  for (const [concept, pattern] of rules) if (pattern.test(value)) return concept;
  if (entry.category === "rhythm") return "rhythm";
  if (entry.category === "platform") return "platform";
  if (entry.category === "racing") return "racing";
  if (entry.category === "horror") return "horror";
  if (entry.category === "sports") return "sports";
  if (entry.category === "puzzle") return "puzzle";
  if (entry.category === "strategy") return "defense";
  if (entry.category === "sandbox") return "blocks";
  if (entry.category === "action") return "shooter";
  return "arcade";
}

function illustrationStars(random, color, count = 28) {
  return Array.from({ length: count }, () => {
    const x = 35 + Math.round(random() * 890);
    const y = 24 + Math.round(random() * 330);
    const radius = 1 + Math.round(random() * 3);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" opacity="${(0.24 + random() * 0.62).toFixed(2)}"/>`;
  }).join("");
}

function illustrationScene(concept, random, colors, variant) {
  const { accent, soft, bright, ink } = colors;
  const stars = illustrationStars(random, soft, 24);
  const gear = (cx, cy, radius, rotation = 0) => {
    const teeth = Array.from({ length: 10 }, (_, index) => {
      const angle = (index * 36 * Math.PI) / 180;
      const x = cx + Math.cos(angle) * (radius + 10);
      const y = cy + Math.sin(angle) * (radius + 10);
      return `<rect x="${x - 7}" y="${y - 13}" width="14" height="26" rx="3" fill="${accent}" transform="rotate(${index * 36 + rotation} ${x} ${y})"/>`;
    }).join("");
    return `<g opacity=".9">${teeth}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${ink}" stroke="${accent}" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="${Math.max(10, radius * 0.28)}" fill="${bright}"/></g>`;
  };
  const cube = (x, y, size, top = bright) => `<g>
    <path d="M${x} ${y}l${size} ${-size / 2} ${size} ${size / 2}-${size} ${size / 2}z" fill="${top}"/>
    <path d="M${x} ${y}l${size} ${size / 2}v${size}l-${size}-${size / 2}z" fill="${accent}"/>
    <path d="M${x + size} ${y + size / 2}l${size}-${size / 2}v${size}l-${size} ${size / 2}z" fill="${soft}" opacity=".72"/>
  </g>`;

  if (concept === "factory") {
    return `<g>${stars}<path d="M0 320H960V540H0z" fill="${ink}" opacity=".58"/>
      <path d="M420 320V145h78v58h68V96h67v224z" fill="${soft}" opacity=".32"/>
      <rect x="449" y="175" width="29" height="145" fill="${bright}" opacity=".72"/><rect x="584" y="128" width="25" height="192" fill="${accent}" opacity=".74"/>
      <path d="M462 142c-35-31 12-54-18-88M597 96c34-28-12-47 22-74" fill="none" stroke="${soft}" stroke-width="15" stroke-linecap="round" opacity=".25"/>
      ${gear(735, 218, 64, variant * 6)}${gear(848, 300, 42, variant * -8)}
      <path d="M350 352h540" stroke="${bright}" stroke-width="18"/><g fill="${accent}">${[390, 475, 560, 645].map((x) => `<rect x="${x}" y="315" width="54" height="42" rx="5"/>`).join("")}</g>
    </g>`;
  }
  if (concept === "blocks") {
    return `<g>${stars}<circle cx="780" cy="112" r="62" fill="${bright}" opacity=".75"/>
      <path d="M0 330L260 218l150 72 180-124 370 180v194H0z" fill="${ink}" opacity=".48"/>
      ${cube(470, 225, 92)}${cube(610, 280, 72, soft)}${cube(735, 208, 60, accent)}${cube(315, 312, 55, bright)}
      <path d="M0 382h960" stroke="${soft}" stroke-width="5" opacity=".38"/>
    </g>`;
  }
  if (concept === "horror") {
    return `<g>${stars}<circle cx="745" cy="145" r="105" fill="${bright}" opacity=".74"/>
      <path d="M490 350V205l86-70 86 70v145h-48v-90h-70v90z" fill="${ink}"/><path d="M476 210l100-91 104 91" fill="none" stroke="${accent}" stroke-width="13"/>
      <rect x="554" y="222" width="28" height="32" fill="${bright}"/><rect x="609" y="222" width="28" height="32" fill="${bright}"/>
      <path d="M0 356q190-80 380 0t380 0 200 0v184H0z" fill="${ink}" opacity=".88"/>
      <g fill="${accent}"><path d="M795 246q22-27 44 0-22 17-44 0"/><path d="M858 270q18-22 36 0-18 14-36 0"/></g>
    </g>`;
  }
  if (concept === "racing") {
    return `<g>${stars}<path d="M0 330Q250 250 480 315T960 285V540H0z" fill="${ink}" opacity=".72"/>
      <path d="M515 540L650 250h92l198 290z" fill="${soft}" opacity=".52"/><path d="M690 276l72 264" stroke="${bright}" stroke-width="12" stroke-dasharray="28 25" opacity=".9"/>
      <g transform="translate(602 238) rotate(${variant % 2 ? -4 : 3})"><path d="M0 76l34-57h135l46 57 27 14v67H-18V91z" fill="${accent}"/><path d="M47 31h105l30 44H21z" fill="${bright}" opacity=".7"/><circle cx="31" cy="151" r="29" fill="${ink}" stroke="${soft}" stroke-width="8"/><circle cx="193" cy="151" r="29" fill="${ink}" stroke="${soft}" stroke-width="8"/></g>
      <path d="M70 135h330M25 188h320M110 238h250" stroke="${bright}" stroke-width="8" opacity=".25"/>
    </g>`;
  }
  if (concept === "soccer") {
    return `<g><path d="M0 70H960V540H0z" fill="${soft}" opacity=".18"/><path d="M380 340L525 115h330l105 225z" fill="${accent}" opacity=".32"/>
      <path d="M545 130h292l87 196H414zM688 130v196M526 225h338" fill="none" stroke="${bright}" stroke-width="6" opacity=".65"/>
      <circle cx="690" cy="227" r="55" fill="none" stroke="${bright}" stroke-width="6" opacity=".65"/>
      <circle cx="735" cy="230" r="82" fill="${bright}"/><path d="M735 175l38 28-14 45h-48l-14-45z" fill="${ink}"/><path d="M697 203l-39-16M773 203l42-18M711 248l-28 42M759 248l30 38" stroke="${ink}" stroke-width="12"/>
    </g>`;
  }
  if (concept === "football") {
    return `<g><path d="M0 70H960V540H0z" fill="${soft}" opacity=".17"/><path d="M390 345L525 105h335l100 240z" fill="${accent}" opacity=".34"/>
      <path d="M535 122h310l80 205H420zM590 122l-70 205M790 122l70 205M520 225h340" fill="none" stroke="${bright}" stroke-width="6" opacity=".62"/>
      <path d="M825 84v145M775 84v145M775 98h50" fill="none" stroke="${bright}" stroke-width="12" stroke-linecap="round"/>
      <g transform="translate(670 205) rotate(-18)"><ellipse cx="0" cy="0" rx="118" ry="68" fill="${accent}"/><path d="M-110 0q110-58 220 0M-110 0q110 58 220 0" fill="none" stroke="${ink}" stroke-width="7"/><path d="M-38 -14h76M-25-29v30M0-32v34M25-29v30" stroke="${bright}" stroke-width="8" stroke-linecap="round"/></g>
    </g>`;
  }
  if (concept === "basketball") {
    return `<g>${stars}<path d="M0 350h960v190H0z" fill="${ink}" opacity=".55"/><path d="M410 350q250-145 500 0" fill="none" stroke="${soft}" stroke-width="7" opacity=".42"/>
      <rect x="810" y="115" width="20" height="230" fill="${bright}"/><rect x="755" y="102" width="145" height="98" rx="8" fill="none" stroke="${soft}" stroke-width="10"/><ellipse cx="815" cy="206" rx="72" ry="18" fill="none" stroke="${accent}" stroke-width="12"/>
      <circle cx="655" cy="246" r="100" fill="${accent}"/><path d="M555 246h200M655 146q-65 100 0 200M655 146q65 100 0 200" fill="none" stroke="${ink}" stroke-width="9"/>
    </g>`;
  }
  if (concept === "space") {
    return `<g>${illustrationStars(random, bright, 52)}<circle cx="735" cy="210" r="137" fill="${accent}"/><circle cx="700" cy="175" r="78" fill="${soft}" opacity=".38"/><path d="M535 256q200 110 395-18" fill="none" stroke="${bright}" stroke-width="20" opacity=".72"/>
      <g transform="translate(505 105) rotate(24)"><path d="M0 90Q38 5 76 90v85l-38 45-38-45z" fill="${bright}"/><circle cx="38" cy="82" r="19" fill="${ink}"/><path d="M8 164l-35 40 33-3M68 164l35 40-33-3" fill="${accent}"/><path d="M24 214l14 68 14-68" fill="${soft}"/></g>
    </g>`;
  }
  if (concept === "shooter") {
    return `<g>${stars}<path d="M0 342l150-115 125 68 160-168 164 133 150-95 211 172v203H0z" fill="${ink}" opacity=".68"/>
      <circle cx="730" cy="213" r="125" fill="none" stroke="${accent}" stroke-width="9"/><circle cx="730" cy="213" r="56" fill="none" stroke="${bright}" stroke-width="5"/><path d="M730 48v330M565 213h330" stroke="${bright}" stroke-width="5"/>
      <path d="M455 300l235-93 19 46-224 117-76-8z" fill="${soft}"/><rect x="481" y="338" width="45" height="95" rx="8" fill="${accent}" transform="rotate(19 503 385)"/>
    </g>`;
  }
  if (concept === "puzzle") {
    const tiles = Array.from({ length: 16 }, (_, index) => {
      const x = 515 + (index % 4) * 91;
      const y = 52 + Math.floor(index / 4) * 79;
      const lift = (Number.parseInt(hashText(`${variant}-${index}`).slice(0, 2), 16) % 13) - 6;
      return `<rect x="${x}" y="${y + lift}" width="75" height="65" rx="14" fill="${index % 3 === 0 ? accent : index % 3 === 1 ? soft : bright}" opacity="${index % 4 === variant % 4 ? 1 : .7}"/><circle cx="${x + 37}" cy="${y + 32 + lift}" r="${8 + (index % 4) * 3}" fill="${ink}" opacity=".38"/>`;
    }).join("");
    return `<g>${stars}<rect x="485" y="28" width="398" height="355" rx="34" fill="${ink}" opacity=".46"/>${tiles}</g>`;
  }
  if (concept === "platform") {
    return `<g>${stars}<circle cx="790" cy="100" r="58" fill="${bright}" opacity=".72"/><path d="M0 350h960v190H0z" fill="${ink}" opacity=".62"/>
      <g fill="${soft}"><rect x="420" y="300" width="170" height="30" rx="8"/><rect x="650" y="225" width="145" height="30" rx="8"/><rect x="815" y="145" width="105" height="30" rx="8"/></g>
      <g fill="${bright}"><circle cx="545" cy="257" r="15"/><circle cx="702" cy="181" r="15"/><circle cx="849" cy="101" r="15"/></g>
      <g transform="translate(670 155)"><circle cx="0" cy="0" r="28" fill="${accent}"/><rect x="-26" y="25" width="52" height="70" rx="22" fill="${accent}"/><path d="M-21 88l-35 50M20 88l38 49" stroke="${bright}" stroke-width="16" stroke-linecap="round"/></g>
    </g>`;
  }
  if (concept === "flight") {
    return `<g>${stars}<g fill="${soft}" opacity=".55"><ellipse cx="555" cy="126" rx="84" ry="35"/><ellipse cx="626" cy="151" rx="102" ry="42"/><ellipse cx="830" cy="285" rx="120" ry="42"/></g>
      <path d="M0 363l168-120 155 90 160-170 180 170 128-94 169 124v177H0z" fill="${ink}" opacity=".48"/>
      <g transform="translate(585 140) rotate(${variant % 2 ? -8 : 7})"><path d="M0 75l250-42 58 31-116 48-72 82-39 4 29-79-105 5-55-29z" fill="${bright}"/><path d="M106 78l66-74 39 1-28 62" fill="${accent}"/></g>
    </g>`;
  }
  if (concept === "food") {
    return `<g>${stars}<circle cx="705" cy="219" r="165" fill="${bright}" opacity=".86"/><circle cx="705" cy="219" r="112" fill="${ink}" opacity=".82"/>
      <g fill="${accent}"><circle cx="663" cy="192" r="34"/><circle cx="739" cy="175" r="27"/><rect x="682" y="224" width="82" height="30" rx="15" transform="rotate(-12 723 239)"/></g>
      <path d="M495 65v300M475 65v105q20 28 40 0V65M855 65v300M855 65q65 67 0 135" fill="none" stroke="${soft}" stroke-width="15" stroke-linecap="round"/>
    </g>`;
  }
  if (concept === "ocean") {
    const fish = Array.from({ length: 6 }, (_, index) => {
      const x = 500 + Math.round(random() * 360);
      const y = 75 + Math.round(random() * 220);
      const size = 18 + Math.round(random() * 24);
      return `<g transform="translate(${x} ${y}) scale(${size / 30})"><ellipse cx="0" cy="0" rx="34" ry="19" fill="${index % 2 ? accent : bright}"/><path d="M-28 0l-33-25v50z" fill="${soft}"/><circle cx="19" cy="-5" r="4" fill="${ink}"/></g>`;
    }).join("");
    return `<g>${illustrationStars(random, soft, 18)}${fish}<path d="M0 285q120-75 240 0t240 0 240 0 240 0v255H0z" fill="${accent}" opacity=".45"/><path d="M0 335q120-75 240 0t240 0 240 0 240 0v205H0z" fill="${ink}" opacity=".68"/><circle cx="835" cy="65" r="18" fill="none" stroke="${bright}" stroke-width="4"/><circle cx="875" cy="110" r="9" fill="none" stroke="${bright}" stroke-width="3"/></g>`;
  }
  if (concept === "tabletop") {
    return `<g><path d="M0 65H960V540H0z" fill="${ink}" opacity=".42"/><path d="M410 358L540 85h330l90 273z" fill="${soft}" opacity=".32"/>
      <g transform="translate(575 83) rotate(-12)"><rect width="145" height="205" rx="18" fill="${bright}"/><path d="M73 40l30 58-30 58-30-58z" fill="${accent}"/></g>
      <g transform="translate(725 115) rotate(9)"><rect width="145" height="205" rx="18" fill="${accent}"/><circle cx="73" cy="96" r="43" fill="${bright}"/></g>
      <g fill="${bright}" opacity=".75">${[0,1,2,3,4].map((i)=>`<circle cx="${520+i*68}" cy="332" r="27"/>`).join("")}</g>
    </g>`;
  }
  if (concept === "rhythm") {
    const bars = Array.from({ length: 18 }, (_, index) => {
      const height = 35 + Math.round(random() * 245);
      return `<rect x="${465 + index * 25}" y="${320 - height}" width="14" height="${height}" rx="7" fill="${index % 4 === 0 ? bright : index % 3 === 0 ? accent : soft}" opacity="${(0.55 + random() * .4).toFixed(2)}"/>`;
    }).join("");
    return `<g>${stars}${bars}<path d="M500 165q45-70 90 0t90 0 90 0 90 0" fill="none" stroke="${bright}" stroke-width="9" opacity=".85"/>
      <g fill="${accent}"><path d="M565 72l48 44-48 44z"/><path d="M735 73l48 44-48 44z"/></g></g>`;
  }
  if (concept === "defense") {
    return `<g>${stars}<path d="M0 345q180-85 360 0t360 0 240 0v195H0z" fill="${ink}" opacity=".7"/>
      <path d="M525 337V170h55v-53h60v53h67v-53h60v53h58v167z" fill="${soft}"/><path d="M500 168h302l-18-38-42 23-51-37-51 37-50-37-48 37z" fill="${accent}"/>
      <rect x="654" y="254" width="52" height="83" rx="26" fill="${ink}"/><path d="M420 390q120-130 236-52t230-80" fill="none" stroke="${bright}" stroke-width="32" stroke-linecap="round" opacity=".65"/>
      <g fill="${accent}"><circle cx="445" cy="352" r="20"/><circle cx="848" cy="262" r="20"/></g>
    </g>`;
  }
  if (concept === "winter") {
    return `<g>${illustrationStars(random, bright, 42)}<circle cx="800" cy="92" r="55" fill="${bright}" opacity=".75"/>
      <path d="M0 365l190-205 135 135 142-235 186 253 120-143 187 195v175H0z" fill="${soft}" opacity=".72"/>
      <path d="M325 295L467 60l73 99-76-44-64 63zM190 160l53 54-58-25-52 30z" fill="${bright}"/>
      <path d="M560 195q80 65 180 130" fill="none" stroke="${accent}" stroke-width="13" stroke-linecap="round"/><g transform="translate(672 270) rotate(29)"><circle r="22" fill="${accent}"/><path d="M0 20v72M0 43l-39 39M0 43l40 39" stroke="${ink}" stroke-width="13" stroke-linecap="round"/></g>
    </g>`;
  }
  if (concept === "snake") {
    return `<g>${stars}<path d="M490 300C520 90 880 92 835 275S575 402 590 215 850 116 900 280" fill="none" stroke="${soft}" stroke-width="62" stroke-linecap="round"/>
      <path d="M490 300C520 90 880 92 835 275S575 402 590 215 850 116 900 280" fill="none" stroke="${accent}" stroke-width="38" stroke-linecap="round" stroke-dasharray="40 18"/>
      <circle cx="900" cy="280" r="46" fill="${accent}"/><circle cx="915" cy="267" r="7" fill="${ink}"/><path d="M940 292l38 12-38 12" fill="${bright}"/>
    </g>`;
  }
  if (concept === "fantasy") {
    return `<g>${stars}<path d="M0 360L190 194l130 108 180-227 190 247 120-145 150 183v180H0z" fill="${ink}" opacity=".58"/>
      <path d="M700 62l98 48v111q0 101-98 150-98-49-98-150V110z" fill="${accent}" stroke="${bright}" stroke-width="10"/>
      <path d="M700 110v190M630 183h140" stroke="${bright}" stroke-width="12"/>
      <g transform="translate(530 85) rotate(-25)"><path d="M0 0l34 0 0 265-17 48-17-48z" fill="${bright}"/><rect x="-35" y="245" width="104" height="20" rx="8" fill="${accent}"/></g>
    </g>`;
  }
  if (concept === "sports") {
    return `<g>${stars}<path d="M0 335q240-190 480 0t480 0v205H0z" fill="${soft}" opacity=".32"/><ellipse cx="710" cy="285" rx="245" ry="95" fill="${ink}" opacity=".62"/><ellipse cx="710" cy="285" rx="180" ry="58" fill="${accent}" opacity=".55"/>
      <circle cx="700" cy="198" r="92" fill="${bright}"/><path d="M610 198h180M700 106q-60 92 0 184M700 106q60 92 0 184" fill="none" stroke="${ink}" stroke-width="8"/>
    </g>`;
  }
  if (variant % 6 === 1) {
    return `<g>${stars}<path d="M0 355q170-95 340 0t340 0 280 0v185H0z" fill="${ink}" opacity=".62"/>
      <g transform="translate(585 45) rotate(-3)"><path d="M25 0h245l35 318H0z" fill="${soft}"/><rect x="49" y="38" width="197" height="144" rx="14" fill="${ink}"/><path d="M67 154l62-63 39 33 52-62" fill="none" stroke="${accent}" stroke-width="13"/><rect x="43" y="213" width="217" height="70" rx="14" fill="${ink}" opacity=".82"/><circle cx="100" cy="243" r="19" fill="${bright}"/><path d="M100 224v-38" stroke="${bright}" stroke-width="10"/><circle cx="194" cy="242" r="14" fill="${accent}"/><circle cx="226" cy="259" r="14" fill="${bright}"/></g>
    </g>`;
  }
  if (variant % 6 === 2) {
    return `<g>${stars}<g transform="translate(520 38) rotate(5)"><path d="M80 0h230l75 350H0z" fill="${soft}" opacity=".82"/><path d="M100 26h190l55 294H42z" fill="${ink}" opacity=".9"/>
      <circle cx="190" cy="105" r="44" fill="${accent}"/><circle cx="105" cy="195" r="30" fill="${bright}"/><circle cx="273" cy="217" r="34" fill="${soft}"/>
      <path d="M95 292l68-40M286 292l-66-40" stroke="${accent}" stroke-width="17" stroke-linecap="round"/><path d="M76 58l228 238" stroke="${bright}" stroke-width="5" opacity=".4"/></g></g>`;
  }
  if (variant % 6 === 3) {
    const rings = [0, 1, 2, 3, 4].map((index) => {
      const inset = index * 44;
      return `<path d="M${500 + inset} ${45 + inset * .42}h${390 - inset * 2}l${80 - inset * .2} ${275 - inset * .7}H${420 + inset * .55}z" fill="none" stroke="${index % 2 ? accent : soft}" stroke-width="${12 - index}" opacity="${.72 - index * .1}"/>`;
    }).join("");
    return `<g>${stars}${rings}<circle cx="700" cy="222" r="36" fill="${bright}"/><path d="M700 258v92" stroke="${accent}" stroke-width="17" stroke-linecap="round"/></g>`;
  }
  if (variant % 6 === 4) {
    return `<g>${stars}<ellipse cx="705" cy="232" rx="245" ry="154" fill="${ink}" opacity=".52"/><ellipse cx="705" cy="232" rx="182" ry="105" fill="none" stroke="${soft}" stroke-width="10" opacity=".62"/>
      <circle cx="705" cy="232" r="55" fill="${accent}"/><g fill="${bright}"><circle cx="548" cy="160" r="25"/><circle cx="846" cy="176" r="20"/><circle cx="816" cy="302" r="27"/></g>
      <path d="M548 160L680 220M846 176L730 222M816 302L728 247" stroke="${accent}" stroke-width="8" stroke-dasharray="16 13"/></g>`;
  }
  if (variant % 6 === 5) {
    const maze = Array.from({ length: 7 }, (_, row) => Array.from({ length: 8 }, (_, col) => {
      const x = 500 + col * 50;
      const y = 36 + row * 43;
      const hash = Number.parseInt(hashText(`${variant}:${row}:${col}`).slice(0, 2), 16);
      return `<path d="M${x} ${y}h${hash % 3 ? 42 : 20}M${x} ${y}v${hash % 2 ? 35 : 18}" stroke="${hash % 4 === 0 ? accent : soft}" stroke-width="7" stroke-linecap="round" opacity=".72"/>`;
    }).join("")).join("");
    return `<g>${stars}<rect x="476" y="18" width="438" height="338" rx="26" fill="${ink}" opacity=".48"/>${maze}<circle cx="520" cy="320" r="20" fill="${bright}"/><circle cx="875" cy="55" r="20" fill="${accent}"/></g>`;
  }
  return `<g>${stars}<path d="M0 345q160-110 320 0t320 0 320 0v195H0z" fill="${ink}" opacity=".62"/>
    <g transform="translate(550 110) rotate(${variant % 2 ? -5 : 5})"><rect x="0" y="0" width="320" height="205" rx="76" fill="${soft}"/><rect x="32" y="33" width="256" height="139" rx="49" fill="${ink}" opacity=".9"/>
      <path d="M90 78v55M62 106h56" stroke="${bright}" stroke-width="20" stroke-linecap="round"/><circle cx="223" cy="91" r="18" fill="${accent}"/><circle cx="258" cy="128" r="18" fill="${bright}"/>
      <path d="M76 191l-45 76M244 191l45 76" stroke="${soft}" stroke-width="33" stroke-linecap="round"/></g>
    <g fill="${accent}" opacity=".62"><circle cx="480" cy="92" r="24"/><rect x="850" y="58" width="47" height="47" rx="10" transform="rotate(18 874 82)"/></g>
  </g>`;
}

function cleanCoverText(value) {
  return String(value)
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/Ã©/g, "\u00e9")
    .replace(/Â³/g, "\u00b3")
    .replace(/Â/g, "");
}

function wrapIllustratedTitle(title, narrow = false) {
  const words = title.split(/\s+/).filter(Boolean);
  let fontSize = narrow ? (title.length < 24 ? 54 : title.length < 48 ? 42 : 32) : (title.length < 28 ? 58 : title.length < 58 ? 44 : 33);
  let maxChars = narrow ? 17 : 30;
  const maxTextWidth = narrow ? 355 : 840;
  const longestWord = Math.max(1, ...words.map((word) => word.length));
  fontSize = Math.max(20, Math.min(fontSize, Math.floor(maxTextWidth / (longestWord * 0.59))));
  let lines = [];
  const rebuildLines = () => {
    const nextLines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        nextLines.push(line);
        line = word;
      } else line = next;
    }
    if (line) nextLines.push(line);
    return nextLines;
  };
  lines = rebuildLines();
  while (lines.length > 4 && fontSize > 20) {
    fontSize -= 3;
    maxChars += 4;
    lines = rebuildLines();
  }
  while (lines.length > 4) {
    maxChars += 6;
    lines = rebuildLines();
  }
  return { lines, fontSize };
}

function illustratedFallbackSvg(entry) {
  const digest = hashText(`illustrated:${entry.slug}`);
  const random = seededRandom(`illustrated:${entry.slug}`);
  const concept = illustrationConcept(entry);
  const hue = Number.parseInt(digest.slice(0, 4), 16) % 360;
  const secondaryHue = (hue + 42 + (Number.parseInt(digest.slice(4, 6), 16) % 95)) % 360;
  const accentHue = (hue + 145 + (Number.parseInt(digest.slice(6, 8), 16) % 75)) % 360;
  const colors = {
    backgroundA: hsl(hue, 62, 11),
    backgroundB: hsl(secondaryHue, 66, 24),
    accent: hsl(accentHue, 84, 58),
    soft: hsl((accentHue + 34) % 360, 72, 70),
    bright: hsl((accentHue + 175) % 360, 82, 79),
    ink: hsl((hue + 210) % 360, 45, 8),
  };
  const variant = Number.parseInt(digest.slice(8, 10), 16) % 12;
  const layout = variant % 3;
  const narrow = layout === 1;
  const displayTitle = cleanCoverText(entry.title);
  const { lines, fontSize } = wrapIllustratedTitle(displayTitle, narrow);
  const lineHeight = Math.round(fontSize * 1.06);
  let textX = 52;
  let startY = layout === 1
    ? Math.max(188, 270 - (lines.length * lineHeight) / 2)
    : lines.length === 1 ? 440 : lines.length === 2 ? 420 : 397;
  let anchor = "start";
  let panel = `<path d="M0 335H960V540H0z" fill="#05070b" opacity=".88"/>`;
  if (layout === 1) panel = `<path d="M0 0h430l115 540H0z" fill="#05070b" opacity=".86"/>`;
  if (layout === 2) panel = `<path d="M0 315l960 45v180H0z" fill="#05070b" opacity=".88"/>`;
  const title = lines.map((line, index) => `<text x="${textX}" y="${Math.round(startY + index * lineHeight)}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="850" fill="#fff">${escapeHtml(line)}</text>`).join("");
  const labelX = 52;
  const labelAnchor = "start";
  const labelY = layout === 1 ? 105 : 367;
  const descriptor = entry.category.toLowerCase() === concept
    ? entry.category.toUpperCase()
    : `${entry.category.toUpperCase()} • ${concept.toUpperCase()}`;
  const code = digest.slice(0, 6).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="illustrated-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.backgroundA}"/><stop offset="1" stop-color="${colors.backgroundB}"/></linearGradient>
      <radialGradient id="illustrated-light" cx="72%" cy="36%" r="62%"><stop offset="0" stop-color="${colors.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${colors.accent}" stop-opacity="0"/></radialGradient>
      <linearGradient id="illustrated-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>
    </defs>
    <rect width="960" height="540" fill="url(#illustrated-bg)"/><rect width="960" height="540" fill="url(#illustrated-light)"/>
    ${illustrationScene(concept, random, colors, variant)}
    <rect width="960" height="540" fill="url(#illustrated-shine)" opacity=".5"/>
    ${panel}
    <g font-family="Arial, Helvetica, sans-serif">${title}
      <text x="${labelX}" y="${labelY}" text-anchor="${labelAnchor}" font-size="14" font-weight="800" letter-spacing="1.8" fill="${colors.bright}">${escapeHtml(descriptor)}</text>
      <text x="52" y="507" text-anchor="start" font-size="14" font-weight="800" letter-spacing="1.2" fill="#fff" opacity=".66">LEARNINGZONE</text>
      <text x="${layout === 1 ? 390 : 905}" y="507" text-anchor="end" font-size="12" font-weight="700" letter-spacing="1" fill="#fff" opacity=".35">${code}</text>
    </g>
  </svg>`;
}

async function generateFallbacks() {
  const { games, covers, state } = loadCore();
  let pending = pendingEntries(games, state);
  if (limit) pending = pending.slice(0, limit);
  let generated = 0;
  for (const { entry } of pending) {
    const outputPath = path.join(outputDir, `${entry.slug}-cover.webp`);
    const existedBefore = existsSync(outputPath);
    const oldCover = entry.currentCover;
    const oldLocal = publicPathToFile(oldCover);
    try {
      const rendered = await sharp(Buffer.from(fallbackSvg(entry)))
        .webp({ quality: 86, effort: 4, smartSubsample: true })
        .toBuffer();
      const quality = await analyzeImage(rendered);
      if (hasSevereFlags(quality) || quality.width !== 960 || quality.height !== 540) {
        throw new Error(`generated fallback failed validation: ${quality.flags.join(", ")}`);
      }
      await writeBufferWithRetry(outputPath, rendered);
      const publicPath = `/games/captured-covers/${entry.slug}-cover.webp`;
      covers[entry.slug] = publicPath;
      entry.currentCover = publicPath;
      entry.finalSelectedCover = publicPath;
      entry.sourceType = "local-generated-title";
      entry.status = "complete";
      entry.quality = quality;
      entry.qualityScore = quality.qualityScore;
      entry.changedDuringRun = true;
      entry.generatedFallback = true;
      entry.replacedCover = oldCover;
      if (oldLocal && oldLocal !== outputPath && oldLocal.startsWith(outputDir)) entry.replacedLocalFile = path.basename(oldLocal);
      entry.rejectionReason = "";
      state.run.generatedFallbacks += 1;
      if (["suspicious", "broken"].includes(state.games[entry.slug]?.status)) state.run.suspiciousReplaced += 1;
      generated += 1;
      addRunFile(state, existedBefore ? "changed" : "created", outputPath);
      saveGameCheckpoint(covers, state, entry);
    } catch (error) {
      entry.status = "broken";
      entry.rejectionReason = `fallback generation failed: ${error.message}`;
      saveState(state);
    }
    if (generated % 50 === 0 && generated) console.log(`Generated ${generated}/${pending.length}`);
  }
  saveProgress(covers, state);
  console.log(JSON.stringify({ attempted: pending.length, generated, remaining: pendingEntries(games, state).length }, null, 2));
}

async function generateIllustratedFallbacks() {
  const { covers, state } = loadCore();
  let pending = Object.values(state.games)
    .filter((entry) =>
      entry.sourceType === "local-generated-title" ||
      (force && selectedSlugs.has(entry.slug) && entry.sourceType === "local-generated-illustration") ||
      (args.has("upgrade-illustrations") && entry.sourceType === "local-generated-illustration" && entry.illustrationRendererVersion !== 2)
    )
    .filter((entry) => !selectedSlugs.size || selectedSlugs.has(entry.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (limit) pending = pending.slice(0, limit);
  let generated = 0;
  let failed = 0;
  const results = [];
  for (const entry of pending) {
    const outputPath = path.join(outputDir, `${entry.slug}-illustrated.webp`);
    const existedBefore = existsSync(outputPath);
    const oldCover = entry.currentCover;
    const oldLocal = publicPathToFile(oldCover);
    try {
      const concept = illustrationConcept(entry);
      const rendered = await sharp(Buffer.from(illustratedFallbackSvg(entry)))
        .webp({ quality: 88, effort: 4, smartSubsample: true })
        .toBuffer();
      const quality = await analyzeImage(rendered);
      if (hasSevereFlags(quality) || quality.width !== 960 || quality.height !== 540) {
        throw new Error(`illustrated fallback failed validation: ${quality.flags.join(", ")}`);
      }
      await writeBufferWithRetry(outputPath, rendered);
      const publicPath = `/games/captured-covers/${entry.slug}-illustrated.webp`;
      covers[entry.slug] = publicPath;
      entry.currentCover = publicPath;
      entry.finalSelectedCover = publicPath;
      entry.sourceType = "local-generated-illustration";
      entry.status = "complete";
      entry.quality = quality;
      entry.qualityScore = quality.qualityScore;
      entry.changedDuringRun = true;
      entry.generatedFallback = true;
      entry.fallbackKind = "game-specific-illustration";
      entry.coverSemantics = "illustration";
      entry.illustrationConcept = concept;
      entry.illustrationVariant = Number.parseInt(hashText(`illustrated:${entry.slug}`).slice(8, 10), 16) % 12;
      entry.illustrationRendererVersion = 2;
      entry.replacedCover = oldCover;
      if (oldLocal && oldLocal !== outputPath && oldLocal.startsWith(outputDir)) entry.replacedLocalFile = path.basename(oldLocal);
      entry.rejectionReason = "";
      generated += 1;
      addRunFile(state, existedBefore ? "changed" : "created", outputPath);
      saveGameCheckpoint(covers, state, entry);
      results.push({ slug: entry.slug, status: "generated", concept, score: quality.qualityScore });
    } catch (error) {
      failed += 1;
      entry.rejectionReason = `illustrated fallback generation failed: ${error.message}`;
      saveState(state);
      results.push({ slug: entry.slug, status: "failed", reason: error.message });
    }
    if ((generated + failed) % 25 === 0) console.log(`Illustrated ${generated}/${pending.length}; failed ${failed}`);
  }
  saveProgress(covers, state);
  const remaining = Object.values(state.games).filter((entry) => entry.sourceType === "local-generated-title").length;
  const upgradeRemaining = Object.values(state.games).filter(
    (entry) => entry.sourceType === "local-generated-illustration" && entry.illustrationRendererVersion !== 2
  ).length;
  const summary = { attempted: pending.length, generated, failed, remaining, upgradeRemaining };
  console.log(JSON.stringify(args.has("summary-only") ? summary : { ...summary, results }, null, 2));
}

async function normalizeNonCompliant() {
  const { games, covers, state } = loadCore();
  let pending = games
    .map((game) => state.games[game.slug])
    .filter((entry) => entry?.status === "complete" && !isRemoteCover(entry.currentCover))
    .filter((entry) => (entry.quality?.normalization || []).length > 0);
  if (limit) pending = pending.slice(0, limit);
  let normalized = 0;
  for (const entry of pending) {
    const oldPath = publicPathToFile(entry.currentCover);
    if (!oldPath || !existsSync(oldPath)) continue;
    const outputPath = path.join(outputDir, `${entry.slug}-cover.webp`);
    const existedBefore = existsSync(outputPath);
    try {
      const sourceBuffer = readFileSync(oldPath);
      const quality = await normalizeToCover(sourceBuffer, outputPath);
      const publicPath = `/games/captured-covers/${entry.slug}-cover.webp`;
      covers[entry.slug] = publicPath;
      entry.currentCover = publicPath;
      entry.finalSelectedCover = publicPath;
      entry.quality = quality;
      entry.qualityScore = quality.qualityScore;
      entry.changedDuringRun = true;
      if (entry.sourceType === "local-existing") entry.normalizedExisting = true;
      if (oldPath !== outputPath && oldPath.startsWith(outputDir)) entry.replacedLocalFile = path.basename(oldPath);
      state.run.normalizedCovers += 1;
      normalized += 1;
      addRunFile(state, existedBefore ? "changed" : "created", outputPath);
      saveGameCheckpoint(covers, state, entry);
    } catch (error) {
      entry.status = "suspicious";
      entry.rejectionReason = `normalization failed: ${error.message}`;
      saveState(state);
    }
  }
  saveProgress(covers, state);
  console.log(JSON.stringify({ attempted: pending.length, normalized }, null, 2));
}

function generateQaGallery(state) {
  const entries = Object.values(state.games);
  const groups = [
    ["Flagged or unresolved", entries.filter((entry) => ["suspicious", "broken", "unresolved"].includes(entry.status))],
    ["Generated game-specific illustrations", entries.filter((entry) => entry.sourceType === "local-generated-illustration")],
    ["Remaining plain title fallbacks", entries.filter((entry) => entry.sourceType === "local-generated-title")],
    ["Changed during this migration", entries.filter((entry) => entry.changedDuringRun)],
    ["Low confidence", entries.filter((entry) => Number(entry.qualityScore) < 70 && entry.qualityScore !== null)],
  ];
  const card = (entry) => {
    const source = isRemoteCover(entry.currentCover)
      ? entry.currentCover
      : `./${encodeURIComponent(path.basename(String(entry.currentCover || "")))}`;
    return `<article class="card">
      <img src="${escapeHtml(source)}" alt="${escapeHtml(entry.title)} cover" loading="lazy" decoding="async">
      <div class="body"><h3>${escapeHtml(entry.title)}</h3><code>${escapeHtml(entry.slug)}</code>
      <p><strong>${escapeHtml(entry.sourceType)}</strong> / ${escapeHtml(entry.status)} / score ${escapeHtml(entry.qualityScore ?? "n/a")}</p>
      <p>${escapeHtml((entry.quality?.flags || []).join(", ") || entry.rejectionReason || "No flags")}</p></div>
    </article>`;
  };
  const html = `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LearningZone Cover QA</title><style>
  :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0d1017;color:#f5f7fb}body{margin:0;padding:28px}h1{margin:0 0 8px}h2{margin:38px 0 16px}.summary{color:#aeb7c7}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}.card{overflow:hidden;border:1px solid #2c3442;border-radius:8px;background:#151a24}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#050608}.body{padding:13px}.body h3{font-size:16px;margin:0 0 5px}.body p{font-size:12px;color:#b9c2d2;margin:7px 0;line-height:1.4}.body code{font-size:11px;color:#7ed4ff}@media(max-width:600px){body{padding:16px}.grid{grid-template-columns:1fr}}
  </style></head><body><h1>LearningZone Cover QA</h1><p class="summary">Generated ${escapeHtml(new Date().toISOString())}. This file is local QA output and is not a deployment.</p>
  ${groups.map(([title, items]) => `<section><h2>${escapeHtml(title)} (${items.length})</h2><div class="grid">${items.map(card).join("") || "<p>None.</p>"}</div></section>`).join("")}
  </body></html>`;
  writeTextAtomic(qaPath, html);
}

async function validate() {
  const { games, covers, rejected, state } = loadCore();
  const failures = [];
  const localEntries = [];
  let remote = 0;
  let oldGeneric = 0;
  let missing = 0;
  for (const game of games) {
    const entry = state.games[game.slug];
    const cover = covers[game.slug];
    if (!cover) {
      missing += 1;
      failures.push({ slug: game.slug, reason: "missing assignment" });
      continue;
    }
    if (isOldGeneric(cover)) {
      oldGeneric += 1;
      failures.push({ slug: game.slug, reason: "old generic fallback remains" });
      continue;
    }
    if (isRemoteCover(cover)) {
      remote += 1;
      try {
        new URL(cover);
      } catch {
        failures.push({ slug: game.slug, reason: "invalid remote URL" });
      }
      continue;
    }
    const filePath = publicPathToFile(cover);
    if (!filePath || !existsSync(filePath)) {
      failures.push({ slug: game.slug, reason: "broken local path" });
      continue;
    }
    localEntries.push({ game, entry, filePath });
  }

  let analyzedCount = 0;
  const analyzed = await mapConcurrent(localEntries, concurrency, async ({ game, entry, filePath }) => {
    try {
      const quality = await analyzeImage(filePath);
      analyzedCount += 1;
      if (analyzedCount % 200 === 0) console.log(`Validated ${analyzedCount}/${localEntries.length}`);
      return { game, entry, filePath, quality };
    } catch (error) {
      return { game, entry, filePath, quality: null, error: error.message };
    }
  });

  for (const item of analyzed) {
    if (item.error) {
      failures.push({ slug: item.game.slug, reason: `decode failed: ${item.error}` });
      continue;
    }
    const quality = item.quality;
    item.entry.quality = quality;
    item.entry.qualityScore = quality.qualityScore;
    item.entry.dimensions = { width: quality.width, height: quality.height };
    if (hasSevereFlags(quality)) failures.push({ slug: item.game.slug, reason: `quality: ${quality.flags.join(", ")}` });
    if (quality.width < 640 || quality.height < 360) failures.push({ slug: item.game.slug, reason: "dimensions below 640x360" });
    if (Math.abs(quality.aspectRatio - 16 / 9) > 0.055) failures.push({ slug: item.game.slug, reason: "aspect ratio is not 16:9" });
  }

  const exactGroups = new Map();
  for (const item of analyzed) {
    if (!item.quality?.sha256) continue;
    if (!exactGroups.has(item.quality.sha256)) exactGroups.set(item.quality.sha256, []);
    exactGroups.get(item.quality.sha256).push(item);
  }
  const unrelatedDuplicates = [];
  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    const unrelated = group.some((item, index) =>
      group.slice(index + 1).some((other) => !titlesAreRelated(item.entry.title, other.entry.title))
    );
    if (unrelated) unrelatedDuplicates.push(group.map((item) => item.game.slug));
  }
  if (unrelatedDuplicates.length) {
    for (const group of unrelatedDuplicates) failures.push({ slugs: group, reason: "unrelated exact duplicate covers" });
  }

  refreshSummary(state);
  const titleFallbacks = Object.values(state.games).filter(
    (entry) => entry.sourceType === "local-generated-title"
  );
  if (titleFallbacks.length) {
    failures.push({
      count: titleFallbacks.length,
      reason: "generated title cards remain and are not game imagery",
    });
  }
  generateQaGallery(state);
  addRunFile(state, "created", path.join(scriptDir, "complete-cover-library.mjs"));
  addRunFile(state, "created", path.join(scriptDir, "smoke-cover-library.mjs"));
  addRunFile(state, "created", stateJournalPath);
  addRunFile(state, "changed", path.join(root, "chat-site-sync.js"));
  addRunFile(state, "created", qaPath);
  addRunFile(state, "created", finalReportPath);
  addRunFile(state, "changed", coversPath);
  addRunFile(state, "changed", statePath);
  const blankRejected = Object.values(rejected).filter((entry) => entry.status === "blank").length;
  const report = {
    at: new Date().toISOString(),
    passed: failures.length === 0,
    totalCatalogEntries: games.length,
    manifestEntries: Object.keys(covers).length,
    existingRemoteCoversKept: remote,
    existingLocalCoversKept: Object.values(state.games).filter(
      (entry) => entry.sourceType === "local-existing"
    ).length,
    suspiciousExistingCoversReplaced: state.audit?.suspicious || 0,
    localGameOwnedAssetsExtracted: state.run.extractedAssets,
    gameplayOrMenuScreenshotsGeneratedThisRun: state.run.generatedScreenshots,
    gameSpecificIllustrationsGeneratedThisRun: state.run.generatedIllustrations,
    uniqueTitleBasedFallbacksGenerated: state.run.generatedFallbacks,
    normalizedExistingCovers: state.run.normalizedCovers,
    totalNonGenericCovers: games.length - oldGeneric - missing - titleFallbacks.length,
    totalGameSpecificCovers: games.length - oldGeneric - missing - titleFallbacks.length,
    remainingGeneratedTitleFallbacks: titleFallbacks.length,
    remainingOldGenericFallbacks: oldGeneric,
    missingAssignments: missing,
    brokenOrInvalidAssignments: failures.filter((failure) => /missing|broken|invalid|decode/.test(failure.reason)).length,
    blankCapturesRejected: blankRejected,
    duplicateGroupsDetectedDuringAudit:
      (state.audit?.exactDuplicateGroups?.length || 0) + (state.audit?.nearDuplicateGroups?.length || 0),
    unresolvedDuplicateGroups: unrelatedDuplicates,
    unresolvedFailures: failures,
    stateSummary: state.summary,
    filesCreated: state.run.filesCreated,
    filesChanged: state.run.filesChanged,
    filesRemoved: state.run.filesRemoved,
    startedAt: state.startedAt,
    elapsedSeconds: Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000),
  };
  writeJsonAtomic(finalReportPath, report);
  saveState(state);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

function cleanup() {
  const { covers, state } = loadCore();
  const referenced = new Set(
    Object.values(covers)
      .filter((cover) => String(cover).includes("/captured-covers/"))
      .map((cover) => path.basename(publicPathToFile(cover) || ""))
  );
  const removable = new Set(["_preview-akinator-1.png", "_preview-akinator-2.png"]);
  for (const entry of Object.values(state.games)) {
    if (entry.replacedLocalFile && !referenced.has(entry.replacedLocalFile)) removable.add(entry.replacedLocalFile);
  }
  for (const name of readFileNames(outputDir)) {
    if (/\.(?:jpe?g|png|webp|gif)$/i.test(name) && !referenced.has(name)) removable.add(name);
  }
  let removed = 0;
  for (const name of removable) {
    if (!name || referenced.has(name)) continue;
    const filePath = path.join(outputDir, name);
    if (!existsSync(filePath)) continue;
    rmSync(filePath, { force: true });
    addRunFile(state, "removed", filePath);
    removed += 1;
  }
  for (const name of readFileNames(outputDir).filter((value) => /\.tmp(?:\.webp)?$/.test(value))) {
    const filePath = path.join(outputDir, name);
    rmSync(filePath, { force: true });
    addRunFile(state, "removed", filePath);
    removed += 1;
  }
  saveState(state);
  console.log(JSON.stringify({ removed }, null, 2));
}

const commands = {
  inventory,
  audit,
  extract: extractLocalAssets,
  capture: captureBatch,
  fallback: generateFallbacks,
  illustrate: generateIllustratedFallbacks,
  normalize: normalizeNonCompliant,
  validate,
  cleanup,
  reconcile: () => {
    const { covers, state } = loadCore();
    saveProgress(covers, state);
    console.log(JSON.stringify({ reconciled: Object.keys(state.games).length, summary: state.summary }, null, 2));
  },
  qa: () => {
    const { state } = loadCore();
    generateQaGallery(state);
    console.log(qaPath);
  },
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.error(`Available commands: ${Object.keys(commands).join(", ")}`);
  process.exit(2);
}

await commands[command]();
