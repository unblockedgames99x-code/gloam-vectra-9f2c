import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const runtimeModules = path.join(
  os.homedir(),
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
);

function loadDependency(name) {
  try { return require(name); } catch (error) { return require(path.join(runtimeModules, name)); }
}

const { chromium } = loadDependency("playwright");
const { PNG } = loadDependency("pngjs");
const pixelmatch = loadDependency("pixelmatch").default || loadDependency("pixelmatch");
const baseUrl = process.env.NEO_URL || "http://127.0.0.1:4195/neo-os/";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const manifest = JSON.parse(await readFile(new URL("../neo-os/wallpaper-full-media.json", import.meta.url), "utf8"));

function changedPixelRatio(before, after) {
  const first = PNG.sync.read(before);
  const second = PNG.sync.read(after);
  assert.equal(first.width, second.width);
  assert.equal(first.height, second.height);
  const changed = pixelmatch(first.data, second.data, null, first.width, first.height, { threshold: 0.02 });
  return changed / (first.width * first.height);
}

async function waitForShell(page) {
  await page.waitForFunction(() => window.NEOWallpaperEngine && window.NEO_SHELL, null, { timeout: 20_000 });
  const guest = page.locator("[data-neo-login-guest]");
  if (await guest.isVisible()) await guest.click();
}

async function applyWallpaper(page, id) {
  await page.evaluate(async (wallpaperId) => {
    await window.NEOWallpaperEngine.apply(wallpaperId, {
      wallpaperFit: "cover",
      wallpaperMuted: true,
      wallpaperVolume: 60,
      wallpaperSpeed: 1,
      wallpaperLoop: true,
      wallpaperPaused: false,
      motion: true,
      batterySaver: false,
      reduceMotion: false
    });
  }, id);
}

async function verifyCatalog(page) {
  const results = [];
  for (const project of manifest.projects) {
    await applyWallpaper(page, project.id);
    if (project.mediaType === "video") {
      await page.waitForFunction(() => {
        const video = document.querySelector("#wallpaper-media video");
        return video && video.readyState >= 2 && !video.paused;
      }, null, { timeout: 20_000 });
      const before = await page.locator("#wallpaper-media video").evaluate((video) => video.currentTime);
      await page.waitForTimeout(900);
      const after = await page.locator("#wallpaper-media video").evaluate((video) => video.currentTime);
      assert(after - before > 0.35, `${project.id} video time did not advance in Chrome`);
      results.push({ id: project.id, type: "video", advanced: Number((after - before).toFixed(2)) });
      continue;
    }

    await page.waitForFunction(() => {
      const state = window.NEOWallpaperEngine.getState();
      return state.animationHealthy || state.playback === "error";
    }, null, { timeout: 12_000 });
    const state = await page.evaluate(() => window.NEOWallpaperEngine.getState());
    assert.notEqual(state.playback, "error", `${project.id} entered the error state in Chrome`);
    const layer = page.locator("#wallpaper-media");
    const before = await layer.screenshot();
    await page.waitForTimeout(900);
    const after = await layer.screenshot();
    const ratio = changedPixelRatio(before, after);
    assert(ratio > 0.00001, `${project.id} rendered a frozen web wallpaper in Chrome`);
    results.push({ id: project.id, type: project.mediaType, changedPixelRatio: Number(ratio.toFixed(6)) });
  }
  return results;
}

async function verifyApplyResumes(page) {
  await page.evaluate(() => {
    window.NEO_SHELL.setSetting("wallpaperPaused", true);
    window.NEO_SHELL.openApp("wallpaper");
  });
  const windowNode = page.locator('.neo-window[data-app-id="wallpaper"]');
  await windowNode.locator('[data-wallpaper-option="we-eagleflag"]').waitFor({ timeout: 15_000 });
  await windowNode.locator('[data-wallpaper-option="we-eagleflag"]').click();
  await windowNode.locator("[data-wallpaper-apply]").click();
  await page.waitForFunction(() => {
    const video = document.querySelector("#wallpaper-media video");
    return window.NEO_SHELL.getSetting("wallpaperPaused") === false && video && !video.paused;
  }, null, { timeout: 12_000 });
  const before = await page.locator("#wallpaper-media video").evaluate((video) => video.currentTime);
  await page.waitForTimeout(700);
  const after = await page.locator("#wallpaper-media video").evaluate((video) => video.currentTime);
  assert(after - before > 0.3, "Applying a new wallpaper preserved the old paused state");
}

