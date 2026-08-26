(function () {
  "use strict";

  var RECOVERY_PREFIX = "learning-zones-route-recovery:";
  var RECOVERY_WINDOW_MS = 30000;
  var ROUTE_ALIASES = {
    "/games": "/",
    "/zones": "/",
  };
  var PUBLIC_ROUTES = new Set([
    "/login",
    "/register",
    "/pending",
    "/settings",
    "/settings.html",
    "/report-a-bug",
    "/report-bug",
  ]);
  var APP_ROUTES = new Set([
    "/",
    "/chat",
    "/community",
    "/gamemaker",
    "/owner",
    "/party",
    "/suggest",
  ]);
  var routeCheckTimer = 0;

  function normalizedPath(path) {
    return String(path || "/").replace(/\/+$/, "") || "/";
  }

  function aliasFor(path) {
    return ROUTE_ALIASES[normalizedPath(path)] || "";
  }

  function hasStoredSession() {
    try {
      if (window.localStorage.getItem("ugp_token")) return true;
      var session = JSON.parse(window.localStorage.getItem("ugp_session") || "null") || {};
      var username = String(session.username || session.id || "").replace(/^@+/, "");
      return (
        String(session.role || "").toLowerCase() === "owner" &&
        /^(carterb|london|ryanh)$/i.test(username)
      );
    } catch (_error) {
      return false;
    }
  }

  function isSupportedRoute(path) {
    path = normalizedPath(path);
    return APP_ROUTES.has(path) || PUBLIC_ROUTES.has(path) || path.indexOf("/zone/") === 0;
  }

  function requiresSession(path) {
    path = normalizedPath(path);
    return APP_ROUTES.has(path) || path.indexOf("/zone/") === 0;
  }

  function routeDestination(path) {
    var alias = aliasFor(path);
    if (alias) return alias;
    if (isSupportedRoute(path)) return normalizedPath(path);
    return hasStoredSession() ? "/" : "/login";
  }

  function destinationUrl(path, search, hash) {
    return path + (search || "") + (hash || "");
  }

  function normalizeInitialRoute() {
    var currentPath = normalizedPath(window.location.pathname);
    var destination = routeDestination(currentPath);

    if (destination !== currentPath) {
      if (aliasFor(currentPath)) {
        window.history.replaceState(
          window.history.state,
          "",
          destinationUrl(destination, window.location.search, window.location.hash)
        );
        currentPath = destination;
      } else {
        window.location.replace(destination);
        return false;
      }
    }

    if (!hasStoredSession() && requiresSession(currentPath)) {
      window.location.replace("/login");
      return false;
    }

    return true;
  }

  if (!normalizeInitialRoute()) return;

  function routeKey() {
    return RECOVERY_PREFIX + window.location.pathname;
  }

  function readRecoveryTime(key) {
    try {
      return Number(window.sessionStorage.getItem(key) || 0);
    } catch (_error) {
      var recovery = window.history.state && window.history.state.lzRouteRecovery;
      return recovery && recovery.key === key ? Number(recovery.time || 0) : 0;
    }
  }

  function writeRecoveryTime(key, time) {
    try {
      window.sessionStorage.setItem(key, String(time));
      return;
    } catch (_error) {
      var nextState = Object.assign({}, window.history.state || {}, {
        lzRouteRecovery: { key: key, time: time },
      });
      window.history.replaceState(nextState, "", window.location.href);
    }
  }

  function hasMeaningfulPage() {
    if (
      document.getElementById("lz-site-settings-page") ||
      document.getElementById("lz-report-bug-page")
    ) {
      return true;
    }

    var root = document.getElementById("root");
    var body = document.body;
    if (!root || !body) return false;

    var text = (root.textContent || "").trim();
    return (
      text.length > 24 ||
      Boolean(root.querySelector("main, iframe, form, [data-testid], [role='main']")) ||
      Boolean(body.querySelector("main, iframe, form, [data-testid='login-form'], [data-testid='register-form']"))
    );
  }

  function recoverOnce() {
    var key = routeKey();
    var lastRecovery = readRecoveryTime(key);
    if (Date.now() - lastRecovery < RECOVERY_WINDOW_MS) return;

    writeRecoveryTime(key, Date.now());
    window.location.reload();
  }

  function isChunkFailure(value) {
    var reason = value && value.reason ? value.reason : value;
    var message = String(
      (reason && reason.message) ||
        (value && value.message) ||
        reason ||
        ""
    );

    return /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message
    );
  }

  function scheduleBlankRouteCheck(expectedPath) {
    window.clearTimeout(routeCheckTimer);
    routeCheckTimer = window.setTimeout(function () {
      var currentPath = normalizedPath(window.location.pathname);
      if (currentPath === normalizedPath(expectedPath) && !hasMeaningfulPage()) {
        var destination = routeDestination(currentPath);
        if (destination !== currentPath) {
          window.location.replace(destination);
          return;
        }
        recoverOnce();
      }
    }, 2400);
  }

  window.addEventListener(
    "error",
    function (event) {
      if (isChunkFailure(event.error || event.message)) recoverOnce();
    },
    true
  );

  window.addEventListener("unhandledrejection", function (event) {
    if (isChunkFailure(event.reason)) recoverOnce();
  });

  document.addEventListener(
    "click",
    function (event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      var target = event.target;
      var anchor =
        target && target.closest ? target.closest("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;

      var destination;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch (_error) {
        return;
      }

      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      ) {
        return;
      }

      var alias = aliasFor(destination.pathname);
      if (alias) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.history.pushState(
          {},
          "",
          destinationUrl(alias, destination.search, destination.hash)
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }

      scheduleBlankRouteCheck(destination.pathname);
    },
    true
  );

  window.addEventListener("popstate", function () {
    var alias = aliasFor(window.location.pathname);
    if (alias) {
      window.history.replaceState(
        window.history.state,
        "",
        destinationUrl(alias, window.location.search, window.location.hash)
      );
    }
    scheduleBlankRouteCheck(window.location.pathname);
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        scheduleBlankRouteCheck(window.location.pathname);
      },
      { once: true }
    );
  } else {
    scheduleBlankRouteCheck(window.location.pathname);
  }

})();
