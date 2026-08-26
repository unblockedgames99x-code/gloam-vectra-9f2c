import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const baseUrl = globalThis.process?.argv?.[2] || "http://127.0.0.1:4188";
const chatHtml = await readFile(path.join(root, "pages", "chat_html.html"), "utf8");
const firebaseOrigin = "https://taco-chat-c1539-default-rtdb.firebaseio.com";
const statePath = "/rooms/_deluxeAppState/state";
const username = "LinkSmoke";
const userKey = username.toLowerCase();
const password = "LinkSmoke-Test-Password!";
const wrongPassword = "Definitely-Wrong-Password!";

function emptyChatState() {
  const createdAt = Date.now() - 60_000;
  return {
    accounts: {},
    rooms: {
      global: {
        id: "global",
        name: "Global Chat",
        kind: "room",
        members: [],
        unread: {},
        createdAt,
        updatedAt: createdAt,
      },
    },
    messages: [],
    presence: {},
    relationships: {},
    parties: {},
    friends: {},
    friendRequests: {},
    deletedAccounts: {},
    browserBans: {},
    globalEnabled: true,
    revision: 1,
    updatedAt: createdAt,
  };
}

function jsonResponse(value, extraHeaders = {}) {
  return {
    status: 200,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "ETag",
      ...extraHeaders,
    },
    body: JSON.stringify(value),
  };
}

function accountPathKey(pathname) {
  const match = pathname.match(new RegExp(`${statePath}/accounts/([^/]+)\\.json$`, "i"));
  return match ? decodeURIComponent(match[1]).toLowerCase() : "";
}