async function verifyPlaybackToggle(page) {
  const windowNode = page.locator('.neo-window[data-app-id="wallpaper"]');
  const toggle = windowNode.locator('[data-wallpaper-command="toggle"]');
  const video = page.locator("#wallpaper-media video");

  await toggle.click();
  await page.waitForFunction(() => {
    const media = document.querySelector("#wallpaper-media video");
    return media && media.paused && window.NEO_SHELL.getSetting("wallpaperPaused") === true;
  });
  const pausedAt = await video.evaluate((media) => media.currentTime);
  await page.waitForTimeout(500);
  const stillPausedAt = await video.evaluate((media) => media.currentTime);
  assert(Math.abs(stillPausedAt - pausedAt) < 0.03, "Pause control did not freeze video playback");
  assert.equal(await toggle.getAttribute("aria-label"), "Resume wallpaper");

  await toggle.click();
  await page.waitForFunction(() => {
    const media = document.querySelector("#wallpaper-media video");
    return media && !media.paused && window.NEO_SHELL.getSetting("wallpaperPaused") === false;
  });
  assert.equal(await toggle.getAttribute("aria-label"), "Pause wallpaper");

  await video.evaluate((media) => media.pause());
  await page.waitForFunction(() => {
    const control = document.querySelector('.neo-window[data-app-id="wallpaper"] [data-wallpaper-command="toggle"]');
    return document.documentElement.dataset.wallpaperPlayback === "paused" && control && control.getAttribute("aria-label") === "Resume wallpaper";
  });
  assert.equal(await page.evaluate(() => window.NEO_SHELL.getSetting("wallpaperPaused")), false, "Browser pause incorrectly changed the saved pause preference");

  await toggle.click();
  await page.waitForFunction(() => {
    const media = document.querySelector("#wallpaper-media video");
    return media && !media.paused && window.NEOWallpaperEngine.getState().playing;
  });
}

async function verifyDownloadedMediaAtomic(page) {
  const videoProject = manifest.projects.find((project) => project.mediaType === "video");
  assert(videoProject, "The installed catalog has no video for the download regression test");
  await applyWallpaper(page, "we-steam-1789171537");
  assert.equal(await page.locator("#wallpaper-media > *").evaluate((node) => node.tagName), "IFRAME");

  await page.evaluate(async ({ file, preview }) => {
    const [blob, thumbnail] = await Promise.all([
      fetch(file).then((response) => response.blob()),
      fetch(preview).then((response) => response.blob())
    ]);
    await window.NEOWallpaperEngine.acceptStoredRecord({
      id: "commons-atomic-test",
      name: "Atomic download test",
      type: "video",
      mime: blob.type || "video/mp4",
      width: 1920,
      height: 1080,
      createdAt: Date.now(),
      online: true,
      fullMedia: true,
      blob,
      thumbnail
    });
  }, { file: videoProject.file, preview: videoProject.preview });

  await applyWallpaper(page, "commons-atomic-test");
  await page.waitForFunction(() => {
    const video = document.querySelector("#wallpaper-media video");
    return video && video.readyState >= 2 && !video.paused;
  }, null, { timeout: 20_000 });
  const downloaded = await page.evaluate(() => {
    const video = document.querySelector("#wallpaper-media video");
    return {
      state: window.NEOWallpaperEngine.getState(),
      src: video.currentSrc,
      poster: video.poster,
      width: video.videoWidth,
      height: video.videoHeight,
      children: document.querySelector("#wallpaper-media").children.length
    };
  });
  assert.equal(downloaded.state.id, "commons-atomic-test");
  assert.equal(downloaded.state.playback, "playing");
  assert(downloaded.src.startsWith("blob:"), "Downloaded video is not using its stored Blob");
  assert(downloaded.poster.startsWith("blob:"), "Downloaded video ignored its stored thumbnail fallback");
  assert(downloaded.width >= 1920 && downloaded.height >= 1080, "Downloaded video decoded below 1080p");
  assert.equal(downloaded.children, 1, "Prepared media remained layered over the active wallpaper");

  const goodSource = downloaded.src;
  await page.evaluate(async (previewPath) => {
    const preview = await fetch(previewPath).then((response) => response.blob());
    await window.NEOWallpaperEngine.acceptStoredRecord({
      id: "commons-broken-test",
      name: "Broken download test",
      type: "video",
      mime: "video/webm",
      width: 1920,
      height: 1080,
      createdAt: Date.now(),
      online: true,
      fullMedia: true,
      blob: new Blob(["not video data"], { type: "video/webm" }),
      thumbnail: preview
    });
  }, videoProject.preview);
  const rejected = await page.evaluate(async () => {
    try {
      await window.NEOWallpaperEngine.apply("commons-broken-test", {
        wallpaperFit: "cover",
        wallpaperMuted: true,
        wallpaperPaused: false,
        motion: true,
        batterySaver: false,
        reduceMotion: false
      });
      return false;
    } catch (_error) {
      return true;
    }
  });
  assert.equal(rejected, true, "A corrupt downloaded video was accepted");
  const retained = await page.evaluate(() => {
    const video = document.querySelector("#wallpaper-media video");
    return {
      state: window.NEOWallpaperEngine.getState(),
      src: video && video.currentSrc,
      children: document.querySelector("#wallpaper-media").children.length
    };
  });
  assert.equal(retained.state.id, "commons-atomic-test", "A failed download replaced the active wallpaper");
  assert.equal(retained.state.playback, "playing", "A failed download stopped the previous wallpaper");
  assert.equal(retained.src, goodSource, "A failed download changed the rendered media source");
  assert.equal(retained.children, 1, "A failed download left an invisible media layer behind");

  await applyWallpaper(page, "we-steam-1789171537");
  await page.evaluate(async () => {
    await window.NEOWallpaperEngine.remove("commons-atomic-test");
    await window.NEOWallpaperEngine.remove("commons-broken-test");
  });
}

