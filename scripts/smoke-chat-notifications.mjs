import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4188";
const userId = "notify_smoke";
const friendId = "study_friend";
const roomId = `dm_${userId}_${friendId}`;
const unrelatedRoomId = "dm_other_people";
const baseline = Date.now() - 20_000;
const desktopScreenshot = path.join(os.tmpdir(), "learningzone-chat-notification-desktop.png");
const overlayScreenshot = path.join(os.tmpdir(), "learningzone-chat-overlay-toolbar.png");
const mobileScreenshot = path.join(os.tmpdir(), "learningzone-chat-notification-mobile.png");
const mobileOverlayScreenshot = path.join(os.tmpdir(), "learningzone-chat-overlay-toolbar-mobile.png");
const immersiveOverlayScreenshot = path.join(os.tmpdir(), "learningzone-chat-overlay-immersive.png");

const account = {
  username: "Notify Smoke",
  role: "user",
  ugpStatus: "approved",
  status: "online",
};
const friend = {
  username: "Study Friend",
  role: "user",
  ugpStatus: "approved",
  status: "online",
};
const rooms = {
  [roomId]: { id: roomId, kind: "dm", members: [userId, friendId], createdAt: baseline - 1_000 },
  [unrelatedRoomId]: { id: unrelatedRoomId, kind: "dm", members: ["other", "person"], createdAt: baseline - 1_000 },
};
const messages = {
  globalUnread: {
    id: "global-unread",
    room: "global",
    user: "Study Friend",
    text: "@notify_smoke the Global room is active",
    time: baseline + 1_000,
  },
  dmUnread: {
    id: "dm-unread",
    room: roomId,
    user: "Study Friend",
    text: "Want to play a strategy zone?",
    time: baseline + 2_000,
  },
  selfAuthored: {
    id: "self-authored",
    room: "global",
    user: "Notify Smoke",
    text: "My own message should not notify me",
    time: baseline + 3_000,
  },
  unrelatedPrivate: {
    id: "unrelated-private",
    room: unrelatedRoomId,
    user: "Other",
    text: "Private content for other accounts",
    time: baseline + 4_000,
  },
};

const browser = await chromium.launch({ headless: true });

async function createContext(viewport, withSeenState = true) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  let remoteMessages = structuredClone(messages);
  let messageVersion = 1;
  const messageWrites = [];
  context.__learningZoneMessageWrites = messageWrites;
  await context.addInitScript(
    ({ userId, roomId, baseline, withSeenState }) => {
      localStorage.setItem("ugp_token", `static-firebase:${userId}`);
      localStorage.setItem(
        "ugp_session",
        JSON.stringify({ id: userId, username: "Notify Smoke", role: "user", status: "approved" })
      );
      if (withSeenState) {
        localStorage.setItem(
          "ugp_chat_notifications_v1",
          JSON.stringify({
            userId,
            initializedAt: baseline,
            allSeenAt: 0,
            globalSeenAt: baseline,
            roomSeenAt: { [roomId]: baseline },
            updatedAt: baseline,
          })
        );
      }
    },
    { userId, roomId, baseline, withSeenState }
  );
  await context.route("**/.netlify/functions/send-chat-message", async (route) => {
    const request = route.request();
    const payload = JSON.parse(request.postData() || "{}");
    const stamp = Date.now();
    const pushKey = `function_push_${messageVersion += 1}`;
    const message = {
      id: `function_message_${messageVersion}`,
      room: payload.roomId || "global",
      user: account.username,
      text: payload.text || "",
      time: stamp,
      createdAt: stamp,
      updatedAt: stamp,
      firebaseKey: pushKey
    };
    remoteMessages = { ...(remoteMessages || {}), [pushKey]: message };
    messageWrites.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
      body: request.postData() || "",
      headers: request.headers(),
      pushKey
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ message })
    });
  });
  await context.route("https://taco-chat-c1539-default-rtdb.firebaseio.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    const method = request.method();

    if (method === "PUT" && path.endsWith("/messages.json")) {
      const headers = request.headers();
      remoteMessages = JSON.parse(request.postData() || "null");
      messageWrites.push({ method, path, body: request.postData() || "", headers });
      messageVersion += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "ETag",
          ETag: `"messages-v${messageVersion}"`,
        },
        body: JSON.stringify(remoteMessages),
      });
      return;
    }

    if (method === "POST" && path.endsWith("/messages.json")) {
      const message = JSON.parse(request.postData() || "null");
      const pushKey = `push_${messageVersion += 1}`;
      remoteMessages = { ...(remoteMessages || {}), [pushKey]: message };
      messageWrites.push({ method, path, body: request.postData() || "", headers: request.headers(), pushKey });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ name: pushKey }),
      });
      return;
    }

    if (method !== "GET") {
      messageWrites.push({ method, path, body: request.postData() || "", headers: request.headers() });
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    let value = null;
    const headers = {};
    if (path.endsWith("/messages.json")) {
      value = remoteMessages;
      headers.ETag = `"messages-v${messageVersion}"`;
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Access-Control-Expose-Headers"] = "ETag";
    }
    else if (path.endsWith("/rooms.json")) value = rooms;
    else if (path.endsWith(`/accounts/${userId}.json`)) value = account;
    else if (path.endsWith(`/accounts/${friendId}.json`)) value = friend;
    else if (path.endsWith("/accounts.json")) value = { [userId]: account, [friendId]: friend };
    else if (path.endsWith("/presence.json")) value = {
      [userId]: { username: "Notify Smoke", lastSeen: Date.now() },
      [friendId]: { username: "Study Friend", lastSeen: Date.now() },
    };
    else if (path.endsWith("/relationships.json")) value = {};
    else if (path.endsWith("/parties.json")) value = {};
    else if (path.endsWith("/globalEnabled.json")) value = true;

    await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(value) });
  });
  return context;
}

