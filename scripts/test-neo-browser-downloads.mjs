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
  try { return require(name); } catch (error) { return require(path.join(runtimeModules, name)); }
}

const { chromium } = loadDependency("playwright");
const baseUrl = process.env.NEO_URL || "http://127.0.0.1:4195/neo-os/?drive-download-test=1";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const fileName = `neo-drive-download-${Date.now()}.txt`;
const fileBody = "NEO web-window download integration test";
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1360, height: 820 } });
await context.addInitScript(() => sessionStorage.setItem("neo_os_guest_session_v1", "1"));
const page = await context.newPage();
const pageErrors = [];

page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => window.NEO_SHELL && window.NEOWallpaperEngine, null, { timeout: 20_000 });
  const guestButton = page.locator("[data-neo-login-guest]");
  if (await guestButton.isVisible().catch(() => false)) await guestButton.click();

  await page.locator('.dock-button[data-app="browser"]').click();
  await page.locator("[data-browser-search-input]").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("[data-browser-start-plus]").click();
  await page.locator(".neo-browser-runtime").waitFor({ state: "visible", timeout: 15_000 });
  const address = page.locator("[data-browser-address]");
  await address.fill("https://example.com/?neo-download-fixture=1");
  await address.press("Enter");
  try {
    await page.waitForFunction(() => (
      document.querySelector("[data-browser-address]")?.value === "https://example.com/?neo-download-fixture=1"
    ), null, { timeout: 20_000 });
  } catch (error) {
    throw new Error(`the fixture page did not open; address is ${await address.inputValue()}`);
  }
  const frameHandle = await page.locator(".neo-browser-frame.is-active").elementHandle();
  const fixtureFrame = await frameHandle?.contentFrame();
  assert(fixtureFrame, "the download fixture frame was unavailable");
  await fixtureFrame.locator("h1").waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await fixtureFrame.evaluate(() => window.__neoBrowserClientReady), true);
  await fixtureFrame.evaluate((fixture) => {
    const link = document.createElement("a");
    link.id = "fixture-download";
    link.download = fixture.fileName;
    link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(fixture.fileBody)}`;
    link.textContent = "Download file";
    document.body.appendChild(link);
  }, { fileName, fileBody });
  await fixtureFrame.locator("#fixture-download").click();
  const status = page.locator("[data-browser-download-status]");
  await status.waitFor({ state: "visible", timeout: 10_000 });
  await assert.doesNotReject(async () => {
    await page.waitForFunction(
      (name) => document.querySelector("[data-browser-download-status]")?.textContent?.includes(`${name} saved to Drive`),
      fileName,
      { timeout: 15_000 },
    );
  }, "the download never reached Drive");

  await page.waitForFunction(async (name) => {
    if (!window.NEO_FILES?.list) return false;
    const entries = await window.NEO_FILES.list();
    return entries.some((entry) => entry.name === name && entry.parentId === "folder-downloads");
  }, fileName, { timeout: 10_000 });

  const savedEntry = await page.evaluate(async (name) => {
    const entries = await window.NEO_FILES.list();
    return entries.find((entry) => entry.name === name) || null;
  }, fileName);
  assert(savedEntry, "the downloaded file was not stored");
  assert.equal(savedEntry.parentId, "folder-downloads", "the download was saved outside Drive > Downloads");
  assert.match(savedEntry.type, /^text\/plain(?:;|$)/, "the downloaded file type changed");
  assert.equal(savedEntry.size, Buffer.byteLength(fileBody), "the downloaded file data was incomplete");

  await page.locator('.dock-button[data-app="files"]').click();
  const drive = page.locator('.neo-window[data-app-id="files"]');
  await drive.waitFor({ state: "visible", timeout: 10_000 });
  await drive.locator('[data-files-location="folder-downloads"]').click();
  await drive.getByText(fileName, { exact: true }).waitFor({ state: "visible", timeout: 10_000 });

  assert.equal(pageErrors.length, 0, `download flow produced page errors: ${pageErrors.join(" | ")}`);
  assert.equal(await page.title(), "NEO OS");
  console.log(`NEO download-to-Drive check passed: ${fileName}`);
} finally {
  await context.close();
  await browser.close();
}