async function verifyLowPowerChrome(browser) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 4 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 4 });
    localStorage.setItem("neo_os_settings_v1", JSON.stringify({ performance: "auto", motion: true, wallpaperPaused: true }));
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}?chrome-low-power=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  const mode = await page.evaluate(() => ({
    performance: document.documentElement.dataset.performance,
    motion: document.documentElement.dataset.motion
  }));
  assert.equal(mode.performance, "low", "Chrome low-power hints were not detected");
  assert.equal(mode.motion, "true", "Chrome low-power hints still disabled wallpaper motion");
  assert.equal(await page.evaluate(() => window.NEO_SHELL.getSetting("wallpaperPaused")), false, "A stale paused state survived Chrome startup");

  const checks = [
    ["moonfall", ".wallpaper-image", "transform"],
    ["aurora", ".wallpaper-aurora", "transform"],
    ["starfield", ".wallpaper-stars", "backgroundPosition"]
  ];
  for (const [id, selector, property] of checks) {
    await page.evaluate(async (wallpaperId) => {
      document.documentElement.dataset.wallpaper = wallpaperId;
      await window.NEOWallpaperEngine.apply(wallpaperId, { motion: true, wallpaperPaused: false });
    }, id);
    const animation = await page.locator(selector).evaluate((node) => getComputedStyle(node).animationName);
    assert.notEqual(animation, "none", `${id} has no Chrome animation`);
    const before = await page.locator(selector).evaluate((node, key) => getComputedStyle(node)[key], property);
    await page.waitForTimeout(550);
    const after = await page.locator(selector).evaluate((node, key) => getComputedStyle(node)[key], property);
    assert.notEqual(after, before, `${id} animation did not advance in low-power Chrome`);
  }

  await page.evaluate(async () => {
    document.documentElement.dataset.wallpaper = "signal";
    await window.NEOWallpaperEngine.apply("signal", { motion: true, wallpaperPaused: false });
  });
  const beforeSignal = await page.locator("#wallpaper-media canvas").screenshot();
  await page.waitForTimeout(550);
  const afterSignal = await page.locator("#wallpaper-media canvas").screenshot();
  assert(changedPixelRatio(beforeSignal, afterSignal) > 0.00001, "Signal canvas did not advance in low-power Chrome");
  await context.close();
}

