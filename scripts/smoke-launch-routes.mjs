import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const baseUrl = process.argv[2] || "http://127.0.0.1:4188";
const ownerId = "carterb";
const chatSession = {
  sessionId: "launch-smoke-session",
  token: "launch-smoke-browser-token-20260723",
  expiresAt: Date.now() + 3_600_000,
};
const account = {
  username: "CarterB",
  role: "owner",
  ugpStatus: "approved",
  status: "online",
  createdAt: Date.now() - 86_400_000,
  updatedAt: Date.now(),
  authSessions: {
    [chatSession.sessionId]: {
      hash: createHash("sha256").update(chatSession.token).digest("hex"),
      createdAt: Date.now(),
      expiresAt: chatSession.expiresAt,
      browserId: "",
    },
  },
};
const pageHtml = Object.fromEntries(
  await Promise.all(
    ["chat", "community", "gamemaker", "party"].map(async (name) => [
      name,
      await readFile(path.join(root, "pages", `${name}_html.html`), "utf8"),
    ])
  )
);

const routes = [
  { path: "/", selector: '[data-testid="games-grid"]', label: "library" },
  { path: "/community", selector: '[data-testid="community-iframe"]', label: "community" },
  { path: "/gamemaker", selector: '[data-testid="gamemaker-iframe"]', label: "zone maker" },
  { path: "/party", selector: '[data-testid="party-iframe"]', label: "party zones" },
  { path: "/chat", selector: '[data-testid="chat-iframe"]', label: "chat", launcher: false },
  { path: "/suggest", selector: '[data-testid="suggest-form"]', label: "suggest" },
  { path: "/report-a-bug", selector: '[data-testid="bug-report-form"]', label: "report bug" },
  { path: "/owner", selector: '[data-testid="owner-install-site-btn"]', label: "owner" },
  { path: "/settings", selector: "main, .lz-settings-shell", label: "settings" },
  { path: "/zone/retro-bowl", selector: '[data-testid="game-iframe"]', label: "game player" },
];

const checks = [];
const failures = [];

function check(name, passed, detail = "") {
  const result = { name, passed: Boolean(passed), detail };
  checks.push(result);
  if (!result.passed) failures.push(result);
}

function emptyChatState() {
  const stamp = Date.now();
  return {
    accounts: { [ownerId]: { ...account } },
    rooms: {
      global: {
        id: "global",
        name: "Global Chat",
        kind: "room",
        members: [ownerId],
        unread: {},
        createdAt: stamp - 86_400_000,
        updatedAt: stamp,
      },
    },
    messages: [],
    presence: { [ownerId]: { username: "CarterB", lastSeen: stamp } },
    relationships: {},
    parties: {},
    friends: {},
    friendRequests: {},
    globalEnabled: true,
    globalEnabledUpdatedAt: stamp,
    revision: 1,
    updatedAt: stamp,
  };
}

async function validateCatalog() {
  const catalog = JSON.parse(await readFile(path.join(root, "games", "index.json"), "utf8"));
  check("catalog: exactly 3,989 entries", catalog.length === 3989, String(catalog.length));
  const slugs = new Set();
  const duplicateSlugs = [];
  const missingFiles = [];

  for (const entry of catalog) {
    const slug = String(entry?.slug || "").trim();
    const file = String(entry?.file || "").replaceAll("/", path.sep);
    if (!slug || slugs.has(slug)) duplicateSlugs.push(slug || "(blank)");
    slugs.add(slug);
    if (!file) {
      missingFiles.push(`${slug}: blank`);
      continue;
    }
    try {
      await access(path.resolve(root, file));
    } catch {
      missingFiles.push(`${slug}: ${entry.file}`);
    }
  }

  check("catalog: unique non-empty slugs", duplicateSlugs.length === 0, duplicateSlugs.slice(0, 8).join(", "));
  check("catalog: every game source exists locally", missingFiles.length === 0, missingFiles.slice(0, 8).join(", "));
}

