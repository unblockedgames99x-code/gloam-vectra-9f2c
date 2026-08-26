import assert from "node:assert/strict";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const runtimeModules = path.join(
  os.homedir(),
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
);

function loadDependency(name) {
  try { return require(name); } catch (_error) { return require(path.join(runtimeModules, name)); }
}

const { chromium } = loadDependency("playwright");
const baseUrl = process.env.NEO_URL || "http://127.0.0.1:4195/neo-os/";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const searches = [
  "shrek",
  "call of duty",
  "cal of duty",
  "minecraft",
  "minecaft",
  "one piece",
  "hello kitty",
  "fortnite",
  "sonic",
  "mario",
  "dragon ball",
  "pokemon",
  "naruto",
  "cyberpunk",
  "cars",
  "space",
  "rainy day",
  "abstract",
  "ocean",
  "snow",
  "zzzxxyyunlikely",
];

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

try {
  await page.goto(`${baseUrl}?wallpaper-search-ui=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForFunction(() => window.NEO_SHELL && window.NEOWallpaperEngine, null, { timeout: 20_000 });
  const guestButton = page.locator("[data-neo-login-guest]");
  if (await guestButton.isVisible().catch(() => false)) await guestButton.click();

  await page.locator('.dock-button[data-app="wallpaper"]').click();
  const studio = page.locator('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
  await studio.waitFor({ state: "visible", timeout: 20_000 });
  await studio.locator('[data-we-source="discover"]').click();
  await page.waitForFunction(() => {
    const node = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
    return node?.dataset.onlineState === "ready";
  }, null, { timeout: 30_000 });

  assert.equal(await studio.getAttribute("data-online-catalog-mode"), "browser-ready", "Discover did not open the full-file catalog");
  assert.equal(await studio.locator("[data-wallpaper-sort]").inputValue(), "popular", "For You is not ordered by most subscribed");
  assert.equal((await studio.locator("[data-we-online-title]").textContent()).trim(), "Discover");
  const readyOnly = studio.locator("[data-we-filter-ready]");
  assert.equal(await readyOnly.isChecked(), true, "Discover did not lock to complete downloadable files");
  assert.equal(await readyOnly.isDisabled(), true, "Discover can still be switched back to unusable preview-only projects");
  const initialDiscoverCards = studio.locator('[data-wallpaper-online="true"]:not([hidden])');
  assert(await initialDiscoverCards.count() > 0, "Discover opened without usable wallpapers");
  assert.equal(
    await studio.locator('[data-wallpaper-online="true"][data-wallpaper-original-available="true"]:not([hidden])').count(),
    await initialDiscoverCards.count(),
    "Discover mixed native-only projects into its one-click library",
  );

  let previousForYouRequest = await studio.getAttribute("data-online-request-id");
  await studio.locator('[data-we-source="workshop"]').click();
  await page.waitForFunction(
    (oldRequest) => {
      const node = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
      return node?.dataset.onlineRequestId !== oldRequest
        && node?.dataset.onlineState === "ready"
        && node?.dataset.wallpaperSource === "workshop";
    },
    previousForYouRequest,
    { timeout: 30_000 },
  );
  const nativeProject = studio.locator('[data-wallpaper-online="true"][data-wallpaper-original-available="false"]:not([hidden])').first();
  await nativeProject.waitFor({ state: "visible", timeout: 15_000 });
  const nativeAction = nativeProject.locator("[data-wallpaper-install]");
  assert.equal((await nativeAction.textContent()).trim(), "Get in Wallpaper Engine", "Native project card still exposes a dead file action");
  assert.equal(await nativeAction.isEnabled(), true, "Native project action is disabled");
  assert.equal(await nativeProject.locator(".wallpaper-online-link").count(), 0, "Native project repeats its details action");
  await nativeProject.locator("[data-wallpaper-option]").click();
  const inspectorAction = studio.locator("[data-wallpaper-apply]");
  assert.match((await inspectorAction.textContent()).trim(), /Get in Wallpaper Engine/, "Inspector still presents a dead native-file action");
  assert.equal(await inspectorAction.isEnabled(), true, "Inspector project action is disabled");
  assert.equal((await studio.locator("[data-inspector-state]").textContent()).trim(), "Wallpaper Engine project");

  previousForYouRequest = await studio.getAttribute("data-online-request-id");
  await studio.locator('[data-we-source="discover"]').click();
  await page.waitForFunction(
    (oldRequest) => {
      const node = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
      return node?.dataset.onlineRequestId !== oldRequest
        && node?.dataset.onlineState === "ready"
        && node?.dataset.onlineCatalogMode === "browser-ready";
    },
    previousForYouRequest,
    { timeout: 30_000 },
  );
  const search = studio.locator("input[data-wallpaper-search]");
  const results = [];

  for (const query of searches) {
    const previousRequest = await studio.getAttribute("data-online-request-id");
    await search.fill(query);
    await page.waitForFunction(
      ({ oldRequest, value }) => {
        const node = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
        const input = node?.querySelector("input[data-wallpaper-search]");
        return input?.value === value
          && node?.dataset.onlineRequestId !== oldRequest
          && node?.dataset.onlineState === "ready";
      },
      { oldRequest: previousRequest, value: query },
      { timeout: 30_000 },
    );

    const visibleCards = studio.locator('[data-wallpaper-online="true"]:not([hidden])');
    const count = await visibleCards.count();
    assert(count > 0, `${query}: the server returned but the UI showed no wallpaper cards`);
    assert.equal(
      await studio.locator('[data-wallpaper-online="true"][data-wallpaper-original-available="true"]:not([hidden])').count(),
      count,
      `${query}: Discover returned an item that cannot be downloaded and used`,
    );
    await page.waitForFunction(() => Array.from(document.querySelectorAll(
      '.neo-window[data-app-id="wallpaper"] [data-wallpaper-online="true"]:not([hidden]) .wallpaper-card-preview img',
    )).some((image) => image.complete && image.naturalWidth > 0), null, { timeout: 15_000 });
    const loadedImages = await visibleCards.locator(".wallpaper-card-preview img").evaluateAll((images) => (
      images.filter((image) => image.complete && image.naturalWidth > 0).length
    ));
    assert(loadedImages > 0, `${query}: no visible result thumbnail loaded`);

    results.push({
      query,
      count,
      fallback: await studio.getAttribute("data-online-fallback") === "true",
      recovered: await studio.getAttribute("data-online-recovered") === "true",
    });
  }

  const downloadableQuery = "zzzxxyyunlikely";
  let previousRequest = await studio.getAttribute("data-online-request-id");
  await search.fill(downloadableQuery);
  await page.waitForFunction(
    ({ oldRequest, value }) => {
      const node = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
      return node?.querySelector("input[data-wallpaper-search]")?.value === value
        && node?.dataset.onlineRequestId !== oldRequest
        && node?.dataset.onlineState === "ready";
    },
    { oldRequest: previousRequest, value: downloadableQuery },
    { timeout: 30_000 },
  );
  const downloadableCards = studio.locator('[data-wallpaper-online="true"]:not([hidden])');
  assert(await downloadableCards.count() > 0, "Full-download search showed an empty grid");
  assert.equal(
    await studio.locator('[data-wallpaper-online="true"][data-wallpaper-original-available="true"]:not([hidden])').count(),
    await downloadableCards.count(),
    "Full-download search included a result without a complete usable file",
  );
  const actionLabels = await downloadableCards.locator("[data-wallpaper-install]").allTextContents();
  assert(actionLabels.every((label) => /^(Download|Use|Active)$/.test(label.trim())), "Full-download search exposed a dead action");
  assert.equal(await studio.getAttribute("data-online-fallback"), "true");
  assert.match(
    await studio.locator("[data-we-source-copy]").textContent(),
    /downloadable 1080p\+ alternatives/i,
  );

  const mediaQuery = "solar wind animations";
  previousRequest = await studio.getAttribute("data-online-request-id");
  await search.fill(mediaQuery);
  await page.waitForFunction(
    ({ oldRequest, value }) => {
      const node = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-studio]');
      return node?.querySelector("input[data-wallpaper-search]")?.value === value
        && node?.dataset.onlineRequestId !== oldRequest
        && node?.dataset.onlineState === "ready"
        && node?.dataset.onlineCatalogMode === "browser-ready";
    },
    { oldRequest: previousRequest, value: mediaQuery },
    { timeout: 30_000 },
  );
  const downloadButton = studio.locator('[data-wallpaper-online="true"]:not([hidden]) [data-wallpaper-install-state="ready"]').first();
  await downloadButton.waitFor({ state: "visible", timeout: 15_000 });
  const downloadedCard = downloadButton.locator("xpath=ancestor::article");
  const downloadedId = await downloadedCard.getAttribute("data-wallpaper-card");
  assert(downloadedId, "Downloadable result did not expose a stable ID");
  await downloadButton.click();
  await page.waitForFunction(
    (id) => {
      const record = window.NEOWallpaperEngine?.getRecord(id);
      return record?.fullMedia === true && record?.blob instanceof Blob && record.blob.size > 0;
    },
    downloadedId,
    { timeout: 120_000 },
  );
  await page.waitForFunction(
    (id) => {
      const video = document.querySelector("#wallpaper-media video");
      return window.NEOWallpaperEngine?.getState().id === id
        && video?.readyState >= 2
        && video.videoWidth >= 1920
        && video.videoHeight >= 1080
        && !video.paused;
    },
    downloadedId,
    { timeout: 30_000 },
  );
  const playbackStart = await page.locator("#wallpaper-media video").evaluate((video) => video.currentTime);
  await page.waitForTimeout(700);
  const playbackEnd = await page.locator("#wallpaper-media video").evaluate((video) => video.currentTime);
  assert(playbackEnd - playbackStart > 0.25, "Downloaded full-resolution wallpaper did not animate in Chrome");

  assert.equal(await readyOnly.isChecked(), true, "Discover stopped enforcing complete downloads");
  assert.equal(await readyOnly.isDisabled(), true, "Discover's usability guard can be turned off");
  assert.equal(pageErrors.length, 0, `Wallpaper UI emitted errors: ${pageErrors.slice(0, 4).join(" | ")}`);
  console.log(`Wallpaper search UI passed in Chrome: ${results.length} queries, ${results.filter((item) => item.recovered).length} typo recoveries, ${results.filter((item) => item.fallback).length} labeled alternatives.`);
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}
