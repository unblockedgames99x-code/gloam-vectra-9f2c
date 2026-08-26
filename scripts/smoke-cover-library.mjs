import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4188";
const failures = [];
const checks = [];

function check(name, passed, detail = "") {
  checks.push({ name, passed: Boolean(passed), detail });
  if (!passed) failures.push({ name, detail });
}

const browser = await chromium.launch({ headless: true });

async function createContext(viewport, reducedMotion = "reduce") {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(() => {
    localStorage.setItem("ugp_token", "static-firebase:cover-smoke");
    localStorage.setItem(
      "ugp_session",
      JSON.stringify({ id: "cover-smoke", username: "cover-smoke", role: "user", status: "approved" })
    );
    localStorage.setItem(
      "ugp_recent_zones_v1",
      JSON.stringify([
        { slug: "retro-bowl", title: "Retro Bowl", at: Date.now() },
        { slug: "2048", title: "2048", at: Date.now() - 1000 },
      ])
    );
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const allowed = url.origin === baseUrl;
    if (allowed) route.continue().catch(() => {});
    else route.abort().catch(() => {});
  });
  return context;
}

async function waitForHome(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('[data-testid="games-grid"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => window.__learningZonesCoverState?.manifestCount === 3989, null, { timeout: 15_000 });
  await page.locator('#lz-home-featured-panel[data-lz-featured-ready="true"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

function circularDistance(a, b, width) {
  if (!Number.isFinite(width) || width <= 0) return Math.abs(a - b);
  const direct = Math.abs(a - b);
  return Math.min(direct, Math.abs(width - direct));
}

async function inspectFeaturedRail() {
  const context = await createContext({ width: 1440, height: 900 }, "no-preference");
  const page = await context.newPage();
  const localErrors = [];
  page.on("pageerror", (error) => localErrors.push(error.message));
  await waitForHome(page);

  const panel = page.locator("#lz-home-featured-panel");
  const originalCards = panel.locator('[data-lz-featured-group="original"] .lz-home-game-card');
  const cloneCards = panel.locator('[data-lz-featured-group="clone"] .lz-home-game-card');
  const initialMarkup = await panel.evaluate((element) => ({
    label: element.getAttribute("aria-labelledby"),
    heading: element.querySelector("h2")?.textContent?.trim() || "",
    itemCount: Number(element.dataset.lzFeaturedCount || 0),
    originalCards: element.querySelectorAll('[data-lz-featured-group="original"] .lz-home-game-card').length,
    cloneCards: element.querySelectorAll('[data-lz-featured-group="clone"] .lz-home-game-card').length,
    cloneHidden: element.querySelector('[data-lz-featured-group="clone"]')?.getAttribute("aria-hidden"),
    cloneTabStops: Array.from(element.querySelectorAll('[data-lz-featured-group="clone"] a, [data-lz-featured-group="clone"] button'))
      .filter((node) => node.getAttribute("tabindex") !== "-1").length,
  }));
  check("featured rail: accessible heading", initialMarkup.label === "lz-home-featured-title" && initialMarkup.heading === "Start in seconds", JSON.stringify(initialMarkup));
  check("featured rail: real featured set rendered", initialMarkup.itemCount === 7 && initialMarkup.originalCards === 7, JSON.stringify(initialMarkup));
  check("featured rail: visual clones hidden from accessibility", initialMarkup.cloneCards === 7 && initialMarkup.cloneHidden === "true" && initialMarkup.cloneTabStops === 0, JSON.stringify(initialMarkup));
  check("featured rail: previous control named", await panel.locator('[data-lz-featured-previous][aria-label="Show previous featured zone"]').count() === 1);
  check("featured rail: next control named", await panel.locator('[data-lz-featured-next][aria-label="Show next featured zone"]').count() === 1);
  const fallbackState = await originalCards.last().evaluate((card) => {
    const image = card.querySelector(".lz-home-game-cover img");
    image?.dispatchEvent(new Event("error"));
    return {
      imageCount: card.querySelectorAll(".lz-home-game-cover img").length,
      fallbackCount: card.querySelectorAll(".lz-home-game-cover svg").length,
    };
  });
  check("featured rail: failed covers render the existing fallback", fallbackState.imageCount === 0 && fallbackState.fallbackCount === 1, JSON.stringify(fallbackState));

  await page.mouse.move(12, 860);
  await page.waitForTimeout(180);
  const movingStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(600);
  const movingEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const movingDistance = circularDistance(movingStart?.offset || 0, movingEnd?.offset || 0, movingEnd?.loopWidth || 0);
  check("featured rail: moves continuously right to left", movingDistance >= 4 && movingEnd?.paused === false, JSON.stringify({ movingStart, movingEnd, movingDistance }));

  await panel.hover();
  await page.waitForTimeout(35);
  const hoverStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(400);
  const hoverEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const hoverDistance = circularDistance(hoverStart?.offset || 0, hoverEnd?.offset || 0, hoverEnd?.loopWidth || 0);
  check("featured rail: hover freezes exact pixel position", hoverDistance <= 0.75 && hoverEnd?.paused === true, JSON.stringify({ hoverStart, hoverEnd, hoverDistance }));

  await page.mouse.move(12, 860);
  await page.waitForTimeout(35);
  const resumeStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const resumeJump = circularDistance(hoverEnd?.offset || 0, resumeStart?.offset || 0, resumeStart?.loopWidth || 0);
  await page.waitForTimeout(450);
  const resumeEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const resumeDistance = circularDistance(resumeStart?.offset || 0, resumeEnd?.offset || 0, resumeEnd?.loopWidth || 0);
  check("featured rail: hover exit resumes without reset", resumeJump <= 2 && resumeDistance >= 5, JSON.stringify({ hoverEnd, resumeStart, resumeEnd, resumeJump, resumeDistance }));

  await originalCards.first().focus();
  await page.waitForTimeout(35);
  const focusStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(400);
  const focusEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const focusDistance = circularDistance(focusStart?.offset || 0, focusEnd?.offset || 0, focusEnd?.loopWidth || 0);
  check("featured rail: keyboard focus pauses autoplay", focusDistance <= 0.75 && focusEnd?.paused === true, JSON.stringify({ focusStart, focusEnd, focusDistance }));

  const manualStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await panel.locator("[data-lz-featured-next]").click();
  await page.waitForTimeout(340);
  const manualEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const manualDelta = ((manualEnd?.offset || 0) - (manualStart?.offset || 0) + (manualEnd?.loopWidth || 1)) % (manualEnd?.loopWidth || 1);
  check("featured rail: next control advances one card", Math.abs(manualDelta - (manualEnd?.cardStep || 0)) <= 3, JSON.stringify({ manualStart, manualEnd, manualDelta }));

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(12, 860);
  await page.waitForTimeout(350);
  const viewport = panel.locator("[data-lz-featured-viewport]");
  const dragBox = await viewport.boundingBox();
  const dragStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  if (dragBox) {
    const y = dragBox.y + Math.min(80, dragBox.height / 2);
    await page.mouse.move(dragBox.x + Math.min(220, dragBox.width * 0.65), y);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + Math.min(140, dragBox.width * 0.35), y, { steps: 4 });
    await page.mouse.up();
  }
  const dragEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const dragDistance = circularDistance(dragStart?.offset || 0, dragEnd?.offset || 0, dragEnd?.loopWidth || 0);
  check("featured rail: horizontal drag updates position", Boolean(dragBox) && dragDistance >= 30, JSON.stringify({ dragStart, dragEnd, dragDistance }));
  check("featured rail: drag does not launch a zone", new URL(page.url()).pathname === "/", page.url());

  await page.waitForTimeout(360);
  await page.evaluate(() => {
    const railViewport = document.querySelector("[data-lz-featured-viewport]");
    const viewportBox = railViewport?.getBoundingClientRect();
    const visibleCard = Array.from(document.querySelectorAll('[data-lz-featured-group="original"] .lz-home-game-card'))
      .find((card) => {
        const box = card.getBoundingClientRect();
        return viewportBox && box.right > viewportBox.left + 36 && box.left < viewportBox.right - 36;
      });
    visibleCard?.click();
  });
  await page.waitForURL(/\/zone\//, { timeout: 10_000 });
  await page.waitForFunction(() => !window.learningZonesFeaturedRail, null, { timeout: 5_000 });
  check("featured rail: controller cleans up after route change", await page.evaluate(() => window.learningZonesFeaturedRail === null));
  check("featured rail: no page errors", localErrors.length === 0, localErrors.slice(0, 3).join(" | "));
  await context.close();
}

async function inspectFeaturedRailReducedMotion() {
  const context = await createContext({ width: 1440, height: 900 }, "reduce");
  const page = await context.newPage();
  await waitForHome(page);
  const panel = page.locator("#lz-home-featured-panel");
  const viewport = panel.locator("[data-lz-featured-viewport]");
  const before = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  const reducedState = await panel.evaluate((element) => ({
    reduced: element.dataset.lzFeaturedReducedMotion,
    autoplay: element.dataset.lzFeaturedAutoplay,
    transform: element.querySelector("[data-lz-featured-track]")?.style.transform || "",
    cloneDisplay: getComputedStyle(element.querySelector('[data-lz-featured-group="clone"]')).display,
  }));
  check("featured rail: reduced motion disables autoplay", before?.reducedMotion === true && after?.reducedMotion === true && circularDistance(before?.offset || 0, after?.offset || 0, after?.loopWidth || 0) <= 0.25, JSON.stringify({ before, after, reducedState }));
  check("featured rail: reduced motion exposes a static manual row", reducedState.reduced === "true" && reducedState.autoplay === "false" && reducedState.transform === "" && reducedState.cloneDisplay === "none", JSON.stringify(reducedState));
  const scrollBefore = await viewport.evaluate((element) => element.scrollLeft);
  await panel.locator("[data-lz-featured-next]").click();
  await page.waitForTimeout(80);
  const scrollAfter = await viewport.evaluate((element) => element.scrollLeft);
  check("featured rail: reduced-motion next control scrolls manually", scrollAfter > scrollBefore + 20, `${scrollBefore} -> ${scrollAfter}`);
  await context.close();
}

async function inspectFeaturedRailResponsive() {
  const context = await createContext({ width: 1920, height: 1080 }, "reduce");
  const page = await context.newPage();
  await waitForHome(page);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    await page.locator("[data-lz-featured-viewport]").evaluate((element) => { element.scrollLeft = 0; });
    const layout = await page.evaluate(() => {
      const panel = document.getElementById("lz-home-featured-panel");
      const railViewport = panel?.querySelector("[data-lz-featured-viewport]");
      const cards = panel?.querySelectorAll('[data-lz-featured-group="original"] .lz-home-game-card');
      if (!panel || !railViewport || !cards?.length) return null;
      const panelBox = panel.getBoundingClientRect();
      const viewportBox = railViewport.getBoundingClientRect();
      const first = cards[0].getBoundingClientRect();
      const second = cards[1]?.getBoundingClientRect();
      const secondVisible = second
        ? Math.max(0, Math.min(second.right, viewportBox.right) - Math.max(second.left, viewportBox.left))
        : 0;
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelLeft: panelBox.left,
        panelRight: panelBox.right,
        viewportWidth: viewportBox.width,
        firstWidth: first.width,
        secondVisible,
      };
    });
    const label = `featured rail ${viewport.width}px`;
    check(`${label}: no page overflow`, Boolean(layout) && layout.pageOverflow <= 1, JSON.stringify(layout));
    check(`${label}: panel stays inside viewport`, Boolean(layout) && layout.panelLeft >= -1 && layout.panelRight <= viewport.width + 1, JSON.stringify(layout));
    check(`${label}: next card remains visibly discoverable`, Boolean(layout) && layout.secondVisible >= 18, JSON.stringify(layout));
  }
  await context.close();
}

async function inspectHome(viewport, label) {
  const context = await createContext(viewport);
  const page = await context.newPage();
  const localErrors = [];
  page.on("pageerror", (error) => localErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /127\.0\.0\.1|uncaught|syntaxerror/i.test(message.text())) {
      localErrors.push(message.text());
    }
  });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('[data-testid="games-grid"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => window.__learningZonesCoverState?.manifestCount === 3989, null, { timeout: 15_000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-lz-game-cover] img").length >= 8, null, {
    timeout: 15_000,
  });
  await page.locator("#lz-home-discovery").waitFor({ state: "attached", timeout: 12_000 }).catch(() => {});

  const homeState = await page.evaluate(() => ({
    manifest: window.__learningZonesCoverState?.manifestCount || 0,
    coverImages: document.querySelectorAll("[data-lz-game-cover] img").length,
    recommended: Boolean(document.querySelector(".lz-home-recommended-grid")),
    continuePlaying: Boolean(document.querySelector(".lz-home-continue-list")),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  check(`${label}: manifest loaded`, homeState.manifest === 3989, String(homeState.manifest));
  check(`${label}: real cover images mounted`, homeState.coverImages >= 8, String(homeState.coverImages));
  check(`${label}: recommendations mounted`, homeState.recommended);
  check(`${label}: Continue Playing mounted`, homeState.continuePlaying);
  check(`${label}: no horizontal overflow`, !homeState.horizontalOverflow);

  const search = page.locator('[data-testid="search-input"]');
  await search.fill("Retro Bowl");
  await page.waitForFunction(
    () => {
      const value = document.querySelector('[data-testid="search-results-count"]')?.textContent || "";
      return /result/i.test(value) && !/showing all/i.test(value);
    },
    null,
    { timeout: 10_000 }
  );
  const searchCards = await page.locator('[data-testid="games-grid"] > a').count();
  const retroCard = await page.locator('a[href="/zone/retro-bowl"]').count();
  check(`${label}: search returns results`, searchCards > 0, String(searchCards));
  check(`${label}: Retro Bowl is discoverable`, retroCard > 0, String(retroCard));
  check(`${label}: no local console errors`, localErrors.length === 0, localErrors.slice(0, 3).join(" | "));
  await context.close();
}

async function inspectGameRoutes() {
  const context = await createContext({ width: 1366, height: 768 });
  const page = await context.newPage();

  async function inspectImmersiveControls(label) {
    const chatButton = page.locator("#lz-chat-open-button");
    const immersiveButton = page.locator('[data-testid="immersive-btn"]');
    await chatButton.waitFor({ state: "visible", timeout: 12_000 });
    await immersiveButton.click();

    const exitButton = page.locator('[data-testid="exit-immersive-btn"]');
    await exitButton.waitFor({ state: "visible", timeout: 5_000 });
    await page.waitForFunction(
      () => document.documentElement.dataset.lzFullscreenActive === "true",
      null,
      { timeout: 5_000 }
    );
    await page.waitForTimeout(180);

    const layout = await page.evaluate(() => {
      const chat = document.getElementById("lz-chat-open-button")?.getBoundingClientRect();
      const exit = document.querySelector('[data-testid="exit-immersive-btn"]')?.getBoundingClientRect();
      if (!chat || !exit) return null;
      const overlaps = !(
        chat.right <= exit.left ||
        chat.left >= exit.right ||
        chat.bottom <= exit.top ||
        chat.top >= exit.bottom
      );
      return {
        overlaps,
        verticalGap: Math.round(chat.top - exit.bottom),
        chatTop: Math.round(chat.top),
        exitBottom: Math.round(exit.bottom),
      };
    });

    check(`${label}: immersive controls do not overlap`, Boolean(layout && !layout.overlaps), JSON.stringify(layout));
    check(`${label}: chat control clears immersive exit`, Boolean(layout && layout.verticalGap >= 8), JSON.stringify(layout));
    await exitButton.click();
    await exitButton.waitFor({ state: "detached", timeout: 5_000 });
  }

  for (const slug of ["retro-bowl", "2048", "11-11"]) {
    await page.goto(`${baseUrl}/zone/${slug}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    const iframe = page.locator('iframe[data-testid="game-iframe"], iframe[src^="/games/"]').first();
    await iframe.waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
    const source = await iframe.getAttribute("src").catch(() => "");
    check(`game route ${slug}: local iframe attached`, Boolean(source?.startsWith("/games/")), source || "none");
    if (slug === "retro-bowl" && source?.startsWith("/games/")) {
      await inspectImmersiveControls("desktop");
      await page.setViewportSize({ width: 390, height: 844 });
      await inspectImmersiveControls("mobile");
      await page.setViewportSize({ width: 1366, height: 768 });
    }
  }
  await context.close();
}

async function inspectManifest() {
  const response = await fetch(`${baseUrl}/games/covers.json`, { cache: "no-store" });
  const manifest = await response.json();
  const entries = Object.entries(manifest);
  check("manifest HTTP response", response.ok, String(response.status));
  check("manifest has 3,989 entries", entries.length === 3989, String(entries.length));
  check(
    "manifest has no old generated-cover paths",
    entries.every(([, value]) => !String(value).includes("/generated-covers/"))
  );
  const local = entries.filter(([, value]) => String(value).startsWith("/games/captured-covers/"));
  for (const [slug, cover] of local.slice(0, 12)) {
    const coverResponse = await fetch(`${baseUrl}${cover}`);
    check(`cover response: ${slug}`, coverResponse.ok && /^image\//.test(coverResponse.headers.get("content-type") || ""), String(coverResponse.status));
  }
}

try {
  await inspectManifest();
  await inspectFeaturedRail();
  await inspectFeaturedRailReducedMotion();
  await inspectFeaturedRailResponsive();
  await inspectHome({ width: 1440, height: 900 }, "desktop");
  await inspectHome({ width: 390, height: 844 }, "mobile");
  await inspectGameRoutes();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ passed: failures.length === 0, checks, failures }, null, 2));
if (failures.length) process.exitCode = 1;
