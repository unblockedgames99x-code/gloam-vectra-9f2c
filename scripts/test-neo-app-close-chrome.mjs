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
const baseUrl = process.env.NEO_URL || "http://127.0.0.1:4195/neo-os/?app-close-v1=1";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => sessionStorage.setItem("neo_os_guest_session_v1", "1"));
const page = await context.newPage();
const dialogs = [];

page.on("dialog", async (dialog) => {
  dialogs.push({ type: dialog.type(), message: dialog.message() });
  await dialog.dismiss();
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.NEO_SHELL && window.NEOWallpaperEngine, null, { timeout: 20_000 });
  const guestButton = page.locator("[data-neo-login-guest]");
  if (await guestButton.isVisible().catch(() => false)) await guestButton.click();
  const wallpaperColor = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      brightness: style.getPropertyValue("--wallpaper-brightness").trim(),
      saturation: style.getPropertyValue("--wallpaper-saturation").trim(),
    };
  });
  assert.deepEqual(wallpaperColor, { brightness: "1", saturation: "1" });
  await page.locator('.dock-button[data-app="files"]').click();
  const app = page.locator('.neo-window[data-app-id="files"]');
  await app.waitFor({ state: "visible" });

  await app.evaluate((windowElement) => {
    const frame = document.createElement("iframe");
    frame.dataset.leaveGuardFixture = "";
    Object.assign(frame.style, {
      position: "absolute",
      left: "12px",
      bottom: "12px",
      width: "160px",
      height: "52px",
      zIndex: "1000",
    });
    frame.srcdoc = `<!doctype html><button id="activate">Activate</button><script>
      addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = "";
      });
    <\/script>`;
    windowElement.appendChild(frame);
  });

  const fixture = page.frameLocator("iframe[data-leave-guard-fixture]");
  await fixture.locator("#activate").click();
  await app.locator('[data-window-action="close"]').click();
  await app.waitFor({ state: "detached", timeout: 3000 });
  await page.waitForTimeout(350);

  assert.equal(dialogs.length, 0, `Chrome showed a leave dialog while closing an app: ${JSON.stringify(dialogs)}`);
  assert.equal(page.isClosed(), false, "Closing an app closed the NEO OS tab");
  assert.equal(await page.title(), "NEO OS");
  console.log("NEO Chrome app-close check passed without a leave dialog.");
} finally {
  await context.close();
  await browser.close();
}