async function installChatFirebaseMock(context, holder) {
  await context.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
  await context.route(`${firebaseOrigin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = decodeURIComponent(url.pathname);
    const method = request.method();
    const pageMatch = pathname.match(/\/ultimateGameStash\/pages\/chat\.json$/i);

    if (pageMatch && method === "GET") {
      await route.fulfill(jsonResponse(chatHtml));
      return;
    }

    if (method === "GET") {
      const lookupKey = accountPathKey(pathname);
      if (lookupKey) {
        await route.fulfill(jsonResponse(holder.state.accounts?.[lookupKey] || null));
        return;
      }
      if (pathname.endsWith(`${statePath}.json`)) {
        await route.fulfill(jsonResponse(holder.state, { ETag: `"chat-${holder.version}"` }));
        return;
      }
      const child = pathname.match(new RegExp(`${statePath}/([^/]+)\\.json$`, "i"))?.[1];
      await route.fulfill(jsonResponse(child ? holder.state[child] ?? null : null));
      return;
    }

    const body = request.postData() ? JSON.parse(request.postData()) : null;
    holder.writes.push({ method, pathname, body });
    const lookupKey = accountPathKey(pathname);
    if (lookupKey && (method === "PUT" || method === "PATCH")) {
      holder.state.accounts ||= {};
      holder.state.accounts[lookupKey] =
        method === "PATCH"
          ? { ...(holder.state.accounts[lookupKey] || {}), ...(body || {}) }
          : body;
    } else if (pathname.endsWith(`${statePath}.json`) && (method === "PUT" || method === "PATCH")) {
      holder.state = method === "PATCH" ? { ...holder.state, ...(body || {}) } : body;
    }
    holder.version += 1;
    await route.fulfill(jsonResponse(body, { ETag: `"chat-${holder.version}"` }));
  });
}

async function waitForSavedAccount(holder) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8_000) {
    const record = holder.state.accounts?.[userKey];
    if (record?.passwordHash && Object.keys(record.authSessions || {}).length) return record;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the linked chat account to persist.");
}

async function inspectChatFrameFlow(browser) {
  const holder = { state: emptyChatState(), version: 1, writes: [] };
  const offlineKey = "offlinesmoke";
  holder.state.accounts[offlineKey] = {
    username: "OfflineSmoke",
    role: "member",
    status: "online",
    mood: "Social",
    lastActive: Date.now() - 10 * 60_000,
    lastSeen: Date.now() - 10 * 60_000,
  };
  holder.state.rooms.global.members.push(offlineKey);
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  await installChatFirebaseMock(context, holder);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto(`${baseUrl}/page-embed.html?page=chat&embed=overlay`, {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await page.waitForFunction(() => Boolean(window.learningZonesSecureChatLink), null, { timeout: 20_000 });
  await page.evaluate(
    ({ username, password }) =>
      window.learningZonesSecureChatLink.accept({
        type: "learning-zones-chat-login",
        version: 2,
        mode: "site",
        force: true,
        username,
        siteUsername: username,
        password,
      }),
    { username, password }
  );
  try {
  await page.locator("#app:not(.hidden)").waitFor({ state: "visible", timeout: 15_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      loginError: document.querySelector("#auth-error")?.textContent || "",
      authError: document.querySelector("#auth-error")?.textContent || "",
      loginClass: document.querySelector("#login")?.className || "",
      appClass: document.querySelector("#app")?.className || "",
      bodyStart: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 500),
      secureHelper: Boolean(window.learningZonesSecureChatLink),
    }));
    throw new Error(
      `Chat account creation did not open the app. diagnostics=${JSON.stringify(diagnostics)} ` +
      `pageErrors=${JSON.stringify(pageErrors)} console=${JSON.stringify(consoleErrors.slice(-12))}`,
      { cause: error }
    );
  }

  assert.equal(
    await page.locator(".quick-action-row").count(),
    0,
    "The removed Chat quick-action strip must not return."
  );
  const offlineDot = page.locator(`[data-view-profile="${offlineKey}"] .status-dot`);
  await offlineDot.waitFor({ state: "visible", timeout: 5_000 });
  assert.match(await offlineDot.getAttribute("class"), /\boff\b/, "A stale account must render as offline.");
  assert.equal(await offlineDot.getAttribute("aria-label"), "Offline");
  assert.equal(
    await offlineDot.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(217, 75, 75)",
    "The offline presence light must render red."
  );

  const createdAccount = await waitForSavedAccount(holder);
  assert.equal(createdAccount.username, username, "The generated chat account must preserve the site username.");
  assert.equal(createdAccount.password, "", "The chat account must not store a plaintext password.");
  assert.ok(createdAccount.passwordHash?.hash, "The generated chat account must store a password hash.");
  assert.equal(createdAccount.linkedFromSite, true, "The generated account must be marked as site-linked.");
  assert.ok(
    Object.values(createdAccount.authSessions || {}).every((session) => /^[a-f0-9]{64}$/i.test(session.hash || "")),
    "Only hashed browser session tokens may be stored with the account."
  );
  assert.ok(createdAccount.browserIds?.length, "The linked account should be associated with the current browser.");
  assert.ok(holder.state.rooms.global.members.includes(userKey), "The linked account must join Global Chat.");

  const createdPasswordHash = JSON.stringify(createdAccount.passwordHash);
  const browserSession = await page.evaluate(() => {
    const raw = localStorage.getItem(window.learningZonesSecureChatLink.sessionKey);
    return raw ? JSON.parse(raw) : null;
  });
  assert.equal(browserSession.username, username, "A returning-browser session should be issued.");
  assert.ok(browserSession.token?.length >= 64, "The browser should retain a strong raw session token locally.");
  assert.ok(
    !(await page.evaluate((secret) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret), password)),
    "The site password must not be written to browser storage."
  );

  await page.evaluate(() => localStorage.removeItem(window.learningZonesSecureChatLink.sessionKey));
  await page.evaluate((username) =>
    window.learningZonesSecureChatLink.accept({
      type: "learning-zones-chat-login",
      version: 2,
      mode: "site",
      force: true,
      username,
      siteUsername: username,
      password: "",
    }), username);
  await page.locator("#login:not(.hidden)").waitFor({ state: "visible", timeout: 10_000 });
  assert.match(
    (await page.locator("#auth-error").textContent()) || "",
    /do not need to sign out/i,
    "An existing site session must offer an in-place password link instead of requiring sign-out."
  );
  await page.locator("#login-pass").fill(password);
  await page.locator("#login-btn").click();
  await page.locator("#app:not(.hidden)").waitFor({ state: "visible", timeout: 12_000 });
  const relinkedSession = await page.evaluate(() => {
    const raw = localStorage.getItem(window.learningZonesSecureChatLink.sessionKey);
    return raw ? JSON.parse(raw) : null;
  });
  assert.equal(relinkedSession?.username, username, "The in-place password link must issue a browser session.");
  assert.ok(
    !(await page.evaluate((secret) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret), password)),
    "The in-place link must not persist the site password."
  );

  await page.evaluate(() => localStorage.removeItem(window.learningZonesSecureChatLink.sessionKey));
  await page.evaluate(
    ({ username, wrongPassword }) =>
      window.learningZonesSecureChatLink.accept({
        type: "learning-zones-chat-login",
        version: 2,
        mode: "site",
        force: true,
        username,
        siteUsername: username,
        password: wrongPassword,
      }),
    { username, wrongPassword }
  );
  await page.locator("#login:not(.hidden)").waitFor({ state: "visible", timeout: 10_000 });
  const collisionMessage = await page.locator("#auth-error").textContent();
  assert.match(collisionMessage || "", /passwords do not match/i, "A collision must explain the credential mismatch.");
  assert.match(collisionMessage || "", /unblockedgames99x@gmail\.com/i, "A collision must include the support address.");
  assert.match(collisionMessage || "", /was not deleted/i, "A collision must state that the existing account was preserved.");
  assert.equal(
    JSON.stringify(holder.state.accounts[userKey].passwordHash),
    createdPasswordHash,
    "A conflicting site login must not overwrite or delete the existing chat account."
  );

  await page.evaluate(
    ({ username, password }) =>
      window.learningZonesSecureChatLink.accept({
        type: "learning-zones-chat-login",
        version: 2,
        mode: "site",
        force: true,
        username,
        siteUsername: username,
        password,
      }),
    { username, password }
  );
  await page.locator("#app:not(.hidden)").waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(
    JSON.stringify(holder.state.accounts[userKey].passwordHash),
    createdPasswordHash,
    "A matching login must reuse the existing account instead of replacing its password."
  );

  const sessionBeforeReload = await page.evaluate(() => {
    const raw = localStorage.getItem(window.learningZonesSecureChatLink.sessionKey);
    return raw ? JSON.parse(raw) : null;
  });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.waitForFunction(() => Boolean(window.learningZonesSecureChatLink), null, { timeout: 20_000 });
  await page.evaluate((username) =>
    window.learningZonesSecureChatLink.accept({
      type: "learning-zones-chat-login",
      version: 2,
      mode: "site",
      force: true,
      username,
      siteUsername: username,
      password: "",
    }), username);
  await page.locator("#app:not(.hidden)").waitFor({ state: "visible", timeout: 10_000 });
  const sessionAfterReload = await page.evaluate(() => {
    const raw = localStorage.getItem(window.learningZonesSecureChatLink.sessionKey);
    return raw ? JSON.parse(raw) : null;
  });
  assert.equal(
    sessionAfterReload?.token,
    sessionBeforeReload?.token,
    "A valid returning session must be reused instead of rotating before cloud persistence completes."
  );
  assert.deepEqual(pageErrors, [], `The chat account flow raised page errors: ${pageErrors.join(" | ")}`);

  await context.close();
  return {
    writes: holder.writes.length,
    accountCreated: Boolean(holder.state.accounts?.[userKey]),
    returningSession: true,
    collisionPreserved: true,
  };
}

async function inspectParentCredentialHandoff(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await context.route(`${baseUrl}/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html>
        <html>
          <head><meta charset="utf-8"><title>Login probe</title></head>
          <body>
            <form data-testid="login-form">
              <label>Username <input data-testid="username-input" name="username" autocomplete="username"></label>
              <label>Password <input data-testid="password-input" type="password" autocomplete="current-password"></label>
              <button data-testid="login-submit" type="submit">Sign in</button>
            </form>
            <iframe data-testid="chat-iframe" src="/chat-link-capture.html"></iframe>
            <script>
              document.querySelector("form").addEventListener("submit", event => event.preventDefault());
            </script>
            <script src="/chat-site-sync.js?v=account-link-smoke"></script>
          </body>
        </html>`,
    });
  });
  await context.route(`${baseUrl}/chat-link-capture.html`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html><body><script>
        window.received = [];
        addEventListener("message", event => window.received.push(event.data));
      </script></body></html>`,
    });
  });
  await context.route(`${firebaseOrigin}/**`, async (route) => {
    if (route.request().method() === "GET") await route.fulfill(jsonResponse(null));
    else await route.fulfill(jsonResponse(null));
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction(() => Boolean(window.learningZonesChatSync), null, { timeout: 15_000 });
  await page.locator('[data-testid="username-input"]').fill(username);
  await page.locator('[data-testid="password-input"]').fill(password);
  await page.locator('[data-testid="login-submit"]').click();
  await page.evaluate((username) => {
    localStorage.setItem(
      "ugp_session",
      JSON.stringify({ id: username.toLowerCase(), username, role: "user", status: "approved" })
    );
  }, username);

  const frame = page.frame({ url: /chat-link-capture\.html/ });
  assert.ok(frame, "The credential-capture frame should load.");
  await frame.waitForFunction(
    ({ username, password }) =>
      window.received.some(
        (message) =>
          message?.type === "learning-zones-chat-login" &&
          message.username === username &&
          message.password === password
      ),
    { username, password },
    { timeout: 8_000 }
  );
  const payload = await frame.evaluate(
    ({ username, password }) =>
      window.received.find(
        (message) =>
          message?.type === "learning-zones-chat-login" &&
          message.username === username &&
          message.password === password
      ),
    { username, password }
  );
  assert.equal(payload.version, 2, "The parent must send the authenticated account-link protocol.");
  assert.equal(payload.mode, "site", "The captured site credential must only be used for site-link mode.");
  assert.ok(
    !(await page.evaluate((secret) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret), password)),
    "The parent must keep the captured site password out of browser storage."
  );

  await frame.evaluate(
    ({ username }) =>
      parent.postMessage(
        {
          type: "learning-zones-chat-link-result",
          status: "ready",
          username,
          message: "Chat account verified and linked to your site login.",
        },
        location.origin
      ),
    { username }
  );
  await page.waitForFunction(
    (username) => {
      const value = JSON.parse(localStorage.getItem("ugp_chat_site_link") || "null");
      return value?.linkStatus === "ready" && value?.chatUsername === username;
    },
    username,
    { timeout: 5_000 }
  );

  await context.close();
  return { protocolVersion: payload.version, passwordPersisted: false };
}