async function verifyStaleProfileRecovery(browser) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}?stale-profile-seed=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("neo_os_wallpaper_engine_v1", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("wallpapers", "readwrite");
      transaction.objectStore("wallpapers").put({
        id: "steam-1403160205",
        name: "Old Rainy Day preview",
        type: "animated-image",
        mime: "image/gif",
        sourceId: "1403160205",
        createdAt: Date.now(),
        online: true,
        fullMedia: false,
        previewFallback: true,
        animatedPreview: true,
        blob: new Blob(["stale-preview"], { type: "image/gif" })
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForShell(page);
  await applyWallpaper(page, "steam-1403160205");
  await page.waitForFunction(() => window.NEOWallpaperEngine.getState().animationHealthy, null, { timeout: 12_000 });
  const recovered = await page.evaluate(async () => {
    const studio = document.createElement("section");
    studio.dataset.selectedWallpaper = "steam-1403160205";
    studio.innerHTML = '<div data-wallpaper-grid></div><span data-installed-count></span>';
    document.body.appendChild(studio);
    const records = await window.NEOWallpaperEngine.hydrateStudio(studio);
    return {
      state: window.NEOWallpaperEngine.getState(),
      tag: document.querySelector("#wallpaper-media > *")?.tagName,
      ids: records.map((record) => record.id),
      selected: studio.dataset.selectedWallpaper,
      savedSetting: window.NEO_SHELL.getSetting("wallpaper")
    };
  });
  assert.equal(recovered.state.id, "we-steam-1403160205", "Stale preview ID was not upgraded");
  assert.equal(recovered.tag, "IFRAME", "Stale preview still replaced the original web wallpaper");
  assert(!recovered.ids.includes("steam-1403160205"), "Stale preview remains duplicated in Installed");
  assert(recovered.ids.includes("we-steam-1403160205"), "Verified Rainy Day original is missing");
  assert.equal(recovered.selected, "we-steam-1403160205", "Installed selection was not canonicalized");
  assert.equal(recovered.savedSetting, "we-steam-1403160205", "Stale saved wallpaper ID was not repaired");
  await context.close();
}

async function verifyInstalledLibraryPersistence(browser) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}?installed-reset-seed=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  await page.evaluate(async (previewPath) => {
    function seedDatabase(name, storeName, key, value, options = {}) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, options);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readwrite");
          const store = transaction.objectStore(storeName);
          if (key === undefined) store.put(value);
          else store.put(value, key);
          transaction.oncomplete = () => { database.close(); resolve(); };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }

    const persistentImage = await fetch(previewPath).then((response) => response.blob());
    await seedDatabase("neo_os_wallpaper_engine_v1", "wallpapers", undefined, {
      id: "local-reset-test",
      name: "Keep on refresh",
      type: "image",
      mime: persistentImage.type,
      createdAt: Date.now(),
      blob: persistentImage,
      thumbnail: persistentImage
    }, { keyPath: "id" });
    await seedDatabase("neo_os_wallpapers", "assets", "custom", new Blob(["legacy"], { type: "image/png" }));
    localStorage.setItem("neo_os_settings_v1", JSON.stringify({
      designVersion: 9,
      wallpaper: "local-reset-test",
      wallpaperFavorites: ["custom"],
      wallpaperRecent: ["custom"],
      motion: true,
      wallpaperPaused: false
    }));
  }, manifest.projects[0].preview);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForShell(page);
  await page.waitForFunction(async () => {
    const stored = await window.NEOWallpaperEngine.list();
    return stored.some((record) => record.id === "local-reset-test")
      && window.NEO_SHELL.getSetting("wallpaper") === "local-reset-test";
  }, null, { timeout: 12_000 });
  const result = await page.evaluate(async () => {
    const bundled = await window.NEOWallpaperEngine.listBundled();
    const stored = await window.NEOWallpaperEngine.list();
    const legacyCustom = await new Promise((resolve, reject) => {
      const request = indexedDB.open("neo_os_wallpapers", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("assets", "readonly");
        const read = transaction.objectStore("assets").get("custom");
        read.onsuccess = () => { database.close(); resolve(Boolean(read.result)); };
        read.onerror = () => reject(read.error);
      };
    });
    return {
      bundledIds: bundled.map((record) => record.id),
      storedIds: stored.map((record) => record.id),
      wallpaper: window.NEO_SHELL.getSetting("wallpaper"),
      favorites: window.NEO_SHELL.getSetting("wallpaperFavorites"),
      recent: window.NEO_SHELL.getSetting("wallpaperRecent"),
      legacyCustom
    };
  });
  assert.deepEqual(result.bundledIds, manifest.projects.map((project) => project.id), "The permanent wallpaper allowlist changed");
  assert.deepEqual(result.storedIds, ["local-reset-test"], "A valid user-installed wallpaper did not survive refresh");
  assert.equal(result.wallpaper, "local-reset-test", "The persisted user wallpaper was not restored");
  assert(!result.favorites.includes("custom") && !result.recent.includes("custom"), "Legacy custom wallpaper state survived refresh");
  assert.equal(result.legacyCustom, false, "The legacy custom wallpaper blob survived refresh");
  await context.close();
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling"]
});

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}?chrome-wallpaper-test=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  const catalog = await verifyCatalog(page);
  await verifyApplyResumes(page);
  await verifyPlaybackToggle(page);
  await verifyDownloadedMediaAtomic(page);
  await context.close();
  await verifyLowPowerChrome(browser);
  await verifyStaleProfileRecovery(browser);
  await verifyInstalledLibraryPersistence(browser);
  console.log(JSON.stringify({ chrome: chromePath, catalog, downloadedMedia: "passed", lowPower: "passed", staleProfile: "passed", installedPersistence: "passed" }, null, 2));
} finally {
  await browser.close();
}