async function openHome(context) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('[data-testid="games-grid"]').waitFor({ state: "visible", timeout: 20_000 });
  return { page, pageErrors };
}

try {
  const desktopContext = await createContext({ width: 1440, height: 900 });
  const { page, pageErrors } = await openHome(desktopContext);
  const launcher = page.locator("#lz-chat-open-button");
  const bubble = page.locator('[data-testid="chat-notification-bubble"]');
  const badge = page.locator('[data-testid="chat-notification-count"]');

  await bubble.waitFor({ state: "visible", timeout: 12_000 });
  assert.equal(await page.locator("#lz-chat-open-button").count(), 1, "Only one Chat Overlay launcher may exist.");
  assert.equal(await badge.textContent(), "2");
  await assert.doesNotReject(bubble.getByText("1 Global", { exact: false }).waitFor({ state: "visible" }));
  await assert.doesNotReject(bubble.getByText("1 DM", { exact: false }).waitFor({ state: "visible" }));
  await assert.doesNotReject(bubble.getByText("1 @ mention", { exact: false }).waitFor({ state: "visible" }));
  assert.match(await launcher.getAttribute("aria-label"), /2 unread messages/);

  const desktopLayout = await page.evaluate(() => {
    const button = document.getElementById("lz-chat-open-button")?.getBoundingClientRect();
    const bubble = document.getElementById("lz-chat-notification-bubble")?.getBoundingClientRect();
    if (!button || !bubble) return null;
    const overlaps = !(bubble.right <= button.left || bubble.left >= button.right || bubble.bottom <= button.top || bubble.top >= button.bottom);
    return {
      overlaps,
      bubbleLeft: bubble.left,
      bubbleRight: bubble.right,
      bubbleTop: bubble.top,
      bubbleBottom: bubble.bottom,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });
  assert.ok(desktopLayout && !desktopLayout.overlaps, JSON.stringify(desktopLayout));
  assert.ok(desktopLayout.bubbleLeft >= 0 && desktopLayout.bubbleRight <= desktopLayout.viewportWidth, JSON.stringify(desktopLayout));
  assert.ok(desktopLayout.bubbleTop >= 0 && desktopLayout.bubbleBottom <= desktopLayout.viewportHeight, JSON.stringify(desktopLayout));
  await page.screenshot({ path: desktopScreenshot, fullPage: false });

  await bubble.locator("[data-lz-chat-notification-open]").click();
  await page.locator("#lz-chat-overlay.is-open").waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(
    await page.locator("#lz-whats-happening-card.is-visible").count(),
    0,
    "The What's happening card must not cover an open chat overlay."
  );
  await page.waitForFunction(
    () => /Study Friend/.test(document.querySelector("[data-lz-active-chats]")?.textContent || ""),
    null,
    { timeout: 8_000 }
  );
  const compactSectionState = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll("#lz-chat-overlay .lz-chat-left .lz-chat-panel-section"));
    const read = (title) => {
      const section = sections.find((item) => item.querySelector(".lz-chat-kicker span")?.textContent?.trim() === title);
      return section ? {
        quiet: section.classList.contains("is-quiet-empty"),
        label: section.dataset.lzEmptyLabel || "",
      } : null;
    };
    return {
      party: read("My Party"),
      active: read("Active Chats"),
    };
  });
  assert.deepEqual(compactSectionState.party, { quiet: true, label: "No party yet" });
  assert.deepEqual(compactSectionState.active, { quiet: false, label: "" });
  const overlayGlobalTab = page.locator("#lz-chat-overlay .lz-chat-right [data-lz-message-tab='global']");
  const overlayInput = page.locator("#lz-chat-overlay .lz-chat-message-input");
  const pauseToggle = page.locator("#lz-chat-overlay [data-lz-pause-game]");
  assert.equal(await overlayGlobalTab.count(), 1, "The overlay must expose one Global tab in the composer panel.");
  assert.equal(await pauseToggle.isChecked(), true, "Pause-on-chat should default to enabled.");
  await page.waitForFunction(() => document.activeElement?.matches?.(".lz-chat-message-input"));
  await page.evaluate(() => {
    const overlay = document.getElementById("lz-chat-overlay");
    overlay.dataset.lzMessageMode = "private";
    overlay.dataset.lzPrivateRoom = "dm_stale_room";
  });
  await overlayGlobalTab.click();
  await overlayInput.fill("Global routing smoke test");
  const globalComposerState = await page.evaluate(() => ({
    mode: document.getElementById("lz-chat-overlay")?.dataset.lzMessageMode,
    privateRoom: document.getElementById("lz-chat-overlay")?.dataset.lzPrivateRoom || "",
    title: document.querySelector("[data-lz-current-chat-title]")?.textContent?.replace(/^[^A-Za-z]+/, "").trim(),
    placeholder: document.querySelector(".lz-chat-message-input")?.getAttribute("placeholder"),
    value: document.querySelector(".lz-chat-message-input")?.value,
  }));
  assert.deepEqual(globalComposerState, {
    mode: "global",
    privateRoom: "",
    title: "Global Chat",
    placeholder: "Message Global Chat",
    value: "Global routing smoke test",
  });
  const overlaySendButton = page.locator("#lz-chat-overlay .lz-chat-send");
  assert.equal(await overlaySendButton.isEnabled(), true, "The Global send button must be enabled.");
  const sendHitTarget = await overlaySendButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      button: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      hitTag: hit?.tagName || "",
      hitClass: hit?.getAttribute?.("class") || "",
      hitIsSend: !!hit?.closest?.(".lz-chat-send"),
      pointerEvents: getComputedStyle(button).pointerEvents
    };
  });
  assert.equal(sendHitTarget.hitIsSend, true, `The send button is covered: ${JSON.stringify(sendHitTarget)}`);
  await page.evaluate(() => {
    window.__lzSmokeSendClicks = 0;
    window.__lzSmokeOverlayClicks = 0;
    window.__lzSmokeDocumentClickTarget = "";
    const send = document.querySelector(".lz-chat-send");
    const overlay = document.getElementById("lz-chat-overlay");
    if (send) send.dataset.lzSmokeIdentity = "original-send";
    if (overlay) overlay.dataset.lzSmokeIdentity = "original-overlay";
    send?.addEventListener("click", () => { window.__lzSmokeSendClicks += 1; });
    overlay?.addEventListener("click", (event) => {
      if (event.target.closest?.(".lz-chat-send")) window.__lzSmokeOverlayClicks += 1;
    });
    document.addEventListener("click", (event) => {
      window.__lzSmokeDocumentClickTarget = `${event.target?.tagName || ""}.${event.target?.getAttribute?.("class") || ""}`;
    }, true);
  });
  await overlaySendButton.click();
  try {
    await page.waitForFunction(() => document.querySelector(".lz-chat-message-input")?.value === "", null, { timeout: 8_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      input: document.querySelector(".lz-chat-message-input")?.value || "",
      sendDisabled: document.querySelector(".lz-chat-send")?.disabled || false,
      sendAction: document.querySelector(".lz-chat-send")?.getAttribute("data-lz-action") || "",
      sendClicks: window.__lzSmokeSendClicks || 0,
      overlayClicks: window.__lzSmokeOverlayClicks || 0,
      documentClickTarget: window.__lzSmokeDocumentClickTarget || "",
      sendIdentity: document.querySelector(".lz-chat-send")?.dataset.lzSmokeIdentity || "",
      overlayIdentity: document.getElementById("lz-chat-overlay")?.dataset.lzSmokeIdentity || "",
      note: document.querySelector("[data-lz-overlay-note]")?.textContent || "",
      noteVisible: document.querySelector("[data-lz-overlay-note]")?.classList.contains("is-visible") || false
    }));
    throw new Error(`Overlay send did not finish: ${JSON.stringify({
      diagnostics,
      writes: desktopContext.__learningZoneMessageWrites,
      pageErrors
    })}`, { cause: error });
  }
  await page
    .locator("#lz-chat-overlay .lz-chat-message-text", { hasText: "Global routing smoke test" })
    .waitFor({ state: "visible", timeout: 3_000 });
  const messageWrite = desktopContext.__learningZoneMessageWrites.find(
    (entry) => entry.method === "POST" && entry.path.endsWith("/.netlify/functions/send-chat-message")
  );
  assert.ok(messageWrite, "Sending from the overlay must atomically persist one message.");
  const savedMessage = JSON.parse(messageWrite.body);
  assert.equal(savedMessage.text, "Global routing smoke test");
  assert.equal(savedMessage.roomId, "global");
  assert.equal(
    desktopContext.__learningZoneMessageWrites.some(
      (entry) => entry.method === "PUT" && entry.path.endsWith("/messages.json")
    ),
    false,
    "Overlay sends must not download and rewrite the full message collection."
  );
  const overlayLayout = await page.evaluate(() => {
    const toolbar = document.querySelector(".lz-chat-overlay-head")?.getBoundingClientRect();
    const rightHead = document.querySelector(".lz-chat-right-head")?.getBoundingClientRect();
    if (!toolbar || !rightHead) return null;
    const overlaps = !(
      toolbar.right <= rightHead.left ||
      toolbar.left >= rightHead.right ||
      toolbar.bottom <= rightHead.top ||
      toolbar.top >= rightHead.bottom
    );
    return {
      overlaps,
      toolbarTop: toolbar.top,
      toolbarBottom: toolbar.bottom,
      rightHeadTop: rightHead.top,
      rightHeadBottom: rightHead.bottom,
      verticalGap: rightHead.top - toolbar.bottom,
    };
  });
  assert.ok(overlayLayout && !overlayLayout.overlaps, JSON.stringify(overlayLayout));
  assert.ok(overlayLayout.verticalGap >= 12, JSON.stringify(overlayLayout));
  await page.screenshot({ path: overlayScreenshot, fullPage: false });
  await badge.waitFor({ state: "hidden", timeout: 2_000 });
  await bubble.waitFor({ state: "hidden", timeout: 2_000 });
  const readState = await page.evaluate(() => JSON.parse(localStorage.getItem("ugp_chat_notifications_v1") || "null"));
  assert.equal(readState.userId, userId);
  assert.ok(readState.allSeenAt >= baseline);
  assert.deepEqual(pageErrors, []);
  await desktopContext.close();

  const mobileContext = await createContext({ width: 390, height: 844 });
  const { page: mobilePage, pageErrors: mobileErrors } = await openHome(mobileContext);
  const mobileBubble = mobilePage.locator('[data-testid="chat-notification-bubble"]');
  await mobileBubble.waitFor({ state: "visible", timeout: 12_000 });
  const mobileLayout = await mobileBubble.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(mobileLayout.left >= 0 && mobileLayout.right <= mobileLayout.width, JSON.stringify(mobileLayout));
  assert.ok(mobileLayout.top >= 0 && mobileLayout.bottom <= mobileLayout.height, JSON.stringify(mobileLayout));
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: false });
  await mobileBubble.locator("[data-lz-chat-notification-open]").click();
  await mobilePage.locator("#lz-chat-overlay.is-open").waitFor({ state: "visible", timeout: 5_000 });
  const mobileOverlayLayout = await mobilePage.evaluate(() => {
    const toolbar = document.querySelector(".lz-chat-overlay-head")?.getBoundingClientRect();
    const panel = document.querySelector(".lz-chat-right")?.getBoundingClientRect();
    const tools = document.querySelector(".lz-chat-left")?.getBoundingClientRect();
    if (!toolbar || !panel) return null;
    const overlaps = !(
      toolbar.right <= panel.left ||
      toolbar.left >= panel.right ||
      toolbar.bottom <= panel.top ||
      toolbar.top >= panel.bottom
    );
    return {
      overlaps,
      toolbarTop: toolbar.top,
      toolbarBottom: toolbar.bottom,
      panelTop: panel.top,
      panelBottom: panel.bottom,
      panelWidth: panel.width,
      panelHeight: panel.height,
      toolsWidth: tools?.width || 0,
    };
  });
  assert.ok(mobileOverlayLayout && !mobileOverlayLayout.overlaps, JSON.stringify(mobileOverlayLayout));
  assert.ok(mobileOverlayLayout.panelWidth > 0 && mobileOverlayLayout.panelHeight > 0, JSON.stringify(mobileOverlayLayout));
  assert.equal(mobileOverlayLayout.toolsWidth, 0, JSON.stringify(mobileOverlayLayout));
  const mobileToolsToggle = mobilePage.locator("[data-lz-chat-mobile-panel]");
  await mobileToolsToggle.click();
  const mobileToolsState = await mobilePage.evaluate(() => ({
    toolsOpen: document.getElementById("lz-chat-overlay")?.classList.contains("is-tools-open"),
    toolsWidth: document.querySelector(".lz-chat-left")?.getBoundingClientRect().width || 0,
    chatWidth: document.querySelector(".lz-chat-right")?.getBoundingClientRect().width || 0,
  }));
  assert.equal(mobileToolsState.toolsOpen, true);
  assert.ok(mobileToolsState.toolsWidth > 0, JSON.stringify(mobileToolsState));
  assert.equal(mobileToolsState.chatWidth, 0, JSON.stringify(mobileToolsState));
  await mobilePage.screenshot({ path: mobileOverlayScreenshot, fullPage: false });
  assert.deepEqual(mobileErrors, []);
  await mobileContext.close();

  const immersiveContext = await createContext({ width: 1280, height: 800 });
  const immersivePage = await immersiveContext.newPage();
  const immersiveErrors = [];
  immersivePage.on("pageerror", (error) => immersiveErrors.push(error.message));
  await immersivePage.goto(`${baseUrl}/zone/retro-bowl`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  const gameFrame = immersivePage.locator('[data-testid="game-iframe"]');
  await gameFrame.waitFor({ state: "visible", timeout: 20_000 });
  await immersivePage.locator("#lz-chat-open-button").click();
  await immersivePage.locator("#lz-chat-overlay.is-open").waitFor({ state: "visible", timeout: 5_000 });
  assert.ok(await gameFrame.evaluate((frame) => frame.classList.contains("lz-chat-game-paused")));
  await immersivePage.waitForFunction(() => document.activeElement?.matches?.(".lz-chat-message-input"));
  const immersivePauseToggle = immersivePage.locator("#lz-chat-overlay [data-lz-pause-game]");
  const immersivePauseSwitch = immersivePage.locator("#lz-chat-overlay .lz-chat-pause-switch");
  await immersivePauseSwitch.click();
  assert.equal(await immersivePauseToggle.isChecked(), false);
  await immersivePage.waitForFunction(() => {
    const frame = document.querySelector('[data-testid="game-iframe"]');
    return frame &&
      !frame.classList.contains("lz-chat-game-paused") &&
      document.activeElement === frame &&
      localStorage.getItem("lz_pause_zone_on_chat_open_v1") === "false";
  });
  await immersivePauseSwitch.click();
  assert.equal(await immersivePauseToggle.isChecked(), true);
  await immersivePage.waitForFunction(() => {
    const frame = document.querySelector('[data-testid="game-iframe"]');
    return frame &&
      frame.classList.contains("lz-chat-game-paused") &&
      localStorage.getItem("lz_pause_zone_on_chat_open_v1") === "true";
  });
  await immersivePage.locator("[data-lz-chat-close]").click();
  await immersivePage.waitForFunction(() => !document.querySelector('[data-testid="game-iframe"]')?.classList.contains("lz-chat-game-paused"));
  await immersivePage.waitForFunction(() => document.activeElement?.matches?.('[data-testid="game-iframe"]'));
  await immersivePage.locator('[data-testid="immersive-btn"]').click();
  await immersivePage.locator('[data-testid="exit-immersive-btn"]').waitFor({ state: "visible", timeout: 5_000 });
  await immersivePage.locator("#lz-chat-open-button").waitFor({ state: "visible", timeout: 5_000 });
  const immersiveLauncherLayout = await immersivePage.evaluate(() => {
    const launcher = document.getElementById("lz-chat-open-button")?.getBoundingClientRect();
    const exit = document.querySelector('[data-testid="exit-immersive-btn"]')?.getBoundingClientRect();
    if (!launcher || !exit) return null;
    const overlaps = !(
      launcher.right <= exit.left ||
      launcher.left >= exit.right ||
      launcher.bottom <= exit.top ||
      launcher.top >= exit.bottom
    );
    return {
      overlaps,
      launcherTop: launcher.top,
      launcherBottom: launcher.bottom,
      exitTop: exit.top,
      exitBottom: exit.bottom,
    };
  });
  assert.ok(immersiveLauncherLayout && !immersiveLauncherLayout.overlaps, JSON.stringify(immersiveLauncherLayout));
  assert.ok(immersiveLauncherLayout.launcherTop >= immersiveLauncherLayout.exitBottom + 10, JSON.stringify(immersiveLauncherLayout));
  await immersivePage.locator("#lz-chat-open-button").click();
  await immersivePage.locator("#lz-chat-overlay.is-open").waitFor({ state: "visible", timeout: 5_000 });
  const immersiveOverlayState = await immersivePage.evaluate(() => {
    const toolbar = document.querySelector(".lz-chat-overlay-head")?.getBoundingClientRect();
    const panelHead = document.querySelector(".lz-chat-right-head")?.getBoundingClientRect();
    const overlaps = toolbar && panelHead ? !(
      toolbar.right <= panelHead.left ||
      toolbar.left >= panelHead.right ||
      toolbar.bottom <= panelHead.top ||
      toolbar.top >= panelHead.bottom
    ) : true;
    return {
      fullscreenActive: document.documentElement.dataset.lzFullscreenActive,
      host: document.documentElement.dataset.lzChatOverlayHost,
      overlayVisible: document.getElementById("lz-chat-overlay")?.getBoundingClientRect().width > 0,
      panelVisible: document.querySelector(".lz-chat-right")?.getBoundingClientRect().width > 0,
      toolbarOverlapsPanel: overlaps,
      toolbarTop: toolbar?.top || 0,
      toolbarBottom: toolbar?.bottom || 0,
      panelTop: panelHead?.top || 0,
      verticalGap: panelHead && toolbar ? panelHead.top - toolbar.bottom : -1,
    };
  });
  assert.equal(immersiveOverlayState.fullscreenActive, "true", JSON.stringify(immersiveOverlayState));
  assert.equal(immersiveOverlayState.host, "page", JSON.stringify(immersiveOverlayState));
  assert.equal(immersiveOverlayState.overlayVisible, true, JSON.stringify(immersiveOverlayState));
  assert.equal(immersiveOverlayState.panelVisible, true, JSON.stringify(immersiveOverlayState));
  assert.equal(immersiveOverlayState.toolbarOverlapsPanel, false, JSON.stringify(immersiveOverlayState));
  assert.ok(immersiveOverlayState.verticalGap >= 10, JSON.stringify(immersiveOverlayState));
  await immersivePage.screenshot({ path: immersiveOverlayScreenshot, fullPage: false });
  assert.deepEqual(immersiveErrors, []);
  await immersiveContext.close();

  const baselineContext = await createContext({ width: 1280, height: 800 }, false);
  const { page: baselinePage, pageErrors: baselineErrors } = await openHome(baselineContext);
  await baselinePage.waitForFunction(() => Boolean(window.learningZonesChatSync?.notifications?.state), null, { timeout: 10_000 });
  await baselinePage.evaluate(() => window.learningZonesChatSync.notifications.refresh());
  const baselineCounts = await baselinePage.evaluate(() => window.learningZonesChatSync.notifications.state().counts);
  assert.deepEqual(baselineCounts, { global: 0, direct: 0, mentions: 0, total: 0 });
  assert.equal(await baselinePage.locator('[data-testid="chat-notification-bubble"]:visible').count(), 0);
  assert.deepEqual(baselineErrors, []);
  await baselineContext.close();

  console.log(JSON.stringify({
    passed: true,
    unread: { global: 1, direct: 1, mentions: 1, total: 2 },
    desktopLayout,
    overlayLayout,
    globalComposerState,
    mobileLayout,
    mobileOverlayLayout,
    mobileToolsState,
    immersiveLauncherLayout,
    immersiveOverlayState,
    baselineProtected: true,
    screenshots: {
      desktop: desktopScreenshot,
      overlay: overlayScreenshot,
      mobile: mobileScreenshot,
      mobileOverlay: mobileOverlayScreenshot,
      immersiveOverlay: immersiveOverlayScreenshot,
    },
  }, null, 2));
} finally {
  await browser.close();
}