async function inspectLegacyLinkedAccountUpgrade(browser) {
  const holder = { state: emptyChatState(), version: 1, writes: [] };
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await installChatFirebaseMock(context, holder);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/page-embed.html?page=chat&embed=overlay`, {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await page.waitForFunction(() => Boolean(window.learningZonesSecureChatLink), null, { timeout: 20_000 });
  const browserId = await page.evaluate(() => window.__learningZonesChatAccountBridge.browserId);
  const legacyAccount = {
    username,
    password: "",
    role: "member",
    status: "online",
    browserId,
    lastBrowserId: browserId,
    browserIds: [browserId],
    createdAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 86_400_000,
  };
  holder.state.accounts[userKey] = structuredClone(legacyAccount);
  await page.evaluate(
    ({ userKey, legacyAccount }) => {
      const bridge = window.__learningZonesChatAccountBridge;
      const state = bridge.getState();
      state.accounts[userKey] = legacyAccount;
      bridge.setState(bridge.normalize(state));
    },
    { userKey, legacyAccount }
  );
  await page.evaluate(
    ({ username, password }) =>
      window.learningZonesSecureChatLink.accept({
        type: "learning-zones-chat-login",
        version: 2,
        mode: "site",
        force: true,
        username,
        siteUsername: username,
        password,
      }),
    { username, password }
  );
  await page.locator("#app:not(.hidden)").waitFor({ state: "visible", timeout: 12_000 });
  const upgraded = await page.evaluate(
    (userKey) => window.__learningZonesChatAccountBridge.getState().accounts[userKey],
    userKey
  );
  assert.ok(upgraded.passwordHash?.hash, "A passwordless legacy link on the same browser must gain a secure hash.");
  assert.equal(upgraded.password, "", "The legacy upgrade must not retain the plaintext password.");
  assert.equal(upgraded.linkedFromSite, true, "The upgraded account must be marked as linked from the site.");
  await context.close();
  return { upgraded: true, passwordHashed: true };
}

const systemChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {})
});
try {
  const frameFlow = await inspectChatFrameFlow(browser);
  const parentFlow = await inspectParentCredentialHandoff(browser);
  const legacyFlow = await inspectLegacyLinkedAccountUpgrade(browser);
  console.log(JSON.stringify({ passed: true, frameFlow, parentFlow, legacyFlow }, null, 2));
} finally {
  await browser.close();
}
