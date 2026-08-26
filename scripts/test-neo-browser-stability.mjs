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
const baseUrl = process.env.NEO_URL || "http://127.0.0.1:4195/neo-os/";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const queries = [
  "IANA example domain",
  "MDN HTML video element",
  "web accessibility keyboard navigation",
  "browser history API documentation",
];
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const failures = [];
const pageErrors = [];
let crashed = false;
let searchClicks = 0;
let searchChallenges = 0;
let forcedTransportRecoveries = 0;

page.on("crash", () => { crashed = true; });
page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

async function assertShellAlive(label) {
  assert.equal(crashed, false, `${label}: Chrome reported a page crash`);
  assert.equal(page.isClosed(), false, `${label}: the NEO page closed unexpectedly`);
  assert((await page.locator(".neo-browser-frame.is-active").count()) === 1, `${label}: active frame count drifted`);
  assert.equal(await page.title(), "NEO OS", `${label}: the top-level page left NEO OS`);
}

async function waitForAddress(expected, label) {
  try {
    await page.waitForFunction(
      (value) => document.querySelector("[data-browser-address]")?.value === value,
      expected,
      { timeout: 15_000 },
    );
  } catch (error) {
    const actual = await page.locator("[data-browser-address]").inputValue().catch(() => "<unavailable>");
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
  await page.waitForTimeout(650);
  assert.equal(await page.locator("[data-browser-address]").inputValue(), expected, `${label}: address drifted`);
  await assertShellAlive(label);
}

async function navigate(value, expected = value, label = value) {
  const address = page.locator("[data-browser-address]");
  await address.fill(value);
  await address.press("Enter");
  await waitForAddress(expected, label);
}

async function activeFrame() {
  const handle = await page.locator(".neo-browser-frame.is-active").elementHandle();
  return handle?.contentFrame();
}

async function assertNoBareClientError(label) {
  const frame = await activeFrame();
  assert(frame, `${label}: active frame was unavailable`);
  const body = await frame.locator("body").innerText().catch(() => "");
  assert.doesNotMatch(
    body,
    /there are no bare clients|No BareTransport was set|wasm not loaded yet|Error processing your request/i,
    `${label}: raw proxy transport error reached the tab`,
  );
}

async function installFailingTransport() {
  await page.evaluate(async () => {
    const connection = new window.BareMux.BareMuxConnection(
      "/neo-os/browser-runtime/baremux/worker.js?engine=neo-browse-v41",
    );
    await connection.setManualTransport(`
      return [class BrokenTransport {
        constructor() { this.ready = true; }
        async init() {}
        async request() { throw new Error("there are no bare clients"); }
        connect() { throw new Error("there are no bare clients"); }
      }, "neo-stability-broken-transport"];
    `, []);
  });
}

async function forceProxiedFrameRoute(destination, label) {
  await page.evaluate((target) => {
    const frame = document.querySelector(".neo-browser-frame.is-active");
    frame.src = `/neo-os/browse/${window.__uv$config.encodeUrl(target)}`;
  }, destination);
  await waitForAddress(destination, label);
  const frame = await activeFrame();
  await frame.locator("h1").waitFor({ state: "visible", timeout: 20_000 });
  assert.match(await frame.locator("h1").innerText(), /Example Domain/i, `${label}: recovered page did not load`);
  await assertNoBareClientError(label);
}

function resultDestination(value) {
  const source = String(value || "");
  let redirect;
  if (source.includes("/neo-os/browse/")) {
    const local = new URL(source, baseUrl);
    redirect = new URL(decodeURIComponent(local.pathname.split("/neo-os/browse/")[1] || ""));
  } else {
    redirect = new URL(source, "https://duckduckgo.com/");
  }
  return redirect.searchParams.get("uddg");
}

try {
  await page.goto(`${baseUrl}?browser-stability-test=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => window.NEO_SHELL && window.NEOWallpaperEngine, null, { timeout: 20_000 });
  const guestButton = page.locator("[data-neo-login-guest]");
  if (await guestButton.isVisible().catch(() => false)) await guestButton.click();
  await page.locator('.dock-button[data-app="browser"]').click();
  await page.locator("[data-browser-search-input]").waitFor({ state: "visible", timeout: 10_000 });

  await page.locator("[data-browser-start-plus]").click();
  await page.locator(".neo-browser-runtime").waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await page.locator(".neo-browser-tab-shell").count(), 2, "home new-tab control did not create a tab");

  const initialFrame = await activeFrame();
  assert(initialFrame, "new-tab frame was unavailable");
  await initialFrame.locator("main").click({ button: "right", position: { x: 40, y: 40 } });
  await page.getByRole("menuitem", { name: /Inspect/ }).click();
  await page.waitForFunction(() => document.querySelector("[data-browser-inspector]")?.classList.contains("is-open"));
  assert.match(await page.locator("[data-browser-inspector-selector]").innerText(), /html|body|main/i);
  await page.locator("[data-browser-inspector-close]").click();

  await page.locator(".neo-browser-tab-close").last().click();
  assert.equal(await page.locator(".neo-browser-tab-shell").count(), 1, "tab close control did not remove the active tab");

  const browserWindow = page.locator('.neo-window[data-app-id="browser"]');
  const windowBeforeDrag = await browserWindow.boundingBox();
  const dragHandle = await browserWindow.locator(".window-chrome").boundingBox();
  assert(windowBeforeDrag && dragHandle, "browser window drag geometry was unavailable");
  await page.mouse.move(dragHandle.x + Math.min(400, dragHandle.width / 2), dragHandle.y + dragHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragHandle.x + Math.min(400, dragHandle.width / 2) + 80, dragHandle.y + dragHandle.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  const windowAfterDrag = await browserWindow.boundingBox();
  assert(windowAfterDrag, "browser window disappeared after dragging");
  const dragDelta = {
    x: Math.round(windowAfterDrag.x - windowBeforeDrag.x),
    y: Math.round(windowAfterDrag.y - windowBeforeDrag.y),
  };
  assert(Math.abs(dragDelta.x - 80) <= 2, `window drag horizontal delta was ${dragDelta.x}px instead of 80px`);
  assert(Math.abs(dragDelta.y - 50) <= 2, `window drag vertical delta was ${dragDelta.y}px instead of 50px`);
  assert.equal(await browserWindow.evaluate((element) => element.classList.contains("is-dragging")), false, "window remained in dragging state");

  await navigate("https://example.com/?initial-enter=1", "https://example.com/?initial-enter=1", "initial address submission");

  for (let index = 0; index < 3; index += 1) {
    await installFailingTransport();
    const destination = `https://example.com/?forced-transport-recovery=${index}`;
    await forceProxiedFrameRoute(destination, `forced transport recovery ${index + 1}`);
    forcedTransportRecoveries += 1;
  }

  for (let index = 0; index < 12; index += 1) {
    const host = index % 2 ? "example.org" : "example.com";
    const destination = `https://${host}/?neo-navigation-loop=${index}`;
    await navigate(destination, destination, `direct navigation ${index + 1}`);
  }

  for (const query of queries) {
    const expected = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    await navigate(query, expected, `search ${query}`);
    const frame = await activeFrame();
    assert(frame, `${query}: search frame was unavailable`);
    await page.waitForTimeout(700);
    const initialBody = await frame.locator("body").innerText().catch(() => "");
    if (/bots use DuckDuckGo|complete the following challenge/i.test(initialBody)) {
      searchChallenges += 1;
      await assertShellAlive(`search challenge ${query}`);
      continue;
    }
    const result = frame.locator("a.result__a, .result__title a").first();
    try {
      await result.waitFor({ state: "visible", timeout: 15_000 });
    } catch (error) {
      const body = await frame.locator("body").innerText().catch(() => "Frame text unavailable");
      if (/bots use DuckDuckGo|complete the following challenge/i.test(body)) {
        searchChallenges += 1;
        await assertShellAlive(`search challenge ${query}`);
        continue;
      }
      throw new Error(`${query}: no search result loaded. ${body.slice(0, 600)}`);
    }
    const sourceHref = await result.getAttribute("__uv-attr-href") || await result.getAttribute("href");
    const exactDestination = resultDestination(sourceHref);
    assert(exactDestination, `${query}: result had no exact destination`);
    await result.click();
    await waitForAddress(new URL(exactDestination).href, `result click ${query}`);
    searchClicks += 1;
  }

  assert.equal(await page.locator('[data-app="youtube"], .neo-window[data-app-id="youtube"]').count(), 0, "Retired YouTube app is still visible");

  for (let index = 0; index < 10; index += 1) {
    await page.evaluate((run) => {
      window.dispatchEvent(new CustomEvent("neo-media-state", {
        detail: { source: `stability-${run}`, active: true, playing: true, kind: "video", title: "Test media" },
      }));
    }, index);
    assert.equal(await page.evaluate(() => window.NEOWallpaperEngine.getState().mediaPriorityPaused), true);
    await page.evaluate((run) => {
      window.dispatchEvent(new CustomEvent("neo-media-state", {
        detail: { source: `stability-${run}`, active: false },
      }));
    }, index);
    assert.equal(await page.evaluate(() => window.NEOWallpaperEngine.getState().mediaPriorityPaused), false);
  }

  await assertShellAlive("final state");
} catch (error) {
  failures.push(String(error?.stack || error));
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  if (pageErrors.length) console.error("Page errors:\n" + pageErrors.slice(0, 20).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`NEO browser stability passed: tab creation/close, Inspect, smooth drag, ${forcedTransportRecoveries} forced transport recoveries, 12 direct routes, ${queries.length} searches (${searchClicks} result clicks, ${searchChallenges} external challenges), retired YouTube app absent, and 10 media-priority cycles.`);
  if (pageErrors.length) console.log(`Non-fatal page errors observed: ${pageErrors.length}`);
}