async function createContext(browser, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  let chatState = emptyChatState();
  let chatVersion = 1;
  const writes = [];
  context.__learningZoneWrites = writes;

  await context.addInitScript(
    ({ ownerId, chatSession }) => {
      localStorage.setItem("ugp_token", `static-firebase:${ownerId}`);
      localStorage.setItem(
        "ugp_session",
        JSON.stringify({ id: ownerId, username: "CarterB", role: "owner", status: "approved" })
      );
      localStorage.setItem("ugp_chat_user", "CarterB");
      localStorage.setItem("ugp_chat_site_link", JSON.stringify({ mode: "site", siteUser: "CarterB" }));
      localStorage.setItem(
        "lz_chat_browser_session_v1",
        JSON.stringify({
          username: "CarterB",
          sessionId: chatSession.sessionId,
          token: chatSession.token,
          expiresAt: chatSession.expiresAt,
        })
      );
    },
    { ownerId, chatSession }
  );

  await context.route("**/.netlify/functions/account-login**", async (route) => {
    const accountRecord = chatState.accounts?.[ownerId] || null;
    await route.fulfill({
      status: accountRecord ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(accountRecord ? { account: accountRecord, credentialMode: "session" } : { error: "Account not found." }),
    });
  });
  await context.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
  await context.route("https://taco-chat-c1539-default-rtdb.firebaseio.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = decodeURIComponent(url.pathname);
    const method = request.method();

    if (method !== "GET") {
      const body = request.postData() || "";
      writes.push({ method, pathname, body, headers: request.headers() });
      if (pathname.endsWith("/rooms/_deluxeAppState/state.json") && (method === "PUT" || method === "PATCH")) {
        const incoming = body ? JSON.parse(body) : null;
        if (method === "PUT") chatState = incoming;
        else chatState = { ...chatState, ...(incoming || {}) };
        chatVersion += 1;
      } else if (pathname.endsWith("/rooms/_deluxeAppState/state/messages.json") && method === "PUT") {
        chatState.messages = body ? JSON.parse(body) : [];
        chatVersion += 1;
      }
      await route.fulfill({
        status: method === "PUT" ? 200 : 204,
        contentType: "application/json",
        headers: { ETag: `"chat-${chatVersion}"`, "Access-Control-Expose-Headers": "ETag" },
        body: method === "PUT" ? JSON.stringify(pathname.endsWith("/messages.json") ? chatState.messages : chatState) : "",
      });
      return;
    }

    let value = null;
    const headers = {};
    const pageMatch = pathname.match(/\/ultimateGameStash\/pages\/(chat|community|gamemaker|party)\.json$/);
    if (pageMatch) value = pageHtml[pageMatch[1]];
    else if (pathname.endsWith("/rooms/_deluxeAppState/state.json")) {
      value = chatState;
      headers.ETag = `"chat-${chatVersion}"`;
      headers["Access-Control-Expose-Headers"] = "ETag";
    } else if (pathname.endsWith("/rooms/_deluxeAppState/state/messages.json")) {
      value = chatState.messages;
      headers.ETag = `"chat-${chatVersion}"`;
      headers["Access-Control-Expose-Headers"] = "ETag";
    } else if (pathname.endsWith(`/accounts/${ownerId}.json`) || pathname.endsWith(`/state/accounts/${ownerId}.json`)) {
      value = chatState.accounts?.[ownerId] || null;
    } else if (pathname.endsWith("/accounts.json") || pathname.endsWith("/state/accounts.json")) {
      value = chatState.accounts || {};
    } else if (pathname.endsWith("/rooms.json")) value = chatState.rooms;
    else if (pathname.endsWith("/presence.json")) value = chatState.presence;
    else if (pathname.endsWith("/messages.json")) value = chatState.messages;
    else if (pathname.endsWith("/relationships.json")) value = {};
    else if (pathname.endsWith("/parties.json")) value = {};
    else if (pathname.endsWith("/suggestions.json")) value = {};
    else if (pathname.endsWith("/globalEnabled.json")) value = true;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify(value),
    });
  });

  return context;
}

function meaningfulConsoleError(message) {
  const text = message.text();
  if (message.type() !== "error") return false;
  if (/Failed to load resource/i.test(text)) return false;
  return !/favicon|ERR_BLOCKED_BY_CLIENT|EventSource's response has a MIME type/i.test(text);
}

