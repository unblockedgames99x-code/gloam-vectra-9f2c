(() => {
  const reportPaths = new Set(["/report-a-bug", "/report-bug"]);
  const suggestionsRoot = "https://taco-chat-c1539-default-rtdb.firebaseio.com/rooms/_deluxeAppState/state/ultimateGameStash/suggestions";
  const draftKey = "lz_bug_report_draft_v1";
  const lastPageKey = "lz_bug_report_last_page";
  const styleId = "lz-report-bug-styles";
  const pageId = "lz-report-bug-page";

  const linkStyles = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 106, 0, 0.28)",
    background: "rgba(255, 106, 0, 0.08)",
    color: "var(--lz-site-accent-readable, #9a3b00)",
    padding: "8px 11px",
    fontSize: "13px",
    fontWeight: "800",
    lineHeight: "1",
    textDecoration: "none",
    whiteSpace: "nowrap"
  };

  const iconStyles = {
    width: "14px",
    height: "14px",
    display: "inline-block",
    color: "var(--lz-site-accent-readable, #ff6a00)"
  };

  let rafId = 0;
  let previousTitle = "";
  let draftTimer = 0;

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function isReportPath() {
    return reportPaths.has(currentPath());
  }

  function readJson(key, fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function cleanAccountId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[.#$/[\]@\s]/g, "");
  }

  function currentMember() {
    const session = readJson("ugp_session", {}) || {};
    let id = cleanAccountId(session.id || session.username);
    let username = String(session.username || "").trim();
    if (!id) {
      try {
        const token = localStorage.getItem("ugp_token") || "";
        if (token.startsWith("static-firebase:")) {
          id = cleanAccountId(decodeURIComponent(token.slice("static-firebase:".length)));
        }
      } catch (error) {}
    }
    if (!username) username = id;
    return { id, username: username || "Member" };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function removeReportLinks() {
    document.querySelectorAll("[data-report-bug-link]").forEach((link) => link.remove());
  }

  function rememberCurrentPage() {
    if (isReportPath()) return;
    try {
      sessionStorage.setItem(lastPageKey, `${location.pathname}${location.search}${location.hash}`);
    } catch (error) {}
  }

  function addReportLink() {
    if (isReportPath()) {
      removeReportLinks();
      return false;
    }

    const nav = document.querySelector('[data-testid="site-header"] nav') || document.querySelector("header nav");
    if (!nav) return false;

    document.querySelectorAll("[data-report-bug-link]").forEach((link) => {
      if (link.parentElement !== nav) link.remove();
    });

    if (nav.querySelector("[data-report-bug-link]")) return true;

    const link = document.createElement("a");
    link.href = "/report-a-bug";
    link.setAttribute("data-report-bug-link", "true");
    link.setAttribute("data-testid", "nav-report-bug");
    Object.assign(link.style, linkStyles);
    link.innerHTML = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>',
      '<span>Report Bug</span>'
    ].join("");
    const svg = link.querySelector("svg");
    Object.assign(svg.style, iconStyles);
    svg.innerHTML = '<path d="M12 8v5"></path><path d="M12 17h.01"></path><path d="M10.3 4.3 2.9 17.1A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.9L13.7 4.3a2 2 0 0 0-3.4 0Z"></path>';
    link.addEventListener("pointerdown", rememberCurrentPage, { passive: true });
    link.addEventListener("click", rememberCurrentPage);

    const ownerLink = nav.querySelector('[data-testid="nav-owner"]');
    nav.insertBefore(link, ownerLink || null);
    return true;
  }

  function reportStyles() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      body.lz-report-bug-active {
        min-width: 0;
        min-height: 100vh;
        margin: 0;
        background: var(--lz-site-bg, #fffaf5);
        color: var(--lz-site-text, #1a1613);
      }
      #${pageId} {
        position: relative;
        z-index: 1;
        isolation: isolate;
        min-height: 100vh;
        background:
          radial-gradient(circle at 15% 0%, color-mix(in srgb, var(--lz-site-accent, #ff6a00) 8%, transparent), transparent 30%),
          var(--lz-site-bg, #fffaf5);
        color: var(--lz-site-text, #1a1613);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${pageId} * { box-sizing: border-box; }
      .lz-report-header {
        position: sticky;
        top: 0;
        z-index: 20;
        border-bottom: 1px solid var(--lz-site-border, #efe3d6);
        background: color-mix(in srgb, var(--lz-site-bg, #fffaf5) 90%, transparent);
        -webkit-backdrop-filter: blur(14px);
        backdrop-filter: blur(14px);
      }
      .lz-report-header-inner {
        width: min(1120px, calc(100% - 32px));
        min-height: 64px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }
      .lz-report-brand,
      .lz-report-nav a {
        display: inline-flex;
        align-items: center;
        color: inherit;
        text-decoration: none;
      }
      .lz-report-brand { gap: 10px; font-weight: 900; }
      .lz-report-brand-mark {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: var(--lz-site-accent, #ff6a00);
        color: var(--lz-site-on-accent, #fff);
        box-shadow: 0 10px 24px color-mix(in srgb, var(--lz-site-accent, #ff6a00) 24%, transparent);
      }
      .lz-report-nav { display: flex; align-items: center; gap: 8px; }
      .lz-report-nav a {
        min-height: 38px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 750;
      }
      .lz-report-nav a:hover {
        border-color: var(--lz-site-border, #efe3d6);
        background: var(--lz-site-surface, #fff);
      }
      .lz-report-main {
        width: min(760px, calc(100% - 32px));
        margin: 0 auto;
        padding: 56px 0 96px;
      }
      .lz-report-kicker {
        margin: 0 0 10px;
        color: var(--lz-site-accent-readable, #a63d00);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .lz-report-main h1 {
        margin: 0;
        font-size: clamp(34px, 6vw, 54px);
        font-weight: 950;
        letter-spacing: 0;
        line-height: 1;
      }
      .lz-report-lead {
        max-width: 620px;
        margin: 16px 0 0;
        color: var(--lz-site-muted, #655c55);
        font-size: 16px;
        line-height: 1.6;
      }
      .lz-report-form {
        margin-top: 32px;
        padding: 24px;
        display: grid;
        gap: 20px;
        border: 1px solid var(--lz-site-border, #e7d9cb);
        border-radius: 8px;
        background: var(--lz-site-surface, #fff);
        box-shadow: 0 24px 64px rgba(55, 36, 20, 0.1);
      }
      .lz-report-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
        gap: 16px;
      }
      .lz-report-field { display: grid; gap: 7px; min-width: 0; }
      .lz-report-field > span {
        color: var(--lz-site-muted, #655c55);
        font-size: 12px;
        font-weight: 850;
        text-transform: uppercase;
      }
      .lz-report-field input,
      .lz-report-field select,
      .lz-report-field textarea {
        width: 100%;
        min-width: 0;
        border: 1px solid var(--lz-site-border, #e7d9cb);
        border-radius: 8px;
        background: var(--lz-site-bg, #fffaf5);
        color: var(--lz-site-text, #1a1613);
        font: inherit;
        outline: none;
        transition: border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .lz-report-field input,
      .lz-report-field select { min-height: 46px; padding: 0 13px; }
      .lz-report-field textarea { min-height: 150px; padding: 12px 13px; line-height: 1.5; resize: vertical; }
      .lz-report-field input:focus,
      .lz-report-field select:focus,
      .lz-report-field textarea:focus {
        border-color: var(--lz-site-accent, #ff6a00);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--lz-site-accent, #ff6a00) 18%, transparent);
      }
      .lz-report-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .lz-report-member {
        color: var(--lz-site-muted, #655c55);
        font-size: 13px;
      }
      .lz-report-submit {
        min-height: 44px;
        padding: 0 18px;
        border: 0;
        border-radius: 8px;
        background: var(--lz-site-accent, #ff6a00);
        color: var(--lz-site-on-accent, #fff);
        font: inherit;
        font-weight: 850;
        cursor: pointer;
        transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .lz-report-submit:hover { transform: translate3d(0, -1px, 0); }
      .lz-report-submit:active { transform: scale(0.985); }
      .lz-report-submit:disabled { cursor: wait; opacity: 0.62; transform: none; }
      .lz-report-status {
        min-height: 22px;
        margin: -4px 0 0;
        color: var(--lz-site-muted, #655c55);
        font-size: 13px;
        font-weight: 700;
      }
      .lz-report-status[data-state="success"] { color: #167548; }
      .lz-report-status[data-state="error"] { color: #b42318; }
      @media (max-width: 640px) {
        .lz-report-header-inner { align-items: flex-start; padding: 12px 0; flex-direction: column; }
        .lz-report-nav { width: 100%; overflow-x: auto; }
        .lz-report-main { padding-top: 36px; }
        .lz-report-form { padding: 18px; }
        .lz-report-grid { grid-template-columns: 1fr; }
        .lz-report-actions { align-items: stretch; flex-direction: column; }
        .lz-report-submit { width: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .lz-report-submit,
        .lz-report-field input,
        .lz-report-field select,
        .lz-report-field textarea { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function referrerPath() {
    try {
      const stored = sessionStorage.getItem(lastPageKey);
      if (stored && !reportPaths.has(stored.split(/[?#]/)[0])) return stored;
      const referrer = new URL(document.referrer);
      if (referrer.origin === location.origin && !reportPaths.has(referrer.pathname)) {
        return `${referrer.pathname}${referrer.search}${referrer.hash}`;
      }
    } catch (error) {}
    return "/";
  }

  function loadDraft(memberId) {
    const draft = readJson(draftKey, {}) || {};
    return draft.userId === memberId ? draft : {};
  }

  function reportMarkup(member) {
    const draft = loadDraft(member.id);
    const summary = draft.summary || "";
    const category = draft.category || "zone";
    const page = draft.page || referrerPath();
    const details = draft.details || "";
    return `
      <div class="lz-report-header">
        <div class="lz-report-header-inner">
          <a class="lz-report-brand" href="/" aria-label="Learning Zones home">
            <span class="lz-report-brand-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-3.9 3.1L2 12c-.8 4 1.3 7 4 7 1.9 0 3-1.2 4-3h4c1 1.8 2.1 3 4 3 2.7 0 4.8-3 4-7l-.8-3.9A4 4 0 0 0 17.3 5Z"/></svg>
            </span>
            <span>Learning <span style="color:var(--lz-site-accent-readable,#b44000)">Zones</span></span>
          </a>
          <nav class="lz-report-nav" aria-label="Report page navigation">
            <a href="/">Zones</a>
            <a href="/chat">Chat</a>
            <a href="/settings">Settings</a>
          </nav>
        </div>
      </div>
      <main class="lz-report-main">
        <p class="lz-report-kicker">Help us fix it</p>
        <h1>Report a bug</h1>
        <p class="lz-report-lead">Tell us what broke and where it happened. Your report goes directly into the Owner panel for review.</p>
        <form class="lz-report-form" data-testid="bug-report-form">
          <div class="lz-report-grid">
            <label class="lz-report-field">
              <span>Category</span>
              <select name="category" data-testid="bug-category">
                <option value="zone"${category === "zone" ? " selected" : ""}>Zone issue</option>
                <option value="chat"${category === "chat" ? " selected" : ""}>Chat</option>
                <option value="account"${category === "account" ? " selected" : ""}>Account or login</option>
                <option value="layout"${category === "layout" ? " selected" : ""}>Layout or controls</option>
                <option value="performance"${category === "performance" ? " selected" : ""}>Slow or stuck loading</option>
                <option value="other"${category === "other" ? " selected" : ""}>Other</option>
              </select>
            </label>
            <label class="lz-report-field">
              <span>Page or zone</span>
              <input name="page" data-testid="bug-page-input" maxlength="240" value="${escapeHtml(page)}" placeholder="/zone/retro-bowl">
            </label>
          </div>
          <label class="lz-report-field">
            <span>Short summary</span>
            <input name="summary" data-testid="bug-summary-input" maxlength="120" minlength="5" required value="${escapeHtml(summary)}" placeholder="What is not working?">
          </label>
          <label class="lz-report-field">
            <span>What happened?</span>
            <textarea name="details" data-testid="bug-details-input" maxlength="1500" minlength="10" required placeholder="What did you click, what did you expect, and what happened instead?">${escapeHtml(details)}</textarea>
          </label>
          <div class="lz-report-actions">
            <span class="lz-report-member">Reporting as <strong>@${escapeHtml(member.username)}</strong></span>
            <button class="lz-report-submit" type="submit" data-testid="bug-submit-btn">Send report</button>
          </div>
          <p class="lz-report-status" data-testid="bug-report-status" role="status" aria-live="polite"></p>
        </form>
      </main>
    `;
  }

  function saveDraft(form, memberId) {
    const data = new FormData(form);
    const draft = {
      userId: memberId,
      category: String(data.get("category") || "other"),
      page: String(data.get("page") || "").trim(),
      summary: String(data.get("summary") || "").trim(),
      details: String(data.get("details") || "").trim()
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (error) {}
  }

  function setStatus(form, text, state = "") {
    const status = form.querySelector('[data-testid="bug-report-status"]');
    if (!status) return;
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  async function submitReport(form, member) {
    if (!member.id) {
      setStatus(form, "Please sign in before sending a report.", "error");
      return;
    }
    const data = new FormData(form);
    const category = String(data.get("category") || "other").trim();
    const page = String(data.get("page") || "").trim().slice(0, 240);
    const summary = String(data.get("summary") || "").trim().slice(0, 120);
    const details = String(data.get("details") || "").trim().slice(0, 1500);
    if (summary.length < 5 || details.length < 10) {
      setStatus(form, "Add a short summary and at least one sentence of detail.", "error");
      return;
    }

    const button = form.querySelector('[data-testid="bug-submit-btn"]');
    button.disabled = true;
    button.textContent = "Sending...";
    setStatus(form, "Sending your report...");

    const id = `bug_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id,
      user_id: member.id,
      username: member.username,
      game_name: `[Bug] ${summary}`,
      notes: [
        `Category: ${category}`,
        `Page: ${page || "/"}`,
        "",
        details,
        "",
        `Platform: ${navigator.userAgent.slice(0, 240)}`,
        `Viewport: ${window.innerWidth}x${window.innerHeight}`
      ].join("\n"),
      status: "open",
      created_at: new Date().toISOString(),
      report_type: "bug",
      category,
      page_url: page || "/"
    };

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), 10000);
    try {
      const response = await fetch(`${suggestionsRoot}/${encodeURIComponent(id)}.json`, {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
        signal: controller?.signal
      });
      if (!response.ok) throw new Error(`Report save failed (${response.status})`);
      try {
        localStorage.removeItem(draftKey);
      } catch (error) {}
      form.reset();
      form.elements.page.value = page || "/";
      setStatus(form, "Report sent. It is now in Owner > Suggestions.", "success");
    } catch (error) {
      saveDraft(form, member.id);
      setStatus(form, "Could not send the report. Your draft is saved on this device; please retry.", "error");
    } finally {
      window.clearTimeout(timer);
      button.disabled = false;
      button.textContent = "Send report";
    }
  }

  function mountReportPage() {
    if (!isReportPath() || document.getElementById(pageId)) return;
    reportStyles();
    removeReportLinks();
    const member = currentMember();
    const root = document.getElementById("root");
    if (root) root.hidden = true;
    const page = document.createElement("div");
    page.id = pageId;
    page.innerHTML = reportMarkup(member);
    document.body.classList.add("lz-report-bug-active");
    document.body.appendChild(page);
    if (!previousTitle) previousTitle = document.title;
    document.title = "Report a Bug - Learning Zones";

    const form = page.querySelector('[data-testid="bug-report-form"]');
    form.addEventListener("input", () => {
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(() => saveDraft(form, member.id), 180);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitReport(form, member);
    });
    requestAnimationFrame(() => form.querySelector('[data-testid="bug-summary-input"]')?.focus());
  }

  function unmountReportPage() {
    const page = document.getElementById(pageId);
    if (!page) return;
    page.remove();
    document.body.classList.remove("lz-report-bug-active");
    const root = document.getElementById("root");
    if (root) root.hidden = false;
    if (previousTitle) document.title = previousTitle;
  }

  function syncRoute() {
    if (isReportPath()) {
      mountReportPage();
      return;
    }
    unmountReportPage();
    addReportLink();
  }

  function scheduleSync() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      syncRoute();
    });
  }

  function patchHistory(methodName) {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod() {
      const result = original.apply(this, arguments);
      scheduleSync();
      return result;
    };
  }

  syncRoute();
  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", scheduleSync);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const intervalId = window.setInterval(syncRoute, 1500);

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    window.clearInterval(intervalId);
    window.clearTimeout(draftTimer);
    if (rafId) cancelAnimationFrame(rafId);
  }, { once: true });
})();
