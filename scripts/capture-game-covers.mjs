import http from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const gamesPath = path.join(root, "games", "index.json");
const coversPath = path.join(root, "games", "covers.json");
const outputDir = path.join(root, "games", "captured-covers");
const rejectedPath = path.join(outputDir, "_rejected.json");

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

const port = Number(args.get("port") || 4199);
const workers = Math.max(1, Math.min(16, Number(args.get("workers") || 8)));
const timeoutMs = Math.max(1500, Number(args.get("timeout") || 6500));
const hardTimeoutMs = Math.max(timeoutMs + 1000, Number(args.get("hard-timeout") || 8000));
const settleMs = Math.max(400, Number(args.get("settle") || 2200));
const minBytes = Math.max(0, Number(args.get("min-bytes") || 3600));
const limit = args.has("limit") ? Math.max(0, Number(args.get("limit") || 0)) : 0;
const offset = Math.max(0, Number(args.get("offset") || 0));
const captureAll = args.has("all");
const force = args.has("force");
const retryRejected = args.has("retry-rejected");
const directEmbeds = args.has("direct-embeds");
const maxMinutes = Math.max(0, Number(args.get("max-minutes") || 0));
const sourcePattern = args.get("source-pattern") || "";
const selectedSlugs = new Set(
  String(args.get("slugs") || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
);

const mimeTypes = new Map([
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

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(root, normalized);
}

function sendFile(res, filePath, cache = "no-cache") {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes.get(ext) || "application/octet-stream",
    "Cache-Control": cache,
  });
  createReadStream(filePath).pipe(res);
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
      let filePath = safePath(requestUrl.pathname);

      if (!filePath.startsWith(root)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        sendFile(res, filePath, "no-cache");
        return;
      }

      const hasExtension = path.extname(requestUrl.pathname) !== "";
      if (hasExtension) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const appShell = await readFile(path.join(root, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(appShell);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Preview server error: ${error.message}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function isGenericCover(value) {
  return !value || String(value).includes("/generated-covers/");
}

function outputPathFor(slug) {
  return path.join(outputDir, `${slug}.jpg`);
}

function manifestPathFor(slug) {
  return `/games/captured-covers/${slug}.jpg`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBrowserCrash(errorText = "") {
  return /Target crashed|browser has been closed|context or browser has been closed|Target page/i.test(String(errorText));
}

function titleCaseStatus(status) {
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

function saveCoverManifest(covers) {
  const sorted = {};
  for (const key of Object.keys(covers).sort((a, b) => a.localeCompare(b))) sorted[key] = covers[key];
  writeFileSync(coversPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function saveRejectedManifest(rejected) {
  const sorted = {};
  for (const key of Object.keys(rejected).sort((a, b) => a.localeCompare(b))) sorted[key] = rejected[key];
  writeFileSync(rejectedPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function captureOne(browser, game, baseUrl) {
  const fileName = path.basename(game.file || `${game.slug}.html`);
  const out = outputPathFor(game.slug);
  const publicPath = manifestPathFor(game.slug);
  if (!force && existsSync(out)) return { status: "cached", slug: game.slug, cover: publicPath };

  let context;
  let page;

  try {
    context = await browser.newContext({
      viewport: { width: 640, height: 360 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
  } catch (error) {
    return { status: "failed", slug: game.slug, error: error?.message || String(error) };
  }

  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (/(doubleclick|googlesyndication|google-analytics|googletagmanager|adservice|taboola|outbrain|facebook\.net|twitter\.com\/widgets)/i.test(url)) {
      route.abort().catch(() => {});
      return;
    }
    route.continue().catch(() => {});
  }).catch(() => {});

  context.on("page", (openedPage) => {
    if (openedPage !== page) openedPage.close().catch(() => {});
  });

  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  try {
    const targetUrl = game.captureUrl || `${baseUrl}/games/${encodeURIComponent(fileName)}`;
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    }).catch(() => {});
    await sleep(settleMs);

    // Nudge common launch screens so thumbnails show a game frame instead of only a play overlay.
    await page.mouse.click(320, 180).catch(() => {});
    await sleep(360);
    await page.keyboard.press("Enter").catch(() => {});
    await sleep(360);
    await page.keyboard.press("Space").catch(() => {});
    await sleep(Math.min(1600, Math.max(300, Math.floor(settleMs / 2))));

    const buffer = await page.screenshot({
      type: "jpeg",
      quality: 76,
      fullPage: false,
      timeout: timeoutMs,
    });

    if (buffer.length < minBytes) {
      return { status: "blank", slug: game.slug, error: `screenshot too small (${buffer.length} bytes)` };
    }

    writeFileSync(out, buffer);

    return { status: "captured", slug: game.slug, cover: publicPath };
  } catch (error) {
    return { status: "failed", slug: game.slug, error: error?.message || String(error) };
  } finally {
    await Promise.race([
      context?.close().catch(() => {}),
      sleep(Math.max(1200, timeoutMs)),
    ]);
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });

  const games = JSON.parse(await readFile(gamesPath, "utf8"));
  const covers = existsSync(coversPath) ? JSON.parse(await readFile(coversPath, "utf8")) : {};
  const rejectedGames = existsSync(rejectedPath)
    ? JSON.parse(await readFile(rejectedPath, "utf8"))
    : {};
  const uniqueGames = [];
  const seen = new Set();
  for (const game of games) {
    if (!game?.slug || !game?.file || seen.has(game.slug)) continue;
    seen.add(game.slug);
    if (selectedSlugs.size && !selectedSlugs.has(game.slug)) continue;
    if (!captureAll && !isGenericCover(covers[game.slug])) continue;
    if (!retryRejected && rejectedGames[game.slug]) continue;
    if (sourcePattern) {
      const source = await readFile(path.join(root, "games", path.basename(game.file)), "utf8").catch(() => "");
      if (!new RegExp(sourcePattern, "i").test(source)) continue;
    }
    if (directEmbeds) {
      const source = await readFile(path.join(root, "games", path.basename(game.file)), "utf8").catch(() => "");
      const iframeMatch = source.match(/<iframe[\s\S]*?\bsrc\s*=\s*["']([^"']+)["']/i);
      if (!iframeMatch || !/^https?:\/\//i.test(iframeMatch[1])) continue;
      game.captureUrl = iframeMatch[1].replace(/&amp;/g, "&");
    }
    uniqueGames.push(game);
  }

  const queue = uniqueGames.slice(offset, limit ? offset + limit : undefined);
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  async function launchBrowser() {
    return chromium.launch({
      headless: !args.has("headed"),
      args: ["--mute-audio", "--disable-background-timer-throttling"],
    });
  }

  let completed = 0;
  const results = { captured: 0, cached: 0, failed: 0 };
  const rejected = [];
  const startedAt = Date.now();
  const stopAt = maxMinutes ? startedAt + maxMinutes * 60_000 : Number.POSITIVE_INFINITY;
  let stoppedForTime = false;
  let browser = await launchBrowser();
  let restartPromise = null;

  async function getBrowser() {
    if (browser?.isConnected?.()) return browser;
    if (!restartPromise) {
      restartPromise = launchBrowser()
        .then((nextBrowser) => {
          browser = nextBrowser;
          return browser;
        })
        .finally(() => {
          restartPromise = null;
        });
    }
    return restartPromise;
  }

  async function restartBrowser(failedBrowser) {
    if (browser !== failedBrowser && browser?.isConnected?.()) return browser;
    if (!restartPromise) {
      restartPromise = (async () => {
        if (browser === failedBrowser || !browser?.isConnected?.()) {
          await Promise.race([
            browser?.close?.().catch(() => {}),
            sleep(3000),
          ]);
          browser = await launchBrowser();
        }
        return browser;
      })().finally(() => {
        restartPromise = null;
      });
    }
    return restartPromise;
  }

  console.log(`Capturing ${queue.length} game covers from ${baseUrl} with ${workers} workers...`);

  async function captureWithHardTimeout(activeBrowser, game) {
    let timeoutId;
    const timeoutResult = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({
        status: "failed",
        slug: game.slug,
        error: `hard timeout after ${hardTimeoutMs}ms`,
      }), hardTimeoutMs);
    });
    const result = await Promise.race([
      captureOne(activeBrowser, game, baseUrl),
      timeoutResult,
    ]);
    clearTimeout(timeoutId);
    return result;
  }

  async function worker(workerId) {
    while (queue.length) {
      if (Date.now() >= stopAt) {
        stoppedForTime = true;
        return;
      }
      const game = queue.shift();
      let activeBrowser = await getBrowser();
      let result = await captureWithHardTimeout(activeBrowser, game);
      const hardTimedOut = result.status === "failed" && /hard timeout/i.test(result.error || "");
      if (result.status === "failed" && (hardTimedOut || isBrowserCrash(result.error))) {
        activeBrowser = await restartBrowser(activeBrowser);
        if (!hardTimedOut) result = await captureWithHardTimeout(activeBrowser, game);
      }
      completed += 1;
      results[result.status] = (results[result.status] || 0) + 1;
      if (result.cover) {
        covers[game.slug] = result.cover;
        delete rejectedGames[game.slug];
      }
      if (result.status === "failed" || result.status === "blank") {
        rejected.push(result);
        const previous = rejectedGames[game.slug] || {};
        rejectedGames[game.slug] = {
          status: result.status,
          error: result.error || "Unknown capture failure",
          attempts: Number(previous.attempts || 0) + 1,
          updatedAt: new Date().toISOString(),
        };
      }

      if (completed % 25 === 0 || result.status === "failed") {
        console.log(
          `[${completed}/${completed + queue.length}] ${titleCaseStatus(result.status)} ${game.slug}${result.error ? ` - ${result.error}` : ""}`
        );
      }
      if (completed % 25 === 0) {
        saveCoverManifest(covers);
        saveRejectedManifest(rejectedGames);
      }
    }
  }

  let fatalError = null;
  try {
    await Promise.all(Array.from({ length: workers }, (_, index) => worker(index + 1)));
  } catch (error) {
    fatalError = error;
    results.failed = (results.failed || 0) + queue.length;
    rejected.push({ status: "failed", slug: "__fatal__", error: error?.message || String(error) });
  } finally {
    saveCoverManifest(covers);
    saveRejectedManifest(rejectedGames);
    await Promise.race([
      browser?.close?.().catch(() => {}),
      sleep(5000),
    ]);
    server.closeAllConnections?.();
    await Promise.race([
      new Promise((resolve) => server.close(resolve)),
      sleep(2000),
    ]);
  }

  const reportPath = path.join(outputDir, "_capture-report.json");
  writeFileSync(
    reportPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
      stoppedForTime,
      remainingInQueue: queue.length,
      results,
      rejected,
    }, null, 2)}\n`,
    "utf8"
  );

  console.log(JSON.stringify({ processed: completed, stoppedForTime, remainingInQueue: queue.length, ...results, reportPath }, null, 2));
  if (fatalError) throw fatalError;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