async function inspectRoute(context, route, viewportLabel) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (meaningfulConsoleError(message)) consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    const responseUrl = new URL(response.url());
    const siteUrl = new URL(baseUrl);
    if (
      response.status() >= 400 &&
      responseUrl.origin === siteUrl.origin &&
      !/favicon\.(?:ico|png)$/i.test(responseUrl.pathname)
    ) {
      badResponses.push(`${response.status()} ${responseUrl.pathname}`);
    }
  });

  try {
    const response = await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.locator(route.selector).first().waitFor({ state: "attached", timeout: 20_000 });
    const expectedLaunchers = route.launcher === false ? 0 : 1;
    if (expectedLaunchers) {
      await page.locator("#lz-chat-open-button").waitFor({ state: "attached", timeout: 12_000 });
    }
    await page.waitForTimeout(route.path === "/" ? 450 : 180);

    const state = await page.evaluate(() => {
      const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      const main = document.querySelector("main, [role='main'], [data-testid$='-container']");
      const visibleLoading = Array.from(document.querySelectorAll("[aria-busy='true'], [data-testid*='loading'], .loading"))
        .some((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
        });
      return {
        title: document.title,
        path: location.pathname,
        bodyLength: bodyText.length,
        bodyStart: bodyText.slice(0, 240),
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainPresent: Boolean(main),
        visibleLoading,
        launcherCount: document.querySelectorAll("#lz-chat-open-button").length,
        chatSessionPresent: Boolean(localStorage.getItem("lz_chat_browser_session_v1")),
        duplicateIds: Array.from(document.querySelectorAll("[id]"))
          .map((element) => element.id)
          .filter((id, index, all) => id && all.indexOf(id) !== index)
          .slice(0, 8),
      };
    });

    check(`${viewportLabel} ${route.label}: HTTP success`, Boolean(response?.ok()), String(response?.status() || "no response"));
    check(`${viewportLabel} ${route.label}: route preserved`, state.path === route.path, state.path);
    check(`${viewportLabel} ${route.label}: useful page title`, state.title.length > 0, state.title);
    check(`${viewportLabel} ${route.label}: meaningful content`, state.bodyLength > 20, state.bodyStart);
    check(`${viewportLabel} ${route.label}: main landmark`, state.mainPresent, state.bodyStart);
    check(`${viewportLabel} ${route.label}: no horizontal overflow`, state.horizontalOverflow <= 1, String(state.horizontalOverflow));
    check(`${viewportLabel} ${route.label}: no stuck loading surface`, !state.visibleLoading, state.bodyStart);
    check(`${viewportLabel} ${route.label}: no duplicate IDs`, state.duplicateIds.length === 0, state.duplicateIds.join(", "));
    check(`${viewportLabel} ${route.label}: no page exceptions`, pageErrors.length === 0, pageErrors.slice(0, 4).join(" | "));
    check(`${viewportLabel} ${route.label}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 4).join(" | "));
    check(
      `${viewportLabel} ${route.label}: no failed same-origin requests`,
      badResponses.length === 0,
      badResponses.slice(0, 6).join(" | ")
    );
    check(
      `${viewportLabel} ${route.label}: one appropriate chat launcher`,
      state.launcherCount === expectedLaunchers,
      String(state.launcherCount)
    );
    check(
      `${viewportLabel} ${route.label}: chat session preserved`,
      state.chatSessionPresent,
      state.chatSessionPresent ? "" : "lz_chat_browser_session_v1 was cleared"
    );
    if (!state.chatSessionPresent) console.error(`Chat session first missing after ${viewportLabel} ${route.path}`);
  } finally {
    await page.close();
  }
}

async function inspectInteractions(context) {
  let page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const grid = page.locator('[data-testid="games-grid"]');
  await grid.waitFor({ state: "visible", timeout: 20_000 });

  const search = page.locator('[data-testid="search-input"]');
  await search.fill("Retro Bowl");
  await page.locator('a[href="/zone/retro-bowl"]').waitFor({ state: "attached", timeout: 12_000 });
  check("interaction: search finds Retro Bowl", await page.locator('a[href="/zone/retro-bowl"]').count() > 0);

  const save = page.locator('[data-testid="save-game-tile-retro-bowl"]').first();
  if (await save.count()) {
    const writesBefore = context.__learningZoneWrites.length;
    await save.click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="save-game-tile-retro-bowl"]')?.textContent?.trim() === "Saved",
      null,
      { timeout: 8_000 }
    );
    const newWrites = context.__learningZoneWrites.slice(writesBefore);
    const savedWrite = newWrites.find(
      (write) =>
        /\/ultimateGameStash\/savedGames\/carterb\/retro-bowl\.json$/i.test(write.pathname) &&
        /^(?:PUT|PATCH)$/.test(write.method)
    );
    check("interaction: save zone shows selected state", (await save.textContent())?.trim() === "Saved");
    check(
      "interaction: save zone persists to the signed-in account",
      Boolean(savedWrite),
      newWrites.map((write) => `${write.method} ${write.pathname}`).join(" | ")
    );
  } else {
    check("interaction: save zone control is present", false, "Retro Bowl save control not found");
  }

  await page.close();
  page = await context.newPage();
  await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const purpleTheme = page.locator('[data-lz-settings-theme="purple"]');
  await purpleTheme.waitFor({ state: "visible", timeout: 20_000 });
  await purpleTheme.click();
  await page.locator('button[data-lz-settings-value="dark"]').click();
  await page.locator('button[data-lz-settings-value="starfield"]').click();
  const settings = await page.evaluate(() => ({
    theme: document.documentElement.dataset.lzTheme,
    mode: document.documentElement.dataset.lzColorMode,
    background: document.documentElement.dataset.lzBackground,
    storedTheme: JSON.parse(localStorage.getItem("ugp_site_theme") || "null"),
    storedSettings: JSON.parse(localStorage.getItem("ugp_site_settings_v1") || "null"),
  }));
  check("interaction: purple theme applies", settings.theme === "purple", JSON.stringify(settings));
  check("interaction: dark mode applies independently", settings.mode === "dark", JSON.stringify(settings));
  check("interaction: animated background persists", settings.background === "starfield", JSON.stringify(settings));
  check(
    "interaction: appearance preferences persist to storage",
    settings.storedTheme?.theme === "purple" && settings.storedTheme?.colorMode === "dark" && settings.storedSettings?.background === "starfield",
    JSON.stringify(settings)
  );

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.locator('[data-testid="games-grid"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.lzTheme === "purple" &&
      document.documentElement.dataset.lzColorMode === "dark" &&
      document.documentElement.dataset.lzBackground === "starfield",
    null,
    { timeout: 12_000 }
  );
  const synced = await page.evaluate(() => ({
    theme: document.documentElement.dataset.lzTheme,
    mode: document.documentElement.dataset.lzColorMode,
    background: document.documentElement.dataset.lzBackground,
  }));
  check(
    "interaction: appearance syncs back to library",
    synced.theme === "purple" && synced.mode === "dark" && synced.background === "starfield",
    JSON.stringify(synced)
  );

  await page.close();
  page = await context.newPage();
  await page.goto(`${baseUrl}/report-a-bug`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const reportForm = page.locator('[data-testid="bug-report-form"]');
  await reportForm.waitFor({ state: "visible", timeout: 20_000 });
  await page.locator('[data-testid="bug-category"]').selectOption("chat");
  await page.locator('[data-testid="bug-page-input"]').fill("/chat");
  await page.locator('[data-testid="bug-summary-input"]').fill("Chat composer test failure");
  await page.locator('[data-testid="bug-details-input"]').fill("The composer accepted text but did not submit the message.");
  const reportWritesBefore = context.__learningZoneWrites.length;
  await page.locator('[data-testid="bug-submit-btn"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="bug-report-status"]')?.dataset.state === "success",
    null,
    { timeout: 12_000 }
  );
  const reportWrites = context.__learningZoneWrites.slice(reportWritesBefore);
  const reportWrite = reportWrites.find(
    (write) =>
      write.method === "PUT" &&
      /\/ultimateGameStash\/suggestions\/bug_[^/]+\.json$/i.test(write.pathname)
  );
  let reportRecord = null;
  if (reportWrite?.body) reportRecord = JSON.parse(reportWrite.body);
  check(
    "interaction: bug report saves into the owner Suggestions queue",
    reportRecord?.report_type === "bug" &&
      reportRecord?.category === "chat" &&
      reportRecord?.user_id === ownerId &&
      reportRecord?.game_name === "[Bug] Chat composer test failure",
    reportWrite ? `${reportWrite.method} ${reportWrite.pathname}` : "no bug report write"
  );
  check(
    "interaction: bug report confirms success",
    (await page.locator('[data-testid="bug-report-status"]').textContent())?.includes("Report sent"),
    await page.locator('[data-testid="bug-report-status"]').textContent()
  );

  await page.close();
}

async function inspectFullChatSend(context) {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/chat`, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const iframe = page.locator('[data-testid="chat-iframe"]');
  await iframe.waitFor({ state: "attached", timeout: 20_000 });
  const frame = page.frameLocator('[data-testid="chat-iframe"]');
  const input = frame.locator("#message-input");
  const send = frame.locator("#send-btn");
  try {
    await input.waitFor({ state: "visible", timeout: 20_000 });
  } catch (error) {
    const diagnostic = await frame.locator("body").evaluate(() => {
      const app = document.getElementById("app");
      const login = document.getElementById("login");
      const composer = document.querySelector(".composer");
      const messageInput = document.getElementById("message-input");
      const savedSession = JSON.parse(localStorage.getItem("lz_chat_browser_session_v1") || "null");
      const accountRecord = window.__learningZonesChatAccountBridge?.getState?.()?.accounts?.carterb || null;
      return {
        appClass: app?.className || "",
        learningView: app?.dataset.learningView || "",
        loginClass: login?.className || "",
        composerDisplay: composer ? getComputedStyle(composer).display : "missing",
        inputDisplay: messageInput ? getComputedStyle(messageInput).display : "missing",
        savedSessionId: savedSession?.sessionId || "",
        accountSessionIds: Object.keys(accountRecord?.authSessions || {}),
        launchSessionHash: accountRecord?.authSessions?.["launch-smoke-session"]?.hash || "",
        visibleText: document.body.innerText.slice(0, 600),
      };
    });
    console.error("Full chat composer diagnostic:", JSON.stringify(diagnostic, null, 2));
    throw error;
  }
  await input.fill("Full chat launch smoke");
  await send.click();
  await assert.doesNotReject(
    page.waitForFunction(
      () => {
        const frameElement = document.querySelector('[data-testid="chat-iframe"]');
        return frameElement?.contentDocument?.querySelector("#message-input")?.value === "";
      },
      null,
      { timeout: 5_000 }
    )
  );
  await page.waitForTimeout(1_400);

  const writes = context.__learningZoneWrites.filter(
    (write) => write.method === "PUT" && write.pathname.endsWith("/rooms/_deluxeAppState/state.json")
  );
  const latest = writes.at(-1);
  let persisted = null;
  if (latest?.body) persisted = JSON.parse(latest.body);
  check("full chat: send clears the composer", (await input.inputValue()) === "");
  check(
    "full chat: send persists an array-backed message",
    Array.isArray(persisted?.messages) && persisted.messages.some((message) => message.text === "Full chat launch smoke"),
    latest ? `writes=${writes.length}, messages=${persisted?.messages?.length || 0}` : "no Firebase state write"
  );
  await page.close();
}

await validateCatalog();
const browser = await chromium.launch({ headless: true });
try {
  const desktop = await createContext(browser, { width: 1440, height: 900 });
  if (process.env.LZ_SMOKE_CHAT_ONLY !== "1") {
    for (const route of routes) await inspectRoute(desktop, route, "desktop");
    await inspectInteractions(desktop);
  }
  await inspectFullChatSend(desktop);
  await desktop.close();

  if (process.env.LZ_SMOKE_CHAT_ONLY !== "1") {
    const mobile = await createContext(browser, { width: 390, height: 844 });
    for (const route of routes) await inspectRoute(mobile, route, "mobile");
    await mobile.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ passed: failures.length === 0, checks, failures }, null, 2));
if (failures.length) process.exitCode = 1;
