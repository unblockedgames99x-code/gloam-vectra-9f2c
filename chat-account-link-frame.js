(() => {
  "use strict";

  if (window.__learningZonesSecureChatLink) return;
  window.__learningZonesSecureChatLink = true;

  const SESSION_KEY = "lz_chat_browser_session_v1";
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const SESSION_LIMIT = 5;
  const SUPPORT_EMAIL = "unblockedgames99x@gmail.com";
  const PROFILE_MEDIA_SYNC_TYPE = "learning-zones-profile-media";
  const PROFILE_MEDIA_UPDATE_TYPE = "learning-zones-profile-media-update";
  const TYPING_ROOT_PATH = "rooms/_deluxeAppState/typing";
  const TYPING_ACTIVE_MS = 6000;
  const TYPING_PUBLISH_INTERVAL_MS = 900;
  const TYPING_IDLE_MS = 2800;
  const bridge = window.__learningZonesChatAccountBridge;
  const LINK_PASSWORD_MIN_LENGTH = Number(bridge?.passwordMinLength || 8);
  let linkRequestId = 0;
  let manualSessionTimer = 0;
  let pendingSiteLinkPayload = null;
  let waitingForSiteLinkPassword = false;

  if (!bridge) {
    console.error("Secure chat account linking could not start because the chat bridge is unavailable.");
    return;
  }

  function cleanKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  }

  function stamp() {
    return Date.now();
  }

  function readSession() {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function writeSession(value) {
    try {
      if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else localStorage.removeItem(SESSION_KEY);
    } catch (error) {}
  }

  function clearSession(username = "") {
    const current = readSession();
    if (!username || !current || cleanKey(current.username) === cleanKey(username)) writeSession(null);
  }

  function randomToken(byteLength = 32) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function pruneSessions(accountRecord) {
    const cutoff = stamp();
    const sessions = accountRecord?.authSessions && typeof accountRecord.authSessions === "object"
      ? accountRecord.authSessions
      : {};
    const valid = Object.entries(sessions)
      .filter(([, session]) => session && Number(session.expiresAt || 0) > cutoff && /^[a-f0-9]{64}$/i.test(String(session.hash || "")))
      .sort((a, b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0))
      .slice(0, SESSION_LIMIT);
    accountRecord.authSessions = Object.fromEntries(valid);
    return accountRecord.authSessions;
  }

  async function issueSession(accountRecord) {
    if (!accountRecord || !window.crypto?.subtle || !crypto.getRandomValues) return false;
    const token = randomToken(32);
    const sessionId = randomToken(10);
    const createdAt = stamp();
    const expiresAt = createdAt + SESSION_TTL_MS;
    const sessions = pruneSessions(accountRecord);
    sessions[sessionId] = {
      hash: await sha256(token),
      createdAt,
      expiresAt,
      browserId: bridge.browserId || ""
    };
    pruneSessions(accountRecord);
    writeSession({ username: accountRecord.username, sessionId, token, expiresAt });
    accountRecord.authSessionsUpdatedAt = createdAt;
    accountRecord.updatedAt = Math.max(Number(accountRecord.updatedAt || 0), createdAt);
    return true;
  }

  async function verifyStoredSession(accountRecord, username) {
    const saved = readSession();
    if (!saved || cleanKey(saved.username) !== cleanKey(username) || Number(saved.expiresAt || 0) <= stamp()) {
      clearSession(username);
      return false;
    }
    const sessions = pruneSessions(accountRecord);
    const record = sessions[String(saved.sessionId || "")];
    if (!record || Number(record.expiresAt || 0) <= stamp()) {
      clearSession(username);
      return false;
    }
    const tokenHash = await sha256(saved.token || "");
    const matches = typeof bridge.constantTimeEqual === "function"
      ? bridge.constantTimeEqual(tokenHash, record.hash)
      : tokenHash === record.hash;
    if (!matches) clearSession(username);
    return matches;
  }

  function notifyParent(status, username, message, extra = {}) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "learning-zones-chat-link-result",
          status,
          username,
          message,
          ...extra
        }, location.origin);
      }
    } catch (error) {}
  }

  function safeProfileImage(value) {
    const source = String(value || "").trim();
    return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(source) ? source : "";
  }

  function safeProfileColor(value, fallback = "#2d3039") {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function profileMediaStamp(source = {}) {
    return Math.max(
      0,
      Number(source.profileMediaUpdatedAt || 0),
      Number(source.mediaUpdatedAt || 0)
    );
  }

  function profileMediaSignature(accountRecord = {}) {
    const avatar = String(accountRecord.avatar || "");
    const bannerImage = String(accountRecord.profileBannerImage || "");
    return [
      `${avatar.length}:${avatar.slice(0, 24)}:${avatar.slice(-12)}`,
      String(accountRecord.profileBanner || "solid"),
      safeProfileColor(accountRecord.profileBannerColor),
      `${bannerImage.length}:${bannerImage.slice(0, 24)}:${bannerImage.slice(-12)}`
    ].join("|");
  }

  function profileMediaPayload(accountRecord = {}) {
    return {
      avatar: safeProfileImage(accountRecord.avatar),
      banner: String(accountRecord.profileBanner || "solid"),
      bannerColor: safeProfileColor(accountRecord.profileBannerColor),
      bannerImage: safeProfileImage(accountRecord.profileBannerImage),
      mediaUpdatedAt: profileMediaStamp(accountRecord),
      updatedAt: Number(accountRecord.updatedAt || 0)
    };
  }

  function notifyParentProfileMedia(accountRecord) {
    if (!accountRecord) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: PROFILE_MEDIA_UPDATE_TYPE,
          version: 1,
          username: accountRecord.username || bridge.getMe(),
          profile: profileMediaPayload(accountRecord)
        }, location.origin);
      }
    } catch (error) {}
  }

  function applyParentProfileMedia(payload = {}) {
    const username = cleanKey(payload.username || "");
    const activeUsername = cleanKey(bridge.getMe() || "");
    if (!username || !activeUsername || username !== activeUsername) return false;

    const state = bridge.getState();
    const accountRecord = state?.accounts?.[username] || bridge.account();
    if (!accountRecord) return false;

    const incoming = payload.profile && typeof payload.profile === "object" ? payload.profile : {};
    const incomingStamp = profileMediaStamp(incoming);
    const currentStamp = profileMediaStamp(accountRecord);
    if (incomingStamp && currentStamp && incomingStamp < currentStamp) return false;

    if (Object.prototype.hasOwnProperty.call(incoming, "avatar")) {
      accountRecord.avatar = safeProfileImage(incoming.avatar) || "\uD83C\uDF2E";
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "banner")) {
      const banner = String(incoming.banner || "").toLowerCase();
      accountRecord.profileBanner = ["solid", "taco", "neon", "galaxy", "ocean", "none"].includes(banner)
        ? banner
        : "solid";
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "bannerColor")) {
      accountRecord.profileBannerColor = safeProfileColor(incoming.bannerColor);
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "bannerImage")) {
      accountRecord.profileBannerImage = safeProfileImage(incoming.bannerImage);
    }

    const appliedAt = incomingStamp || stamp();
    accountRecord.profileMediaUpdatedAt = Math.max(currentStamp, appliedAt);
    accountRecord.updatedAt = Math.max(Number(accountRecord.updatedAt || 0), appliedAt);
    if (typeof bridge.normalizeProfileFields === "function") {
      bridge.normalizeProfileFields(accountRecord, appliedAt);
    }
    bridge.save();
    if (typeof bridge.render === "function") bridge.render();
    return true;
  }

  const fullChatTyping = {
    root: null,
    roomRef: null,
    room: "",
    roomListener: null,
    lastSnapshot: {},
    expiryTimer: 0,
    publishTimer: 0,
    idleTimer: 0,
    restPollTimer: 0,
    lastPublishedAt: 0,
    publishedRoom: "",
    installed: false
  };

  function firebasePathKey(value, fallback = "global") {
    const clean = String(value || "").trim().replace(/[.#$\[\]/]+/g, "_").slice(0, 120);
    return clean || fallback;
  }

  function typingCurrentRoom() {
    return firebasePathKey(
      typeof bridge.getCurrentRoom === "function" ? bridge.getCurrentRoom() : "global"
    );
  }

  function typingCurrentUser() {
    return cleanKey(bridge.getMe() || "");
  }

  function typingClientId() {
    return firebasePathKey(bridge.clientId || bridge.browserId || "browser", "browser");
  }

  function typingDatabaseRoot() {
    try {
      if (!window.firebase?.database) return null;
      return window.firebase.database().ref(TYPING_ROOT_PATH);
    } catch (error) {
      return null;
    }
  }

  function typingRestUrl(parts = []) {
    const databaseUrl = String(bridge.databaseUrl || "").replace(/\/+$/, "");
    const path = TYPING_ROOT_PATH.split("/").concat(parts).map(part => encodeURIComponent(part)).join("/");
    return databaseUrl ? `${databaseUrl}/${path}.json` : "";
  }

  async function writeTypingRest(parts, value, method = "PUT") {
    const url = typingRestUrl(parts);
    if (!url) return false;
    const response = await fetch(url, {
      method,
      cache: "no-store",
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(value)
    });
    return response.ok;
  }

  function installFullChatTypingStyles() {
    if (document.getElementById("lz-full-chat-typing-styles")) return;
    const style = document.createElement("style");
    style.id = "lz-full-chat-typing-styles";
    style.textContent = `
      #lz-full-chat-typing {
        position: absolute;
        left: 18px;
        bottom: calc(var(--composer-height, 104px) + 9px);
        z-index: 39;
        max-width: calc(100% - 36px);
        display: flex;
        align-items: center;
        gap: 7px;
        pointer-events: none;
        opacity: 1;
        transform: translate3d(0, 0, 0);
        transition: opacity 180ms cubic-bezier(.2,.8,.2,1), transform 180ms cubic-bezier(.2,.8,.2,1);
      }
      #lz-full-chat-typing[hidden] {
        display: none;
      }
      .lz-full-chat-typing-avatars {
        display: flex;
        align-items: center;
        min-width: 27px;
        padding-left: 1px;
      }
      .lz-full-chat-typing-avatar,
      .lz-full-chat-typing-more {
        position: relative;
        width: 27px;
        height: 27px;
        flex: 0 0 27px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 2px solid var(--panel, var(--surface, #fff));
        border-radius: 50%;
        background: var(--accent, #ff7628);
        color: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,.16);
        font: 800 9px/1 system-ui, sans-serif;
      }
      .lz-full-chat-typing-avatar + .lz-full-chat-typing-avatar,
      .lz-full-chat-typing-more {
        margin-left: -9px;
      }
      .lz-full-chat-typing-avatar img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }
      .lz-full-chat-typing-bubble {
        min-height: 27px;
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(255, 118, 40, .32);
        border: 1px solid color-mix(in srgb, var(--accent, #ff7628) 32%, transparent);
        border-radius: 999px;
        background: rgba(255, 255, 255, .94);
        background: color-mix(in srgb, var(--panel, #fff) 94%, transparent);
        color: var(--muted, #756e67);
        box-shadow: 0 8px 20px rgba(0,0,0,.13);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font: 800 11px/1 system-ui, sans-serif;
        white-space: nowrap;
      }
      .lz-full-chat-typing-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--accent, #ff7628);
        opacity: .42;
        animation: lzFullChatTypingDot 220ms cubic-bezier(.2,.8,.2,1) infinite alternate;
      }
      .lz-full-chat-typing-dot:nth-of-type(2) { animation-delay: 70ms; }
      .lz-full-chat-typing-dot:nth-of-type(3) { animation-delay: 140ms; }
      .lz-full-chat-typing-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      @keyframes lzFullChatTypingDot {
        from { opacity: .35; transform: translate3d(0, 1px, 0) scale(.9); }
        to { opacity: 1; transform: translate3d(0, -1px, 0) scale(1.08); }
      }
      @media (max-width: 760px) {
        #lz-full-chat-typing {
          left: 12px;
          bottom: calc(var(--composer-height, 116px) + 7px);
          max-width: calc(100% - 24px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #lz-full-chat-typing,
        .lz-full-chat-typing-dot {
          animation: none !important;
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFullChatTypingIndicator() {
    let indicator = document.getElementById("lz-full-chat-typing");
    if (indicator) return indicator;
    const center = document.querySelector(".center");
    const composer = document.querySelector(".composer");
    if (!center || !composer) return null;
    indicator = document.createElement("div");
    indicator.id = "lz-full-chat-typing";
    indicator.hidden = true;
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-live", "polite");
    indicator.setAttribute("aria-atomic", "true");
    center.appendChild(indicator);
    return indicator;
  }

  function decodeAvatarText(value) {
    const decoder = document.createElement("textarea");
    decoder.innerHTML = String(value || "");
    return String(decoder.value || "").replace(/\s+/g, " ").trim();
  }

  function typingInitials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || "?").toUpperCase();
  }

  function createTypingAvatar(userKey, accountRecord = {}) {
    const name = String(accountRecord.username || userKey || "User");
    const avatar = String(accountRecord.avatar || "").trim();
    const item = document.createElement("span");
    item.className = "lz-full-chat-typing-avatar";
    item.title = name;
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(avatar)) {
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.src = avatar;
      image.addEventListener("error", () => {
        image.remove();
        item.textContent = typingInitials(name);
      }, { once: true });
      item.appendChild(image);
    } else {
      const decoded = decodeAvatarText(avatar);
      item.textContent = decoded && decoded.length <= 8 ? decoded : typingInitials(name);
    }
    return item;
  }

  function activeTypingUsers(snapshot = {}) {
    const cutoff = stamp() - TYPING_ACTIVE_MS;
    const self = typingCurrentUser();
    const accounts = bridge.getState()?.accounts || {};
    return Object.entries(snapshot || {})
      .map(([userKey, rawClients]) => {
        const cleanUser = cleanKey(userKey);
        if (!cleanUser || cleanUser === self) return null;
        const entries = rawClients && typeof rawClients === "object" && Object.prototype.hasOwnProperty.call(rawClients, "at")
          ? [rawClients]
          : Object.values(rawClients || {});
        const latest = entries
          .filter(entry => entry && Number(entry.at || 0) >= cutoff)
          .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))[0];
        if (!latest) return null;
        const accountRecord = accounts[cleanUser] || {};
        const name = String(accountRecord.username || latest.username || userKey);
        return {
          userKey: cleanUser,
          name,
          account: { ...accountRecord, username: name },
          at: Number(latest.at || 0)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.at - a.at);
  }

  function typingAccessibleLabel(users) {
    const names = users.map(user => user.name);
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return `${names[0]} and ${names.length - 1} others are typing`;
  }

  function renderFullChatTyping(snapshot = fullChatTyping.lastSnapshot) {
    fullChatTyping.lastSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    const indicator = ensureFullChatTypingIndicator();
    if (!indicator) return;
    const users = activeTypingUsers(fullChatTyping.lastSnapshot);
    clearTimeout(fullChatTyping.expiryTimer);
    if (!users.length) {
      indicator.hidden = true;
      indicator.replaceChildren();
      return;
    }

    const avatars = document.createElement("span");
    avatars.className = "lz-full-chat-typing-avatars";
    avatars.setAttribute("aria-hidden", "true");
    users.slice(0, 3).forEach(user => avatars.appendChild(createTypingAvatar(user.userKey, user.account)));
    if (users.length > 3) {
      const more = document.createElement("span");
      more.className = "lz-full-chat-typing-more";
      more.textContent = `+${users.length - 3}`;
      avatars.appendChild(more);
    }

    const bubble = document.createElement("span");
    bubble.className = "lz-full-chat-typing-bubble";
    bubble.setAttribute("aria-hidden", "true");
    const word = document.createElement("span");
    word.textContent = "typing";
    bubble.appendChild(word);
    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("i");
      dot.className = "lz-full-chat-typing-dot";
      bubble.appendChild(dot);
    }

    const accessible = document.createElement("span");
    accessible.className = "lz-full-chat-typing-sr";
    accessible.textContent = typingAccessibleLabel(users);
    indicator.title = accessible.textContent;
    indicator.replaceChildren(avatars, bubble, accessible);
    indicator.hidden = false;
    const nextExpiry = Math.min(...users.map(user => user.at + TYPING_ACTIVE_MS));
    fullChatTyping.expiryTimer = setTimeout(
      () => renderFullChatTyping(fullChatTyping.lastSnapshot),
      Math.max(80, nextExpiry - stamp() + 80)
    );
  }

  function stopTypingRoomListener() {
    clearInterval(fullChatTyping.restPollTimer);
    fullChatTyping.restPollTimer = 0;
    if (fullChatTyping.roomRef && fullChatTyping.roomListener) {
      try {
        fullChatTyping.roomRef.off("value", fullChatTyping.roomListener);
      } catch (error) {}
    }
    fullChatTyping.roomRef = null;
    fullChatTyping.roomListener = null;
  }

  async function pollTypingRoom(room) {
    if (document.hidden || room !== fullChatTyping.room) return;
    try {
      const response = await fetch(typingRestUrl([room]), { cache: "no-store" });
      if (response.ok) renderFullChatTyping(await response.json());
    } catch (error) {}
  }

  function startTypingRestPolling(room) {
    if (fullChatTyping.restPollTimer) return;
    pollTypingRoom(room);
    fullChatTyping.restPollTimer = setInterval(() => pollTypingRoom(room), 1800);
  }

  function syncTypingRoomListener(force = false) {
    const room = typingCurrentRoom();
    if (!force && room === fullChatTyping.room) return;
    stopTypingRoomListener();
    fullChatTyping.room = room;
    fullChatTyping.lastSnapshot = {};
    renderFullChatTyping({});
    const root = fullChatTyping.root || typingDatabaseRoot();
    fullChatTyping.root = root;
    if (!root) {
      startTypingRestPolling(room);
      return;
    }
    const roomRef = root.child(room);
    const listener = snapshot => renderFullChatTyping(snapshot.val() || {});
    fullChatTyping.roomRef = roomRef;
    fullChatTyping.roomListener = listener;
    roomRef.on("value", listener, () => startTypingRestPolling(room));
  }

  async function writeLocalTyping(active, room = typingCurrentRoom()) {
    const user = typingCurrentUser();
    if (!user) return;
    const client = typingClientId();
    const root = fullChatTyping.root || typingDatabaseRoot();
    fullChatTyping.root = root;
    const record = {
      username: String(bridge.account()?.username || bridge.getMe() || user),
      at: stamp()
    };
    try {
      if (root) {
        const ref = root.child(room).child(user).child(client);
        if (active) {
          try {
            ref.onDisconnect().remove();
          } catch (error) {}
          await ref.set(record);
        } else {
          await ref.remove();
        }
      } else if (active) {
        await writeTypingRest([room, user, client], record);
      } else {
        await writeTypingRest([room, user, client], null, "DELETE");
      }
    } catch (error) {}
  }

  function clearLocalTyping() {
    clearTimeout(fullChatTyping.publishTimer);
    clearTimeout(fullChatTyping.idleTimer);
    fullChatTyping.publishTimer = 0;
    fullChatTyping.idleTimer = 0;
    const room = fullChatTyping.publishedRoom;
    fullChatTyping.publishedRoom = "";
    if (room) writeLocalTyping(false, room);
  }

  function queueLocalTyping(active) {
    clearTimeout(fullChatTyping.idleTimer);
    if (!active) {
      clearLocalTyping();
      return;
    }
    syncTypingRoomListener();
    const room = typingCurrentRoom();
    const elapsed = stamp() - fullChatTyping.lastPublishedAt;
    const publish = () => {
      fullChatTyping.publishTimer = 0;
      if (fullChatTyping.publishedRoom && fullChatTyping.publishedRoom !== room) {
        writeLocalTyping(false, fullChatTyping.publishedRoom);
      }
      fullChatTyping.publishedRoom = room;
      fullChatTyping.lastPublishedAt = stamp();
      writeLocalTyping(true, room);
    };
    clearTimeout(fullChatTyping.publishTimer);
    if (!fullChatTyping.publishedRoom || elapsed >= TYPING_PUBLISH_INTERVAL_MS) publish();
    else fullChatTyping.publishTimer = setTimeout(publish, TYPING_PUBLISH_INTERVAL_MS - elapsed);
    fullChatTyping.idleTimer = setTimeout(clearLocalTyping, TYPING_IDLE_MS);
  }

  function installFullChatTyping() {
    if (fullChatTyping.installed) return true;
    const input = bridge.element("message-input");
    if (!input || !document.querySelector(".composer")) return false;
    fullChatTyping.installed = true;
    installFullChatTypingStyles();
    ensureFullChatTypingIndicator();
    syncTypingRoomListener(true);
    input.addEventListener("input", () => queueLocalTyping(Boolean(String(input.value || "").trim())));
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) clearLocalTyping();
    });
    document.addEventListener("click", event => {
      if (event.target?.closest?.("#send-btn")) clearLocalTyping();
      if (event.target?.closest?.("#logout")) clearLocalTyping();
      setTimeout(() => syncTypingRoomListener(), 0);
    }, true);
    const roomTitle = document.querySelector(".chat-title");
    if (roomTitle && "MutationObserver" in window) {
      const observer = new MutationObserver(() => syncTypingRoomListener());
      observer.observe(roomTitle, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener("pagehide", clearLocalTyping);
    window.addEventListener("beforeunload", clearLocalTyping);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearLocalTyping();
      else syncTypingRoomListener(true);
    });
    return true;
  }

  function showLogin(message, username = "") {
    try {
      bridge.setMe("");
      bridge.stopPresenceTimer();
      bridge.element("app")?.classList.add("hidden");
      bridge.element("login")?.classList.remove("hidden");
      if (bridge.element("login-name") && username) bridge.element("login-name").value = username;
      if (bridge.element("login-pass")) bridge.element("login-pass").value = "";
      bridge.loginError(message);
    } catch (error) {
      console.warn("Could not show chat login:", error);
    }
  }

  function clearPendingSiteLinkPassword() {
    pendingSiteLinkPayload = null;
    waitingForSiteLinkPassword = false;
  }

  function requestSiteLinkPassword(payload, message, username) {
    pendingSiteLinkPayload = {
      type: "learning-zones-chat-login",
      version: Number(payload.version || 2),
      mode: "site",
      force: true,
      username: payload.username || payload.siteUsername || "",
      siteUsername: payload.siteUsername || payload.username || ""
    };
    waitingForSiteLinkPassword = true;
    showLogin(message, username || pendingSiteLinkPayload.siteUsername);
    window.setTimeout(() => {
      const input = bridge.element("login-pass");
      if (!input || document.visibilityState !== "visible" || !document.hasFocus()) return;
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
    }, 0);
  }

  function submitPendingSiteLinkPassword() {
    if (!waitingForSiteLinkPassword || !pendingSiteLinkPayload) return false;
    const input = bridge.element("login-pass");
    const password = String(input?.value || "");
    if (!password) {
      bridge.loginError("Enter your site password above, then click Login. You do not need to sign out.");
      return true;
    }
    if (input) input.value = "";
    secureLinkedSiteLogin({ ...pendingSiteLinkPayload, password });
    return true;
  }

  function linkedAccountRecord(username, passwordHash) {
    const createdAt = stamp();
    const owner = bridge.isOwnerName(username);
    return {
      username,
      password: "",
      passwordHash,
      passwordUpdatedAt: createdAt,
      avatar: "\uD83C\uDF2E",
      status: "online",
      theme: "ember",
      mood: "Social",
      xp: 0,
      role: owner ? "owner" : "member",
      banned: false,
      bannedUntil: 0,
      bannedAt: 0,
      banUpdatedAt: 0,
      bannedBy: "",
      banReason: "",
      browserId: bridge.browserId || "",
      lastBrowserId: bridge.browserId || "",
      browserIds: bridge.currentBrowserIds(),
      browserFingerprint: bridge.browserFingerprintKey || "",
      lastBrowserFingerprint: bridge.browserFingerprintKey || "",
      browserFingerprints: bridge.currentBrowserFingerprints(),
      badges: owner ? ["Owner"] : ["New"],
      chatPlus: owner,
      chatPlusSince: owner ? createdAt : 0,
      chatPlusUntil: 0,
      chatPlusLastPaidAt: 0,
      chatPlusLastAmount: 0,
      bio: "",
      favoriteGame: "",
      nameColor: "#ff9f1c",
      profileBanner: "taco",
      profileBannerColor: "#2d3039",
      profileBannerImage: "",
      profileTheme: "taco",
      profileEffect: "none",
      createdAt,
      lastActive: createdAt,
      lastSeen: createdAt,
      updatedAt: createdAt,
      linkedFromSite: true,
      siteLinkedAt: createdAt
    };
  }

  function currentBrowserOwnsAccount(accountRecord) {
    if (!accountRecord) return false;
    const browserIds = new Set([
      accountRecord.browserId,
      accountRecord.lastBrowserId,
      ...(Array.isArray(accountRecord.browserIds) ? accountRecord.browserIds : [])
    ].filter(Boolean));
    const fingerprints = new Set([
      accountRecord.browserFingerprint,
      accountRecord.lastBrowserFingerprint,
      ...(Array.isArray(accountRecord.browserFingerprints) ? accountRecord.browserFingerprints : [])
    ].filter(Boolean));
    return Boolean(
      (bridge.browserId && browserIds.has(bridge.browserId)) ||
      (bridge.browserFingerprintKey && fingerprints.has(bridge.browserFingerprintKey))
    );
  }

  async function secureLinkedSiteLogin(payload = {}) {
    const username = cleanKey(payload.username || payload.siteUsername || "");
    if (!username || (payload.mode !== "site" && payload.force !== true)) return;
    const password = String(payload.password || "");
    if (
      !password &&
      waitingForSiteLinkPassword &&
      cleanKey(pendingSiteLinkPayload?.username || pendingSiteLinkPayload?.siteUsername || "") === username
    ) {
      return;
    }
    const requestId = ++linkRequestId;

    try {
      let chatState = bridge.getState();
      let accountRecord = chatState.accounts?.[username] || null;
      if (!accountRecord || password || readSession()) {
        try {
          const freshAccount = await bridge.fetchAccountForLogin(username);
          if (freshAccount) accountRecord = freshAccount;
        } catch (error) {
          if (!accountRecord) throw error;
        }
      }
      if (requestId !== linkRequestId) return;

      let created = false;
      let authenticated = false;
      let reusedStoredSession = false;

      if (accountRecord) {
        if (password) {
          const verification = await bridge.verifyAccountPassword(accountRecord, password);
          if (verification.unavailable) {
            const message = "This device cannot securely verify the chat password. Update your web app or use HTTPS.";
            showLogin(message, payload.siteUsername || payload.username);
            notifyParent("unsupported", username, message);
            return;
          }
          authenticated = verification.ok;
          if (authenticated && verification.legacy && bridge.securePasswordHashingAvailable()) {
            await bridge.setAccountPassword(accountRecord, password);
          }
          if (
            !authenticated &&
            !accountRecord.passwordHash &&
            !accountRecord.password &&
            currentBrowserOwnsAccount(accountRecord) &&
            bridge.securePasswordHashingAvailable()
          ) {
            await bridge.setAccountPassword(accountRecord, password);
            accountRecord.linkedFromSite = true;
            accountRecord.siteLinkedAt = stamp();
            authenticated = true;
          }
        } else {
          authenticated = await verifyStoredSession(accountRecord, username);
          reusedStoredSession = authenticated;
        }

        if (!authenticated) {
          clearSession(username);
          const message = password
            ? `This username already belongs to a different chat account, and the passwords do not match. The existing chat account was not deleted. Contact ${SUPPORT_EMAIL} for support.`
            : "Enter your site password above and click Login once to link Chat on this device. You do not need to sign out.";
          if (password) showLogin(message, accountRecord.username || payload.siteUsername || payload.username);
          else requestSiteLinkPassword(payload, message, accountRecord.username || payload.siteUsername || payload.username);
          notifyParent(password ? "conflict" : "needs-password", username, message);
          return;
        }
      } else {
        if (!password || password.length < LINK_PASSWORD_MIN_LENGTH) {
          const message = password
            ? `Use the same site password with at least ${LINK_PASSWORD_MIN_LENGTH} characters.`
            : "Enter your site password above and click Login once to create the matching Chat account. You do not need to sign out.";
          if (password) showLogin(message, payload.siteUsername || payload.username);
          else requestSiteLinkPassword(payload, message, payload.siteUsername || payload.username);
          notifyParent("needs-password", username, message);
          return;
        }
        chatState = bridge.getState();
        if (chatState.deletedAccounts?.[username]) {
          const message = `This chat username was previously removed. Contact ${SUPPORT_EMAIL} for support.`;
          clearPendingSiteLinkPassword();
          showLogin(message, payload.siteUsername || payload.username);
          notifyParent("removed", username, message);
          return;
        }
        const passwordHash = await bridge.createPasswordHashRecord(password);
        chatState.accounts = chatState.accounts || {};
        chatState.accounts[username] = linkedAccountRecord(payload.siteUsername || payload.username, passwordHash);
        Object.values(chatState.rooms || {}).forEach((roomRecord) => {
          if (roomRecord?.kind !== "room") return;
          roomRecord.members = Array.isArray(roomRecord.members) ? roomRecord.members : [];
          if (!roomRecord.members.includes(username)) roomRecord.members.push(username);
        });
        chatState = bridge.normalize(chatState);
        bridge.setState(chatState);
        accountRecord = chatState.accounts[username];
        created = true;
      }

      const browserBan = bridge.activeBrowserBan();
      const accountBan = bridge.activeAccountBan(accountRecord);
      if (browserBan || accountBan) {
        if (accountBan) bridge.linkAccountToBrowser(accountRecord);
        const message = bridge.banMessage(browserBan || accountBan);
        clearPendingSiteLinkPassword();
        showLogin(message, accountRecord.username);
        notifyParent("blocked", username, message);
        return;
      }

      bridge.setMe(accountRecord.username);
      bridge.linkAccountToBrowser(accountRecord);
      bridge.touchAccount(accountRecord.username);
      if (!reusedStoredSession) await issueSession(accountRecord);
      bridge.save();
      bridge.forceCloudSaveNow();
      bridge.loginError("");
      clearPendingSiteLinkPassword();
      bridge.openApp();
      notifyParent(
        created ? "created" : "ready",
        accountRecord.username,
        created ? "Chat account created and linked to your site login." : "Chat account verified and linked to your site login.",
        { created }
      );
    } catch (error) {
      console.warn("Secure site-to-chat link failed:", error);
      const message = "Chat could not verify the account right now. Check your connection and retry.";
      showLogin(message, payload.siteUsername || payload.username);
      notifyParent("network-error", username, message);
    }
  }

  function scheduleManualSessionIssue() {
    window.clearTimeout(manualSessionTimer);
    const startedAt = stamp();
    const check = async () => {
      const accountRecord = bridge.account();
      if (bridge.getMe() && accountRecord) {
        await issueSession(accountRecord);
        bridge.save();
        bridge.forceCloudSaveNow();
        return;
      }
      if (stamp() - startedAt < 8000) manualSessionTimer = window.setTimeout(check, 180);
    };
    manualSessionTimer = window.setTimeout(check, 180);
  }

  try {
    bridge.installLinkedLogin(secureLinkedSiteLogin);
  } catch (error) {
    console.error("Could not install secure chat account linking:", error);
  }

  [0, 160, 500, 1200, 2600].forEach(delay => {
    window.setTimeout(() => {
      const installed = installFullChatTyping();
      if (!installed || fullChatTyping.root) return;
      const root = typingDatabaseRoot();
      if (!root) return;
      fullChatTyping.root = root;
      syncTypingRoomListener(true);
    }, delay);
  });

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#login-btn") && submitPendingSiteLinkPassword()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.target?.closest?.("#login-btn, #register-btn")) scheduleManualSessionIssue();
    if (event.target?.closest?.("#logout")) clearSession(bridge.getMe());
  }, true);

  let profileMediaBeforeSave = "";
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#settings-save-profile")) return;
    profileMediaBeforeSave = profileMediaSignature(bridge.account() || {});
  }, true);

  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#settings-save-profile")) return;
    window.setTimeout(() => {
      const accountRecord = bridge.account();
      if (!accountRecord) return;
      const nextSignature = profileMediaSignature(accountRecord);
      if (nextSignature === profileMediaBeforeSave) return;
      const updatedAt = stamp();
      accountRecord.profileMediaUpdatedAt = updatedAt;
      accountRecord.updatedAt = Math.max(Number(accountRecord.updatedAt || 0), updatedAt);
      bridge.save();
      notifyParentProfileMedia(accountRecord);
    }, 0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target?.matches?.("#login-pass") && submitPendingSiteLinkPassword()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key === "Enter" && event.target?.matches?.("#login-pass, #register-pass")) scheduleManualSessionIssue();
  }, true);

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    const payload = event.data || {};
    if (payload.type === PROFILE_MEDIA_SYNC_TYPE) applyParentProfileMedia(payload);
  });

  window.learningZonesSecureChatLink = {
    sessionKey: SESSION_KEY,
    verify: verifyStoredSession,
    accept: secureLinkedSiteLogin,
    clear: clearSession,
    syncProfileMedia: applyParentProfileMedia
  };
})();
