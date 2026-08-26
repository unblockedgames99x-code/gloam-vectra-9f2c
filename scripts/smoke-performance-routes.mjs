import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4188";
const root = path.resolve(import.meta.dirname, "..");
const pageHtml = Object.fromEntries(
  ["chat", "community", "gamemaker", "party"].map((page) => [
    page,
    fs.readFileSync(path.join(root, "pages", `${page}_html.html`), "utf8"),
  ])
);
const chatSource = pageHtml.chat;
const stamp = Date.now();
const cloudState = {
  version: 1,
  revision: 1,
  updatedAt: stamp,
  accounts: {
    carterb: {
      username: "CarterB",
      role: "owner",
      status: "online",
      createdAt: stamp,
      updatedAt: stamp,
    },
  },
  rooms: {
    global: {
      id: "global",
      kind: "room",
      name: "Global Chat",
      members: ["carterb"],
      unread: {},
      createdAt: stamp,
    },
  },
  messages: [],
  presence: {},
  friends: {},
  friendRequests: {},
  friendRemovals: {},
  notifications: {},
  browserBans: {},
  parties: {},
  weeklyGames: {},
  deletedAccounts: {},
  deletedRooms: {},
  deletedMessages: {},
  publicRoomsOnlyGlobalCleanedAt: stamp,
};

assert.match(chatSource, /FIREBASE_REST_POLL_MS\s*=\s*5000/);
assert.match(chatSource, /FIREBASE_REST_URL\s*\+\s*"\?print=silent"/);
assert.doesNotMatch(chatSource, /setInterval\(\(\)\s*=>\s*pollCloudStateRest[\s\S]{0,100}1200/);

const browser = await chromium.launch({ headless: true });

async function createContext() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem("ugp_token", "static-firebase:performance-smoke");
    localStorage.setItem(
      "ugp_session",
      JSON.stringify({ id: "carterb", username: "CarterB", role: "owner", status: "approved" })
    );
    localStorage.setItem("ugp_chat_user", "CarterB");
  });
  await context.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
  await context.route("https://taco-chat-c1539-default-rtdb.firebaseio.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const decodedPath = decodeURIComponent(url.pathname);
    const pageMatch = decodedPath.match(/\/ultimateGameStash\/pages\/(chat|community|gamemaker|party)\.json$/);
    if (pageMatch) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pageHtml[pageMatch[1]]),
      });
      return;
    }
    if (request.method() === "PUT") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "ETag",
          ETag: '"perf-2"',
        },
      });
      return;
    }
    if (decodedPath.endsWith("/rooms/_deluxeAppState/state.json")) {
      if (request.headers()["if-none-match"]) {
        await route.fulfill({
          status: 304,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "ETag",
            ETag: '"perf-1"',
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "ETag",
            ETag: '"perf-1"',
          },
          body: JSON.stringify(cloudState),
        });
      }
      return;
    }
    const accountMatch = decodedPath.match(/\/accounts\/([^/]+)\.json$/);
    const value = accountMatch
      ? cloudState.accounts[accountMatch[1]] || null
      : decodedPath.endsWith("/accounts.json")
        ? cloudState.accounts
        : null;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(value),
    });
  });
  return context;
}

async function inspectRoute(routePath, readySelector, options = {}) {
  const context = await createContext();
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.locator(readySelector).first().waitFor({ state: "attached", timeout: 25_000 });
  await page.waitForFunction(() => Boolean(window.learningZonesChatSync), null, { timeout: 6_000 });
  await page.waitForTimeout(250);
  if (!options.allowCatalog) {
    assert.equal(
      requests.some((url) => url.includes("/games/index.json")),
      false,
      `${routePath} must not download the game catalog`
    );
  }
  assert.equal(
    requests.some((url) => url.includes("/games/covers.json")),
    false,
    `${routePath} must not download the cover manifest`
  );
  assert.equal(errors.length, 0, `${routePath}: ${errors.join(" | ")}`);
  await context.close();
}

async function inspectChatPolling() {
  const context = await createContext();
  const page = await context.newPage();
  const stateRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/rooms/_deluxeAppState/state.json")) {
      stateRequests.push({
        at: Date.now(),
        method: request.method(),
        conditional: Boolean(request.headers()["if-none-match"]),
      });
    }
  });
  await page.goto(`${baseUrl}/chat`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.frameLocator('[data-testid="chat-iframe"]').locator("#login, #app").first().waitFor({
    state: "attached",
    timeout: 25_000,
  });
  await page.waitForTimeout(6_200);
  const reads = stateRequests.filter((request) => request.method === "GET");
  assert.ok(reads.length <= 2, `Expected at most two chat state reads in 6.2s, received ${reads.length}.`);
  if (reads.length === 2) {
    assert.ok(reads[1].at - reads[0].at >= 4_700, JSON.stringify(reads));
    assert.equal(reads[1].conditional, true, "The recurring chat read must use an ETag condition.");
  }
  await context.close();
}

try {
  await inspectRoute("/chat", '[data-testid="chat-iframe"]');
  await inspectRoute("/community", '[data-testid="site-header"]');
  await inspectRoute("/settings", '[data-lz-settings-page]');
  await inspectRoute("/owner", '[data-testid="site-header"]', { allowCatalog: true });
  await inspectChatPolling();
  console.log("Route performance smoke: passed");
} finally {
  await browser.close();
}
