(() => {
  const DB = "https://taco-chat-c1539-default-rtdb.firebaseio.com";
  const ROOT = "rooms/_deluxeAppState/state/ultimateGameStash";
  const CACHE_KEY = "ugp_chat_sync";
  const USER_KEY = "ugp_chat_user";
  const PROFILE_KEY = "ugp_chat_profile";
  const FRIENDS_KEY = "ugp_chat_friends";
  const REQUESTS_KEY = "ugp_chat_requests";
  const LINK_KEY = "ugp_chat_site_link";
  const SITE_THEME_KEY = "ugp_site_theme";
  const SITE_SETTINGS_KEY = "ugp_site_settings_v1";
  const RATING_CACHE_KEY = "ugp_zone_ratings_cache_v1";
  const RATING_USER_CACHE_KEY = "ugp_zone_rating_user_cache_v1";
  const HOME_RECENT_KEY = "ugp_recent_zones_v1";
  const CHAT_NOTIFICATION_KEY = "ugp_chat_notifications_v1";
  const SITE_CHAT_CREDENTIAL_TTL_MS = 2 * 60 * 1000;
  const SYNC_EVENT = "learningzones:chat-sync";
  const CHAT_STATE_ROOT = DB + "/rooms/_deluxeAppState/state";
  const RATINGS_ROOT = "ratings";
  const RATING_USERS_ROOT = "ratingUsers";
  const RATING_CACHE_TTL_MS = 3 * 60 * 1000;
  const FIREBASE_REQUEST_TIMEOUT_MS = 8000;
  const RATING_READ_TIMEOUT_MS = 1200;
  const RATING_TIMEOUT_COOLDOWN_MS = 45 * 1000;
  const RATING_PREVIOUS_TIMEOUT_MS = 650;
  const RATING_AGGREGATE_SAVE_TIMEOUT_MS = 1600;
  const RATING_USER_SAVE_TIMEOUT_MS = 1200;
  const RATING_HYDRATE_KEY_LIMIT = 12;
  const BOOT_STAMP = Date.now();
  const GAME_COVER_MANIFEST_URL = "/games/covers.json?v=20260721-final-covers1";
  const GAME_COVER_CACHE_KEY = "ugp_game_cover_manifest_v4";
  let currentSnapshot = readJson(CACHE_KEY, null);
  let ratingCache = readJson(RATING_CACHE_KEY, null) || { loadedAt: 0, items: {} };
  let ratingUserCache = readJson(RATING_USER_CACHE_KEY, null) || { userId: "", loadedAt: 0, items: {} };
  let gameCoverManifest = readJson(GAME_COVER_CACHE_KEY, null) || {};
  let gameCoverManifestPromise = null;
  let refreshTimer = 0;
  let overlayDataTimer = 0;
  let overlayMessageStreamHandle = null;
  let overlayMessageStreamState = {};
  let overlayMessageStreamReady = false;
  let overlayMessageStreamReadyTimer = 0;
  let overlayMessageFallbackTimer = 0;
  let overlayTypingSignalTimer = 0;
  let overlayTypingSignalClearTimer = 0;
  let overlayTypingSignalLastAt = 0;
  let overlayTypingSignalRoom = "";
  let overlayTypingSignalClientId = "";
  let profileMountTimer = 0;
  let overlayMountTimer = 0;
  let ratingMountTimer = 0;
  let gameCoverMountTimer = 0;
  let mediaOptimizationTimer = 0;
  let homeDiscoveryTimer = 0;
  let scrollRevealTimer = 0;
  let scrollRevealObserver = null;
  let ratingsLoadPromise = null;
  let ratingUserLoadPromise = null;
  let zoneRatingsHydratePromise = null;
  let ratingHydrationCooldownUntil = 0;
  let ratingTimeoutWarningUntil = 0;
  let gameCoverManifestLoaded = hasGameCoverManifest();
  let gameCoverManifestLastStatus = "";
  let gameCoverStateCounts = { coverCount: 0, imageCount: 0, countedAt: 0 };
  let ratingSaveStates = {};
  let chromebookModeTimer = 0;
  let siteSettingsRenderTimer = 0;
  let siteSettingsStatusTimer = 0;
  let siteSettingsStatusMessage = "";
  let presenceTimer = 0;
  let accountLinkInputTimer = 0;
  let accountLinkMountTimer = 0;
  let onlineCounterTimer = 0;
  let whatsHappeningTimer = 0;
  let whatsHappeningHideTimer = 0;
  let chatNotificationTimer = 0;
  let chatNotificationRefreshPromise = null;
  let chatNotificationHideTimer = 0;
  let pendingSiteChatCredential = null;
  let siteChatCredentialSyncTimer = 0;
  let chatLinkStatusMessage = "";
  let chatNotificationLatest = {
    userId: "",
    globalAt: 0,
    rooms: {},
    counts: { global: 0, direct: 0, mentions: 0, total: 0 }
  };
  const ONLINE_WINDOW_MS = 3 * 60 * 1000;
  const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;
  const ONLINE_COUNTER_REFRESH_MS = 3 * 60 * 1000;
  const OVERLAY_REFRESH_MS = 60 * 1000;
  const OVERLAY_REFRESH_CHROMEBOOK_MS = 2 * 60 * 1000;
  const OVERLAY_MESSAGE_LIMIT = 24;
  const OVERLAY_REALTIME_MESSAGE_LIMIT = 120;
  const CHAT_NOTIFICATION_MESSAGE_LIMIT = 60;
  const CHAT_NOTIFICATION_REFRESH_MS = 60 * 1000;
  const CHAT_NOTIFICATION_REFRESH_CHROMEBOOK_MS = 2 * 60 * 1000;
  const CHATTING_NOW_WINDOW_MS = 10 * 60 * 1000;
  const CHAT_TYPING_PUBLISH_INTERVAL_MS = 900;
  const CHAT_TYPING_IDLE_MS = 2800;
  const ACCOUNT_FETCH_CACHE_MS = 2 * 60 * 1000;
  const PROFILE_SYNC_AVATAR_MAX_CHARS = 110 * 1024;
  const PROFILE_SYNC_BANNER_MAX_CHARS = 160 * 1024;
  const OWNER_NAMES = ["CarterB", "London", "RyanH"];
  const SCROLL_REVEAL_SELECTOR = [
    ".fade-up",
    ".tile",
    "[data-testid='games-grid'] > a",
    "[data-testid='loading-grid'] > div",
    ".lz-home-hero-copy",
    ".lz-home-hero-panel",
    ".lz-home-feature-panel",
    ".lz-home-section-head",
    ".lz-home-flow-card",
    ".lz-home-continue-card",
    ".lz-home-recommendation-card",
    ".lz-home-mini-card",
    ".lz-card-cover",
    ".lz-settings-card",
    ".lz-settings-panel",
    ".lz-settings-live-preview",
    ".lz-settings-preview-card",
    ".lz-settings-nav",
    ".lz-chat-panel-section",
    ".lz-chat-message-card"
  ].join(",");
  const OFFLINE_AUTH_ACCOUNTS = [
    {
      id: "carterb",
      username: "CarterB",
      role: "owner",
      status: "approved",
      salt: "learningzone-offline-carterb-v1",
      passwordSha256: "5c7124ea5155871a54fd74bf0d0321c204f621f790b9eb5b62cb0526beb5aaa8"
    }
  ];
  const SITE_THEME_OPTIONS = [
    { value: "ember", label: "Ember", theme: "ember", colorMode: "light" },
    { value: "ocean", label: "Ocean", theme: "ocean", colorMode: "light" },
    { value: "berry", label: "Berry", theme: "berry", colorMode: "light" },
    { value: "lime", label: "Lime", theme: "lime", colorMode: "light" },
    { value: "purple", label: "Purple", theme: "purple", colorMode: "light" }
  ];
  const SITE_THEME_SWATCHES = [
    { value: "ember", label: "Ember", color: "#bf8428" },
    { value: "berry", label: "Berry", color: "#c62ba0" },
    { value: "lime", label: "Lime", color: "#50bf3d" },
    { value: "ocean", label: "Ocean", color: "#3b99c9" },
    { value: "teal", label: "Teal", color: "#3b8f9c", alias: "ocean" },
    { value: "purple", label: "Purple", color: "#6c427f" }
  ];
  const SITE_BACKGROUND_OPTIONS = [
    { value: "matrix", label: "Matrix" },
    { value: "topography", label: "Topography" },
    { value: "constellation", label: "Constellation" },
    { value: "starfield", label: "Starfield" },
    { value: "aurora", label: "Aurora" },
    { value: "circuit", label: "Circuit" }
  ];
  const SITE_BACKGROUND_VALUES = SITE_BACKGROUND_OPTIONS.map(item => item.value);
  const SITE_ARCADE_THEME_PALETTES = {
    ember: { baseLight: "#fbf7f2", baseDark: "#090704", cyan: "217, 154, 53", violet: "242, 118, 40", blue: "255, 196, 92" },
    ocean: { baseLight: "#f5f9fc", baseDark: "#051018", cyan: "79, 163, 209", violet: "93, 133, 226", blue: "35, 120, 201" },
    berry: { baseLight: "#fbf6f8", baseDark: "#120711", cyan: "217, 77, 122", violet: "198, 43, 160", blue: "255, 139, 215" },
    lime: { baseLight: "#f7faf2", baseDark: "#071006", cyan: "93, 204, 71", violet: "146, 211, 76", blue: "182, 245, 122" },
    purple: { baseLight: "#faf7fc", baseDark: "#0c0910", cyan: "142, 100, 165", violet: "108, 66, 127", blue: "215, 181, 238" }
  };
  const DEFAULT_SITE_SETTINGS = {
    background: "matrix",
    cursor: "ring",
    adsDisabled: true,
    inactiveTitle: "Home",
    inactiveIcon: "",
    logoData: "",
    logoName: "",
    performanceMode: "auto",
    reduceMotion: false
  };
  const STREAK_KEY = "ugp_daily_streak";
  const GUEST_STREAK_KEY = "ugp_guest_daily_streak";
  const STREAK_MILESTONES = [3, 7, 14, 30, 100];
  const STREAK_DAY_MS = 24 * 60 * 60 * 1000;
  const STREAK_ROUTE_DELAY_MS = 2200;
  const SPECTATE_REQUEST_TTL_MS = 30 * 1000;
  const SPECTATE_ACTIVITY_HEARTBEAT_MS = 25 * 1000;
  const SPECTATE_ACTIVITY_WINDOW_MS = 95 * 1000;
  let streakServerClockCache = null;
  let streakRouteTimer = 0;
  let streakExpiryTimer = 0;
  let lastStreakRouteKey = "";
  let spectateActivity = {};
  let spectateRequests = {};
  let spectateOutbox = {};
  let spectateSessions = {};
  let spectateSettings = {};
  let spectateParties = {};
  let spectateStreamHandles = [];
  let spectateStreamKey = "";
  let spectateNoticeKeys = new Set();
  let spectateOverlayRenderTimer = 0;
  let zoneActivityTimer = 0;
  let activeZoneActivitySlug = "";
  let activeSpectateSessionId = "";
  let siteDefaultTitle = "";
  let siteDefaultFavicon = "";
  const accountFetchCache = new Map();

  function key(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  }

  function isOwnerName(value) {
    const normal = key(value);
    const compact = normal.replace(/_/g, "");
    return OWNER_NAMES.some(name => {
      const ownerKey = key(name);
      return normal === ownerKey || compact === ownerKey.replace(/_/g, "");
    });
  }

  function offlineAuthAccountFor(username) {
    const userKey = key(username);
    return OFFLINE_AUTH_ACCOUNTS.find(account => key(account.id || account.username) === userKey) || null;
  }

  function offlineAuthActiveUsername() {
    const tokenName = tokenUsername();
    if (tokenName) return tokenName;
    const session = readJson("ugp_session", null);
    const source = String(session?.accountLinkSource || "");
    return /^offline-/i.test(source) ? session?.username || "" : "";
  }

  function offlineAuthPayload(account) {
    if (!account) return null;
    return {
      id: account.id || key(account.username),
      username: account.username,
      role: account.role || "user",
      status: account.status || "approved",
      profile: {},
      friends: { count: 0, users: [] },
      requests: { incoming: [], outgoing: [] },
      offlineFallback: true,
      updatedAt: Date.now()
    };
  }

  function offlineFirebaseResponseFor(url, init) {
    const method = String(init?.method || "GET").toUpperCase();
    if (method !== "GET") return null;
    const text = decodeURIComponent(String(url || ""));
    const accountMatch = text.match(/\/accounts\/([^/?#]+)\.json/i);
    const profileMatch = text.match(/\/siteSync\/chatProfiles\/([^/?#]+)\.json/i);
    const requestedUser = cleanAccountName(accountMatch?.[1] || profileMatch?.[1] || "");
    if (!requestedUser) return null;
    const activeUser = offlineAuthActiveUsername();
    const account = offlineAuthAccountFor(activeUser || requestedUser);
    if (!account || key(account.username) !== key(requestedUser)) return null;
    return new Response(JSON.stringify(offlineAuthPayload(account)), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  function installOfflineFirebaseFetchFallback() {
    if (window.__learningZonesOfflineFirebaseFallback) return;
    window.__learningZonesOfflineFirebaseFallback = true;
    const originalFetch = window.fetch?.bind(window);
    if (!originalFetch) return;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url || "";
      try {
        return await originalFetch(input, init);
      } catch (error) {
        const fallback = offlineFirebaseResponseFor(url, init);
        if (fallback) return fallback;
        throw error;
      }
    };
  }

  function installSaveCommitWorker() {
    if (window.learningZonesSaveCommit) return;
    window.learningZonesSaveCommit = (url, init = {}) => {
      if (typeof Worker !== "function" || typeof Blob !== "function" || !window.URL?.createObjectURL) {
        return fetch(url, init);
      }
      const code = `
        self.onmessage = async event => {
          try {
            const response = await fetch(event.data.url, event.data.init || {});
            self.postMessage({ ok: response.ok, status: response.status, statusText: response.statusText });
          } catch (error) {
            self.postMessage({ ok: false, status: 0, statusText: String(error && error.message || error) });
          }
        };
      `;
      const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      return new Promise((resolve, reject) => {
        const worker = new Worker(blobUrl);
        const timer = setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          reject(new Error("save_timeout"));
        }, 10000);
        worker.onmessage = event => {
          clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          const result = event.data || {};
          if (result.ok) resolve(result);
          else reject(new Error(result.statusText || "Could not update saved zones."));
        };
        worker.onerror = error => {
          clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(blobUrl);
          reject(error instanceof Error ? error : new Error("save_worker_error"));
        };
        worker.postMessage({ url, init });
      });
    };
  }

  function overlayCurrentUserId() {
    return key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
  }

  function overlayRoleForAccount(account = {}, fallbackId = "") {
    const username = account?.username || fallbackId;
    if (isOwnerName(username) || String(account?.role || "").toLowerCase() === "owner") return "owner";
    const role = String(account?.role || "").toLowerCase();
    if (role === "mod" || role === "admin") return "admin";
    return "member";
  }

  function overlayCurrentRole(accounts = {}) {
    const userId = overlayCurrentUserId();
    const currentAccount = accounts?.[userId] || {};
    if (isOwnerName(currentSnapshot?.username || userId) || isOwnerName(currentAccount?.username || userId)) return "owner";
    if (currentSnapshot?.role === "owner") return "owner";
    if (currentSnapshot?.role === "admin") return "admin";
    return overlayRoleForAccount(currentAccount, userId);
  }

  function overlayIsOwner(overlay) {
    return overlayCurrentRole(overlay?.__lzOverlayData?.accounts || {}) === "owner";
  }

  function overlayIsAdmin(overlay) {
    return ["owner", "admin"].includes(overlayCurrentRole(overlay?.__lzOverlayData?.accounts || {}));
  }

  function overlayCanModerateUser(overlay, targetId, account = {}) {
    const targetKey = key(targetId || account?.username);
    if (!overlayIsAdmin(overlay) || !targetKey || targetKey === overlayCurrentUserId()) return false;
    return overlayRoleForAccount(account, targetKey) !== "owner" && !isOwnerName(account?.username || targetKey);
  }

  function isOverlayAccountBanned(account = {}) {
    const until = Number(account?.bannedUntil || 0);
    return account?.banned === true && (!until || until > Date.now());
  }

  function readJson(storageKey, fallback) {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeIsoDay(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function isoDayFromStamp(stamp) {
    const date = new Date(Number(stamp || 0));
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
  }

  function streakDayNumber(day) {
    const clean = normalizeIsoDay(day);
    if (!clean) return NaN;
    return Math.floor(Date.parse(`${clean}T00:00:00.000Z`) / STREAK_DAY_MS);
  }

  function sortedUniqueDays(days) {
    return Array.from(new Set((Array.isArray(days) ? days : [])
      .map(normalizeIsoDay)
      .filter(Boolean)))
      .sort();
  }

  function streakStateFromSource(source = {}) {
    const nested = source && typeof source.streak === "object" ? source.streak : {};
    const playedDays = sortedUniqueDays([
      ...(Array.isArray(source.streakDays) ? source.streakDays : []),
      ...(Array.isArray(source.playedDays) ? source.playedDays : []),
      ...(Array.isArray(nested.playedDays) ? nested.playedDays : []),
      ...(Array.isArray(nested.days) ? nested.days : [])
    ]);
    const lastActiveDate = normalizeIsoDay(
      source.lastActiveDate ||
      source.streakLastActiveDate ||
      nested.lastActiveDate ||
      nested.lastActiveDateUtc ||
      playedDays[playedDays.length - 1] ||
      ""
    );
    if (lastActiveDate && !playedDays.includes(lastActiveDate)) playedDays.push(lastActiveDate);
    playedDays.sort();
    const current = Math.max(0, Math.round(Number(
      source.currentStreak ??
      source.streakCurrent ??
      source.streakCurrentDays ??
      source.current ??
      nested.current ??
      nested.currentStreak ??
      0
    )));
    const longest = Math.max(current, Math.max(0, Math.round(Number(
      source.longestStreak ??
      source.streakLongest ??
      source.streakLongestDays ??
      source.longest ??
      nested.longest ??
      nested.longestStreak ??
      0
    ))));
    return {
      current,
      longest,
      lastActiveDate,
      lastPlayedAt: Math.max(0, Math.round(Number(source.streakLastPlayedAt || nested.lastPlayedAt || 0))),
      playedDays: playedDays.slice(-180)
    };
  }

  function currentStreakClockStamp() {
    const localNow = Date.now();
    if (!streakServerClockCache) return localNow;
    return streakServerClockCache.stamp + (localNow - streakServerClockCache.cachedAt);
  }

  function currentStreakDay() {
    return isoDayFromStamp(currentStreakClockStamp());
  }

  function activeStreakStateForDay(source = {}, today = currentStreakDay()) {
    const streak = streakStateFromSource(source);
    const todayNumber = streakDayNumber(today);
    const lastActiveNumber = streakDayNumber(streak.lastActiveDate);
    const missedDay = (
      streak.current > 0
      && Number.isFinite(todayNumber)
      && Number.isFinite(lastActiveNumber)
      && todayNumber - lastActiveNumber > 1
    );
    return missedDay
      ? { ...streak, current: 0, expired: true }
      : { ...streak, expired: false };
  }

  function applyStreakPlay(previous = {}, today) {
    const prev = streakStateFromSource(previous);
    const playedDay = normalizeIsoDay(today);
    const todayNumber = streakDayNumber(playedDay);
    if (!playedDay || !Number.isFinite(todayNumber)) return { ...prev, changed: false, milestone: 0 };
    if (prev.lastActiveDate === playedDay || prev.playedDays.includes(playedDay)) {
      return { ...prev, changed: false, alreadyPlayed: true, milestone: 0 };
    }
    const prevNumber = streakDayNumber(prev.lastActiveDate);
    if (Number.isFinite(prevNumber) && todayNumber < prevNumber) {
      return { ...prev, changed: false, alreadyPlayed: true, milestone: 0 };
    }
    const current = Number.isFinite(prevNumber) && todayNumber - prevNumber === 1
      ? Math.max(0, prev.current) + 1
      : 1;
    const longest = Math.max(prev.longest || 0, current);
    const playedDays = sortedUniqueDays([...prev.playedDays, playedDay]).slice(-180);
    const milestone = STREAK_MILESTONES.includes(current) && current > (prev.current || 0) ? current : 0;
    return {
      current,
      longest,
      lastActiveDate: playedDay,
      lastPlayedAt: 0,
      playedDays,
      changed: true,
      milestone
    };
  }

  function mergeStreakPlayedDays(previous = {}, days = []) {
    let next = streakStateFromSource(previous);
    let changed = false;
    sortedUniqueDays(days).forEach(day => {
      const applied = applyStreakPlay(next, day);
      if (applied.changed) {
        next = applied;
        changed = true;
        return;
      }
      if (!next.playedDays.includes(day)) {
        next.playedDays = sortedUniqueDays([...next.playedDays, day]).slice(-180);
        changed = true;
      }
    });
    return { ...next, changed, milestone: 0 };
  }

  function streakAccountPatch(streak, stamp = Date.now()) {
    const clean = streakStateFromSource(streak);
    const updatedAt = Math.max(0, Math.round(Number(stamp || Date.now())));
    const nested = {
      current: clean.current,
      longest: clean.longest,
      lastActiveDate: clean.lastActiveDate,
      lastPlayedAt: updatedAt,
      updatedAt,
      playedDays: clean.playedDays
    };
    return {
      currentStreak: clean.current,
      longestStreak: clean.longest,
      lastActiveDate: clean.lastActiveDate,
      streakCurrent: clean.current,
      streakLongest: clean.longest,
      streakLastActiveDate: clean.lastActiveDate,
      streakLastPlayedAt: updatedAt,
      streakUpdatedAt: updatedAt,
      streakDays: clean.playedDays,
      streak: nested
    };
  }

  function streakProfilePatch(streak) {
    const clean = activeStreakStateForDay(streak);
    return {
      currentStreak: clean.current,
      longestStreak: clean.longest,
      lastActiveDate: clean.lastActiveDate,
      streak: {
        current: clean.current,
        longest: clean.longest,
        lastActiveDate: clean.lastActiveDate,
        lastPlayedAt: clean.lastPlayedAt,
        playedDays: clean.playedDays
      }
    };
  }

  function streakDateLabel(day) {
    const clean = normalizeIsoDay(day);
    if (!clean) return "Never";
    const date = new Date(`${clean}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) return clean;
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  function writeJson(storageKey, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.warn("Learning Zones sync cache skipped:", storageKey, error);
    }
  }

  function firebaseUrl(parts) {
    const rootParts = ROOT.split("/").filter(Boolean);
    return DB + "/" + rootParts.concat(parts || []).map(part => encodeURIComponent(String(part))).join("/") + ".json";
  }

  async function fetchWithTimeout(input, init = {}, timeoutMs = FIREBASE_REQUEST_TIMEOUT_MS) {
    let timer = 0;
    const controller = typeof AbortController === "function" && !init.signal ? new AbortController() : null;
    const options = controller ? { ...init, signal: controller.signal } : init;
    try {
      return await Promise.race([
        fetch(input, options),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            try { controller?.abort(); } catch (error) {}
            reject(new Error("firebase_request_timeout"));
          }, timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  function mutationAddsMatching(mutations, selector) {
    return Array.from(mutations || []).some(mutation =>
      Array.from(mutation.addedNodes || []).some(node =>
        (node?.nodeType === Node.ELEMENT_NODE || node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) &&
        (node.matches?.(selector) || node.querySelector?.(selector))
      )
    );
  }

  function tokenUsername() {
    try {
      const token = localStorage.getItem("ugp_token") || "";
      if (token.startsWith("static-firebase:")) return decodeURIComponent(token.slice("static-firebase:".length));
    } catch (error) {}
    return "";
  }

  function sessionUsername() {
    const tokenName = tokenUsername();
    if (tokenName) return tokenName;
    const session = readJson("ugp_session", null);
    if (session && session.username) return session.username;
    return "";
  }

  function loggedInUsername() {
    const sessionName = sessionUsername();
    if (sessionName) return sessionName;
    const headerName = headerUsername();
    if (headerName) return headerName;
    const cached = readJson(USER_KEY, null);
    return cached?.username || "";
  }

  function cleanAccountName(value) {
    return String(value || "").trim();
  }

  function loginFormElement() {
    const visiblePassword = Array.from(document.querySelectorAll('input[type="password"]')).find(isActuallyVisible);
    if (visiblePassword) return visiblePassword.closest("form") || visiblePassword.closest('[data-testid="login-form"]') || visiblePassword.parentElement;
    const usernameInput = Array.from(document.querySelectorAll('[data-testid="username-input"], input[name="username"], input[autocomplete="username"]')).find(isActuallyVisible);
    return usernameInput?.closest("form") || usernameInput?.closest('[data-testid="login-form"]') || null;
  }

  function loginFormUsername() {
    if (!isLoginSurface()) return "";
    const root = loginFormElement() || document;
    const selectors = [
      '[data-testid="username-input"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[autocomplete="username"]',
      'input[type="text"]'
    ];
    for (const selector of selectors) {
      const input = root.querySelector(selector);
      const value = cleanAccountName(input?.value || "");
      if (value && isActuallyVisible(input)) return value.replace(/^@+/, "");
    }
    return "";
  }

  function chatUsername() {
    return cleanAccountName(currentSnapshot?.username || readJson(USER_KEY, null)?.username || "");
  }

  function siteSessionSource() {
    return cleanAccountName(readJson("ugp_session", null)?.accountLinkSource || "");
  }

  function siteSessionIsChatLinked() {
    return /^chat-/i.test(siteSessionSource());
  }

  function accountLinkPreference() {
    const pref = readJson(LINK_KEY, null);
    if (pref && (pref.mode === "site" || pref.mode === "chat")) return pref;
    return { mode: "site", updatedAt: 0 };
  }

  function accountLinkState(pref = accountLinkPreference()) {
    const mode = pref?.mode === "chat" ? "chat" : "site";
    const storedSite = cleanAccountName(pref?.siteUsername);
    const storedChat = cleanAccountName(pref?.chatUsername);
    const storedChoice = cleanAccountName(pref?.username);
    const enteredSite = loginFormUsername();
    const liveSite = cleanAccountName(sessionUsername() || headerUsername());
    const liveChat = chatUsername();
    const siteUser = siteSessionIsChatLinked()
      ? (storedSite || (mode === "site" ? storedChoice : "") || headerUsername() || liveSite)
      : (liveSite || storedSite || (mode === "site" ? storedChoice : ""));
    const chatLooksSiteForced = Boolean(storedChat && liveChat && siteUser && key(liveChat) === key(siteUser) && key(storedChat) !== key(siteUser));
    const chatUser = (mode === "site" || chatLooksSiteForced)
      ? (storedChat || liveChat || (mode === "chat" ? storedChoice : ""))
      : (liveChat || storedChat || (mode === "chat" ? storedChoice : ""));
    const username = mode === "chat" ? (chatUser || siteUser) : (siteUser || chatUser);
    const siteDisplayUser = enteredSite || siteUser;
    const chatDisplayUser = chatUser;
    const pendingSiteSignIn = Boolean(enteredSite && (!siteUser || key(enteredSite) !== key(siteUser)));
    const sameAccount = Boolean(siteDisplayUser && chatDisplayUser && key(siteDisplayUser) === key(chatDisplayUser));
    const status = chatLinkStatusMessage || (pendingSiteSignIn && mode === "site"
      ? `Current choice: site login as ${enteredSite} after sign-in.`
      : sameAccount
        ? `Current choice: ${mode} login as ${mode === "chat" ? chatDisplayUser : siteDisplayUser}. Site and chat are using the same account.`
        : mode === "chat"
          ? `Current choice: chat login${chatDisplayUser ? ` as ${chatDisplayUser}` : ""}.`
          : `Current choice: site login${siteDisplayUser ? ` as ${siteDisplayUser}` : ""}.`);
    return {
      ...pref,
      mode,
      username,
      siteUsername: siteUser,
      chatUsername: chatUser,
      siteDisplayUsername: siteDisplayUser,
      chatDisplayUsername: chatDisplayUser,
      enteredSiteUsername: enteredSite,
      pendingSiteSignIn,
      siteUser,
      chatUser,
      sameAccount,
      status
    };
  }

  function setAccountLinkPreference(mode) {
    const nextMode = mode === "chat" ? "chat" : "site";
    const state = accountLinkState();
    const siteUser = state.siteUsername;
    const chatUser = state.chatUsername;
    const username = nextMode === "chat" ? (chatUser || siteUser) : (siteUser || chatUser);
    const pref = {
      mode: nextMode,
      username,
      siteUsername: siteUser,
      chatUsername: chatUser,
      updatedAt: Date.now()
    };
    writeJson(LINK_KEY, pref);
    window.dispatchEvent(new CustomEvent("learningzones:account-link", { detail: pref }));
    return pref;
  }

  function normalizeSiteTheme(value) {
    const raw = typeof value === "object" && value ? (value.value || value.theme || value.mode) : value;
    const keyValue = key(raw || "ember");
    if (keyValue === "custom") {
      return {
        value: "custom",
        label: "Custom",
        theme: "custom",
        colorMode: value?.colorMode === "dark" ? "dark" : "light",
        accent: safeColor(value?.accent || value?.color, "#bf8428")
      };
    }
    const option = SITE_THEME_OPTIONS.find(item => item.value === keyValue || item.theme === keyValue) || SITE_THEME_OPTIONS[0];
    if (keyValue === "dark") return { ...SITE_THEME_OPTIONS.find(item => item.value === "purple"), colorMode: "dark" };
    return { ...option, colorMode: value?.colorMode === "dark" ? "dark" : "light" };
  }

  function siteThemePreference() {
    return normalizeSiteTheme(readJson(SITE_THEME_KEY, null) || "ember");
  }

  function siteAppearancePayload() {
    const theme = siteThemePreference();
    const settings = siteSettings();
    return {
      type: "learning-zones-appearance",
      version: 1,
      value: theme.value,
      theme: theme.theme,
      colorMode: theme.colorMode,
      accent: theme.value === "custom" ? safeColor(theme.accent, "#bf8428") : settingsThemeAccent(theme),
      background: settings.background,
      settings: {
        background: settings.background,
        reduceMotion: settings.reduceMotion,
        performanceMode: settings.performanceMode
      },
      at: Date.now()
    };
  }

  function siteThemePayload() {
    return { ...siteAppearancePayload(), type: "learning-zones-theme" };
  }

  function arcadeThemePalette(theme = siteThemePreference()) {
    const normalized = normalizeSiteTheme(theme);
    if (normalized.value === "custom") {
      const accent = safeColor(normalized.accent, "#bf8428");
      const rgb = hexToRgb(accent) || { r: 191, g: 132, b: 40 };
      const soft = {
        r: Math.round((rgb.r + 255) / 2),
        g: Math.round((rgb.g + 255) / 2),
        b: Math.round((rgb.b + 255) / 2)
      };
      const deep = {
        r: Math.round(rgb.r * 0.58),
        g: Math.round(rgb.g * 0.58),
        b: Math.round(rgb.b * 0.58)
      };
      return {
        base: normalized.colorMode === "dark" ? "#090b10" : "#f8f7fb",
        cyan: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
        violet: `${soft.r}, ${soft.g}, ${soft.b}`,
        blue: `${deep.r}, ${deep.g}, ${deep.b}`
      };
    }
    const palette = SITE_ARCADE_THEME_PALETTES[normalized.theme] || SITE_ARCADE_THEME_PALETTES.ember;
    return {
      base: normalized.colorMode === "dark" ? palette.baseDark : palette.baseLight,
      cyan: palette.cyan,
      violet: palette.violet,
      blue: palette.blue
    };
  }

  function applyArcadeThemeVars(theme = siteThemePreference()) {
    const palette = arcadeThemePalette(theme);
    const baseRgb = hexToRgb(palette.base) || { r: 7, g: 10, b: 20 };
    const root = document.documentElement;
    root.style.setProperty("--lz-arcade-base", palette.base);
    root.style.setProperty("--lz-arcade-base-rgb", `${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}`);
    root.style.setProperty("--lz-arcade-theme-cyan", palette.cyan);
    root.style.setProperty("--lz-arcade-theme-violet", palette.violet);
    root.style.setProperty("--lz-arcade-theme-blue", palette.blue);
    return palette;
  }

  function applySiteThemePreference(value = siteThemePreference()) {
    const theme = normalizeSiteTheme(value);
    const root = document.documentElement;
    root.dataset.lzTheme = theme.theme;
    root.dataset.lzThemeValue = theme.value;
    root.dataset.lzColorMode = theme.colorMode;
    applyArcadeThemeVars(theme);
    if (theme.value === "custom") {
      const accent = safeColor(theme.accent, "#bf8428");
      const rgb = hexToRgb(accent) || { r: 191, g: 132, b: 40 };
      root.style.setProperty("--lz-site-accent", accent);
      root.style.setProperty("--lz-site-accent-hover", accent);
      root.style.setProperty("--lz-site-accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
      root.style.setProperty("--lz-site-highlight", highlightAccentColor(accent, theme.colorMode));
      root.style.setProperty("--lz-site-accent-readable", readableAccentColor(accent, theme.colorMode));
      root.style.setProperty("--lz-site-on-accent", readableOnAccentColor(accent));
    } else {
      root.style.removeProperty("--lz-site-accent");
      root.style.removeProperty("--lz-site-accent-hover");
      root.style.removeProperty("--lz-site-accent-soft");
      root.style.removeProperty("--lz-site-highlight");
      root.style.removeProperty("--lz-site-accent-readable");
      root.style.removeProperty("--lz-site-on-accent");
    }
    if (document.body) {
      document.body.dataset.lzTheme = theme.theme;
      document.body.dataset.lzThemeValue = theme.value;
      document.body.dataset.lzColorMode = theme.colorMode;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.colorMode === "dark" ? "#11100f" : (theme.theme === "ocean" ? "#f5f9fc" : theme.theme === "berry" ? "#fbf6f8" : theme.theme === "lime" ? "#f7faf2" : theme.theme === "purple" ? "#faf7fc" : "#fbf7f2"));
    document.querySelectorAll("[data-lz-site-theme-select]").forEach(select => {
      select.value = theme.value;
      select.setAttribute("aria-label", `Site theme: ${theme.label}`);
    });
    return theme;
  }

  function setSiteThemePreference(value) {
    const theme = normalizeSiteTheme(value);
    writeJson(SITE_THEME_KEY, theme);
    applySiteThemePreference(theme);
    requestChatFrameSync();
    window.dispatchEvent(new CustomEvent("learningzones:site-theme", { detail: theme }));
    window.dispatchEvent(new CustomEvent("learningzones:site-appearance", { detail: siteAppearancePayload() }));
    return theme;
  }

  function setSiteColorModePreference(colorMode) {
    const current = siteThemePreference();
    return setSiteThemePreference({ ...current, colorMode: colorMode === "dark" ? "dark" : "light" });
  }

  function hexToRgb(value) {
    const color = safeColor(value, "");
    if (!color) return null;
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split("").map(char => char + char).join("")
      : hex.slice(0, 6);
    const intValue = parseInt(normalized, 16);
    if (!Number.isFinite(intValue)) return null;
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  }

  function relativeLuminance(rgb) {
    if (!rgb) return 0;
    const channel = value => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(first, second) {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function mixRgb(first, second, amount = 0.5) {
    const keep = Math.max(0, Math.min(1, amount));
    const add = 1 - keep;
    return {
      r: Math.round(first.r * keep + second.r * add),
      g: Math.round(first.g * keep + second.g * add),
      b: Math.round(first.b * keep + second.b * add)
    };
  }

  function rgbToHex(rgb) {
    return `#${[rgb.r, rgb.g, rgb.b].map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("")}`;
  }

  function readableAccentColor(accent, colorMode) {
    const rgb = hexToRgb(accent);
    const background = colorMode === "dark" ? { r: 17, g: 16, b: 15 } : { r: 251, g: 247, b: 242 };
    if (rgb && contrastRatio(rgb, background) >= 4.5) return safeColor(accent, "#bf8428");
    return colorMode === "dark" ? "#f7f1eb" : "#191714";
  }

  function highlightAccentColor(accent, colorMode) {
    const rgb = hexToRgb(accent);
    if (!rgb) return colorMode === "dark" ? "#ffb78a" : "#ff7628";
    if (colorMode === "dark") return rgbToHex(mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.86));
    return safeColor(accent, "#ff7628");
  }

  function readableOnAccentColor(accent) {
    const rgb = hexToRgb(accent);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 25, g: 23, b: 20 };
    return contrastRatio(rgb, white) >= contrastRatio(rgb, black) ? "#ffffff" : "#191714";
  }

  function normalizeSiteBackground(value) {
    const mode = String(value || "").toLowerCase();
    return SITE_BACKGROUND_VALUES.includes(mode) ? mode : DEFAULT_SITE_SETTINGS.background;
  }

  function siteBackgroundLabel(value) {
    return settingsOptionLabel(normalizeSiteBackground(value), SITE_BACKGROUND_OPTIONS, "Matrix");
  }

  function normalizeSiteSettings(value) {
    const raw = value && typeof value === "object" ? value : {};
    const background = normalizeSiteBackground(raw.background);
    const cursor = ["ring", "dot", "crosshair", "default"].includes(raw.cursor) ? raw.cursor : DEFAULT_SITE_SETTINGS.cursor;
    const performanceMode = ["auto", "standard", "low"].includes(raw.performanceMode) ? raw.performanceMode : DEFAULT_SITE_SETTINGS.performanceMode;
    return {
      ...DEFAULT_SITE_SETTINGS,
      ...raw,
      background,
      cursor,
      performanceMode,
      adsDisabled: raw.adsDisabled !== false,
      reduceMotion: raw.reduceMotion === true,
      inactiveTitle: String(raw.inactiveTitle || DEFAULT_SITE_SETTINGS.inactiveTitle).slice(0, 80),
      inactiveIcon: safeDataImage(raw.inactiveIcon) || (/^https?:\/\/[^\s"'<>]+$/i.test(String(raw.inactiveIcon || "")) ? String(raw.inactiveIcon).trim() : ""),
      logoData: safeDataImage(raw.logoData) || "",
      logoName: String(raw.logoName || "").slice(0, 80)
    };
  }

  function siteSettings() {
    return normalizeSiteSettings(readJson(SITE_SETTINGS_KEY, null));
  }

  function setSiteSettingsPatch(patch) {
    const next = normalizeSiteSettings({ ...siteSettings(), ...(patch || {}) });
    writeJson(SITE_SETTINGS_KEY, next);
    applySiteSettingsPreferences(next);
    requestChatFrameSync();
    window.dispatchEvent(new CustomEvent("learningzones:site-settings", { detail: next }));
    window.dispatchEvent(new CustomEvent("learningzones:site-appearance", { detail: siteAppearancePayload() }));
    if (patch && Object.prototype.hasOwnProperty.call(patch, "background")) {
      window.dispatchEvent(new CustomEvent("learningzones:site-background", { detail: { background: next.background } }));
    }
    if (isSettingsRoute() && document.getElementById("lz-site-settings-page")) {
      clearTimeout(siteSettingsRenderTimer);
      renderSiteSettingsPage();
    } else {
      scheduleSiteSettingsRender();
    }
    return next;
  }

  function setDocumentFavicon(url) {
    let link = document.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = url || siteDefaultFavicon || "/icons/icon-192.png";
  }

  function applyInactiveTabSettings(settings = siteSettings()) {
    if (!siteDefaultTitle) siteDefaultTitle = document.title || "Learning Zones";
    if (!siteDefaultFavicon) siteDefaultFavicon = document.querySelector('link[rel~="icon"]')?.href || "/icons/icon-192.png";
    const hidden = document.visibilityState === "hidden";
    document.documentElement.dataset.lzTabInactive = hidden ? "true" : "false";
    if (hidden) {
      document.title = settings.inactiveTitle || "Home";
      if (settings.inactiveIcon) setDocumentFavicon(settings.inactiveIcon);
      return;
    }
    if (document.documentElement.dataset.lzSettingsRoute === "true") document.title = "Settings - Learning Zones";
    else if (siteDefaultTitle && document.title === (settings.inactiveTitle || "Home")) document.title = siteDefaultTitle;
    setDocumentFavicon(siteDefaultFavicon);
  }

  function applySiteLogoToHeader(settings = siteSettings()) {
    const brandIcon = document.querySelector('[data-testid="brand-link"] > span:first-child');
    if (!brandIcon) return;
    if (!brandIcon.dataset.lzOriginalHtml) brandIcon.dataset.lzOriginalHtml = brandIcon.innerHTML;
    if (settings.logoData) {
      brandIcon.classList.add("lz-brand-logo-custom");
      brandIcon.innerHTML = `<img alt="" src="${escapeHtml(settings.logoData)}">`;
    } else if (brandIcon.classList.contains("lz-brand-logo-custom")) {
      brandIcon.classList.remove("lz-brand-logo-custom");
      brandIcon.innerHTML = brandIcon.dataset.lzOriginalHtml || brandIcon.innerHTML;
    }
  }

  function applySiteSettingsPreferences(settings = siteSettings()) {
    const clean = normalizeSiteSettings(settings);
    const root = document.documentElement;
    root.dataset.lzBackground = clean.background;
    root.dataset.lzCursor = clean.cursor;
    root.dataset.lzAdsDisabled = clean.adsDisabled ? "true" : "false";
    root.dataset.lzReduceMotion = clean.reduceMotion ? "true" : "false";
    root.dataset.lzPerformanceMode = clean.performanceMode;
    if (document.body) {
      document.body.dataset.lzBackground = clean.background;
      document.body.dataset.lzCursor = clean.cursor;
    }
    applySiteLogoToHeader(clean);
    applyInactiveTabSettings(clean);
    applyChromebookMode();
    scheduleScrollReveal(document, 80);
    return clean;
  }

  function setSiteSessionUsername(username, source = "chat-link") {
    const clean = String(username || "").trim();
    if (!clean) return false;
    const existing = readJson("ugp_session", {}) || {};
    const role = isOwnerName(clean) ? "owner" : (existing.role || "user");
    const status = role === "owner" ? "approved" : (existing.status || "approved");
    try {
      localStorage.setItem("ugp_token", "static-firebase:" + encodeURIComponent(clean));
    } catch (error) {}
    writeJson("ugp_session", {
      ...existing,
      id: key(clean),
      username: clean,
      role,
      status,
      accountLinkSource: source,
      accountLinkUpdatedAt: Date.now()
    });
    window.dispatchEvent(new CustomEvent("learningzones:site-session-linked", { detail: { username: clean, source } }));
    return true;
  }

  function loginUsernameInput() {
    const form = loginFormElement();
    return form?.querySelector('[data-testid="username-input"], input[name="username"], input[name="user"], input[autocomplete="username"], input[type="text"]') || null;
  }

  function loginPasswordInput() {
    const form = loginFormElement();
    return form?.querySelector('[data-testid="password-input"], input[type="password"]') || null;
  }

  function clearPendingSiteChatCredential() {
    if (pendingSiteChatCredential) pendingSiteChatCredential.password = "";
    pendingSiteChatCredential = null;
    window.clearTimeout(siteChatCredentialSyncTimer);
    siteChatCredentialSyncTimer = 0;
  }

  function pendingSiteChatPassword(username) {
    const pending = pendingSiteChatCredential;
    if (!pending || Date.now() - pending.capturedAt > SITE_CHAT_CREDENTIAL_TTL_MS) {
      clearPendingSiteChatCredential();
      return "";
    }
    return key(pending.username) === key(username) ? pending.password : "";
  }

  function scheduleSiteChatCredentialSync() {
    window.clearTimeout(siteChatCredentialSyncTimer);
    const run = () => {
      const pending = pendingSiteChatCredential;
      if (!pending || Date.now() - pending.capturedAt > SITE_CHAT_CREDENTIAL_TTL_MS) {
        clearPendingSiteChatCredential();
        return;
      }
      const session = readJson("ugp_session", null);
      const sessionUser = cleanAccountName(session?.username || session?.id || tokenUsername());
      const currentSessionValue = (() => {
        try {
          return localStorage.getItem("ugp_session") || "";
        } catch (error) {
          return "";
        }
      })();
      const loginAccepted = currentSessionValue !== pending.sessionAtCapture || !isLoginSurface();
      if (loginAccepted && sessionUser && key(sessionUser) === key(pending.username)) {
        if (!session?.username) setSiteSessionUsername(sessionUser, "site-login");
        const previous = accountLinkPreference();
        writeJson(LINK_KEY, {
          ...previous,
          mode: "site",
          username: sessionUser,
          siteUsername: sessionUser,
          updatedAt: Date.now()
        });
        chatLinkStatusMessage = "Checking your matching chat account...";
        renderAccountLinkCards();
        requestChatFrameSync();
        return;
      }
      siteChatCredentialSyncTimer = window.setTimeout(run, 160);
    };
    siteChatCredentialSyncTimer = window.setTimeout(run, 0);
  }

  function adoptEarlySiteChatCredential() {
    const early = window.__learningZonesPendingLoginCredential;
    if (!early || pendingSiteChatCredential) return false;
    const username = cleanAccountName(early.username || "");
    const password = String(early.password || "");
    if (!username || !password || Date.now() - Number(early.capturedAt || 0) > SITE_CHAT_CREDENTIAL_TTL_MS) {
      try { delete window.__learningZonesPendingLoginCredential; } catch (error) {}
      return false;
    }
    pendingSiteChatCredential = {
      username,
      password,
      capturedAt: Number(early.capturedAt || Date.now()),
      sessionAtCapture: String(early.sessionAtCapture || "")
    };
    early.password = "";
    try { delete window.__learningZonesPendingLoginCredential; } catch (error) {}
    chatLinkStatusMessage = "Site login accepted. Chat will verify the same username and password.";
    scheduleSiteChatCredentialSync();
    return true;
  }

  function captureSiteChatCredential() {
    const form = loginFormElement();
    if (!form || !form.matches('[data-testid="login-form"]')) return false;
    const username = cleanAccountName(loginUsernameInput()?.value || "");
    const password = String(loginPasswordInput()?.value || "");
    if (!username || !password) return false;
    let sessionAtCapture = "";
    try {
      sessionAtCapture = localStorage.getItem("ugp_session") || "";
    } catch (error) {}
    clearPendingSiteChatCredential();
    pendingSiteChatCredential = { username, password, capturedAt: Date.now(), sessionAtCapture };
    chatLinkStatusMessage = "Site login accepted. Chat will verify the same username and password.";
    scheduleSiteChatCredentialSync();
    return true;
  }

  function setLoginAuthError(message) {
    const form = loginFormElement();
    if (!form) return;
    let error = form.querySelector('[data-testid="auth-error"]');
    if (!error) {
      error = document.createElement("p");
      error.dataset.testid = "auth-error";
      error.className = "mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2";
      const submit = form.querySelector('[data-testid="login-submit"], button[type="submit"]');
      (submit?.parentElement || form).insertBefore(error, submit || null);
    }
    error.textContent = message || "";
  }

  async function sha256Hex(text) {
    if (!window.crypto?.subtle || typeof TextEncoder === "undefined") return "";
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function tryOfflineSiteLogin(reason = "fallback") {
    if (!isLoginSurface()) return false;
    const usernameInput = loginUsernameInput();
    const passwordInput = loginPasswordInput();
    const username = cleanAccountName(usernameInput?.value || "");
    const password = String(passwordInput?.value || "");
    if (!username || !password) return false;
    const account = OFFLINE_AUTH_ACCOUNTS.find(item => key(item.id || item.username) === key(username));
    if (!account) return false;
    const hash = await sha256Hex(`${account.salt}\n${password}`);
    if (!hash || hash !== account.passwordSha256) {
      setLoginAuthError("Wrong password");
      return true;
    }
    setSiteSessionUsername(account.username, `offline-${reason}`);
    writeJson(LINK_KEY, {
      mode: "site",
      username: account.username,
      siteUsername: account.username,
      chatUsername: account.username,
      updatedAt: Date.now()
    });
    writeJson("ugp_session", {
      id: account.id || key(account.username),
      username: account.username,
      role: account.role || "user",
      status: account.status || "approved",
      accountLinkSource: `offline-${reason}`,
      accountLinkUpdatedAt: Date.now()
    });
    setLoginAuthError("");
    window.dispatchEvent(new CustomEvent("learningzones:offline-login", { detail: { username: account.username, reason } }));
    window.location.replace("/");
    return true;
  }

  function scheduleOfflineSiteLogin(reason) {
    [700, 1800, 3500].forEach(delay => {
      setTimeout(() => {
        tryOfflineSiteLogin(reason).catch(error => console.warn("Offline site login skipped:", error));
      }, delay);
    });
  }

  function watchOfflineSiteLoginFallback() {
    if (window.__learningZonesOfflineLoginWatch) return;
    window.__learningZonesOfflineLoginWatch = true;
    adoptEarlySiteChatCredential();
    document.addEventListener("submit", event => {
      if (!event.target?.matches?.('[data-testid="login-form"], form')) return;
      captureSiteChatCredential();
      scheduleOfflineSiteLogin("submit");
    }, true);
    document.addEventListener("click", event => {
      if (!event.target?.closest?.('[data-testid="login-submit"], button[type="submit"]')) return;
      captureSiteChatCredential();
      scheduleOfflineSiteLogin("click");
    }, true);
    document.addEventListener("keydown", event => {
      if (event.key !== "Enter" || !event.target?.matches?.('[data-testid="password-input"], input[type="password"]')) return;
      captureSiteChatCredential();
      scheduleOfflineSiteLogin("enter");
    }, true);
    let authErrorTimer = 0;
    new MutationObserver(mutations => {
      if (!isLoginSurface() || !mutationAddsMatching(mutations, '[data-testid="auth-error"], [role="alert"], form')) return;
      clearTimeout(authErrorTimer);
      authErrorTimer = setTimeout(() => {
        runWhenMainThreadFree(() => {
          const text = String(document.querySelector('[data-testid="auth-error"]')?.textContent || "");
          if (/login failed|network|failed to fetch/i.test(text)) scheduleOfflineSiteLogin("auth-error");
        }, 500);
      }, 120);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function linkedChatLoginPayload() {
    const state = accountLinkState();
    const username = state.username;
    if (!username) return null;
    const siteSession = readJson("ugp_session", null) || {};
    const siteSessionUsername = cleanAccountName(siteSession.username || siteSession.id || "");
    const verifiedSiteUsername = state.mode === "site" && siteSessionUsername && key(siteSessionUsername) === key(username)
      ? siteSessionUsername
      : "";
    return {
      type: "learning-zones-chat-login",
      version: 2,
      username,
      siteUsername: state.siteUsername,
      chatUsername: state.chatUsername,
      mode: state.mode,
      force: state.mode === "site",
      password: verifiedSiteUsername ? pendingSiteChatPassword(verifiedSiteUsername) : "",
      at: Date.now()
    };
  }

  function handleChatLinkResult(data = {}) {
    const username = cleanAccountName(data.username || "");
    const activeSiteUsername = cleanAccountName(readJson("ugp_session", null)?.username || "");
    if (!username || !activeSiteUsername || key(username) !== key(activeSiteUsername)) return;
    if (data.status !== "network-error") clearPendingSiteChatCredential();
    chatLinkStatusMessage = cleanAccountName(data.message || "");
    const previous = accountLinkPreference();
    writeJson(LINK_KEY, {
      ...previous,
      mode: "site",
      username: activeSiteUsername,
      siteUsername: activeSiteUsername,
      chatUsername: data.status === "ready" || data.status === "created" ? username : previous.chatUsername,
      linkStatus: cleanAccountName(data.status || ""),
      linkCheckedAt: Date.now(),
      updatedAt: Date.now()
    });
    renderAccountLinkCards();
    if (data.status === "ready" || data.status === "created") {
      hydrateFromFirebase(username).catch(() => {});
    }
  }

  function profileMediaStamp(source = {}) {
    return Math.max(
      0,
      Number(source.profileMediaUpdatedAt || 0),
      Number(source.mediaUpdatedAt || 0)
    );
  }

  function profileMediaPayload(snapshot = profileSnapshot()) {
    const username = snapshot?.username || loggedInUsername();
    if (!username) return null;
    const profile = normalizedSiteProfile(snapshot?.profile || {});
    return {
      type: "learning-zones-profile-media",
      version: 1,
      username,
      profile: {
        avatar: profile.avatar,
        banner: profile.banner,
        bannerColor: profile.bannerColor,
        bannerImage: profile.bannerImage,
        mediaUpdatedAt: profile.mediaUpdatedAt,
        updatedAt: profile.updatedAt
      }
    };
  }

  function isChatFrameElement(frame) {
    if (!frame?.matches) return false;
    return frame.matches(
      'iframe[data-testid="chat-iframe"], iframe[data-lz-chat-overlay-frame="true"], iframe[src*="page-embed.html?page=chat"], iframe[src*="page=chat"]'
    );
  }

  function isChatFrameSource(source) {
    if (!source) return false;
    return Array.from(document.querySelectorAll("iframe"))
      .some(frame => isChatFrameElement(frame) && frame.contentWindow === source);
  }

  function handleChatProfileMediaUpdate(data = {}, source = null) {
    if (!isChatFrameSource(source)) return false;
    const activeUsername = loggedInUsername();
    const username = String(data.username || "").trim();
    if (!activeUsername || !username || key(activeUsername) !== key(username)) return false;

    const current = profileSnapshot();
    const currentProfile = normalizedSiteProfile(current.profile || {});
    const incoming = normalizedSiteProfile(data.profile || {});
    const incomingStamp = profileMediaStamp(incoming);
    const currentStamp = profileMediaStamp(currentProfile);
    if (incomingStamp && currentStamp && incomingStamp < currentStamp) return false;

    const nextProfile = {
      ...currentProfile,
      avatar: incoming.avatar,
      banner: incoming.banner,
      bannerColor: incoming.bannerColor,
      bannerImage: incoming.bannerImage,
      mediaUpdatedAt: incomingStamp || Date.now(),
      updatedAt: Math.max(Number(currentProfile.updatedAt || 0), Number(incoming.updatedAt || 0), incomingStamp)
    };
    applySnapshot({
      ...current,
      id: current.id || key(username),
      username,
      profile: nextProfile,
      source: "chat-profile-media"
    }, { skipCloud: true });
    ensureSiteProfileButton();
    contentRenderReset();
    renderSiteProfile();
    return true;
  }

  function headerUsername() {
    const explicit = document.querySelector('[data-testid="nav-username"]');
    const text = String(explicit?.textContent || "").trim();
    const match = text.match(/@([A-Za-z0-9_]+)/);
    return match ? match[1] : "";
  }

  function compactAccount(account, id) {
    if (!account) return null;
    const streak = streakProfilePatch(account);
    return {
      id: id || key(account.username),
      username: String(account.username || id || ""),
      avatar: accountAvatar(account),
      presence: String(account.status || "off"),
      mood: String(account.mood || "Social"),
      role: String(account.role || "member"),
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      streak: streak.streak
    };
  }

  function makeSnapshot(user) {
    if (!user) return null;
    const userId = key(user.id || user.username);
    const profile = normalizedSiteProfile(user.profile || user || {});
    const streak = streakProfilePatch(user.streak || profile.streak || profile || user);
    const profileWithStreak = { ...profile, ...streak };
    const friends = user.friends || {};
    return {
      version: 2,
      id: userId,
      username: String(user.username || userId),
      role: String(user.role || "user"),
      status: String(user.status || "pending"),
      profile: profileWithStreak,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      streak: streak.streak,
      friends: {
        count: Number(friends.count || (friends.users || []).length || 0),
        users: Array.isArray(friends.users) ? friends.users : []
      },
      requests: {
        incoming: Array.isArray(friends.incoming) ? friends.incoming : [],
        outgoing: Array.isArray(friends.outgoing) ? friends.outgoing : []
      },
      updatedAt: Date.now(),
      source: "chat"
    };
  }

  function inlineDataTooLarge(value, limit) {
    return typeof value === "string" && /^data:/i.test(value) && value.length > limit;
  }

  function compactSnapshotForCloud(snapshot) {
    const clean = JSON.parse(JSON.stringify(snapshot || {}));
    delete clean.user;
    delete clean.account;
    if (clean.profile && typeof clean.profile === "object") {
      if (inlineDataTooLarge(clean.profile.avatar, PROFILE_SYNC_AVATAR_MAX_CHARS)) clean.profile.avatar = "";
      if (inlineDataTooLarge(clean.profile.bannerImage, PROFILE_SYNC_BANNER_MAX_CHARS)) clean.profile.bannerImage = "";
    }
    const friends = clean.friends || {};
    ["users", "incoming", "outgoing"].forEach(listName => {
      if (!Array.isArray(friends[listName])) return;
      friends[listName].forEach(friend => {
        if (inlineDataTooLarge(friend?.avatar, PROFILE_SYNC_AVATAR_MAX_CHARS)) friend.avatar = "";
      });
    });
    return clean;
  }

  function snapshotMatchesActiveUser(snapshot) {
    if (!snapshot) return true;
    const active = sessionUsername() || headerUsername();
    if (!active) return true;
    return key(snapshot.username || snapshot.id) === key(active);
  }

  function clearStaleProfileCache() {
    [CACHE_KEY, USER_KEY, PROFILE_KEY, FRIENDS_KEY, REQUESTS_KEY].forEach(storageKey => {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {}
    });
  }

  function applySnapshot(snapshot, options = {}) {
    const normalizedSnapshot = makeSnapshot(snapshot);
    if (normalizedSnapshot && !snapshotMatchesActiveUser(normalizedSnapshot)) {
      clearStaleProfileCache();
      currentSnapshot = null;
      return;
    }
    currentSnapshot = normalizedSnapshot || null;
    writeJson(CACHE_KEY, currentSnapshot);
    const friends = currentSnapshot?.friends || { count: 0, users: [] };
    const requests = currentSnapshot?.requests || { incoming: [], outgoing: [] };
    writeJson(USER_KEY, currentSnapshot ? {
      id: currentSnapshot.id,
      username: currentSnapshot.username,
      role: currentSnapshot.role,
      status: currentSnapshot.status,
      displayOnly: true,
      profile: currentSnapshot.profile,
      friends: {
        count: Number(friends.count || 0),
        users: Array.isArray(friends.users) ? friends.users : [],
        incoming: Array.isArray(requests.incoming) ? requests.incoming : [],
        outgoing: Array.isArray(requests.outgoing) ? requests.outgoing : []
      }
    } : null);
    writeJson(PROFILE_KEY, currentSnapshot ? currentSnapshot.profile : null);
    writeJson(FRIENDS_KEY, currentSnapshot ? currentSnapshot.friends : null);
    writeJson(REQUESTS_KEY, currentSnapshot ? currentSnapshot.requests : null);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: currentSnapshot }));
    if (isChatRoute() || isSettingsRoute()) startSpectateRealtime();
    if (currentSnapshot && !options.skipCloud) persistSnapshot(currentSnapshot);
    if (currentSnapshot) scheduleWhatsHappeningCard(currentSnapshot);
  }

  async function persistSnapshot(snapshot) {
    if (!snapshot || !snapshot.id) return;
    const body = JSON.stringify(compactSnapshotForCloud(snapshot));
    try {
      await fetchWithTimeout(firebaseUrl(["siteSync", "chatProfiles", snapshot.id]), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body
      }, 1200);
    } catch (error) {
      console.warn("Learning Zones cloud sync skipped:", error);
    }
  }

  function relationOther(record, userId) {
    return ((record && record.users) || []).find(item => item !== userId) || "";
  }

  async function fetchJson(url, timeoutMs = FIREBASE_REQUEST_TIMEOUT_MS) {
    const res = await fetchWithTimeout(url, { cache: "no-store" }, timeoutMs);
    if (!res.ok) return null;
    return res.json();
  }

  function ratingPathKey(slug) {
    return String(slug || "")
      .trim()
      .toLowerCase()
      .replace(/%2f/gi, "_")
      .replace(/[.#$\[\]\/\\]+/g, "_")
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120);
  }

  function ratingUserId() {
    return key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
  }

  function normalizeRatingValue(value) {
    const raw = value && typeof value === "object" ? value.value : value;
    const rating = Math.round(Number(raw || 0));
    return rating >= 1 && rating <= 5 ? rating : 0;
  }

  function emptyRatingAggregate() {
    return {
      sum: 0,
      count: 0,
      avg: 0,
      counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      updatedAt: 0
    };
  }

  function normalizeRatingAggregate(raw) {
    if (!raw || typeof raw !== "object") return emptyRatingAggregate();
    const counts = {};
    for (let rating = 1; rating <= 5; rating += 1) {
      counts[rating] = Math.max(0, Math.round(Number(raw.counts?.[rating] || raw.counts?.[String(rating)] || 0)));
    }
    const countedCount = Object.values(counts).reduce((sum, item) => sum + item, 0);
    const countedSum = Object.entries(counts).reduce((sum, [rating, item]) => sum + (Number(rating) * item), 0);
    let count = Math.max(0, Math.round(Number(raw.count || 0)));
    let sum = Math.max(0, Math.round(Number(raw.sum || 0)));
    if ((!count || !sum) && countedCount) {
      count = countedCount;
      sum = countedSum;
    }
    if (count > 0 && sum <= 0) sum = countedSum;
    const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    return {
      sum,
      count,
      avg,
      counts,
      updatedAt: Math.max(0, Math.round(Number(raw.updatedAt || 0)))
    };
  }

  function applyRatingChange(aggregate, previousValue, nextValue) {
    const next = normalizeRatingAggregate(aggregate);
    const previous = normalizeRatingValue(previousValue);
    const value = normalizeRatingValue(nextValue);
    if (!value) return next;
    if (previous && previous !== value) {
      next.counts[previous] = Math.max(0, Number(next.counts[previous] || 0) - 1);
      next.sum = Math.max(0, next.sum - previous);
      next.count = Math.max(0, next.count - 1);
    }
    if (previous !== value || next.count === 0) {
      next.counts[value] = Math.max(0, Number(next.counts[value] || 0)) + 1;
      next.sum += value;
      next.count += 1;
    }
    next.avg = next.count > 0 ? Math.round((next.sum / next.count) * 10) / 10 : 0;
    next.updatedAt = Date.now();
    return next;
  }

  async function fetchJsonWithEtag(url, timeoutMs = FIREBASE_REQUEST_TIMEOUT_MS) {
    const response = await fetchWithTimeout(url, {
      cache: "no-store",
      headers: { "X-Firebase-ETag": "true" }
    }, timeoutMs);
    if (!response.ok) return { data: null, etag: "" };
    return {
      data: await response.json().catch(() => null),
      etag: response.headers.get("ETag") || ""
    };
  }

  async function putFirebaseJson(url, value, etag = "", timeoutMs = FIREBASE_REQUEST_TIMEOUT_MS) {
    const headers = { "Content-Type": "application/json" };
    if (etag) headers["if-match"] = etag;
    const response = await fetchWithTimeout(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(value)
    }, timeoutMs);
    if (response.status === 412) return { conflict: true, data: null };
    if (!response.ok) throw new Error(`rating_write_failed_${response.status}`);
    return { conflict: false, data: await response.json().catch(() => value) };
  }

  async function postFirebaseJson(url, value, timeoutMs = 4000) {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    }, timeoutMs);
    if (!response.ok) throw new Error(`message_write_failed_${response.status}`);
    return response.json().catch(() => null);
  }

  async function sendOverlayMessageThroughSite(text, roomId) {
    let token = "";
    try {
      token = localStorage.getItem("ugp_token") || "";
    } catch (error) {}
    if (!token) throw new Error("login_required");
    const response = await fetchWithTimeout("/.netlify/functions/send-chat-message", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, roomId })
    }, 6500);
    const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
    if (response.status === 404 || contentType.includes("text/html")) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.code || `send_failed_${response.status}`));
    if (!payload?.message) throw new Error("send_failed_write");
    return { message: payload.message, messages: [payload.message] };
  }

  function saveRatingCaches() {
    writeJson(RATING_CACHE_KEY, ratingCache);
    writeJson(RATING_USER_CACHE_KEY, ratingUserCache);
  }

  function mountedRatingItemKeys() {
    const pageKeys = Array.from(new Set(Array.from(document.querySelectorAll("[data-lz-zone-rating-page]"))
      .map(host => ratingPathKey(host.dataset.lzZoneRatingKey || host.dataset.lzZoneRating || ""))
      .filter(Boolean)));
    if (pageKeys.length) return pageKeys;
    const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
    return Array.from(new Set(Array.from(document.querySelectorAll("[data-lz-zone-rating-card]"))
      .filter(host => {
        const rect = host.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom >= -160 && rect.top <= viewportHeight + 700;
      })
      .map(host => ratingPathKey(host.dataset.lzZoneRatingKey || host.dataset.lzZoneRating || ""))
      .filter(Boolean)));
  }

  function isFirebaseTimeout(error) {
    const message = String(error?.message || error || "");
    return /firebase_request_timeout|abort/i.test(message);
  }

  function noteRatingReadFailure(error) {
    if (!isFirebaseTimeout(error)) return false;
    ratingHydrationCooldownUntil = Date.now() + RATING_TIMEOUT_COOLDOWN_MS;
    return true;
  }

  function warnRatingReadSkipped(label, itemKey, error) {
    if (noteRatingReadFailure(error)) {
      const now = Date.now();
      if (now > ratingTimeoutWarningUntil) {
        ratingTimeoutWarningUntil = now + RATING_TIMEOUT_COOLDOWN_MS;
        console.debug(`${label} paused after Firebase timeout:`, error);
      }
      return;
    }
    console.warn(`${label}:`, itemKey, error);
  }

  async function runRatingKeyBatch(keys, worker, size = 2) {
    for (let index = 0; index < keys.length; index += size) {
      if (ratingHydrationCooldownUntil > Date.now()) break;
      await Promise.all(keys.slice(index, index + size).map(worker));
    }
  }

  async function loadRatingAggregates(force = false, itemKeys = mountedRatingItemKeys()) {
    const now = Date.now();
    if (!ratingCache || typeof ratingCache !== "object") ratingCache = { loadedAt: 0, items: {} };
    if (!ratingCache.items || typeof ratingCache.items !== "object") ratingCache.items = {};
    if (!ratingCache.keyLoadedAt || typeof ratingCache.keyLoadedAt !== "object") ratingCache.keyLoadedAt = {};
    if (!force && ratingHydrationCooldownUntil > now) return ratingCache.items;
    const keys = Array.from(new Set((itemKeys || []).map(ratingPathKey).filter(Boolean))).slice(0, RATING_HYDRATE_KEY_LIMIT);
    if (keys.length) {
      const staleKeys = keys.filter(itemKey => force || !ratingCache.keyLoadedAt[itemKey] || now - Number(ratingCache.keyLoadedAt[itemKey] || 0) > RATING_CACHE_TTL_MS);
      await runRatingKeyBatch(staleKeys, async itemKey => {
        const raw = await fetchJson(firebaseUrl([RATINGS_ROOT, itemKey]), RATING_READ_TIMEOUT_MS).catch(error => {
          warnRatingReadSkipped("Learning Zones rating item load", itemKey, error);
          return null;
        });
        ratingCache.items[itemKey] = normalizeRatingAggregate(raw);
        ratingCache.keyLoadedAt[itemKey] = Date.now();
      });
      ratingCache.loadedAt = Date.now();
      writeJson(RATING_CACHE_KEY, ratingCache);
      return ratingCache.items;
    }
    if (!force && ratingCache.loadedAt && now - ratingCache.loadedAt < RATING_CACHE_TTL_MS) return ratingCache.items;
    if (ratingsLoadPromise && !force) return ratingsLoadPromise;
    ratingsLoadPromise = fetchJson(firebaseUrl([RATINGS_ROOT]))
      .then(raw => {
        const items = {};
        Object.entries(raw || {}).forEach(([rawKey, value]) => {
          const itemKey = ratingPathKey(rawKey);
          if (itemKey) items[itemKey] = normalizeRatingAggregate(value);
        });
        const keyLoadedAt = {};
        Object.keys(items).forEach(itemKey => { keyLoadedAt[itemKey] = Date.now(); });
        ratingCache = { loadedAt: Date.now(), items, keyLoadedAt };
        writeJson(RATING_CACHE_KEY, ratingCache);
        return items;
      })
      .catch(error => {
        console.warn("Learning Zones ratings load skipped:", error);
        return ratingCache.items || {};
      });
    ratingsLoadPromise.then(() => { ratingsLoadPromise = null; }, () => { ratingsLoadPromise = null; });
    return ratingsLoadPromise;
  }

  async function loadUserRatings(force = false, itemKeys = mountedRatingItemKeys()) {
    const userId = ratingUserId();
    const now = Date.now();
    if (!userId) {
      ratingUserCache = { userId: "", loadedAt: now, items: {}, keyLoadedAt: {} };
      writeJson(RATING_USER_CACHE_KEY, ratingUserCache);
      return ratingUserCache.items;
    }
    if (!ratingUserCache || typeof ratingUserCache !== "object" || ratingUserCache.userId !== userId) {
      ratingUserCache = { userId, loadedAt: 0, items: {}, keyLoadedAt: {} };
    }
    if (!ratingUserCache.items || typeof ratingUserCache.items !== "object") ratingUserCache.items = {};
    if (!ratingUserCache.keyLoadedAt || typeof ratingUserCache.keyLoadedAt !== "object") ratingUserCache.keyLoadedAt = {};
    if (!force && ratingHydrationCooldownUntil > now) return ratingUserCache.items;
    const keys = Array.from(new Set((itemKeys || []).map(ratingPathKey).filter(Boolean))).slice(0, RATING_HYDRATE_KEY_LIMIT);
    if (keys.length) {
      const staleKeys = keys.filter(itemKey => force || !ratingUserCache.keyLoadedAt[itemKey] || now - Number(ratingUserCache.keyLoadedAt[itemKey] || 0) > RATING_CACHE_TTL_MS);
      await runRatingKeyBatch(staleKeys, async itemKey => {
        const rating = normalizeRatingValue(await fetchJson(firebaseUrl([RATING_USERS_ROOT, userId, itemKey]), RATING_READ_TIMEOUT_MS).catch(error => {
          warnRatingReadSkipped("Learning Zones user rating item load", itemKey, error);
          return null;
        }));
        if (rating) ratingUserCache.items[itemKey] = rating;
        else delete ratingUserCache.items[itemKey];
        ratingUserCache.keyLoadedAt[itemKey] = Date.now();
      });
      ratingUserCache.loadedAt = Date.now();
      writeJson(RATING_USER_CACHE_KEY, ratingUserCache);
      return ratingUserCache.items;
    }
    if (!force && ratingUserCache.loadedAt && now - ratingUserCache.loadedAt < RATING_CACHE_TTL_MS) return ratingUserCache.items;
    if (ratingUserLoadPromise && !force) return ratingUserLoadPromise;
    ratingUserLoadPromise = fetchJson(firebaseUrl([RATING_USERS_ROOT, userId]))
      .then(raw => {
        const items = {};
        Object.entries(raw || {}).forEach(([rawKey, value]) => {
          const itemKey = ratingPathKey(rawKey);
          const rating = normalizeRatingValue(value);
          if (itemKey && rating) items[itemKey] = rating;
        });
        const keyLoadedAt = {};
        Object.keys(items).forEach(itemKey => { keyLoadedAt[itemKey] = Date.now(); });
        ratingUserCache = { userId, loadedAt: Date.now(), items, keyLoadedAt };
        writeJson(RATING_USER_CACHE_KEY, ratingUserCache);
        return items;
      })
      .catch(error => {
        console.warn("Learning Zones user ratings load skipped:", error);
        return ratingUserCache.items || {};
      });
    ratingUserLoadPromise.then(() => { ratingUserLoadPromise = null; }, () => { ratingUserLoadPromise = null; });
    return ratingUserLoadPromise;
  }

  function zoneSlugFromHref(href) {
    if (!href) return "";
    try {
      const url = new URL(href, location.href);
      const match = url.pathname.match(/^\/zone\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1] || "") : "";
    } catch (error) {
      const match = String(href || "").split(/[?#]/)[0].match(/\/zone\/([^/]+)/i);
      return match ? decodeURIComponent(match[1] || "") : "";
    }
  }

  function zoneTitleFromSlug(slug) {
    const clean = String(slug || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return "this zone";
    return zoneWords(clean.replace(/\b[a-z]/g, letter => letter.toUpperCase()));
  }

  function ratingStarsHtml(score, selected = 0) {
    const fill = selected || Math.round(Number(score || 0));
    let html = "";
    for (let rating = 1; rating <= 5; rating += 1) {
      html += `<span class="${rating <= fill ? "is-filled" : ""}" aria-hidden="true">${rating <= fill ? "&#9733;" : "&#9734;"}</span>`;
    }
    return html;
  }

  function ratingCountLabel(count) {
    const value = Math.max(0, Math.round(Number(count || 0)));
    return value === 1 ? "1 rating" : `${value} ratings`;
  }

  function ratingSummaryText(aggregate) {
    const clean = normalizeRatingAggregate(aggregate);
    if (!clean.count) return "No ratings yet";
    return `${clean.avg.toFixed(1)} (${clean.count})`;
  }

  function ratingStatusForKey(itemKey) {
    const state = ratingSaveStates[itemKey] || {};
    return {
      message: String(state.message || ""),
      kind: state.kind || "",
      busy: state.busy === true
    };
  }

  function ensureRatingCaches(userId) {
    const now = Date.now();
    if (!ratingCache || typeof ratingCache !== "object") ratingCache = { loadedAt: 0, items: {}, keyLoadedAt: {} };
    if (!ratingCache.items || typeof ratingCache.items !== "object") ratingCache.items = {};
    if (!ratingCache.keyLoadedAt || typeof ratingCache.keyLoadedAt !== "object") ratingCache.keyLoadedAt = {};
    if (!ratingUserCache || typeof ratingUserCache !== "object" || ratingUserCache.userId !== userId) {
      ratingUserCache = { userId, loadedAt: now, items: {}, keyLoadedAt: {} };
    }
    if (!ratingUserCache.items || typeof ratingUserCache.items !== "object") ratingUserCache.items = {};
    if (!ratingUserCache.keyLoadedAt || typeof ratingUserCache.keyLoadedAt !== "object") ratingUserCache.keyLoadedAt = {};
  }

  function applyOptimisticRating(itemKey, rating, userId, previous) {
    ensureRatingCaches(userId);
    const savedAggregate = applyRatingChange(ratingCache.items[itemKey], previous, rating);
    const stamp = Date.now();
    ratingCache = {
      ...ratingCache,
      loadedAt: stamp,
      keyLoadedAt: { ...(ratingCache.keyLoadedAt || {}), [itemKey]: stamp },
      items: { ...(ratingCache.items || {}), [itemKey]: savedAggregate }
    };
    ratingUserCache = {
      ...ratingUserCache,
      userId,
      loadedAt: stamp,
      keyLoadedAt: { ...(ratingUserCache.keyLoadedAt || {}), [itemKey]: stamp },
      items: { ...(ratingUserCache.items || {}), [itemKey]: rating }
    };
    saveRatingCaches();
    renderZoneRatings();
    return savedAggregate;
  }

  function removeStaleZonePageRatings() {
    const itemKey = ratingPathKey(zoneSlugFromPath());
    let removed = false;
    document.querySelectorAll("[data-lz-zone-rating-page]").forEach(host => {
      if (!itemKey || host.dataset.lzZoneRatingKey !== itemKey) {
        host.remove();
        removed = true;
      }
    });
    return { itemKey, removed };
  }

  function renderZoneRatingWidget(host) {
    if (!host) return;
    const slug = host.dataset.lzZoneRating || "";
    const itemKey = host.dataset.lzZoneRatingKey || ratingPathKey(slug);
    const title = host.dataset.lzZoneRatingName || zoneTitleFromSlug(slug);
    const mode = host.dataset.lzZoneRatingMode || "card";
    const aggregate = normalizeRatingAggregate(ratingCache?.items?.[itemKey]);
    const userValue = normalizeRatingValue(ratingUserCache?.items?.[itemKey]);
    const status = ratingStatusForKey(itemKey);
    if (mode === "card") {
      const cardHtml = `
        <span class="lz-zone-rating-stars" aria-hidden="true">${ratingStarsHtml(aggregate.avg)}</span>
        <span class="lz-zone-rating-summary">${escapeHtml(ratingSummaryText(aggregate))}</span>
      `;
      setHtmlIfChanged(host, cardHtml);
      setAttributeIfChanged(host, "aria-label", aggregate.count ? `${title} average rating ${aggregate.avg.toFixed(1)} from ${ratingCountLabel(aggregate.count)}` : `${title} has no ratings yet`);
      return;
    }
    const selectedOrAverage = userValue || aggregate.avg;
    const buttons = [1, 2, 3, 4, 5].map(rating => {
      const filled = userValue ? rating <= userValue : rating <= Math.round(selectedOrAverage || 0);
      return `
        <button
          type="button"
          class="lz-zone-rating-star${filled ? " is-filled" : ""}${userValue === rating ? " is-selected" : ""}"
          data-lz-rating-value="${rating}"
          data-lz-rating-slug="${escapeHtml(slug)}"
          aria-label="Rate ${escapeHtml(title)} ${rating} star${rating === 1 ? "" : "s"}"
          aria-pressed="${userValue === rating ? "true" : "false"}"
          ${status.busy ? "disabled" : ""}
        >${filled ? "&#9733;" : "&#9734;"}</button>
      `;
    }).join("");
    const defaultStatus = status.message || (userValue ? `You: ${userValue}` : "");
    const pageHtml = `
      <div class="lz-zone-rating-copy">
        <span class="lz-zone-rating-kicker">Zone rating</span>
        <strong>${aggregate.count ? `${aggregate.avg.toFixed(1)} average` : "Rate this zone"}</strong>
        <span>${aggregate.count ? `Based on ${ratingCountLabel(aggregate.count)}.` : "Be the first to rate it."}</span>
      </div>
      <div class="lz-zone-rating-actions" role="radiogroup" aria-label="Rate ${escapeHtml(title)} from 1 to 5 stars">
        ${buttons}
      </div>
      <div class="lz-zone-rating-status ${escapeHtml(status.kind)}" role="status" aria-live="polite">${escapeHtml(defaultStatus)}</div>
    `;
    setHtmlIfChanged(host, pageHtml);
  }

  function renderZoneRatings() {
    document.querySelectorAll("[data-lz-zone-rating]").forEach(renderZoneRatingWidget);
  }

  async function hydrateZoneRatings(force = false) {
    if (!document.querySelector("[data-lz-zone-rating]")) return;
    if (zoneRatingsHydratePromise && !force) return zoneRatingsHydratePromise;
    const work = (async () => {
      const itemKeys = mountedRatingItemKeys();
      const tasks = [loadRatingAggregates(force, itemKeys)];
      if (document.querySelector("[data-lz-zone-rating-page]")) {
        tasks.push(loadUserRatings(force, itemKeys));
      }
      await Promise.all(tasks);
      renderZoneRatings();
    })();
    if (force) return work;
    zoneRatingsHydratePromise = work.finally(() => {
      zoneRatingsHydratePromise = null;
    });
    return zoneRatingsHydratePromise;
  }

  function setRatingSaveState(itemKey, state) {
    ratingSaveStates = { ...ratingSaveStates, [itemKey]: state || {} };
    renderZoneRatings();
  }

  function clearRatingSaveStateSoon(itemKey) {
    setTimeout(() => {
      if (!ratingSaveStates[itemKey] || ratingSaveStates[itemKey].busy) return;
      const nextStates = { ...ratingSaveStates };
      delete nextStates[itemKey];
      ratingSaveStates = nextStates;
      renderZoneRatings();
    }, 2400);
  }

  async function persistZoneRatingToCloud(itemKey, rating, userId, cachedPrevious, optimisticAggregate, token) {
    const userUrl = firebaseUrl([RATING_USERS_ROOT, userId, itemKey]);
    const aggregateUrl = firebaseUrl([RATINGS_ROOT, itemKey]);
    const freshPrevious = normalizeRatingValue(await fetchJson(userUrl, RATING_PREVIOUS_TIMEOUT_MS).catch(() => 0));
    const previous = freshPrevious || cachedPrevious;
    let savedAggregate = null;
    for (let attempt = 0; attempt < 2 && !savedAggregate; attempt += 1) {
      const current = await fetchJsonWithEtag(aggregateUrl, RATING_AGGREGATE_SAVE_TIMEOUT_MS).catch(() => ({
        data: optimisticAggregate || ratingCache?.items?.[itemKey] || null,
        etag: ""
      }));
      const nextAggregate = applyRatingChange(current.data, previous, rating);
      const result = await putFirebaseJson(aggregateUrl, nextAggregate, current.etag, RATING_AGGREGATE_SAVE_TIMEOUT_MS);
      if (result.conflict) continue;
      savedAggregate = normalizeRatingAggregate(result.data || nextAggregate);
    }
    if (!savedAggregate) throw new Error("rating_conflict");
    await putFirebaseJson(userUrl, rating, "", RATING_USER_SAVE_TIMEOUT_MS);
    if (normalizeRatingValue(ratingUserCache?.items?.[itemKey]) !== rating) return;
    const stamp = Date.now();
    ratingCache = {
      ...ratingCache,
      loadedAt: stamp,
      keyLoadedAt: { ...(ratingCache.keyLoadedAt || {}), [itemKey]: stamp },
      items: { ...(ratingCache.items || {}), [itemKey]: savedAggregate }
    };
    saveRatingCaches();
    if (ratingSaveStates[itemKey]?.token === token) {
      setRatingSaveState(itemKey, { message: "Saved.", kind: "ok", busy: false, token });
      clearRatingSaveStateSoon(itemKey);
    } else {
      renderZoneRatings();
    }
  }

  async function saveZoneRating(slug, value) {
    const cleanSlug = String(slug || "").trim();
    const itemKey = ratingPathKey(cleanSlug);
    const rating = normalizeRatingValue(value);
    const userId = ratingUserId();
    if (!itemKey || !rating) return;
    if (!userId) {
      setRatingSaveState(itemKey, { message: "Sign in to rate.", kind: "error", busy: false });
      clearRatingSaveStateSoon(itemKey);
      return;
    }
    const cachedPrevious = ratingUserCache?.userId === userId ? normalizeRatingValue(ratingUserCache?.items?.[itemKey]) : 0;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticAggregate = applyOptimisticRating(itemKey, rating, userId, cachedPrevious);
    setRatingSaveState(itemKey, { message: "Saved.", kind: "ok", busy: false, token });
    clearRatingSaveStateSoon(itemKey);
    persistZoneRatingToCloud(itemKey, rating, userId, cachedPrevious, optimisticAggregate, token).catch(error => {
      console.warn("Learning Zones rating save failed:", error);
      if (ratingSaveStates[itemKey]?.token !== token) return;
      setRatingSaveState(itemKey, { message: "Saved locally.", kind: "ok", busy: false, token });
      clearRatingSaveStateSoon(itemKey);
    });
  }

  function handleZoneRatingClick(event) {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const button = target?.closest?.("[data-lz-rating-value]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    if (button.disabled) return;
    saveZoneRating(button.dataset.lzRatingSlug || zoneSlugFromPath(), button.dataset.lzRatingValue);
  }

  function mountZoneCardRatings() {
    const cards = Array.from(document.querySelectorAll('a[data-testid^="game-tile-"][href*="/zone/"]:not([data-lz-rating-checked])'));
    if (!cards.length) return false;
    let mounted = false;
    cards.forEach(card => {
      card.dataset.lzRatingChecked = "true";
      if (card.querySelector("[data-lz-zone-rating-card]")) return;
      const slug = zoneSlugFromHref(card.getAttribute("href") || "");
      const itemKey = ratingPathKey(slug);
      if (!itemKey) return;
      const title = cleanAccountName(card.querySelector(".tile-title")?.textContent || card.querySelector("h3,h2,strong")?.textContent || zoneTitleFromSlug(slug));
      const host = document.createElement("div");
      host.className = "lz-zone-rating is-card";
      host.setAttribute("data-lz-zone-rating", slug);
      host.setAttribute("data-lz-zone-rating-card", "true");
      host.dataset.lzZoneRatingMode = "card";
      host.dataset.lzZoneRatingKey = itemKey;
      host.dataset.lzZoneRatingName = title || zoneTitleFromSlug(slug);
      host.setAttribute("role", "img");
      const target = card.querySelector(".tile-title")?.parentElement || card;
      target.appendChild(host);
      renderZoneRatingWidget(host);
      mounted = true;
    });
    return mounted;
  }

  function mountZonePageRating() {
    const slug = zoneSlugFromPath();
    const itemKey = ratingPathKey(slug);
    removeStaleZonePageRatings();
    if (!itemKey || isLoginSurface() || isSpectatorFrameRoute()) return false;
    let host = Array.from(document.querySelectorAll("[data-lz-zone-rating-page]")).find(item => item.dataset.lzZoneRatingKey === itemKey);
    const main = document.querySelector("main") || document.getElementById("root") || document.body;
    const heading = Array.from(main.querySelectorAll("h1")).find(isActuallyVisible);
    const title = cleanAccountName(heading?.textContent || zoneTitleFromSlug(slug));
    if (!host) {
      host = document.createElement("section");
      host.className = "lz-zone-rating is-page";
      host.setAttribute("data-lz-zone-rating-page", "true");
    }
    if (host.parentElement !== document.body) document.body.appendChild(host);
    host.setAttribute("data-lz-zone-rating", slug);
    host.dataset.lzZoneRatingMode = "page";
    host.dataset.lzZoneRatingKey = itemKey;
    host.dataset.lzZoneRatingName = title || zoneTitleFromSlug(slug);
    renderZoneRatingWidget(host);
    return true;
  }

  function syncZoneRatingsForRoute() {
    if (!document.body) return;
    removeStaleZonePageRatings();
    if (!isCatalogSurfaceRoute()) return;
    installChatOverlayStyles();
    mountGameCardCovers();
    refreshGameCoverImages();
    scheduleStaticMediaOptimization(document, 80);
    scheduleScrollReveal(document, 140);
    updateGameCoverState("ratings-sync");
    if (!gameCoverManifestLoaded) loadGameCoverManifest(false);
    const mountedPage = mountZonePageRating();
    const mountedCards = mountZoneCardRatings();
    if (mountedPage || mountedCards || document.querySelector("[data-lz-zone-rating]")) {
      const settleDelay = isChatRoute() || isSettingsRoute() ? 1200 : 8500;
      const remaining = settleDelay - (Date.now() - BOOT_STAMP);
      if (remaining <= 0) hydrateZoneRatings(false).catch(() => {});
      else scheduleZoneRatingsForRoute(Math.max(remaining, 1200));
    }
  }

  function scheduleZoneRatingsForRoute(delay = 120) {
    if (document.body && !zoneSlugFromPath()) removeStaleZonePageRatings();
    clearTimeout(ratingMountTimer);
    if (!isCatalogSurfaceRoute()) return;
    ratingMountTimer = setTimeout(() => runWhenMainThreadFree(syncZoneRatingsForRoute, 900), delay);
  }

  function watchZoneRatingsMount() {
    if (window.__learningZonesRatingsMountWatch) return;
    window.__learningZonesRatingsMountWatch = true;
    document.addEventListener("click", handleZoneRatingClick, true);
    window.addEventListener(SYNC_EVENT, () => {
      if (!isCatalogSurfaceRoute()) return;
      if (!document.querySelector("[data-lz-zone-rating-page]")) {
        renderZoneRatings();
        return;
      }
      loadUserRatings(true, mountedRatingItemKeys()).then(renderZoneRatings).catch(() => {});
    });
    new MutationObserver(mutations => {
      if (isCatalogSurfaceRoute() && mutationAddsMatching(mutations, '[data-testid="games-grid"], a[data-testid^="game-tile-"], [data-testid="game-iframe"], [data-lz-zone-rating]')) {
        scheduleZoneRatingsForRoute(180);
      }
    }).observe(document.getElementById("root") || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function gameCoverHash(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function gameCoverPalette(slug) {
    const palettes = [
      ["#1f6feb", "#22c55e", "#f8fafc"],
      ["#e11d48", "#f59e0b", "#fff7ed"],
      ["#0f766e", "#38bdf8", "#ecfeff"],
      ["#7c3aed", "#f472b6", "#faf5ff"],
      ["#334155", "#14b8a6", "#f8fafc"],
      ["#b45309", "#84cc16", "#fff7ed"],
      ["#0f172a", "#f97316", "#f8fafc"],
      ["#be123c", "#6366f1", "#fff1f2"]
    ];
    return palettes[gameCoverHash(slug) % palettes.length];
  }

  function gameCoverKind(title) {
    const text = String(title || "").toLowerCase();
    if (/\b(2048|puzzle|word|chess|checkers|sudoku|logic|maze|connect|sort|match)\b/.test(text)) return "puzzle";
    if (/\b(car|race|rider|drive|drift|truck|bike|moto|kart|wheel)\b/.test(text)) return "racing";
    if (/\b(ball|soccer|football|basket|tennis|golf|baseball|volley|pool|bowling)\b/.test(text)) return "sports";
    if (/\b(mario|sonic|run|jump|platform|vex|dash|parkour)\b/.test(text)) return "platform";
    if (/\b(minecraft|craft|build|sandbox|tycoon|factory|city|world)\b/.test(text)) return "build";
    if (/\b(fnf|music|dance|rhythm|beat|song)\b/.test(text)) return "music";
    if (/\b(war|battle|fight|shooter|doom|combat|zombie|ninja|mortal|attack)\b/.test(text)) return "action";
    return "arcade";
  }

  function gameCoverInitials(title) {
    const words = String(title || "")
      .replace(/[^a-z0-9 ]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const initials = words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
    return initials || "LZ";
  }

  function gameCoverIcon(kind) {
    const icons = {
      puzzle: '<rect x="20" y="18" width="20" height="20" rx="4"></rect><rect x="44" y="18" width="20" height="20" rx="4"></rect><rect x="20" y="42" width="20" height="20" rx="4"></rect><rect x="44" y="42" width="20" height="20" rx="4"></rect>',
      racing: '<circle cx="32" cy="46" r="12"></circle><circle cx="88" cy="46" r="12"></circle><path d="M24 46h8l14-18h30l18 18h8"></path><path d="M50 28l-6 18h36l-8-18"></path>',
      sports: '<circle cx="60" cy="40" r="26"></circle><path d="M36 30c14 7 32 7 48 0"></path><path d="M36 50c14-7 32-7 48 0"></path><path d="M60 14c-10 14-10 38 0 52"></path>',
      platform: '<path d="M22 52h28v10H22z"></path><path d="M62 42h34v10H62z"></path><path d="M44 28h24v10H44z"></path><circle cx="34" cy="42" r="8"></circle>',
      build: '<path d="M28 28l32-14 32 14-32 14z"></path><path d="M28 28v28l32 14V42z"></path><path d="M92 28v28L60 70V42z"></path>',
      music: '<path d="M44 58V20l38-8v38"></path><circle cx="36" cy="58" r="10"></circle><circle cx="74" cy="50" r="10"></circle>',
      action: '<path d="M62 14l8 22 24 2-18 15 6 23-20-12-20 12 6-23-18-15 24-2z"></path>',
      arcade: '<rect x="28" y="18" width="64" height="48" rx="12"></rect><path d="M44 48h-8"></path><path d="M40 44v8"></path><circle cx="72" cy="48" r="4"></circle><circle cx="84" cy="40" r="4"></circle>'
    };
    return icons[kind] || icons.arcade;
  }

  function gameCoverUrlForSlug(slug) {
    const src = String(gameCoverManifest?.[slug] || "").trim();
    if (!src || !/^(https?:)?\/\//i.test(src) && !src.startsWith("/")) return "";
    return src;
  }

  function hasGameCoverManifest() {
    return !!(gameCoverManifest && typeof gameCoverManifest === "object" && Object.keys(gameCoverManifest).length);
  }

  function updateGameCoverState(status) {
    gameCoverManifestLastStatus = status || gameCoverManifestLastStatus;
    const now = Date.now();
    if (now - Number(gameCoverStateCounts.countedAt || 0) > 1500) {
      gameCoverStateCounts = {
        coverCount: document.querySelectorAll("[data-lz-game-cover]").length,
        imageCount: document.querySelectorAll("[data-lz-game-cover] img").length,
        countedAt: now
      };
    }
    window.__learningZonesCoverState = {
      status: gameCoverManifestLastStatus,
      loaded: gameCoverManifestLoaded,
      manifestCount: gameCoverManifest && typeof gameCoverManifest === "object" ? Object.keys(gameCoverManifest).length : 0,
      coverCount: gameCoverStateCounts.coverCount,
      imageCount: gameCoverStateCounts.imageCount,
      pending: !!gameCoverManifestPromise
    };
  }

  function ensureCatalogCoverCue(cover) {
    if (!cover || cover.querySelector(".lz-card-click-cue")) return;
    const cue = document.createElement("span");
    cue.className = "lz-card-click-cue";
    cue.textContent = "Play now";
    cover.appendChild(cue);
  }

  function renderFallbackGameCover(cover, title, slug) {
    cover.classList.remove("has-image", "is-loading");
    cover.classList.add("is-ready");
    cover.innerHTML = gameCoverMarkup(title || "Learning Zone", slug || "zone");
    if (cover.classList.contains("lz-card-cover")) ensureCatalogCoverCue(cover);
  }

  function renderRealGameCover(cover, src, title, slug) {
    if (!src) {
      renderFallbackGameCover(cover, title, slug);
      return;
    }
    if (cover.dataset.lzGameCoverSrc === src && cover.querySelector("img")) return;
    cover.dataset.lzGameCoverSrc = src;
    cover.classList.add("has-image", "is-loading");
    cover.classList.remove("is-ready");
    cover.textContent = "";
    const image = document.createElement("img");
    image.alt = "";
    image.width = 320;
    image.height = 180;
    image.loading = "lazy";
    image.decoding = "async";
    if ("fetchPriority" in image) image.fetchPriority = "low";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => {
      cover.classList.remove("is-loading");
      cover.classList.add("is-ready");
    }, { once: true });
    image.addEventListener("error", () => renderFallbackGameCover(cover, title, slug), { once: true });
    image.src = src;
    cover.appendChild(image);
    if (cover.classList.contains("lz-card-cover")) ensureCatalogCoverCue(cover);
    if (image.complete && image.naturalWidth) {
      cover.classList.remove("is-loading");
      cover.classList.add("is-ready");
    }
  }

  function optimizeStaticMedia(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("img:not([data-lz-media-optimized])").forEach((image, index) => {
      image.dataset.lzMediaOptimized = "true";
      if (!image.hasAttribute("loading")) image.loading = "lazy";
      image.decoding = "async";
      if (!image.hasAttribute("alt")) image.alt = "";
      if ("fetchPriority" in image && index > 5 && !image.hasAttribute("fetchpriority")) image.fetchPriority = "low";
    });
    scope.querySelectorAll("iframe:not([data-lz-media-optimized])").forEach(frame => {
      frame.dataset.lzMediaOptimized = "true";
      const isPrimaryGame = frame.matches('[data-testid="game-frame"], [data-testid="game-iframe"], iframe[src^="/games/"]');
      if (isPrimaryGame) {
        frame.setAttribute("loading", "eager");
        frame.loading = "eager";
      } else if (!frame.hasAttribute("loading")) {
        frame.loading = "lazy";
      }
      if (!frame.hasAttribute("referrerpolicy")) frame.referrerPolicy = "no-referrer";
    });
  }

  function scheduleStaticMediaOptimization(root = document, delay = 180) {
    clearTimeout(mediaOptimizationTimer);
    mediaOptimizationTimer = setTimeout(() => {
      runWhenMainThreadFree(() => optimizeStaticMedia(root), 900);
    }, delay);
  }

  function scrollRevealDisabled() {
    return siteSettings().reduceMotion ||
      document.documentElement.dataset.lzReduceMotion === "true" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
      !("IntersectionObserver" in window);
  }

  function scrollRevealKind(node) {
    if (node.matches?.(".tile, [data-testid='games-grid'] > a, .lz-home-continue-card, .lz-home-recommendation-card, .lz-home-mini-card, .lz-card-cover")) return "card";
    if (node.matches?.(".lz-settings-card, .lz-settings-panel, .lz-settings-live-preview, .lz-settings-preview-card, .lz-chat-panel-section")) return "panel";
    if (node.matches?.(".lz-home-section-head, .lz-home-hero-copy, .fade-up")) return "section";
    return "item";
  }

  function shouldRevealOnScroll(node) {
    if (!node || node.nodeType !== 1 || node.dataset.lzScrollReveal === "true") return false;
    if (node.closest?.("[data-testid='game-player'], #lz-chat-overlay:not(.is-open), iframe, canvas, script, style, noscript")) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 2 || rect.height < 2) return false;
    return true;
  }

  function setScrollRevealVisible(node) {
    node.classList.add("is-visible");
    node.dataset.lzScrollVisible = "true";
    if (scrollRevealObserver) scrollRevealObserver.unobserve(node);
  }

  function mountScrollReveal(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    const disabled = scrollRevealDisabled();
    document.documentElement.classList.toggle("lz-scroll-enhanced", !disabled);
    if (disabled) {
      if (scrollRevealObserver) {
        scrollRevealObserver.disconnect();
        scrollRevealObserver = null;
      }
      document.querySelectorAll(".lz-scroll-reveal").forEach(setScrollRevealVisible);
      return;
    }
    if (!scrollRevealObserver) {
      scrollRevealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting || entry.intersectionRatio > 0.08) setScrollRevealVisible(entry.target);
        });
      }, {
        root: null,
        rootMargin: "0px 0px -9% 0px",
        threshold: [0.08, 0.2]
      });
    }
    let order = 0;
    scope.querySelectorAll(SCROLL_REVEAL_SELECTOR).forEach(node => {
      if (!shouldRevealOnScroll(node)) return;
      node.dataset.lzScrollReveal = "true";
      node.dataset.lzScrollKind = scrollRevealKind(node);
      node.style.setProperty("--lz-scroll-delay", `${Math.min(order % 7, 6) * 24}ms`);
      node.classList.add("lz-scroll-reveal");
      order += 1;
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.88 && rect.bottom > 0) setScrollRevealVisible(node);
      else scrollRevealObserver.observe(node);
    });
  }

  function scheduleScrollReveal(root = document, delay = 120) {
    clearTimeout(scrollRevealTimer);
    scrollRevealTimer = setTimeout(() => {
      runWhenMainThreadFree(() => mountScrollReveal(root), 900);
    }, delay);
  }

  function gameCoverMarkup(title, slug) {
    const [primary, secondary, ink] = gameCoverPalette(slug || title);
    const kind = gameCoverKind(title);
    const initials = gameCoverInitials(title);
    const hash = gameCoverHash(slug || title);
    const cx = 78 + (hash % 22);
    const cy = 16 + (hash % 12);
    return `
      <svg viewBox="0 0 320 180" role="img" aria-label="${escapeHtml(title)} cover" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lz-cover-${escapeHtml(slug)}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${primary}"></stop>
            <stop offset="1" stop-color="${secondary}"></stop>
          </linearGradient>
          <pattern id="lz-grid-${escapeHtml(slug)}" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0v28" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"></path>
          </pattern>
        </defs>
        <rect width="320" height="180" rx="18" fill="url(#lz-cover-${escapeHtml(slug)})"></rect>
        <rect width="320" height="180" rx="18" fill="url(#lz-grid-${escapeHtml(slug)})" opacity=".7"></rect>
        <circle cx="${cx}" cy="${cy}" r="70" fill="rgba(255,255,255,.16)"></circle>
        <g transform="translate(100 44)" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".94">
          ${gameCoverIcon(kind)}
        </g>
        <rect x="18" y="118" width="76" height="42" rx="12" fill="rgba(255,255,255,.9)"></rect>
        <text x="56" y="146" text-anchor="middle" fill="${primary}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900">${escapeHtml(initials)}</text>
      </svg>
    `;
  }

  function mountGameCardCovers() {
    const cards = Array.from(document.querySelectorAll('a[data-testid^="game-tile-"][href*="/zone/"]:not([data-lz-game-cover-checked])'));
    if (!cards.length) return false;
    let mounted = false;
    cards.forEach(card => {
      card.dataset.lzGameCoverChecked = "true";
      if (card.querySelector("[data-lz-game-cover], img")) return;
      const slug = ratingPathKey(zoneSlugFromHref(card.getAttribute("href") || "")) || key(card.getAttribute("href") || "");
      const title = cleanAccountName(card.querySelector(".tile-title")?.textContent || card.querySelector("h3,h2,strong")?.textContent || zoneTitleFromSlug(slug));
      const cover = document.createElement("div");
      cover.className = "lz-game-cover";
      cover.setAttribute("data-lz-game-cover", "true");
      cover.setAttribute("data-lz-game-cover-slug", slug || "");
      cover.setAttribute("data-lz-game-cover-title", title || "Learning Zone");
      cover.setAttribute("aria-hidden", "true");
      renderRealGameCover(cover, gameCoverUrlForSlug(slug), title || "Learning Zone", slug || "zone");
      card.insertBefore(cover, card.firstChild);
      mounted = true;
    });
    return mounted;
  }

  function refreshGameCoverImages() {
    document.querySelectorAll("[data-lz-game-cover][data-lz-game-cover-slug]:not(.has-image)").forEach(cover => {
      if (cover.querySelector("img")) return;
      const slug = cover.getAttribute("data-lz-game-cover-slug") || "";
      const title = cover.getAttribute("data-lz-game-cover-title") || zoneTitleFromSlug(slug) || "Learning Zone";
      const src = gameCoverUrlForSlug(slug);
      if (src) renderRealGameCover(cover, src, title, slug || "zone");
    });
  }

  function loadGameCoverManifest(force = false) {
    if (gameCoverManifestPromise && !force) return gameCoverManifestPromise;
    if (gameCoverManifestLoaded && !force) return Promise.resolve(gameCoverManifest);
    updateGameCoverState("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    gameCoverManifestPromise = fetch(GAME_COVER_MANIFEST_URL, {
      cache: force ? "reload" : "no-store",
      signal: controller.signal
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data && typeof data === "object" && !Array.isArray(data)) {
          gameCoverManifest = data;
          gameCoverManifestLoaded = hasGameCoverManifest();
          writeJson(GAME_COVER_CACHE_KEY, gameCoverManifest);
          refreshGameCoverImages();
          updateGameCoverState("loaded");
        }
        return gameCoverManifest;
      })
      .catch(error => {
        gameCoverManifestLoaded = hasGameCoverManifest();
        updateGameCoverState("error");
        console.warn("Learning Zones cover manifest load skipped:", error);
        return gameCoverManifest;
      })
      .finally(() => {
        clearTimeout(timer);
        gameCoverManifestPromise = null;
      });
    return gameCoverManifestPromise;
  }

  function syncGameCoversForRoute() {
    if (!document.body) return;
    if (!isCatalogSurfaceRoute()) return;
    if (isLoginSurface() && !document.querySelector('a[data-testid^="game-tile-"]')) return;
    installChatOverlayStyles();
    mountGameCardCovers();
    refreshGameCoverImages();
    scheduleStaticMediaOptimization(document, 80);
    scheduleHomeDiscoveryForRoute(90);
    updateGameCoverState("sync");
    if (!gameCoverManifestLoaded) {
      loadGameCoverManifest(false);
    }
  }

  function scheduleGameCoversForRoute(delay = 120) {
    clearTimeout(gameCoverMountTimer);
    if (!isCatalogSurfaceRoute()) return;
    gameCoverMountTimer = setTimeout(() => runWhenMainThreadFree(syncGameCoversForRoute, 900), delay);
  }

  function scheduleGameCoverWarmup() {
    if (!isCatalogSurfaceRoute()) return;
    [350, 1400, 3600].forEach(delay => {
      setTimeout(syncGameCoversForRoute, delay);
    });
  }

  function watchGameCoverMount() {
    if (window.__learningZonesGameCoverWatch) return;
    window.__learningZonesGameCoverWatch = true;
    new MutationObserver(mutations => {
      if (isCatalogSurfaceRoute() && mutationAddsMatching(mutations, '[data-testid="games-grid"], a[data-testid^="game-tile-"], [data-testid="game-iframe"]')) {
        scheduleGameCoversForRoute(180);
      }
    }).observe(document.getElementById("root") || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  const HOME_FEATURED_ZONES = [
    { slug: "1v1-lol", title: "1v1.lol", badge: "Fast match", reason: "Build, aim, and restart fast." },
    { slug: "slope", title: "Slope", badge: "Quick reflex", reason: "One-click arcade momentum." },
    { slug: "basketball-stars", title: "Basketball Stars", badge: "2 player", reason: "Instant sports competition." }
  ];

  const HOME_FEATURED_RAIL_SPEED = 30;
  const HOME_FEATURED_MANUAL_PAUSE_MS = 2800;

  const HOME_RECOMMENDED_ZONES = [
    { slug: "happy-wheels", title: "Happy Wheels", badge: "Physics", reason: "Wild obstacle runs." },
    { slug: "retro-bowl", title: "Retro Bowl", badge: "Strategy", reason: "Call plays and manage drives." },
    { slug: "cookie-clicker", title: "Cookie Clicker", badge: "Idle", reason: "Simple progress loop." },
    { slug: "plants-vs-zombies", title: "Plants Vs Zombies", badge: "Defense", reason: "Classic lane strategy." }
  ];

  const HOME_STARTER_ZONES = [
    { slug: "tetris", title: "Tetris", badge: "Logic" },
    { slug: "geometry-dash", title: "Geometry Dash", badge: "Rhythm" },
    { slug: "run-3", title: "Run 3", badge: "Runner" },
    { slug: "minecraft", title: "Minecraft", badge: "Creative" }
  ];

  const HOME_SEARCH_SUGGESTIONS = ["slope", "football", "minecraft", "zombie", "2 player", "clicker"];
  const CARD_CATEGORY_RULES = [
    { label: "Sports", match: /\b(basket|football|soccer|baseball|tennis|golf|hockey|bowling|boxing|wrestle|billiard|pool|skate|snowboard|surf|bike|bmx|motocross|world cup|cup)\b/i },
    { label: "Racing", match: /\b(race|racing|racer|drive|drift|car|cars|truck|traffic|kart|moto|bike|speed|hill climb)\b/i },
    { label: "Creative", match: /\b(minecraft|craft|build|builder|sandbox|paint|draw|make|creator|city|world)\b/i },
    { label: "Strategy", match: /\b(chess|checkers|tower|defense|battle|war|kingdom|empire|plants|zombies|risk|manager|tycoon|retro bowl)\b/i },
    { label: "Puzzle", match: /\b(puzzle|logic|word|math|sudoku|2048|tetris|match|mahjong|brain|escape|solve|connect|block)\b/i },
    { label: "Rhythm", match: /\b(rhythm|music|fnf|friday|funkin|dance|beat|geometry dash)\b/i },
    { label: "Physics", match: /\b(physics|happy wheels|ragdoll|launch|throw|bounce|swing|mutilate|powder|sandboxels)\b/i },
    { label: "Multiplayer", match: /\b(1v1|2 player|two player|io\b|agar|slither|krunker|shell|battle royale|yohoho|bonk)\b/i },
    { label: "Shooter", match: /\b(shoot|shooter|gun|guns|sniper|bullet|strike|doom|quake|half life|combat|warfare)\b/i },
    { label: "Platform", match: /\b(run|runner|jump|climb|climbing|platform|mario|sonic|vex|fireboy|watergirl|parkour|doodle)\b/i },
    { label: "Idle", match: /\b(idle|clicker|cookie|incremental|upgrade|factory|miner)\b/i },
    { label: "Classic", match: /\b(pacman|pac-man|snake|pong|asteroids|breakout|pinball|minesweeper|solitaire|doom)\b/i }
  ];

  const CARD_CATEGORY_DESCRIPTIONS = {
    Sports: "Fast rounds built around timing, angles, and clean plays.",
    Racing: "Speed, control, and quick restarts for sharp reaction practice.",
    Creative: "Open-ended building and experimenting right in your workspace.",
    Strategy: "Plan the next move, manage pressure, and adapt fast.",
    Puzzle: "Pattern solving and logic challenges in bite-size sessions.",
    Rhythm: "Keep the timing tight and stay locked into the beat.",
    Physics: "Momentum, collisions, and timing with quick replay loops.",
    Multiplayer: "Jump into competitive rounds with minimal waiting.",
    Shooter: "Aim, react, and reset quickly between focused rounds.",
    Platform: "Jump, dodge, and chase a cleaner run every attempt.",
    Idle: "Upgrade, collect, and watch progress stack up over time.",
    Classic: "Familiar activities with simple controls and fast starts.",
    Arcade: "Quick-play action made for short sessions and fast retries."
  };

  function isHomeRoute() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    return path === "/" && !isLoginSurface();
  }

  function isCatalogSurfaceRoute() {
    return isHomeRoute() || Boolean(zoneSlugFromPath());
  }

  function homeZoneHref(slug) {
    const clean = String(slug || "").trim();
    return clean ? `/zone/${encodeURIComponent(clean)}` : "/";
  }

  function homeZonePool() {
    return HOME_FEATURED_ZONES.concat(HOME_RECOMMENDED_ZONES, HOME_STARTER_ZONES);
  }

  function homeFeaturedRailZones() {
    const seen = new Set();
    return HOME_FEATURED_ZONES.concat(HOME_RECOMMENDED_ZONES).filter(item => {
      const slug = ratingPathKey(item?.slug);
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
  }

  function homeZoneBySlug(slug) {
    const clean = ratingPathKey(slug);
    return homeZonePool().find(item => ratingPathKey(item.slug) === clean) || null;
  }

  function homeCardTitleFromAnchor(anchor) {
    return cleanAccountName(anchor?.querySelector?.(".tile-title")?.textContent || anchor?.querySelector?.("h3,h2,strong")?.textContent || anchor?.textContent || "");
  }

  function catalogCardCategory(slug, title) {
    const value = `${slug || ""} ${title || ""}`.toLowerCase();
    const rule = CARD_CATEGORY_RULES.find(item => item.match.test(value));
    return rule?.label || "Arcade";
  }

  function catalogCardDescription(slug, title, category) {
    const value = `${slug || ""} ${title || ""}`.toLowerCase();
    if (/\b(minecraft|eagler|craft|sandbox|builder)\b/.test(value)) return "Build, explore, and experiment with a full creative sandbox.";
    if (/\b(1v1|krunker|shell|yohoho|bonk|agar|slither)\b/.test(value)) return "Competitive rounds that open fast and keep momentum.";
    if (/\b(happy wheels|ragdoll|mutilate|powder|sandboxels)\b/.test(value)) return "Physics-driven experiments with instant reset energy.";
    if (/\b(tetris|2048|sudoku|word|mahjong|connect|block)\b/.test(value)) return "A clean logic challenge for pattern practice and focus.";
    return CARD_CATEGORY_DESCRIPTIONS[category] || CARD_CATEGORY_DESCRIPTIONS.Arcade;
  }

  function catalogCardMetaRow(card) {
    return Array.from(card?.children || []).find(child => {
      if (child?.tagName !== "DIV" || child.classList?.contains("lz-game-cover")) return false;
      if (child.querySelector?.('[data-testid^="save-game-tile-"], .tile-arrow')) return true;
      return child.firstElementChild?.tagName === "SPAN";
    }) || null;
  }

  function catalogCardFromEvent(event) {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const card = target?.closest?.('a[data-testid^="game-tile-"], .tile[href*="/zone/"]');
    if (!card || target.closest?.('button, input, select, textarea, [data-lz-rating-value]')) return null;
    return card;
  }

  function installCatalogCardInteractionFeedback() {
    if (window.__learningZonesCatalogCardFeedbackWatch) return;
    window.__learningZonesCatalogCardFeedbackWatch = true;
    const clearPress = () => {
      document.querySelectorAll(".lz-catalog-card.is-pressing").forEach(card => card.classList.remove("is-pressing"));
    };
    document.addEventListener("pointerdown", event => {
      const card = catalogCardFromEvent(event);
      if (card) card.classList.add("is-pressing");
    }, { capture: true, passive: true });
    document.addEventListener("pointerup", clearPress, { capture: true, passive: true });
    document.addEventListener("pointercancel", clearPress, { capture: true, passive: true });
    document.addEventListener("blur", clearPress, true);
    document.addEventListener("click", event => {
      const card = catalogCardFromEvent(event);
      if (!card) return;
      card.classList.add("is-selected-feedback");
      setTimeout(() => card.classList.remove("is-selected-feedback", "is-pressing"), 260);
    }, { capture: true, passive: true });
  }

  const SAVE_BUTTON_SELECTOR = [
    '[data-testid^="save-game-tile-"]',
    '[data-testid="game-player-topbar"] [data-testid="save-game-btn"]'
  ].join(",");
  const saveButtonWatchCleanups = new Map();
  const saveButtonConfirmationTimers = new Map();

  function saveButtonFromEvent(event) {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    return target?.closest?.(SAVE_BUTTON_SELECTOR) || null;
  }

  function saveButtonIsSaved(button) {
    const title = String(button?.getAttribute?.("title") || "").trim();
    if (/^remove from saved zones/i.test(title)) return true;
    if (/^save (this zone|game)/i.test(title)) return false;
    return /^saved$/i.test(String(button?.textContent || "").trim());
  }

  function saveButtonActionKey(button) {
    const testId = String(button?.getAttribute?.("data-testid") || "").trim();
    return `${location.pathname}|${testId}`;
  }

  function saveButtonForAction(button, testId) {
    if (button?.isConnected) return button;
    if (!testId) return null;
    const escapedTestId = testId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return document.querySelector(`[data-testid="${escapedTestId}"]`);
  }

  function clearSaveButtonConfirmationState(button) {
    if (!button) return;
    button.classList.remove("lz-save-confirming", "is-saved-confirmation", "is-unsaved-confirmation");
    delete button.dataset.lzSaveConfirmation;
  }

  function saveButtonConfirmation(button, label, wantsSaved, actionKey, testId) {
    saveButtonConfirmationTimers.get(actionKey)?.finish?.();
    let activeButton = button;
    let finished = false;
    let timer = 0;
    const confirmationClass = wantsSaved ? "is-saved-confirmation" : "is-unsaved-confirmation";
    const apply = target => {
      if (!target) return;
      target.classList.remove("lz-save-activating", "is-saved-confirmation", "is-unsaved-confirmation");
      target.dataset.lzSaveConfirmation = label;
      target.classList.add("lz-save-confirming", confirmationClass);
    };
    const syncReplacement = () => {
      const nextButton = saveButtonForAction(activeButton, testId);
      if (!nextButton) return;
      if (nextButton !== activeButton) clearSaveButtonConfirmationState(activeButton);
      activeButton = nextButton;
      apply(activeButton);
    };
    const observer = new MutationObserver(syncReplacement);
    const record = {
      finish() {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearTimeout(timer);
        clearSaveButtonConfirmationState(activeButton);
        const latestButton = saveButtonForAction(activeButton, testId);
        if (latestButton !== activeButton) clearSaveButtonConfirmationState(latestButton);
        if (saveButtonConfirmationTimers.get(actionKey) === record) {
          saveButtonConfirmationTimers.delete(actionKey);
        }
      }
    };

    apply(activeButton);
    observer.observe(document.body, { childList: true, subtree: true });

    let status = document.getElementById("lz-save-action-status");
    if (!status) {
      status = document.createElement("span");
      status.id = "lz-save-action-status";
      status.className = "lz-save-action-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      document.body.appendChild(status);
    }
    status.textContent = wantsSaved ? "Zone saved." : "Zone removed from saved zones.";

    timer = setTimeout(record.finish, wantsSaved ? 700 : 1050);
    saveButtonConfirmationTimers.set(actionKey, record);
  }

  function watchSaveButtonResult(button) {
    const testId = String(button.getAttribute("data-testid") || "").trim();
    const actionKey = saveButtonActionKey(button);
    const wantsSaved = !saveButtonIsSaved(button);
    saveButtonWatchCleanups.get(actionKey)?.();
    saveButtonConfirmationTimers.get(actionKey)?.finish?.();
    clearSaveButtonConfirmationState(button);
    button.dataset.lzSaveIntent = wantsSaved ? "save" : "unsave";
    button.classList.add("lz-save-activating");
    setTimeout(() => button.classList.remove("lz-save-activating"), 240);

    let settled = false;
    let timeout = 0;
    const observer = new MutationObserver(() => check());
    const cleanup = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      if (saveButtonWatchCleanups.get(actionKey) === cleanup) {
        saveButtonWatchCleanups.delete(actionKey);
      }
      delete button.dataset.lzSaveIntent;
    };
    const check = () => {
      if (settled) return;
      const activeButton = saveButtonForAction(button, testId);
      if (!activeButton) return;
      const text = String(activeButton.textContent || "").trim();
      if (/saving/i.test(text)) return;
      if (saveButtonIsSaved(activeButton) !== wantsSaved) return;
      cleanup();
      saveButtonConfirmation(
        activeButton,
        wantsSaved ? "Saved" : "Unsaved",
        wantsSaved,
        actionKey,
        testId
      );
    };

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["title", "disabled"],
      childList: true,
      subtree: true,
      characterData: true
    });
    timeout = setTimeout(cleanup, 5000);
    saveButtonWatchCleanups.set(actionKey, cleanup);
    requestAnimationFrame(check);
  }

  function installSaveButtonFeedback() {
    if (window.__learningZonesSaveButtonFeedback) return;
    window.__learningZonesSaveButtonFeedback = true;
    document.addEventListener("click", event => {
      const button = saveButtonFromEvent(event);
      if (!button || button.disabled) return;
      watchSaveButtonResult(button);
    }, true);
  }

  function homeCoverSrcForSlug(slug, fallback = "") {
    const clean = ratingPathKey(slug);
    return String(fallback || gameCoverManifest?.[clean] || gameCoverManifest?.[slug] || "");
  }

  function readRecentZones() {
    const raw = readJson(HOME_RECENT_KEY, []);
    return Array.isArray(raw) ? raw
      .map(item => ({
        slug: ratingPathKey(item?.slug),
        title: cleanAccountName(item?.title || zoneTitleFromSlug(item?.slug || "")),
        coverSrc: String(item?.coverSrc || ""),
        at: Number(item?.at || 0)
      }))
      .filter(item => item.slug && item.title)
      .slice(0, 8) : [];
  }

  function writeRecentZones(items) {
    writeJson(HOME_RECENT_KEY, (items || []).slice(0, 8));
  }

  function rememberRecentZone(zone, refreshHome = true) {
    const slug = ratingPathKey(zone?.slug);
    if (!slug) return;
    const known = homeZoneBySlug(slug);
    const title = cleanAccountName(zone?.title || known?.title || zoneTitleFromSlug(slug));
    const coverSrc = homeCoverSrcForSlug(slug, zone?.coverSrc || "");
    const next = [{ slug, title, coverSrc, at: Date.now() }]
      .concat(readRecentZones().filter(item => item.slug !== slug))
      .slice(0, 8);
    writeRecentZones(next);
    if (refreshHome && isHomeRoute()) scheduleHomeDiscoveryForRoute(80);
  }

  function noteCurrentZoneFromRoute() {
    if (isLoginSurface()) return;
    const slug = zoneSlugFromPath();
    if (!slug) return;
    const known = homeZoneBySlug(slug);
    const heading = Array.from(document.querySelectorAll("h1")).find(isActuallyVisible);
    const frame = document.querySelector('iframe[data-testid="game-iframe"], iframe[src^="/games/"]');
    const title = cleanAccountName(heading?.textContent || frame?.getAttribute("title") || known?.title || zoneTitleFromSlug(slug));
    rememberRecentZone({ slug, title, coverSrc: homeCoverSrcForSlug(slug) }, false);
  }

  function homeCoverHtml(item) {
    const slug = ratingPathKey(item?.slug);
    const title = cleanAccountName(item?.title || zoneTitleFromSlug(slug));
    const src = homeCoverSrcForSlug(slug, item?.coverSrc || "");
    const loading = item?.loading === "eager" ? "eager" : "lazy";
    if (src) {
      return `<img src="${escapeHtml(src)}" alt="" width="320" height="180" loading="${loading}" decoding="async" referrerpolicy="no-referrer">`;
    }
    return gameCoverMarkup(title, slug);
  }

  function ensureHomeCoverFallbacks(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll(".lz-home-game-cover img:not([data-lz-home-cover-watched])").forEach(image => {
      image.dataset.lzHomeCoverWatched = "true";
      const cover = image.closest(".lz-home-game-cover");
      const card = image.closest(".lz-home-game-card");
      const slug = ratingPathKey(card?.dataset?.lzHomeZone || "") || "zone";
      const title = cleanAccountName(card?.querySelector("strong")?.textContent || zoneTitleFromSlug(slug) || "Learning Zone");
      let settled = false;
      const renderFallback = () => {
        if (settled || !cover?.contains(image)) return;
        settled = true;
        cover.innerHTML = gameCoverMarkup(title, slug);
      };
      image.addEventListener("load", () => { settled = true; }, { once: true });
      image.addEventListener("error", renderFallback, { once: true });
      if (image.complete) {
        if (image.naturalWidth) settled = true;
        else setTimeout(renderFallback, 0);
      }
    });
  }

  function homeGameCardHtml(item, variant = "standard") {
    const slug = ratingPathKey(item?.slug);
    const title = cleanAccountName(item?.title || zoneTitleFromSlug(slug));
    const badge = cleanAccountName(item?.badge || "Pick");
    const reason = cleanAccountName(item?.reason || "Ready in your workspace.");
    const cloneAttributes = item?.featuredClone
      ? ' tabindex="-1" data-lz-featured-clone-card="true"'
      : "";
    return `
      <a class="lz-home-game-card is-${escapeHtml(variant)}" href="${homeZoneHref(slug)}" data-lz-home-zone="${escapeHtml(slug)}" aria-label="Play ${escapeHtml(title)}"${cloneAttributes}>
        <span class="lz-home-game-cover" aria-hidden="true">${homeCoverHtml({ ...item, slug, title })}</span>
        <span class="lz-home-game-copy">
          <span class="lz-home-game-meta">${escapeHtml(badge)}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(reason)}</small>
        </span>
        <span class="lz-home-game-action">Play</span>
      </a>
    `;
  }

  function homeFeaturedArrowIcon(direction) {
    const path = direction === "previous" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="${path}"></polyline></svg>`;
  }

  function homeFeaturedRailGroupHtml(items, clone = false) {
    const attributes = clone
      ? ' data-lz-featured-group="clone" aria-hidden="true"'
      : ' data-lz-featured-group="original"';
    return `<div class="lz-home-featured-group${clone ? " is-clone" : ""}"${attributes}>${items.map((item, index) => homeGameCardHtml({
      ...item,
      featuredClone: clone,
      loading: !clone && index < 2 ? "eager" : "lazy"
    }, "featured-rail")).join("")}</div>`;
  }

  function normalizeFeaturedRailOffset(value, width) {
    if (!Number.isFinite(value) || !Number.isFinite(width) || width <= 0) return 0;
    return ((value % width) + width) % width;
  }

  function createHomeFeaturedRailController(panel, itemCount, initialProgress = 0) {
    const viewport = panel.querySelector("[data-lz-featured-viewport]");
    const track = panel.querySelector("[data-lz-featured-track]");
    const originalGroup = panel.querySelector('[data-lz-featured-group="original"]');
    const cloneGroup = panel.querySelector('[data-lz-featured-group="clone"]');
    const previousButton = panel.querySelector("[data-lz-featured-previous]");
    const nextButton = panel.querySelector("[data-lz-featured-next]");
    if (!viewport || !track || !originalGroup) return null;

    const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    let destroyed = false;
    let animationFrame = 0;
    let measureFrame = 0;
    let measureRetryTimer = 0;
    let focusTimer = 0;
    let manualResumeTimer = 0;
    let resizeObserver = null;
    let loopWidth = 0;
    let cardStep = 0;
    let offset = 0;
    let pendingInitialProgress = Math.max(0, Math.min(1, Number(initialProgress) || 0));
    let previousTimestamp = 0;
    let pointerHovering = false;
    let focusWithin = false;
    let dragging = false;
    let windowBlurred = false;
    let measured = false;
    let manualPauseUntil = 0;
    let manualAnimation = null;
    let dragState = null;
    let suppressClickUntil = 0;

    function prefersReducedMotion() {
      return Boolean(reducedMotionQuery?.matches);
    }

    function canAutoScroll() {
      return itemCount > 1 && measured && loopWidth > viewport.clientWidth + 1 && !prefersReducedMotion();
    }

    function isPaused() {
      return pointerHovering ||
        focusWithin ||
        dragging ||
        windowBlurred ||
        document.visibilityState === "hidden" ||
        Date.now() < manualPauseUntil ||
        !canAutoScroll();
    }

    function updateStateAttributes() {
      panel.dataset.lzFeaturedReady = measured ? "true" : "false";
      panel.dataset.lzFeaturedReducedMotion = prefersReducedMotion() ? "true" : "false";
      panel.dataset.lzFeaturedAutoplay = canAutoScroll() ? "true" : "false";
      panel.dataset.lzFeaturedPaused = isPaused() || manualAnimation ? "true" : "false";
      panel.dataset.lzFeaturedDragging = dragging ? "true" : "false";
    }

    function applyOffset() {
      if (prefersReducedMotion() || itemCount <= 1 || !loopWidth) {
        track.style.transform = "";
        return;
      }
      const renderedOffset = normalizeFeaturedRailOffset(offset, loopWidth);
      track.style.transform = `translate3d(${-renderedOffset.toFixed(3)}px, 0, 0)`;
    }

    function cancelAnimationFrameLoop() {
      if (!animationFrame) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function scheduleAnimationFrame() {
      if (destroyed || animationFrame || document.visibilityState === "hidden") return;
      animationFrame = window.requestAnimationFrame(runAnimationFrame);
    }

    function syncAnimationLoop() {
      updateStateAttributes();
      if (manualAnimation || !isPaused()) {
        scheduleAnimationFrame();
      } else {
        previousTimestamp = 0;
        cancelAnimationFrameLoop();
      }
    }

    function runAnimationFrame(timestamp) {
      animationFrame = 0;
      if (destroyed) return;
      if (!panel.isConnected || !isHomeRoute()) {
        destroy();
        return;
      }

      if (manualAnimation) {
        if (!manualAnimation.startedAt) manualAnimation.startedAt = timestamp;
        const elapsed = Math.max(0, timestamp - manualAnimation.startedAt);
        const progress = Math.min(1, elapsed / manualAnimation.duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        offset = manualAnimation.from + ((manualAnimation.to - manualAnimation.from) * eased);
        applyOffset();
        if (progress >= 1) {
          offset = normalizeFeaturedRailOffset(manualAnimation.to, loopWidth);
          manualAnimation = null;
          previousTimestamp = 0;
          manualPauseUntil = Date.now() + HOME_FEATURED_MANUAL_PAUSE_MS;
          clearTimeout(manualResumeTimer);
          manualResumeTimer = setTimeout(syncAnimationLoop, HOME_FEATURED_MANUAL_PAUSE_MS + 20);
        }
      } else if (!isPaused()) {
        if (previousTimestamp) {
          const elapsedSeconds = Math.min(0.1, Math.max(0, timestamp - previousTimestamp) / 1000);
          offset = normalizeFeaturedRailOffset(offset + (HOME_FEATURED_RAIL_SPEED * elapsedSeconds), loopWidth);
          applyOffset();
        }
        previousTimestamp = timestamp;
      } else {
        previousTimestamp = 0;
      }

      syncAnimationLoop();
    }

    function measureRail() {
      measureFrame = 0;
      if (destroyed || !panel.isConnected) return;
      const trackStyle = window.getComputedStyle(track);
      const groupStyle = window.getComputedStyle(originalGroup);
      const outerGap = parseFloat(trackStyle.columnGap || trackStyle.gap || "0") || 0;
      const innerGap = parseFloat(groupStyle.columnGap || groupStyle.gap || "0") || 0;
      const originalWidth = originalGroup.getBoundingClientRect().width;
      const nextLoopWidth = originalWidth + (cloneGroup ? outerGap : 0);
      const firstCard = originalGroup.querySelector(".lz-home-game-card");
      const nextCardStep = (firstCard?.getBoundingClientRect().width || 0) + innerGap;

      if (nextLoopWidth <= 0 || nextCardStep <= 0) {
        measured = false;
        updateStateAttributes();
        clearTimeout(measureRetryTimer);
        measureRetryTimer = setTimeout(queueMeasure, 180);
        return;
      }

      const progress = loopWidth > 0
        ? normalizeFeaturedRailOffset(offset, loopWidth) / loopWidth
        : pendingInitialProgress;
      loopWidth = nextLoopWidth;
      cardStep = nextCardStep;
      offset = normalizeFeaturedRailOffset(progress * loopWidth, loopWidth);
      pendingInitialProgress = 0;
      measured = true;
      panel.dataset.lzFeaturedLoopWidth = String(Math.round(loopWidth));
      panel.dataset.lzFeaturedCardStep = String(Math.round(cardStep));
      applyOffset();
      syncAnimationLoop();
    }

    function queueMeasure() {
      if (destroyed || measureFrame) return;
      measureFrame = window.requestAnimationFrame(measureRail);
    }

    function pauseAfterManualNavigation() {
      manualPauseUntil = Date.now() + HOME_FEATURED_MANUAL_PAUSE_MS;
      clearTimeout(manualResumeTimer);
      manualResumeTimer = setTimeout(syncAnimationLoop, HOME_FEATURED_MANUAL_PAUSE_MS + 20);
      syncAnimationLoop();
    }

    function moveByCard(direction) {
      if (destroyed || !measured || !cardStep || manualAnimation) return;
      if (prefersReducedMotion()) {
        viewport.scrollBy({ left: direction * cardStep, behavior: "auto" });
        pauseAfterManualNavigation();
        return;
      }
      manualAnimation = {
        from: offset,
        to: offset + (direction * cardStep),
        duration: 220,
        startedAt: 0
      };
      pauseAfterManualNavigation();
      scheduleAnimationFrame();
    }

    function onPointerEnter(event) {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      pointerHovering = true;
      syncAnimationLoop();
    }

    function onPointerLeave(event) {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      pointerHovering = false;
      previousTimestamp = 0;
      syncAnimationLoop();
    }

    function onFocusIn() {
      focusWithin = true;
      syncAnimationLoop();
    }

    function onFocusOut() {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        focusWithin = panel.contains(document.activeElement);
        previousTimestamp = 0;
        syncAnimationLoop();
      }, 0);
    }

    function onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (prefersReducedMotion()) return;
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: offset
      };
    }

    function onPointerMove(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (!dragging) {
        if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
          dragState = null;
          return;
        }
        if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        dragging = true;
        viewport.setPointerCapture?.(event.pointerId);
        cancelAnimationFrameLoop();
      }
      event.preventDefault();
      offset = normalizeFeaturedRailOffset(dragState.startOffset - deltaX, loopWidth);
      applyOffset();
      updateStateAttributes();
    }

    function finishPointerDrag(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const didDrag = dragging;
      if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      dragState = null;
      dragging = false;
      previousTimestamp = 0;
      if (didDrag) {
        suppressClickUntil = Date.now() + 320;
        pauseAfterManualNavigation();
      } else {
        syncAnimationLoop();
      }
    }

    function onViewportClick(event) {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function onVisibilityChange() {
      previousTimestamp = 0;
      if (document.visibilityState === "hidden") cancelAnimationFrameLoop();
      else syncAnimationLoop();
      updateStateAttributes();
    }

    function onWindowBlur() {
      windowBlurred = true;
      syncAnimationLoop();
    }

    function onWindowFocus() {
      windowBlurred = false;
      previousTimestamp = 0;
      syncAnimationLoop();
    }

    function onReducedMotionChange() {
      previousTimestamp = 0;
      manualAnimation = null;
      viewport.scrollLeft = 0;
      applyOffset();
      queueMeasure();
      syncAnimationLoop();
    }

    function getState() {
      return {
        itemCount,
        offset: normalizeFeaturedRailOffset(offset, loopWidth),
        loopWidth,
        cardStep,
        progress: loopWidth > 0 ? normalizeFeaturedRailOffset(offset, loopWidth) / loopWidth : 0,
        paused: isPaused() || Boolean(manualAnimation),
        reducedMotion: prefersReducedMotion(),
        measured,
        destroyed
      };
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrameLoop();
      if (measureFrame) window.cancelAnimationFrame(measureFrame);
      clearTimeout(measureRetryTimer);
      clearTimeout(focusTimer);
      clearTimeout(manualResumeTimer);
      resizeObserver?.disconnect?.();
      panel.removeEventListener("pointerenter", onPointerEnter);
      panel.removeEventListener("pointerleave", onPointerLeave);
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", finishPointerDrag);
      viewport.removeEventListener("pointercancel", finishPointerDrag);
      viewport.removeEventListener("click", onViewportClick, true);
      previousButton?.removeEventListener("click", onPreviousClick);
      nextButton?.removeEventListener("click", onNextClick);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("resize", queueMeasure);
      reducedMotionQuery?.removeEventListener?.("change", onReducedMotionChange);
      if (panel.__lzFeaturedRailController === controller) panel.__lzFeaturedRailController = null;
      if (window.learningZonesFeaturedRail === controller) window.learningZonesFeaturedRail = null;
    }

    function onPreviousClick() {
      moveByCard(-1);
    }

    function onNextClick() {
      moveByCard(1);
    }

    const controller = { destroy, getState, refresh: queueMeasure, previous: onPreviousClick, next: onNextClick };
    panel.addEventListener("pointerenter", onPointerEnter);
    panel.addEventListener("pointerleave", onPointerLeave);
    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("pointerdown", onPointerDown, { passive: true });
    viewport.addEventListener("pointermove", onPointerMove, { passive: false });
    viewport.addEventListener("pointerup", finishPointerDrag, { passive: true });
    viewport.addEventListener("pointercancel", finishPointerDrag, { passive: true });
    viewport.addEventListener("click", onViewportClick, true);
    previousButton?.addEventListener("click", onPreviousClick);
    nextButton?.addEventListener("click", onNextClick);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    reducedMotionQuery?.addEventListener?.("change", onReducedMotionChange);

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(queueMeasure);
      resizeObserver.observe(viewport);
      resizeObserver.observe(originalGroup);
    } else {
      window.addEventListener("resize", queueMeasure, { passive: true });
    }

    panel.__lzFeaturedRailController = controller;
    window.learningZonesFeaturedRail = controller;
    updateStateAttributes();
    queueMeasure();
    return controller;
  }

  function installHomeHeroCtas(heroCopy) {
    if (!heroCopy || heroCopy.querySelector("[data-lz-home-cta-row]")) return;
    const paragraph = heroCopy.querySelector("p");
    const cta = document.createElement("div");
    cta.className = "lz-home-cta-row";
    cta.setAttribute("data-lz-home-cta-row", "true");
    cta.innerHTML = `
      <a class="lz-home-primary-cta" href="/zone/1v1-lol" data-lz-home-zone="1v1-lol">Play a top pick</a>
      <button class="lz-home-secondary-cta" type="button" data-lz-home-scroll="#lz-home-discovery">See recommendations</button>
    `;
    if (paragraph) paragraph.insertAdjacentElement("afterend", cta);
    else heroCopy.appendChild(cta);
  }

  function installHomeHeroPanel(heroWrap) {
    if (!heroWrap) return;
    heroWrap.classList.add("lz-home-hero-wrap");
    const heroCopy = heroWrap.firstElementChild;
    heroCopy?.classList?.add("lz-home-hero-copy");
    installHomeHeroCtas(heroCopy);
    let panel = heroWrap.querySelector("#lz-home-featured-panel");
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "lz-home-featured-panel";
      panel.setAttribute("data-lz-home-enhancement", "true");
      heroWrap.appendChild(panel);
    }
    const featuredItems = homeFeaturedRailZones();
    if (!featuredItems.length) {
      panel.__lzFeaturedRailController?.destroy?.();
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    panel.setAttribute("aria-labelledby", "lz-home-featured-title");
    panel.dataset.lzFeaturedCount = String(featuredItems.length);
    const hasLoop = featuredItems.length > 1;
    const featuredHtml = `
      <div class="lz-home-panel-top">
        <div class="lz-home-panel-heading">
          <span>Featured</span>
          <h2 id="lz-home-featured-title">Start in seconds</h2>
        </div>
        <div class="lz-home-featured-controls" aria-label="Featured zone controls">
          <button type="button" data-lz-featured-previous aria-label="Show previous featured zone"${hasLoop ? "" : " disabled"}>${homeFeaturedArrowIcon("previous")}</button>
          <button type="button" data-lz-featured-next aria-label="Show next featured zone"${hasLoop ? "" : " disabled"}>${homeFeaturedArrowIcon("next")}</button>
        </div>
      </div>
      <div class="lz-home-featured-viewport-shell">
        <div class="lz-home-featured-viewport" data-lz-featured-viewport>
          <div class="lz-home-featured-track" data-lz-featured-track>
            ${homeFeaturedRailGroupHtml(featuredItems)}
            ${hasLoop ? homeFeaturedRailGroupHtml(featuredItems, true) : ""}
          </div>
        </div>
      </div>
    `;
    const previousController = panel.__lzFeaturedRailController;
    const previousProgress = previousController?.getState?.().progress || 0;
    const changed = setHtmlIfChanged(panel, featuredHtml);
    if (changed) previousController?.destroy?.();
    if (!panel.__lzFeaturedRailController) {
      createHomeFeaturedRailController(panel, featuredItems.length, previousProgress);
    } else {
      panel.__lzFeaturedRailController.refresh?.();
    }
    ensureHomeCoverFallbacks(panel);
  }

  function installHomeSearchBoost() {
    const input = homeSearchInput();
    if (!input || input.dataset.lzHomeSearchBoost === "true") return;
    input.dataset.lzHomeSearchBoost = "true";
    input.placeholder = "Search a title, genre, or vibe - try slope, football, zombie";
    const block = input.closest(".mt-8") || input.parentElement;
    if (!block) return;
    block.classList.add("lz-search-boost");
    if (!block.querySelector(".lz-search-eyebrow")) {
      const eyebrow = document.createElement("div");
      eyebrow.className = "lz-search-eyebrow";
      eyebrow.textContent = "Find something fast";
      block.insertAdjacentElement("afterbegin", eyebrow);
    }
    if (!block.querySelector(".lz-search-suggestions")) {
      const suggestions = document.createElement("div");
      suggestions.className = "lz-search-suggestions";
      suggestions.innerHTML = HOME_SEARCH_SUGGESTIONS.map(term => `<button type="button" data-lz-search-suggestion="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join("");
      block.insertAdjacentElement("beforeend", suggestions);
    }
  }

  function currentHomeStatsText() {
    const count = cleanAccountName(document.querySelector('[data-testid="games-count-header"], [data-testid="search-results-count"]')?.textContent || "");
    return count || "Thousands of zones ready to launch";
  }

  function installHomeDiscoverySection() {
    const main = document.querySelector("main");
    const grid = document.querySelector('[data-testid="games-grid"]');
    if (!main || !grid) return;
    let section = document.getElementById("lz-home-discovery");
    if (!section) {
      section = document.createElement("section");
      section.id = "lz-home-discovery";
      section.setAttribute("data-lz-home-enhancement", "true");
    }
    if (section.parentElement !== grid || section !== grid.firstElementChild) {
      grid.insertBefore(section, grid.firstElementChild);
    }
    const recent = readRecentZones();
    const continueItems = recent.length
      ? recent.slice(0, 4).map(item => ({ ...item, badge: "Recent", reason: "Continue where you left off." }))
      : HOME_STARTER_ZONES.slice(0, 4);
    const continueKicker = recent.length ? "Recently played" : "New here";
    const continueTitle = recent.length ? "Continue playing" : "Start with a sure thing";
    const continueCopy = recent.length ? "Jump back into the zones you opened last." : "Your recent zones will appear here after you play.";
    const html = `
      <div class="lz-home-section-head">
        <div>
          <span>${escapeHtml(currentHomeStatsText())}</span>
          <h2>Pick a zone and go full-screen.</h2>
        </div>
        <button type="button" data-lz-home-focus-search>Search library</button>
      </div>
      <div class="lz-home-flow-grid">
        <div class="lz-home-flow-card is-continue">
          <div class="lz-home-flow-title">
            <span>${escapeHtml(continueKicker)}</span>
            <strong>${escapeHtml(continueTitle)}</strong>
            <small>${escapeHtml(continueCopy)}</small>
          </div>
          <div class="lz-home-continue-list">
            ${continueItems.map(item => homeGameCardHtml(item, "mini")).join("")}
          </div>
        </div>
        <div class="lz-home-flow-card is-recommended">
          <div class="lz-home-flow-title">
            <span>Recommended</span>
            <strong>Popular right now</strong>
            <small>Fast-loading picks across action, sports, strategy, and idle.</small>
          </div>
          <div class="lz-home-recommended-grid">
            ${HOME_RECOMMENDED_ZONES.map(item => homeGameCardHtml(item, "tile")).join("")}
          </div>
        </div>
      </div>
      <div class="lz-home-popular-searches" aria-label="Popular searches">
        <span>Popular searches</span>
        ${HOME_SEARCH_SUGGESTIONS.map(term => `<button type="button" data-lz-search-suggestion="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join("")}
      </div>
    `;
    setHtmlIfChanged(section, html);
    ensureHomeCoverFallbacks(section);
  }

  function enhanceHomeGameCards() {
    Array.from(document.querySelectorAll('a[data-testid^="game-tile-"], .tile[href*="/zone/"]')).forEach((card, index) => {
      card.dataset.lzHomeCardEnhanced = "true";
      card.classList.add("lz-catalog-card");
      const slug = zoneSlugFromHref(card.getAttribute("href") || "");
      const title = homeCardTitleFromAnchor(card) || zoneTitleFromSlug(slug);
      const category = catalogCardCategory(slug, title);
      const description = catalogCardDescription(slug, title, category);
      card.dataset.lzCardCategory = category;
      if (title) setAttributeIfChanged(card, "aria-label", `Open ${title} - ${category} zone`);

      const metaRow = catalogCardMetaRow(card);
      if (metaRow) {
        metaRow.classList.add("lz-card-meta-row");
        const kicker = metaRow.firstElementChild?.tagName === "SPAN" ? metaRow.firstElementChild : null;
        if (kicker) {
          kicker.classList.add("lz-card-kicker");
          kicker.textContent = category;
        }
        const actions = metaRow.querySelector('[data-testid^="save-game-tile-"]')?.parentElement;
        actions?.classList?.add("lz-card-actions");
        if (!metaRow.querySelector(".lz-card-fast-badge")) {
          const fastBadge = document.createElement("span");
          fastBadge.className = "lz-card-fast-badge";
          fastBadge.textContent = "Instant";
          if (kicker) kicker.insertAdjacentElement("afterend", fastBadge);
          else metaRow.insertAdjacentElement("afterbegin", fastBadge);
        }
      }

      const titleEl = card.querySelector(".tile-title") || card.querySelector("h3,h2,strong");
      titleEl?.classList?.add("lz-card-title");
      if (titleEl && !card.querySelector(".lz-card-description")) {
        const summary = document.createElement("span");
        summary.className = "lz-card-description";
        titleEl.insertAdjacentElement("afterend", summary);
      }
      const summary = card.querySelector(".lz-card-description");
      if (summary) summary.textContent = description;

      const cover = card.querySelector(".lz-game-cover");
      if (cover) {
        cover.classList.add("lz-card-cover");
        cover.setAttribute("aria-hidden", "true");
        const image = cover.querySelector("img");
        if (image) {
          image.width = image.width || 320;
          image.height = image.height || 180;
          image.decoding = "async";
          const shouldPrioritize = isHomeRoute() && index < 8;
          image.loading = shouldPrioritize ? "eager" : "lazy";
          if ("fetchPriority" in image) image.fetchPriority = shouldPrioritize ? "high" : "low";
          if (image.complete && image.naturalWidth) {
            cover.classList.remove("is-loading");
            cover.classList.add("is-ready");
          } else if (image.dataset.lzCardLoadWatched !== "true") {
            image.dataset.lzCardLoadWatched = "true";
            cover.classList.add("is-loading");
            image.addEventListener("load", () => {
              cover.classList.remove("is-loading");
              cover.classList.add("is-ready");
            }, { once: true });
          }
        } else if (cover.querySelector("svg")) {
          cover.classList.remove("is-loading");
          cover.classList.add("is-ready");
        }
        ensureCatalogCoverCue(cover);
      }
    });
    if (mountZoneCardRatings()) scheduleZoneRatingsForRoute(isHomeRoute() ? 8500 : 1200);
  }

  function triggerHomeSearch(term = "") {
    const input = homeSearchInput();
    if (!input) return;
    input.focus();
    if (term) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
      if (setter) setter.call(input, term);
      else input.value = term;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function homeSearchInput() {
    return document.querySelector('[data-testid="search-input"], input[type="search"]')
      || Array.from(document.querySelectorAll("input")).find(input => /search/i.test(input.getAttribute("placeholder") || ""));
  }

  let homeBetaCloseTimer = 0;
  let homeBetaPositionFrame = 0;
  let homeBetaSuppressFocusOpen = false;

  function homeBrandTextElement() {
    const brand = document.querySelector('[data-testid="brand-link"]');
    if (!brand) return null;
    return Array.from(brand.children || []).find(child => /learning\s*zones/i.test(child.textContent || ""))
      || Array.from(brand.querySelectorAll("span")).find(child => /learning\s*zones/i.test(child.textContent || ""))
      || null;
  }

  function closeHomeBetaPopover(options = {}) {
    clearTimeout(homeBetaCloseTimer);
    const trigger = document.getElementById("lz-home-beta-trigger");
    const popover = document.getElementById("lz-home-beta-popover");
    if (!trigger || !popover || popover.hidden) return;
    popover.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (options.restoreFocus) {
      homeBetaSuppressFocusOpen = true;
      trigger.focus({ preventScroll: true });
      queueMicrotask(() => {
        homeBetaSuppressFocusOpen = false;
      });
    }
  }

  function positionHomeBetaUi() {
    cancelAnimationFrame(homeBetaPositionFrame);
    homeBetaPositionFrame = requestAnimationFrame(() => {
      const trigger = document.getElementById("lz-home-beta-trigger");
      const popover = document.getElementById("lz-home-beta-popover");
      const brandText = homeBrandTextElement();
      if (!trigger || !popover) return;
      const canShow = isHomeRoute()
        && window.matchMedia("(min-width: 640px)").matches
        && brandText
        && isActuallyVisible(brandText);
      trigger.hidden = !canShow;
      if (!canShow) {
        closeHomeBetaPopover();
        return;
      }

      const brandRect = brandText.getBoundingClientRect();
      const triggerHeight = trigger.offsetHeight || 28;
      trigger.style.left = `${Math.round(brandRect.right + 8)}px`;
      trigger.style.top = `${Math.round(brandRect.top + Math.max(0, (brandRect.height - triggerHeight) / 2))}px`;
      if (popover.hidden) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportLeft = Math.max(0, window.visualViewport?.offsetLeft || 0);
      const viewportTop = Math.max(0, window.visualViewport?.offsetTop || 0);
      const viewportWidth = window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || document.documentElement.clientHeight || window.innerHeight;
      const edge = 12;
      const maxLeft = viewportLeft + viewportWidth - popoverRect.width - edge;
      const preferredLeft = triggerRect.left;
      const left = Math.max(viewportLeft + edge, Math.min(preferredLeft, maxLeft));
      const belowTop = triggerRect.bottom + 9;
      const aboveTop = triggerRect.top - popoverRect.height - 9;
      const fitsBelow = belowTop + popoverRect.height <= viewportTop + viewportHeight - edge;
      const top = fitsBelow ? belowTop : Math.max(viewportTop + edge, aboveTop);
      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
      popover.dataset.placement = fitsBelow ? "bottom" : "top";
      delete popover.dataset.lzPositioning;
    });
  }

  function openHomeBetaPopover(options = {}) {
    clearTimeout(homeBetaCloseTimer);
    const trigger = document.getElementById("lz-home-beta-trigger");
    const popover = document.getElementById("lz-home-beta-popover");
    if (!trigger || !popover || trigger.hidden || !isHomeRoute()) return;
    popover.dataset.lzPositioning = "true";
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionHomeBetaUi();
    if (options.focusClose) {
      requestAnimationFrame(() => popover.querySelector("[data-lz-beta-close]")?.focus({ preventScroll: true }));
    }
  }

  function scheduleHomeBetaClose() {
    clearTimeout(homeBetaCloseTimer);
    homeBetaCloseTimer = setTimeout(() => {
      const trigger = document.getElementById("lz-home-beta-trigger");
      const popover = document.getElementById("lz-home-beta-popover");
      const focusedInside = popover?.contains(document.activeElement);
      const focusedTrigger = trigger === document.activeElement;
      if (!trigger?.matches(":hover") && !popover?.matches(":hover") && !focusedInside && !focusedTrigger) {
        closeHomeBetaPopover();
      }
    }, 120);
  }

  function ensureHomeBetaBadge() {
    let trigger = document.getElementById("lz-home-beta-trigger");
    let popover = document.getElementById("lz-home-beta-popover");
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.id = "lz-home-beta-trigger";
      trigger.className = "lz-home-beta-trigger";
      trigger.type = "button";
      trigger.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", "lz-home-beta-popover");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-label", "Learning Zones Beta information");
      trigger.innerHTML = `
        <span>BETA</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="7.2"></circle>
          <path d="M10 8.7v4.15M10 6.15h.01"></path>
        </svg>
      `;
      document.body.appendChild(trigger);
    }
    if (!popover) {
      popover = document.createElement("section");
      popover.id = "lz-home-beta-popover";
      popover.className = "lz-home-beta-popover";
      popover.hidden = true;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-modal", "false");
      popover.setAttribute("aria-labelledby", "lz-home-beta-title");
      popover.innerHTML = `
        <div class="lz-home-beta-popover-mark" aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <circle cx="10" cy="10" r="7.2"></circle>
            <path d="M10 8.7v4.15M10 6.15h.01"></path>
          </svg>
        </div>
        <div class="lz-home-beta-popover-copy">
          <h2 id="lz-home-beta-title">Learning Zones Beta</h2>
          <p>Learning Zones is actively being improved. Some features may not be available yet or may not be working to their best capability.</p>
          <button type="button" data-lz-beta-close>Got it</button>
        </div>
      `;
      document.body.appendChild(popover);
    }
    if (trigger.dataset.lzBetaReady !== "true") {
      trigger.dataset.lzBetaReady = "true";
      trigger.addEventListener("mouseenter", () => openHomeBetaPopover());
      trigger.addEventListener("mouseleave", scheduleHomeBetaClose);
      trigger.addEventListener("focus", () => {
        if (!homeBetaSuppressFocusOpen) openHomeBetaPopover();
      });
      trigger.addEventListener("blur", scheduleHomeBetaClose);
      trigger.addEventListener("click", event => {
        event.preventDefault();
        openHomeBetaPopover({ focusClose: true });
      });
      popover.addEventListener("mouseenter", () => clearTimeout(homeBetaCloseTimer));
      popover.addEventListener("mouseleave", scheduleHomeBetaClose);
      popover.addEventListener("focusout", scheduleHomeBetaClose);
      popover.querySelector("[data-lz-beta-close]")?.addEventListener("click", () => {
        closeHomeBetaPopover({ restoreFocus: true });
      });
      document.addEventListener("pointerdown", event => {
        if (popover.hidden || trigger.contains(event.target) || popover.contains(event.target)) return;
        closeHomeBetaPopover();
      }, true);
      document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || popover.hidden) return;
        event.preventDefault();
        closeHomeBetaPopover({ restoreFocus: true });
      });
      window.addEventListener("resize", positionHomeBetaUi, { passive: true });
      window.addEventListener("scroll", positionHomeBetaUi, { passive: true });
      window.visualViewport?.addEventListener?.("resize", positionHomeBetaUi, { passive: true });
      window.visualViewport?.addEventListener?.("scroll", positionHomeBetaUi, { passive: true });
    }
    positionHomeBetaUi();
  }

  function syncHomeDiscoveryForRoute() {
    noteCurrentZoneFromRoute();
    const homeRoute = isHomeRoute();
    document.documentElement.classList.toggle("lz-home-route", homeRoute);
    if (!homeRoute) {
      window.learningZonesFeaturedRail?.destroy?.();
      document.getElementById("lz-home-featured-panel")?.__lzFeaturedRailController?.destroy?.();
      document.documentElement.classList.remove("lz-home-enhanced");
      positionHomeBetaUi();
      return;
    }
    const heroWrap = document.querySelector(".grain > div");
    if (!heroWrap || !document.querySelector('[data-testid="games-grid"]')) return;
    ensureHomeBetaBadge();
    installHomeHeroPanel(heroWrap);
    installHomeSearchBoost();
    installHomeDiscoverySection();
    enhanceHomeGameCards();
    document.documentElement.classList.add("lz-home-enhanced");
    scheduleStaticMediaOptimization(document, 80);
    scheduleScrollReveal(document, 140);
    if (!gameCoverManifestLoaded) {
      loadGameCoverManifest(false).then(() => {
        if (isHomeRoute()) {
          installHomeHeroPanel(heroWrap);
          installHomeDiscoverySection();
        }
      }).catch(() => {});
    }
  }

  function scheduleHomeDiscoveryForRoute(delay = 160) {
    clearTimeout(homeDiscoveryTimer);
    if (!isHomeRoute() && !document.documentElement.classList.contains("lz-home-enhanced")) return;
    homeDiscoveryTimer = setTimeout(() => runWhenMainThreadFree(syncHomeDiscoveryForRoute, 900), delay);
  }

  function scheduleHomeDiscoveryWarmup() {
    if (!isHomeRoute()) return;
    [450, 1200, 2600, 5200].forEach(delay => {
      setTimeout(syncHomeDiscoveryForRoute, delay);
    });
  }

  function watchHomeDiscoveryMount() {
    if (window.__learningZonesHomeDiscoveryWatch) return;
    window.__learningZonesHomeDiscoveryWatch = true;
    installCatalogCardInteractionFeedback();
    document.addEventListener("click", event => {
      const searchButton = event.target?.closest?.("[data-lz-search-suggestion]");
      if (searchButton) {
        event.preventDefault();
        triggerHomeSearch(searchButton.getAttribute("data-lz-search-suggestion") || "");
        return;
      }
      const focusSearch = event.target?.closest?.("[data-lz-home-focus-search]");
      if (focusSearch) {
        event.preventDefault();
        triggerHomeSearch("");
        return;
      }
      const scrollTarget = event.target?.closest?.("[data-lz-home-scroll]");
      if (scrollTarget) {
        event.preventDefault();
        document.querySelector(scrollTarget.getAttribute("data-lz-home-scroll") || "")?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      const link = event.target?.closest?.('a[href*="/zone/"]');
      if (!link) return;
      const slug = link.getAttribute("data-lz-home-zone") || zoneSlugFromHref(link.getAttribute("href") || "");
      rememberRecentZone({
        slug,
        title: cleanAccountName(link.querySelector("strong")?.textContent || homeCardTitleFromAnchor(link) || zoneTitleFromSlug(slug)),
        coverSrc: link.querySelector("img")?.getAttribute("src") || homeCoverSrcForSlug(slug)
      }, false);
      if (link.closest?.("[data-lz-home-enhancement]") && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!("button" in event) || event.button === 0)) {
        const href = link.getAttribute("href") || homeZoneHref(slug);
        if (href && history.pushState) {
          event.preventDefault();
          history.pushState(null, "", href);
          window.dispatchEvent(new PopStateEvent("popstate"));
          scheduleHomeDiscoveryForRoute(120);
        }
      }
    }, true);
    new MutationObserver(mutations => {
      if (mutationAddsMatching(mutations, '[data-testid="site-header"], [data-testid="brand-link"], [data-testid="games-grid"], a[data-testid^="game-tile-"], [data-lz-home-enhancement]')) {
        scheduleHomeDiscoveryForRoute(180);
      }
    }).observe(document.getElementById("root") || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  async function firebaseServerClock() {
    const nowStamp = Date.now();
    if (streakServerClockCache && nowStamp - streakServerClockCache.cachedAt < 60 * 1000) {
      const stamp = streakServerClockCache.stamp + (nowStamp - streakServerClockCache.cachedAt);
      return { stamp, day: isoDayFromStamp(stamp), source: streakServerClockCache.source };
    }
    try {
      const response = await fetch(`${DB}/.json?shallow=true&cb=${nowStamp}`, { cache: "no-store" });
      const header = response.headers.get("date");
      const stamp = header ? Date.parse(header) : nowStamp;
      const safeStamp = Number.isFinite(stamp) ? stamp : nowStamp;
      streakServerClockCache = {
        stamp: safeStamp,
        cachedAt: nowStamp,
        source: header ? "firebase-date-header" : "local-fallback"
      };
      return { stamp: safeStamp, day: isoDayFromStamp(safeStamp), source: streakServerClockCache.source };
    } catch (error) {
      streakServerClockCache = { stamp: nowStamp, cachedAt: nowStamp, source: "local-fallback" };
      return { stamp: nowStamp, day: isoDayFromStamp(nowStamp), source: "local-fallback" };
    }
  }

  async function patchFirebaseRootAccount(userId, patch) {
    return fetch(firebaseUrl(["accounts", userId]), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }).catch(() => null);
  }

  async function mergeGuestStreakIntoAccount(userId, account, clock) {
    const guest = readJson(GUEST_STREAK_KEY, null);
    const guestDays = sortedUniqueDays([
      ...(Array.isArray(guest?.playedDays) ? guest.playedDays : []),
      ...(guest?.lastActiveDate ? [guest.lastActiveDate] : [])
    ]);
    if (!userId || !guestDays.length) return account || {};
    const merged = mergeStreakPlayedDays(account || {}, guestDays);
    const patch = streakAccountPatch(merged, clock?.stamp || Date.now());
    patch.updatedAt = Math.max(Number(account?.updatedAt || 0), clock?.stamp || Date.now());
    await patchChatState(["accounts", userId], patch);
    patchFirebaseRootAccount(userId, patch);
    writeJson(GUEST_STREAK_KEY, null);
    return { ...(account || {}), ...patch };
  }

  function applyStreakToCurrentSnapshot(userId, username, streak, source = "streak") {
    const patch = streakProfilePatch(streak);
    const base = currentSnapshot || readJson(CACHE_KEY, null) || {};
    const next = makeSnapshot({
      version: 2,
      ...base,
      id: userId || base.id || key(username),
      username: username || base.username || userId,
      role: base.role || "user",
      status: base.status || "approved",
      profile: { ...(base.profile || readJson(PROFILE_KEY, null) || {}), ...patch },
      streak: patch.streak,
      currentStreak: patch.currentStreak,
      longestStreak: patch.longestStreak,
      lastActiveDate: patch.lastActiveDate,
      friends: base.friends || readJson(FRIENDS_KEY, null) || { count: 0, users: [] },
      source
    });
    if (next) applySnapshot(next);
  }

  function showStreakMilestoneToast(days) {
    if (!STREAK_MILESTONES.includes(Number(days))) return;
    installChatOverlayStyles();
    let toast = document.getElementById("lz-streak-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "lz-streak-toast";
      toast.className = "lz-streak-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<strong>&#128293; ${Number(days)} day streak!</strong><span>Nice run. Your profile has been updated.</span>`;
    toast.classList.add("is-visible");
    clearTimeout(showStreakMilestoneToast.timer);
    showStreakMilestoneToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
  }

  function storeGuestStreak(streak) {
    const clean = streakStateFromSource(streak);
    writeJson(GUEST_STREAK_KEY, {
      current: clean.current,
      longest: clean.longest,
      lastActiveDate: clean.lastActiveDate,
      playedDays: clean.playedDays,
      updatedAt: Date.now()
    });
  }

  async function recordDailyStreakForGame(slug) {
    const zoneSlug = String(slug || "").trim();
    if (!zoneSlug || isLoginSurface()) return;
    const clock = await firebaseServerClock();
    const today = normalizeIsoDay(clock.day);
    if (!today) return;
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    const sessionKey = `lz-streak-play:${userId || "guest"}:${today}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, zoneSlug);
    } catch (error) {}
    if (!userId) {
      const next = applyStreakPlay(readJson(GUEST_STREAK_KEY, null) || {}, today);
      if (next.changed) storeGuestStreak(next);
      return;
    }
    const currentAccount = await fetchJson(chatStateUrl(["accounts", userId])).catch(() => null)
      || await fetchJson(firebaseUrl(["accounts", userId])).catch(() => null)
      || {};
    const account = await mergeGuestStreakIntoAccount(userId, currentAccount, clock);
    const next = applyStreakPlay(account, today);
    if (!next.changed) {
      const stable = streakStateFromSource(account);
      applyStreakToCurrentSnapshot(userId, account.username || loggedInUsername(), stable, "streak-existing");
      renderHeaderStreak();
      renderSiteProfile();
      return;
    }
    const patch = streakAccountPatch(next, clock.stamp);
    patch.updatedAt = Math.max(Number(account.updatedAt || 0), clock.stamp || Date.now());
    await patchChatState(["accounts", userId], patch);
    patchFirebaseRootAccount(userId, patch);
    applyStreakToCurrentSnapshot(userId, account.username || loggedInUsername(), { ...next, lastPlayedAt: clock.stamp }, "streak-play");
    renderHeaderStreak();
    renderSiteProfile();
    if (next.milestone) showStreakMilestoneToast(next.milestone);
  }

  function isFirebaseErrorPayload(value) {
    return !!value && typeof value === "object" && typeof value.error === "string";
  }

  function stateUrl(child) {
    return CHAT_STATE_ROOT + "/" + encodeURIComponent(child) + ".json";
  }

  function chatStateUrl(parts) {
    return DB + "/" + ["rooms", "_deluxeAppState", "state"].concat(parts || []).map(encodeURIComponent).join("/") + ".json";
  }

  function chatTypingUrl(parts) {
    return DB + "/" + ["rooms", "_deluxeAppState", "typing"].concat(parts || []).map(encodeURIComponent).join("/") + ".json";
  }

  function chatStateQueryUrl(parts, query) {
    return chatStateUrl(parts).replace(/\.json$/, ".json" + (query ? `?${query}` : ""));
  }

  async function writeChatState(parts, value, method = "PUT") {
    const response = await fetch(chatStateUrl(parts), {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error(`write_failed_${response.status}`);
    return response.json().catch(() => null);
  }

  async function patchChatState(parts, value) {
    return writeChatState(parts, value, "PATCH");
  }

  async function removeChatState(parts) {
    const response = await fetch(chatStateUrl(parts), { method: "DELETE" });
    if (!response.ok) throw new Error(`delete_failed_${response.status}`);
    return null;
  }

  async function writeChatTyping(parts, value, method = "PUT") {
    const response = await fetchWithTimeout(chatTypingUrl(parts), {
      method,
      cache: "no-store",
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(value)
    }, 1800);
    if (!response.ok) throw new Error(`typing_write_failed_${response.status}`);
    return true;
  }

  async function touchChatState(extra = {}) {
    const stamp = Date.now();
    await patchChatState([], { updatedAt: stamp, ...extra });
    return stamp;
  }

  async function appendOverlayModLog(message) {
    const current = await fetchJson(chatStateUrl(["modLog"])).catch(() => []) || [];
    const rows = Array.isArray(current) ? current : [];
    rows.push(String(message || "").slice(0, 180));
    await writeChatState(["modLog"], rows.slice(-80));
  }

  function overlayFilterForText(text, filters) {
    const lowered = String(text || "").toLowerCase();
    return (Array.isArray(filters) ? filters : [])
      .map(item => String(item || "").trim())
      .find(item => item && lowered.includes(item.toLowerCase())) || "";
  }

  async function fetchGlobalMessageMap() {
    const query = `orderBy=${encodeURIComponent('"room"')}&equalTo=${encodeURIComponent('"global"')}`;
    const queried = await fetchJson(chatStateQueryUrl(["messages"], query)).catch(() => null);
    if (queried && typeof queried === "object" && !isFirebaseErrorPayload(queried)) return queried;
    const allMessages = await fetchJson(chatStateUrl(["messages"])).catch(() => null);
    if (!allMessages || typeof allMessages !== "object" || isFirebaseErrorPayload(allMessages)) return {};
    return Object.fromEntries(
      Object.entries(allMessages)
        .filter(([, message]) => message && String(message.room || "global") === "global")
    );
  }

  async function fetchRecentOverlayMessages(limit = OVERLAY_MESSAGE_LIMIT, timeoutMs = FIREBASE_REQUEST_TIMEOUT_MS) {
    const query = `orderBy=${encodeURIComponent('"time"')}&limitToLast=${Math.max(1, Number(limit || OVERLAY_MESSAGE_LIMIT))}`;
    let rows = await fetchJson(chatStateQueryUrl(["messages"], query), timeoutMs).catch(() => null);
    if (!rows || isFirebaseErrorPayload(rows)) {
      rows = await fetchJson(chatStateUrl(["messages"]), timeoutMs).catch(() => null);
    }
    if (!rows || isFirebaseErrorPayload(rows)) return [];
    return overlayMessageList(rows).slice(-limit);
  }

  async function fetchOverlayRoomMessages(roomId, limit = OVERLAY_MESSAGE_LIMIT) {
    const cleanRoom = String(roomId || "").trim();
    if (!cleanRoom) return [];
    const query = `orderBy=${encodeURIComponent('"room"')}&equalTo=${encodeURIComponent(JSON.stringify(cleanRoom))}`;
    let rows = await fetchJson(chatStateQueryUrl(["messages"], query)).catch(() => null);
    if (!rows || isFirebaseErrorPayload(rows)) {
      rows = await fetchJson(chatStateUrl(["messages"])).catch(() => null);
    }
    if (!rows || isFirebaseErrorPayload(rows)) return [];
    return overlayMessageList(rows).filter(message => message.room === cleanRoom).slice(-limit);
  }

  function publicPartyCount(parties) {
    return Object.values(parties || {}).filter(party => {
      if (!party || typeof party !== "object") return false;
      const status = String(party.status || "").toLowerCase();
      const visibility = String(party.visibility || party.access || party.privacy || "public").toLowerCase();
      return status !== "ended" && !party.endedAt && visibility === "public";
    }).length;
  }

  function chattingNowCount(messages) {
    const cutoff = Date.now() - CHATTING_NOW_WINDOW_MS;
    const users = new Set();
    overlayMessageList(messages)
      .filter(message => message.room === "global" && Number(message.time || 0) >= cutoff)
      .forEach(message => {
        const userId = key(message.user || message.username || message.userKey);
        if (userId) users.add(userId);
      });
    return users.size;
  }

  function emptyChatNotificationCounts() {
    return { global: 0, direct: 0, mentions: 0, total: 0 };
  }

  function chatNotificationUserId() {
    return key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
  }

  function chatNotificationState(userId = chatNotificationUserId()) {
    const stored = readJson(CHAT_NOTIFICATION_KEY, null);
    if (!userId || !stored || stored.userId !== userId) {
      return {
        userId: userId || "",
        initializedAt: 0,
        allSeenAt: 0,
        globalSeenAt: 0,
        roomSeenAt: {}
      };
    }
    const roomSeenAt = {};
    Object.entries(stored.roomSeenAt || {}).slice(0, 80).forEach(([roomId, stamp]) => {
      const cleanRoom = String(roomId || "").trim();
      const cleanStamp = numericStamp(stamp);
      if (cleanRoom && cleanStamp) roomSeenAt[cleanRoom] = cleanStamp;
    });
    return {
      userId,
      initializedAt: numericStamp(stored.initializedAt),
      allSeenAt: numericStamp(stored.allSeenAt),
      globalSeenAt: numericStamp(stored.globalSeenAt),
      roomSeenAt
    };
  }

  function saveChatNotificationState(state) {
    if (!state?.userId) return;
    const roomEntries = Object.entries(state.roomSeenAt || {})
      .filter(([, stamp]) => numericStamp(stamp))
      .sort((first, second) => numericStamp(second[1]) - numericStamp(first[1]))
      .slice(0, 80);
    writeJson(CHAT_NOTIFICATION_KEY, {
      userId: state.userId,
      initializedAt: numericStamp(state.initializedAt) || Date.now(),
      allSeenAt: numericStamp(state.allSeenAt),
      globalSeenAt: numericStamp(state.globalSeenAt),
      roomSeenAt: Object.fromEntries(roomEntries),
      updatedAt: Date.now()
    });
  }

  function hideChatNotificationBubble(immediate = false) {
    const bubble = document.getElementById("lz-chat-notification-bubble");
    if (!bubble) return;
    clearTimeout(chatNotificationHideTimer);
    if (bubble.hidden) return;
    const wasVisible = bubble.classList.contains("is-visible");
    bubble.classList.remove("is-visible");
    if (immediate || !wasVisible) {
      bubble.hidden = true;
      return;
    }
    chatNotificationHideTimer = setTimeout(() => {
      if (!bubble.classList.contains("is-visible")) bubble.hidden = true;
    }, 190);
  }

  function ensureChatNotificationBubble() {
    let bubble = document.getElementById("lz-chat-notification-bubble");
    if (bubble) return bubble;
    installChatOverlayStyles();
    bubble = document.createElement("section");
    bubble.id = "lz-chat-notification-bubble";
    bubble.className = "lz-chat-notification-bubble";
    bubble.hidden = true;
    bubble.setAttribute("role", "region");
    bubble.setAttribute("aria-label", "Chat notifications");
    bubble.setAttribute("data-testid", "chat-notification-bubble");
    bubble.innerHTML = `
      <button type="button" class="lz-chat-notification-main" data-lz-chat-notification-open>
        <span class="lz-chat-notification-icon" aria-hidden="true">${chatIcon()}</span>
        <span class="lz-chat-notification-copy" aria-live="polite">
          <strong>New chat activity</strong>
          <span class="lz-chat-notification-summary" data-lz-chat-notification-summary></span>
        </span>
      </button>
      <button type="button" class="lz-chat-notification-dismiss" data-lz-chat-notification-dismiss aria-label="Mark chat notifications as read">&times;</button>
    `;
    bubble.querySelector("[data-lz-chat-notification-open]")?.addEventListener("click", () => {
      markChatNotificationsRead({ throughNow: true });
      const launcher = document.getElementById("lz-chat-open-button");
      if (launcher && !launcher.hidden) launcher.click();
      else location.href = "/chat";
    });
    bubble.querySelector("[data-lz-chat-notification-dismiss]")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      markChatNotificationsRead();
    });
    document.body.appendChild(bubble);
    return bubble;
  }

  function positionChatNotificationBubble() {
    const bubble = document.getElementById("lz-chat-notification-bubble");
    const button = document.getElementById("lz-chat-open-button");
    if (!bubble || bubble.hidden || !button || button.hidden) return;
    const buttonBox = button.getBoundingClientRect();
    const bubbleBox = bubble.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = Number(viewport?.offsetLeft || 0);
    const viewportTop = Number(viewport?.offsetTop || 0);
    const viewportWidth = Number(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    const viewportHeight = Number(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const margin = 10;
    const gap = 10;
    const preferredLeft = buttonBox.right - bubbleBox.width;
    const left = Math.max(viewportLeft + margin, Math.min(preferredLeft, viewportLeft + viewportWidth - bubbleBox.width - margin));
    const aboveTop = buttonBox.top - bubbleBox.height - gap;
    const fitsAbove = aboveTop >= viewportTop + margin;
    const header = button.closest('[data-testid="site-header"], header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    const belowAnchor = Math.max(buttonBox.bottom + gap, headerBottom ? headerBottom + 8 : 0);
    const belowTop = Math.min(belowAnchor, viewportTop + viewportHeight - bubbleBox.height - margin);
    const top = fitsAbove ? aboveTop : Math.max(viewportTop + margin, belowTop);
    bubble.classList.toggle("is-below", !fitsAbove);
    const leftValue = `${Math.round(left)}px`;
    const topValue = `${Math.round(top)}px`;
    if (bubble.style.left !== leftValue) bubble.style.left = leftValue;
    if (bubble.style.top !== topValue) bubble.style.top = topValue;
  }

  function renderChatNotificationIndicator(snapshot = chatNotificationLatest) {
    const button = document.getElementById("lz-chat-open-button");
    const counts = snapshot?.counts || emptyChatNotificationCounts();
    const total = Math.max(0, Number(counts.total || 0));
    if (button) {
      let badge = button.querySelector("[data-lz-chat-notification-count]");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "lz-chat-notification-count";
        badge.dataset.lzChatNotificationCount = "true";
        badge.setAttribute("data-testid", "chat-notification-count");
        badge.setAttribute("aria-hidden", "true");
        button.appendChild(badge);
      }
      const badgeText = total > 99 ? "99+" : String(total);
      if (badge.textContent !== badgeText) badge.textContent = badgeText;
      if (badge.hidden !== (total === 0)) badge.hidden = total === 0;
      const buttonLabel = total
        ? `Open chat overlay, ${total} unread message${total === 1 ? "" : "s"}`
        : "Open chat overlay";
      if (button.getAttribute("aria-label") !== buttonLabel) button.setAttribute("aria-label", buttonLabel);
    }
    if (!button || button.hidden || !total || isChatRoute() || isLoginSurface() || document.body?.classList.contains("lz-chat-overlay-open")) {
      hideChatNotificationBubble();
      return;
    }
    const bubble = ensureChatNotificationBubble();
    const summary = bubble.querySelector("[data-lz-chat-notification-summary]");
    const parts = [];
    if (counts.global) parts.push(`<span><b>${counts.global}</b> Global</span>`);
    if (counts.direct) parts.push(`<span><b>${counts.direct}</b> ${counts.direct === 1 ? "DM" : "DMs"}</span>`);
    if (counts.mentions) parts.push(`<span><b>${counts.mentions}</b> @ mention${counts.mentions === 1 ? "" : "s"}</span>`);
    if (summary) setHtmlIfChanged(summary, parts.join(""));
    const open = bubble.querySelector("[data-lz-chat-notification-open]");
    const openLabel = `Open chat overlay. ${total} unread message${total === 1 ? "" : "s"}: ${parts.map(part => part.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).join(", ")}.`;
    if (open?.getAttribute("aria-label") !== openLabel) open?.setAttribute("aria-label", openLabel);
    clearTimeout(chatNotificationHideTimer);
    if (bubble.hidden) bubble.hidden = false;
    positionChatNotificationBubble();
    requestAnimationFrame(() => {
      positionChatNotificationBubble();
      bubble.classList.add("is-visible");
    });
  }

  function buildChatNotificationSnapshot(rawMessages, rawRooms, userId = chatNotificationUserId()) {
    const counts = emptyChatNotificationCounts();
    const rows = overlayMessageList(rawMessages || []);
    const visibleRooms = overlayVisiblePrivateRooms(rawRooms || {}, userId);
    const visibleRoomIds = new Set(visibleRooms.map(room => String(room.id || "")).filter(Boolean));
    const latest = { userId, globalAt: 0, rooms: {}, counts };
    const state = chatNotificationState(userId);
    const username = String(loggedInUsername() || currentSnapshot?.username || "").trim().toLowerCase();
    const mentionTokens = Array.from(new Set([username, userId].filter(Boolean).map(value => `@${value.toLowerCase()}`)));
    const unreadRows = [];

    rows.forEach(message => {
      const stamp = numericStamp(message.time);
      const roomId = String(message.room || "global");
      const senderId = key(message.user || message.username || message.userKey);
      if (roomId === "global") latest.globalAt = Math.max(latest.globalAt, stamp);
      else if (visibleRoomIds.has(roomId)) latest.rooms[roomId] = Math.max(numericStamp(latest.rooms[roomId]), stamp);
      if (!stamp || senderId === userId) return;
      const baseline = roomId === "global"
        ? Math.max(state.initializedAt, state.allSeenAt, state.globalSeenAt)
        : Math.max(state.initializedAt, state.allSeenAt, numericStamp(state.roomSeenAt?.[roomId]));
      if (stamp <= baseline) return;
      if (roomId === "global") counts.global += 1;
      else if (visibleRoomIds.has(roomId)) counts.direct += 1;
      else return;
      unreadRows.push(message);
    });

    counts.mentions = unreadRows.filter(message => {
      const text = String(message.text || "").toLowerCase();
      return mentionTokens.some(token => text.includes(token));
    }).length;
    counts.total = counts.global + counts.direct;

    if (!state.initializedAt) {
      saveChatNotificationState({
        userId,
        initializedAt: Date.now(),
        allSeenAt: 0,
        globalSeenAt: latest.globalAt,
        roomSeenAt: latest.rooms
      });
      latest.counts = emptyChatNotificationCounts();
    }
    return latest;
  }

  function syncChatNotificationsFromData(messages, rooms, options = {}) {
    const userId = chatNotificationUserId();
    if (!userId) {
      chatNotificationLatest = { userId: "", globalAt: 0, rooms: {}, counts: emptyChatNotificationCounts() };
      renderChatNotificationIndicator(chatNotificationLatest);
      return chatNotificationLatest;
    }
    chatNotificationLatest = buildChatNotificationSnapshot(messages, rooms, userId);
    if (options.markRead) markChatNotificationsRead({ throughNow: options.throughNow !== false });
    else renderChatNotificationIndicator(chatNotificationLatest);
    return chatNotificationLatest;
  }

  function markChatNotificationsRead(options = {}) {
    const userId = chatNotificationUserId();
    if (!userId) {
      hideChatNotificationBubble(true);
      return;
    }
    const state = chatNotificationState(userId);
    const throughNow = options.throughNow === true;
    const roomSeenAt = { ...(state.roomSeenAt || {}) };
    Object.entries(chatNotificationLatest.rooms || {}).forEach(([roomId, stamp]) => {
      roomSeenAt[roomId] = Math.max(numericStamp(roomSeenAt[roomId]), numericStamp(stamp));
    });
    saveChatNotificationState({
      userId,
      initializedAt: state.initializedAt || Date.now(),
      allSeenAt: throughNow ? Math.max(state.allSeenAt, Date.now()) : state.allSeenAt,
      globalSeenAt: Math.max(state.globalSeenAt, numericStamp(chatNotificationLatest.globalAt)),
      roomSeenAt
    });
    chatNotificationLatest = {
      ...chatNotificationLatest,
      userId,
      counts: emptyChatNotificationCounts()
    };
    renderChatNotificationIndicator(chatNotificationLatest);
  }

  async function refreshChatNotifications(force = false) {
    if (chatNotificationRefreshPromise) return chatNotificationRefreshPromise;
    if (!force && (document.visibilityState === "hidden" || document.body?.classList.contains("lz-chat-overlay-open"))) {
      return chatNotificationLatest;
    }
    const userId = chatNotificationUserId();
    if (!userId || isLoginSurface()) {
      chatNotificationLatest = { userId: "", globalAt: 0, rooms: {}, counts: emptyChatNotificationCounts() };
      renderChatNotificationIndicator(chatNotificationLatest);
      return chatNotificationLatest;
    }
    chatNotificationRefreshPromise = Promise.all([
      fetchRecentOverlayMessages(CHAT_NOTIFICATION_MESSAGE_LIMIT, 1800).catch(() => []),
      fetchJson(stateUrl("rooms"), 1800).catch(() => ({}))
    ]).then(([messages, rooms]) => syncChatNotificationsFromData(messages, rooms || {}, {
      markRead: isChatRoute(),
      throughNow: isChatRoute()
    })).finally(() => {
      chatNotificationRefreshPromise = null;
    });
    return chatNotificationRefreshPromise;
  }

  function scheduleChatNotificationRefresh(delay = 0) {
    clearTimeout(chatNotificationTimer);
    chatNotificationTimer = setTimeout(() => {
      refreshChatNotifications().catch(() => {}).finally(() => {
        const nextDelay = isChromebookMode() ? CHAT_NOTIFICATION_REFRESH_CHROMEBOOK_MS : CHAT_NOTIFICATION_REFRESH_MS;
        scheduleChatNotificationRefresh(nextDelay);
      });
    }, Math.max(0, Number(delay || 0)));
  }

  function watchChatNotifications() {
    if (window.__learningZonesChatNotifications) return;
    window.__learningZonesChatNotifications = true;
    scheduleChatNotificationRefresh(isChatRoute() ? 300 : 1600);
    window.addEventListener("focus", () => scheduleChatNotificationRefresh(120), { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleChatNotificationRefresh(120);
    }, { passive: true });
    window.addEventListener("resize", () => requestAnimationFrame(positionChatNotificationBubble), { passive: true });
    window.addEventListener("scroll", () => requestAnimationFrame(positionChatNotificationBubble), { passive: true });
  }

  async function fetchWhatsHappeningStats() {
    const [presence, messages, parties] = await Promise.all([
      fetchJson(stateUrl("presence"), 1200).catch(() => ({})),
      fetchRecentOverlayMessages(80, 1200).catch(() => []),
      fetchJson(stateUrl("parties"), 1200).catch(() => ({}))
    ]);
    return {
      online: onlinePresenceCount(presence || {}),
      chatting: chattingNowCount(messages || {}),
      publicParties: publicPartyCount(parties || {}),
      weeklyChallenge: "Tetris"
    };
  }

  function plural(value, singular, pluralLabel) {
    const count = Math.max(0, Number(value || 0));
    return `${count} ${count === 1 ? singular : pluralLabel}`;
  }

  function whatsHappeningBody(stats = {}) {
    const online = Number.isFinite(Number(stats.online)) ? Number(stats.online) : (loggedInUsername() ? 1 : 0);
    const chatting = Number.isFinite(Number(stats.chatting)) ? Number(stats.chatting) : 0;
    const parties = Number.isFinite(Number(stats.publicParties)) ? Number(stats.publicParties) : 0;
    const challenge = stats.weeklyChallenge || "Tetris";
    return `
      <div class="lz-whats-happening-row"><span aria-hidden="true">&#128293;</span><div><strong>${escapeHtml(plural(online, "person", "people"))}</strong> online</div></div>
      <div class="lz-whats-happening-row"><span aria-hidden="true">&#128172;</span><div><strong>${escapeHtml(String(chatting))}</strong> chatting now</div></div>
      <div class="lz-whats-happening-row"><span aria-hidden="true">&#127881;</span><div><strong>${escapeHtml(String(parties))}</strong> public ${parties === 1 ? "party" : "parties"}</div></div>
      <div class="lz-whats-happening-row"><span aria-hidden="true">&#127942;</span><div><strong>Weekly Challenge:</strong> ${escapeHtml(challenge)}</div></div>
    `;
  }

  function hideWhatsHappeningCard() {
    const card = document.getElementById("lz-whats-happening-card");
    if (card) card.classList.remove("is-visible");
    clearTimeout(whatsHappeningHideTimer);
  }

  function ensureWhatsHappeningCard() {
    installChatOverlayStyles();
    let card = document.getElementById("lz-whats-happening-card");
    if (card) return card;
    card = document.createElement("section");
    card.id = "lz-whats-happening-card";
    card.className = "lz-whats-happening-card";
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    card.innerHTML = `
      <div class="lz-whats-happening-head">
        <div class="lz-whats-happening-title">What's happening</div>
        <button type="button" class="lz-whats-happening-close" aria-label="Close what's happening">&times;</button>
      </div>
      <div class="lz-whats-happening-list" data-lz-whats-happening-list>${whatsHappeningBody({})}</div>
    `;
    card.querySelector(".lz-whats-happening-close")?.addEventListener("click", hideWhatsHappeningCard);
    document.body.appendChild(card);
    return card;
  }

  async function showWhatsHappeningCard() {
    if (isLoginSurface() || document.body?.classList.contains("lz-chat-overlay-open")) return;
    const card = ensureWhatsHappeningCard();
    const list = card.querySelector("[data-lz-whats-happening-list]");
    if (list) list.innerHTML = whatsHappeningBody({});
    requestAnimationFrame(() => card.classList.add("is-visible"));
    clearTimeout(whatsHappeningHideTimer);
    whatsHappeningHideTimer = setTimeout(hideWhatsHappeningCard, 11000);
    const stats = await fetchWhatsHappeningStats().catch(() => null);
    if (stats && list && card.isConnected) list.innerHTML = whatsHappeningBody(stats);
  }

  function scheduleWhatsHappeningCard(snapshot) {
    const userId = key(snapshot?.username || snapshot?.id || loggedInUsername());
    if (!userId || isLoginSurface()) return;
    const storageKey = `lz_whats_happening_seen:${userId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, String(Date.now()));
    } catch (error) {}
    clearTimeout(whatsHappeningTimer);
    whatsHappeningTimer = setTimeout(() => showWhatsHappeningCard().catch(() => {}), isChatRoute() ? 650 : 9000);
  }

  function pruneAccountFetchCache() {
    const cutoff = Date.now() - ACCOUNT_FETCH_CACHE_MS * 3;
    for (const [id, entry] of accountFetchCache.entries()) {
      if (!entry || Number(entry.fetchedAt || 0) < cutoff) accountFetchCache.delete(id);
    }
  }

  async function fetchAccountsByIds(ids, cached = {}) {
    const uniqueIds = Array.from(new Set((ids || []).map(key).filter(Boolean))).slice(0, 18);
    const accounts = {};
    const stamp = Date.now();
    pruneAccountFetchCache();
    await Promise.all(uniqueIds.map(async id => {
      const cachedAccount = cached?.[id];
      if (cachedAccount) accounts[id] = cachedAccount;
      const cachedFetch = accountFetchCache.get(id);
      if (cachedFetch && stamp - Number(cachedFetch.fetchedAt || 0) < ACCOUNT_FETCH_CACHE_MS) {
        accounts[id] = cachedFetch.account;
        return;
      }
      const account = await fetchJson(chatStateUrl(["accounts", id])).catch(() => null);
      if (account) {
        accounts[id] = account;
        accountFetchCache.set(id, { account, fetchedAt: stamp });
      }
    }));
    return accounts;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function displayName(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase())
      .trim() || "Friend";
  }

  function runWhenMainThreadFree(callback, timeout = 700) {
    const run = () => {
      try {
        callback();
      } catch (error) {
        console.warn("Learning Zones deferred task skipped:", error);
      }
    };
    if ("requestIdleCallback" in window) {
      return window.requestIdleCallback(run, { timeout });
    }
    return setTimeout(run, Math.min(timeout, 160));
  }

  function setHtmlIfChanged(element, html) {
    if (!element || element.__lzLastHtml === html) return false;
    element.__lzLastHtml = html;
    element.innerHTML = html;
    return true;
  }

  function setAttributeIfChanged(element, attribute, value) {
    const next = String(value ?? "");
    if (!element || element.getAttribute(attribute) === next) return;
    element.setAttribute(attribute, next);
  }

  function isChromebookMode() {
    const settings = siteSettings();
    if (settings.performanceMode === "low") return true;
    if (settings.performanceMode === "standard") return false;
    const ua = navigator.userAgent || "";
    const width = Math.max(window.innerWidth || 0, window.screen?.width || 0);
    const memory = Number(navigator.deviceMemory || 4);
    const cores = Number(navigator.hardwareConcurrency || 4);
    return /CrOS/i.test(ua) || (width >= 1000 && width <= 1400 && (memory <= 4 || cores <= 4));
  }

  function applyChromebookMode() {
    document.documentElement.dataset.lzChromebook = isChromebookMode() ? "true" : "false";
  }

  function watchChromebookMode() {
    if (window.__learningZonesChromebookModeWatch) return;
    window.__learningZonesChromebookModeWatch = true;
    applyChromebookMode();
    window.addEventListener("resize", () => {
      clearTimeout(chromebookModeTimer);
      chromebookModeTimer = setTimeout(applyChromebookMode, 180);
    }, { passive: true });
  }

  function isActuallyVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function hasVisiblePasswordField() {
    return Array.from(document.querySelectorAll('input[type="password"]')).some(isActuallyVisible);
  }

  function isLoginSurface() {
    return location.pathname.replace(/\/+$/, "") === "/login" || hasVisiblePasswordField();
  }

  function uniquePeople(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      const id = key(item?.id || item?.username);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function relationshipPairId(firstUser, secondUser) {
    const users = [key(firstUser), key(secondUser)].filter(Boolean).sort();
    return users.length === 2 && users[0] !== users[1] ? users.join("--") : "";
  }

  function normalizeOverlayRelationship(raw, rawId = "") {
    if (!raw || typeof raw !== "object") return null;
    const users = (Array.isArray(raw.users) ? raw.users : [raw.userA || raw.from, raw.userB || raw.to])
      .map(key)
      .filter(Boolean)
      .sort();
    if (users.length !== 2 || users[0] === users[1]) return null;
    const id = relationshipPairId(users[0], users[1]) || rawId;
    const status = String(raw.status || "pending").toLowerCase();
    const requestedBy = users.includes(key(raw.requestedBy || raw.from)) ? key(raw.requestedBy || raw.from) : users[0];
    return {
      id,
      users,
      status,
      requestedBy,
      createdAt: Number(raw.createdAt || raw.requestedAt || raw.updatedAt || 0),
      updatedAt: Number(raw.updatedAt || raw.createdAt || raw.requestedAt || 0),
      updatedBy: key(raw.updatedBy || requestedBy)
    };
  }

  function overlayRelationshipFor(relationships, firstUser, secondUser) {
    const pairId = relationshipPairId(firstUser, secondUser);
    return pairId ? normalizeOverlayRelationship(relationships?.[pairId], pairId) : null;
  }

  function accountAvatar(account) {
    return String(
      account?.avatar ||
      account?.profile?.avatar ||
      account?.profilePicture ||
      account?.profilePic ||
      account?.photoURL ||
      account?.photoUrl ||
      account?.pfp ||
      account?.image ||
      ""
    ).slice(0, 750000);
  }

  function numericStamp(value) {
    const stamp = Number(value || 0);
    return Number.isFinite(stamp) ? stamp : 0;
  }

  function accountLastSeen(account) {
    return Math.max(
      numericStamp(account?.lastSeen),
      numericStamp(account?.lastActive),
      numericStamp(account?.activeAt),
      numericStamp(account?.presenceUpdatedAt),
      numericStamp(account?.updatedAt)
    );
  }

  function cleanPartyName(value, fallback = "") {
    const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 42);
    return text || fallback;
  }

  function partyDisplayName(party) {
    return cleanPartyName(party?.name || party?.title || party?.partyName, party?.gameKey && party.gameKey !== "none" ? displayName(party.gameKey) : "Party Room");
  }

  function isAccountOnline(account, now = Date.now()) {
    if (!account || typeof account !== "object") return false;
    const status = String(account.status || account.presence || "").toLowerCase();
    if (["offline", "invisible", "banned", "disabled"].includes(status)) return false;
    const stamp = accountLastSeen(account);
    return stamp > 0 && now - stamp <= ONLINE_WINDOW_MS;
  }

  function onlineAccountRows(accountsMap, options = {}) {
    const now = Date.now();
    const currentUser = key(options.currentUser || loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    return overlayAccountRows(accountsMap)
      .map(person => {
        const account = accountsMap?.[person.id] || accountsMap?.[key(person.username)] || accountsMap?.[person.username] || {};
        return {
          ...person,
          lastSeen: accountLastSeen(account),
          online: isAccountOnline(account, now)
        };
      })
      .filter(person => person.online && (!options.excludeCurrent || person.id !== currentUser))
      .sort((first, second) => Number(second.lastSeen || 0) - Number(first.lastSeen || 0));
  }

  function presenceRows(presenceMap, accountsMap = {}) {
    const stamp = Date.now();
    return Object.entries(presenceMap || {}).map(([id, sessions]) => {
      const sessionRows = sessions && typeof sessions === "object" ? Object.values(sessions) : [];
      const latest = sessionRows.reduce((max, session) => Math.max(max, numericStamp(session?.at || session?.lastSeen || session?.lastActive)), 0);
      const account = accountsMap[id] || {};
      return {
        id,
        username: account.username || displayName(id),
        mood: account.status || "Online",
        avatar: accountAvatar(account),
        lastSeen: latest,
        online: latest > 0 && stamp - latest <= ONLINE_WINDOW_MS
      };
    }).filter(person => person.online)
      .sort((first, second) => Number(second.lastSeen || 0) - Number(first.lastSeen || 0));
  }

  function onlinePresenceCount(presenceMap) {
    const count = presenceRows(presenceMap).length;
    return count || (loggedInUsername() ? 1 : 0);
  }

  function updateInlineOnlineCounters(root, count) {
    if (!root || !Number.isFinite(count)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const tag = parent?.tagName || "";
      if (!["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(tag)) {
        const original = node.nodeValue || "";
        let next = original
          .replace(/\b\d+\s+active here\b/gi, `${count} active here`)
          .replace(/\b\d+\s+active overall\b/gi, `${count} active overall`);
        if (/^\s*(?:Loading online\.\.\.|\d+\s+online)\s*$/i.test(original)) next = `${count} online`;
        if (next !== original) node.nodeValue = next;
      }
      node = walker.nextNode();
    }
  }

  function compactFriendList(friendsMap, accountsMap = {}) {
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    const synced = uniquePeople(currentSnapshot?.friends?.users || []);
    if (synced.length) {
      return synced.slice(0, 5).map(item => ({
        id: item.id || key(item.username),
        username: accountsMap[key(item.id || item.username)]?.username || item.username || item.id || "Friend",
        mood: accountsMap[key(item.id || item.username)]?.mood || accountsMap[key(item.id || item.username)]?.status || item.mood || "Online",
        avatar: accountAvatar(accountsMap[key(item.id || item.username)] || {}) || item.avatar || ""
      }));
    }
    const ids = Array.from(new Set(Array.isArray(friendsMap?.[userId]) ? friendsMap[userId] : []));
    if (ids.length) {
      return ids.slice(0, 5).map(id => {
        const account = accountsMap?.[key(id)] || {};
        return {
          id,
          username: account.username || displayName(id),
          mood: account.mood || account.status || "Online",
          avatar: accountAvatar(account)
        };
      });
    }
    return overlayAccountRows(accountsMap)
      .filter(person => person.id !== userId)
      .slice(0, 5);
  }

  async function hydrateFromFirebase(username = loggedInUsername()) {
    const userId = key(username);
    if (!userId) return currentSnapshot;
    let account = await fetchJson(chatStateUrl(["accounts", userId])).catch(() => null);
    let source = "chatState";
    if (!account) {
      const cached = await fetchJson(firebaseUrl(["siteSync", "chatProfiles", userId])).catch(() => null);
      if (cached && cached.id) {
        applySnapshot({ ...cached, source: "siteSync", updatedAt: Date.now() }, { skipCloud: true });
        return currentSnapshot;
      }
      account = await fetchJson(firebaseUrl(["accounts", userId])).catch(() => null);
      source = "siteRoot";
    }
    if (!account) return currentSnapshot;
    const pathFor = source === "chatState" ? chatStateUrl : firebaseUrl;
    const relationships = await fetchJson(pathFor(["relationships"]), 1200).catch(() => ({})) || {};
    const accepted = [];
    const incoming = [];
    const outgoing = [];
    Object.values(relationships).forEach(record => {
      if (!record || !Array.isArray(record.users) || !record.users.includes(userId)) return;
      const otherId = relationOther(record, userId);
      if (!otherId) return;
      const target = record.status === "accepted" ? accepted : (record.status === "pending" && record.requestedBy === userId ? outgoing : (record.status === "pending" ? incoming : null));
      if (target) target.push(otherId);
    });

    const allIds = Array.from(new Set(accepted.concat(incoming, outgoing))).slice(0, 80);
    const accounts = {};
    await Promise.all(allIds.map(async id => {
      accounts[id] = await fetchJson(pathFor(["accounts", id])).catch(() => null);
    }));
    const streak = streakProfilePatch(account);
    const user = {
      id: userId,
      username: String(account.username || username),
      role: account.role === "owner" ? "owner" : (account.role === "mod" ? "admin" : "user"),
      status: account.role === "owner" ? "approved" : String(account.ugpStatus || account.ugp_status || "pending"),
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      streak: streak.streak,
      profile: normalizedSiteProfile({
        avatar: String(account.avatar || "").slice(0, 750000),
        hasCustomAvatar: /^data:image\//i.test(String(account.avatar || "")),
        presence: String(account.status || "online"),
        mood: String(account.mood || "Social"),
        theme: String(account.theme || "ember"),
        bio: String(account.bio || "").slice(0, 260),
        favoriteGame: String(account.favoriteGame || "").slice(0, 40),
        nameColor: String(account.nameColor || account.profileNameColor || "#ff9f1c"),
        textColor: String(account.profileTextColor || account.textColor || ""),
        font: String(account.profileFont || account.font || "inter"),
        textSize: String(account.profileTextSize || account.textSize || "normal"),
        banner: String(account.profileBanner || "solid"),
        bannerColor: String(account.profileBannerColor || "#2d3039"),
        bannerImage: String(account.profileBannerImage || "").slice(0, 750000),
        mediaUpdatedAt: Number(account.profileMediaUpdatedAt || 0),
        profileTheme: String(account.profileTheme || "taco"),
        profileEffect: String(account.profileEffect || "none"),
        badges: Array.isArray(account.badges) ? account.badges.slice(0, 24) : [],
        visibleBadges: Array.isArray(account.visibleBadges) ? account.visibleBadges.slice(0, 12) : [],
        ...streak,
        updatedAt: Number(account.updatedAt || account.createdAt || 0)
      }),
      friends: {
        count: accepted.length,
        users: accepted.map(id => compactAccount(accounts[id], id)).filter(Boolean),
        incoming: incoming.map(id => compactAccount(accounts[id], id)).filter(Boolean),
        outgoing: outgoing.map(id => compactAccount(accounts[id], id)).filter(Boolean)
      }
    };
    applySnapshot(makeSnapshot(user));
    return currentSnapshot;
  }

  const chatFrameLoginSyncAt = new WeakMap();
  const chatFrameProfileSyncKey = new WeakMap();

  function postLinkedChatLogin(target, payload = linkedChatLoginPayload()) {
    if (!target || typeof target.postMessage !== "function" || !payload) return false;
    const stamp = Date.now();
    const lastSentAt = Number(chatFrameLoginSyncAt.get(target) || 0);
    if (stamp - lastSentAt < 2000) return false;
    chatFrameLoginSyncAt.set(target, stamp);
    target.postMessage(payload, location.origin);
    return true;
  }

  function postProfileMedia(target, payload = profileMediaPayload(), force = false) {
    if (!target || typeof target.postMessage !== "function" || !payload) return false;
    const profile = payload.profile || {};
    const payloadKey = [
      key(payload.username),
      Number(profile.mediaUpdatedAt || 0),
      valueStamp(profile.avatar),
      String(profile.banner || ""),
      String(profile.bannerColor || ""),
      valueStamp(profile.bannerImage)
    ].join("|");
    if (!force && chatFrameProfileSyncKey.get(target) === payloadKey) return false;
    chatFrameProfileSyncKey.set(target, payloadKey);
    target.postMessage(payload, location.origin);
    return true;
  }

  function requestChatFrameSync() {
    const linkedLogin = linkedChatLoginPayload();
    const theme = siteThemePayload();
    const appearance = siteAppearancePayload();
    const profileMedia = profileMediaPayload();
    document.querySelectorAll('iframe[data-testid="chat-iframe"], iframe[data-lz-chat-overlay-frame="true"], iframe[src*="page-embed.html"]').forEach(frame => {
      try {
        frame.contentWindow && frame.contentWindow.postMessage(theme, location.origin);
        frame.contentWindow && frame.contentWindow.postMessage(appearance, location.origin);
        if (profileMedia && isChatFrameElement(frame)) postProfileMedia(frame.contentWindow, profileMedia);
        postLinkedChatLogin(frame.contentWindow, linkedLogin);
      } catch (error) {}
    });
  }

  function installChatOverlayStyles() {
    if (document.getElementById("lz-chat-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "lz-chat-overlay-style";
    style.textContent = `
      :root,
      html[data-lz-theme="ember"] {
        --lz-site-bg: #fbf7f2;
        --lz-site-surface: #ffffff;
        --lz-site-soft: #f8fafb;
        --lz-site-warm: #fff4eb;
        --lz-site-border: #e8e0d8;
        --lz-site-text: #191714;
        --lz-site-muted: #756e67;
        --lz-site-accent: #ff7628;
        --lz-site-accent-hover: #ed6418;
        --lz-site-accent-soft: #fff0e5;
        --lz-site-highlight: #ff7628;
        --lz-site-accent-readable: #b44000;
        --lz-site-on-accent: #191714;
        --lz-chat-orange: var(--lz-site-accent);
        --lz-chat-orange-hover: var(--lz-site-accent-hover);
        --lz-chat-bg: var(--lz-site-bg);
        --lz-chat-surface: var(--lz-site-surface);
        --lz-chat-border: var(--lz-site-border);
        --lz-chat-text: var(--lz-site-text);
        --lz-chat-muted: var(--lz-site-muted);
        --lz-chat-chrome-bg: rgba(255, 255, 255, 0.96);
        --lz-chat-chrome-action-bg: rgba(255, 255, 255, 0.92);
        --lz-chat-chrome-border: rgba(71, 54, 40, 0.2);
        --lz-chat-chrome-text: #191714;
        --lz-chat-chrome-muted: #5f554c;
        --lz-chat-shadow: 0 20px 70px rgba(71, 54, 40, 0.18);
        --lz-chat-control-top: 16px;
      }

      html[data-lz-theme="ocean"] {
        --lz-site-bg: #f5f9fc;
        --lz-site-surface: #ffffff;
        --lz-site-soft: #f2f8fd;
        --lz-site-warm: #eaf4ff;
        --lz-site-border: #dbe8f2;
        --lz-site-text: #17212a;
        --lz-site-muted: #65717b;
        --lz-site-accent: #2378c9;
        --lz-site-accent-hover: #1c65aa;
        --lz-site-accent-soft: #eaf4ff;
        --lz-site-highlight: #4aa8ff;
        --lz-site-accent-readable: #1c65aa;
        --lz-site-on-accent: #ffffff;
      }

      html[data-lz-theme="berry"] {
        --lz-site-bg: #fbf6f8;
        --lz-site-surface: #ffffff;
        --lz-site-soft: #fbf8fa;
        --lz-site-warm: #fff0f5;
        --lz-site-border: #eadde3;
        --lz-site-text: #21171b;
        --lz-site-muted: #74666c;
        --lz-site-accent: #d94d7a;
        --lz-site-accent-hover: #bd3f69;
        --lz-site-accent-soft: #fff0f5;
        --lz-site-highlight: #ff7aa8;
        --lz-site-accent-readable: #bd3f69;
        --lz-site-on-accent: #ffffff;
      }

      html[data-lz-theme="lime"] {
        --lz-site-bg: #f7faf2;
        --lz-site-surface: #ffffff;
        --lz-site-soft: #f6faf1;
        --lz-site-warm: #f0f8e5;
        --lz-site-border: #dde8d0;
        --lz-site-text: #171c13;
        --lz-site-muted: #66715d;
        --lz-site-accent: #4f7f13;
        --lz-site-accent-hover: #426a10;
        --lz-site-accent-soft: #f0f8e5;
        --lz-site-highlight: #78b92f;
        --lz-site-accent-readable: #4f7f13;
        --lz-site-on-accent: #ffffff;
      }

      html[data-lz-theme="purple"] {
        --lz-site-bg: #faf7fc;
        --lz-site-surface: #ffffff;
        --lz-site-soft: #faf7fd;
        --lz-site-warm: #f4ecfa;
        --lz-site-border: #e6d9ee;
        --lz-site-text: #1d1721;
        --lz-site-muted: #6f6477;
        --lz-site-accent: #6c427f;
        --lz-site-accent-hover: #59336b;
        --lz-site-accent-soft: #f4ecfa;
        --lz-site-highlight: #a979c8;
        --lz-site-accent-readable: #59336b;
        --lz-site-on-accent: #ffffff;
      }

      html[data-lz-color-mode="dark"] {
        --lz-site-bg: #11100f;
        --lz-site-surface: #181716;
        --lz-site-soft: #211f1d;
        --lz-site-warm: #251f19;
        --lz-site-border: #352f29;
        --lz-site-text: #f7f1eb;
        --lz-site-muted: #b4aba2;
        --lz-site-accent-soft: color-mix(in srgb, var(--lz-site-accent) 24%, #11100f);
        --lz-site-highlight: color-mix(in srgb, var(--lz-site-accent) 86%, #ffffff);
        --lz-site-accent-readable: #f7f1eb;
        --lz-site-on-accent: #191714;
        --lz-chat-shadow: 0 22px 80px rgba(0, 0, 0, 0.45);
        --lz-chat-chrome-bg: rgba(255, 255, 255, 0.96);
        --lz-chat-chrome-action-bg: rgba(255, 255, 255, 0.92);
        --lz-chat-chrome-border: rgba(25, 23, 20, 0.24);
        --lz-chat-chrome-text: #191714;
        --lz-chat-chrome-muted: #5f554c;
        color-scheme: dark;
      }

      html[data-lz-theme] body,
      html[data-lz-theme] #root {
        background: var(--lz-site-bg) !important;
        color: var(--lz-site-text) !important;
      }

      html[data-lz-theme] [data-testid="site-header"],
      html[data-lz-theme] header,
      html[data-lz-theme] footer {
        background: color-mix(in srgb, var(--lz-site-surface) 94%, transparent) !important;
        border-color: var(--lz-site-border) !important;
        color: var(--lz-site-text) !important;
      }

      html[data-lz-color-mode="dark"] [data-report-bug-link],
      html[data-lz-color-mode="dark"] [data-testid="nav-report-bug"],
      body[data-lz-color-mode="dark"] [data-report-bug-link],
      body[data-lz-color-mode="dark"] [data-testid="nav-report-bug"] {
        color: #f7f1eb !important;
      }

      html[data-lz-theme] [data-testid^="game-tile-"],
      html[data-lz-theme] [data-testid="empty-state"],
      html[data-lz-theme] [data-testid="loading-grid"] > div,
      html[data-lz-theme] [class*="bg-white"],
      html[data-lz-theme] input,
      html[data-lz-theme] select,
      html[data-lz-theme] textarea {
        background: var(--lz-site-surface) !important;
        border-color: var(--lz-site-border) !important;
        color: var(--lz-site-text) !important;
      }

      html[data-lz-theme] [class*="bg-[#fff7f0]"],
      html[data-lz-theme] [class*="bg-\\[\\#fff7f0\\]"] {
        background: var(--lz-site-bg) !important;
      }

      html[data-lz-theme] [class*="bg-[#ffe4d1]"],
      html[data-lz-theme] [class*="bg-\\[\\#ffe4d1\\]"],
      html[data-lz-theme] [class*="hover:bg-[#ffe4d1]"]:hover {
        background: var(--lz-site-accent-soft) !important;
      }

      html[data-lz-theme] [class*="border-[#efe3d6]"],
      html[data-lz-theme] [class*="border-\\[\\#efe3d6\\]"] {
        border-color: var(--lz-site-border) !important;
      }

      html[data-lz-theme] [class*="text-[#5c534d]"],
      html[data-lz-theme] [class*="text-\\[\\#5c534d\\]"] {
        color: var(--lz-site-muted) !important;
      }

      html[data-lz-theme] [class*="text-[#1a1613]"],
      html[data-lz-theme] [class*="text-\\[\\#1a1613\\]"] {
        color: var(--lz-site-text) !important;
      }

      html[data-lz-theme] [class*="text-[#ff6a00]"],
      html[data-lz-theme] [class*="text-[#e85d00]"],
      html[data-lz-theme] [class*="text-\\[\\#ff6a00\\]"],
      html[data-lz-theme] [class*="text-\\[\\#e85d00\\]"] {
        color: var(--lz-site-highlight, var(--lz-site-accent-readable, var(--lz-site-accent))) !important;
      }

      html[data-lz-theme] [class*="bg-[#ff6a00]"],
      html[data-lz-theme] [class*="bg-\\[\\#ff6a00\\]"],
      html[data-lz-theme] button[class*="bg-[#ff6a00]"] {
        background: var(--lz-site-accent) !important;
        color: var(--lz-site-on-accent, #fff) !important;
      }

      html[data-lz-theme] [class*="focus-visible:ring-[#ff6a00]"]:focus-visible,
      html[data-lz-theme] [class*="focus-visible:ring-\\[\\#ff6a00\\]"]:focus-visible {
        --tw-ring-color: var(--lz-site-accent) !important;
      }

      html[data-lz-color-mode="dark"] [data-testid^="game-tile-"],
      html[data-lz-color-mode="dark"] [data-testid="empty-state"],
      html[data-lz-color-mode="dark"] [data-testid="loading-grid"] > div,
      html[data-lz-color-mode="dark"] [class*="bg-white"],
      html[data-lz-color-mode="dark"] input,
      html[data-lz-color-mode="dark"] select,
      html[data-lz-color-mode="dark"] textarea {
        background: var(--lz-site-soft) !important;
        box-shadow: none !important;
      }

      .lz-theme-control {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        border: 1px solid var(--lz-site-border);
        border-radius: 999px;
        background: var(--lz-site-surface);
        color: var(--lz-site-muted);
        padding: 0 8px 0 10px;
        box-shadow: 0 8px 20px rgba(71, 54, 40, 0.05);
        font: 850 12px/1 Inter, Arial, sans-serif;
      }

      .lz-theme-control select {
        height: 28px;
        min-width: 74px;
        border: 0;
        outline: 0;
        background: transparent !important;
        color: var(--lz-site-text) !important;
        font: inherit;
        cursor: pointer;
      }

      .lz-theme-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--lz-site-accent);
        box-shadow: 0 0 0 3px var(--lz-site-accent-soft);
      }

      .lz-brand-logo-custom {
        overflow: hidden;
        background: var(--lz-site-surface) !important;
        color: var(--lz-site-accent-readable, var(--lz-site-accent)) !important;
      }

      .lz-brand-logo-custom img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }

      .lz-site-settings-nav {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        border: 1px solid var(--lz-site-border);
        border-radius: 999px;
        background: var(--lz-site-surface);
        color: var(--lz-site-text);
        padding: 0 12px;
        box-shadow: 0 8px 20px rgba(71, 54, 40, 0.05);
        font: 850 12px/1 Inter, Arial, sans-serif;
        text-decoration: none;
        white-space: nowrap;
      }

      .lz-site-settings-nav svg {
        width: 14px;
        height: 14px;
        color: var(--lz-site-accent-readable, var(--lz-site-accent));
      }

      .lz-site-settings-nav:hover,
      .lz-site-settings-nav:focus-visible {
        border-color: var(--lz-site-accent-readable, var(--lz-site-accent));
        color: var(--lz-site-accent-readable, var(--lz-site-accent));
        outline: 0;
      }

      html[data-lz-settings-route="true"] body {
        background: #090704 !important;
      }

      html[data-lz-settings-route="true"] #root {
        display: none !important;
      }

      #lz-site-settings-page {
        position: relative;
        min-height: 100dvh;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 0%, rgba(184, 125, 35, 0.16), transparent 32%),
          linear-gradient(90deg, rgba(171, 111, 28, 0.08), transparent 18%, transparent 82%, rgba(171, 111, 28, 0.08)),
          #090704;
        color: #f4ead5;
        font-family: "SFMono-Regular", Consolas, "Roboto Mono", monospace;
        letter-spacing: 0;
      }

      #lz-site-settings-page *,
      #lz-site-settings-page *::before,
      #lz-site-settings-page *::after {
        box-sizing: border-box;
      }

      .lz-settings-rain {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        opacity: 0.8;
      }

      .lz-settings-rain span {
        position: absolute;
        top: -16vh;
        color: rgba(211, 149, 45, 0.46);
        font: 700 14px/1.45 "SFMono-Regular", Consolas, monospace;
        writing-mode: vertical-rl;
        text-orientation: upright;
        text-shadow: 0 0 12px rgba(211, 149, 45, 0.28);
        animation: lzSettingsRain 17s linear infinite;
      }

      @keyframes lzSettingsRain {
        from { transform: translateY(-14vh); }
        to { transform: translateY(124vh); }
      }

      .lz-settings-shell {
        position: relative;
        z-index: 1;
        width: min(960px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 50px 0 72px;
      }

      .lz-settings-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 22px;
        border-bottom: 1px solid rgba(191, 132, 40, 0.28);
        background: transparent !important;
        color: inherit !important;
      }

      #lz-site-settings-page .lz-settings-top {
        background: transparent !important;
        border-color: rgba(191, 132, 40, 0.28) !important;
        box-shadow: none !important;
      }

      .lz-settings-title {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: #d99a35;
        font-size: 21px;
        font-weight: 800;
      }

      .lz-settings-title svg,
      .lz-settings-card-title svg,
      .lz-settings-button svg,
      .lz-settings-upload-icon svg {
        width: 18px;
        height: 18px;
      }

      .lz-settings-back {
        color: #d99a35;
        border: 1px solid rgba(191, 132, 40, 0.38);
        border-radius: 999px;
        background: rgba(15, 10, 4, 0.74);
        padding: 9px 14px;
        text-decoration: none;
        font: 800 12px/1 Inter, Arial, sans-serif;
      }

      .lz-settings-top-actions {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        margin-left: auto;
        flex-wrap: wrap;
      }

      .lz-settings-back:hover,
      .lz-settings-back:focus-visible {
        outline: 0;
        background: rgba(191, 132, 40, 0.18);
      }

      .lz-settings-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 26px;
      }

      .lz-settings-card {
        position: relative;
        border: 1px solid rgba(191, 132, 40, 0.36);
        border-radius: 14px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
          rgba(18, 13, 8, 0.84);
        box-shadow: 0 22px 56px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255, 199, 87, 0.03);
        padding: 16px;
        min-width: 0;
      }

      .lz-settings-card.is-wide {
        grid-column: 1 / -1;
      }

      .lz-settings-card.is-tall {
        min-height: 244px;
      }

      .lz-settings-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        color: #fff7e9;
        font: 850 15px/1.3 Inter, Arial, sans-serif;
      }

      .lz-settings-card-title svg {
        color: #d99a35;
        flex: 0 0 auto;
      }

      .lz-settings-copy {
        margin: 14px 0 0;
        color: #c9bcaa;
        font: 650 13px/1.65 "SFMono-Regular", Consolas, monospace;
      }

      .lz-settings-row,
      .lz-settings-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 16px;
      }

      .lz-settings-swatch {
        width: 60px;
        height: 60px;
        border: 1px solid rgba(255, 211, 120, 0.22);
        border-radius: 7px;
        background: var(--lz-swatch, #bf8428);
        color: transparent;
        cursor: pointer;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      }

      .lz-settings-swatch.active {
        outline: 2px solid #f2b64c;
        outline-offset: 2px;
        box-shadow: 0 0 24px rgba(217, 154, 53, 0.32), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
      }

      .lz-settings-custom {
        display: inline-grid;
        place-items: center;
        width: 60px;
        height: 60px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 7px;
        background: #7a7a7a;
        color: #fff;
        cursor: pointer;
      }

      .lz-settings-custom.active {
        outline: 2px solid #f2b64c;
        outline-offset: 2px;
      }

      .lz-settings-segment {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }

      .lz-settings-card:not(.is-wide) .lz-settings-segment {
        grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      }

      .lz-settings-segment button,
      .lz-settings-button,
      .lz-settings-toggle {
        border: 1px solid rgba(191, 132, 40, 0.68);
        border-radius: 11px;
        background: rgba(5, 4, 3, 0.78);
        color: #ccbda7;
        min-height: 40px;
        padding: 0 13px;
        cursor: pointer;
        font: 850 13px/1 Inter, Arial, sans-serif;
      }

      .lz-settings-segment button.active,
      .lz-settings-button.primary,
      .lz-settings-toggle[aria-pressed="true"] {
        color: #f2b64c;
        background: rgba(191, 132, 40, 0.16);
        box-shadow: inset 0 0 0 1px rgba(217, 154, 53, 0.14);
      }

      .lz-settings-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-decoration: none;
      }

      .lz-settings-button.danger {
        border-color: rgba(255, 128, 128, 0.62);
        color: #ffd1d1;
        background: rgba(80, 14, 14, 0.34);
      }

      .lz-settings-field {
        display: grid;
        gap: 8px;
        margin-top: 16px;
      }

      .lz-settings-field span {
        color: #f6ecdc;
        font: 850 12px/1 Inter, Arial, sans-serif;
      }

      .lz-settings-field input,
      .lz-settings-field select {
        width: 100%;
        min-height: 40px;
        border: 1px solid rgba(191, 132, 40, 0.68);
        border-radius: 7px;
        background: rgba(5, 4, 3, 0.8) !important;
        color: #fff6e6 !important;
        padding: 0 12px;
        font: 800 13px/1 "SFMono-Regular", Consolas, monospace;
      }

      #lz-site-settings-page .lz-settings-field input,
      #lz-site-settings-page .lz-settings-field select {
        background: rgba(5, 4, 3, 0.82) !important;
        border-color: rgba(191, 132, 40, 0.68) !important;
        color: #fff6e6 !important;
        box-shadow: none !important;
      }

      .lz-settings-color-input {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .lz-settings-toggle-wrap {
        display: flex;
        align-items: end;
        min-height: 88px;
      }

      .lz-settings-toggle {
        position: relative;
        width: 64px;
        min-height: 32px;
        padding: 0;
        border-radius: 999px;
      }

      .lz-settings-toggle::after {
        content: "";
        position: absolute;
        width: 24px;
        height: 24px;
        left: 4px;
        top: 3px;
        border-radius: 999px;
        background: #d99a35;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
        transition: transform 190ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .lz-settings-toggle[aria-pressed="true"]::after {
        transform: translateX(30px);
      }

      .lz-settings-logo-row {
        display: grid;
        grid-template-columns: 60px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        margin-top: 16px;
      }

      .lz-settings-logo-preview,
      .lz-settings-upload-icon {
        width: 60px;
        height: 60px;
        border: 2px solid #d99a35;
        border-radius: 7px;
        display: grid;
        place-items: center;
        overflow: hidden;
        color: #d9d1c6;
        background: rgba(0, 0, 0, 0.42);
      }

      .lz-settings-logo-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .lz-settings-status {
        min-height: 18px;
        margin-top: 10px;
        color: #d99a35;
        font: 800 12px/1.45 Inter, Arial, sans-serif;
      }

      .lz-settings-account-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(191, 132, 40, 0.18);
        color: #c9bcaa;
        font: 750 12px/1.4 Inter, Arial, sans-serif;
      }

      .lz-settings-account-line strong {
        color: #fff7e9;
      }

      #lz-site-settings-page {
        --lz-settings-accent: #d99a35;
        --lz-settings-accent-strong: #f2b64c;
        --lz-settings-panel: rgba(17, 12, 7, 0.9);
        --lz-settings-panel-2: rgba(24, 17, 10, 0.88);
        --lz-settings-line: rgba(217, 154, 53, 0.28);
        --lz-settings-line-strong: rgba(242, 182, 76, 0.48);
        --lz-settings-text: #fff7e9;
        --lz-settings-muted: #c9bcaa;
        --lz-settings-radius: 14px;
        --lz-settings-control: 42px;
        --lz-settings-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-settings-shell {
        width: min(1180px, calc(100vw - 36px));
        padding: 38px 0 78px;
      }

      .lz-settings-top {
        position: sticky;
        top: 0;
        z-index: 8;
        min-height: 74px;
        padding: 14px 0 18px;
        background: linear-gradient(180deg, rgba(9, 7, 4, 0.98), rgba(9, 7, 4, 0.76) 82%, transparent) !important;
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
      }

      #lz-site-settings-page .lz-settings-top {
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.14) !important;
      }

      .lz-settings-title {
        display: grid;
        grid-template-columns: 28px minmax(0, auto);
        align-items: center;
        column-gap: 11px;
        row-gap: 3px;
        color: var(--lz-settings-accent-strong);
        font-family: Inter, Arial, sans-serif;
        letter-spacing: 0;
      }

      .lz-settings-title svg {
        grid-row: 1 / 3;
        width: 24px;
        height: 24px;
        filter: drop-shadow(0 0 12px rgba(217, 154, 53, 0.24));
      }

      .lz-settings-title span {
        color: var(--lz-settings-accent-strong);
        font: 950 22px/1.05 Inter, Arial, sans-serif;
      }

      .lz-settings-title small {
        grid-column: 2;
        color: var(--lz-settings-muted);
        font: 750 12px/1.25 Inter, Arial, sans-serif;
      }

      .lz-settings-back,
      .lz-settings-top-actions .lz-chat-open-button {
        min-height: 36px !important;
        border-radius: 999px !important;
        transition: transform 170ms var(--lz-settings-ease), border-color 170ms var(--lz-settings-ease), background 170ms var(--lz-settings-ease), color 170ms var(--lz-settings-ease), box-shadow 170ms var(--lz-settings-ease);
      }

      .lz-settings-back:hover,
      .lz-settings-back:focus-visible,
      .lz-settings-top-actions .lz-chat-open-button:hover,
      .lz-settings-top-actions .lz-chat-open-button:focus-visible {
        transform: translate3d(0, -1px, 0);
        box-shadow: 0 10px 24px rgba(217, 154, 53, 0.14);
      }

      .lz-settings-layout {
        display: grid;
        grid-template-columns: minmax(220px, 282px) minmax(0, 1fr);
        gap: 16px;
        align-items: start;
        margin-top: 22px;
      }

      .lz-settings-sidebar {
        position: sticky;
        top: 92px;
        display: grid;
        gap: 12px;
        min-width: 0;
      }

      .lz-settings-preview-card,
      .lz-settings-sidebar-nav,
      .lz-settings-section {
        border: 1px solid var(--lz-settings-line);
        border-radius: var(--lz-settings-radius);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
          var(--lz-settings-panel);
        box-shadow: 0 18px 54px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }

      .lz-settings-preview-card {
        overflow: hidden;
        padding: 14px;
        animation: lzSettingsPanelIn 210ms var(--lz-settings-ease) both;
      }

      .lz-settings-preview-kicker {
        color: var(--lz-settings-accent-strong);
        font: 950 11px/1 Inter, Arial, sans-serif;
        text-transform: uppercase;
      }

      .lz-settings-preview-window {
        margin-top: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        background:
          radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--lz-preview-accent, #bf8428) 24%, transparent), transparent 45%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(0, 0, 0, 0.12)),
          #13100d;
      }

      .lz-settings-preview-bar {
        display: flex;
        gap: 5px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.035);
      }

      .lz-settings-preview-bar span {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.26);
      }

      .lz-settings-preview-bar span:first-child {
        background: var(--lz-preview-accent, #bf8428);
      }

      .lz-settings-preview-main {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        padding: 14px;
      }

      .lz-settings-preview-main strong,
      .lz-settings-preview-main small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-settings-preview-main strong {
        color: var(--lz-settings-text);
        font: 950 14px/1.1 Inter, Arial, sans-serif;
      }

      .lz-settings-preview-main small {
        margin-top: 4px;
        color: var(--lz-settings-muted);
        font: 750 11px/1.15 Inter, Arial, sans-serif;
      }

      .lz-settings-preview-logo {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: var(--lz-preview-accent, #bf8428);
        color: #fff;
        box-shadow: 0 10px 20px color-mix(in srgb, var(--lz-preview-accent, #bf8428) 18%, transparent);
      }

      .lz-settings-preview-logo img,
      .lz-settings-preview-logo svg {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .lz-settings-preview-tabs {
        display: grid;
        grid-template-columns: 1fr 0.72fr 0.48fr;
        gap: 7px;
        padding: 0 14px 14px;
      }

      .lz-settings-preview-tabs span {
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
      }

      .lz-settings-preview-tabs span:first-child {
        background: color-mix(in srgb, var(--lz-preview-accent, #bf8428) 52%, rgba(255, 255, 255, 0.1));
      }

      .lz-settings-preview-tab {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        gap: 9px;
        align-items: center;
        margin-top: 12px;
        padding: 9px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 11px;
        background: rgba(0, 0, 0, 0.24);
      }

      .lz-settings-preview-tab span {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        overflow: hidden;
        color: var(--lz-settings-accent-strong);
        background: rgba(255, 255, 255, 0.07);
      }

      .lz-settings-preview-tab img,
      .lz-settings-preview-tab svg {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .lz-settings-preview-tab strong {
        min-width: 0;
        overflow: hidden;
        color: var(--lz-settings-text);
        font: 900 12px/1.15 Inter, Arial, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-settings-preview-list {
        display: grid;
        gap: 8px;
        margin: 13px 0 0;
      }

      .lz-settings-preview-list div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 0;
        border-top: 1px solid rgba(217, 154, 53, 0.12);
      }

      .lz-settings-preview-list dt,
      .lz-settings-preview-list dd {
        margin: 0;
      }

      .lz-settings-preview-list dt {
        color: var(--lz-settings-muted);
        font: 800 11px/1 Inter, Arial, sans-serif;
      }

      .lz-settings-preview-list dd {
        color: var(--lz-settings-text);
        font: 900 11px/1.2 Inter, Arial, sans-serif;
        text-align: right;
      }

      .lz-settings-sidebar-nav {
        display: grid;
        padding: 7px;
      }

      .lz-settings-sidebar-nav a {
        min-height: 34px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        color: var(--lz-settings-muted);
        font: 900 12px/1 Inter, Arial, sans-serif;
        text-decoration: none;
        transition: background 170ms var(--lz-settings-ease), color 170ms var(--lz-settings-ease), transform 170ms var(--lz-settings-ease);
      }

      .lz-settings-sidebar-nav a:hover,
      .lz-settings-sidebar-nav a:focus-visible {
        outline: 0;
        color: var(--lz-settings-accent-strong);
        background: rgba(217, 154, 53, 0.12);
        transform: translate3d(2px, 0, 0);
      }

      .lz-settings-content {
        display: grid;
        gap: 16px;
        min-width: 0;
      }

      .lz-settings-section {
        padding: 14px;
        animation: lzSettingsPanelIn 220ms var(--lz-settings-ease) both;
      }

      .lz-settings-section:nth-child(2) {
        animation-delay: 35ms;
      }

      .lz-settings-section:nth-child(3) {
        animation-delay: 70ms;
      }

      .lz-settings-section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        padding: 2px 2px 14px;
        border-bottom: 1px solid rgba(217, 154, 53, 0.18);
      }

      .lz-settings-section-head div {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
        color: var(--lz-settings-text);
        font: 950 16px/1.15 Inter, Arial, sans-serif;
      }

      .lz-settings-section-head svg {
        width: 18px;
        height: 18px;
        color: var(--lz-settings-accent-strong);
      }

      .lz-settings-section-head p {
        max-width: 420px;
        margin: 0;
        color: var(--lz-settings-muted);
        font: 750 12px/1.35 Inter, Arial, sans-serif;
        text-align: right;
      }

      .lz-settings-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 14px;
      }

      .lz-settings-card {
        display: flex;
        flex-direction: column;
        min-height: 196px;
        border-radius: var(--lz-settings-radius);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012)),
          var(--lz-settings-panel-2);
        transition: transform 180ms var(--lz-settings-ease), border-color 180ms var(--lz-settings-ease), box-shadow 180ms var(--lz-settings-ease), background 180ms var(--lz-settings-ease);
      }

      .lz-settings-card:hover,
      .lz-settings-card:focus-within {
        border-color: var(--lz-settings-line-strong);
        box-shadow: 0 22px 54px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(242, 182, 76, 0.04) inset, 0 0 28px rgba(217, 154, 53, 0.08);
        transform: translate3d(0, -1px, 0);
      }

      .lz-settings-card.is-wide {
        grid-column: 1 / -1;
      }

      .lz-settings-card.is-tall {
        min-height: 196px;
      }

      .lz-settings-card-title {
        justify-content: flex-start;
        gap: 10px;
        font: 950 14px/1.25 Inter, Arial, sans-serif;
      }

      .lz-settings-card-title > svg {
        margin-right: 0;
      }

      .lz-settings-state-pill {
        min-height: 24px;
        border: 1px solid rgba(217, 154, 53, 0.22);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        margin-left: auto;
        padding: 0 9px;
        color: var(--lz-settings-accent-strong);
        background: rgba(217, 154, 53, 0.08);
        font: 900 10px/1 Inter, Arial, sans-serif;
      }

      .lz-settings-copy {
        margin-top: 10px;
        color: var(--lz-settings-muted);
        font: 700 12px/1.5 Inter, Arial, sans-serif;
      }

      .lz-settings-row,
      .lz-settings-actions {
        gap: 9px;
        margin-top: auto;
        padding-top: 15px;
      }

      .lz-settings-actions {
        align-items: stretch;
      }

      .lz-settings-swatch-row {
        align-items: stretch;
      }

      .lz-settings-swatch,
      .lz-settings-custom,
      .lz-settings-color-picker {
        width: auto;
        min-width: 82px;
        height: 66px;
        border-radius: 12px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 6px;
        color: var(--lz-settings-muted);
        background: rgba(5, 4, 3, 0.64);
        transition: transform 170ms var(--lz-settings-ease), border-color 170ms var(--lz-settings-ease), box-shadow 170ms var(--lz-settings-ease), background 170ms var(--lz-settings-ease), color 170ms var(--lz-settings-ease);
      }

      .lz-settings-swatch span,
      .lz-settings-color-picker input {
        width: 42px;
        height: 30px;
        border: 0;
        border-radius: 8px;
        display: block;
        background: var(--lz-swatch, #bf8428);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      }

      .lz-settings-swatch em,
      .lz-settings-custom span,
      .lz-settings-color-picker span {
        color: inherit;
        font: 900 10px/1 Inter, Arial, sans-serif;
        font-style: normal;
      }

      .lz-settings-swatch:hover,
      .lz-settings-swatch:focus-visible,
      .lz-settings-custom:hover,
      .lz-settings-custom:focus-visible,
      .lz-settings-color-picker:hover,
      .lz-settings-color-picker:focus-within {
        outline: 0;
        border-color: var(--lz-settings-line-strong);
        color: var(--lz-settings-text);
        transform: translate3d(0, -1px, 0);
      }

      .lz-settings-swatch.active,
      .lz-settings-custom.active,
      .lz-settings-color-picker.active {
        border-color: var(--lz-settings-accent-strong);
        outline: 0;
        color: var(--lz-settings-accent-strong);
        background: rgba(217, 154, 53, 0.12);
        box-shadow: 0 0 0 2px rgba(242, 182, 76, 0.12), 0 13px 30px rgba(217, 154, 53, 0.14);
      }

      .lz-settings-custom svg {
        width: 22px;
        height: 22px;
      }

      .lz-settings-color-picker {
        cursor: pointer;
      }

      .lz-settings-color-input {
        position: static;
        inline-size: 42px;
        block-size: 30px;
        opacity: 1;
        padding: 0;
        border: 0;
        cursor: pointer;
        pointer-events: auto;
        -webkit-appearance: none;
        appearance: none;
      }

      .lz-settings-color-input::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .lz-settings-color-input::-webkit-color-swatch,
      .lz-settings-color-input::-moz-color-swatch {
        border: 0;
        border-radius: 8px;
      }

      .lz-settings-segment {
        gap: 8px;
        margin-top: auto;
        padding-top: 15px;
      }

      .lz-settings-segment button,
      .lz-settings-button,
      .lz-settings-toggle {
        min-height: var(--lz-settings-control);
        border-color: rgba(217, 154, 53, 0.42);
        border-radius: 11px;
        background: rgba(5, 4, 3, 0.66);
        color: var(--lz-settings-muted);
        transition: transform 170ms var(--lz-settings-ease), border-color 170ms var(--lz-settings-ease), background 170ms var(--lz-settings-ease), color 170ms var(--lz-settings-ease), box-shadow 170ms var(--lz-settings-ease);
      }

      .lz-settings-segment button:hover,
      .lz-settings-segment button:focus-visible,
      .lz-settings-button:hover,
      .lz-settings-button:focus-visible,
      .lz-settings-toggle:hover,
      .lz-settings-toggle:focus-visible {
        outline: 0;
        border-color: var(--lz-settings-line-strong);
        color: var(--lz-settings-text);
        transform: translate3d(0, -1px, 0);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
      }

      .lz-settings-segment button.active,
      .lz-settings-button.primary,
      .lz-settings-toggle[aria-pressed="true"] {
        border-color: var(--lz-settings-accent-strong);
        color: #1b1208;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
          var(--lz-settings-accent-strong);
        box-shadow: 0 12px 28px rgba(217, 154, 53, 0.18);
      }

      .lz-settings-button {
        min-width: 124px;
        flex: 1 1 128px;
      }

      .lz-settings-button.danger {
        border-color: rgba(255, 128, 128, 0.5);
        color: #ffd1d1;
        background: rgba(80, 14, 14, 0.32);
        box-shadow: none;
      }

      .lz-settings-field {
        margin-top: 15px;
      }

      .lz-settings-field span {
        color: var(--lz-settings-muted);
        font: 900 11px/1 Inter, Arial, sans-serif;
        text-transform: uppercase;
      }

      .lz-settings-field input,
      .lz-settings-field select,
      #lz-site-settings-page .lz-settings-field input,
      #lz-site-settings-page .lz-settings-field select {
        min-height: var(--lz-settings-control);
        border-radius: 11px;
        padding: 0 13px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
          rgba(5, 4, 3, 0.74) !important;
        border-color: rgba(217, 154, 53, 0.42) !important;
        color: var(--lz-settings-text) !important;
        font: 850 13px/1 Inter, Arial, sans-serif;
        transition: border-color 170ms var(--lz-settings-ease), box-shadow 170ms var(--lz-settings-ease), background 170ms var(--lz-settings-ease);
      }

      .lz-settings-field select {
        padding-right: 38px;
        -webkit-appearance: none;
        appearance: none;
        background-image:
          linear-gradient(45deg, transparent 50%, var(--lz-settings-accent-strong) 50%),
          linear-gradient(135deg, var(--lz-settings-accent-strong) 50%, transparent 50%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
        background-position:
          calc(100% - 19px) 52%,
          calc(100% - 13px) 52%,
          0 0;
        background-size:
          6px 6px,
          6px 6px,
          100% 100%;
        background-repeat: no-repeat;
      }

      .lz-settings-field input:focus,
      .lz-settings-field select:focus {
        outline: 0;
        border-color: var(--lz-settings-accent-strong) !important;
        box-shadow: 0 0 0 3px rgba(217, 154, 53, 0.16) !important;
      }

      .lz-settings-toggle-wrap {
        min-height: 0;
        margin-top: auto;
        padding-top: 18px;
      }

      .lz-settings-toggle {
        width: 86px;
        min-height: 38px;
        padding: 0 12px 0 42px;
        justify-content: flex-end;
        overflow: hidden;
      }

      .lz-settings-toggle strong {
        position: relative;
        z-index: 1;
        color: currentColor;
        font: 950 11px/1 Inter, Arial, sans-serif;
      }

      .lz-settings-toggle::before {
        content: "";
        position: absolute;
        inset: 3px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
      }

      .lz-settings-toggle::after {
        width: 30px;
        height: 30px;
        left: 4px;
        top: 3px;
        background: #f2b64c;
        transition: transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 190ms cubic-bezier(0.2, 0.8, 0.2, 1), background 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-settings-toggle[aria-pressed="true"] {
        padding-left: 12px;
        padding-right: 42px;
      }

      .lz-settings-toggle[aria-pressed="true"]::after {
        transform: translate3d(48px, 0, 0);
        background: #fff6e6;
        box-shadow: 0 0 18px rgba(255, 246, 230, 0.28);
      }

      .lz-settings-logo-row {
        grid-template-columns: 74px minmax(0, 1fr);
      }

      .lz-settings-logo-preview,
      .lz-settings-upload-icon {
        width: 74px;
        height: 74px;
        border-width: 1px;
        border-radius: 14px;
        background:
          radial-gradient(circle at 30% 0%, rgba(217, 154, 53, 0.22), transparent 50%),
          rgba(0, 0, 0, 0.42);
      }

      .lz-settings-account-line {
        min-height: 42px;
        border-bottom-color: rgba(217, 154, 53, 0.14);
      }

      .lz-settings-account-line span {
        color: var(--lz-settings-muted);
      }

      .lz-settings-account-line strong {
        min-width: 0;
        overflow: hidden;
        color: var(--lz-settings-text);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-settings-status {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 100090;
        min-height: 0;
        max-width: min(360px, calc(100vw - 36px));
        margin: 0;
        padding: 10px 13px;
        border: 1px solid rgba(217, 154, 53, 0.32);
        border-radius: 999px;
        background: rgba(17, 12, 7, 0.94);
        color: var(--lz-settings-accent-strong);
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28);
        opacity: 0;
        pointer-events: none;
        transform: translate3d(0, 8px, 0);
        transition: opacity 170ms var(--lz-settings-ease), transform 170ms var(--lz-settings-ease);
      }

      .lz-settings-status.is-visible {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      @keyframes lzSettingsPanelIn {
        from {
          opacity: 0;
          transform: translate3d(0, 10px, 0) scale(0.99);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }

      @supports not (color: color-mix(in srgb, #000 50%, #fff)) {
        .lz-settings-preview-window {
          background: #13100d;
        }

        .lz-settings-preview-logo {
          box-shadow: 0 10px 20px rgba(217, 154, 53, 0.18);
        }
      }

      @media (max-width: 980px) {
        .lz-settings-layout {
          grid-template-columns: 1fr;
        }

        .lz-settings-sidebar {
          position: relative;
          top: 0;
        }

        .lz-settings-sidebar-nav {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        .lz-settings-shell {
          width: min(100% - 20px, 720px);
          padding-top: 22px;
        }

        .lz-settings-grid {
          grid-template-columns: 1fr;
        }

        .lz-settings-section-head {
          align-items: flex-start;
          flex-direction: column;
          gap: 7px;
        }

        .lz-settings-section-head p {
          max-width: none;
          text-align: left;
        }

        .lz-settings-swatch,
        .lz-settings-custom,
        .lz-settings-color-picker {
          flex: 1 1 92px;
          min-width: 92px;
        }
      }

      @media (max-width: 520px) {
        .lz-settings-top {
          position: relative;
          min-height: 0;
        }

        .lz-settings-title {
          grid-template-columns: 24px minmax(0, 1fr);
        }

        .lz-settings-title span {
          font-size: 20px;
        }

        .lz-settings-sidebar-nav {
          grid-template-columns: 1fr;
        }

        .lz-settings-section,
        .lz-settings-card,
        .lz-settings-preview-card {
          padding: 12px;
        }

        .lz-settings-segment {
          grid-template-columns: 1fr;
        }

        .lz-settings-button {
          flex-basis: 100%;
        }

        .lz-settings-status {
          left: 10px;
          right: 10px;
          bottom: 10px;
          border-radius: 12px;
          text-align: center;
        }
      }

      html[data-lz-settings-route="true"] body {
        background: var(--lz-settings-bg, #090704) !important;
      }

      #lz-site-settings-page {
        background:
          radial-gradient(circle at 50% 0%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.16), transparent 32%),
          linear-gradient(90deg, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.08), transparent 18%, transparent 82%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.08)),
          var(--lz-settings-bg, #090704) !important;
        color: var(--lz-settings-text, #fff7e9);
      }

      #lz-site-settings-page .lz-settings-top {
        background: linear-gradient(180deg, rgba(var(--lz-settings-bg-rgb, 9, 7, 4), 0.98), rgba(var(--lz-settings-bg-rgb, 9, 7, 4), 0.76) 82%, transparent) !important;
        border-color: var(--lz-settings-line) !important;
      }

      #lz-site-settings-page .lz-settings-title,
      #lz-site-settings-page .lz-settings-title span,
      #lz-site-settings-page .lz-settings-card-title svg,
      #lz-site-settings-page .lz-settings-section-head svg,
      #lz-site-settings-page .lz-settings-preview-kicker,
      #lz-site-settings-page .lz-settings-status,
      #lz-site-settings-page .lz-settings-back,
      #lz-site-settings-page .lz-settings-preview-tab span {
        color: var(--lz-settings-accent-strong) !important;
      }

      #lz-site-settings-page .lz-settings-back,
      #lz-site-settings-page .lz-settings-card,
      #lz-site-settings-page .lz-settings-preview-card,
      #lz-site-settings-page .lz-settings-sidebar-nav,
      #lz-site-settings-page .lz-settings-section,
      #lz-site-settings-page .lz-settings-segment button,
      #lz-site-settings-page .lz-settings-button,
      #lz-site-settings-page .lz-settings-toggle,
      #lz-site-settings-page .lz-settings-field input,
      #lz-site-settings-page .lz-settings-field select {
        border-color: var(--lz-settings-line) !important;
      }

      #lz-site-settings-page .lz-settings-preview-card,
      #lz-site-settings-page .lz-settings-sidebar-nav,
      #lz-site-settings-page .lz-settings-section {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
          var(--lz-settings-panel) !important;
      }

      #lz-site-settings-page .lz-settings-card {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012)),
          var(--lz-settings-panel-2) !important;
      }

      #lz-site-settings-page .lz-settings-copy,
      #lz-site-settings-page .lz-settings-title small,
      #lz-site-settings-page .lz-settings-sidebar-nav a,
      #lz-site-settings-page .lz-settings-preview-list dt,
      #lz-site-settings-page .lz-settings-preview-main small,
      #lz-site-settings-page .lz-settings-account-line span,
      #lz-site-settings-page .lz-settings-swatch,
      #lz-site-settings-page .lz-settings-custom,
      #lz-site-settings-page .lz-settings-color-picker,
      #lz-site-settings-page .lz-settings-segment button,
      #lz-site-settings-page .lz-settings-button,
      #lz-site-settings-page .lz-settings-toggle {
        color: var(--lz-settings-muted) !important;
      }

      #lz-site-settings-page .lz-settings-card-title,
      #lz-site-settings-page .lz-settings-section-head div,
      #lz-site-settings-page .lz-settings-field input,
      #lz-site-settings-page .lz-settings-field select,
      #lz-site-settings-page .lz-settings-preview-list dd,
      #lz-site-settings-page .lz-settings-preview-main strong,
      #lz-site-settings-page .lz-settings-preview-tab strong,
      #lz-site-settings-page .lz-settings-account-line strong {
        color: var(--lz-settings-text) !important;
      }

      #lz-site-settings-page .lz-settings-state-pill,
      #lz-site-settings-page .lz-settings-sidebar-nav a:hover,
      #lz-site-settings-page .lz-settings-sidebar-nav a:focus-visible,
      #lz-site-settings-page .lz-settings-swatch.active,
      #lz-site-settings-page .lz-settings-custom.active,
      #lz-site-settings-page .lz-settings-color-picker.active {
        background: rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.12) !important;
        border-color: var(--lz-settings-line-strong) !important;
        color: var(--lz-settings-accent-strong) !important;
      }

      #lz-site-settings-page .lz-settings-segment button.active,
      #lz-site-settings-page .lz-settings-button.primary,
      #lz-site-settings-page .lz-settings-toggle[aria-pressed="true"] {
        border-color: var(--lz-settings-accent-strong) !important;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
          var(--lz-settings-accent-strong) !important;
        color: #11100f !important;
        box-shadow: 0 12px 28px rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.18);
      }

      #lz-site-settings-page .lz-settings-field input:focus,
      #lz-site-settings-page .lz-settings-field select:focus {
        border-color: var(--lz-settings-accent-strong) !important;
        box-shadow: 0 0 0 3px rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.16) !important;
      }

      #lz-site-settings-page .lz-settings-rain.is-matrix span {
        color: rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.46);
        text-shadow: 0 0 12px rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.28);
      }

      #lz-site-settings-page .lz-settings-rain.is-topography {
        background:
          repeating-radial-gradient(circle at 18% 22%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.18) 0 1px, transparent 1px 28px),
          repeating-radial-gradient(circle at 78% 62%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.12) 0 1px, transparent 1px 34px);
        opacity: 0.78;
      }

      #lz-site-settings-page .lz-settings-rain.is-constellation::before,
      #lz-site-settings-page .lz-settings-rain.is-constellation::after {
        content: "";
        position: absolute;
        inset: 12% 10%;
        background:
          linear-gradient(28deg, transparent 0 18%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.14) 18.1% 18.35%, transparent 18.45% 100%),
          linear-gradient(142deg, transparent 0 42%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.1) 42.1% 42.3%, transparent 42.4% 100%);
        opacity: 0.8;
      }

      #lz-site-settings-page .lz-settings-rain.is-aurora {
        background:
          linear-gradient(118deg, transparent 4%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.1) 24%, transparent 42%),
          linear-gradient(62deg, transparent 18%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.16) 48%, transparent 74%);
        filter: saturate(118%);
        opacity: 0.78;
      }

      #lz-site-settings-page .lz-settings-rain.is-aurora::before {
        content: "";
        position: absolute;
        inset: -12% -8%;
        background:
          linear-gradient(104deg, transparent 10%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.13) 34%, transparent 58%),
          linear-gradient(76deg, transparent 24%, rgba(255, 255, 255, 0.07) 50%, transparent 72%);
        transform: translate3d(-3%, 0, 0);
        animation: lzSettingsAurora 16s cubic-bezier(0.2, 0.8, 0.2, 1) infinite alternate;
      }

      #lz-site-settings-page .lz-settings-rain.is-circuit {
        background-image:
          linear-gradient(rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.14) 1px, transparent 1px),
          linear-gradient(132deg, transparent 0 42%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.18) 42.2% 42.6%, transparent 42.8%);
        background-size: 94px 94px, 94px 94px, 320px 220px;
        opacity: 0.62;
      }

      #lz-site-settings-page .lz-settings-rain.is-circuit::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, transparent 0 18%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.18) 18.1% 18.45%, transparent 18.6% 100%),
          linear-gradient(0deg, transparent 0 64%, rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.13) 64.1% 64.45%, transparent 64.6% 100%);
        animation: lzSettingsCircuit 11s linear infinite;
      }

      #lz-site-settings-page .lz-settings-rain:not(.is-matrix) span {
        position: absolute;
        top: auto;
        width: var(--lz-star-size, 3px);
        height: var(--lz-star-size, 3px);
        border-radius: 999px;
        background: rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.62);
        color: transparent;
        writing-mode: horizontal-tb;
        text-shadow: 0 0 14px rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.48);
        animation: lzSettingsTwinkle 3.6s ease-in-out infinite;
      }

      #lz-site-settings-page .lz-settings-rain.is-starfield span {
        background: rgba(255, 255, 255, 0.72);
        box-shadow: 0 0 12px rgba(var(--lz-settings-accent-rgb, 217, 154, 53), 0.32);
      }

      @keyframes lzSettingsTwinkle {
        0%, 100% { opacity: 0.24; transform: scale(0.82); }
        45% { opacity: 0.88; transform: scale(1); }
      }

      @keyframes lzSettingsAurora {
        from { transform: translate3d(-4%, -1%, 0) skewX(-4deg); opacity: 0.74; }
        to { transform: translate3d(4%, 2%, 0) skewX(4deg); opacity: 1; }
      }

      @keyframes lzSettingsCircuit {
        from { background-position: 0 0, 0 0; }
        to { background-position: 180px 0, 0 140px; }
      }

      html[data-lz-cursor="crosshair"] body,
      html[data-lz-cursor="crosshair"] button,
      html[data-lz-cursor="crosshair"] a {
        cursor: crosshair;
      }

      html[data-lz-cursor="dot"] body {
        cursor: default;
      }

      html[data-lz-reduce-motion="true"] *,
      html[data-lz-reduce-motion="true"] *::before,
      html[data-lz-reduce-motion="true"] *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }

      @media (max-width: 840px) {
        .lz-settings-grid {
          grid-template-columns: 1fr;
        }

        .lz-settings-shell {
          width: min(100% - 20px, 720px);
          padding-top: 30px;
        }

        .lz-settings-segment {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 520px) {
        .lz-settings-top {
          align-items: flex-start;
          flex-direction: column;
        }

        .lz-settings-top-actions {
          justify-content: flex-start;
          margin-left: 0;
        }

        .lz-settings-swatch,
        .lz-settings-custom {
          width: 50px;
          height: 50px;
        }

        .lz-settings-segment {
          grid-template-columns: 1fr;
        }

        .lz-settings-card {
          padding: 14px;
        }
      }

      #lz-site-settings-page {
        scroll-behavior: smooth;
      }

      .lz-settings-section {
        scroll-margin-top: 96px;
      }

      .lz-settings-section:target {
        border-color: var(--lz-settings-line-strong);
        box-shadow: 0 22px 58px rgba(0, 0, 0, 0.26), 0 0 0 1px rgba(242, 182, 76, 0.08) inset, 0 0 38px rgba(217, 154, 53, 0.08);
      }

      .lz-settings-segment button:active,
      .lz-settings-button:active,
      .lz-settings-toggle:active,
      .lz-settings-swatch:active,
      .lz-settings-custom:active {
        transform: translate3d(0, 0, 0) scale(0.985);
      }

      #lz-site-settings-page .lz-settings-field select option {
        background: #100b06;
        color: #fff7e9;
      }

      #lz-site-settings-page .lz-settings-segment button,
      #lz-site-settings-page .lz-settings-button,
      #lz-site-settings-page .lz-settings-field input,
      #lz-site-settings-page .lz-settings-field select {
        min-height: var(--lz-settings-control) !important;
        border-radius: 11px !important;
      }

      #lz-site-settings-page .lz-settings-segment button,
      #lz-site-settings-page .lz-settings-button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      #lz-site-settings-page .lz-settings-toggle {
        min-height: 38px !important;
      }

      @supports not (min-height: 100dvh) {
        #lz-site-settings-page {
          min-height: 100vh;
        }
      }

      @media (max-width: 520px) {
        .lz-settings-top {
          align-items: center;
          flex-direction: row;
        }

        .lz-settings-title small {
          display: none;
        }

        .lz-settings-top-actions {
          justify-content: flex-end;
          margin-left: auto;
        }

        .lz-settings-swatch,
        .lz-settings-custom,
        .lz-settings-color-picker {
          width: auto;
          min-width: 86px;
          height: 62px;
        }
      }

      .lz-game-cover {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        min-height: 92px;
        margin: 0 0 10px;
        overflow: hidden;
        border: 1px solid var(--lz-site-border);
        border-radius: 8px;
        background: var(--lz-site-soft);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        flex: 0 0 auto;
      }

      .lz-game-cover svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .lz-game-cover img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: var(--lz-site-soft);
      }

      html[data-lz-theme] [data-testid^="game-tile-"] .lz-game-cover + * {
        min-width: 0;
      }

      .lz-zone-rating {
        color: var(--lz-site-text);
        font-family: Inter, Arial, sans-serif;
        letter-spacing: 0;
      }

      .lz-zone-rating.is-card {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        width: max-content;
        max-width: 100%;
        min-height: 20px;
        margin-top: 8px;
        padding: 3px 7px;
        border: 1px solid var(--lz-site-border);
        border-radius: 8px;
        background: var(--lz-site-soft);
        color: var(--lz-site-muted);
        pointer-events: none;
      }

      .lz-zone-rating-stars {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        color: #c9b9aa;
        font: 900 12px/1 Inter, Arial, sans-serif;
        letter-spacing: 0;
        white-space: nowrap;
      }

      .lz-zone-rating-stars .is-filled,
      .lz-zone-rating-star.is-filled,
      .lz-zone-rating-star.is-selected {
        color: var(--lz-site-accent-readable, var(--lz-site-accent));
      }

      .lz-zone-rating-summary {
        color: var(--lz-site-muted);
        font: 850 11px/1 Inter, Arial, sans-serif;
        white-space: nowrap;
      }

      .lz-zone-rating.is-page {
        position: fixed;
        left: 16px;
        top: calc(var(--lz-chat-overlay-top, 76px) + 10px);
        z-index: 99970;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        width: auto;
        max-width: min(520px, calc(100vw - 32px));
        min-height: 40px;
        margin: 0;
        padding: 5px 8px 5px 10px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: rgba(25, 23, 20, 0.88);
        color: #fff;
        box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
      }

      .lz-zone-rating-copy {
        display: grid;
        gap: 3px;
        min-width: 180px;
      }

      .lz-zone-rating-kicker {
        color: var(--lz-site-accent-readable, var(--lz-site-accent));
        font: 900 11px/1 Inter, Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .lz-zone-rating-copy strong {
        color: var(--lz-site-text);
        font: 900 16px/1.15 Inter, Arial, sans-serif;
      }

      .lz-zone-rating.is-page .lz-zone-rating-copy {
        display: block;
        min-width: 0;
      }

      .lz-zone-rating.is-page .lz-zone-rating-kicker,
      .lz-zone-rating.is-page .lz-zone-rating-copy span:last-child {
        display: none;
      }

      .lz-zone-rating.is-page .lz-zone-rating-copy strong {
        display: block;
        max-width: 130px;
        overflow: hidden;
        color: #fff;
        font: 900 12px/1 Inter, Arial, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-zone-rating-copy span:last-child,
      .lz-zone-rating-status {
        color: var(--lz-site-muted);
        font: 800 12px/1.3 Inter, Arial, sans-serif;
      }

      .lz-zone-rating-actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .lz-zone-rating-star {
        width: 34px;
        height: 34px;
        display: inline-grid;
        place-items: center;
        border: 1px solid var(--lz-site-border);
        border-radius: 8px;
        background: var(--lz-site-soft);
        color: #c9b9aa;
        font: 900 20px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-zone-rating.is-page .lz-zone-rating-actions {
        gap: 3px;
      }

      .lz-zone-rating.is-page .lz-zone-rating-star {
        width: 30px;
        height: 30px;
        border-color: rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: #d8d0c7;
        font-size: 18px;
      }

      .lz-zone-rating-star:hover,
      .lz-zone-rating-star:focus-visible {
        border-color: var(--lz-site-accent-readable, var(--lz-site-accent));
        color: var(--lz-site-accent-readable, var(--lz-site-accent));
        outline: 2px solid var(--lz-site-accent-soft);
        outline-offset: 2px;
      }

      .lz-zone-rating-star:disabled {
        cursor: wait;
        opacity: 0.72;
      }

      .lz-zone-rating-status {
        min-width: 110px;
        text-align: right;
      }

      .lz-zone-rating.is-page .lz-zone-rating-status {
        min-width: 0;
        max-width: 92px;
        overflow: hidden;
        color: rgba(255, 255, 255, 0.72);
        font-size: 11px;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-zone-rating.is-page .lz-zone-rating-status:empty {
        display: none;
      }

      .lz-zone-rating-status.ok {
        color: #18864b;
      }

      .lz-zone-rating-status.error {
        color: #d95a48;
      }

      html[data-lz-color-mode="dark"] .lz-zone-rating.is-card,
      html[data-lz-color-mode="dark"] .lz-zone-rating-star {
        background: var(--lz-site-soft);
        border-color: var(--lz-site-border);
      }

      html[data-lz-color-mode="dark"] .lz-zone-rating.is-page {
        border-color: rgba(255, 255, 255, 0.16);
        background: rgba(18, 17, 16, 0.88);
      }

      @media (max-width: 640px) {
        .lz-zone-rating.is-page {
          left: 8px;
          right: 8px;
          top: calc(var(--lz-chat-overlay-top, 66px) + 8px);
          max-width: none;
          padding: 5px 7px;
        }

        .lz-zone-rating.is-page .lz-zone-rating-copy strong {
          max-width: 92px;
        }

        .lz-zone-rating.is-page .lz-zone-rating-actions {
          flex: 1 1 auto;
          justify-content: flex-end;
        }

        .lz-zone-rating.is-page .lz-zone-rating-star {
          width: 28px;
          height: 28px;
          font-size: 17px;
        }

        .lz-zone-rating.is-page .lz-zone-rating-status {
          display: none;
        }
      }

      html[data-lz-color-mode="dark"] .lz-account-link-card,
      html[data-lz-color-mode="dark"] .lz-chat-open-button,
      html[data-lz-color-mode="dark"] .lz-chat-hero,
      html[data-lz-color-mode="dark"] .lz-chat-left,
      html[data-lz-color-mode="dark"] .lz-chat-right,
      html[data-lz-color-mode="dark"] .lz-chat-party-card,
      html[data-lz-color-mode="dark"] .lz-chat-message-card,
      html[data-lz-color-mode="dark"] .lz-chat-dock,
      html[data-lz-color-mode="dark"] .lz-chat-quick-card,
      html[data-lz-color-mode="dark"] .lz-chat-message-tabs,
      html[data-lz-color-mode="dark"] .lz-chat-pause-setting,
      html[data-lz-color-mode="dark"] .lz-chat-private-rooms,
      html[data-lz-color-mode="dark"] .lz-chat-private-room,
      html[data-lz-color-mode="dark"] .lz-site-profile-card,
      html[data-lz-color-mode="dark"] .lz-site-profile-stat,
      html[data-lz-color-mode="dark"] .lz-site-profile-field input,
      html[data-lz-color-mode="dark"] .lz-site-profile-field textarea,
      html[data-lz-color-mode="dark"] .lz-site-profile-field select {
        background: var(--lz-chat-surface) !important;
        color: var(--lz-chat-text) !important;
        border-color: var(--lz-chat-border) !important;
      }

      html[data-lz-color-mode="dark"] .lz-chat-pause-switch {
        background: var(--lz-site-soft);
        border-color: var(--lz-chat-border);
      }

      html[data-lz-color-mode="dark"] .lz-chat-search,
      html[data-lz-color-mode="dark"] .lz-chat-message-input,
      html[data-lz-color-mode="dark"] .lz-chat-account-action,
      html[data-lz-color-mode="dark"] .lz-chat-mini-pill,
      html[data-lz-color-mode="dark"] .lz-chat-message-tab,
      html[data-lz-color-mode="dark"] .lz-site-profile-action,
      html[data-lz-color-mode="dark"] .lz-account-link-actions button {
        background: var(--lz-site-soft) !important;
        color: var(--lz-site-text) !important;
        border-color: var(--lz-site-border) !important;
      }

      html[data-lz-color-mode="dark"] .lz-site-profile-color-row input[type="color"] {
        background: transparent !important;
      }

      html[data-lz-color-mode="dark"] .lz-chat-person:hover,
      html[data-lz-color-mode="dark"] .lz-chat-channel.active,
      html[data-lz-color-mode="dark"] .lz-chat-channel:hover,
      html[data-lz-color-mode="dark"] .lz-chat-tab.active,
      html[data-lz-color-mode="dark"] .lz-chat-tab:hover,
      html[data-lz-color-mode="dark"] .lz-chat-message-tab.active,
      html[data-lz-color-mode="dark"] .lz-chat-message-tab:hover,
      html[data-lz-color-mode="dark"] .lz-chat-private-room.active,
      html[data-lz-color-mode="dark"] .lz-chat-private-room:hover {
        background: var(--lz-site-accent-soft) !important;
        color: var(--lz-site-accent-readable, var(--lz-site-accent)) !important;
      }

      .lz-account-link-card {
        margin: 16px 0 0;
        padding: 14px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--lz-chat-text);
        box-shadow: 0 12px 28px rgba(71, 54, 40, 0.08);
        font: 500 13px/1.45 Inter, Arial, sans-serif;
      }

      .lz-account-link-card.is-modal {
        position: fixed;
        right: 22px;
        top: calc(var(--lz-chat-overlay-top, 76px) + 18px);
        z-index: 100020;
        width: min(380px, calc(100vw - 32px));
      }

      .lz-account-link-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
        font-weight: 850;
      }

      .lz-account-link-fine {
        margin: 0 0 12px;
        color: var(--lz-chat-muted);
        font-size: 12px;
      }

      .lz-account-link-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .lz-account-link-actions button,
      .lz-account-link-open {
        min-height: 36px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: #fff;
        color: var(--lz-chat-text);
        font: 800 12px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-account-link-actions button.active {
        border-color: var(--lz-chat-orange);
        background: var(--lz-chat-orange);
        color: #fff;
      }

      .lz-account-link-status {
        margin-top: 10px;
        color: var(--lz-chat-muted);
        font-size: 12px;
      }

      .lz-account-link-close {
        width: 30px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid var(--lz-chat-border);
        background: #fff;
        cursor: pointer;
      }

      .lz-chat-open-button {
        position: fixed;
        right: 22px;
        top: var(--lz-chat-control-top, 16px);
        bottom: auto;
        z-index: 99980;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 42px;
        padding: 0 14px 0 8px;
        border: 1px solid var(--lz-chat-chrome-border);
        border-radius: 999px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.28)),
          radial-gradient(circle at 18% 18%, rgba(237, 100, 24, 0.14), transparent 48%),
          var(--lz-chat-chrome-bg);
        color: var(--lz-chat-chrome-text);
        font: 850 14px/1 Inter, Arial, sans-serif;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.76) inset, 0 16px 38px rgba(71, 54, 40, 0.14), 0 18px 56px rgba(237, 100, 24, 0.10);
        cursor: pointer;
        white-space: nowrap;
      }

      .lz-chat-open-button:hover {
        border-color: var(--lz-chat-orange);
        color: var(--lz-chat-chrome-text);
        transform: translateY(-1px);
      }

      .lz-chat-open-button[hidden] {
        display: none !important;
      }

      .lz-chat-open-button.is-docked-in-header {
        position: static;
        inset: auto;
        z-index: auto;
        flex: 0 0 auto;
        min-height: 32px;
        height: 32px;
        padding: 0 12px 0 6px;
        gap: 8px;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.78) inset, 0 8px 22px rgba(71, 54, 40, 0.075);
        transform: none;
      }

      .lz-chat-open-button::before {
        display: none;
      }

      .lz-chat-open-button svg,
      .lz-chat-overlay-button svg {
        width: 18px;
        height: 18px;
        display: block;
      }

      .lz-chat-open-button svg {
        width: 30px;
        height: 30px;
        padding: 7px;
        border-radius: 11px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent), var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 8px 20px rgba(237, 100, 24, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.22) inset;
      }

      .lz-chat-open-button.is-docked-in-header svg {
        width: 26px;
        height: 26px;
        padding: 6px;
        border-radius: 10px;
        box-shadow: none;
      }

      .lz-chat-open-button,
      .lz-chat-open-button.is-docked-in-header {
        overflow: visible;
        isolation: isolate;
      }

      .lz-chat-open-button.is-docked-in-header {
        position: relative;
      }

      .lz-chat-notification-count {
        position: absolute;
        top: -8px;
        right: -7px;
        z-index: 3;
        display: inline-grid;
        place-items: center;
        min-width: 21px;
        height: 21px;
        padding: 0 5px;
        border: 2px solid var(--lz-chat-chrome-bg);
        border-radius: 999px;
        background: var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 5px 14px rgba(237, 100, 24, 0.28);
        font: 900 10px/1 Inter, Arial, sans-serif;
        letter-spacing: 0;
        pointer-events: none;
      }

      .lz-chat-notification-count[hidden] {
        display: none !important;
      }

      .lz-chat-notification-bubble {
        position: fixed;
        z-index: 2147483604;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 30px;
        align-items: center;
        width: min(286px, calc(100vw - 24px));
        min-height: 58px;
        padding: 7px;
        border: 1px solid var(--lz-chat-chrome-border);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.42)),
          var(--lz-chat-chrome-bg);
        color: var(--lz-chat-chrome-text);
        box-shadow: 0 18px 44px rgba(45, 31, 20, 0.16), 0 1px 0 rgba(255, 255, 255, 0.82) inset;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translate3d(0, 6px, 0) scale(0.985);
        transform-origin: right bottom;
        transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 180ms linear;
        -webkit-backdrop-filter: blur(16px) saturate(1.12);
        backdrop-filter: blur(16px) saturate(1.12);
      }

      .lz-chat-notification-bubble.is-below {
        transform: translate3d(0, -6px, 0) scale(0.985);
        transform-origin: right top;
      }

      .lz-chat-notification-bubble.is-visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translate3d(0, 0, 0) scale(1);
      }

      .lz-chat-notification-bubble[hidden] {
        display: none !important;
      }

      .lz-chat-notification-bubble::after {
        content: "";
        position: absolute;
        right: 22px;
        bottom: -6px;
        width: 10px;
        height: 10px;
        border-right: 1px solid var(--lz-chat-chrome-border);
        border-bottom: 1px solid var(--lz-chat-chrome-border);
        background: var(--lz-chat-chrome-bg);
        transform: rotate(45deg);
      }

      .lz-chat-notification-bubble.is-below::after {
        top: -6px;
        bottom: auto;
        border: 0;
        border-top: 1px solid var(--lz-chat-chrome-border);
        border-left: 1px solid var(--lz-chat-chrome-border);
      }

      .lz-chat-notification-main {
        min-width: 0;
        min-height: 44px;
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 4px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .lz-chat-notification-main:hover,
      .lz-chat-notification-main:focus-visible {
        background: color-mix(in srgb, var(--lz-chat-orange) 9%, transparent);
        outline: none;
      }

      .lz-chat-notification-main:focus-visible,
      .lz-chat-notification-dismiss:focus-visible {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--lz-chat-orange) 72%, white 28%);
      }

      .lz-chat-notification-icon {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 8px 18px rgba(237, 100, 24, 0.2);
      }

      .lz-chat-notification-icon svg {
        width: 17px;
        height: 17px;
      }

      .lz-chat-notification-copy {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .lz-chat-notification-copy strong {
        overflow: hidden;
        font: 850 13px/1.15 Inter, Arial, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-chat-notification-summary {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 8px;
        color: var(--lz-chat-muted);
        font: 700 11px/1.2 Inter, Arial, sans-serif;
      }

      .lz-chat-notification-summary span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .lz-chat-notification-summary b {
        color: var(--lz-chat-orange);
        font-weight: 900;
      }

      .lz-chat-notification-dismiss {
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: var(--lz-chat-muted);
        font: 700 18px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-notification-dismiss:hover {
        border-color: var(--lz-chat-chrome-border);
        background: var(--lz-chat-chrome-action-bg);
        color: var(--lz-chat-chrome-text);
      }

      html[data-lz-color-mode="dark"] .lz-chat-notification-bubble {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025)),
          var(--lz-chat-chrome-bg);
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.34), 0 1px 0 rgba(255, 255, 255, 0.08) inset;
      }

      body.lz-chat-overlay-open .lz-chat-open-button {
        opacity: 0;
        pointer-events: none;
        transform: translateY(-3px);
      }

      .lz-chat-overlay-scrim {
        position: fixed;
        inset: 0;
        z-index: 2147483599;
        display: none;
        background: transparent;
        pointer-events: none;
      }

      .lz-chat-overlay {
        position: fixed;
        left: 0;
        right: 0;
        top: var(--lz-chat-overlay-top, 76px);
        bottom: 0;
        z-index: 2147483600;
        display: none;
        width: auto;
        height: auto;
        overflow: visible;
        pointer-events: none;
        border-top: 0;
        border-left: 0;
        border-right: 0;
        border-bottom: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      .lz-chat-overlay.is-open,
      .lz-chat-overlay-scrim.is-open {
        display: block;
      }

      .lz-chat-overlay-head {
        position: fixed;
        top: var(--lz-chat-control-top, 16px);
        right: 16px;
        z-index: 2147483602;
        pointer-events: auto;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 8px 0 10px;
        border: 1px solid var(--lz-chat-chrome-border);
        border-radius: 999px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.30)),
          radial-gradient(circle at 12% 12%, rgba(237, 100, 24, 0.12), transparent 44%),
          var(--lz-chat-chrome-bg);
        color: var(--lz-chat-chrome-text);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.76) inset, 0 14px 34px rgba(71, 54, 40, 0.12), 0 18px 48px rgba(237, 100, 24, 0.08);
      }

      .lz-chat-overlay:popover-open,
      .lz-chat-open-button:popover-open {
        margin: 0;
      }

      .lz-chat-overlay::backdrop,
      .lz-chat-open-button::backdrop {
        background: transparent;
        pointer-events: none;
      }

      .lz-chat-overlay-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        color: var(--lz-chat-chrome-text);
        font: 850 13px/1 Inter, Arial, sans-serif;
      }

      .lz-chat-overlay-title-mark {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent), var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 8px 22px rgba(237, 100, 24, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.22) inset;
      }

      .lz-chat-overlay-title span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-chat-overlay-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .lz-chat-overlay-button {
        min-width: 36px;
        height: 36px;
        border: 1px solid var(--lz-chat-chrome-border);
        border-radius: 10px;
        display: inline-grid;
        place-items: center;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), transparent), var(--lz-chat-chrome-action-bg);
        color: var(--lz-chat-chrome-text);
        cursor: pointer;
      }

      .lz-chat-overlay-button:hover {
        border-color: var(--lz-chat-orange);
        color: var(--lz-chat-chrome-text);
      }

      .lz-chat-overlay-frame {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: var(--lz-chat-bg);
      }

      body.lz-chat-overlay-open {
        overflow: auto;
      }

      @media (max-width: 900px) {
        .lz-chat-overlay {
          left: 0;
          right: 0;
          top: var(--lz-chat-overlay-top, 66px);
          bottom: 0;
          width: 100vw;
          height: auto;
          border-radius: 0;
          border-left: 0;
          border-right: 0;
          border-bottom: 0;
        }

        .lz-chat-open-button {
          right: 14px;
          top: var(--lz-chat-control-top, 12px);
          bottom: auto;
          min-height: 42px;
          border-radius: 999px;
          padding: 0 15px;
        }

        .lz-chat-open-button.is-docked-in-header {
          position: relative;
          width: 36px;
          min-height: 32px;
          height: 32px;
          padding: 0 5px;
        }

        .lz-chat-open-button.is-docked-in-header span {
          display: none;
        }

        .lz-chat-overlay-head {
          top: var(--lz-chat-control-top, 12px);
          right: 8px;
        }

        .lz-chat-overlay-title span:last-child {
          display: none;
        }

        .lz-chat-notification-bubble {
          width: min(268px, calc(100vw - 20px));
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .lz-chat-notification-bubble {
          transition: none;
          transform: none;
        }
      }

      .lz-chat-overlay {
        pointer-events: none;
        overflow: visible;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .lz-chat-overlay::before {
        display: none !important;
      }

      .lz-chat-overlay-scrim {
        pointer-events: none !important;
        background: transparent !important;
      }

      .lz-chat-overlay-head {
        position: absolute;
        top: 4px;
        right: 14px;
      }

      @media (max-width: 860px) {
        .lz-chat-overlay-head {
          position: absolute;
          top: -50px;
        }
      }

      html[data-lz-fullscreen-active="true"] .lz-chat-open-button {
        position: fixed !important;
        top: var(--lz-chat-control-top, 74px) !important;
        right: max(18px, env(safe-area-inset-right, 0px)) !important;
        z-index: 2147483602;
      }

      html[data-lz-fullscreen-active="true"] .lz-chat-overlay-head {
        position: absolute !important;
        top: -48px !important;
        right: max(18px, env(safe-area-inset-right, 0px)) !important;
        z-index: 2147483602;
      }

      html[data-lz-fullscreen-active="true"] .lz-chat-overlay {
        top: var(--lz-chat-overlay-top, 122px) !important;
      }

      @supports not (top: max(1px, 2px)) {
        html[data-lz-fullscreen-active="true"] .lz-chat-open-button {
          top: var(--lz-chat-control-top, 74px) !important;
          right: 18px !important;
        }

        html[data-lz-fullscreen-active="true"] .lz-chat-overlay-head {
          top: -48px !important;
          right: 18px !important;
        }

        html[data-lz-fullscreen-active="true"] .lz-chat-overlay {
          top: var(--lz-chat-overlay-top, 122px) !important;
        }
      }

      .lz-chat-overlay-frame {
        position: absolute;
        left: 0;
        right: 0;
        top: 58px;
        bottom: auto;
        z-index: 1;
        display: block;
        width: 100%;
        height: calc(100% - 58px);
        border: 0;
        background: var(--lz-chat-bg);
      }

      .lz-chat-stage {
        display: none;
        position: absolute;
        inset: 0;
        z-index: 2147483601;
        pointer-events: none;
        font-family: Inter, Arial, sans-serif;
      }

      .lz-chat-overlay[data-lz-overlay-mode="native"] .lz-chat-overlay-frame {
        display: none;
      }

      .lz-chat-overlay[data-lz-overlay-mode="native"] .lz-chat-stage {
        display: block;
      }

      .lz-chat-overlay[data-lz-overlay-mode="frame"] .lz-chat-stage {
        display: none;
      }

      .lz-chat-panel {
        position: absolute;
        top: 16px;
        bottom: 16px;
        z-index: 2;
        width: 268px;
        pointer-events: auto;
        overflow: auto;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.52), transparent),
          rgba(255, 255, 255, 0.96);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.76) inset, 0 14px 38px rgba(71, 54, 40, 0.11), 0 18px 48px rgba(237, 100, 24, 0.06);
      }

      .lz-chat-left {
        left: 20px;
      }

      .lz-chat-right {
        right: 20px;
        top: 64px;
        width: 306px;
        display: grid;
        grid-template-rows: auto auto auto auto auto minmax(0, 1fr) auto;
        overflow: hidden;
      }

      .lz-chat-right > .lz-chat-right-head {
        grid-row: 1;
      }

      .lz-chat-right > .lz-chat-message-tabs {
        grid-row: 2;
      }

      .lz-chat-right > .lz-chat-pause-setting {
        grid-row: 3;
      }

      .lz-chat-right > .lz-chat-private-rooms {
        grid-row: 4;
      }

      .lz-chat-right > .lz-chat-mod-tools {
        grid-row: 5;
      }

      .lz-chat-right > .lz-chat-messages {
        grid-row: 6;
      }

      .lz-chat-right > .lz-chat-right-composer {
        grid-row: 7;
      }

      .lz-chat-panel-section {
        padding: 16px;
        border-bottom: 1px solid var(--lz-chat-border);
      }

      .lz-chat-panel-section:last-child {
        border-bottom: 0;
      }

      .lz-chat-panel-section.is-quiet-empty {
        padding-top: 10px;
        padding-bottom: 10px;
        background: color-mix(in srgb, var(--lz-chat-surface) 72%, transparent);
        transition:
          padding 190ms cubic-bezier(0.2, 0.8, 0.2, 1),
          background-color 190ms cubic-bezier(0.2, 0.8, 0.2, 1),
          opacity 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-chat-panel-section.is-quiet-empty .lz-chat-kicker {
        margin-bottom: 0;
        color: color-mix(in srgb, var(--lz-chat-muted) 74%, var(--lz-chat-orange));
      }

      .lz-chat-panel-section.is-quiet-empty .lz-chat-kicker::after {
        content: attr(data-lz-empty-label);
        color: var(--lz-chat-muted);
        font-size: 10px;
        font-weight: 750;
        letter-spacing: 0;
        text-transform: none;
      }

      .lz-chat-panel-section.is-quiet-empty [data-lz-active-chats] {
        display: none;
      }

      .lz-chat-panel-section.is-quiet-empty .lz-chat-person {
        min-height: 38px;
        padding-top: 5px;
        padding-bottom: 5px;
        box-shadow: none;
      }

      .lz-chat-kicker {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 12px;
        color: var(--lz-chat-orange);
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .02em;
      }

      .lz-chat-primary {
        width: 100%;
        min-height: 38px;
        border: 0;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: var(--lz-chat-orange);
        color: #fff;
        font: 850 13px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-primary:hover {
        background: var(--lz-chat-orange-hover);
      }

      .lz-chat-primary svg {
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
      }

      .lz-chat-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin: 12px 0 10px;
      }

      .lz-chat-tab {
        position: relative;
        min-height: 34px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: #fff;
        color: var(--lz-chat-text);
        font: 850 12px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-tab.active,
      .lz-chat-tab:hover {
        border-color: rgba(255, 118, 40, .45);
        background: #fff3ea;
        color: var(--lz-chat-orange);
      }

      .lz-chat-message-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--lz-chat-border);
        background: #fffdfa;
      }

      .lz-chat-message-tab {
        min-height: 32px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: #fff;
        color: var(--lz-chat-muted);
        font: 900 12px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-message-tab.active,
      .lz-chat-message-tab:hover {
        border-color: rgba(255, 118, 40, .45);
        background: var(--lz-chat-orange);
        color: #fff;
      }

      .lz-chat-pause-setting {
        min-height: 38px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--lz-chat-border);
        background: #fffdfa;
        color: var(--lz-chat-muted);
        font: 800 11px/1.3 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-pause-setting input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .lz-chat-pause-switch {
        position: relative;
        flex: 0 0 34px;
        width: 34px;
        height: 20px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: #e9e3dc;
        transition: background 180ms cubic-bezier(.2,.8,.2,1), border-color 180ms cubic-bezier(.2,.8,.2,1);
      }

      .lz-chat-pause-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 7px rgba(37, 29, 23, .2);
        transition: transform 180ms cubic-bezier(.2,.8,.2,1);
      }

      .lz-chat-pause-setting input:checked + .lz-chat-pause-switch {
        border-color: var(--lz-chat-orange);
        background: var(--lz-chat-orange);
      }

      .lz-chat-pause-setting input:checked + .lz-chat-pause-switch::after {
        transform: translateX(14px);
      }

      .lz-chat-pause-setting input:focus-visible + .lz-chat-pause-switch {
        outline: 3px solid rgba(255, 118, 40, .25);
        outline-offset: 2px;
      }

      .lz-chat-mobile-panel-toggle {
        display: none;
      }

      .lz-chat-game-paused {
        pointer-events: none !important;
      }

      .lz-chat-badge {
        position: absolute;
        top: -8px;
        right: -7px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 0 0 2px #fff;
        font: 900 10px/1 Inter, Arial, sans-serif;
      }

      .lz-chat-badge.is-empty {
        background: #b9b1aa;
      }

      .lz-chat-search,
      .lz-chat-message-input {
        width: 100%;
        min-height: 38px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: #fff;
        color: var(--lz-chat-text);
        padding: 0 12px;
        font: 500 13px/1 Inter, Arial, sans-serif;
        outline: 0;
      }

      .lz-chat-search:focus,
      .lz-chat-message-input:focus {
        border-color: var(--lz-chat-orange);
        box-shadow: 0 0 0 3px rgba(255, 118, 40, 0.12);
      }

      .lz-chat-private-rooms {
        display: grid;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--lz-chat-border);
        background: #fff8f1;
      }

      .lz-chat-private-rooms[hidden] {
        display: none;
      }

      .lz-chat-private-room {
        min-height: 44px;
        width: 100%;
        border: 1px solid var(--lz-chat-border);
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 6px 8px;
        background: #fff;
        color: var(--lz-chat-text);
        text-align: left;
        cursor: pointer;
      }

      .lz-chat-private-room.active,
      .lz-chat-private-room:hover {
        border-color: rgba(255, 118, 40, .45);
        background: #fff3ea;
      }

      .lz-chat-private-room.is-locked {
        opacity: .72;
      }

      .lz-chat-private-room span:not(.lz-chat-avatar):not(.lz-chat-private-icon) {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .lz-chat-private-room strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: 900 12px/1 Inter, Arial, sans-serif;
      }

      .lz-chat-private-room em {
        color: var(--lz-chat-muted);
        font: 800 10px/1 Inter, Arial, sans-serif;
        font-style: normal;
        text-transform: uppercase;
      }

      .lz-chat-private-icon {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: #fff1e7;
        color: var(--lz-chat-orange);
        flex: 0 0 34px;
      }

      .lz-chat-party-card,
      .lz-chat-message-card,
      .lz-chat-dock,
      .lz-chat-quick-card {
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: #fffdfa;
      }

      .lz-chat-party-card {
        padding: 14px;
        display: grid;
        gap: 10px;
      }

      .lz-chat-party-card[hidden] {
        display: none !important;
      }

      .lz-chat-party-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        color: var(--lz-chat-text);
        font-weight: 900;
      }

      .lz-spectate-toggle {
        min-height: 34px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 10px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: var(--lz-site-soft);
        color: var(--lz-chat-text);
        font: 850 12px/1.2 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-spectate-toggle input {
        width: 16px;
        height: 16px;
        accent-color: var(--lz-chat-orange);
      }

      .lz-spectate-member-list {
        display: grid;
        gap: 8px;
      }

      .lz-spectate-member-row {
        min-height: 44px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 9px;
        padding: 8px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, .68);
      }

      .lz-spectate-member-copy {
        min-width: 0;
      }

      .lz-spectate-member-copy strong,
      .lz-spectate-member-copy span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-spectate-member-copy strong {
        color: var(--lz-chat-text);
        font: 900 12px/1.15 Inter, Arial, sans-serif;
      }

      .lz-spectate-member-copy span {
        margin-top: 3px;
        color: var(--lz-chat-muted);
        font: 750 11px/1.15 Inter, Arial, sans-serif;
      }

      .lz-spectate-button {
        min-height: 30px;
        border: 1px solid rgba(255, 118, 40, .36);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0 10px;
        background: #fffdfa;
        color: var(--lz-chat-orange);
        font: 900 11px/1 Inter, Arial, sans-serif;
        cursor: pointer;
        white-space: nowrap;
      }

      .lz-spectate-button svg {
        width: 14px;
        height: 14px;
      }

      .lz-spectate-button:hover {
        border-color: rgba(255, 118, 40, .58);
        background: #fff1e7;
      }

      .lz-spectate-button.primary {
        border-color: var(--lz-chat-orange);
        background: var(--lz-chat-orange);
        color: #fff;
      }

      .lz-spectators-card {
        display: grid;
        gap: 4px;
        padding: 10px;
        border: 1px solid rgba(255, 118, 40, .28);
        border-radius: 8px;
        background: #fff8f1;
        color: var(--lz-chat-text);
      }

      .lz-spectators-card strong {
        font: 900 12px/1.2 Inter, Arial, sans-serif;
      }

      .lz-spectators-card span {
        color: var(--lz-chat-muted);
        font: 750 11px/1.3 Inter, Arial, sans-serif;
      }

      .lz-chat-muted {
        color: var(--lz-chat-muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .lz-chat-outline {
        min-height: 36px;
        border: 1px solid rgba(255, 118, 40, .45);
        border-radius: 8px;
        background: #fff;
        color: var(--lz-chat-orange);
        font: 850 12px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-inline-note {
        display: none;
        margin-top: 10px;
        padding: 9px 10px;
        border: 1px solid rgba(255, 118, 40, .28);
        border-radius: 8px;
        background: #fff8f1;
        color: var(--lz-chat-muted);
        font: 750 12px/1.35 Inter, Arial, sans-serif;
      }

      .lz-chat-inline-note.is-visible {
        display: block;
      }

      .lz-chat-user-results {
        display: grid;
        gap: 7px;
        margin-top: 10px;
        max-height: 190px;
        overflow: auto;
      }

      .lz-chat-user-results:empty {
        display: none;
      }

      .lz-chat-person,
      .lz-chat-channel,
      .lz-chat-member-mini {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 42px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        padding: 6px 8px;
        text-align: left;
        cursor: pointer;
      }

      .lz-chat-person:hover,
      .lz-chat-channel:hover {
        background: #fff3ea;
      }

      .lz-chat-person[disabled] {
        opacity: .68;
        cursor: default;
      }

      .lz-chat-person[disabled]:hover {
        background: transparent;
      }

      .lz-chat-person-actions {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .lz-chat-account-actions {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .lz-chat-account-action {
        min-width: 42px;
        min-height: 24px;
        border: 1px solid rgba(255, 118, 40, .28);
        border-radius: 999px;
        background: #fffdfa;
        color: var(--lz-chat-orange);
        font: 900 10px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-account-action:hover {
        background: #fff1e7;
      }

      .lz-chat-account-action.danger {
        border-color: rgba(217, 90, 72, .34);
        color: #d95a48;
        background: #fff5f3;
      }

      .lz-chat-mini-pill {
        box-sizing: border-box;
        min-width: 42px;
        height: 26px;
        min-height: 26px;
        padding: 0 10px;
        border: 1px solid rgba(255, 118, 40, .36);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #fff7f0;
        color: var(--lz-chat-orange);
        font: 900 11px/1 Inter, Arial, sans-serif;
        text-align: center;
        white-space: nowrap;
      }

      .lz-chat-mini-pill.muted {
        border-color: var(--lz-chat-border);
        background: #f6f2ee;
        color: var(--lz-chat-muted);
      }

      .lz-chat-avatar {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #de6f2d;
        color: #21130a;
        font-weight: 900;
        font-size: 12px;
      }

      .lz-chat-avatar.small {
        width: 30px;
        height: 30px;
        flex-basis: 30px;
        font-size: 10px;
        box-shadow: 0 0 0 2px #fff;
      }

      .lz-chat-avatar.controller {
        position: relative;
        background: var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 0 0 2px #fff, 0 6px 14px rgba(255, 118, 40, 0.2);
      }

      .lz-chat-avatar.controller svg {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 56%;
        height: 56%;
        transform: translate(-50%, -50%);
        display: block;
        stroke-width: 2.35;
      }

      .lz-chat-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .lz-chat-person strong,
      .lz-chat-member-mini strong {
        display: block;
        color: var(--lz-chat-text);
        font-size: 13px;
        line-height: 1.15;
      }

      .lz-chat-person span,
      .lz-chat-member-mini span {
        display: block;
        color: var(--lz-chat-muted);
        font-size: 11px;
      }

      .lz-chat-dot {
        margin-left: auto;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #35a86b;
      }

      .lz-chat-channel {
        color: var(--lz-chat-text);
        font-weight: 800;
      }

      .lz-chat-channel.active {
        color: var(--lz-chat-orange);
        background: #fff3ea;
      }

      .lz-chat-hero {
        position: absolute;
        left: 304px;
        right: 346px;
        top: 20px;
        pointer-events: auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 16px;
        min-height: 118px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        padding: 20px 28px;
        box-shadow: 0 8px 32px rgba(71, 54, 40, 0.06);
      }

      .lz-chat-hero h2 {
        margin: 0 0 8px;
        color: var(--lz-chat-text);
        font-size: 20px;
        line-height: 1.1;
        font-weight: 900;
      }

      .lz-chat-hero p {
        margin: 0;
        color: var(--lz-chat-muted);
        font-size: 13px;
      }

      .lz-chat-actions {
        display: grid;
        grid-template-columns: repeat(4, 84px);
        gap: 10px;
      }

      .lz-chat-quick-card {
        height: 78px;
        display: grid;
        place-items: center;
        gap: 6px;
        color: var(--lz-chat-orange);
        font-size: 11px;
        font-weight: 850;
        cursor: pointer;
      }

      .lz-chat-quick-card svg {
        width: 24px;
        height: 24px;
      }

      .lz-chat-right-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 16px;
        border-bottom: 1px solid var(--lz-chat-border);
      }

      .lz-chat-mod-tools {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--lz-chat-border);
        background: #fff8f1;
      }

      .lz-chat-mod-tools[hidden] {
        display: none;
      }

      .lz-chat-mod-button,
      .lz-chat-message-action {
        min-height: 30px;
        border: 1px solid rgba(255, 118, 40, .28);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #fffdfa;
        color: var(--lz-chat-orange);
        font: 900 11px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-chat-mod-button:hover,
      .lz-chat-message-action:hover {
        border-color: rgba(255, 118, 40, .5);
        background: #fff1e7;
      }

      .lz-chat-mod-button.danger,
      .lz-chat-message-action.danger {
        border-color: rgba(217, 90, 72, .34);
        color: #d95a48;
        background: #fff5f3;
      }

      .lz-chat-mod-button[disabled],
      .lz-chat-message-action[disabled] {
        opacity: .58;
        cursor: not-allowed;
      }

      .lz-chat-right-title {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--lz-chat-text);
        font-size: 13px;
        font-weight: 950;
        text-transform: uppercase;
      }

      .lz-chat-right-title span {
        display: inline-grid;
        place-items: center;
      }

      .lz-chat-online {
        color: var(--lz-chat-muted);
        font-size: 11px;
      }

      .lz-chat-room-note {
        margin-top: 3px;
        color: var(--lz-chat-muted);
        font: 750 10px/1.25 Inter, Arial, sans-serif;
      }

      .lz-chat-messages {
        display: grid;
        min-height: 0;
        align-content: start;
        gap: 10px;
        padding: 12px;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
      }

      .lz-chat-message-feed {
        display: grid;
        gap: 6px;
      }

      .lz-chat-member-feed {
        display: grid;
        gap: 10px;
      }

      .lz-chat-active-accounts {
        border: 1px solid var(--lz-chat-border);
        border-radius: 12px;
        background: #fffdfa;
        overflow: hidden;
      }

      .lz-chat-active-accounts summary {
        min-height: 42px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        cursor: pointer;
        color: var(--lz-chat-text);
        font: 900 12px/1 Inter, Arial, sans-serif;
        list-style: none;
      }

      .lz-chat-active-accounts summary::-webkit-details-marker {
        display: none;
      }

      .lz-chat-active-accounts summary::after {
        content: "+";
        width: 22px;
        height: 22px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        display: grid;
        place-items: center;
        color: var(--lz-chat-orange);
        background: var(--lz-chat-surface);
        font-size: 16px;
        line-height: 1;
      }

      .lz-chat-active-accounts[open] summary {
        border-bottom: 1px solid var(--lz-chat-border);
      }

      .lz-chat-active-accounts[open] summary::after {
        content: "-";
      }

      .lz-chat-active-count {
        margin-left: auto;
        color: var(--lz-chat-muted);
        font: 800 11px/1 Inter, Arial, sans-serif;
      }

      .lz-chat-member-feed {
        padding: 10px;
      }

      .lz-chat-feed-empty {
        border: 1px dashed var(--lz-chat-border);
        border-radius: 8px;
        padding: 14px;
        color: var(--lz-chat-muted);
        background: #fffdfa;
        font: 750 12px/1.35 Inter, Arial, sans-serif;
      }

      .lz-global-chat-empty {
        min-height: 220px;
        display: grid;
        place-items: center;
        padding: 24px 12px;
        text-align: center;
      }

      .lz-global-chat-empty-card {
        width: min(100%, 260px);
        border: 1px dashed var(--lz-chat-border);
        border-radius: 14px;
        background: var(--lz-chat-surface-warm);
        box-shadow: var(--lz-chat-shadow);
        padding: 18px;
        color: var(--lz-chat-text);
      }

      .lz-global-chat-empty-icon {
        width: 44px;
        height: 44px;
        margin: 0 auto 10px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: var(--lz-chat-orange-soft);
        color: var(--lz-chat-orange);
        font-size: 23px;
      }

      .lz-global-chat-empty-card strong {
        display: block;
        color: var(--lz-chat-text);
        font: 950 16px/1.2 Inter, Arial, sans-serif;
      }

      .lz-global-chat-empty-card p {
        margin: 8px 0 12px;
        color: var(--lz-chat-muted);
        font: 760 12px/1.45 Inter, Arial, sans-serif;
      }

      .lz-global-chat-empty-card ul {
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
        list-style: none;
        color: var(--lz-chat-muted);
        font: 800 11px/1.35 Inter, Arial, sans-serif;
        text-align: left;
      }

      .lz-global-chat-empty-card li {
        position: relative;
        padding-left: 15px;
      }

      .lz-global-chat-empty-card li::before {
        content: "";
        position: absolute;
        left: 0;
        top: .55em;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: var(--lz-chat-orange);
      }

      .lz-chat-message-card {
        padding: 8px;
        display: grid;
        gap: 6px;
        position: relative;
        overflow: hidden;
        transform: translate3d(0, 0, 0);
        transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1), background 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-chat-message-card:hover,
      .lz-chat-message-card:focus-within {
        border-color: rgba(255, 118, 40, .28);
        box-shadow: 0 11px 24px rgba(71, 54, 40, .11);
        transform: translate3d(0, -1px, 0);
      }

      .lz-chat-message-card.is-mine {
        background: linear-gradient(180deg, rgba(255, 118, 40, .08), rgba(255, 255, 255, .98));
      }

      .lz-chat-message-card.is-mentioned {
        border-color: rgba(255, 118, 40, .38);
        box-shadow: inset 3px 0 0 var(--lz-chat-orange), 0 10px 24px rgba(255, 118, 40, .11);
      }

      .lz-chat-message-card.just-arrived {
        animation: lzOverlayMessageIn 190ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .lz-chat-message-row {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
      }

      .lz-chat-message-row > .lz-chat-avatar {
        width: 30px;
        height: 30px;
        flex-basis: 30px;
        font-size: 10px;
      }

      .lz-chat-message-copy {
        min-width: 0;
      }

      .lz-chat-message-row strong {
        color: var(--lz-chat-text);
        font-size: 13px;
      }

      .lz-chat-message-row p {
        margin: 3px 0 0;
        color: #241f1b;
        font-size: 12px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .lz-chat-message-row time {
        color: var(--lz-chat-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        transition: color 160ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-chat-message-meta {
        display: grid;
        grid-template-areas: "controls";
        align-items: start;
        justify-items: end;
        min-width: 82px;
        min-height: 24px;
      }

      .lz-chat-message-meta time,
      .lz-chat-message-actions {
        grid-area: controls;
      }

      .lz-chat-message-meta time {
        padding-top: 2px;
        opacity: 1;
      }

      .lz-chat-message-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        opacity: 0;
        pointer-events: none;
        transform: translate3d(0, 3px, 0);
        transition: opacity 160ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-chat-message-action {
        min-height: 22px;
        padding: 0 6px;
        font-size: 9px;
        transition: background 160ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-chat-message-card:hover .lz-chat-message-actions,
      .lz-chat-message-card:focus-within .lz-chat-message-actions {
        opacity: 1;
        pointer-events: auto;
        transform: translate3d(0, 0, 0);
      }

      .lz-chat-message-card:hover .lz-chat-message-meta time,
      .lz-chat-message-card:focus-within .lz-chat-message-meta time {
        opacity: 0;
      }

      .lz-chat-message-text {
        font-family: Inter, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
      }

      .lz-chat-mention {
        display: inline-flex;
        align-items: center;
        min-height: 1.35em;
        padding: 0 5px;
        border-radius: 999px;
        background: rgba(255, 118, 40, .12);
        color: var(--lz-chat-orange);
        font-weight: 950;
        white-space: nowrap;
      }

      .lz-chat-mention.is-me {
        background: var(--lz-chat-orange);
        color: #fff;
      }

      .lz-chat-reply-card {
        display: grid;
        gap: 2px;
        margin-top: 6px;
        padding: 7px 8px;
        border-left: 3px solid var(--lz-chat-orange);
        border-radius: 8px;
        background: rgba(255, 118, 40, .08);
        color: var(--lz-chat-muted);
        font: 760 11px/1.25 Inter, Arial, sans-serif;
        animation: lzOverlayReplyIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .lz-chat-reply-card b {
        color: var(--lz-chat-orange);
      }

      .lz-chat-new-message-indicator,
      .lz-chat-typing-indicator {
        width: fit-content;
        margin: 0 auto 8px;
        border: 1px solid rgba(255, 118, 40, .32);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 253, 250, .96);
        color: var(--lz-chat-orange);
        box-shadow: 0 10px 22px rgba(71, 54, 40, .12);
        font: 900 11px/1 Inter, Arial, sans-serif;
      }

      .lz-chat-status-rail {
        position: absolute;
        left: 12px;
        bottom: calc(100% + 8px);
        z-index: 4;
        max-width: calc(100% - 24px);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        pointer-events: none;
      }

      .lz-chat-status-rail > * {
        pointer-events: auto;
      }

      .lz-chat-status-rail .lz-chat-new-message-indicator,
      .lz-chat-status-rail .lz-chat-typing-indicator {
        flex: 0 0 auto;
        margin: 0;
      }

      .lz-chat-new-message-indicator {
        min-height: 30px;
        padding: 0 11px;
        cursor: pointer;
        animation: lzOverlayPillIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .lz-chat-new-message-indicator[hidden],
      .lz-chat-typing-indicator[hidden] {
        display: none;
      }

      .lz-chat-new-message-indicator span {
        display: grid;
        width: 18px;
        height: 18px;
        place-items: center;
        border-radius: 999px;
        background: var(--lz-chat-orange);
        color: #fff;
      }

      .lz-chat-typing-indicator {
        min-height: 24px;
        margin: 8px 12px 0;
        padding: 0 9px;
        color: var(--lz-chat-muted);
        animation: lzOverlayPillIn 170ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .lz-chat-typing-indicator i {
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: var(--lz-chat-orange);
        opacity: .45;
        animation: lzOverlayTypingDot 230ms cubic-bezier(0.2, 0.8, 0.2, 1) infinite alternate;
      }

      .lz-chat-typing-indicator i:nth-child(3) {
        animation-delay: 70ms;
      }

      .lz-chat-typing-indicator i:nth-child(4) {
        animation-delay: 140ms;
      }

      .lz-chat-poll {
        display: grid;
        gap: 7px;
        margin-top: 8px;
      }

      .lz-chat-poll button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 30px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 7px;
        background: #fff;
        color: var(--lz-chat-text);
        font: 750 11px/1 Inter, Arial, sans-serif;
      }

      .lz-chat-poll button.active {
        border-color: var(--lz-chat-orange);
        color: var(--lz-chat-orange);
        background: #fff3ea;
      }

      .lz-chat-right-composer {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 40px;
        min-height: 64px;
        align-self: end;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid var(--lz-chat-border);
        background: rgba(255, 255, 255, .96);
      }

      .lz-chat-right-composer > .lz-chat-message-input {
        height: 40px;
        min-height: 40px;
        max-height: 40px;
        align-self: center;
      }

      .lz-chat-send-status {
        position: absolute;
        right: 12px;
        bottom: calc(100% + 8px);
        z-index: 3;
        max-width: calc(100% - 24px);
        min-height: 0;
        margin: 0;
        padding: 7px 10px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 8px;
        background: var(--lz-chat-surface);
        color: var(--lz-chat-muted);
        box-shadow: 0 10px 26px rgba(45, 31, 20, 0.13);
        font: 800 11px/1.25 Inter, Arial, sans-serif;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translate3d(0, 4px, 0);
        transition:
          opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
          transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
          visibility 180ms linear;
      }

      .lz-chat-send-status.is-visible {
        opacity: 1;
        visibility: visible;
        transform: translate3d(0, 0, 0);
      }

      .lz-chat-send {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 8px 18px rgba(255, 118, 40, 0.18);
        cursor: pointer;
        transition: transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1), background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-chat-send:hover {
        background: var(--lz-chat-orange-hover);
        box-shadow: 0 10px 22px rgba(237, 100, 24, 0.22);
        transform: translateY(-1px);
      }

      .lz-chat-send:disabled {
        cursor: wait;
        opacity: .65;
        transform: none;
      }

      .lz-chat-send svg {
        width: 18px;
        height: 18px;
        stroke-width: 2.25;
        transform: translateX(1px);
      }

      @keyframes lzOverlayMessageIn {
        from {
          opacity: 0;
          transform: translate3d(0, 9px, 0) scale(.988);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }

      @keyframes lzOverlayReplyIn {
        from {
          opacity: 0;
          transform: translate3d(4px, 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes lzOverlayPillIn {
        from {
          opacity: 0;
          transform: translate3d(0, 6px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes lzOverlayTypingDot {
        from {
          opacity: .42;
          transform: translate3d(0, 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, -2px, 0);
        }
      }

      @media (hover: none) {
        .lz-chat-message-actions {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }

        .lz-chat-message-meta time {
          opacity: 0;
        }
      }

      .lz-chat-dock {
        position: absolute;
        left: 304px;
        right: 346px;
        bottom: 16px;
        min-height: 56px;
        pointer-events: auto;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.52), transparent),
          rgba(255, 255, 255, 0.96);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.76) inset, 0 14px 38px rgba(71, 54, 40, 0.11), 0 18px 48px rgba(237, 100, 24, 0.06);
      }

      .lz-chat-overlay .lz-chat-dock {
        display: none !important;
      }

      .lz-chat-dock-title {
        color: var(--lz-chat-text);
        font: 950 14px/1 Inter, Arial, sans-serif;
        white-space: nowrap;
      }

      .lz-chat-dock-members {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        overflow: hidden;
      }

      .lz-chat-overflow-chip {
        min-width: 44px;
        max-width: 102px;
        height: 30px;
        padding: 0 10px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        background: #e5e1dc;
        color: #6e665f;
        font: 900 11px/1 Inter, Arial, sans-serif;
        white-space: nowrap;
      }

      .lz-chat-dock .lz-chat-outline {
        min-height: 34px;
        padding: 0 12px;
      }

      .lz-spectate-toast-stack,
      .lz-spectate-request-stack {
        position: fixed;
        right: 18px;
        z-index: 2147483602;
        display: grid;
        gap: 10px;
        width: min(340px, calc(100vw - 28px));
        pointer-events: none;
      }

      .lz-spectate-toast-stack {
        top: calc(var(--lz-chat-overlay-top, 74px) + 14px);
      }

      .lz-spectate-request-stack {
        top: calc(var(--lz-chat-overlay-top, 74px) + 70px);
      }

      .lz-spectate-toast,
      .lz-spectate-request-card {
        border: 1px solid rgba(255, 118, 40, .28);
        border-radius: 12px;
        background: var(--lz-chat-surface);
        color: var(--lz-chat-text);
        box-shadow: 0 16px 42px rgba(71, 54, 40, .14);
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 190ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
        pointer-events: auto;
      }

      .lz-spectate-toast {
        padding: 12px 14px;
        font: 850 12px/1.35 Inter, Arial, sans-serif;
      }

      .lz-spectate-toast.is-visible,
      .lz-spectate-request-card {
        opacity: 1;
        transform: translateY(0);
      }

      .lz-spectate-request-card {
        display: grid;
        gap: 10px;
        padding: 14px;
      }

      .lz-spectate-request-card strong {
        color: var(--lz-chat-text);
        font: 950 14px/1.2 Inter, Arial, sans-serif;
      }

      .lz-spectate-request-card p {
        margin: 0;
        color: var(--lz-chat-muted);
        font: 650 12px/1.4 Inter, Arial, sans-serif;
      }

      .lz-spectate-request-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .lz-spectator-view {
        position: fixed;
        inset: 0;
        z-index: 2147483601;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: #101010;
      }

      .lz-spectator-topbar {
        min-height: 54px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background: var(--lz-chat-surface);
        border-bottom: 1px solid var(--lz-chat-border);
        color: var(--lz-chat-text);
        box-shadow: 0 8px 22px rgba(0,0,0,.12);
      }

      .lz-spectator-topbar strong {
        font: 950 14px/1 Inter, Arial, sans-serif;
        white-space: nowrap;
      }

      .lz-spectator-topbar span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--lz-chat-muted);
        font: 750 12px/1 Inter, Arial, sans-serif;
      }

      .lz-spectator-frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #000;
      }

      .lz-spectator-input-blocker {
        position: absolute;
        inset: 54px 0 0;
        cursor: not-allowed;
        background: transparent;
      }

      body.lz-spectating-active {
        overflow: hidden !important;
      }

      @media (max-width: 1180px) {
        .lz-chat-hero {
          display: none;
        }

        .lz-chat-dock {
          left: 20px;
          right: 20px;
        }
      }

      @media (max-width: 860px) {
        .lz-chat-panel {
          top: 10px;
          bottom: 74px;
          width: min(320px, calc(100vw - 34px));
        }

        .lz-chat-left {
          left: 12px;
          display: none;
        }

        .lz-chat-right {
          display: grid;
          top: 10px;
          right: 12px;
        }

        .lz-chat-overlay.is-tools-open .lz-chat-left {
          display: block;
        }

        .lz-chat-overlay.is-tools-open .lz-chat-right {
          display: none;
        }

        .lz-chat-mobile-panel-toggle {
          display: inline-grid;
        }

        .lz-chat-dock {
          left: 12px;
          right: 12px;
          bottom: 12px;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .lz-chat-dock .lz-chat-outline {
          display: none;
        }
      }

      .lz-site-profile-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        max-width: 190px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.88);
        color: var(--lz-chat-text);
        padding: 4px 10px 4px 5px;
        font: 850 13px/1 Inter, Arial, sans-serif;
        box-shadow: 0 8px 20px rgba(71, 54, 40, 0.06);
        cursor: pointer;
      }

      .lz-site-profile-button:hover {
        border-color: var(--lz-chat-orange);
        color: var(--lz-chat-orange);
        background: #fff;
      }

      .lz-streak-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-height: 32px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: #fff8f1;
        color: var(--lz-chat-text);
        padding: 0 10px;
        font: 850 12px/1 Inter, Arial, sans-serif;
        white-space: nowrap;
        box-shadow: 0 8px 20px rgba(71, 54, 40, 0.05);
      }

      .lz-streak-chip strong {
        color: var(--lz-chat-orange);
        font: inherit;
      }

      .lz-streak-toast {
        position: fixed;
        right: 22px;
        top: calc(var(--lz-chat-overlay-top, 76px) + 16px);
        z-index: 2147483647;
        min-width: 240px;
        max-width: min(360px, calc(100vw - 32px));
        border: 1px solid rgba(255, 118, 40, 0.24);
        border-radius: 14px;
        background: #fff;
        color: var(--lz-chat-text);
        padding: 14px 16px;
        box-shadow: var(--lz-chat-shadow);
        opacity: 0;
        transform: translateY(-8px);
        pointer-events: none;
        transition: opacity 190ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
        font: 750 13px/1.35 Inter, Arial, sans-serif;
      }

      .lz-streak-toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }

      .lz-streak-toast strong,
      .lz-streak-toast span {
        display: block;
      }

      .lz-streak-toast strong {
        color: var(--lz-chat-orange);
        margin-bottom: 3px;
      }

      .lz-whats-happening-card {
        position: fixed;
        right: 22px;
        top: calc(var(--lz-chat-overlay-top, 76px) + 16px);
        z-index: 2147483598;
        width: min(330px, calc(100vw - 32px));
        border: 1px solid var(--lz-chat-border);
        border-radius: 16px;
        background: var(--lz-chat-surface);
        color: var(--lz-chat-text);
        box-shadow: var(--lz-chat-shadow);
        padding: 14px;
        opacity: 0;
        transform: translateY(-8px);
        pointer-events: none;
        transition: opacity 190ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
        font-family: Inter, Arial, sans-serif;
      }

      .lz-whats-happening-card.is-visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .lz-whats-happening-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }

      .lz-whats-happening-title {
        color: var(--lz-chat-text);
        font: 950 15px/1.2 Inter, Arial, sans-serif;
      }

      .lz-whats-happening-close {
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: var(--lz-chat-surface-soft);
        color: var(--lz-chat-muted);
        cursor: pointer;
        font: 950 16px/1 Inter, Arial, sans-serif;
      }

      .lz-whats-happening-close:hover {
        color: var(--lz-chat-orange);
        border-color: var(--lz-chat-orange);
        background: var(--lz-chat-orange-soft);
      }

      .lz-whats-happening-list {
        display: grid;
        gap: 8px;
      }

      .lz-whats-happening-row {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        gap: 9px;
        align-items: center;
        min-height: 36px;
        border: 1px solid var(--lz-chat-border-light);
        border-radius: 10px;
        background: var(--lz-chat-surface-warm);
        padding: 7px 9px;
        color: var(--lz-chat-text);
        font: 850 13px/1.25 Inter, Arial, sans-serif;
      }

      .lz-whats-happening-row span:first-child {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border-radius: 9px;
        background: rgba(255, 118, 40, .11);
      }

      .lz-whats-happening-row strong {
        font: 950 13px/1.25 Inter, Arial, sans-serif;
      }

      html[data-lz-color-mode="dark"] .lz-whats-happening-card,
      html[data-lz-color-mode="dark"] .lz-whats-happening-row,
      html[data-lz-color-mode="dark"] .lz-whats-happening-close {
        background: var(--lz-chat-surface);
      }

      @media (max-width: 720px) {
        .lz-whats-happening-card {
          left: 14px;
          right: 14px;
          top: calc(var(--lz-chat-overlay-top, 66px) + 10px);
          width: auto;
        }
      }

      .lz-site-profile-existing {
        cursor: pointer;
        border-radius: 999px;
        padding: 4px 7px;
        transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1), color 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .lz-site-profile-existing:hover {
        background: #fff3ea;
        color: var(--lz-chat-orange) !important;
      }

      .lz-site-profile-button:focus-visible,
      .lz-site-profile-close:focus-visible,
      .lz-site-profile-action:focus-visible,
      .lz-site-profile-field input:focus-visible,
      .lz-site-profile-field textarea:focus-visible,
      .lz-site-profile-field select:focus-visible {
        outline: 3px solid rgba(255, 118, 40, 0.22);
        outline-offset: 2px;
      }

      .lz-site-profile-button-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lz-site-profile-avatar {
        width: 28px;
        height: 28px;
        flex: 0 0 28px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #de6f2d;
        color: #21130a;
        font: 900 11px/1 Inter, Arial, sans-serif;
        box-shadow: 0 0 0 2px #fff;
      }

      .lz-site-profile-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .lz-site-profile-avatar.controller {
        position: relative;
        background: var(--lz-chat-orange);
        color: #fff;
        box-shadow: 0 0 0 2px #fff, 0 6px 14px rgba(255, 118, 40, 0.2);
      }

      .lz-site-profile-avatar.controller svg {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 56%;
        height: 56%;
        transform: translate(-50%, -50%);
        display: block;
        stroke-width: 2.35;
      }

      .lz-site-profile-avatar.large {
        width: 82px;
        height: 82px;
        flex-basis: 82px;
        margin-top: -45px;
        font-size: 24px;
        box-shadow: 0 0 0 5px #fff, 0 10px 28px rgba(71, 54, 40, 0.12);
      }

      .lz-site-profile-avatar.large.controller svg {
        width: 44%;
        height: 44%;
      }

      .lz-site-profile-scrim {
        position: fixed;
        inset: 0;
        z-index: 100080;
        display: none;
        place-items: center;
        padding: 20px;
        background: rgba(25, 20, 16, 0.28);
      }

      .lz-site-profile-scrim.is-open {
        display: grid;
      }

      .lz-site-profile-card {
        position: relative;
        width: min(560px, calc(100vw - 28px));
        max-height: min(720px, calc(100vh - 36px));
        overflow: auto;
        border: 1px solid var(--lz-chat-border);
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 24px 80px rgba(71, 54, 40, 0.22);
        color: var(--lz-chat-text);
        font-family: Inter, Arial, sans-serif;
      }

      .lz-site-profile-banner {
        min-height: 132px;
        border-radius: 16px 16px 0 0;
        background: var(--lz-site-profile-banner, #2d3039);
        background-position: center;
        background-size: cover;
      }

      .lz-site-profile-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        border: 1px solid rgba(255, 255, 255, 0.68);
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.9);
        color: var(--lz-chat-text);
        cursor: pointer;
      }

      .lz-site-profile-body {
        padding: 0 20px 20px;
      }

      .lz-site-profile-title {
        display: flex;
        align-items: end;
        gap: 14px;
        min-width: 0;
      }

      .lz-site-profile-title h2 {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--lz-site-profile-name, var(--lz-chat-orange));
        font: 900 var(--lz-site-profile-size, 19px)/1.12 var(--lz-site-profile-font, Inter, Arial, sans-serif);
      }

      .lz-site-profile-title span {
        display: block;
        margin-top: 4px;
        color: var(--lz-chat-muted);
        font: 800 11px/1.2 Inter, Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: .02em;
      }

      .lz-site-profile-bio {
        margin: 16px 0 0;
        color: var(--lz-site-profile-text, var(--lz-chat-muted));
        font: 550 var(--lz-site-profile-body-size, 14px)/1.45 var(--lz-site-profile-font, Inter, Arial, sans-serif);
      }

      .lz-site-profile-meta,
      .lz-site-profile-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .lz-site-profile-pill {
        display: inline-flex;
        align-items: center;
        min-height: 27px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 999px;
        background: #fff8f1;
        color: var(--lz-chat-text);
        padding: 0 10px;
        font: 800 11px/1 Inter, Arial, sans-serif;
      }

      .lz-site-profile-pill.badge {
        background: #fff;
        color: var(--lz-chat-orange);
      }

      .lz-site-profile-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }

      .lz-site-profile-stat {
        border: 1px solid var(--lz-chat-border);
        border-radius: 12px;
        background: #fff;
        padding: 10px;
        min-width: 0;
      }

      .lz-site-profile-stat strong,
      .lz-site-profile-stat span {
        display: block;
      }

      .lz-site-profile-stat strong {
        color: var(--lz-chat-text);
        font: 900 16px/1.1 Inter, Arial, sans-serif;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .lz-site-profile-stat span {
        color: var(--lz-chat-muted);
        font: 850 10px/1.1 Inter, Arial, sans-serif;
        margin-top: 5px;
        text-transform: uppercase;
        letter-spacing: .02em;
      }

      .lz-site-profile-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 20px;
      }

      .lz-site-profile-action {
        min-height: 40px;
        border: 1px solid var(--lz-chat-border);
        border-radius: 10px;
        background: #fff;
        color: var(--lz-chat-text);
        font: 850 13px/1 Inter, Arial, sans-serif;
        cursor: pointer;
      }

      .lz-site-profile-action.primary {
        border-color: var(--lz-chat-orange);
        background: var(--lz-chat-orange);
        color: #fff;
      }

      .lz-site-profile-action:hover {
        border-color: var(--lz-chat-orange);
        color: var(--lz-chat-orange);
      }

      .lz-site-profile-action.primary:hover {
        background: var(--lz-chat-orange-hover);
        color: #fff;
      }

      .lz-site-profile-edit {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--lz-chat-border);
      }

      .lz-site-profile-edit-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .lz-site-profile-edit-head strong {
        display: block;
        color: var(--lz-chat-text);
        font: 900 14px/1.1 Inter, Arial, sans-serif;
      }

      .lz-site-profile-edit-head span {
        display: block;
        margin-top: 3px;
        color: var(--lz-chat-muted);
        font: 750 11px/1.2 Inter, Arial, sans-serif;
      }

      .lz-site-profile-form {
        display: grid;
        gap: 12px;
      }

      .lz-site-profile-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .lz-site-profile-field {
        display: grid;
        gap: 6px;
        min-width: 0;
        color: var(--lz-chat-muted);
        font: 850 11px/1.1 Inter, Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: .02em;
      }

      .lz-site-profile-field input,
      .lz-site-profile-field textarea,
      .lz-site-profile-field select {
        width: 100%;
        min-width: 0;
        border: 1px solid var(--lz-chat-border);
        border-radius: 10px;
        background: #fff;
        color: var(--lz-chat-text);
        padding: 10px 11px;
        font: 750 13px/1.25 Inter, Arial, sans-serif;
        text-transform: none;
        letter-spacing: 0;
      }

      .lz-site-profile-field textarea {
        min-height: 74px;
        resize: vertical;
      }

      .lz-site-profile-color-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .lz-site-profile-color-row input[type="color"] {
        height: 42px;
        padding: 0;
        overflow: hidden;
        cursor: pointer;
        background: transparent;
      }

      .lz-site-profile-color-row input[type="color"]::-webkit-color-swatch-wrapper {
        padding: 4px;
      }

      .lz-site-profile-color-row input[type="color"]::-webkit-color-swatch {
        border: 0;
        border-radius: 7px;
      }

      .lz-site-profile-color-row input[type="color"]::-moz-color-swatch {
        border: 0;
        border-radius: 7px;
      }

      .lz-site-profile-file {
        min-height: 42px;
        border: 1px dashed var(--lz-chat-border);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        background: #fff8f1;
        color: var(--lz-chat-orange);
        cursor: pointer;
        text-transform: none;
      }

      .lz-site-profile-file input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .lz-site-profile-status {
        min-height: 18px;
        color: var(--lz-chat-muted);
        font: 800 12px/1.3 Inter, Arial, sans-serif;
      }

      .lz-site-profile-status.ok {
        color: #18864b;
      }

      .lz-site-profile-status.error {
        color: #d95a48;
      }

      @media (max-width: 760px) {
        .lz-site-profile-button {
          max-width: 46px;
          padding-right: 5px;
        }

        .lz-site-profile-button-text {
          display: none;
        }

        .lz-site-profile-actions {
          grid-template-columns: 1fr;
        }

        .lz-site-profile-form-grid,
        .lz-site-profile-color-row,
        .lz-site-profile-stats {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function chatIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="message-square" class="lucide lucide-message-square" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  }

  function miniIcon(name) {
    const icons = {
      plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
      users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6"></path><path d="M22 11h-6"></path></svg>',
      music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
      poll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>',
      mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path></svg>',
      speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4Z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path></svg>',
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
      popout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>',
      gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M9.7 2.7 9.2 5a7.8 7.8 0 0 0-1.6.9L5.4 5 3 9.1l1.8 1.5a8.7 8.7 0 0 0 0 1.8L3 13.9 5.4 18l2.2-.9a7.8 7.8 0 0 0 1.6.9l.5 2.3h4.8l.5-2.3a7.8 7.8 0 0 0 1.6-.9l2.2.9 2.4-4.1-1.8-1.5a8.7 8.7 0 0 0 0-1.8l1.8-1.5L18.6 5l-2.2.9a7.8 7.8 0 0 0-1.6-.9l-.5-2.3Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 22a10 10 0 1 1 10-10 4 4 0 0 1-4 4h-1.5a2 2 0 0 0-1.8 2.9l.3.6A1.8 1.8 0 0 1 13.4 22Z"></path></svg>',
      layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 17 9 5 9-5"></path></svg>',
      cursor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 7.6 16 2.1-6.3L20 11.6Z"></path></svg>',
      tab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>',
      image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L5 21"></path></svg>',
      ad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M8 14v-4"></path><path d="M8 10h2a2 2 0 0 1 0 4H8"></path><path d="M14 14v-4h1.5a2 2 0 0 1 0 4Z"></path></svg>',
      database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path></svg>',
      download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>',
      upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"></path><path d="m17 14-5-5-5 5"></path><path d="M5 3h14"></path></svg>',
      refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M3 12A9 9 0 0 1 18.5 5.8"></path><path d="M18 2v4h4"></path><path d="M6 22v-4H2"></path></svg>',
      monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"></path></svg>'
    };
    return icons[name] || chatIcon();
  }

  function matrixRainMarkup() {
    const columns = 36;
    return Array.from({ length: columns }, (_, index) => {
      const left = (index * 100) / columns;
      const delay = -((index * 1.7) % 15).toFixed(1);
      const duration = 13 + (index % 7) * 1.8;
      const seed = String((index * 2654435761) >>> 0);
      const chars = Array.from({ length: 56 }, (__, charIndex) => ((seed.charCodeAt(charIndex % seed.length) + charIndex + index) % 2 ? "1" : "0")).join("");
      return `<span style="left:${left.toFixed(2)}%;animation-delay:${delay}s;animation-duration:${duration.toFixed(1)}s">${chars}</span>`;
    }).join("");
  }

  function settingsStarMarkup(count = 64) {
    return Array.from({ length: count }, (_, index) => {
      const left = (index * 37 + 11) % 100;
      const top = (index * 53 + 17) % 100;
      const size = 2 + (index % 3);
      const delay = -((index * 0.37) % 4).toFixed(2);
      return `<span style="left:${left}%;top:${top}%;--lz-star-size:${size}px;animation-delay:${delay}s"></span>`;
    }).join("");
  }

  function settingsBackdropMarkup(background) {
    const mode = normalizeSiteBackground(background);
    if (mode === "matrix") {
      return `<div class="lz-settings-rain is-matrix" aria-hidden="true">${matrixRainMarkup()}</div>`;
    }
    if (mode === "topography") {
      return '<div class="lz-settings-rain is-topography" aria-hidden="true"></div>';
    }
    if (mode === "circuit") {
      return `<div class="lz-settings-rain is-circuit" aria-hidden="true">${settingsStarMarkup(42)}</div>`;
    }
    if (mode === "aurora") {
      return `<div class="lz-settings-rain is-aurora" aria-hidden="true">${settingsStarMarkup(32)}</div>`;
    }
    return `<div class="lz-settings-rain is-${mode}" aria-hidden="true">${settingsStarMarkup(mode === "constellation" ? 72 : 108)}</div>`;
  }

  function settingsThemePalette(theme = siteThemePreference()) {
    const normalized = normalizeSiteTheme(theme);
    const presets = {
      ember: { accent: "#d99a35", strong: "#f2b64c", bg: "#090704", panel: "rgba(17, 12, 7, 0.9)", panel2: "rgba(24, 17, 10, 0.88)" },
      ocean: { accent: "#4fa3d1", strong: "#8bd7ff", bg: "#051018", panel: "rgba(7, 19, 28, 0.91)", panel2: "rgba(10, 28, 40, 0.88)" },
      berry: { accent: "#c62ba0", strong: "#ff8bd7", bg: "#120711", panel: "rgba(27, 10, 25, 0.91)", panel2: "rgba(36, 12, 33, 0.88)" },
      lime: { accent: "#5dcc47", strong: "#b6f57a", bg: "#071006", panel: "rgba(10, 24, 9, 0.91)", panel2: "rgba(13, 33, 11, 0.88)" },
      purple: { accent: "#8e64a5", strong: "#d7b5ee", bg: "#0c0910", panel: "rgba(19, 13, 24, 0.92)", panel2: "rgba(26, 18, 33, 0.9)" },
      custom: { accent: settingsThemeAccent(normalized), strong: readableAccentColor(settingsThemeAccent(normalized), "dark"), bg: "#090b10", panel: "rgba(12, 14, 20, 0.92)", panel2: "rgba(17, 19, 28, 0.9)" }
    };
    const palette = { ...(presets[normalized.value] || presets[normalized.theme] || presets.ember) };
    if (normalized.value === "custom") {
      palette.accent = safeColor(normalized.accent, palette.accent);
      const rgb = hexToRgb(palette.accent);
      const bg = hexToRgb(palette.bg);
      palette.strong = rgb && bg && contrastRatio(rgb, bg) >= 3 ? palette.accent : "#f7f1eb";
    }
    const accentRgb = hexToRgb(palette.accent) || { r: 217, g: 154, b: 53 };
    const bgRgb = hexToRgb(palette.bg) || { r: 9, g: 7, b: 4 };
    return {
      ...palette,
      accentRgb: `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
      bgRgb: `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`,
      line: `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.28)`,
      lineStrong: `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.52)`,
      text: "#fff7e9",
      muted: "rgba(245, 235, 220, 0.72)"
    };
  }

  function applySettingsThemeVars(target = document.getElementById("lz-site-settings-page"), theme = siteThemePreference()) {
    const palette = settingsThemePalette(theme);
    [document.documentElement, target].filter(Boolean).forEach(node => {
      node.style.setProperty("--lz-settings-accent", palette.accent);
      node.style.setProperty("--lz-settings-accent-strong", palette.strong);
      node.style.setProperty("--lz-settings-accent-rgb", palette.accentRgb);
      node.style.setProperty("--lz-settings-bg", palette.bg);
      node.style.setProperty("--lz-settings-bg-rgb", palette.bgRgb);
      node.style.setProperty("--lz-settings-panel", palette.panel);
      node.style.setProperty("--lz-settings-panel-2", palette.panel2);
      node.style.setProperty("--lz-settings-line", palette.line);
      node.style.setProperty("--lz-settings-line-strong", palette.lineStrong);
      node.style.setProperty("--lz-settings-text", palette.text);
      node.style.setProperty("--lz-settings-muted", palette.muted);
    });
    if (target) {
      target.dataset.lzSettingsTheme = normalizeSiteTheme(theme).value;
      target.dataset.lzSettingsColorMode = normalizeSiteTheme(theme).colorMode;
    }
    return palette;
  }

  function settingsStatus(message) {
    const status = document.querySelector("[data-lz-settings-status]");
    siteSettingsStatusMessage = message || "";
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-visible", !!message);
    clearTimeout(siteSettingsStatusTimer);
    siteSettingsStatusTimer = setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
        status.classList.remove("is-visible");
        if (siteSettingsStatusMessage === message) siteSettingsStatusMessage = "";
      }
    }, 2600);
  }

  function settingsThemeSwatches(theme) {
    const activeValue = theme.value === "custom" ? "custom" : theme.value;
    return SITE_THEME_SWATCHES.map(item => {
      const value = item.alias || item.value;
      const active = activeValue === item.value;
      return `<button type="button" class="lz-settings-swatch${active ? " active" : ""}" style="--lz-swatch:${escapeHtml(item.color)}" data-lz-settings-theme="${escapeHtml(value)}" aria-label="${escapeHtml(item.label)} theme" aria-pressed="${active ? "true" : "false"}"><span aria-hidden="true"></span><em>${escapeHtml(item.label)}</em></button>`;
    }).join("");
  }

  function settingsSegmentMarkup(name, options, active) {
    return `<div class="lz-settings-segment" data-lz-settings-segment="${escapeHtml(name)}">
      ${options.map(option => `<button type="button" data-lz-settings-value="${escapeHtml(option.value)}" class="${option.value === active ? "active" : ""}" aria-pressed="${option.value === active ? "true" : "false"}">${escapeHtml(option.label)}</button>`).join("")}
    </div>`;
  }

  function settingsThemeAccent(theme) {
    if (theme.value === "custom") return safeColor(theme.accent, "#bf8428");
    const swatch = SITE_THEME_SWATCHES.find(item => item.value === theme.value || item.alias === theme.value);
    return safeColor(swatch?.color, "#bf8428");
  }

  function settingsOptionLabel(value, options, fallback = "") {
    const match = (options || []).find(option => option.value === value);
    return match?.label || fallback || displayName(value);
  }

  function settingsSectionHeader(iconName, title, copy) {
    return `<div class="lz-settings-section-head">
      <div>${miniIcon(iconName)}<span>${escapeHtml(title)}</span></div>
      <p>${escapeHtml(copy)}</p>
    </div>`;
  }

  function settingsPreviewMarkup(settings, theme, previewColor, logoPreview, snapshot, linkState) {
    const backgroundLabel = siteBackgroundLabel(settings.background);
    const cursorLabel = settingsOptionLabel(settings.cursor, [
      { value: "ring", label: "Ring" },
      { value: "dot", label: "Dot" },
      { value: "crosshair", label: "Crosshair" },
      { value: "default", label: "Default" }
    ], "Ring");
    const performanceLabel = settingsOptionLabel(settings.performanceMode, [
      { value: "auto", label: "Auto" },
      { value: "standard", label: "Standard" },
      { value: "low", label: "Low Power" }
    ], "Auto");
    const accountName = snapshot.username || "Guest";
    const accountMode = linkState.mode === "chat" ? "Chat login" : "Site login";
    const tabIcon = settings.inactiveIcon ? `<img alt="" src="${escapeHtml(settings.inactiveIcon)}">` : miniIcon("tab");
    return `
      <aside class="lz-settings-sidebar" aria-label="Settings preview">
        <section class="lz-settings-preview-card" style="--lz-preview-accent:${escapeHtml(previewColor)}" data-lz-settings-preview>
          <div class="lz-settings-preview-kicker">Live Preview</div>
          <div class="lz-settings-preview-window">
            <div class="lz-settings-preview-bar">
              <span></span><span></span><span></span>
            </div>
            <div class="lz-settings-preview-main">
              <div class="lz-settings-preview-logo">${logoPreview}</div>
              <div>
                <strong>Learning Zones</strong>
                <small>${escapeHtml(theme.label || displayName(theme.value))} theme</small>
              </div>
            </div>
            <div class="lz-settings-preview-tabs">
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="lz-settings-preview-tab">
            <span data-lz-tab-preview-icon>${tabIcon}</span>
            <strong data-lz-tab-preview-title>${escapeHtml(settings.inactiveTitle || "Home")}</strong>
          </div>
          <dl class="lz-settings-preview-list">
            <div><dt>Background</dt><dd data-lz-preview-background>${escapeHtml(backgroundLabel)}</dd></div>
            <div><dt>Cursor</dt><dd data-lz-preview-cursor>${escapeHtml(cursorLabel)}</dd></div>
            <div><dt>Performance</dt><dd data-lz-preview-performance>${escapeHtml(performanceLabel)}${settings.reduceMotion ? " + reduced motion" : ""}</dd></div>
            <div><dt>Account</dt><dd>${escapeHtml(accountName)} - ${escapeHtml(accountMode)}</dd></div>
          </dl>
        </section>
        <nav class="lz-settings-sidebar-nav" aria-label="Settings sections">
          <a href="#settings-appearance">Appearance</a>
          <a href="#settings-behavior">Behavior</a>
          <a href="#settings-data">Data & Account</a>
        </nav>
      </aside>
    `;
  }

  function updateSettingsLivePreview(page) {
    if (!page) return;
    const preview = page.querySelector("[data-lz-settings-preview]");
    const colorInput = page.querySelector("[data-lz-settings-custom-color]");
    const accent = safeColor(colorInput?.value, settingsThemeAccent(siteThemePreference()));
    if (preview) preview.style.setProperty("--lz-preview-accent", accent);

    const titleInput = page.querySelector('[data-lz-settings-input="inactiveTitle"]');
    const tabTitle = page.querySelector("[data-lz-tab-preview-title]");
    if (titleInput && tabTitle) tabTitle.textContent = titleInput.value.trim() || "Home";

    const iconInput = page.querySelector('[data-lz-settings-input="inactiveIcon"]');
    const tabIcon = page.querySelector("[data-lz-tab-preview-icon]");
    if (iconInput && tabIcon) {
      const src = safeDataImage(iconInput.value);
      tabIcon.innerHTML = src ? `<img alt="" src="${escapeHtml(src)}">` : miniIcon("tab");
    }
  }

  function siteSettingsMarkup() {
    const settings = siteSettings();
    const theme = siteThemePreference();
    const snapshot = profileSnapshot();
    const linkState = accountLinkState();
    const previewAccent = settingsThemeAccent(theme);
    const currentThemeColor = safeColor(previewAccent, "#bf8428");
    const logoPreview = settings.logoData
      ? `<img alt="" src="${escapeHtml(settings.logoData)}">`
      : miniIcon("image");
    return `
      ${settingsBackdropMarkup(settings.background)}
      <div class="lz-settings-shell">
        <header class="lz-settings-top">
          <div class="lz-settings-title">
            ${miniIcon("gear")}
            <span>Settings</span>
          <small>Preferences sync to this device instantly.</small>
          </div>
          <div class="lz-settings-top-actions">
            <a class="lz-settings-back" href="/" data-lz-settings-home>Library</a>
          </div>
        </header>

        <div class="lz-settings-layout">
          ${settingsPreviewMarkup(settings, theme, previewAccent, logoPreview, snapshot, linkState)}

          <div class="lz-settings-content">
            <section class="lz-settings-section" id="settings-appearance">
              ${settingsSectionHeader("palette", "Appearance", "Theme, background, cursor, logo, and tab camouflage.")}
              <div class="lz-settings-grid">
                <section class="lz-settings-card is-wide lz-settings-theme-card">
                  <h2 class="lz-settings-card-title">${miniIcon("palette")} Theme Color <span class="lz-settings-state-pill">${escapeHtml(theme.label || displayName(theme.value))}</span></h2>
                  <p class="lz-settings-copy">Choose a preset theme or create a custom accent.</p>
                  <div class="lz-settings-row lz-settings-swatch-row">
                    ${settingsThemeSwatches(theme)}
                    <button type="button" class="lz-settings-custom${theme.value === "custom" ? " active" : ""}" data-lz-settings-custom-theme aria-label="Open custom color picker">${miniIcon("plus")}<span>Custom</span></button>
                    <label class="lz-settings-color-picker${theme.value === "custom" ? " active" : ""}">
                      <span>Accent</span>
                      <input class="lz-settings-color-input" type="color" value="${escapeHtml(currentThemeColor)}" data-lz-settings-custom-color aria-label="Custom accent color">
                    </label>
                  </div>
                </section>

                <section class="lz-settings-card">
                  <h2 class="lz-settings-card-title">${miniIcon("monitor")} Color Mode <span class="lz-settings-state-pill">${theme.colorMode === "dark" ? "Dark" : "Light"}</span></h2>
                  <p class="lz-settings-copy">Switch light or dark surfaces without changing the selected accent color.</p>
                  ${settingsSegmentMarkup("colorMode", [
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" }
                  ], theme.colorMode)}
                </section>

                <section class="lz-settings-card is-wide">
                  <h2 class="lz-settings-card-title">${miniIcon("layers")} Background <span class="lz-settings-state-pill">${escapeHtml(siteBackgroundLabel(settings.background))}</span></h2>
                  <p class="lz-settings-copy">Select the animated background style that syncs across every page.</p>
                  ${settingsSegmentMarkup("background", SITE_BACKGROUND_OPTIONS, settings.background)}
                </section>

                <section class="lz-settings-card">
                  <h2 class="lz-settings-card-title">${miniIcon("cursor")} Custom Cursor</h2>
                  <p class="lz-settings-copy">Choose your cursor style.</p>
                  <label class="lz-settings-field">
                    <span>Cursor</span>
                    <select data-lz-settings-select="cursor">
                      ${[
                        ["ring", "Ring"],
                        ["dot", "Dot"],
                        ["crosshair", "Crosshair"],
                        ["default", "Default"]
                      ].map(([value, label]) => `<option value="${value}"${settings.cursor === value ? " selected" : ""}>${label}</option>`).join("")}
                    </select>
                  </label>
                </section>

                <section class="lz-settings-card">
                  <h2 class="lz-settings-card-title">${miniIcon("tab")} Inactive Tab</h2>
                  <p class="lz-settings-copy">Set what appears when this tab is inactive.</p>
                  <label class="lz-settings-field">
                    <span>Title</span>
                    <input type="text" value="${escapeHtml(settings.inactiveTitle)}" data-lz-settings-input="inactiveTitle" maxlength="80">
                  </label>
                  <label class="lz-settings-field">
                    <span>Icon URL</span>
                    <input type="url" value="${escapeHtml(settings.inactiveIcon)}" data-lz-settings-input="inactiveIcon" placeholder="https://...">
                  </label>
                  <div class="lz-settings-actions">
                    <button type="button" class="lz-settings-button primary" data-lz-settings-action="apply-tab">${miniIcon("check")} Apply</button>
                    <button type="button" class="lz-settings-button danger" data-lz-settings-action="reset-tab">${miniIcon("refresh")} Revert</button>
                  </div>
                </section>

                <section class="lz-settings-card">
                  <h2 class="lz-settings-card-title">${miniIcon("image")} Site Logo</h2>
                  <p class="lz-settings-copy">Upload a custom logo for the main page.</p>
                  <div class="lz-settings-logo-row">
                    <div class="lz-settings-logo-preview">${logoPreview}</div>
                    <div class="lz-settings-actions">
                      <button type="button" class="lz-settings-button primary" data-lz-settings-action="choose-logo">${miniIcon("upload")} Choose Logo</button>
                      <button type="button" class="lz-settings-button" data-lz-settings-action="reset-logo">${miniIcon("refresh")} Revert</button>
                    </div>
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-lz-settings-logo-file>
                </section>
              </div>
            </section>

            <section class="lz-settings-section" id="settings-behavior">
              ${settingsSectionHeader("monitor", "Behavior", "Performance, motion, cache, and compatibility controls.")}
              <div class="lz-settings-grid">
                <section class="lz-settings-card is-wide">
                  <h2 class="lz-settings-card-title">${miniIcon("monitor")} Performance <span class="lz-settings-state-pill">${escapeHtml(settingsOptionLabel(settings.performanceMode, [
                    { value: "auto", label: "Auto" },
                    { value: "standard", label: "Standard" },
                    { value: "low", label: "Low Power" }
                  ]))}</span></h2>
                  <p class="lz-settings-copy">Choose how aggressively the site trims animations and refreshes.</p>
                  ${settingsSegmentMarkup("performanceMode", [
                    { value: "auto", label: "Auto" },
                    { value: "standard", label: "Standard" },
                    { value: "low", label: "Low Power" }
                  ], settings.performanceMode)}
                  <div class="lz-settings-actions">
                    <button type="button" class="lz-settings-button${settings.reduceMotion ? " primary" : ""}" data-lz-settings-action="toggle-motion">${miniIcon("refresh")} Reduced Motion</button>
                    <button type="button" class="lz-settings-button" data-lz-settings-action="clear-cover-cache">${miniIcon("database")} Clear Covers</button>
                  </div>
                </section>
              </div>
            </section>

            <section class="lz-settings-section" id="settings-data">
              ${settingsSectionHeader("database", "Data & Account", "Session state, local exports, account linking, and reset controls.")}
              <div class="lz-settings-grid">
                <section class="lz-settings-card">
                  <h2 class="lz-settings-card-title">${miniIcon("database")} Export/Import Site Data</h2>
                  <p class="lz-settings-copy">Export or import settings, favorites, local storage, session storage, and cookies.</p>
                  <div class="lz-settings-actions">
                    <button type="button" class="lz-settings-button primary" data-lz-settings-action="export">${miniIcon("download")} Export</button>
                    <button type="button" class="lz-settings-button primary" data-lz-settings-action="choose-import">${miniIcon("upload")} Import</button>
                  </div>
                  <input type="file" accept="application/json,.json" hidden data-lz-settings-import-file>
                </section>

                <section class="lz-settings-card is-wide">
                  <h2 class="lz-settings-card-title">${miniIcon("users")} Account & Session</h2>
                  <div class="lz-settings-account-line"><span>Signed in as</span><strong>${escapeHtml(snapshot.username || "Guest")}</strong></div>
                  <div class="lz-settings-account-line"><span>Role</span><strong>${escapeHtml(snapshot.role || "user")}</strong></div>
                  <div class="lz-settings-account-line"><span>Account link</span><strong>${escapeHtml(linkState.mode === "chat" ? "Chat login" : "Site login")}</strong></div>
                  <div class="lz-settings-actions">
                    <button type="button" class="lz-settings-button${linkState.mode === "site" ? " primary" : ""}" data-lz-account-link-mode="site">Use site login</button>
                    <button type="button" class="lz-settings-button${linkState.mode === "chat" ? " primary" : ""}" data-lz-account-link-mode="chat">Use chat login</button>
                    <button type="button" class="lz-settings-button danger" data-lz-settings-action="reset-settings">${miniIcon("refresh")} Reset Settings</button>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>

        <div class="lz-settings-status" data-lz-settings-status aria-live="polite"></div>
      </div>
    `;
  }

  function isSettingsRoute() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    return path === "/settings" || path === "/settings.html";
  }

  function navigateSiteSettings(path) {
    if (location.pathname === path) return;
    history.pushState({}, "", path);
    syncChatOverlayForRoute();
  }

  function ensureSiteSettingsNav() {
    if (isLoginSurface()) return;
    installChatOverlayStyles();
    const header = document.querySelector('[data-testid="site-header"]') || document.querySelector("header");
    const nav = header?.querySelector("nav");
    if (!nav) return;

    if (!nav.querySelector("[data-lz-site-settings-nav]")) {
      const settingsLink = document.createElement("a");
      settingsLink.href = "/settings";
      settingsLink.className = "lz-site-settings-nav";
      settingsLink.dataset.lzSiteSettingsNav = "true";
      settingsLink.innerHTML = `${miniIcon("gear")}<span>Settings</span>`;
      settingsLink.addEventListener("click", event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
        event.preventDefault();
        navigateSiteSettings("/settings");
      });
      nav.appendChild(settingsLink);
    }

    if (!nav.querySelector("[data-lz-site-discord-nav]")) {
      const discordLink = document.createElement("a");
      discordLink.href = "https://discord.gg/H9DRAUKnz";
      discordLink.target = "_blank";
      discordLink.rel = "noopener noreferrer";
      discordLink.className = "lz-site-settings-nav lz-site-discord-nav";
      discordLink.dataset.lzSiteDiscordNav = "true";
      discordLink.dataset.testid = "nav-discord";
      discordLink.setAttribute("aria-label", "Join our Learning Zones Discord (opens in a new tab)");
      discordLink.innerHTML = `${miniIcon("users")}<span>Our Discord</span>`;
      const suggestLink = nav.querySelector('[data-testid="nav-suggest"]');
      nav.insertBefore(discordLink, suggestLink || nav.querySelector("[data-lz-site-settings-nav]"));
    }
  }

  function scheduleSiteSettingsRender() {
    clearTimeout(siteSettingsRenderTimer);
    siteSettingsRenderTimer = setTimeout(() => {
      if (isSettingsRoute()) renderSiteSettingsPage();
    }, 60);
  }

  function renderSiteSettingsPage() {
    if (!document.body) return;
    installChatOverlayStyles();
    const theme = applySiteThemePreference();
    applySiteSettingsPreferences();
    document.documentElement.dataset.lzSettingsRoute = "true";
    document.title = "Settings - Learning Zones";
    let page = document.getElementById("lz-site-settings-page");
    if (!page) {
      page = document.createElement("main");
      page.id = "lz-site-settings-page";
      page.setAttribute("data-lz-settings-page", "true");
      document.body.appendChild(page);
    }
    page.dataset.lzBg = siteSettings().background;
    applySettingsThemeVars(page, theme);
    page.innerHTML = siteSettingsMarkup();
    bindSiteSettingsPage(page);
    bindSiteSettingsDynamicControls(page);
    bindAccountLinkControls();
    if (siteSettingsStatusMessage) settingsStatus(siteSettingsStatusMessage);
    scheduleScrollReveal(page, 90);
  }

  function removeSiteSettingsPage() {
    document.documentElement.dataset.lzSettingsRoute = "false";
    const page = document.getElementById("lz-site-settings-page");
    if (page) page.remove();
    applyInactiveTabSettings();
  }

  function syncSiteSettingsRoute() {
    ensureSiteSettingsNav();
    applySiteSettingsPreferences();
    if (isSettingsRoute()) renderSiteSettingsPage();
    else removeSiteSettingsPage();
  }

  function collectStorage(storage) {
    const data = {};
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const name = storage.key(index);
        data[name] = storage.getItem(name);
      }
    } catch (error) {}
    return data;
  }

  function exportSiteData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      localStorage: collectStorage(localStorage),
      sessionStorage: collectStorage(sessionStorage),
      cookies: document.cookie || ""
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `learningzone-site-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    settingsStatus("Export ready.");
  }

  function importSiteDataFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        Object.entries(payload.localStorage || {}).forEach(([name, value]) => localStorage.setItem(name, String(value)));
        Object.entries(payload.sessionStorage || {}).forEach(([name, value]) => sessionStorage.setItem(name, String(value)));
        String(payload.cookies || "").split(/;\s*/).filter(Boolean).forEach(cookie => {
          const name = cookie.split("=")[0];
          if (name) document.cookie = `${cookie}; path=/; max-age=31536000`;
        });
        applySiteThemePreference();
        applySiteSettingsPreferences();
        renderSiteSettingsPage();
        settingsStatus("Import complete.");
      } catch (error) {
        settingsStatus("Import failed. Use a valid LearningZone JSON file.");
      }
    };
    reader.readAsText(file);
  }

  function readLogoFile(file) {
    if (!file) return;
    if (file.size > 180 * 1024) {
      settingsStatus("Logo is too large. Use an image under 180 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = safeDataImage(String(reader.result || ""));
      if (!data) {
        settingsStatus("Logo file could not be read.");
        return;
      }
      setSiteSettingsPatch({ logoData: data, logoName: file.name || "Custom logo" });
      settingsStatus("Logo updated.");
    };
    reader.readAsDataURL(file);
  }

  function setSettingsCustomColor(value, options = {}) {
    const current = siteThemePreference();
    const accent = safeColor(value, settingsThemeAccent(current));
    setSiteThemePreference({ value: "custom", theme: "custom", colorMode: current.colorMode || "light", accent });
    const page = document.getElementById("lz-site-settings-page");
    if (page) {
      applySettingsThemeVars(page, siteThemePreference());
      updateSettingsLivePreview(page);
    }
    if (options.render) renderSiteSettingsPage();
    if (options.status) settingsStatus(options.status);
  }

  function bindSiteSettingsDynamicControls(page) {
    if (!page) return;
    page.querySelectorAll("[data-lz-settings-segment] button[data-lz-settings-value]").forEach(button => {
      if (button.dataset.lzSettingsDirectBound) return;
      button.dataset.lzSettingsDirectBound = "true";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const group = button.closest("[data-lz-settings-segment]")?.dataset.lzSettingsSegment;
        const value = button.dataset.lzSettingsValue;
        if (!group || !value) return;
        if (group === "colorMode") {
          setSiteColorModePreference(value);
          renderSiteSettingsPage();
          settingsStatus("Color mode saved.");
          return;
        }
        setSiteSettingsPatch({ [group]: value });
        settingsStatus("Setting saved.");
      });
    });
    page.querySelectorAll("[data-lz-settings-select]").forEach(select => {
      if (select.dataset.lzSettingsDirectBound) return;
      select.dataset.lzSettingsDirectBound = "true";
      select.addEventListener("change", () => {
        setSiteSettingsPatch({ [select.dataset.lzSettingsSelect]: select.value });
        settingsStatus("Setting saved.");
      });
    });
    page.querySelectorAll("[data-lz-settings-action]").forEach(button => {
      if (button.dataset.lzSettingsDirectBound) return;
      button.dataset.lzSettingsDirectBound = "true";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        runSiteSettingsAction(page, button.dataset.lzSettingsAction);
      });
    });
    page.querySelectorAll("[data-lz-settings-custom-color]").forEach(input => {
      if (input.dataset.lzSettingsDirectBound) return;
      input.dataset.lzSettingsDirectBound = "true";
      input.addEventListener("input", () => setSettingsCustomColor(input.value));
      input.addEventListener("change", () => setSettingsCustomColor(input.value, { render: true, status: "Custom theme saved." }));
    });
    page.querySelectorAll("[data-lz-settings-logo-file]").forEach(input => {
      if (input.dataset.lzSettingsDirectBound) return;
      input.dataset.lzSettingsDirectBound = "true";
      input.addEventListener("change", () => {
        readLogoFile(input.files?.[0]);
        input.value = "";
      });
    });
    page.querySelectorAll("[data-lz-settings-import-file]").forEach(input => {
      if (input.dataset.lzSettingsDirectBound) return;
      input.dataset.lzSettingsDirectBound = "true";
      input.addEventListener("change", () => {
        importSiteDataFile(input.files?.[0]);
        input.value = "";
      });
    });
  }

  function runSiteSettingsAction(page, action) {
    if (!action) return;
    if (action === "apply-tab") {
      setSiteSettingsPatch({
        inactiveTitle: page.querySelector('[data-lz-settings-input="inactiveTitle"]')?.value || "Home",
        inactiveIcon: page.querySelector('[data-lz-settings-input="inactiveIcon"]')?.value || ""
      });
      settingsStatus("Inactive tab updated.");
    } else if (action === "reset-tab") {
      setSiteSettingsPatch({ inactiveTitle: DEFAULT_SITE_SETTINGS.inactiveTitle, inactiveIcon: "" });
      settingsStatus("Inactive tab reset.");
    } else if (action === "choose-logo") {
      page.querySelector("[data-lz-settings-logo-file]")?.click();
    } else if (action === "reset-logo") {
      setSiteSettingsPatch({ logoData: "", logoName: "" });
      settingsStatus("Logo reset.");
    } else if (action === "toggle-motion") {
      setSiteSettingsPatch({ reduceMotion: !siteSettings().reduceMotion });
      settingsStatus("Motion preference saved.");
    } else if (action === "clear-cover-cache") {
      localStorage.removeItem(GAME_COVER_CACHE_KEY);
      gameCoverManifest = {};
      gameCoverManifestLoaded = false;
      loadGameCoverManifest(true);
      settingsStatus("Cover cache cleared.");
    } else if (action === "export") {
      exportSiteData();
    } else if (action === "choose-import") {
      page.querySelector("[data-lz-settings-import-file]")?.click();
    } else if (action === "reset-settings") {
      writeJson(SITE_SETTINGS_KEY, DEFAULT_SITE_SETTINGS);
      applySiteSettingsPreferences();
      renderSiteSettingsPage();
      settingsStatus("Settings reset.");
    }
  }

  function bindSiteSettingsPage(page) {
    if (!page || page.dataset.lzSettingsBound) return;
    page.dataset.lzSettingsBound = "true";
    page.addEventListener("click", event => {
      const custom = event.target.closest("[data-lz-settings-custom-theme]");
      if (custom) {
        const input = page.querySelector("[data-lz-settings-custom-color]");
        const current = siteThemePreference();
        const accent = safeColor(input?.value, settingsThemeAccent(current));
        setSettingsCustomColor(accent, { render: true, status: "Custom theme enabled." });
        setTimeout(() => {
          const nextInput = document.querySelector("[data-lz-settings-custom-color]");
          nextInput?.focus();
        }, 80);
        return;
      }
      const sectionLink = event.target.closest('.lz-settings-sidebar-nav a[href^="#"]');
      if (sectionLink) {
        const target = page.querySelector(sectionLink.getAttribute("href"));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ block: "start", behavior: siteSettings().reduceMotion ? "auto" : "smooth" });
          history.replaceState(history.state || {}, "", sectionLink.getAttribute("href"));
        }
        return;
      }
      const themeButton = event.target.closest("[data-lz-settings-theme]");
      if (themeButton) {
        const current = siteThemePreference();
        const selected = normalizeSiteTheme(themeButton.dataset.lzSettingsTheme || "ember");
        setSiteThemePreference({ ...selected, colorMode: current.colorMode || "light" });
        renderSiteSettingsPage();
        settingsStatus("Theme updated.");
        return;
      }
      const segmentButton = event.target.closest("[data-lz-settings-segment] button[data-lz-settings-value]");
      if (segmentButton) {
        const group = segmentButton.closest("[data-lz-settings-segment]")?.dataset.lzSettingsSegment;
        const value = segmentButton.dataset.lzSettingsValue;
        if (group && value) {
          if (group === "colorMode") {
            setSiteColorModePreference(value);
            renderSiteSettingsPage();
            settingsStatus("Color mode saved.");
            return;
          }
          setSiteSettingsPatch({ [group]: value });
          settingsStatus("Setting saved.");
        }
        return;
      }
      const action = event.target.closest("[data-lz-settings-action]")?.dataset.lzSettingsAction;
      if (!action) return;
      runSiteSettingsAction(page, action);
    });
    page.addEventListener("change", event => {
      const select = event.target.closest("[data-lz-settings-select]");
      if (select) {
        setSiteSettingsPatch({ [select.dataset.lzSettingsSelect]: select.value });
        settingsStatus("Setting saved.");
        return;
      }
      if (event.target.matches("[data-lz-settings-custom-color]")) {
        setSettingsCustomColor(event.target.value, { render: true, status: "Custom theme saved." });
        return;
      }
      if (event.target.matches("[data-lz-settings-logo-file]")) {
        readLogoFile(event.target.files?.[0]);
        event.target.value = "";
        return;
      }
      if (event.target.matches("[data-lz-settings-import-file]")) {
        importSiteDataFile(event.target.files?.[0]);
        event.target.value = "";
      }
    });
    page.addEventListener("input", event => {
      if (event.target.matches("[data-lz-settings-custom-color]")) {
        setSettingsCustomColor(event.target.value);
        return;
      }
      if (event.target.matches("[data-lz-settings-input]")) {
        updateSettingsLivePreview(page);
      }
    });
    page.addEventListener("click", event => {
      if (!event.target.closest("[data-lz-settings-home]")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
      event.preventDefault();
      navigateSiteSettings("/");
    });
  }

  function avatarHtml(person, small = false) {
    const avatar = String(person?.avatar || "");
    const src = safeDataImage(avatar);
    return `<span class="lz-chat-avatar${small ? " small" : ""}${src ? "" : " controller"}">${src ? `<img alt="" src="${escapeHtml(src)}">` : controllerAvatarSvg()}</span>`;
  }

  function safeDataImage(value) {
    const src = String(value || "").trim();
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) return src;
    if (/^https?:\/\/[^\s"'<>]+$/i.test(src)) return src;
    if (/^blob:[^\s"'<>]+$/i.test(src)) return src;
    return "";
  }

  function cssImageUrl(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r]/g, "");
  }

  function siteProfileBannerBackground(profile = {}) {
    const image = safeDataImage(profile.bannerImage);
    if (image) {
      return `linear-gradient(180deg,rgba(0,0,0,.03),rgba(0,0,0,.32)),url("${cssImageUrl(image)}")`;
    }
    const presets = {
      taco: "linear-gradient(135deg,#ff9f1c,#ffd18a 52%,#19c2a0)",
      neon: "linear-gradient(135deg,#ff5f91,#7c5cff 50%,#35c2ff)",
      galaxy: "radial-gradient(circle at 25% 25%,rgba(255,255,255,.2),transparent 7%),radial-gradient(circle at 70% 35%,rgba(255,255,255,.13),transparent 6%),linear-gradient(135deg,#282050,#111827 60%,#381b4b)",
      ocean: "linear-gradient(135deg,#35c2ff,#22c3b5 55%,#72d572)",
      none: "linear-gradient(135deg,#22252d,#151820)"
    };
    return presets[key(profile.banner)] || "";
  }

  function safeColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
  }

  function safeColorInputValue(value, fallback) {
    const color = safeColor(value, fallback);
    const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
    const long = color.match(/^(#[0-9a-f]{6})[0-9a-f]{2}$/i);
    if (long) return long[1].toLowerCase();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function normalizedProfileFontValue(value) {
    const font = key(value);
    return ["inter", "rounded", "mono", "serif"].includes(font) ? font : "inter";
  }

  function normalizedProfileTextSizeValue(value) {
    const size = key(value);
    return ["small", "normal", "large", "xl"].includes(size) ? size : "normal";
  }

  function profileFontStack(value) {
    const fonts = {
      inter: "Inter, Arial, sans-serif",
      system: "Inter, Arial, sans-serif",
      rounded: "'Arial Rounded MT Bold', Inter, Arial, sans-serif",
      mono: "'SFMono-Regular', Consolas, monospace",
      serif: "Georgia, serif"
    };
    return fonts[key(value)] || fonts.inter;
  }

  function profileTextSize(value) {
    const sizes = {
      small: { title: "17px", body: "13px" },
      normal: { title: "19px", body: "14px" },
      large: { title: "22px", body: "16px" },
      xl: { title: "25px", body: "18px" }
    };
    return sizes[key(value)] || sizes.normal;
  }

  function normalizedSiteProfile(raw = {}) {
    const nested = raw && typeof raw.profile === "object" ? raw.profile : {};
    const source = { ...(raw || {}), ...nested };
    return {
      avatar: safeDataImage(source.avatar || source.profileAvatar || source.photoURL || source.photoUrl || source.image) || "",
      hasCustomAvatar: !!source.hasCustomAvatar,
      presence: String(source.presence || source.status || "online"),
      mood: String(source.mood || "Social").slice(0, 32),
      theme: String(source.theme || "ember"),
      bio: String(source.bio || "").slice(0, 260),
      favoriteGame: String(source.favoriteGame || source.favoriteZone || "").slice(0, 40),
      nameColor: safeColorInputValue(source.nameColor || source.profileNameColor, "#ff7628"),
      textColor: safeColorInputValue(source.textColor || source.profileTextColor, "#756e67"),
      font: normalizedProfileFontValue(source.font || source.profileFont),
      textSize: normalizedProfileTextSizeValue(source.textSize || source.profileTextSize),
      banner: String(source.banner || source.profileBanner || "solid"),
      bannerColor: safeColorInputValue(source.bannerColor || source.profileBannerColor, "#2d3039"),
      bannerImage: safeDataImage(source.bannerImage || source.profileBannerImage) || "",
      mediaUpdatedAt: Math.max(
        Number(source.mediaUpdatedAt || 0),
        Number(source.profileMediaUpdatedAt || 0)
      ),
      profileTheme: String(source.profileTheme || "taco"),
      profileEffect: String(source.profileEffect || "none"),
      badges: Array.isArray(source.badges) ? source.badges.slice(0, 24) : [],
      visibleBadges: Array.isArray(source.visibleBadges) ? source.visibleBadges.slice(0, 12) : [],
      streak: source.streak,
      currentStreak: source.currentStreak,
      longestStreak: source.longestStreak,
      lastActiveDate: source.lastActiveDate,
      updatedAt: Number(source.updatedAt || source.createdAt || 0)
    };
  }

  function valueStamp(value) {
    const text = String(value || "");
    return `${text.length}:${text.slice(0, 24)}:${text.slice(-12)}`;
  }

  function selectedAttr(current, value) {
    return key(current) === key(value) ? " selected" : "";
  }

  function siteProfileStatus(message, type = "") {
    const status = document.querySelector("[data-lz-site-profile-status]");
    if (!status) return;
    status.textContent = message || "";
    status.className = `lz-site-profile-status${type ? ` ${type}` : ""}`;
  }

  function readProfileImageInput(input) {
    const file = input?.files?.[0];
    if (!file) return Promise.resolve("");
    if (!/^image\//i.test(file.type || "")) {
      return Promise.reject(new Error("Use an image file."));
    }
    if (file.size > 650000) {
      return Promise.reject(new Error("Use an image under 650 KB."));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        if (!safeDataImage(value) || value.length > 750000) reject(new Error("That image is too large."));
        else resolve(value);
      };
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
  }

  function editableImageValue(value) {
    const src = safeDataImage(value);
    return /^https?:\/\//i.test(src) ? src : "";
  }

  function siteProfileDraftFromForm(form) {
    const snapshot = profileSnapshot();
    const currentProfile = normalizedSiteProfile(snapshot.profile || {});
    const data = new FormData(form);
    const avatarUrl = safeDataImage(String(data.get("avatar") || "").trim());
    const bannerUrl = safeDataImage(String(data.get("bannerImage") || "").trim());
    return {
      ...currentProfile,
      mood: String(data.get("mood") || currentProfile.mood || "Social").slice(0, 32),
      bio: String(data.get("bio") || "").slice(0, 260),
      favoriteGame: String(data.get("favoriteGame") || "").slice(0, 40),
      nameColor: safeColorInputValue(data.get("nameColor"), currentProfile.nameColor || "#ff7628"),
      textColor: safeColorInputValue(data.get("textColor"), currentProfile.textColor || "#756e67"),
      font: normalizedProfileFontValue(data.get("font") || currentProfile.font),
      textSize: normalizedProfileTextSizeValue(data.get("textSize") || currentProfile.textSize),
      bannerColor: safeColorInputValue(data.get("bannerColor"), currentProfile.bannerColor || "#2d3039"),
      avatar: avatarUrl || currentProfile.avatar || "",
      bannerImage: bannerUrl || currentProfile.bannerImage || ""
    };
  }

  function applySiteProfileFormPreview(form) {
    if (!form) return;
    const content = form.closest("[data-lz-site-profile-content]") || document.querySelector("[data-lz-site-profile-content]");
    if (!content) return;
    const profile = siteProfileDraftFromForm(form);
    const font = profileFontStack(profile.font);
    const size = profileTextSize(profile.textSize);
    const nameColor = safeColorInputValue(profile.nameColor, "#ff7628");
    const textColor = safeColorInputValue(profile.textColor, "#756e67");
    const bannerColor = safeColorInputValue(profile.bannerColor, "#2d3039");
    const bannerImage = safeDataImage(profile.bannerImage);
    content.style.setProperty("--lz-site-profile-name", nameColor);
    content.style.setProperty("--lz-site-profile-text", textColor);
    content.style.setProperty("--lz-site-profile-font", font);
    content.style.setProperty("--lz-site-profile-size", size.title);
    content.style.setProperty("--lz-site-profile-body-size", size.body);
    const bio = content.querySelector(".lz-site-profile-bio");
    if (bio) bio.textContent = profile.bio || "No profile bio yet. Edit your profile in Chat to sync it here.";
    const pills = content.querySelectorAll(".lz-site-profile-meta .lz-site-profile-pill");
    if (pills[0]) pills[0].textContent = profile.mood || "Social";
    if (pills[2]) pills[2].textContent = profile.favoriteGame || "No favorite zone";
    const banner = content.querySelector("[data-lz-site-profile-banner]");
    if (banner) {
      banner.style.backgroundColor = bannerColor;
      banner.style.backgroundImage = siteProfileBannerBackground(profile);
    }
    const typedAvatar = safeDataImage(String(new FormData(form).get("avatar") || "").trim());
    const avatar = content.querySelector(".lz-site-profile-title .lz-site-profile-avatar");
    if (avatar && typedAvatar) {
      avatar.classList.remove("controller");
      avatar.innerHTML = `<img alt="" src="${escapeHtml(typedAvatar)}">`;
    }
    const status = content.querySelector("[data-lz-site-profile-status]");
    if (status && !/saving|failed|log in/i.test(status.textContent || "")) {
      siteProfileStatus("Preview updated. Save profile to keep it.");
    }
  }

  async function saveSiteProfileFromHome(form) {
    const snapshot = profileSnapshot();
    const username = snapshot.username || loggedInUsername();
    const userId = key(snapshot.id || username);
    if (!userId) {
      siteProfileStatus("Log in before editing your profile.", "error");
      return;
    }

    const data = new FormData(form);
    siteProfileStatus("Saving profile...", "");
    const avatarUpload = await readProfileImageInput(form.querySelector('[name="avatarFile"]'));
    const bannerUpload = await readProfileImageInput(form.querySelector('[name="bannerFile"]'));
    const currentProfile = normalizedSiteProfile(snapshot.profile || {});
    const nextAvatar = avatarUpload || String(data.get("avatar") || "").trim() || safeDataImage(currentProfile.avatar);
    const nextBannerImage = bannerUpload || String(data.get("bannerImage") || "").trim() || safeDataImage(currentProfile.bannerImage);
    const streak = streakProfilePatch(snapshot.streak || snapshot.profile?.streak || snapshot.profile || snapshot);
    const profilePatch = {
      avatar: safeDataImage(nextAvatar) || "",
      presence: String(currentProfile.presence || "online"),
      mood: String(data.get("mood") || "Social").slice(0, 32),
      theme: String(currentProfile.theme || "ember"),
      bio: String(data.get("bio") || "").slice(0, 260),
      favoriteGame: String(data.get("favoriteGame") || "").slice(0, 40),
      nameColor: safeColorInputValue(data.get("nameColor"), "#ff7628"),
      textColor: safeColorInputValue(data.get("textColor"), "#756e67"),
      font: normalizedProfileFontValue(data.get("font")),
      textSize: normalizedProfileTextSizeValue(data.get("textSize")),
      banner: String(currentProfile.banner || "solid"),
      bannerColor: safeColorInputValue(data.get("bannerColor"), "#2d3039"),
      bannerImage: safeDataImage(nextBannerImage) || "",
      profileTheme: String(currentProfile.profileTheme || "taco"),
      profileEffect: String(currentProfile.profileEffect || "none"),
      badges: Array.isArray(currentProfile.badges) ? currentProfile.badges : [],
      visibleBadges: Array.isArray(currentProfile.visibleBadges) ? currentProfile.visibleBadges : [],
      ...streak,
      mediaUpdatedAt: Date.now(),
      updatedAt: Date.now()
    };
    const accountPatch = {
      avatar: profilePatch.avatar,
      mood: profilePatch.mood,
      bio: profilePatch.bio,
      favoriteGame: profilePatch.favoriteGame,
      nameColor: profilePatch.nameColor,
      profileTextColor: profilePatch.textColor,
      profileFont: profilePatch.font,
      profileTextSize: profilePatch.textSize,
      profileBanner: profilePatch.banner,
      profileBannerColor: profilePatch.bannerColor,
      profileBannerImage: profilePatch.bannerImage,
      profileMediaUpdatedAt: profilePatch.mediaUpdatedAt,
      updatedAt: profilePatch.updatedAt
    };

    const writeBody = JSON.stringify(accountPatch);
    const primary = await fetch(chatStateUrl(["accounts", userId]), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: writeBody
    });
    if (!primary.ok) throw new Error("Profile save failed.");
    await fetch(firebaseUrl(["accounts", userId]), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: writeBody
    }).catch(() => {});

    const base = currentSnapshot || readJson(CACHE_KEY, null) || snapshot;
    applySnapshot({
      version: 2,
      ...base,
      id: userId,
      username: username || base.username || userId,
      profile: { ...(base.profile || {}), ...profilePatch },
      friends: base.friends || snapshot.friends || { count: 0, users: [] },
      requests: base.requests || readJson(REQUESTS_KEY, null) || { incoming: [], outgoing: [] },
      updatedAt: Date.now(),
      source: "home"
    });
    form.reset();
    contentRenderReset();
    renderSiteProfile();
    siteProfileStatus("Profile saved. Chat will use the same profile.", "ok");
    requestChatFrameSync();
  }

  function contentRenderReset() {
    const content = document.querySelector("[data-lz-site-profile-content]");
    if (content) {
      content.dataset.lzRenderKey = "";
      delete content.dataset.lzProfileEditing;
    }
  }

  function siteProfileAvatar(profile, username, large = false) {
    const src = safeDataImage(profile?.avatar);
    return `<span class="lz-site-profile-avatar${large ? " large" : ""}${src ? "" : " controller"}">${src ? `<img alt="" src="${escapeHtml(src)}">` : controllerAvatarSvg()}</span>`;
  }

  function controllerAvatarSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" x2="10" y1="12" y2="12"></line><line x1="8" x2="8" y1="10" y2="14"></line><line x1="15" x2="15.01" y1="13" y2="13"></line><line x1="18" x2="18.01" y1="11" y2="11"></line><rect width="20" height="12" x="2" y="6" rx="4"></rect></svg>';
  }

  function siteProfileButtonIcon(profile) {
    return siteProfileAvatar(profile || {}, "", false);
  }

  function profileSnapshot() {
    const activeUsername = loggedInUsername();
    const rawCached = currentSnapshot || readJson(CACHE_KEY, null) || {};
    const cached = rawCached && snapshotMatchesActiveUser(rawCached) ? rawCached : {};
    const username = activeUsername || cached.username || "";
    const rawProfile = cached.profile || readJson(PROFILE_KEY, null) || {};
    const profile = normalizedSiteProfile(rawProfile);
    const streak = streakProfilePatch(cached.streak || rawProfile.streak || rawProfile || cached);
    return {
      id: cached.id || key(username),
      username,
      role: cached.role || "user",
      status: cached.status || "pending",
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      streak: streak.streak,
      profile: { ...profile, ...streak },
      friends: cached.friends || readJson(FRIENDS_KEY, null) || { count: 0, users: [] }
    };
  }

  function renderProfileBadges(profile) {
    const rawBadges = Array.isArray(profile?.visibleBadges) && profile.visibleBadges.length ? profile.visibleBadges : (Array.isArray(profile?.badges) ? profile.badges : []);
    const badges = rawBadges
      .map(item => typeof item === "string" ? item : (item?.label || item?.name || item?.title || "Badge"))
      .filter(Boolean)
      .slice(0, 8);
    if (!badges.length) return '<span class="lz-site-profile-pill badge">No badges yet</span>';
    return badges.map(badge => `<span class="lz-site-profile-pill badge">${escapeHtml(badge)}</span>`).join("");
  }

  function accountLinkMarkup(kind = "inline") {
    const state = accountLinkState();
    const siteLabel = state.siteDisplayUsername ? `Use site login (${state.siteDisplayUsername})` : "Use site login";
    const chatLabel = state.chatDisplayUsername ? `Use chat login (${state.chatDisplayUsername})` : "Use chat login";
    return `
      <section class="lz-account-link-card${kind === "modal" ? " is-modal" : ""}" data-lz-account-link-card>
        <div class="lz-account-link-head">
          <span>Account link</span>
          ${kind === "modal" ? '<button type="button" class="lz-account-link-close" data-lz-account-link-close aria-label="Close account link">x</button>' : ""}
        </div>
        <p class="lz-account-link-fine">Fine print: linking can change which username and password you use here. Choose whether this device follows your site login or your chat login.</p>
        <div class="lz-account-link-actions">
          <button type="button" data-lz-account-link-mode="site" class="${state.mode === "site" ? "active" : ""}">${escapeHtml(siteLabel)}</button>
          <button type="button" data-lz-account-link-mode="chat" class="${state.mode === "chat" ? "active" : ""}">${escapeHtml(chatLabel)}</button>
        </div>
        <div class="lz-account-link-status" data-lz-account-link-status>${escapeHtml(state.status)}</div>
      </section>
    `;
  }

  function renderAccountLinkCards() {
    const state = accountLinkState();
    document.querySelectorAll("[data-lz-account-link-card]").forEach(card => {
      const siteButton = card.querySelector('[data-lz-account-link-mode="site"]');
      const chatButton = card.querySelector('[data-lz-account-link-mode="chat"]');
      const statusEl = card.querySelector("[data-lz-account-link-status]");
      if (siteButton) {
        siteButton.classList.toggle("active", state.mode === "site");
        siteButton.textContent = state.siteDisplayUsername ? `Use site login (${state.siteDisplayUsername})` : "Use site login";
      }
      if (chatButton) {
        chatButton.classList.toggle("active", state.mode === "chat");
        chatButton.textContent = state.chatDisplayUsername ? `Use chat login (${state.chatDisplayUsername})` : "Use chat login";
      }
      if (statusEl) statusEl.textContent = state.status;
    });
    bindAccountLinkControls();
  }

  function chooseAccountLinkMode(mode) {
    const pref = setAccountLinkPreference(mode);
    const state = accountLinkState(pref);
    if (state.mode === "chat" && state.chatUsername) {
      setSiteSessionUsername(state.chatUsername, "chat-link-choice");
    }
    if (state.mode === "site" && state.siteUsername && !state.pendingSiteSignIn) {
      setSiteSessionUsername(state.siteUsername, "site-link-choice");
      hydrateFromFirebase(state.siteUsername).catch(() => {});
    }
    requestChatFrameSync();
    renderAccountLinkCards();
    ensureSiteProfileButton();
    renderSiteProfile();
    scheduleSiteSettingsRender();
  }

  function scheduleAccountLinkInputRender() {
    clearTimeout(accountLinkInputTimer);
    accountLinkInputTimer = setTimeout(() => renderAccountLinkCards(), 80);
  }

  function watchAccountLinkLoginInputs(root = document) {
    const selectors = [
      '[data-testid="username-input"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[autocomplete="username"]',
      'input[type="text"]'
    ].join(",");
    root.querySelectorAll(selectors).forEach(input => {
      if (input.dataset.lzAccountLinkInputBound) return;
      input.dataset.lzAccountLinkInputBound = "true";
      input.addEventListener("input", scheduleAccountLinkInputRender);
      input.addEventListener("change", scheduleAccountLinkInputRender);
    });
  }

  function bindAccountLinkControls(root = document) {
    root.querySelectorAll("[data-lz-account-link-mode]").forEach(button => {
      if (button.dataset.lzBound) return;
      button.dataset.lzBound = "true";
      button.addEventListener("click", () => chooseAccountLinkMode(button.dataset.lzAccountLinkMode));
    });
    root.querySelectorAll("[data-lz-account-link-close]").forEach(button => {
      if (button.dataset.lzBound) return;
      button.dataset.lzBound = "true";
      button.addEventListener("click", () => button.closest("[data-lz-account-link-card]")?.remove());
    });
  }

  function scheduleAccountLinkMountRetry() {
    clearTimeout(accountLinkMountTimer);
    accountLinkMountTimer = setTimeout(() => {
      ensureLoginAccountLinkFinePrint();
      renderAccountLinkCards();
    }, 160);
  }

  function ensureLoginAccountLinkFinePrint() {
    if (!isLoginSurface()) return;
    installChatOverlayStyles();
    const form = loginFormElement();
    if (!form) {
      scheduleAccountLinkMountRetry();
      return;
    }
    watchAccountLinkLoginInputs(form);
    if (form.querySelector("[data-lz-account-link-card]")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = accountLinkMarkup("inline");
    form.appendChild(wrap.firstElementChild);
    bindAccountLinkControls(form);
    renderAccountLinkCards();
  }

  function watchLoginAccountLinkMount() {
    if (window.__learningZonesAccountLinkWatch) return;
    window.__learningZonesAccountLinkWatch = true;
    [0, 180, 500, 1000, 1800, 3000, 5000].forEach(delay => {
      setTimeout(() => {
        if (!isLoginSurface()) return;
        ensureLoginAccountLinkFinePrint();
        renderAccountLinkCards();
      }, delay);
    });
    document.addEventListener("input", event => {
      if (!event.target?.matches?.('[data-testid="username-input"], input[name="username"], input[name="user"], input[autocomplete="username"], input[type="text"]')) return;
      if (!isLoginSurface()) return;
      ensureLoginAccountLinkFinePrint();
      scheduleAccountLinkInputRender();
    }, true);
  }

  function scheduleStreakExpiryRefresh() {
    clearTimeout(streakExpiryTimer);
    const nowStamp = currentStreakClockStamp();
    const dayNumber = streakDayNumber(isoDayFromStamp(nowStamp));
    const nextMidnight = Number.isFinite(dayNumber)
      ? (dayNumber + 1) * STREAK_DAY_MS
      : nowStamp + STREAK_DAY_MS;
    const delay = Math.max(1000, Math.min(STREAK_DAY_MS + 2000, nextMidnight - nowStamp + 1200));
    streakExpiryTimer = setTimeout(() => {
      renderHeaderStreak();
      renderSiteProfile();
      scheduleStreakExpiryRefresh();
    }, delay);
  }

  function renderHeaderStreak() {
    if (isLoginSurface()) {
      document.getElementById("lz-streak-chip")?.remove();
      return;
    }
    const snapshot = profileSnapshot();
    const username = snapshot.username || "";
    const header = document.querySelector('[data-testid="site-header"]');
    const headerInner = header?.firstElementChild || header;
    if (!headerInner || !username) {
      document.getElementById("lz-streak-chip")?.remove();
      return;
    }
    installChatOverlayStyles();
    const streak = activeStreakStateForDay(snapshot.streak || snapshot.profile?.streak || snapshot.profile || snapshot);
    let chip = document.getElementById("lz-streak-chip");
    if (!chip) {
      chip = document.createElement("span");
      chip.id = "lz-streak-chip";
      chip.className = "lz-streak-chip";
      chip.setAttribute("aria-label", "Current daily streak");
      const profileButton = document.getElementById("lz-site-profile-button");
      const logout = Array.from(headerInner.querySelectorAll("button,a")).find(el => /logout/i.test(el.textContent || ""));
      const anchor = profileButton || logout || null;
      const parent = anchor?.parentElement || headerInner;
      parent.insertBefore(chip, anchor || null);
    }
    chip.hidden = !username;
    chip.title = `Current streak: ${streak.current} day${streak.current === 1 ? "" : "s"} | Longest: ${streak.longest} | Last active: ${streakDateLabel(streak.lastActiveDate)}`;
    chip.innerHTML = `<span aria-hidden="true">&#128293;</span><strong>${streak.current}</strong>`;
  }

  function renderSiteProfile() {
    const snapshot = profileSnapshot();
    const username = snapshot.username || "";
    const profile = snapshot.profile || {};
    const streak = activeStreakStateForDay(snapshot.streak || profile.streak || profile || snapshot);
    renderHeaderStreak();
    const button = document.getElementById("lz-site-profile-button");
    if (button) {
      button.hidden = !username || location.pathname === "/login";
      const buttonKey = [username, valueStamp(profile.avatar)].join("|");
      if (button.dataset.lzRenderKey !== buttonKey) {
        button.dataset.lzRenderKey = buttonKey;
        button.innerHTML = `${siteProfileButtonIcon(profile)}<span class="lz-site-profile-button-text">@${escapeHtml(username || "Profile")}</span>`;
      }
      button.setAttribute("aria-label", username ? `Open and edit ${username} profile` : "Open and edit profile");
    }

    const content = document.querySelector("[data-lz-site-profile-content]");
    if (!content) return;
    const scrim = document.getElementById("lz-site-profile-scrim");
    if (
      scrim?.classList.contains("is-open")
      && content.dataset.lzProfileEditing === "true"
      && content.querySelector("[data-lz-site-profile-form]")
    ) {
      return;
    }

    const font = profileFontStack(profile.font);
    const size = profileTextSize(profile.textSize);
    const nameColor = safeColorInputValue(profile.nameColor, "#ff7628");
    const textColor = safeColorInputValue(profile.textColor, "#756e67");
    const bannerColor = safeColorInputValue(profile.bannerColor, "#2d3039");
    const bannerImage = safeDataImage(profile.bannerImage);
    const roleLabel = (snapshot.role === "owner" ? "Owner" : snapshot.role === "admin" ? "Admin" : "Member");
    const statusLabel = profile.presence || snapshot.status || "online";
    const friendCount = Number(snapshot.friends?.count || (snapshot.friends?.users || []).length || 0);
    const renderKey = [
      username,
      roleLabel,
      statusLabel,
      friendCount,
      profile.mood,
      profile.favoriteGame,
      profile.bio,
      profile.font,
      profile.textSize,
      profile.nameColor,
      profile.textColor,
      profile.bannerColor,
      profile.banner,
      streak.current,
      streak.longest,
      streak.lastActiveDate,
      valueStamp(profile.avatar),
      valueStamp(bannerImage),
      JSON.stringify(profile.visibleBadges || profile.badges || [])
    ].join("|");
    if (content.dataset.lzRenderKey === renderKey) return;
    content.dataset.lzRenderKey = renderKey;
    content.style.setProperty("--lz-site-profile-name", nameColor);
    content.style.setProperty("--lz-site-profile-text", textColor);
    content.style.setProperty("--lz-site-profile-font", font);
    content.style.setProperty("--lz-site-profile-size", size.title);
    content.style.setProperty("--lz-site-profile-body-size", size.body);
    content.innerHTML = `
      <article class="lz-site-profile-card" role="dialog" aria-modal="true" aria-labelledby="lz-site-profile-title">
        <div class="lz-site-profile-banner" data-lz-site-profile-banner></div>
        <button type="button" class="lz-site-profile-close" data-lz-site-profile-close aria-label="Close profile">${miniIcon("close")}</button>
        <div class="lz-site-profile-body">
          <div class="lz-site-profile-title">
            ${siteProfileAvatar(profile, username, true)}
            <div>
              <h2 id="lz-site-profile-title">${escapeHtml(username || "Profile")}</h2>
              <span>${escapeHtml(roleLabel)} / ${escapeHtml(statusLabel)}</span>
            </div>
          </div>
          <p class="lz-site-profile-bio">${escapeHtml(profile.bio || "No profile bio yet. Edit your profile in Chat to sync it here.")}</p>
          <div class="lz-site-profile-meta">
            <span class="lz-site-profile-pill">${escapeHtml(profile.mood || "Social")}</span>
            <span class="lz-site-profile-pill">${friendCount} friend${friendCount === 1 ? "" : "s"}</span>
            <span class="lz-site-profile-pill">${escapeHtml(profile.favoriteGame || "No favorite zone")}</span>
          </div>
          <div class="lz-site-profile-stats">
            <div class="lz-site-profile-stat"><strong>&#128293; ${streak.current}</strong><span>Current Streak</span></div>
            <div class="lz-site-profile-stat"><strong>${streak.longest}</strong><span>Longest Streak</span></div>
            <div class="lz-site-profile-stat"><strong>${escapeHtml(streakDateLabel(streak.lastActiveDate))}</strong><span>Last Active Date</span></div>
          </div>
          <div class="lz-site-profile-badges">${renderProfileBadges(profile)}</div>
          <div class="lz-site-profile-actions">
            <button type="button" class="lz-site-profile-action primary" data-lz-site-profile-chat>Open Chat Profile</button>
            <button type="button" class="lz-site-profile-action" data-lz-site-profile-close>Close</button>
          </div>
          ${accountLinkMarkup("inline")}
          <div class="lz-site-profile-edit">
            <div class="lz-site-profile-edit-head">
              <div>
                <strong>Edit profile</strong>
                <span>Saved for home, chat, and friends</span>
              </div>
            </div>
            <form class="lz-site-profile-form" data-lz-site-profile-form>
              <label class="lz-site-profile-field">
                Bio
                <textarea name="bio" maxlength="260" placeholder="Short profile bio">${escapeHtml(profile.bio || "")}</textarea>
              </label>
              <div class="lz-site-profile-form-grid">
                <label class="lz-site-profile-field">
                  Mood
                  <input name="mood" maxlength="32" value="${escapeHtml(profile.mood || "Social")}" placeholder="Social">
                </label>
                <label class="lz-site-profile-field">
                  Favorite zone
                  <input name="favoriteGame" maxlength="40" value="${escapeHtml(profile.favoriteGame || "")}" placeholder="Tetris">
                </label>
              </div>
              <div class="lz-site-profile-form-grid">
                <label class="lz-site-profile-field">
                  Font
                  <select name="font">
                    <option value="inter"${selectedAttr(profile.font, "inter")}>Inter</option>
                    <option value="rounded"${selectedAttr(profile.font, "rounded")}>Rounded</option>
                    <option value="mono"${selectedAttr(profile.font, "mono")}>Mono</option>
                    <option value="serif"${selectedAttr(profile.font, "serif")}>Serif</option>
                  </select>
                </label>
                <label class="lz-site-profile-field">
                  Text size
                  <select name="textSize">
                    <option value="small"${selectedAttr(profile.textSize, "small")}>Small</option>
                    <option value="normal"${selectedAttr(profile.textSize || "normal", "normal")}>Normal</option>
                    <option value="large"${selectedAttr(profile.textSize, "large")}>Large</option>
                    <option value="xl"${selectedAttr(profile.textSize, "xl")}>XL</option>
                  </select>
                </label>
              </div>
              <div class="lz-site-profile-color-row">
                <label class="lz-site-profile-field">
                  Name color
                  <input type="color" name="nameColor" value="${escapeHtml(nameColor)}">
                </label>
                <label class="lz-site-profile-field">
                  Text color
                  <input type="color" name="textColor" value="${escapeHtml(textColor)}">
                </label>
                <label class="lz-site-profile-field">
                  Banner color
                  <input type="color" name="bannerColor" value="${escapeHtml(bannerColor)}">
                </label>
              </div>
              <label class="lz-site-profile-field">
                Avatar image URL
                <input name="avatar" value="${escapeHtml(editableImageValue(profile.avatar))}" placeholder="https://...">
              </label>
              <label class="lz-site-profile-file">
                Upload avatar image
                <input type="file" name="avatarFile" accept="image/*">
              </label>
              <label class="lz-site-profile-field">
                Banner image URL
                <input name="bannerImage" value="${escapeHtml(editableImageValue(bannerImage))}" placeholder="https://...">
              </label>
              <label class="lz-site-profile-file">
                Upload banner image
                <input type="file" name="bannerFile" accept="image/*">
              </label>
              <div class="lz-site-profile-actions">
                <button type="submit" class="lz-site-profile-action primary">Save profile</button>
                <button type="button" class="lz-site-profile-action" data-lz-site-profile-close>Done</button>
              </div>
              <p class="lz-site-profile-status" data-lz-site-profile-status></p>
            </form>
          </div>
        </div>
      </article>
    `;
    const banner = content.querySelector("[data-lz-site-profile-banner]");
    if (banner) {
      banner.style.backgroundColor = bannerColor;
      banner.style.backgroundImage = siteProfileBannerBackground(profile);
    }
    bindAccountLinkControls(content);
  }

  function ensureSiteProfileModal() {
    if (document.getElementById("lz-site-profile-scrim")) return;
    installChatOverlayStyles();
    const scrim = document.createElement("div");
    scrim.id = "lz-site-profile-scrim";
    scrim.className = "lz-site-profile-scrim";
    scrim.setAttribute("aria-hidden", "true");
    scrim.innerHTML = '<div data-lz-site-profile-content></div>';
    scrim.addEventListener("click", event => {
      if (event.target === scrim || event.target.closest("[data-lz-site-profile-close]")) closeSiteProfile();
      if (event.target.closest("[data-lz-site-profile-chat]")) {
        closeSiteProfile();
        location.href = "/chat";
      }
    });
    scrim.addEventListener("submit", event => {
      const form = event.target.closest("[data-lz-site-profile-form]");
      if (!form) return;
      event.preventDefault();
      saveSiteProfileFromHome(form).catch(error => {
        siteProfileStatus(error?.message || "Profile save failed.", "error");
      });
    });
    ["input", "change"].forEach(type => {
      scrim.addEventListener(type, event => {
        const form = event.target.closest("[data-lz-site-profile-form]");
        if (!form) return;
        const content = form.closest("[data-lz-site-profile-content]");
        if (content) content.dataset.lzProfileEditing = "true";
        applySiteProfileFormPreview(form);
      });
    });
    document.body.appendChild(scrim);
  }

  function openSiteProfile() {
    ensureSiteProfileModal();
    renderSiteProfile();
    const scrim = document.getElementById("lz-site-profile-scrim");
    if (!scrim) return;
    scrim.classList.add("is-open");
    scrim.setAttribute("aria-hidden", "false");
  }

  function closeSiteProfile() {
    const scrim = document.getElementById("lz-site-profile-scrim");
    if (!scrim) return;
    scrim.classList.remove("is-open");
    scrim.setAttribute("aria-hidden", "true");
    const content = scrim.querySelector("[data-lz-site-profile-content]");
    if (content) delete content.dataset.lzProfileEditing;
  }

  function ensureSiteThemeControl() {
    installChatOverlayStyles();
    applySiteThemePreference();
    applySiteSettingsPreferences();
    document.getElementById("lz-site-theme-control")?.remove();
  }

  function ensureSiteProfileButton() {
    if (location.pathname === "/login" || document.querySelector('input[type="password"]')) return;
    const snapshot = profileSnapshot();
    if (!snapshot.username) return;
    const header = document.querySelector('[data-testid="site-header"]');
    const headerInner = header?.firstElementChild || header;
    if (!headerInner) return;
    const existingName = headerInner.querySelector('[data-testid="nav-username"]');
    if (existingName && !existingName.dataset.lzProfileBound) {
      existingName.dataset.lzProfileBound = "true";
      existingName.classList.add("lz-site-profile-existing");
      existingName.setAttribute("role", "button");
      existingName.setAttribute("tabindex", "0");
      existingName.setAttribute("title", "Open and edit profile");
      existingName.addEventListener("click", openSiteProfile);
      existingName.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openSiteProfile();
      });
    }
    let button = document.getElementById("lz-site-profile-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "lz-site-profile-button";
      button.className = "lz-site-profile-button";
      button.addEventListener("click", openSiteProfile);
      const logout = Array.from(headerInner.querySelectorAll("button,a")).find(el => /logout/i.test(el.textContent || ""));
      const parent = logout?.parentElement || headerInner;
      parent.insertBefore(button, logout || null);
    }
    renderSiteProfile();
    ensureSiteThemeControl();
    ensureSiteSettingsNav();
  }

  function installSiteProfile() {
    applySiteThemePreference();
    applySiteSettingsPreferences();
    ensureSiteProfileModal();
    ensureSiteProfileButton();
    ensureSiteThemeControl();
    ensureSiteSettingsNav();
  }

  function watchSiteProfileMount() {
    if (window.__learningZonesSiteProfileWatch) return;
    window.__learningZonesSiteProfileWatch = true;
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSiteProfile();
    });
    window.addEventListener(SYNC_EVENT, () => {
      ensureSiteProfileButton();
      renderSiteProfile();
      renderAccountLinkCards();
      ensureSiteThemeControl();
      ensureSiteSettingsNav();
    });
    new MutationObserver(mutations => {
      if (!mutationAddsMatching(mutations, 'header, [data-testid="site-header"], [data-testid="login-form"], [data-testid="nav-username"]')) return;
      clearTimeout(profileMountTimer);
      profileMountTimer = setTimeout(() => {
        ensureSiteProfileButton();
        renderSiteProfile();
        ensureLoginAccountLinkFinePrint();
        renderAccountLinkCards();
        ensureSiteThemeControl();
        ensureSiteSettingsNav();
      }, 120);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function renderPeople(items) {
    const rows = uniquePeople(items);
    return (rows.length ? rows : [
      { username: "Open Chat", mood: "See live rooms and friends" }
    ]).map(item => `
      <button type="button" class="lz-chat-person" data-lz-action="person">
        ${avatarHtml(item)}
        <span><strong>${escapeHtml(item.username || item.id || "Friend")}</strong><span>${escapeHtml(item.mood || item.presence || "Online")}</span></span>
        <i class="lz-chat-dot" aria-hidden="true"></i>
      </button>
    `).join("");
  }

  function setOverlaySectionQuietState(target, empty, label) {
    const section = target?.closest?.(".lz-chat-panel-section");
    if (!section) return;
    const kicker = section.querySelector(".lz-chat-kicker");
    section.classList.toggle("is-quiet-empty", !!empty);
    if (empty && label) {
      section.dataset.lzEmptyLabel = label;
      if (kicker) kicker.dataset.lzEmptyLabel = label;
    } else {
      delete section.dataset.lzEmptyLabel;
      if (kicker) delete kicker.dataset.lzEmptyLabel;
    }
  }

  function overlayAccountRows(accounts) {
    return Object.entries(accounts || {}).map(([id, account]) => ({
      id: key(id || account?.username),
      username: String(account?.username || displayName(id)),
      mood: String(account?.mood || account?.status || "Social"),
      role: overlayRoleForAccount(account, id),
      banned: isOverlayAccountBanned(account),
      avatar: accountAvatar(account)
    })).filter(item => item.id && item.username);
  }

  function renderOverlayAccounts(overlay, items) {
    const accounts = overlay?.__lzOverlayData?.accounts || {};
    const rows = uniquePeople(items);
    if (!rows.length) return '<div class="lz-chat-muted">No active accounts right now.</div>';
    const ownerCanKick = overlayIsOwner(overlay);
    return rows.map(item => {
      const id = key(item.id || item.username);
      const account = accounts[id] || accounts[key(item.username)] || item;
      const person = {
        ...item,
        id,
        username: account.username || item.username || displayName(id),
        mood: account.mood || account.status || item.mood || "Online",
        avatar: accountAvatar(account) || item.avatar || ""
      };
      const canModerate = overlayCanModerateUser(overlay, id, account);
      const banned = isOverlayAccountBanned(account);
      const dmButton = id !== overlayCurrentUserId() && !banned
        ? `<button type="button" class="lz-chat-account-action" data-lz-start-dm="${escapeHtml(id)}">DM</button>`
        : "";
      const modButtons = canModerate ? `
          <button type="button" class="lz-chat-account-action ${banned ? "" : "danger"}" data-lz-mod-user-action="${banned ? "unban" : "ban"}" data-lz-user-id="${escapeHtml(id)}">${banned ? "Unban" : "Ban"}</button>
          ${ownerCanKick ? `<button type="button" class="lz-chat-account-action" data-lz-mod-user-action="kick" data-lz-user-id="${escapeHtml(id)}">Kick</button>` : ""}
      ` : "";
      const actions = (dmButton || modButtons) ? `
        <span class="lz-chat-account-actions">
          ${dmButton}
          ${modButtons}
        </span>
      ` : '<i class="lz-chat-dot" aria-hidden="true"></i>';
      return `
        <div class="lz-chat-person">
          ${avatarHtml(person)}
          <span><strong>${escapeHtml(person.username)}</strong><span>${escapeHtml(banned ? "Banned" : (person.mood || person.role || "Online"))}</span></span>
          ${actions}
        </div>
      `;
    }).join("");
  }

  function overlayRequests(relationships, userId) {
    const rows = Object.entries(relationships || {})
      .map(([id, record]) => normalizeOverlayRelationship(record, id))
      .filter(record => record && record.status === "pending" && record.users.includes(userId));
    return {
      incoming: rows.filter(record => record.requestedBy !== userId),
      outgoing: rows.filter(record => record.requestedBy === userId)
    };
  }

  function renderOverlayUserTools(overlay) {
    const data = overlay.__lzOverlayData || {};
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    const accounts = data.accounts || {};
    const relationships = data.relationships || {};
    const requestData = overlayRequests(relationships, userId);
    const activeTab = overlay.dataset.lzPeopleTab || "add";
    const search = String(overlay.querySelector("[data-lz-user-search]")?.value || "").trim().toLowerCase();
    const tabs = overlay.querySelectorAll("[data-lz-people-tab]");
    tabs.forEach(tab => {
      const active = tab.dataset.lzPeopleTab === activeTab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    const badge = overlay.querySelector("[data-lz-request-badge]");
    if (badge) {
      badge.textContent = String(requestData.incoming.length);
      badge.classList.toggle("is-empty", requestData.incoming.length === 0);
      badge.setAttribute("aria-label", `${requestData.incoming.length} incoming invite${requestData.incoming.length === 1 ? "" : "s"}`);
    }

    const results = overlay.querySelector("[data-lz-user-results]");
    if (!results) return;

    if (!userId) {
      results.innerHTML = '<div class="lz-chat-muted">Sign in to add users and track invites.</div>';
      return;
    }

    if (activeTab === "requests") {
      const requestRows = requestData.incoming.map(record => {
        const otherId = record.users.find(id => id !== userId);
        const account = accounts[otherId] || {};
        const person = {
          id: otherId,
          username: account.username || displayName(otherId),
          mood: account.mood || "Wants to connect",
          avatar: accountAvatar(account)
        };
        return `
          <div class="lz-chat-person">
            ${avatarHtml(person)}
            <span><strong>${escapeHtml(person.username)}</strong><span>Sent you an invite</span></span>
            <span class="lz-chat-person-actions">
              <button type="button" class="lz-chat-mini-pill" data-lz-request-action="accept" data-lz-user-id="${escapeHtml(otherId)}">Accept</button>
              <button type="button" class="lz-chat-mini-pill muted" data-lz-request-action="decline" data-lz-user-id="${escapeHtml(otherId)}">Decline</button>
            </span>
          </div>
        `;
      });
      const outgoingRows = requestData.outgoing.slice(0, 4).map(record => {
        const otherId = record.users.find(id => id !== userId);
        const account = accounts[otherId] || {};
        const person = {
          id: otherId,
          username: account.username || displayName(otherId),
          mood: "Invite sent",
          avatar: accountAvatar(account)
        };
        return `
          <button type="button" class="lz-chat-person" disabled>
            ${avatarHtml(person)}
            <span><strong>${escapeHtml(person.username)}</strong><span>Invite sent</span></span>
            <span class="lz-chat-mini-pill muted">Pending</span>
          </button>
        `;
      });
      results.innerHTML = requestRows.concat(outgoingRows).join("") || '<div class="lz-chat-muted">No invites yet.</div>';
      return;
    }

    if (!search) {
      results.innerHTML = '<div class="lz-chat-muted">Search a username to send a request.</div>';
      return;
    }

    const rows = overlayAccountRows(accounts)
      .filter(person => person.id !== userId && (person.username.toLowerCase().includes(search) || person.id.includes(search)))
      .slice(0, 6);

    results.innerHTML = rows.map(person => {
      const relationship = overlayRelationshipFor(relationships, userId, person.id);
      const accepted = relationship?.status === "accepted";
      const incoming = relationship?.status === "pending" && relationship.requestedBy !== userId;
      const outgoing = relationship?.status === "pending" && relationship.requestedBy === userId;
      const label = accepted ? "Friend" : incoming ? "Invites" : outgoing ? "Sent" : "Add";
      const disabled = accepted || incoming || outgoing;
      return `
        <button type="button" class="lz-chat-person" data-lz-add-user="${escapeHtml(person.id)}" ${disabled ? "disabled" : ""}>
          ${avatarHtml(person)}
          <span><strong>${escapeHtml(person.username)}</strong><span>${escapeHtml(person.mood || person.role || "Member")}</span></span>
          <span class="lz-chat-mini-pill ${disabled ? "muted" : ""}">${escapeHtml(label)}</span>
        </button>
      `;
    }).join("") || '<div class="lz-chat-muted">No users found.</div>';
  }

  async function setOverlayFriendRelationship(overlay, targetId, status, requestedBy) {
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    const targetKey = key(targetId);
    const pairId = relationshipPairId(userId, targetKey);
    if (!pairId || !targetKey || targetKey === userId) return null;
    const relationships = overlay.__lzOverlayData?.relationships || {};
    const existing = normalizeOverlayRelationship(relationships[pairId], pairId);
    const stamp = Math.max(Date.now(), Number(existing?.updatedAt || 0) + 1);
    const record = normalizeOverlayRelationship({
      id: pairId,
      users: [userId, targetKey],
      status,
      requestedBy: key(requestedBy || userId),
      createdAt: Number(existing?.createdAt || stamp),
      updatedAt: stamp,
      updatedBy: userId
    }, pairId);
    if (!record) return null;
    await fetch(chatStateUrl(["relationships", pairId]), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    overlay.__lzOverlayData.relationships = { ...(overlay.__lzOverlayData.relationships || {}), [pairId]: record };
    renderOverlayUserTools(overlay);
    return record;
  }

  async function createOverlayParty(overlay) {
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    if (!userId) return null;
    const existing = currentUserParty(overlay.__lzOverlayData?.parties || {});
    if (existing) return { party: existing, created: false };
    const username = loggedInUsername() || currentSnapshot?.username || displayName(userId);
    const stamp = Date.now();
    const partyId = `party_${userId}_${stamp}`;
    const requestedName = cleanPartyName(overlay?.querySelector("[data-lz-party-name]")?.value, `${displayName(userId)}'s Party`);
    const party = {
      id: partyId,
      name: requestedName,
      title: requestedName,
      roomId: "global",
      hostKey: userId,
      hostName: username,
      gameKey: "none",
      status: "lobby",
      visibility: "private",
      invitees: [],
      declined: [],
      players: [userId],
      memberMap: { [userId]: true },
      game: {},
      createdAt: stamp,
      updatedAt: stamp,
      endedAt: 0
    };
    await fetch(chatStateUrl(["parties", partyId]), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(party)
    });
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    overlay.__lzOverlayData.parties = { ...(overlay.__lzOverlayData.parties || {}), [partyId]: party };
    const nameInput = overlay?.querySelector("[data-lz-party-name]");
    if (nameInput) nameInput.value = "";
    return { party, created: true };
  }

  async function openOverlayDm(overlay, targetId) {
    const userId = overlayCurrentUserId();
    const targetKey = key(targetId);
    if (!userId) throw new Error("login_required");
    if (!targetKey || targetKey === userId) throw new Error("bad_target");
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    const accounts = overlay.__lzOverlayData.accounts || {};
    let targetAccount = accounts[targetKey] || await fetchJson(chatStateUrl(["accounts", targetKey])).catch(() => null);
    if (!targetAccount || isOverlayAccountBanned(targetAccount)) throw new Error("user_unavailable");
    const members = [userId, targetKey].sort();
    const rooms = overlay.__lzOverlayData.rooms || await fetchJson(chatStateUrl(["rooms"])).catch(() => ({})) || {};
    const existing = Object.entries(rooms || {}).find(([, room]) => room && overlayRoomKind(room) === "dm" && overlaySameMembers(overlayRoomMemberIds(room), members));
    let roomId = existing?.[0] || overlayDmRoomId(userId, targetKey);
    let room = existing?.[1] || null;
    const stamp = Date.now();
    if (!room) {
      room = {
        id: roomId,
        kind: "dm",
        name: targetAccount.username || displayName(targetKey),
        icon: targetAccount.avatar || "",
        iconImage: "",
        iconUpdatedAt: 0,
        members,
        unread: {},
        topic: "Private taco line",
        createdAt: stamp,
        updatedAt: stamp,
        createdBy: userId
      };
      const response = await fetch(chatStateUrl(["rooms", roomId]), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(room)
      });
      if (!response.ok) throw new Error(`room_create_failed_${response.status}`);
      touchChatState({ updatedAt: stamp }).catch(() => {});
    }
    overlay.__lzOverlayData.rooms = { ...(rooms || {}), [roomId]: { ...room, id: roomId } };
    overlay.__lzOverlayData.accounts = { ...(accounts || {}), [targetKey]: targetAccount };
    overlay.dataset.lzMessageMode = "private";
    overlay.dataset.lzPrivateRoom = roomId;
    const roomMessages = await fetchOverlayRoomMessages(roomId, OVERLAY_MESSAGE_LIMIT).catch(() => []);
    overlay.__lzOverlayData.messages = mergeOverlayMessageRows(overlay.__lzOverlayData.messages || [], roomMessages);
    renderOverlayMessages(overlay, overlay.__lzOverlayData.messages || [], overlay.__lzOverlayData.accounts || {});
    return { roomId, room };
  }

  function partyPlayerIds(party) {
    const raw = [
      party?.hostKey,
      ...(Array.isArray(party?.players) ? party.players : Object.keys(party?.players || {})),
      ...(Array.isArray(party?.members) ? party.members : Object.keys(party?.members || {})),
      ...(party?.memberMap && typeof party.memberMap === "object" ? Object.keys(party.memberMap) : [])
    ];
    const ids = [];
    raw.forEach(item => {
      const value = typeof item === "string" ? item : (item?.id || item?.key || item?.userKey || item?.username || item?.name || "");
      const id = key(value);
      if (id && !ids.includes(id)) ids.push(id);
    });
    return ids;
  }

  function currentUserParty(parties) {
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    const active = Object.values(parties || {})
      .filter(party => party && party.status !== "ended")
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    if (!userId) return null;
    return active.find(party => partyPlayerIds(party).includes(userId)) || null;
  }

  function partyPeople(party, friends, accounts) {
    const friendById = new Map(uniquePeople(friends || []).map(item => [key(item.id || item.username), item]));
    return partyPlayerIds(party).map(id => {
      const account = accounts?.[id] || {};
      const friend = friendById.get(id) || {};
      return {
        id,
        username: account.username || friend.username || displayName(id),
        mood: account.status || friend.mood || "Online",
        avatar: accountAvatar(account) || friend.avatar || ""
      };
    });
  }

  function partyForUser(parties, userId) {
    const cleanUser = key(userId);
    if (!cleanUser) return null;
    return Object.values(parties || {})
      .filter(party => party && party.status !== "ended" && !party.endedAt)
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
      .find(party => partyPlayerIds(party).includes(cleanUser)) || null;
  }

  function currentOverlayParty(overlay) {
    const parties = overlay?.__lzOverlayData?.parties || spectateParties || {};
    return partyForUser(parties, overlayCurrentUserId());
  }

  function isSamePartyMember(parties, partyId, firstUser, secondUser) {
    const party = partyId ? (parties?.[partyId] || null) : partyForUser(parties, firstUser);
    if (!party) return false;
    const players = partyPlayerIds(party);
    return players.includes(key(firstUser)) && players.includes(key(secondUser));
  }

  function spectateRootWrite(parts, value, method = "PUT", options = {}) {
    return fetch(firebaseUrl(parts), {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      keepalive: !!options.keepalive
    });
  }

  function spectateRootPatch(parts, value, options = {}) {
    return spectateRootWrite(parts, value, "PATCH", options);
  }

  function normalizeSpectateActivity(raw, fallbackId = "") {
    if (!raw || typeof raw !== "object") return null;
    const userId = key(raw.userId || fallbackId);
    const zoneSlug = String(raw.zoneSlug || raw.slug || "").trim();
    const status = String(raw.status || "").toLowerCase();
    const updatedAt = numericStamp(raw.updatedAt || raw.at || raw.startedAt);
    return {
      userId,
      username: String(raw.username || displayName(userId)),
      partyId: String(raw.partyId || ""),
      status,
      zoneSlug,
      zoneTitle: String(raw.zoneTitle || (zoneSlug ? displayName(zoneSlug) : "")),
      spectatingPlayerId: key(raw.spectatingPlayerId || raw.playerId || ""),
      spectatingPlayerName: String(raw.spectatingPlayerName || ""),
      updatedAt
    };
  }

  function isPlayingActivity(activity) {
    return !!activity
      && activity.status === "playing"
      && !!activity.zoneSlug
      && numericStamp(activity.updatedAt) > Date.now() - SPECTATE_ACTIVITY_WINDOW_MS;
  }

  function normalizeSpectateSession(raw, fallbackId = "") {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || fallbackId || "");
    const status = String(raw.status || "active").toLowerCase();
    return {
      id,
      status,
      playerId: key(raw.playerId),
      playerName: String(raw.playerName || displayName(raw.playerId)),
      spectatorId: key(raw.spectatorId),
      spectatorName: String(raw.spectatorName || displayName(raw.spectatorId)),
      partyId: String(raw.partyId || ""),
      zoneSlug: String(raw.zoneSlug || "").trim(),
      zoneTitle: String(raw.zoneTitle || (raw.zoneSlug ? displayName(raw.zoneSlug) : "")),
      createdAt: numericStamp(raw.createdAt),
      approvedAt: numericStamp(raw.approvedAt),
      updatedAt: numericStamp(raw.updatedAt),
      endedAt: numericStamp(raw.endedAt)
    };
  }

  function activeSpectateSessions() {
    return Object.entries(spectateSessions || {})
      .map(([id, session]) => normalizeSpectateSession(session, id))
      .filter(session => session && session.status === "active" && !session.endedAt);
  }

  function sessionsForPlayer(playerId) {
    const target = key(playerId);
    return activeSpectateSessions().filter(session => session.playerId === target);
  }

  function sessionForSpectator(spectatorId) {
    const target = key(spectatorId);
    return activeSpectateSessions()
      .filter(session => session.spectatorId === target)
      .sort((a, b) => Number(b.updatedAt || b.approvedAt || 0) - Number(a.updatedAt || a.approvedAt || 0))[0] || null;
  }

  function spectateRequestsAllowed(userId) {
    const setting = spectateSettings?.[key(userId)];
    return !setting || setting.allowRequests !== false;
  }

  function applyFirebaseStreamValue(root, path, data) {
    if (!path || path === "/") return data && typeof data === "object" ? data : {};
    const parts = String(path || "").split("/").filter(Boolean).map(part => {
      try { return decodeURIComponent(part); } catch (error) { return part; }
    });
    const next = root && typeof root === "object" ? { ...root } : {};
    let cursor = next;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        if (data === null) delete cursor[part];
        else cursor[part] = data;
        return;
      }
      cursor[part] = cursor[part] && typeof cursor[part] === "object" ? { ...cursor[part] } : {};
      cursor = cursor[part];
    });
    return next;
  }

  function openRealtimeStream(url, onChange) {
    if (typeof EventSource !== "function") return null;
    const source = new EventSource(url);
    const handler = event => {
      try {
        const payload = JSON.parse(event.data || "{}");
        onChange(payload.data, payload.path || "/");
      } catch (error) {
        console.warn("Learning Zones realtime payload skipped:", error);
      }
    };
    source.addEventListener("put", handler);
    source.addEventListener("patch", handler);
    source.addEventListener("cancel", () => source.close());
    source.onerror = () => {};
    return { close: () => source.close() };
  }

  function overlayMessagesWithRealtime(rawMessages) {
    const current = overlayMessageList(rawMessages);
    if (!overlayMessageStreamReady) return current;
    const privateMessages = current.filter(message => message.room !== "global");
    const globalMessages = overlayMessageList(overlayMessageStreamState)
      .filter(message => message.room === "global");
    return mergeOverlayMessageRows(privateMessages, globalMessages);
  }

  function syncOverlayRealtimeMessages(overlay) {
    if (!overlay?.classList.contains("is-open")) return;
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    const messages = overlayMessagesWithRealtime(overlay.__lzOverlayData.messages || []);
    overlay.__lzOverlayData.messages = messages;
    renderOverlayMessages(overlay, messages, overlay.__lzOverlayData.accounts || {});
    syncChatNotificationsFromData(messages, overlay.__lzOverlayData.rooms || {}, {
      markRead: true,
      throughNow: true
    });
  }

  function stopOverlayMessageRealtime() {
    overlayMessageStreamHandle?.close?.();
    overlayMessageStreamHandle = null;
    overlayMessageStreamState = {};
    overlayMessageStreamReady = false;
    clearTimeout(overlayMessageStreamReadyTimer);
    clearInterval(overlayMessageFallbackTimer);
    overlayMessageStreamReadyTimer = 0;
    overlayMessageFallbackTimer = 0;
  }

  function startOverlayMessageRealtime(overlay) {
    stopOverlayMessageRealtime();
    if (!overlay?.classList.contains("is-open")) return;

    const applyMessages = rawMessages => {
      overlayMessageStreamState = rawMessages && typeof rawMessages === "object" ? rawMessages : {};
      overlayMessageStreamReady = true;
      clearTimeout(overlayMessageStreamReadyTimer);
      clearInterval(overlayMessageFallbackTimer);
      overlayMessageStreamReadyTimer = 0;
      overlayMessageFallbackTimer = 0;
      syncOverlayRealtimeMessages(overlay);
    };

    overlayMessageStreamHandle = openRealtimeStream(
      chatStateUrl(["messages"]),
      (data, path) => {
        applyMessages(applyFirebaseStreamValue(overlayMessageStreamState, path, data));
      }
    );

    if (!overlayMessageStreamHandle) {
      overlayMessageFallbackTimer = setInterval(() => {
        fetchRecentOverlayMessages(OVERLAY_REALTIME_MESSAGE_LIMIT, 2200)
          .then(applyMessages)
          .catch(() => {});
      }, 5000);
      return;
    }

    overlayMessageStreamReadyTimer = setTimeout(() => {
      if (overlayMessageStreamReady || !overlay.classList.contains("is-open")) return;
      fetchRecentOverlayMessages(OVERLAY_REALTIME_MESSAGE_LIMIT, 2200)
        .then(applyMessages)
        .catch(() => {});
      overlayMessageFallbackTimer = setInterval(() => {
        fetchRecentOverlayMessages(OVERLAY_REALTIME_MESSAGE_LIMIT, 2200)
          .then(applyMessages)
          .catch(() => {});
      }, 5000);
    }, 3500);
  }

  async function refreshSpectateState() {
    const userId = overlayCurrentUserId();
    const [activity, sessions, settings, parties, incoming, outgoing] = await Promise.all([
      fetchJson(firebaseUrl(["activity"])).catch(() => ({})),
      fetchJson(firebaseUrl(["spectateSessions"])).catch(() => ({})),
      fetchJson(firebaseUrl(["spectateSettings"])).catch(() => ({})),
      fetchJson(stateUrl("parties")).catch(() => ({})),
      userId ? fetchJson(firebaseUrl(["spectateRequests", userId])).catch(() => ({})) : Promise.resolve({}),
      userId ? fetchJson(firebaseUrl(["spectateRequestOutbox", userId])).catch(() => ({})) : Promise.resolve({})
    ]);
    spectateActivity = activity && typeof activity === "object" ? activity : {};
    spectateSessions = sessions && typeof sessions === "object" ? sessions : {};
    spectateSettings = settings && typeof settings === "object" ? settings : {};
    spectateParties = parties && typeof parties === "object" ? parties : {};
    spectateRequests = incoming && typeof incoming === "object" ? incoming : {};
    spectateOutbox = outgoing && typeof outgoing === "object" ? outgoing : {};
    handleSpectateStateChange();
  }

  function startSpectateRealtime() {
    if (isSpectatorFrameRoute()) return;
    const userId = overlayCurrentUserId();
    const streamKey = userId || "guest";
    if (spectateStreamKey === streamKey && spectateStreamHandles.length) return;
    spectateStreamHandles.forEach(handle => handle?.close?.());
    spectateStreamHandles = [];
    spectateStreamKey = streamKey;
    const add = (url, apply) => {
      const handle = openRealtimeStream(url, apply);
      if (handle) spectateStreamHandles.push(handle);
    };
    add(firebaseUrl(["activity"]), (data, path) => {
      spectateActivity = applyFirebaseStreamValue(spectateActivity, path, data);
      handleSpectateStateChange();
    });
    add(firebaseUrl(["spectateSessions"]), (data, path) => {
      spectateSessions = applyFirebaseStreamValue(spectateSessions, path, data);
      handleSpectateStateChange();
    });
    add(firebaseUrl(["spectateSettings"]), (data, path) => {
      spectateSettings = applyFirebaseStreamValue(spectateSettings, path, data);
      handleSpectateStateChange();
    });
    add(stateUrl("parties"), (data, path) => {
      spectateParties = applyFirebaseStreamValue(spectateParties, path, data);
      handleSpectateStateChange();
    });
    if (userId) {
      add(firebaseUrl(["spectateRequests", userId]), (data, path) => {
        spectateRequests = applyFirebaseStreamValue(spectateRequests, path, data);
        handleSpectateStateChange();
      });
      add(firebaseUrl(["spectateRequestOutbox", userId]), (data, path) => {
        spectateOutbox = applyFirebaseStreamValue(spectateOutbox, path, data);
        handleSpectateStateChange();
      });
    }
    refreshSpectateState().catch(() => {});
  }

  function spectateToast(message) {
    installChatOverlayStyles();
    let stack = document.getElementById("lz-spectate-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "lz-spectate-toast-stack";
      stack.className = "lz-spectate-toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    const toast = document.createElement("div");
    toast.className = "lz-spectate-toast";
    toast.textContent = message;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 240);
    }, 3600);
  }

  function zoneFrameSrc(slug) {
    const clean = String(slug || "").replace(/[^a-z0-9._-]/gi, "");
    return clean ? `/zone/${encodeURIComponent(clean)}?spectator=1` : "/";
  }

  function memberStatusLabel(userId) {
    const activeSession = sessionForSpectator(userId);
    if (activeSession) return `ðŸ‘ Spectating ${activeSession.playerName || displayName(activeSession.playerId)}`;
    const activity = normalizeSpectateActivity(spectateActivity?.[key(userId)], userId);
    if (isPlayingActivity(activity)) return `ðŸŽ® Playing ${activity.zoneTitle || displayName(activity.zoneSlug)}`;
    return "ðŸ  Idle";
  }

  function spectateMemberRow(overlay, member, party) {
    const userId = overlayCurrentUserId();
    const targetId = key(member.id || member.username);
    const activity = normalizeSpectateActivity(spectateActivity?.[targetId], targetId);
    const playing = isPlayingActivity(activity);
    const sameParty = isSamePartyMember(overlay?.__lzOverlayData?.parties || spectateParties || {}, party?.id, userId, targetId);
    const canAsk = playing && sameParty && targetId && targetId !== userId && spectateRequestsAllowed(targetId);
    return `
      <div class="lz-spectate-member-row">
        ${avatarHtml(member, true)}
        <div class="lz-spectate-member-copy">
          <strong>${escapeHtml(member.username || displayName(targetId))}</strong>
          <span>${escapeHtml(memberStatusLabel(targetId))}</span>
        </div>
        ${canAsk ? `<button type="button" class="lz-spectate-button" data-lz-spectate-target="${escapeHtml(targetId)}">${miniIcon("eye")} Spectate</button>` : ""}
      </div>
    `;
  }

  function renderOverlayPartyCard(overlay, party, partyMembers) {
    const partyBox = overlay.querySelector("[data-lz-party-card]");
    if (!partyBox) return;
    const userId = overlayCurrentUserId();
    const allowed = spectateRequestsAllowed(userId);
    setOverlaySectionQuietState(partyBox, !party, "No party yet");
    partyBox.hidden = !party;
    if (!party) {
      partyBox.innerHTML = "";
      return;
    }
    const spectators = sessionsForPlayer(userId);
    partyBox.innerHTML = `
      <div class="lz-chat-party-title"><span>${escapeHtml(partyDisplayName(party))}</span><span class="lz-chat-muted">${escapeHtml(party.visibility || "public")}</span></div>
      <div class="lz-chat-muted">Host: ${escapeHtml(party.hostName || displayName(party.hostKey))} &bull; ${partyMembers.length || 1} member${(partyMembers.length || 1) === 1 ? "" : "s"}</div>
      <label class="lz-spectate-toggle">
        <input type="checkbox" data-lz-spectate-toggle ${allowed ? "checked" : ""}>
        <span>Allow Party Spectate Requests</span>
      </label>
      <div class="lz-spectate-member-list">
        ${(partyMembers || []).map(member => spectateMemberRow(overlay, member, party)).join("") || '<div class="lz-chat-muted">No party members yet.</div>'}
      </div>
      ${spectators.length ? `<div class="lz-spectators-card"><strong>ðŸ‘ Spectators (${spectators.length})</strong><span>${spectators.map(session => escapeHtml(session.spectatorName || displayName(session.spectatorId))).join(", ")}</span></div>` : ""}
      <button type="button" class="lz-chat-outline" data-lz-action="party">Open Party Chat</button>
    `;
  }

  function renderOverlayPartyDock(overlay, partyMembers) {
    const dockMembers = overlay.querySelector("[data-lz-dock-members]");
    if (!dockMembers) return;
    const maxVisible = 8;
    const visibleMembers = (partyMembers || []).slice(0, maxVisible);
    const overflow = Math.max(0, (partyMembers || []).length - visibleMembers.length);
    dockMembers.innerHTML = partyMembers?.length
      ? visibleMembers.map(item => avatarHtml(item, true)).join("") + (overflow ? `<span class="lz-chat-overflow-chip">+${overflow} member${overflow === 1 ? "" : "s"}</span>` : "")
      : '<span class="lz-chat-muted">No active party</span>';
  }

  function renderSpectateOverlayPieces() {
    const overlay = document.getElementById("lz-chat-overlay");
    if (!overlay || !overlay.__lzOverlayData) return;
    const party = currentOverlayParty(overlay);
    const accounts = overlay.__lzOverlayData.accounts || {};
    const people = compactFriendList(overlay.__lzOverlayData.friends || {}, accounts);
    const partyMembers = party ? partyPeople(party, people, accounts) : [];
    renderOverlayPartyCard(overlay, party, partyMembers);
    renderOverlayPartyDock(overlay, partyMembers);
  }

  function scheduleSpectateOverlayRender() {
    clearTimeout(spectateOverlayRenderTimer);
    spectateOverlayRenderTimer = setTimeout(renderSpectateOverlayPieces, 80);
  }

  async function setSpectatePreference(allowed) {
    const userId = overlayCurrentUserId();
    if (!userId) return;
    const payload = { allowRequests: !!allowed, updatedAt: Date.now(), updatedBy: userId };
    spectateSettings = { ...(spectateSettings || {}), [userId]: payload };
    scheduleSpectateOverlayRender();
    await spectateRootWrite(["spectateSettings", userId], payload);
  }

  async function requestPartySpectate(overlay, targetId) {
    const requesterId = overlayCurrentUserId();
    const playerId = key(targetId);
    if (!requesterId) throw new Error("login_required");
    if (!playerId || playerId === requesterId) throw new Error("invalid_target");
    let parties = overlay?.__lzOverlayData?.parties || spectateParties || {};
    if (!Object.keys(parties || {}).length) parties = await fetchJson(stateUrl("parties")).catch(() => ({})) || {};
    const party = partyForUser(parties, requesterId);
    if (!party || !partyPlayerIds(party).includes(playerId)) throw new Error("not_same_party");
    const setting = await fetchJson(firebaseUrl(["spectateSettings", playerId])).catch(() => spectateSettings?.[playerId] || null);
    if (setting?.allowRequests === false) throw new Error("requests_off");
    const activity = normalizeSpectateActivity(await fetchJson(firebaseUrl(["activity", playerId])).catch(() => spectateActivity?.[playerId]), playerId);
    if (!isPlayingActivity(activity)) throw new Error("not_playing");
    const stamp = Date.now();
    const requestId = `spec_${stamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const username = loggedInUsername() || currentSnapshot?.username || displayName(requesterId);
    const playerAccount = overlay?.__lzOverlayData?.accounts?.[playerId] || {};
    const record = {
      id: requestId,
      status: "pending",
      from: requesterId,
      fromName: username,
      to: playerId,
      toName: playerAccount.username || activity.username || displayName(playerId),
      partyId: party.id || "",
      zoneSlug: activity.zoneSlug,
      zoneTitle: activity.zoneTitle || displayName(activity.zoneSlug),
      createdAt: stamp,
      updatedAt: stamp,
      expiresAt: stamp + SPECTATE_REQUEST_TTL_MS
    };
    await Promise.all([
      spectateRootWrite(["spectateRequests", playerId, requestId], record),
      spectateRootWrite(["spectateRequestOutbox", requesterId, requestId], record)
    ]);
    spectateOutbox = { ...(spectateOutbox || {}), [requestId]: record };
    return record;
  }

  async function patchSpectateRequestStatus(request, status, extra = {}) {
    const stamp = Date.now();
    const patch = { status, updatedAt: stamp, ...extra };
    await Promise.all([
      spectateRootPatch(["spectateRequests", key(request.to), request.id], patch).catch(() => null),
      spectateRootPatch(["spectateRequestOutbox", key(request.from), request.id], patch).catch(() => null)
    ]);
  }

  async function acceptSpectateRequest(request) {
    const playerId = overlayCurrentUserId();
    if (!playerId || key(request.to) !== playerId) throw new Error("not_target");
    const [parties, latestActivity, setting] = await Promise.all([
      fetchJson(stateUrl("parties")).catch(() => spectateParties || {}),
      fetchJson(firebaseUrl(["activity", playerId])).catch(() => spectateActivity?.[playerId]),
      fetchJson(firebaseUrl(["spectateSettings", playerId])).catch(() => spectateSettings?.[playerId] || null)
    ]);
    if (setting?.allowRequests === false) throw new Error("requests_off");
    const party = partyForUser(parties || spectateParties || {}, playerId);
    if (!party || !partyPlayerIds(party).includes(key(request.from))) throw new Error("not_same_party");
    const activity = normalizeSpectateActivity(latestActivity, playerId);
    if (!isPlayingActivity(activity)) throw new Error("not_playing");
    const stamp = Date.now();
    const sessionId = `sess_${request.id}`;
    const session = {
      id: sessionId,
      status: "active",
      playerId,
      playerName: loggedInUsername() || currentSnapshot?.username || displayName(playerId),
      spectatorId: key(request.from),
      spectatorName: request.fromName || displayName(request.from),
      partyId: party.id || request.partyId || "",
      zoneSlug: activity.zoneSlug || request.zoneSlug,
      zoneTitle: activity.zoneTitle || request.zoneTitle || displayName(activity.zoneSlug || request.zoneSlug),
      createdAt: stamp,
      approvedAt: stamp,
      updatedAt: stamp
    };
    await spectateRootWrite(["spectateSessions", sessionId], session);
    await patchSpectateRequestStatus(request, "accepted", { sessionId, respondedAt: stamp });
    spectateSessions = { ...(spectateSessions || {}), [sessionId]: session };
    spectateToast(`${session.spectatorName} is now spectating you.`);
    scheduleSpectateOverlayRender();
  }

  async function declineSpectateRequest(request) {
    await patchSpectateRequestStatus(request, "declined", { respondedAt: Date.now() });
  }

  async function expireSpectateRequest(request) {
    if (String(request.status || "pending") !== "pending") return;
    await patchSpectateRequestStatus(request, "expired", { expiredAt: Date.now() });
  }

  function ensureSpectateRequestStack() {
    installChatOverlayStyles();
    let stack = document.getElementById("lz-spectate-request-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "lz-spectate-request-stack";
      stack.className = "lz-spectate-request-stack";
      stack.setAttribute("aria-live", "assertive");
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showSpectateRequestPopup(request) {
    const remaining = Number(request.expiresAt || 0) - Date.now();
    if (remaining <= 0) {
      expireSpectateRequest(request).catch(() => {});
      return;
    }
    const stack = ensureSpectateRequestStack();
    if (Array.from(stack.querySelectorAll("[data-lz-spectate-request-id]")).some(item => item.dataset.lzSpectateRequestId === request.id)) return;
    const card = document.createElement("section");
    card.className = "lz-spectate-request-card";
    card.dataset.lzSpectateRequestId = request.id;
    card.innerHTML = `
      <strong>Spectate Request</strong>
      <p>${escapeHtml(request.fromName || displayName(request.from))} wants to spectate your zone.</p>
      <div class="lz-spectate-request-actions">
        <button type="button" class="lz-spectate-button primary" data-lz-spectate-accept>Accept</button>
        <button type="button" class="lz-spectate-button" data-lz-spectate-decline>Decline</button>
      </div>
    `;
    card.querySelector("[data-lz-spectate-accept]")?.addEventListener("click", () => {
      card.remove();
      acceptSpectateRequest(request).catch(error => {
        console.warn("Spectate accept failed:", error);
        spectateToast("Could not start spectating. Make sure you are still playing and in the same party.");
      });
    });
    card.querySelector("[data-lz-spectate-decline]")?.addEventListener("click", () => {
      card.remove();
      declineSpectateRequest(request).catch(() => {});
    });
    stack.appendChild(card);
    setTimeout(() => {
      if (!card.isConnected) return;
      card.remove();
      expireSpectateRequest(request).catch(() => {});
    }, remaining);
  }

  function handleIncomingSpectateRequests() {
    const userId = overlayCurrentUserId();
    if (!userId) return;
    Object.values(spectateRequests || {}).forEach(raw => {
      const request = raw && typeof raw === "object" ? { ...raw, id: String(raw.id || "") } : null;
      if (!request?.id || key(request.to) !== userId || String(request.status || "pending") !== "pending") return;
      if (Number(request.expiresAt || 0) <= Date.now()) {
        expireSpectateRequest(request).catch(() => {});
        return;
      }
      if (!spectateRequestsAllowed(userId)) {
        patchSpectateRequestStatus(request, "declined", { reason: "requests_off", respondedAt: Date.now() }).catch(() => {});
        return;
      }
      showSpectateRequestPopup(request);
    });
  }

  function handleSpectateOutbox() {
    Object.values(spectateOutbox || {}).forEach(raw => {
      const request = raw && typeof raw === "object" ? { ...raw, id: String(raw.id || "") } : null;
      if (!request?.id) return;
      const status = String(request.status || "pending").toLowerCase();
      if (status === "pending" && Number(request.expiresAt || 0) <= Date.now()) {
        const noticeKey = `expired:${request.id}`;
        if (!spectateNoticeKeys.has(noticeKey)) {
          spectateNoticeKeys.add(noticeKey);
          spectateToast("Spectate request expired.");
          expireSpectateRequest(request).catch(() => {});
        }
        return;
      }
      if (!["accepted", "declined", "expired"].includes(status)) return;
      const noticeKey = `${status}:${request.id}`;
      if (spectateNoticeKeys.has(noticeKey)) return;
      spectateNoticeKeys.add(noticeKey);
      if (status === "declined") spectateToast(`${request.toName || displayName(request.to)} declined your spectate request.`);
      else if (status === "expired") spectateToast("Spectate request expired.");
    });
  }

  async function endSpectateSession(sessionId, reason = "ended", options = {}) {
    const id = String(sessionId || activeSpectateSessionId || "");
    if (!id) return;
    const stamp = Date.now();
    await spectateRootPatch(["spectateSessions", id], {
      status: "ended",
      endedAt: stamp,
      updatedAt: stamp,
      endedBy: overlayCurrentUserId() || "site",
      reason
    }, options).catch(() => null);
    if (spectateSessions?.[id]) {
      spectateSessions[id] = { ...spectateSessions[id], status: "ended", endedAt: stamp, updatedAt: stamp, reason };
    }
    if (activeSpectateSessionId === id) closeSpectatorView(true);
    scheduleSpectateOverlayRender();
  }

  function closeSpectatorView(showToast = false) {
    const view = document.getElementById("lz-spectator-view");
    if (view) view.remove();
    document.body.classList.remove("lz-spectating-active");
    activeSpectateSessionId = "";
    if (showToast) spectateToast("Spectating ended.");
  }

  function openSpectatorView(session) {
    if (!session?.id || activeSpectateSessionId === session.id) return;
    closeSpectatorView(false);
    installChatOverlayStyles();
    activeSpectateSessionId = session.id;
    const view = document.createElement("section");
    view.id = "lz-spectator-view";
    view.className = "lz-spectator-view";
    view.setAttribute("role", "dialog");
    view.setAttribute("aria-label", `Spectating ${session.playerName || displayName(session.playerId)}`);
    view.innerHTML = `
      <div class="lz-spectator-topbar">
        <strong>ðŸ‘ Spectating ${escapeHtml(session.playerName || displayName(session.playerId))}</strong>
        <span>${escapeHtml(session.zoneTitle || displayName(session.zoneSlug))}</span>
        <button type="button" class="lz-spectate-button primary" data-lz-spectate-leave>ESC Leave</button>
      </div>
      <iframe class="lz-spectator-frame" title="Spectating ${escapeHtml(session.zoneTitle || "zone")}" src="${escapeHtml(zoneFrameSrc(session.zoneSlug))}" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"></iframe>
      <div class="lz-spectator-input-blocker" aria-hidden="true"></div>
    `;
    view.querySelector("[data-lz-spectate-leave]")?.addEventListener("click", () => endSpectateSession(session.id, "left").catch(() => closeSpectatorView(true)));
    document.body.appendChild(view);
    document.body.classList.add("lz-spectating-active");
    spectateToast(`Spectating ${session.playerName || displayName(session.playerId)}. Press ESC to stop spectating.`);
  }

  function handleActiveSpectatorSession() {
    const userId = overlayCurrentUserId();
    if (!userId) {
      if (activeSpectateSessionId) closeSpectatorView(true);
      return;
    }
    const session = sessionForSpectator(userId);
    if (!session) {
      if (activeSpectateSessionId) closeSpectatorView(true);
      return;
    }
    const playerActivity = normalizeSpectateActivity(spectateActivity?.[session.playerId], session.playerId);
    const parties = spectateParties || {};
    const stillAllowed = isPlayingActivity(playerActivity) && isSamePartyMember(parties, session.partyId, session.playerId, session.spectatorId);
    if (!stillAllowed) {
      endSpectateSession(session.id, "player_left").catch(() => closeSpectatorView(true));
      return;
    }
    openSpectatorView(session);
  }

  function handleSpectateStateChange() {
    handleIncomingSpectateRequests();
    handleSpectateOutbox();
    handleActiveSpectatorSession();
    scheduleSpectateOverlayRender();
  }

  async function publishZoneActivity(slug) {
    const userId = overlayCurrentUserId();
    const zoneSlug = String(slug || "").trim();
    if (!userId || !zoneSlug || isLoginSurface()) return;
    const party = partyForUser(spectateParties || {}, userId);
    const stamp = Date.now();
    const payload = {
      userId,
      username: loggedInUsername() || currentSnapshot?.username || displayName(userId),
      status: "playing",
      zoneSlug,
      zoneTitle: displayName(zoneSlug),
      partyId: party?.id || "",
      updatedAt: stamp,
      startedAt: spectateActivity?.[userId]?.zoneSlug === zoneSlug ? (spectateActivity?.[userId]?.startedAt || stamp) : stamp
    };
    spectateActivity = { ...(spectateActivity || {}), [userId]: payload };
    await spectateRootWrite(["activity", userId], payload, "PUT").catch(() => null);
    handleSpectateStateChange();
  }

  function startZoneActivityHeartbeat(slug) {
    const zoneSlug = String(slug || "").trim();
    if (!zoneSlug || activeZoneActivitySlug === zoneSlug) return;
    clearInterval(zoneActivityTimer);
    activeZoneActivitySlug = zoneSlug;
    publishZoneActivity(zoneSlug).catch(() => {});
    zoneActivityTimer = setInterval(() => {
      if (zoneSlugFromPath() !== zoneSlug || document.visibilityState === "hidden") return;
      publishZoneActivity(zoneSlug).catch(() => {});
    }, SPECTATE_ACTIVITY_HEARTBEAT_MS);
  }

  function clearZoneActivity(reason = "left_zone", options = {}) {
    const userId = overlayCurrentUserId();
    if (!userId || !activeZoneActivitySlug) return;
    const stamp = Date.now();
    clearInterval(zoneActivityTimer);
    zoneActivityTimer = 0;
    activeZoneActivitySlug = "";
    spectateRootPatch(["activity", userId], {
      status: "idle",
      updatedAt: stamp,
      reason
    }, options).catch(() => null);
    activeSpectateSessions()
      .filter(session => session.playerId === userId || session.spectatorId === userId)
      .forEach(session => endSpectateSession(session.id, reason, options).catch(() => {}));
  }

  function syncZoneActivityForCurrentRoute() {
    if (isSpectatorFrameRoute()) return;
    const slug = zoneSlugFromPath();
    if (slug) startZoneActivityHeartbeat(slug);
    else clearZoneActivity("left_zone");
  }

  function overlayMessageList(raw) {
    const rows = Array.isArray(raw)
      ? raw.map((message, index) => [String(index), message])
      : (raw && typeof raw === "object" ? Object.entries(raw) : []);
    return rows
      .filter(([, message]) => message && typeof message === "object" && !message.deleted)
      .map(([firebaseKey, message]) => ({
        ...message,
        firebaseKey: String(message.firebaseKey || firebaseKey || ""),
        id: String(message.id || `m_${Number(message.time || Date.now()).toString(36)}`),
        room: String(message.room || "global"),
        user: String(message.user || message.username || message.userKey || "Guest"),
        text: String(message.text || message.body || message.message || ""),
        time: numericStamp(message.time || message.createdAt || message.updatedAt)
      }))
      .filter(message => message.id && message.room)
      .sort((first, second) => Number(first.time || 0) - Number(second.time || 0));
  }

  function globalOverlayMessages(raw) {
    return overlayMessageList(raw)
      .filter(message => message.room === "global" && (message.text || message.type === "poll" || message.sticker || message.attachment))
      .slice(-12);
  }

  function mergeOverlayMessageRows(...lists) {
    const rows = new Map();
    lists.flat().filter(Boolean).forEach(message => {
      const id = String(message.firebaseKey || message.id || `${message.room || "room"}_${message.time || Date.now()}`);
      rows.set(id, message);
    });
    return Array.from(rows.values())
      .sort((first, second) => Number(first.time || 0) - Number(second.time || 0))
      .slice(-Math.max(OVERLAY_MESSAGE_LIMIT, 120));
  }

  function overlayRoomMemberIds(room) {
    const raw = Array.isArray(room?.members)
      ? room.members
      : (room?.members && typeof room.members === "object"
        ? Object.keys(room.members)
        : (Array.isArray(room?.users)
          ? room.users
          : (Array.isArray(room?.participants) ? room.participants : [])));
    const ids = [];
    raw.forEach(item => {
      const id = key(typeof item === "string" ? item : (item?.id || item?.key || item?.username || item?.userKey || ""));
      if (id && !ids.includes(id)) ids.push(id);
    });
    return ids;
  }

  function overlayRoomKind(room) {
    return String(room?.kind || room?.type || "").toLowerCase();
  }

  function overlayIsPrivateRoom(room) {
    const kindName = overlayRoomKind(room);
    return kindName === "dm" || kindName === "group" || room?.private === true;
  }

  function overlayPrivateRoomRequiresChatPlus(room) {
    const kindName = overlayRoomKind(room);
    if (kindName === "group") return true;
    return kindName === "dm" && overlayRoomMemberIds(room).length > 2;
  }

  function overlayIsChatPlusAccount(account = {}, userId = "") {
    if (overlayRoleForAccount(account, userId) === "owner") return true;
    return Number(account?.chatPlusUntil || 0) > Date.now();
  }

  function overlayVisiblePrivateRooms(rooms, userId) {
    const cleanUser = key(userId);
    if (!cleanUser) return [];
    return Object.entries(rooms || {})
      .map(([id, room]) => room && typeof room === "object" ? { ...room, id: room.id || id } : null)
      .filter(room => room && typeof room === "object" && overlayIsPrivateRoom(room))
      .filter(room => overlayRoomMemberIds(room).includes(cleanUser))
      .sort((first, second) => Number(second.updatedAt || second.createdAt || 0) - Number(first.updatedAt || first.createdAt || 0));
  }

  function overlaySameMembers(first = [], second = []) {
    const a = first.map(key).filter(Boolean).sort();
    const b = second.map(key).filter(Boolean).sort();
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }

  function overlayDmRoomId(firstUser, secondUser) {
    const members = [key(firstUser), key(secondUser)].filter(Boolean).sort();
    return members.length === 2 ? `dm_${members.join("_")}` : "";
  }

  function overlayOtherRoomMember(room, userId) {
    return overlayRoomMemberIds(room).find(id => id !== key(userId)) || "";
  }

  function overlayRoomTitle(room, userId, accounts = {}) {
    if (!room) return "Private Messages";
    const kindName = overlayRoomKind(room);
    if (kindName === "dm" && overlayRoomMemberIds(room).length === 2) {
      const otherId = overlayOtherRoomMember(room, userId);
      return accounts[otherId]?.username || displayName(otherId);
    }
    return String(room.name || room.title || (kindName === "group" ? "Group Chat" : "Private Chat"));
  }

  function overlayMessagesForRoom(raw, roomId) {
    const cleanRoom = String(roomId || "").trim();
    if (!cleanRoom) return [];
    return overlayMessageList(raw)
      .filter(message => message.room === cleanRoom && (message.text || message.type === "poll" || message.sticker || message.attachment))
      .slice(-12);
  }

  function overlayMessageMode(overlay) {
    return overlay?.dataset?.lzMessageMode === "private" ? "private" : "global";
  }

  function overlaySelectedPrivateRoomId(overlay) {
    const userId = overlayCurrentUserId();
    const rooms = overlayVisiblePrivateRooms(overlay?.__lzOverlayData?.rooms || {}, userId);
    const selected = String(overlay?.dataset?.lzPrivateRoom || "");
    if (selected && rooms.some(room => room.id === selected)) return selected;
    const fallback = rooms.find(room => overlayRoomKind(room) === "dm" && overlayRoomMemberIds(room).length === 2) || rooms[0];
    const next = String(fallback?.id || "");
    if (overlay) overlay.dataset.lzPrivateRoom = next;
    return next;
  }

  function overlaySelectedRoomId(overlay) {
    return overlayMessageMode(overlay) === "private" ? overlaySelectedPrivateRoomId(overlay) : "global";
  }

  function overlayMessageAuthor(message, accounts = {}) {
    const id = key(message.user || message.username || message.userKey);
    const account = accounts[id] || {};
    return {
      id,
      username: account.username || message.user || displayName(id),
      avatar: accountAvatar(account)
    };
  }

  function overlayMessageBody(message) {
    if (message.type === "poll" && message.poll) return `Poll: ${message.poll.question || "Untitled poll"}`;
    if (message.sticker && !message.text) return String(message.sticker);
    if (message.attachment && !message.text) return "Shared an attachment.";
    return message.text || "";
  }

  function overlayGlobalChatEmptyHtml() {
    return `
      <div class="lz-global-chat-empty" role="status" aria-live="polite">
        <div class="lz-global-chat-empty-card">
          <div class="lz-global-chat-empty-icon" aria-hidden="true">&#128075;</div>
          <strong>Welcome to Global Chat!</strong>
          <p>Nobody's talking yet...<br>Be the first &#128526;</p>
          <ul>
            <li>Find people to play with</li>
            <li>Share your high scores</li>
            <li>Talk about zones</li>
          </ul>
        </div>
      </div>
    `;
  }

  function overlayTimeDetails(stamp) {
    const time = numericStamp(stamp);
    if (!time) return { label: "", full: "", iso: "" };
    const diff = Math.max(0, Date.now() - time);
    const date = new Date(time);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label = "";
    if (diff < 45 * 1000) label = "Just now";
    else if (diff < 60 * 60 * 1000) label = `${Math.max(1, Math.floor(diff / 60000))} min ago`;
    else if (date.toDateString() === today.toDateString()) label = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    else if (date.toDateString() === yesterday.toDateString()) label = `Yesterday ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    else label = `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    return {
      label,
      full: date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      iso: date.toISOString()
    };
  }

  function overlayTimeLabel(stamp) {
    return overlayTimeDetails(stamp).label;
  }

  function overlayMessageTextHtml(text) {
    const currentUser = overlayCurrentUserId();
    return escapeHtml(text).replace(/(^|\s)@([a-zA-Z0-9_]{3,32})/g, (match, prefix, username) => {
      const isMe = key(username) === currentUser;
      return `${prefix}<span class="lz-chat-mention ${isMe ? "is-me" : ""}">@${escapeHtml(username)}</span>`;
    }).replace(/\n/g, "<br>");
  }

  function overlayMessageKey(message) {
    return String(message?.firebaseKey || message?.id || "");
  }

  function overlayMessageIsMine(message) {
    const currentUser = overlayCurrentUserId();
    return !!currentUser && key(message?.user || message?.username || "") === currentUser;
  }

  function overlayMessageMentionsMe(message) {
    const currentUser = overlayCurrentUserId();
    return !!currentUser && new RegExp(`(^|\\s)@${currentUser}(?=\\b|\\s|$)`, "i").test(String(message?.text || ""));
  }

  function overlayIsMessageFeedAtBottom(overlay) {
    const scroller = overlay.querySelector(".lz-chat-messages");
    if (!scroller) return true;
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  }

  function chatTypingPathKey(value, fallback = "global") {
    const clean = String(value || "").trim().replace(/[.#$\[\]/]+/g, "_").slice(0, 120);
    return clean || fallback;
  }

  function overlayTypingClientId() {
    if (overlayTypingSignalClientId) return overlayTypingSignalClientId;
    const storageKey = "lz_chat_typing_client_v1";
    try {
      overlayTypingSignalClientId = chatTypingPathKey(sessionStorage.getItem(storageKey), "");
      if (!overlayTypingSignalClientId) {
        const random = window.crypto?.randomUUID?.()
          || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
        overlayTypingSignalClientId = chatTypingPathKey(`site_${random}`, "site_browser");
        sessionStorage.setItem(storageKey, overlayTypingSignalClientId);
      }
    } catch (error) {
      overlayTypingSignalClientId = chatTypingPathKey(
        `site_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
        "site_browser"
      );
    }
    return overlayTypingSignalClientId;
  }

  function overlayTypingRoomId(overlay) {
    return chatTypingPathKey(overlaySelectedRoomId(overlay) || "global");
  }

  function commitOverlayTypingSignal(active, roomId) {
    const userId = overlayCurrentUserId();
    const room = chatTypingPathKey(roomId || "global");
    if (!userId) return Promise.resolve(false);
    const path = [room, userId, overlayTypingClientId()];
    if (!active) return writeChatTyping(path, null, "DELETE").catch(() => false);
    return writeChatTyping(path, {
      username: loggedInUsername() || currentSnapshot?.username || userId,
      at: Date.now()
    }).then(() => true).catch(() => false);
  }

  function clearOverlayTypingSignal() {
    clearTimeout(overlayTypingSignalTimer);
    clearTimeout(overlayTypingSignalClearTimer);
    overlayTypingSignalTimer = 0;
    overlayTypingSignalClearTimer = 0;
    const room = overlayTypingSignalRoom;
    overlayTypingSignalRoom = "";
    if (room) commitOverlayTypingSignal(false, room);
  }

  function scheduleOverlayTypingSignal(overlay, active) {
    clearTimeout(overlayTypingSignalClearTimer);
    if (!active || !overlay?.classList.contains("is-open")) {
      clearOverlayTypingSignal();
      return;
    }
    const room = overlayTypingRoomId(overlay);
    const elapsed = Date.now() - overlayTypingSignalLastAt;
    const publish = () => {
      overlayTypingSignalTimer = 0;
      if (overlayTypingSignalRoom && overlayTypingSignalRoom !== room) {
        commitOverlayTypingSignal(false, overlayTypingSignalRoom);
      }
      overlayTypingSignalRoom = room;
      overlayTypingSignalLastAt = Date.now();
      commitOverlayTypingSignal(true, room);
    };
    clearTimeout(overlayTypingSignalTimer);
    if (!overlayTypingSignalRoom || elapsed >= CHAT_TYPING_PUBLISH_INTERVAL_MS) publish();
    else overlayTypingSignalTimer = setTimeout(publish, CHAT_TYPING_PUBLISH_INTERVAL_MS - elapsed);
    overlayTypingSignalClearTimer = setTimeout(clearOverlayTypingSignal, CHAT_TYPING_IDLE_MS);
  }

  function ensureOverlayStatusRail(overlay) {
    let rail = overlay.querySelector("[data-lz-overlay-status-rail]");
    if (rail) return rail;
    const composer = overlay.querySelector(".lz-chat-right-composer");
    if (!composer) return null;
    rail = document.createElement("div");
    rail.className = "lz-chat-status-rail";
    rail.dataset.lzOverlayStatusRail = "true";
    composer.insertBefore(rail, composer.firstChild);
    return rail;
  }

  function ensureOverlayNewMessageButton(overlay) {
    let button = overlay.querySelector("[data-lz-overlay-new-messages]");
    if (button) return button;
    const rail = ensureOverlayStatusRail(overlay);
    if (!rail) return null;
    button = document.createElement("button");
    button.type = "button";
    button.className = "lz-chat-new-message-indicator";
    button.hidden = true;
    button.dataset.lzOverlayNewMessages = "true";
    button.innerHTML = '<span aria-hidden="true">&#8595;</span> New messages';
    button.addEventListener("click", () => {
      button.hidden = true;
      const scroller = overlay.querySelector(".lz-chat-messages");
      scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      overlay.querySelector(".lz-chat-message-input")?.focus();
    });
    rail.appendChild(button);
    return button;
  }

  function updateOverlayNewMessageButton(overlay, count, wasAtBottom) {
    const button = ensureOverlayNewMessageButton(overlay);
    if (!button) return;
    if (!count || wasAtBottom) {
      button.hidden = true;
      return;
    }
    button.innerHTML = `<span aria-hidden="true">&#8595;</span> ${count > 1 ? `${count} new messages` : "New message"}`;
    button.hidden = false;
  }

  function ensureOverlayTypingIndicator(overlay) {
    let typing = overlay.querySelector("[data-lz-overlay-typing]");
    if (typing) return typing;
    const rail = ensureOverlayStatusRail(overlay);
    if (!rail) return null;
    typing = document.createElement("div");
    typing.className = "lz-chat-typing-indicator";
    typing.hidden = true;
    typing.dataset.lzOverlayTyping = "true";
    typing.setAttribute("aria-live", "polite");
    typing.innerHTML = '<span>typing</span><i></i><i></i><i></i>';
    rail.appendChild(typing);
    return typing;
  }

  function overlayPrivateEmptyHtml() {
    return `
      <div class="lz-chat-feed-empty">
        <strong>Private messages</strong>
        <span>One-on-one DMs are free. Pick an active account and tap DM to start.</span>
      </div>
    `;
  }

  function renderOverlayPrivateRooms(overlay) {
    const box = overlay.querySelector("[data-lz-private-rooms]");
    if (!box) return;
    const mode = overlayMessageMode(overlay);
    box.hidden = mode !== "private";
    if (mode !== "private") {
      box.innerHTML = "";
      return;
    }
    const userId = overlayCurrentUserId();
    const data = overlay.__lzOverlayData || {};
    const accounts = data.accounts || {};
    const rooms = overlayVisiblePrivateRooms(data.rooms || {}, userId);
    const selected = overlaySelectedPrivateRoomId(overlay);
    if (!rooms.length) {
      box.innerHTML = '<div class="lz-chat-muted">No private messages yet. Open Active Accounts and choose DM.</div>';
      return;
    }
    box.innerHTML = rooms.map(room => {
      const members = overlayRoomMemberIds(room);
      const otherId = overlayOtherRoomMember(room, userId);
      const person = members.length === 2
        ? {
          id: otherId,
          username: accounts[otherId]?.username || overlayRoomTitle(room, userId, accounts),
          avatar: accountAvatar(accounts[otherId] || {})
        }
        : { id: room.id, username: overlayRoomTitle(room, userId, accounts), avatar: "" };
      const locked = overlayPrivateRoomRequiresChatPlus(room) && !overlayIsChatPlusAccount(accounts[userId] || currentSnapshot || {}, userId);
      return `
        <button type="button" class="lz-chat-private-room ${room.id === selected ? "active" : ""} ${locked ? "is-locked" : ""}" data-lz-private-room="${escapeHtml(room.id)}">
          ${members.length === 2 ? avatarHtml(person) : '<span class="lz-chat-private-icon" aria-hidden="true">&#128101;</span>'}
          <span><strong>${escapeHtml(overlayRoomTitle(room, userId, accounts))}</strong><em>${locked ? "Chat+ group" : members.length === 2 ? "Free DM" : "Private chat"}</em></span>
        </button>
      `;
    }).join("");
  }

  function renderOverlayMessageChrome(overlay) {
    const mode = overlayMessageMode(overlay);
    const userId = overlayCurrentUserId();
    const data = overlay.__lzOverlayData || {};
    const accounts = data.accounts || {};
    const selectedRoomId = overlaySelectedRoomId(overlay);
    const selectedRoom = selectedRoomId ? data.rooms?.[selectedRoomId] : null;
    overlay.querySelectorAll("[data-lz-message-tab]").forEach(tab => {
      const active = tab.dataset.lzMessageTab === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderOverlayPrivateRooms(overlay);

    const title = overlay.querySelector("[data-lz-current-chat-title]");
    if (title) {
      title.innerHTML = mode === "private"
        ? `<span aria-hidden="true">&#128274;</span>${escapeHtml(selectedRoom ? overlayRoomTitle(selectedRoom, userId, accounts) : "Private Messages")}`
        : `<span aria-hidden="true">&#127758;</span>Global Chat`;
    }
    const note = overlay.querySelector("[data-lz-current-chat-note]");
    if (note) {
      note.textContent = mode === "private"
        ? (selectedRoom ? "One-on-one DMs are free. Group chats keep the Chat+ lock." : "Pick a DM or start one from Active Accounts.")
        : "Global Chat uses the normal public chat rules.";
    }
    const input = overlay.querySelector(".lz-chat-message-input");
    const send = overlay.querySelector(".lz-chat-send");
    let locked = false;
    let placeholder = "Type a message...";
    if (mode === "private") {
      if (!selectedRoom) {
        locked = true;
        placeholder = "Start a private DM first.";
      } else if (overlayPrivateRoomRequiresChatPlus(selectedRoom) && !overlayIsChatPlusAccount(accounts[userId] || currentSnapshot || {}, userId)) {
        locked = true;
        placeholder = "Chat+ required for group chats.";
      } else {
        placeholder = `Message ${overlayRoomTitle(selectedRoom, userId, accounts)}`;
      }
    } else {
      placeholder = "Message Global Chat";
    }
    if (input) {
      input.disabled = locked;
      input.placeholder = placeholder;
    }
    if (send) send.disabled = locked;
  }

  function renderOverlayMessages(overlay, rawMessages, accounts = {}) {
    const box = overlay.querySelector("[data-lz-overlay-messages]");
    if (!box) return;
    renderOverlayMessageChrome(overlay);
    const mode = overlayMessageMode(overlay);
    const selectedRoomId = overlaySelectedRoomId(overlay);
    const rows = mode === "private" ? overlayMessagesForRoom(rawMessages, selectedRoomId) : globalOverlayMessages(rawMessages);
    const canModerate = overlayIsAdmin(overlay);
    const contextKey = `${mode}:${selectedRoomId || "global"}`;
    const contextChanged = !!(box.dataset.lzOverlayContext && box.dataset.lzOverlayContext !== contextKey);
    const previousKeys = new Set(Array.from(box.querySelectorAll("[data-lz-message-key]")).map(node => node.dataset.lzMessageKey).filter(Boolean));
    const wasRendered = box.dataset.lzOverlayRendered === "true";
    const wasAtBottom = overlayIsMessageFeedAtBottom(overlay);
    const messageLookup = new Map((Array.isArray(rawMessages) ? rawMessages : []).map(message => [message.id, message]));
    let newMessageCount = 0;
    if (mode === "private" && !selectedRoomId) {
      box.innerHTML = overlayPrivateEmptyHtml();
      updateOverlayNewMessageButton(overlay, 0, true);
      return;
    }
    box.innerHTML = rows.length ? rows.map(message => {
      const person = overlayMessageAuthor(message, accounts);
      const messageKey = overlayMessageKey(message);
      const keyAttr = escapeHtml(messageKey);
      const time = overlayTimeDetails(message.time);
      const isNew = wasRendered && !contextChanged && messageKey && !previousKeys.has(messageKey);
      const isMine = overlayMessageIsMine(message);
      const isMentioned = overlayMessageMentionsMe(message);
      const body = overlayMessageTextHtml(overlayMessageBody(message));
      const reply = message.replyTo ? messageLookup.get(message.replyTo) : null;
      if (isNew) newMessageCount += 1;
      return `
        <div class="lz-chat-message-card ${isMine ? "is-mine" : ""} ${isNew ? "just-arrived" : ""} ${isMentioned ? "is-mentioned" : ""}" data-lz-message-id="${escapeHtml(message.id)}" data-lz-message-key="${keyAttr}">
          <div class="lz-chat-message-row">
            ${avatarHtml(person)}
            <div class="lz-chat-message-copy">
              <strong>${escapeHtml(person.username)}</strong>
              ${reply ? `<div class="lz-chat-reply-card"><b>${escapeHtml(overlayMessageAuthor(reply, accounts).username)}</b><span>${overlayMessageTextHtml(String(overlayMessageBody(reply)).slice(0, 90))}</span></div>` : ""}
              <p class="lz-chat-message-text">${body}</p>
            </div>
            <div class="lz-chat-message-meta">
              <time datetime="${escapeHtml(time.iso)}" title="${escapeHtml(time.full)}" aria-label="${escapeHtml(time.full)}">${escapeHtml(time.label)}</time>
              <div class="lz-chat-message-actions">
                <button type="button" class="lz-chat-message-action" data-lz-reply-message="${escapeHtml(message.id)}" data-lz-reply-user="${escapeHtml(person.username)}">Reply</button>
                ${canModerate ? `<button type="button" class="lz-chat-message-action danger" data-lz-mod-action="delete-message" data-lz-message-id="${escapeHtml(message.id)}" data-lz-message-key="${keyAttr}">Delete</button>` : ""}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("") : (mode === "private" ? overlayPrivateEmptyHtml() : overlayGlobalChatEmptyHtml());
    box.dataset.lzOverlayRendered = "true";
    box.dataset.lzOverlayContext = contextKey;
    updateOverlayNewMessageButton(overlay, newMessageCount, wasAtBottom);
    scheduleScrollReveal(box, 40);
    if (wasAtBottom) {
      requestAnimationFrame(() => {
        const scroller = overlay.querySelector(".lz-chat-messages");
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    }
  }

  async function sendOverlayMessageToCloud(text, roomId = "global", overlay = null) {
    const username = loggedInUsername() || currentSnapshot?.username;
    if (!username) throw new Error("login_required");
    const userId = key(username);
    const targetRoomId = String(roomId || "global").trim() || "global";
    const siteResult = await sendOverlayMessageThroughSite(text, targetRoomId);
    if (siteResult) return siteResult;
    const cached = overlay?.__lzOverlayData || {};
    const [filters, accountFallback, roomFallback] = await Promise.all([
      fetchJson(chatStateUrl(["filters"]), 1800).catch(() => []),
      cached.accounts?.[userId]
        ? Promise.resolve(null)
        : fetchJson(chatStateUrl(["accounts", userId]), 1800).catch(() => null),
      targetRoomId === "global" || cached.rooms?.[targetRoomId]
        ? Promise.resolve(null)
        : fetchJson(chatStateUrl(["rooms", targetRoomId]), 1800).catch(() => null)
    ]);
    const globalEnabled = typeof cached.globalEnabled === "boolean" ? cached.globalEnabled : true;
    const account = cached.accounts?.[userId] || accountFallback;
    const targetRoom = targetRoomId === "global" ? null : (cached.rooms?.[targetRoomId] || roomFallback);
    const role = overlayRoleForAccount(account || { username, role: currentSnapshot?.role }, userId);
    if (isOverlayAccountBanned(account || {})) throw new Error("banned");
    if (targetRoomId === "global") {
      if (globalEnabled === false && !["owner", "admin"].includes(role)) throw new Error("global_disabled");
    } else {
      if (!targetRoom || !overlayIsPrivateRoom(targetRoom)) throw new Error("room_unavailable");
      const members = overlayRoomMemberIds(targetRoom);
      if (!members.includes(userId)) throw new Error("room_forbidden");
      if (overlayPrivateRoomRequiresChatPlus(targetRoom) && !overlayIsChatPlusAccount(account || {}, userId)) {
        throw new Error("chatplus_required");
      }
      if (overlay) {
        overlay.__lzOverlayData = overlay.__lzOverlayData || {};
        overlay.__lzOverlayData.rooms = { ...(overlay.__lzOverlayData.rooms || {}), [targetRoomId]: { ...targetRoom, id: targetRoomId } };
      }
    }
    const blocked = overlayFilterForText(text, filters);
    if (blocked) throw new Error(`filtered:${blocked}`);
    const stamp = Date.now();
    const message = {
      id: `m${stamp.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      room: targetRoomId,
      user: username,
      text,
      time: stamp,
      createdAt: stamp,
      updatedAt: stamp,
      reactions: {},
      replies: [],
      replyTo: null,
      attachment: null
    };
    const saved = await postFirebaseJson(chatStateUrl(["messages"]), message);
    const firebaseKey = String(saved?.name || "").trim();
    if (!firebaseKey) throw new Error("send_failed_write");
    message.firebaseKey = firebaseKey;
    fetch(chatStateUrl([]), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updatedAt: stamp })
    }).catch(() => {});
    return { message, messages: [message] };
  }

  async function deleteOverlayMessage(overlay, messageId, messageKey) {
    if (!overlayIsAdmin(overlay)) throw new Error("admin_required");
    const id = String(messageId || "").trim();
    const firebaseKey = String(messageKey || id).trim();
    if (!id || !firebaseKey) throw new Error("missing_message");
    const actor = loggedInUsername() || currentSnapshot?.username || "Moderator";
    const stamp = Date.now();
    const existing = overlayMessageList(overlay.__lzOverlayData?.messages || []).find(message => message.id === id || message.firebaseKey === firebaseKey);
    const roomId = existing?.room || overlaySelectedRoomId(overlay) || "global";
    const roomLabel = roomId === "global" ? "Global Chat" : "a private chat";
    await Promise.all([
      patchChatState(["messages", firebaseKey], { deleted: true, deletedAt: stamp, deletedBy: actor, updatedAt: stamp }),
      writeChatState(["deletedMessages", id], { at: stamp, room: roomId, by: actor }),
      appendOverlayModLog(`${actor} deleted a message from ${roomLabel} in the overlay.`),
      touchChatState()
    ]);
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    overlay.__lzOverlayData.messages = (overlay.__lzOverlayData.messages || []).filter(message => message.id !== id);
    renderOverlayMessages(overlay, overlay.__lzOverlayData.messages, overlay.__lzOverlayData.accounts || {});
  }

  async function clearOverlayGlobal(overlay) {
    if (!overlayIsAdmin(overlay)) throw new Error("admin_required");
    const actor = loggedInUsername() || currentSnapshot?.username || "Moderator";
    const stamp = Date.now();
    const map = await fetchGlobalMessageMap();
    const entries = Object.entries(map || {}).filter(([, message]) => message && typeof message === "object" && !message.deleted);
    if (!entries.length) return { cleared: 0 };
    const messagePatch = {};
    const tombstonePatch = {};
    entries.forEach(([firebaseKey, message]) => {
      const id = String(message.id || firebaseKey);
      messagePatch[firebaseKey] = null;
      tombstonePatch[id] = { at: stamp, room: "global", by: actor };
    });
    await Promise.all([
      patchChatState(["messages"], messagePatch),
      patchChatState(["deletedMessages"], tombstonePatch),
      appendOverlayModLog(`Global Chat was cleared from the overlay by ${actor}.`),
      touchChatState()
    ]);
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    overlay.__lzOverlayData.messages = [];
    renderOverlayMessages(overlay, [], overlay.__lzOverlayData.accounts || {});
    return { cleared: entries.length };
  }

  async function toggleOverlayGlobal(overlay) {
    if (!overlayIsOwner(overlay)) throw new Error("owner_required");
    const actor = loggedInUsername() || currentSnapshot?.username || "Owner";
    const current = await fetchJson(chatStateUrl(["globalEnabled"])).catch(() => true);
    const enabled = current === false;
    const stamp = Date.now();
    await Promise.all([
      patchChatState([], { globalEnabled: enabled, globalEnabledUpdatedAt: stamp, moderationUpdatedAt: stamp, updatedAt: stamp }),
      appendOverlayModLog(`Public chats ${enabled ? "enabled" : "disabled"} globally from the overlay by ${actor}.`)
    ]);
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    overlay.__lzOverlayData.globalEnabled = enabled;
    renderOverlayModerationTools(overlay);
    return enabled;
  }

  async function setOverlayUserBan(overlay, targetId, enabled) {
    if (!overlayIsAdmin(overlay)) throw new Error("admin_required");
    const targetKey = key(targetId);
    const account = await fetchJson(chatStateUrl(["accounts", targetKey])).catch(() => null);
    if (!account || !overlayCanModerateUser(overlay, targetKey, account)) throw new Error("protected_target");
    const actor = loggedInUsername() || currentSnapshot?.username || "Moderator";
    const stamp = Date.now();
    const patch = enabled ? {
      banned: true,
      bannedUntil: 0,
      bannedAt: stamp,
      banUpdatedAt: stamp,
      bannedBy: actor,
      banReason: "Overlay moderation",
      status: "off",
      updatedAt: stamp
    } : {
      banned: false,
      bannedUntil: 0,
      bannedAt: 0,
      banUpdatedAt: stamp,
      bannedBy: "",
      banReason: "",
      updatedAt: stamp
    };
    await Promise.all([
      patchChatState(["accounts", targetKey], patch),
      enabled ? removeChatState(["presence", targetKey]).catch(() => null) : Promise.resolve(null),
      appendOverlayModLog(`${account.username || targetKey} was ${enabled ? "banned" : "unbanned"} from the overlay by ${actor}.`),
      touchChatState({ moderationUpdatedAt: stamp })
    ]);
    overlay.__lzOverlayData = overlay.__lzOverlayData || {};
    overlay.__lzOverlayData.accounts = overlay.__lzOverlayData.accounts || {};
    overlay.__lzOverlayData.accounts[targetKey] = { ...account, ...patch };
  }

  async function kickOverlayUser(overlay, targetId) {
    if (!overlayIsOwner(overlay)) throw new Error("owner_required");
    const targetKey = key(targetId);
    const account = await fetchJson(chatStateUrl(["accounts", targetKey])).catch(() => null);
    if (!account || !overlayCanModerateUser(overlay, targetKey, account)) throw new Error("protected_target");
    const actor = loggedInUsername() || currentSnapshot?.username || "Owner";
    const room = await fetchJson(chatStateUrl(["rooms", "global"])).catch(() => null) || {};
    const members = Array.isArray(room.members) ? room.members.filter(member => key(member) !== targetKey) : [];
    await Promise.all([
      writeChatState(["rooms", "global", "members"], members),
      removeChatState(["presence", targetKey]).catch(() => null),
      appendOverlayModLog(`${account.username || targetKey} was kicked from Global Chat from the overlay by ${actor}.`),
      touchChatState()
    ]);
  }

  function renderOverlayModerationTools(overlay) {
    const box = overlay.querySelector("[data-lz-mod-tools]");
    if (!box) return;
    box.hidden = true;
    box.innerHTML = "";
  }

  async function hydrateOverlayPanels(overlay) {
    if (!overlay?.classList.contains("is-open")) return;
    const cached = overlay.__lzOverlayData || {};
    const [parties, relationships, presence, messages, globalEnabled, roomsRaw, activity, sessions, settings] = await Promise.all([
      fetchJson(stateUrl("parties")).catch(() => ({})),
      fetchJson(stateUrl("relationships")).catch(() => ({})),
      fetchJson(stateUrl("presence")).catch(() => ({})),
      fetchRecentOverlayMessages(OVERLAY_REALTIME_MESSAGE_LIMIT).catch(() => []),
      fetchJson(chatStateUrl(["globalEnabled"])).catch(() => true),
      fetchJson(stateUrl("rooms")).catch(() => ({})),
      fetchJson(firebaseUrl(["activity"])).catch(() => spectateActivity || {}),
      fetchJson(firebaseUrl(["spectateSessions"])).catch(() => spectateSessions || {}),
      fetchJson(firebaseUrl(["spectateSettings"])).catch(() => spectateSettings || {})
    ]);
    spectateParties = parties && typeof parties === "object" ? parties : {};
    spectateActivity = activity && typeof activity === "object" ? activity : spectateActivity;
    spectateSessions = sessions && typeof sessions === "object" ? sessions : spectateSessions;
    spectateSettings = settings && typeof settings === "object" ? settings : spectateSettings;
    const currentUserId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    const rooms = roomsRaw && typeof roomsRaw === "object"
      ? Object.fromEntries(Object.entries(roomsRaw).map(([id, room]) => [id, { ...(room || {}), id: room?.id || id }]))
      : {};
    const provisionalParty = currentUserParty(parties || {});
    const accountIds = [
      currentUserId,
      ...messages.map(message => message.user || message.username || message.userKey),
      ...partyPlayerIds(provisionalParty || {}),
      ...overlayVisiblePrivateRooms(rooms, currentUserId).flatMap(room => overlayRoomMemberIds(room)),
      ...activeSpectateSessions().flatMap(session => [session.playerId, session.spectatorId])
    ];
    const fetchedAccounts = await fetchAccountsByIds(accountIds, cached.accounts || {});
    const accounts = { ...(cached.accounts || {}), ...fetchedAccounts };
    if (currentUserId && currentSnapshot) {
      accounts[currentUserId] = {
        ...(accounts[currentUserId] || {}),
        username: currentSnapshot.username || displayName(currentUserId),
        avatar: currentSnapshot.profile?.avatar || accounts[currentUserId]?.avatar || "",
        status: currentSnapshot.profile?.presence || accounts[currentUserId]?.status || "online",
        mood: currentSnapshot.profile?.mood || accounts[currentUserId]?.mood || "Social"
      };
    }
    overlay.__lzOverlayData = { ...(cached || {}), rooms };
    let overlayMessages = messages || [];
    const selectedRoomId = overlaySelectedRoomId(overlay);
    if (selectedRoomId && selectedRoomId !== "global") {
      const roomMessages = await fetchOverlayRoomMessages(selectedRoomId, OVERLAY_MESSAGE_LIMIT).catch(() => []);
      overlayMessages = mergeOverlayMessageRows(overlayMessages, roomMessages);
    }
    overlayMessages = overlayMessagesWithRealtime(overlayMessages);
    const friends = cached.friends || {};
    const onlinePeople = onlineAccountRows(accounts || {});
    const presencePeople = presenceRows(presence || {}, accounts || {});
    const people = compactFriendList(friends || {}, accounts || {});
    const party = provisionalParty;
    const partyMembers = party ? partyPeople(party, people, accounts) : [];
    const members = presencePeople.length || onlinePeople.length || (loggedInUsername() ? 1 : 0);
    const activePeople = presencePeople.length ? presencePeople : (onlinePeople.length ? onlinePeople : people);

    overlay.__lzOverlayData = {
      rooms: rooms || {},
      parties: parties || {},
      friends: friends || {},
      accounts: accounts || {},
      relationships: relationships || {},
      messages: overlayMessages || [],
      globalEnabled: globalEnabled !== false
    };
    renderOverlayUserTools(overlay);
    renderOverlayModerationTools(overlay);
    renderOverlayMessages(overlay, overlayMessages || [], accounts || {});
    syncChatNotificationsFromData(overlayMessages || [], rooms || {}, { markRead: true, throughNow: true });

    const peopleBox = overlay.querySelector("[data-lz-active-chats]");
    if (peopleBox) {
      const visibleActivePeople = uniquePeople(activePeople)
        .filter(item => key(item.id || item.username) !== currentUserId)
        .slice(0, 6);
      peopleBox.innerHTML = renderPeople(visibleActivePeople);
      setOverlaySectionQuietState(peopleBox, !visibleActivePeople.length, "Nothing active");
    }

    const channelBox = overlay.querySelector("[data-lz-channels]");
    if (channelBox) {
      channelBox.innerHTML = `
        <button type="button" class="lz-chat-channel" data-lz-message-tab="global" role="tab">&#127758; Global Chat</button>
        <button type="button" class="lz-chat-channel" data-lz-message-tab="private" role="tab">&#128274; Private Messages</button>
      `;
      renderOverlayMessageChrome(overlay);
    }

    renderOverlayPartyCard(overlay, party, partyMembers);

    const memberCount = overlay.querySelector("[data-lz-member-count]");
    if (memberCount) memberCount.textContent = `${members || 1} online`;
    const activeAccountCount = overlay.querySelector("[data-lz-active-account-count]");
    if (activeAccountCount) activeAccountCount.textContent = `${members || 1} online`;
    updateInlineOnlineCounters(overlay, members || 1);

    const memberBox = overlay.querySelector("[data-lz-members]");
    if (memberBox) memberBox.innerHTML = renderOverlayAccounts(overlay, activePeople.slice(0, 8));

    renderOverlayPartyDock(overlay, partyMembers);
  }

  function findSiteTopBar() {
    const semanticHeader = document.querySelector('[data-testid="site-header"]') || document.querySelector("header");
    if (semanticHeader && isActuallyVisible(semanticHeader)) return semanticHeader;
    const root = document.getElementById("root") || document.body;
    const candidates = Array.from(root?.querySelectorAll?.("div") || []);
    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
    return candidates.find(el => {
      if (!isActuallyVisible(el)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.top > 6 || rect.height < 40 || rect.height > 90 || rect.width < Math.min(480, viewportWidth * 0.7)) return false;
      const style = getComputedStyle(el);
      if (style.display !== "flex" || style.alignItems !== "center") return false;
      const controls = Array.from(el.querySelectorAll("button,a"));
      const hasAction = controls.some(control => /save|logout/i.test(control.textContent || ""));
      const hasTitle = !!el.querySelector("h1") || /library|zones|games/i.test(el.textContent || "");
      return hasAction && hasTitle;
    }) || null;
  }

  function updateChatOverlayHeaderMetrics() {
    const fullscreen = syncFullscreenOverlayState();
    if (fullscreen) {
      const viewportTop = Math.max(0, Math.round(window.visualViewport?.offsetTop || 0));
      const immersiveExit = getImmersiveExitControl();
      const exitBottom = immersiveExit
        ? Math.ceil(immersiveExit.getBoundingClientRect().bottom)
        : 0;
      const controlTop = Math.max(74, viewportTop + 74, exitBottom + 12);
      document.documentElement.style.setProperty("--lz-chat-overlay-top", `${controlTop + 48}px`);
      document.documentElement.style.setProperty("--lz-chat-control-top", `${controlTop}px`);
      return;
    }
    const header = findSiteTopBar();
    const rect = header ? header.getBoundingClientRect() : null;
    const bottom = rect ? Math.max(0, Math.round(rect.bottom)) : 0;
    const controlTop = rect ? Math.max(8, Math.round(rect.top + (rect.height - 42) / 2)) : 16;
    document.documentElement.style.setProperty("--lz-chat-overlay-top", `${bottom || 76}px`);
    document.documentElement.style.setProperty("--lz-chat-control-top", `${controlTop}px`);
  }

  function getFullscreenElement() {
    return document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null;
  }

  function getImmersiveExitControl() {
    const controls = document.querySelectorAll(
      '[data-testid="exit-immersive-btn"], [data-testid$="-exit-immersive-btn"], button[title^="Exit immersive mode"]'
    );
    return Array.from(controls).find(isActuallyVisible) || null;
  }

  function syncFullscreenOverlayState() {
    const active = !!getFullscreenElement() || !!getImmersiveExitControl();
    document.documentElement.dataset.lzFullscreenActive = active ? "true" : "false";
    if (document.body) document.body.dataset.lzFullscreenActive = active ? "true" : "false";
    return active;
  }

  function fullscreenOverlayHost() {
    const fullscreenElement = getFullscreenElement();
    if (!fullscreenElement) return document.body;
    const tagName = String(fullscreenElement.tagName || "").toUpperCase();
    if (["IFRAME", "CANVAS", "VIDEO"].includes(tagName)) return document.body;
    return fullscreenElement;
  }

  function setChatPopoverState(element, open) {
    if (!element || typeof element.showPopover !== "function") return;
    try {
      const isOpen = element.matches(":popover-open");
      if (open && !isOpen) {
        element.setAttribute("popover", "manual");
        element.showPopover();
      } else if (!open && isOpen) {
        element.hidePopover();
      }
      if (!open) element.removeAttribute("popover");
    } catch (error) {}
  }

  function syncChatOverlayHost() {
    if (!document.body) return;
    const fullscreenElement = getFullscreenElement();
    const host = fullscreenOverlayHost();
    const overlay = document.getElementById("lz-chat-overlay");
    const scrim = document.querySelector(".lz-chat-overlay-scrim");
    const launcher = document.getElementById("lz-chat-open-button");
    const useTopLayer = !!fullscreenElement && host === document.body;

    if (scrim && scrim.parentElement !== host) host.appendChild(scrim);
    if (overlay && overlay.parentElement !== host) host.appendChild(overlay);
    setChatPopoverState(launcher, useTopLayer);
    setChatPopoverState(overlay, useTopLayer && overlay?.classList.contains("is-open"));
    document.documentElement.dataset.lzChatOverlayHost = host === document.body ? "page" : "fullscreen";
  }

  function dedupeChatOverlayLaunchers(preferred = null) {
    const launchers = Array.from(document.querySelectorAll("#lz-chat-open-button, .lz-chat-open-button"));
    if (!launchers.length) return null;
    const keep = preferred && launchers.includes(preferred)
      ? preferred
      : launchers.find(button => button.id === "lz-chat-open-button") || launchers[0];
    launchers.forEach(button => {
      if (button !== keep) button.remove();
    });
    keep.id = "lz-chat-open-button";
    keep.classList.add("lz-chat-open-button");
    return keep;
  }

  function placeChatOverlayLauncher(button) {
    if (!button || isLoginSurface()) return;
    button = dedupeChatOverlayLaunchers(button) || button;
    if (syncFullscreenOverlayState()) {
      button.classList.remove("is-docked-in-header");
      const host = fullscreenOverlayHost();
      if (button.parentElement !== host) host.appendChild(button);
      syncChatOverlayHost();
      return;
    }
    setChatPopoverState(button, false);
    syncChatOverlayHost();
    const header = findSiteTopBar();
    const headerInner = header;
    if (!headerInner) {
      button.classList.remove("is-docked-in-header");
      if (button.parentElement !== document.body) document.body.appendChild(button);
      return;
    }
    if (isSettingsRoute()) {
      const settingsActions = document.querySelector(".lz-settings-top-actions") || headerInner;
      button.classList.add("is-docked-in-header");
      if (button.parentElement !== settingsActions) settingsActions.appendChild(button);
      return;
    }
    const controls = Array.from(headerInner.querySelectorAll("button,a"));
    const logout = controls.find(el => /logout/i.test(el.textContent || ""));
    const save = controls.find(el => /save/i.test(el.textContent || ""));
    const profileParent = document.getElementById("lz-site-profile-button")?.parentElement;
    const parent = save?.parentElement || logout?.parentElement || profileParent || headerInner;
    button.classList.add("is-docked-in-header");
    if (button.parentElement !== parent) parent.appendChild(button);
  }

  function ensureChatOverlayLauncher() {
    if (isChatRoute() || isLoginSurface()) {
      const existing = dedupeChatOverlayLaunchers(document.getElementById("lz-chat-open-button"));
      if (existing) existing.hidden = true;
      return;
    }
    installChatOverlayStyles();
    updateChatOverlayHeaderMetrics();
    let button = dedupeChatOverlayLaunchers(document.getElementById("lz-chat-open-button"));
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "lz-chat-open-button";
      button.className = "lz-chat-open-button";
      button.innerHTML = chatIcon() + "<span>Chat Overlay</span>";
      button.setAttribute("aria-label", "Open chat overlay");
      button.addEventListener("click", () => {
        installChatOverlay();
        window.learningZonesChatOverlay?.toggle?.();
      });
      document.body.appendChild(button);
    }
    placeChatOverlayLauncher(button);
    button.hidden = false;
    renderChatNotificationIndicator();
  }

  function installChatOverlay() {
    if (location.pathname === "/chat") return;
    dedupeChatOverlayLaunchers(document.getElementById("lz-chat-open-button"));
    if (document.getElementById("lz-chat-overlay")) {
      ensureChatOverlayLauncher();
      return;
    }
    installChatOverlayStyles();

    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "lz-chat-overlay-scrim";
    scrim.setAttribute("aria-label", "Close chat overlay");

    const overlay = document.createElement("section");
    overlay.id = "lz-chat-overlay";
    overlay.className = "lz-chat-overlay";
    overlay.setAttribute("aria-label", "Chat overlay");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.lzMessageMode = "global";
    overlay.dataset.lzOverlayMode = "native";
    overlay.innerHTML = `
      <div class="lz-chat-overlay-head">
        <div class="lz-chat-overlay-title">
          <span class="lz-chat-overlay-title-mark">${chatIcon()}</span>
          <span>Chat Overlay</span>
        </div>
        <div class="lz-chat-overlay-actions">
          <button type="button" class="lz-chat-overlay-button lz-chat-mobile-panel-toggle" data-lz-chat-mobile-panel title="Open chat tools" aria-label="Open chat tools" aria-pressed="false">
            ${miniIcon("users")}
          </button>
          <button type="button" class="lz-chat-overlay-button" data-lz-chat-popout title="Open full chat" aria-label="Open full chat">
            ${miniIcon("popout")}
          </button>
          <button type="button" class="lz-chat-overlay-button" data-lz-chat-close title="Close chat" aria-label="Close chat">
            ${miniIcon("close")}
          </button>
        </div>
      </div>
      <iframe
        class="lz-chat-overlay-frame"
        data-lz-chat-overlay-frame="true"
        data-src="/page-embed.html?v=20260723-link1&page=chat&embed=overlay"
        title="Taco Chat"
        loading="lazy"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
      ></iframe>
      <div class="lz-chat-stage">
        <aside class="lz-chat-panel lz-chat-left" aria-label="Chat tools">
          <section class="lz-chat-panel-section">
            <div class="lz-chat-kicker"><span>Chat</span><button type="button" class="lz-chat-overlay-button" data-lz-action="settings" aria-label="Chat settings">${miniIcon("popout")}</button></div>
            <input class="lz-chat-search lz-chat-party-name" placeholder="Party name, e.g. After School" aria-label="Party name" data-lz-party-name maxlength="42">
            <button type="button" class="lz-chat-primary" data-lz-action="create-party">${miniIcon("users")} Create a Party <span aria-hidden="true">+</span></button>
            <div class="lz-chat-tabs" role="tablist" aria-label="User tools">
              <button type="button" class="lz-chat-tab active" data-lz-people-tab="add" role="tab">Add Users</button>
              <button type="button" class="lz-chat-tab" data-lz-people-tab="requests" role="tab">Invites <span class="lz-chat-badge is-empty" data-lz-request-badge>0</span></button>
            </div>
            <input class="lz-chat-search" placeholder="Search users to add..." aria-label="Search users to add" data-lz-user-search>
            <div class="lz-chat-user-results" data-lz-user-results></div>
          </section>
          <section class="lz-chat-panel-section is-quiet-empty" data-lz-empty-label="No party yet">
            <div class="lz-chat-kicker" data-lz-empty-label="No party yet"><span>My Party</span></div>
            <div class="lz-chat-party-card" data-lz-party-card hidden></div>
          </section>
          <section class="lz-chat-panel-section is-quiet-empty" data-lz-empty-label="Nothing active">
            <div class="lz-chat-kicker" data-lz-empty-label="Nothing active"><span>Active Chats</span></div>
            <div data-lz-active-chats></div>
          </section>
          <section class="lz-chat-panel-section">
            <div class="lz-chat-kicker"><span>Channels</span></div>
            <div data-lz-channels>
              <button type="button" class="lz-chat-channel active" data-lz-message-tab="global" role="tab">&#127758; Global Chat</button>
              <button type="button" class="lz-chat-channel" data-lz-message-tab="private" role="tab">&#128274; Private Messages</button>
            </div>
          </section>
        </aside>

        <aside class="lz-chat-panel lz-chat-right" aria-label="Global chat">
          <div class="lz-chat-right-head">
            <div>
              <div class="lz-chat-right-title" data-lz-current-chat-title><span aria-hidden="true">&#127758;</span>Global Chat</div>
              <div class="lz-chat-online" data-lz-member-count>Loading online...</div>
              <div class="lz-chat-room-note" data-lz-current-chat-note>Global Chat uses the normal public chat rules.</div>
            </div>
            <button type="button" class="lz-chat-overlay-button" data-lz-action="friends" aria-label="Open members">${miniIcon("users")}</button>
          </div>
          <div class="lz-chat-message-tabs" role="tablist" aria-label="Message type">
            <button type="button" class="lz-chat-message-tab active" data-lz-message-tab="global" role="tab" aria-selected="true">&#127758; Global</button>
            <button type="button" class="lz-chat-message-tab" data-lz-message-tab="private" role="tab" aria-selected="false">&#128274; Private</button>
          </div>
          <label class="lz-chat-pause-setting">
            <span>Pause zone while chat is open</span>
            <input type="checkbox" data-lz-pause-game aria-label="Pause zone while chat is open">
            <span class="lz-chat-pause-switch" aria-hidden="true"></span>
          </label>
          <div class="lz-chat-private-rooms" data-lz-private-rooms hidden></div>
          <div class="lz-chat-mod-tools" data-lz-mod-tools hidden></div>
          <div class="lz-chat-messages">
            <div class="lz-chat-message-feed" data-lz-overlay-messages></div>
            <details class="lz-chat-active-accounts">
              <summary><span>Active Accounts</span><span class="lz-chat-active-count" data-lz-active-account-count>0 online</span></summary>
              <div class="lz-chat-member-feed" data-lz-members></div>
            </details>
          </div>
          <div class="lz-chat-right-composer">
            <div class="lz-chat-status-rail" data-lz-overlay-status-rail="true"></div>
            <div class="lz-chat-send-status" data-lz-overlay-note role="status" aria-live="polite"></div>
            <input class="lz-chat-message-input" placeholder="Type a message..." aria-label="Type a message" data-lz-action="message">
            <button type="button" class="lz-chat-send" data-lz-action="message" aria-label="Send overlay message">${miniIcon("send")}</button>
          </div>
        </aside>

        <div class="lz-chat-dock" aria-label="Party members">
          <strong class="lz-chat-dock-title">Party</strong>
          <div class="lz-chat-dock-members" data-lz-dock-members></div>
          <button type="button" class="lz-chat-outline" data-lz-action="party">Open Party</button>
        </div>
      </div>
    `;

    let button = dedupeChatOverlayLaunchers(document.getElementById("lz-chat-open-button"));
    if (button) {
      const cleanButton = button.cloneNode(false);
      button.replaceWith(cleanButton);
      button = cleanButton;
      dedupeChatOverlayLaunchers(button);
    } else {
      button = document.createElement("button");
    }
    button.type = "button";
    button.id = "lz-chat-open-button";
    button.className = "lz-chat-open-button";
    button.hidden = false;
    button.innerHTML = chatIcon() + "<span>Chat Overlay</span>";
    button.setAttribute("aria-label", "Open chat overlay");

    function updateOverlayTop() {
      updateChatOverlayHeaderMetrics();
      placeChatOverlayLauncher(button);
      syncChatOverlayHost();
    }

    function scheduleOverlayTopRefresh() {
      updateOverlayTop();
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(updateOverlayTop);
      }
      setTimeout(updateOverlayTop, 160);
      setTimeout(updateOverlayTop, 700);
    }

    function activateChatOverlayFrame() {
      if (overlay.dataset.lzOverlayMode !== "frame") return;
      const frame = overlay.querySelector("[data-lz-chat-overlay-frame]");
      if (!frame) return;
      if (!frame.getAttribute("src")) {
        frame.setAttribute("src", frame.dataset.src || "/page-embed.html?page=chat");
      }
      setTimeout(requestChatFrameSync, 250);
    }

    const pausePreferenceKey = "lz_pause_zone_on_chat_open_v1";
    const pauseToggle = overlay.querySelector("[data-lz-pause-game]");
    let returnFocusElement = null;
    let pausedGameFrame = null;
    let pausedMedia = [];

    function readPausePreference() {
      try {
        const saved = localStorage.getItem(pausePreferenceKey);
        return saved === null ? true : saved !== "false";
      } catch (error) {
        return true;
      }
    }

    function writePausePreference(value) {
      try {
        localStorage.setItem(pausePreferenceKey, value ? "true" : "false");
      } catch (error) {}
    }

    function findGameFrame() {
      const frames = Array.from(document.querySelectorAll(
        '[data-testid="game-iframe"], [data-testid$="-iframe"], iframe[allow*="gamepad"], iframe[allowfullscreen]'
      ));
      return frames.find(frame => !overlay.contains(frame) && isActuallyVisible(frame)) || null;
    }

    function setGamePausedForChat(paused) {
      if (paused) {
        const frame = findGameFrame();
        if (!frame) return;
        pausedGameFrame = frame;
        frame.classList.add("lz-chat-game-paused");
        frame.blur();
        try {
          frame.contentWindow?.postMessage({ type: "learningzone:chat-overlay", paused: true }, "*");
          frame.contentWindow?.blur();
          const frameDocument = frame.contentDocument;
          pausedMedia = Array.from(frameDocument?.querySelectorAll?.("audio,video") || []).map(media => {
            const state = { media, muted: media.muted };
            media.muted = true;
            return state;
          });
          frameDocument?.activeElement?.blur?.();
        } catch (error) {}
        return;
      }

      if (pausedGameFrame) {
        pausedGameFrame.classList.remove("lz-chat-game-paused");
        try {
          pausedGameFrame.contentWindow?.postMessage({ type: "learningzone:chat-overlay", paused: false }, "*");
        } catch (error) {}
      }
      pausedMedia.forEach(({ media, muted }) => {
        try {
          media.muted = muted;
        } catch (error) {}
      });
      pausedMedia = [];
    }

    function focusOverlayComposer() {
      const input = overlay.querySelector(".lz-chat-message-input");
      if (!input || !isActuallyVisible(input)) return;
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
    }

    function restoreOverlayComposerIfGameStoleFocus() {
      if (!overlay.classList.contains("is-open")) return;
      const active = document.activeElement;
      if (active && overlay.contains(active)) return;
      focusOverlayComposer();
    }

    function resumeGameWhileOverlayOpen() {
      const gameFrame = pausedGameFrame || findGameFrame();
      setGamePausedForChat(false);
      if (!gameFrame) return;
      requestAnimationFrame(() => {
        if (!overlay.classList.contains("is-open") || pauseToggle?.checked) return;
        try {
          gameFrame.focus({ preventScroll: true });
        } catch (error) {
          gameFrame.focus?.();
        }
        try {
          gameFrame.contentWindow?.focus();
          gameFrame.contentWindow?.postMessage({ type: "learningzone:chat-overlay", paused: false }, "*");
        } catch (error) {}
      });
    }

    function restoreGameFocus() {
      const gameFrame = pausedGameFrame || findGameFrame();
      const fallback = returnFocusElement?.isConnected ? returnFocusElement : button;
      const target = gameFrame || fallback;
      if (!target) return;
      try {
        target.focus({ preventScroll: true });
      } catch (error) {
        target.focus?.();
      }
      if (gameFrame) {
        try {
          gameFrame.contentWindow?.focus();
        } catch (error) {}
      }
      pausedGameFrame = null;
      returnFocusElement = null;
    }

    if (pauseToggle) pauseToggle.checked = readPausePreference();

    function openOverlay() {
      if (isLoginSurface()) return;
      returnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      clearTimeout(whatsHappeningTimer);
      hideWhatsHappeningCard();
      markChatNotificationsRead({ throughNow: true });
      scheduleOverlayTopRefresh();
      overlay.classList.add("is-open");
      scrim.classList.add("is-open");
      syncChatOverlayHost();
      overlay.setAttribute("aria-hidden", "false");
      button.setAttribute("aria-expanded", "true");
      document.body.classList.add("lz-chat-overlay-open");
      setGamePausedForChat(!!pauseToggle?.checked);
      touchPresence();
      if (overlay.dataset.lzOverlayMode === "frame") {
        stopOverlayMessageRealtime();
        activateChatOverlayFrame();
      } else {
        startOverlayMessageRealtime(overlay);
        hydrateOverlayPanels(overlay)
          .catch(() => {})
          .finally(() => requestAnimationFrame(restoreOverlayComposerIfGameStoleFocus));
        clearInterval(overlayDataTimer);
        overlayDataTimer = setInterval(() => hydrateOverlayPanels(overlay).catch(() => {}), isChromebookMode() ? OVERLAY_REFRESH_CHROMEBOOK_MS : OVERLAY_REFRESH_MS);
      }
      requestAnimationFrame(focusOverlayComposer);
      setTimeout(restoreOverlayComposerIfGameStoleFocus, 220);
    }

    function closeOverlay() {
      clearOverlayTypingSignal();
      overlay.classList.remove("is-open");
      scrim.classList.remove("is-open");
      setChatPopoverState(overlay, false);
      overlay.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("lz-chat-overlay-open");
      clearInterval(overlayDataTimer);
      overlayDataTimer = 0;
      stopOverlayMessageRealtime();
      setGamePausedForChat(false);
      requestAnimationFrame(restoreGameFocus);
    }

    function enforceLoginGuard() {
      if (!isLoginSurface()) return;
      closeOverlay();
    }

    function openFullChat() {
      closeOverlay();
      location.href = "/chat";
    }

    function showOverlayNote(message) {
      const notes = Array.from(overlay.querySelectorAll("[data-lz-overlay-note]"));
      if (!notes.length) return;
      notes.forEach(note => {
        note.textContent = message;
        note.classList.add("is-visible");
      });
      clearTimeout(showOverlayNote.timer);
      showOverlayNote.timer = setTimeout(() => {
        notes.forEach(note => note.classList.remove("is-visible"));
      }, 3600);
    }

    let lastOverlayMessage = { text: "", at: 0 };
    let overlaySendPromise = null;
    let overlayTypingTimer = 0;

    function updateOverlayTypingIndicator(visible = true) {
      const input = overlay.querySelector(".lz-chat-message-input");
      const typing = ensureOverlayTypingIndicator(overlay);
      if (!typing || !input) return;
      const shouldShow = !!(visible && String(input.value || "").trim());
      typing.hidden = !shouldShow;
      scheduleOverlayTypingSignal(overlay, shouldShow);
      clearTimeout(overlayTypingTimer);
      if (shouldShow) {
        overlayTypingTimer = setTimeout(() => updateOverlayTypingIndicator(false), 1250);
      }
    }

    async function addOverlayMessage() {
      if (overlaySendPromise) return overlaySendPromise;
      const input = overlay.querySelector(".lz-chat-message-input");
      const sendButton = overlay.querySelector(".lz-chat-send");
      const value = String(input?.value || "").trim();
      if (!value) {
        showOverlayNote("Type a message first.");
        input?.focus();
        return;
      }
      const now = Date.now();
      if (value === lastOverlayMessage.text && now - lastOverlayMessage.at < 1400) return;
      if (sendButton) sendButton.disabled = true;
      const mode = overlayMessageMode(overlay);
      const roomId = mode === "private" ? overlaySelectedPrivateRoomId(overlay) : "global";
      if (mode === "private" && !roomId) {
        showOverlayNote("Start or select a private DM first.");
        if (sendButton) sendButton.disabled = false;
        input?.focus();
        return;
      }
      updateOverlayTypingIndicator(false);
      const destination = mode === "private" ? "Private Messages" : "Global Chat";
      showOverlayNote(`Sending to ${destination}...`);
      overlaySendPromise = (async () => {
        try {
          const result = await sendOverlayMessageToCloud(value, roomId, overlay);
          delete overlay.dataset.lzLastSendError;
          overlay.__lzOverlayData = {
            ...(overlay.__lzOverlayData || {}),
            messages: mergeOverlayMessageRows(overlay.__lzOverlayData?.messages || [], result.messages)
          };
          renderOverlayMessages(overlay, overlay.__lzOverlayData.messages, overlay.__lzOverlayData?.accounts || {});
          if (input) input.value = "";
          lastOverlayMessage = { text: value, at: Date.now() };
          updateOverlayTypingIndicator(false);
          const messages = overlay.querySelector(".lz-chat-messages");
          messages?.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
          showOverlayNote(`Sent to ${destination}.`);
          hydrateOverlayPanels(overlay).catch(() => {});
        } catch (error) {
          console.warn("Overlay message send failed:", error);
          const reason = String(error?.message || "");
          overlay.dataset.lzLastSendError = reason || "unknown";
          showOverlayNote(reason === "login_required"
            ? "Sign in before sending messages."
            : reason === "global_disabled"
              ? "Global Chat is disabled by the owner."
              : reason === "banned"
                ? "This account is banned from chatting."
                : reason === "room_forbidden"
                  ? "You are not in that private chat."
                  : reason === "room_unavailable"
                    ? "That private chat is unavailable."
                    : reason === "chatplus_required"
                    ? "Group chats need Chat+. One-on-one DMs are free."
                    : reason === "send_timeout" || reason === "firebase_request_timeout"
                      ? "Chat took too long to respond. Try again."
                : reason.startsWith("filtered:")
                  ? `Blocked by moderation filter: ${reason.slice("filtered:".length)}`
                  : "Message failed to send. Try again.");
        } finally {
          overlaySendPromise = null;
          if (sendButton) sendButton.disabled = false;
          input?.focus();
        }
      })();
      return overlaySendPromise;
    }

    function handleOverlayAction(action, target) {
      if (action === "message") {
        if (target.matches(".lz-chat-message-input")) return;
        addOverlayMessage();
        return;
      }
      if (action === "create-party") {
        createOverlayParty(overlay)
          .then(result => {
            if (!result) {
              showOverlayNote("Sign in before creating a party.");
              return;
            }
            showOverlayNote(result.created ? "Party created. Search users to send invites." : "You already have a party open.");
            hydrateOverlayPanels(overlay).catch(() => {});
          })
          .catch(() => showOverlayNote("Could not create a party yet."));
        return;
      }
      const labels = {
        "create-party": "Party creation is ready here. Use Open Party when you want the full lobby controls.",
        party: "Party controls stay open here. Use the popout only for the full party room.",
        friends: "Friends and invites are shown on the side panel and full chat.",
        soundboard: "Soundboard stays inside the overlay. Owner-only controls are in full chat.",
        poll: "Poll controls stay on this overlay.",
        voice: "Voice controls stay docked at the bottom.",
        global: "Base chat is Global Chat.",
        channel: "Channel selected in the overlay.",
        person: "Friend selected in the overlay.",
        settings: "Overlay settings are kept on this page."
      };
      showOverlayNote(labels[action] || "Overlay action selected.");
    }

    button.addEventListener("click", () => overlay.classList.contains("is-open") ? closeOverlay() : openOverlay());
    scrim.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", event => {
      const mobilePanelToggle = event.target.closest("[data-lz-chat-mobile-panel]");
      if (mobilePanelToggle) {
        event.preventDefault();
        event.stopPropagation();
        const showTools = !overlay.classList.contains("is-tools-open");
        overlay.classList.toggle("is-tools-open", showTools);
        mobilePanelToggle.setAttribute("aria-pressed", showTools ? "true" : "false");
        mobilePanelToggle.setAttribute("aria-label", showTools ? "Back to chat" : "Open chat tools");
        mobilePanelToggle.setAttribute("title", showTools ? "Back to chat" : "Open chat tools");
        if (!showTools) requestAnimationFrame(focusOverlayComposer);
        return;
      }

      const messageTab = event.target.closest("[data-lz-message-tab]");
      if (messageTab) {
        event.preventDefault();
        event.stopPropagation();
        const nextMode = messageTab.dataset.lzMessageTab === "private" ? "private" : "global";
        overlay.dataset.lzMessageMode = nextMode;
        if (nextMode === "global") delete overlay.dataset.lzPrivateRoom;
        renderOverlayMessages(overlay, overlay.__lzOverlayData?.messages || [], overlay.__lzOverlayData?.accounts || {});
        hydrateOverlayPanels(overlay).catch(() => {});
        requestAnimationFrame(focusOverlayComposer);
        return;
      }

      const privateRoom = event.target.closest("[data-lz-private-room]");
      if (privateRoom) {
        event.preventDefault();
        event.stopPropagation();
        overlay.dataset.lzMessageMode = "private";
        overlay.dataset.lzPrivateRoom = privateRoom.dataset.lzPrivateRoom || "";
        renderOverlayMessages(overlay, overlay.__lzOverlayData?.messages || [], overlay.__lzOverlayData?.accounts || {});
        hydrateOverlayPanels(overlay).catch(() => {});
        return;
      }

      const startDm = event.target.closest("[data-lz-start-dm]");
      if (startDm) {
        event.preventDefault();
        event.stopPropagation();
        startDm.setAttribute("disabled", "disabled");
        openOverlayDm(overlay, startDm.dataset.lzStartDm)
          .then(() => showOverlayNote("Private DM opened. One-on-one DMs are free."))
          .catch(error => {
            const reason = String(error?.message || "");
            showOverlayNote(reason === "login_required"
              ? "Sign in before starting a DM."
              : reason === "user_unavailable"
                ? "That user is unavailable."
                : "Could not open that DM yet.");
          })
          .finally(() => startDm.removeAttribute("disabled"));
        return;
      }

      const tab = event.target.closest("[data-lz-people-tab]");
      if (tab) {
        event.preventDefault();
        event.stopPropagation();
        overlay.dataset.lzPeopleTab = tab.dataset.lzPeopleTab || "add";
        renderOverlayUserTools(overlay);
        return;
      }

      const addUser = event.target.closest("[data-lz-add-user]");
      if (addUser) {
        event.preventDefault();
        event.stopPropagation();
        const targetId = addUser.dataset.lzAddUser;
        addUser.setAttribute("disabled", "disabled");
        setOverlayFriendRelationship(overlay, targetId, "pending", key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id))
          .then(() => showOverlayNote("Invite sent. They have to approve it."))
          .catch(() => showOverlayNote("Could not send that invite yet."));
        return;
      }

      const requestAction = event.target.closest("[data-lz-request-action]");
      if (requestAction) {
        event.preventDefault();
        event.stopPropagation();
        const targetId = requestAction.dataset.lzUserId;
        const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
        const existing = overlayRelationshipFor(overlay.__lzOverlayData?.relationships || {}, userId, targetId);
        const nextStatus = requestAction.dataset.lzRequestAction === "accept" ? "accepted" : "declined";
        requestAction.setAttribute("disabled", "disabled");
        setOverlayFriendRelationship(overlay, targetId, nextStatus, existing?.requestedBy || targetId)
          .then(() => showOverlayNote(nextStatus === "accepted" ? "Invite accepted." : "Invite declined."))
          .catch(() => showOverlayNote("Could not update that invite yet."));
        return;
      }

      const spectateToggle = event.target.closest("[data-lz-spectate-toggle]");
      if (spectateToggle) {
        event.stopPropagation();
        setSpectatePreference(spectateToggle.checked)
          .then(() => showOverlayNote(spectateToggle.checked ? "Party spectate requests are on." : "Party spectate requests are off."))
          .catch(() => showOverlayNote("Could not save that spectate setting yet."));
        return;
      }

      const spectateTarget = event.target.closest("[data-lz-spectate-target]");
      if (spectateTarget) {
        event.preventDefault();
        event.stopPropagation();
        spectateTarget.setAttribute("disabled", "disabled");
        requestPartySpectate(overlay, spectateTarget.dataset.lzSpectateTarget)
          .then(() => showOverlayNote("Spectate request sent. Waiting for approval."))
          .catch(error => {
            const reason = String(error?.message || "");
            showOverlayNote(reason === "requests_off"
              ? "This player isn't accepting spectate requests."
              : reason === "not_playing"
                ? "That player is not in a zone anymore."
                : reason === "not_same_party"
                  ? "You must be in the same party to spectate."
                  : reason === "login_required"
                    ? "Sign in before spectating."
                    : "Could not send a spectate request yet.");
          })
          .finally(() => spectateTarget.removeAttribute("disabled"));
        return;
      }

      const replyMessage = event.target.closest("[data-lz-reply-message]");
      if (replyMessage) {
        event.preventDefault();
        event.stopPropagation();
        const input = overlay.querySelector(".lz-chat-message-input");
        const username = String(replyMessage.dataset.lzReplyUser || "").trim();
        if (input && username) {
          const prefix = `@${username} `;
          if (!String(input.value || "").startsWith(prefix)) input.value = prefix + String(input.value || "");
          input.focus();
          updateOverlayTypingIndicator(true);
          input.classList.remove("is-replying");
          void input.offsetWidth;
          input.classList.add("is-replying");
          setTimeout(() => input.classList.remove("is-replying"), 220);
          showOverlayNote(`Replying to ${username}.`);
        }
        return;
      }

      const modAction = event.target.closest("[data-lz-mod-action]");
      if (modAction) {
        event.preventDefault();
        event.stopPropagation();
        const action = modAction.dataset.lzModAction;
        modAction.setAttribute("disabled", "disabled");
        Promise.resolve()
          .then(() => {
            if (action === "delete-message") {
              return deleteOverlayMessage(overlay, modAction.dataset.lzMessageId, modAction.dataset.lzMessageKey)
                .then(() => showOverlayNote("Message deleted."));
            }
            if (action === "clear-global") {
              if (!window.confirm("Clear Global Chat for everyone?")) return null;
              return clearOverlayGlobal(overlay)
                .then(result => showOverlayNote(result?.cleared ? `Cleared ${result.cleared} Global Chat message(s).` : "Global Chat is already clear."));
            }
            if (action === "toggle-global") {
              return toggleOverlayGlobal(overlay)
                .then(enabled => showOverlayNote(enabled ? "Global Chat enabled." : "Global Chat disabled."));
            }
            return null;
          })
          .then(() => hydrateOverlayPanels(overlay).catch(() => {}))
          .catch(error => {
            console.warn("Overlay moderation failed:", error);
            const reason = String(error?.message || "");
            showOverlayNote(reason === "owner_required" ? "Owner only." : reason === "admin_required" ? "Admin only." : "Moderation action failed.");
          })
          .finally(() => modAction.removeAttribute("disabled"));
        return;
      }

      const modUserAction = event.target.closest("[data-lz-mod-user-action]");
      if (modUserAction) {
        event.preventDefault();
        event.stopPropagation();
        const action = modUserAction.dataset.lzModUserAction;
        const targetId = modUserAction.dataset.lzUserId;
        const label = action === "unban" ? "Unban this account?" : action === "kick" ? "Kick this account from Global Chat?" : "Ban this account?";
        if (!window.confirm(label)) return;
        modUserAction.setAttribute("disabled", "disabled");
        Promise.resolve()
          .then(() => action === "kick" ? kickOverlayUser(overlay, targetId) : setOverlayUserBan(overlay, targetId, action === "ban"))
          .then(() => {
            showOverlayNote(action === "kick" ? "User kicked from Global Chat." : action === "unban" ? "User unbanned." : "User banned.");
            return hydrateOverlayPanels(overlay).catch(() => {});
          })
          .catch(error => {
            console.warn("Overlay user moderation failed:", error);
            const reason = String(error?.message || "");
            showOverlayNote(reason === "owner_required" ? "Owner only." : reason === "admin_required" ? "Admin only." : reason === "protected_target" ? "That account is protected." : "User moderation failed.");
          })
          .finally(() => modUserAction.removeAttribute("disabled"));
        return;
      }

      const actionEl = event.target.closest("[data-lz-action], [data-lz-open-full]");
      if (!actionEl) return;
      event.preventDefault();
      event.stopPropagation();
      handleOverlayAction(actionEl.dataset.lzAction || "open", actionEl);
    });
    overlay.querySelector("[data-lz-user-search]")?.addEventListener("input", () => {
      overlay.dataset.lzPeopleTab = "add";
      renderOverlayUserTools(overlay);
    });
    pauseToggle?.addEventListener("change", () => {
      writePausePreference(pauseToggle.checked);
      if (overlay.classList.contains("is-open")) {
        if (pauseToggle.checked) setGamePausedForChat(true);
        else resumeGameWhileOverlayOpen();
      }
    });
    const overlayInput = overlay.querySelector(".lz-chat-message-input");
    const overlaySendButton = overlay.querySelector(".lz-chat-send");
    let overlaySendHandledByPointer = false;
    overlayInput?.addEventListener("input", () => updateOverlayTypingIndicator(true), { passive: true });
    overlayInput?.addEventListener("blur", () => updateOverlayTypingIndicator(false), { passive: true });
    overlayInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addOverlayMessage();
    });
    overlaySendButton?.addEventListener("pointerdown", event => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      overlaySendHandledByPointer = true;
      event.preventDefault();
      event.stopPropagation();
      addOverlayMessage();
    });
    overlaySendButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (overlaySendHandledByPointer) {
        overlaySendHandledByPointer = false;
        return;
      }
      addOverlayMessage();
    });
    overlay.querySelector(".lz-chat-messages")?.addEventListener("scroll", () => {
      if (!overlayIsMessageFeedAtBottom(overlay)) return;
      const button = overlay.querySelector("[data-lz-overlay-new-messages]");
      if (button) button.hidden = true;
    }, { passive: true });
    overlay.querySelector("[data-lz-chat-close]").addEventListener("click", closeOverlay);
    overlay.querySelector("[data-lz-chat-popout]").addEventListener("click", openFullChat);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) closeOverlay();
    });
    window.addEventListener("resize", () => {
      scheduleOverlayTopRefresh();
    });
    window.addEventListener("pagehide", clearOverlayTypingSignal);
    window.addEventListener("scroll", () => {
      scheduleOverlayTopRefresh();
    }, { passive: true });
    new MutationObserver(() => {
      if (overlay.isConnected && button.isConnected) return;
      requestAnimationFrame(() => {
        enforceLoginGuard();
        updateOverlayTop();
      });
    }).observe(document.body, { childList: true, subtree: true });
    document.body.append(scrim, overlay);
    if (!button.isConnected) document.body.appendChild(button);
    placeChatOverlayLauncher(button);
    syncChatOverlayHost();
    renderChatNotificationIndicator();
    scheduleOverlayTopRefresh();
    window.learningZonesChatOverlay = { open: openOverlay, close: closeOverlay, refresh: scheduleOverlayTopRefresh, toggle: () => overlay.classList.contains("is-open") ? closeOverlay() : openOverlay() };
  }

  function isChatRoute() {
    return location.pathname.replace(/\/+$/, "") === "/chat";
  }

  function isSpectatorFrameRoute() {
    return new URLSearchParams(location.search).get("spectator") === "1";
  }

  function zoneSlugFromPath() {
    const match = location.pathname.match(/^\/zone\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1] || "") : "";
  }

  function ensurePrimaryRouteLandmark() {
    const routeSurface = document.querySelector(
      '[data-testid="game-player"], [data-testid="community-container"], [data-testid="gamemaker-container"], [data-testid="party-container"]'
    );
    if (!routeSurface || routeSurface.matches("main, [role='main']")) return;
    routeSurface.setAttribute("role", "main");
    if (!routeSurface.hasAttribute("aria-label")) {
      const title = document.querySelector('[data-testid="game-title"]')?.textContent?.trim();
      routeSurface.setAttribute("aria-label", title ? `${title} zone` : "Main content");
    }
  }

  function scheduleStreakForCurrentRoute(delay = STREAK_ROUTE_DELAY_MS) {
    if (isSpectatorFrameRoute()) return;
    const slug = zoneSlugFromPath();
    syncZoneActivityForCurrentRoute();
    if (!slug) return;
    const routeKey = `${location.pathname}|${slug}`;
    clearTimeout(streakRouteTimer);
    streakRouteTimer = setTimeout(() => {
      if (zoneSlugFromPath() !== slug) return;
      if (lastStreakRouteKey === routeKey && document.visibilityState === "hidden") return;
      lastStreakRouteKey = routeKey;
      recordDailyStreakForGame(slug).catch(error => {
        console.warn("Learning Zones streak update skipped:", error);
      });
    }, delay);
  }

  function syncChatOverlayForRoute() {
    syncSiteSettingsRoute();
    ensurePrimaryRouteLandmark();
    setTimeout(ensurePrimaryRouteLandmark, 160);
    const button = document.getElementById("lz-chat-open-button");
    scheduleStreakForCurrentRoute();
    syncZoneActivityForCurrentRoute();
    if (isCatalogSurfaceRoute()) {
      scheduleZoneRatingsForRoute();
      scheduleGameCoversForRoute();
    }
    scheduleScrollReveal(document, 180);
    if (isSpectatorFrameRoute()) {
      try {
        window.learningZonesChatOverlay?.close?.();
      } catch (error) {}
      if (button) button.hidden = true;
      hideChatNotificationBubble(true);
      return;
    }
    if (isChatRoute() || isLoginSurface()) {
      try {
        window.learningZonesChatOverlay?.close?.();
      } catch (error) {}
      if (button) button.hidden = true;
      if (isChatRoute()) markChatNotificationsRead({ throughNow: true });
      else hideChatNotificationBubble(true);
      scheduleOnlineCounterRefresh(300);
      return;
    }
    installChatOverlay();
    const activeButton = document.getElementById("lz-chat-open-button");
    if (activeButton) activeButton.hidden = false;
    renderChatNotificationIndicator();
    window.learningZonesChatOverlay?.refresh?.();
    scheduleChatNotificationRefresh(220);
    scheduleOnlineCounterRefresh(isChatRoute() ? 300 : 9000);
  }

  function watchChatOverlayMount() {
    if (window.__learningZonesChatOverlayMountWatch) return;
    window.__learningZonesChatOverlayMountWatch = true;
    new MutationObserver(() => {
      if (document.getElementById("lz-chat-overlay")?.isConnected && document.getElementById("lz-chat-open-button")?.isConnected) return;
      clearTimeout(overlayMountTimer);
      overlayMountTimer = setTimeout(() => {
        if (isChatRoute()) return;
        ensureChatOverlayLauncher();
      }, 120);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function watchFullscreenOverlayPosition() {
    if (window.__learningZonesFullscreenOverlayWatch) return;
    window.__learningZonesFullscreenOverlayWatch = true;
    const refresh = () => {
      syncFullscreenOverlayState();
      updateChatOverlayHeaderMetrics();
      const button = document.getElementById("lz-chat-open-button");
      if (button && !isChatRoute() && !isLoginSurface()) placeChatOverlayLauncher(button);
      window.learningZonesChatOverlay?.refresh?.();
    };
    ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach(eventName => {
      document.addEventListener(eventName, () => setTimeout(refresh, 30), false);
    });
    window.visualViewport?.addEventListener?.("resize", () => setTimeout(refresh, 30), { passive: true });
    window.visualViewport?.addEventListener?.("scroll", () => setTimeout(refresh, 30), { passive: true });
    refresh();
  }

  function watchChatOverlayRoute() {
    if (window.__learningZonesChatRouteWatcher) return;
    window.__learningZonesChatRouteWatcher = true;
    let lastPath = location.pathname;
    let routeTimer = 0;
    const scheduleSync = () => {
      clearTimeout(routeTimer);
      routeTimer = setTimeout(() => {
        lastPath = location.pathname;
        syncChatOverlayForRoute();
        scheduleStreakForCurrentRoute();
        scheduleHomeDiscoveryForRoute(120);
      }, 80);
    };
    ["pushState", "replaceState"].forEach(method => {
      const original = history[method];
      if (typeof original !== "function") return;
      history[method] = function patchedHistoryMethod() {
        const result = original.apply(this, arguments);
        scheduleSync();
        return result;
      };
    });
    window.addEventListener("popstate", scheduleSync);
    window.addEventListener("hashchange", scheduleSync);
    setInterval(() => {
      if (location.pathname === lastPath) return;
      scheduleSync();
    }, 1500);
  }

  function watchChatFrames() {
    if (window.__learningZonesChatFrameWatch) return;
    window.__learningZonesChatFrameWatch = true;
    let syncTimers = [];
    const scheduleSyncBurst = () => {
      syncTimers.forEach(clearTimeout);
      syncTimers = [80, 320, 900, 1800].map(delay => setTimeout(requestChatFrameSync, delay));
    };
    const watchFrame = frame => {
      if (!frame || frame.tagName !== "IFRAME") return;
      if (frame.dataset.lzSyncWatched) return;
      frame.dataset.lzSyncWatched = "true";
      frame.addEventListener("load", () => {
        if (frame.contentWindow) chatFrameLoginSyncAt.delete(frame.contentWindow);
        scheduleSyncBurst();
      });
    };
    document.querySelectorAll("iframe").forEach(watchFrame);
    scheduleSyncBurst();
    new MutationObserver(mutations => {
      if (!mutationAddsMatching(mutations, "iframe")) return;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node?.nodeType !== 1) return;
          if (node.tagName === "IFRAME") watchFrame(node);
          node.querySelectorAll?.("iframe").forEach(watchFrame);
        });
      });
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(scheduleSyncBurst, 80);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function touchPresence() {
    const userId = key(loggedInUsername() || currentSnapshot?.username || currentSnapshot?.id);
    if (!userId || isLoginSurface()) return;
    const stamp = Date.now();
    const payload = JSON.stringify({
      at: stamp,
      room: "site",
      status: "online"
    });
    fetch(chatStateUrl(["presence", userId, "site"]), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).then(() => scheduleOnlineCounterRefresh(isChatRoute() ? 250 : 9000)).catch(() => {});
  }

  function watchPresenceHeartbeat() {
    if (window.__learningZonesPresenceHeartbeat) return;
    window.__learningZonesPresenceHeartbeat = true;
    const run = () => {
      if (document.visibilityState === "hidden") return;
      touchPresence();
    };
    run();
    clearInterval(presenceTimer);
    presenceTimer = setInterval(run, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") run();
    }, { passive: true });
    window.addEventListener("focus", run, { passive: true });
  }

  async function refreshOnlineCounters() {
    if (!document.body) return;
    const shouldRefresh = isChatRoute() || document.querySelector("[data-lz-member-count]");
    if (!shouldRefresh) return;
    const presence = await fetchJson(stateUrl("presence"), 1200).catch(() => ({})) || {};
    const count = onlinePresenceCount(presence);
    document.querySelectorAll("[data-lz-member-count]").forEach(counter => {
      counter.textContent = `${count} online`;
    });
    updateInlineOnlineCounters(document.body, count);
  }

  function scheduleOnlineCounterRefresh(delay = 0) {
    clearTimeout(onlineCounterTimer);
    onlineCounterTimer = setTimeout(() => refreshOnlineCounters().catch(() => {}), delay);
  }

  function watchOnlineCounters() {
    if (window.__learningZonesOnlineCounters) return;
    window.__learningZonesOnlineCounters = true;
    scheduleOnlineCounterRefresh(isChatRoute() ? 250 : 9000);
    setInterval(() => scheduleOnlineCounterRefresh(0), isChromebookMode() ? ONLINE_COUNTER_REFRESH_MS * 2 : ONLINE_COUNTER_REFRESH_MS);
    window.addEventListener(SYNC_EVENT, () => scheduleOnlineCounterRefresh(isChatRoute() ? 250 : 9000));
  }

  function zoneWords(value) {
    return String(value || "")
      .replace(/\b4,018\b/g, "3,989")
      .replace(/\b4018\b/g, "3989")
      .replace(/\bGAMES\b/g, "ZONES")
      .replace(/\bGames\b/g, "Zones")
      .replace(/\bgames\b/g, "zones")
      .replace(/\bGAME\b/g, "ZONE")
      .replace(/\bGame\b/g, "Zone")
      .replace(/\bgame\b/g, "zone");
  }

  function normalizeZoneWordsInUi(root = document.body) {
    if (!root) return;
    const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
    const updateTextNode = node => {
      const next = zoneWords(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    };
    const updateElement = element => {
      if (!element || skipTags.has(element.tagName)) return;
      ["placeholder", "title", "aria-label", "alt"].forEach(attribute => {
        if (!element.hasAttribute?.(attribute)) return;
        const current = element.getAttribute(attribute);
        const next = zoneWords(current);
        if (next !== current) element.setAttribute(attribute, next);
      });
      if (element instanceof HTMLInputElement && /^(button|submit|reset)$/i.test(element.type || "")) {
        const next = zoneWords(element.value);
        if (next !== element.value) element.value = next;
      }
    };
    if (root.nodeType === Node.TEXT_NODE) {
      updateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    updateElement(root.nodeType === Node.ELEMENT_NODE ? root : document.documentElement);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (parent && parent.closest?.("script,style,noscript,textarea,code,pre")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) updateTextNode(node);
      else updateElement(node);
    }
  }

  function watchZoneWordsUi() {
    if (window.__learningZonesWordNormalizer) return;
    window.__learningZonesWordNormalizer = true;
    let timer = 0;
    const pendingRoots = new Set();
    const run = (root = document.body) => {
      if (root) pendingRoots.add(root);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const roots = Array.from(pendingRoots).filter(Boolean);
        pendingRoots.clear();
        const body = document.body;
        if (!body) return;
        if (!roots.length || roots.length > 100 || roots.some(item => item === document.documentElement || item === body || item.contains?.(body))) {
          normalizeZoneWordsInUi(body);
          return;
        }
        roots.forEach(item => {
          const target = item.nodeType === Node.TEXT_NODE ? item.parentElement : item;
          if (target?.isConnected) normalizeZoneWordsInUi(target);
        });
      }, 80);
    };
    run();
    new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === "attributes") {
          run(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(node => run(node));
      });
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt", "value"]
    });
  }

  window.addEventListener("message", event => {
    if (event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type === "learning-zones-chat-link-result") {
      handleChatLinkResult(data);
      return;
    }
    if (data.type === "learning-zones-profile-media-update") {
      handleChatProfileMediaUpdate(data, event.source);
      return;
    }
    if (data.type === "taco-auth-request") {
      const target = event.source;
      if (target && typeof target.postMessage === "function" && isChatFrameSource(target)) {
        try {
          target.postMessage(siteThemePayload(), location.origin);
          target.postMessage(siteAppearancePayload(), location.origin);
          postProfileMedia(target, profileMediaPayload(), true);
          postLinkedChatLogin(target);
        } catch (error) {}
      }
      return;
    }
    if (data.type === "learning-zones-background-change") {
      setSiteSettingsPatch({ background: normalizeSiteBackground(data.background || data.value) });
      return;
    }
    if (data.type === "learning-zones-appearance-change") {
      if (data.theme || data.value || data.colorMode) {
        const current = siteThemePreference();
        const selected = normalizeSiteTheme(data.theme || data.value || current.value || "ember");
        setSiteThemePreference({
          ...selected,
          colorMode: data.colorMode === "dark" ? "dark" : data.colorMode === "light" ? "light" : current.colorMode || "light",
          accent: data.accent || selected.accent
        });
      }
      if (data.background || data.settings?.background) {
        setSiteSettingsPatch({ background: normalizeSiteBackground(data.background || data.settings.background) });
      }
      return;
    }
    if (data.type === "learning-zones-theme-change") {
      const current = siteThemePreference();
      const selected = normalizeSiteTheme(data.theme || data.value || current.value || "ember");
      setSiteThemePreference({
        ...selected,
        colorMode: data.colorMode === "dark" ? "dark" : data.colorMode === "light" ? "light" : current.colorMode || "light"
      });
      if (data.background || data.settings?.background) {
        setSiteSettingsPatch({ background: normalizeSiteBackground(data.background || data.settings.background) });
      }
      return;
    }
    if (data.type !== "taco-auth") return;
    applySnapshot(makeSnapshot(data.user));
    if (data.user && accountLinkPreference().mode === "chat") {
      setSiteSessionUsername(data.user.username || data.user.id, "chat-auth");
      hydrateFromFirebase(data.user.username || data.user.id).catch(() => {});
    }
    renderAccountLinkCards();
    scheduleZoneRatingsForRoute(150);
    scheduleGameCoversForRoute(150);
  });

  window.addEventListener("storage", event => {
    if (event.key === CHAT_NOTIFICATION_KEY) {
      scheduleChatNotificationRefresh(100);
      return;
    }
    if (event.key === SITE_THEME_KEY) {
      applySiteThemePreference();
      applySiteSettingsPreferences();
      ensureSiteThemeControl();
      syncSiteSettingsRoute();
      requestChatFrameSync();
      scheduleZoneRatingsForRoute(150);
      scheduleGameCoversForRoute(150);
      return;
    }
    if (event.key === SITE_SETTINGS_KEY) {
      applySiteSettingsPreferences();
      syncSiteSettingsRoute();
      requestChatFrameSync();
      scheduleZoneRatingsForRoute(150);
      scheduleGameCoversForRoute(150);
      scheduleScrollReveal(document, 80);
      return;
    }
    if (event.key === "ugp_token" || event.key === USER_KEY || event.key === CACHE_KEY || event.key === LINK_KEY) {
      hydrateFromFirebase().catch(() => {});
      ensureSiteProfileButton();
      renderSiteProfile();
      renderAccountLinkCards();
      ensureSiteThemeControl();
      requestChatFrameSync();
      scheduleZoneRatingsForRoute(150);
      scheduleGameCoversForRoute(150);
      scheduleChatNotificationRefresh(180);
    }
  });

  window.learningZonesChatSync = {
    keys: { cache: CACHE_KEY, user: USER_KEY, profile: PROFILE_KEY, friends: FRIENDS_KEY, requests: REQUESTS_KEY, link: LINK_KEY, notifications: CHAT_NOTIFICATION_KEY },
    current: () => currentSnapshot,
    refresh: hydrateFromFirebase,
    request: requestChatFrameSync,
    openProfile: openSiteProfile,
    link: chooseAccountLinkMode,
    theme: setSiteThemePreference,
    settings: {
      current: siteSettings,
      set: setSiteSettingsPatch,
      background: value => setSiteSettingsPatch({ background: normalizeSiteBackground(value) }),
      open: () => navigateSiteSettings("/settings")
    },
    ratings: {
      refresh: () => hydrateZoneRatings(true),
      rate: saveZoneRating
    },
    notifications: {
      refresh: () => refreshChatNotifications(true),
      markRead: () => markChatNotificationsRead({ throughNow: true }),
      state: () => ({ ...chatNotificationLatest, counts: { ...chatNotificationLatest.counts } })
    },
    covers: {
      refresh: () => loadGameCoverManifest(true).then(() => {
        mountGameCardCovers();
        refreshGameCoverImages();
        updateGameCoverState("manual-refresh");
      }),
      state: () => window.__learningZonesCoverState
    }
  };

  installOfflineFirebaseFetchFallback();
  installSaveCommitWorker();
  applySiteThemePreference();
  applySiteSettingsPreferences();
  if (currentSnapshot && !snapshotMatchesActiveUser(currentSnapshot)) {
    clearStaleProfileCache();
    currentSnapshot = null;
  }
  if (currentSnapshot) applySnapshot(currentSnapshot, { skipCloud: true });
  watchChromebookMode();
  watchOnlineCounters();
  watchChatNotifications();
  installSaveButtonFeedback();
  if (isChatRoute() || isSettingsRoute()) {
    watchPresenceHeartbeat();
    startSpectateRealtime();
  } else {
    setTimeout(() => {
      watchPresenceHeartbeat();
      startSpectateRealtime();
    }, 9000);
  }
  window.addEventListener("beforeunload", () => {
    clearZoneActivity("tab_closed", { keepalive: true });
    if (activeSpectateSessionId) endSpectateSession(activeSpectateSessionId, "tab_closed", { keepalive: true }).catch(() => {});
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && activeSpectateSessionId) {
      event.preventDefault();
      endSpectateSession(activeSpectateSessionId, "left").catch(() => closeSpectatorView(true));
    }
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && document.documentElement.dataset.lzTabInactive !== "true") {
      siteDefaultTitle = isSettingsRoute() ? "Settings - Learning Zones" : (document.title || siteDefaultTitle || "Learning Zones");
      renderHeaderStreak();
      renderSiteProfile();
      scheduleStreakExpiryRefresh();
    }
    applyInactiveTabSettings();
  });
  function scheduleStartupCloudSync() {
    const cloudDelay = isChatRoute() || isSettingsRoute() ? 350 : 8500;
    setTimeout(() => hydrateFromFirebase().catch(() => {}), cloudDelay);
    scheduleStreakExpiryRefresh();
    if (isChatRoute() || isSettingsRoute()) touchPresence();
    else setTimeout(touchPresence, 9000);
    scheduleOnlineCounterRefresh(isChatRoute() ? 400 : 9000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      syncChatOverlayForRoute();
      watchChatOverlayRoute();
      watchChatOverlayMount();
      watchFullscreenOverlayPosition();
      watchZoneRatingsMount();
      watchGameCoverMount();
      watchChatFrames();
      installSiteProfile();
      ensureLoginAccountLinkFinePrint();
      watchLoginAccountLinkMount();
      watchOfflineSiteLoginFallback();
      watchSiteProfileMount();
      watchZoneWordsUi();
      watchHomeDiscoveryMount();
      scheduleGameCoverWarmup();
      scheduleStaticMediaOptimization(document, 250);
      scheduleHomeDiscoveryForRoute(240);
      scheduleHomeDiscoveryWarmup();
      scheduleStartupCloudSync();
    }, { once: true });
  } else {
    syncChatOverlayForRoute();
    watchChatOverlayRoute();
    watchChatOverlayMount();
    watchFullscreenOverlayPosition();
    watchZoneRatingsMount();
    watchGameCoverMount();
    watchChatFrames();
    installSiteProfile();
    ensureLoginAccountLinkFinePrint();
    watchLoginAccountLinkMount();
    watchOfflineSiteLoginFallback();
    watchSiteProfileMount();
    watchZoneWordsUi();
    watchHomeDiscoveryMount();
    scheduleGameCoverWarmup();
    scheduleStaticMediaOptimization(document, 250);
    scheduleHomeDiscoveryForRoute(240);
    scheduleHomeDiscoveryWarmup();
    scheduleStartupCloudSync();
  }
})();

