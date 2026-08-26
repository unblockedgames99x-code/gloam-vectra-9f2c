import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4188";
const browser = await chromium.launch({ headless: true });

function circularDistance(a, b, width) {
  if (!Number.isFinite(width) || width <= 0) return Math.abs(a - b);
  const direct = Math.abs(a - b);
  return Math.min(direct, Math.abs(width - direct));
}

async function createContext(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(() => {
    window.__lzHomepageCls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__lzHomepageCls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (error) {}
    localStorage.setItem("ugp_token", "static-firebase:home-ui-smoke");
    localStorage.setItem(
      "ugp_session",
      JSON.stringify({ id: "home-ui-smoke", username: "Home UI Smoke", role: "user", status: "approved" })
    );
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseUrl) route.continue().catch(() => {});
    else route.abort().catch(() => {});
  });
  return context;
}

async function openHome(context) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('[data-testid="games-grid"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.locator('#lz-home-featured-panel[data-lz-featured-ready="true"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page.locator("#lz-home-beta-trigger").waitFor({ state: "attached", timeout: 10_000 });
  return { page, pageErrors };
}

async function inspectDesktop() {
  const context = await createContext({ width: 1440, height: 900 });
  const { page, pageErrors } = await openHome(context);
  const beta = page.locator("#lz-home-beta-trigger");
  const popover = page.locator("#lz-home-beta-popover");
  const close = popover.locator("[data-lz-beta-close]");

  assert.equal(await beta.count(), 1, "The homepage must render exactly one Beta badge.");
  assert.equal(await beta.getAttribute("aria-expanded"), "false");
  assert.equal(await beta.getAttribute("aria-haspopup"), "dialog");
  assert.equal(await beta.getAttribute("aria-controls"), "lz-home-beta-popover");

  const headerLayout = await page.evaluate(() => {
    const betaRect = document.getElementById("lz-home-beta-trigger")?.getBoundingClientRect();
    const navRect = document.querySelector('[data-testid="site-header"] nav')?.getBoundingClientRect();
    const brandRect = document.querySelector('[data-testid="brand-link"]')?.getBoundingClientRect();
    if (!betaRect || !navRect || !brandRect) return null;
    return {
      betaRight: betaRect.right,
      navLeft: navRect.left,
      brandLeft: brandRect.left,
      betaLeft: betaRect.left,
    };
  });
  assert.ok(headerLayout, "The header layout must be measurable.");
  assert.ok(headerLayout.betaLeft >= headerLayout.brandLeft, JSON.stringify(headerLayout));
  assert.ok(headerLayout.betaRight <= headerLayout.navLeft - 4, JSON.stringify(headerLayout));
  const clsAtReady = await page.evaluate(() => window.__lzHomepageCls || 0);
  assert.ok(clsAtReady <= 0.05, `Homepage CLS exceeded 0.05: ${clsAtReady}`);

  await beta.click();
  await popover.waitFor({ state: "visible", timeout: 2_000 });
  assert.equal(await popover.getByRole("heading", { name: "Learning Zones Beta" }).count(), 1);
  assert.equal(
    await popover.locator("p").textContent(),
    "Learning Zones is actively being improved. Some features may not be available yet or may not be working to their best capability."
  );
  assert.equal(await close.textContent(), "Got it");
  const popoverLayout = await popover.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });
  assert.ok(popoverLayout.left >= 8 && popoverLayout.top >= 8, JSON.stringify(popoverLayout));
  assert.ok(popoverLayout.right <= popoverLayout.viewportWidth - 8, JSON.stringify(popoverLayout));
  assert.ok(popoverLayout.bottom <= popoverLayout.viewportHeight - 8, JSON.stringify(popoverLayout));

  await close.press("Escape");
  await popover.waitFor({ state: "hidden", timeout: 2_000 });
  assert.equal(await beta.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "lz-home-beta-trigger");

  await beta.click();
  await close.click();
  await popover.waitFor({ state: "hidden", timeout: 2_000 });
  assert.equal(await page.evaluate(() => document.activeElement?.id), "lz-home-beta-trigger");

  await beta.click();
  await page.mouse.click(700, 700);
  await popover.waitFor({ state: "hidden", timeout: 2_000 });

  const panel = page.locator("#lz-home-featured-panel");
  await page.mouse.move(12, 860);
  await page.waitForTimeout(180);
  const movingStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(420);
  const movingEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  assert.ok(
    circularDistance(movingStart?.offset || 0, movingEnd?.offset || 0, movingEnd?.loopWidth || 0) >= 3,
    JSON.stringify({ movingStart, movingEnd })
  );

  await panel.hover();
  await page.waitForTimeout(35);
  const pausedStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(280);
  const pausedEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  assert.equal(pausedEnd?.paused, true);
  assert.ok(
    circularDistance(pausedStart?.offset || 0, pausedEnd?.offset || 0, pausedEnd?.loopWidth || 0) <= 0.75,
    JSON.stringify({ pausedStart, pausedEnd })
  );

  await page.mouse.move(12, 860);
  await page.waitForTimeout(35);
  const resumedStart = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  await page.waitForTimeout(320);
  const resumedEnd = await page.evaluate(() => window.learningZonesFeaturedRail?.getState?.());
  assert.ok(
    circularDistance(pausedEnd?.offset || 0, resumedStart?.offset || 0, resumedStart?.loopWidth || 0) <= 2,
    JSON.stringify({ pausedEnd, resumedStart })
  );
  assert.ok(
    circularDistance(resumedStart?.offset || 0, resumedEnd?.offset || 0, resumedEnd?.loopWidth || 0) >= 3,
    JSON.stringify({ resumedStart, resumedEnd })
  );

  const homeLayout = await page.evaluate(() => {
    const shell = document.querySelector(".lz-home-featured-viewport-shell");
    const hero = document.querySelector(".lz-home-hero-wrap");
    const copy = document.querySelector(".lz-home-hero-copy");
    const panel = document.getElementById("lz-home-featured-panel");
    const discovery = document.getElementById("lz-home-discovery");
    if (!shell || !hero || !copy || !panel || !discovery) return null;
    const shellStyle = getComputedStyle(shell);
    const rightFade = getComputedStyle(shell, "::after");
    const heroRect = hero.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const discoveryRect = discovery.getBoundingClientRect();
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shellOverflow: shellStyle.overflow,
      shellRadius: parseFloat(shellStyle.borderRadius),
      fadeWidth: parseFloat(rightFade.width),
      copyPanelTopDifference: Math.abs(copyRect.top - panelRect.top),
      heroDiscoveryGap: Math.abs(heroRect.bottom - discoveryRect.top),
      discoveryTop: discoveryRect.top,
      viewportHeight: innerHeight,
    };
  });
  assert.ok(homeLayout, "The homepage layout must be measurable.");
  assert.ok(homeLayout.pageOverflow <= 1, JSON.stringify(homeLayout));
  assert.equal(homeLayout.shellOverflow, "hidden");
  assert.ok(homeLayout.shellRadius >= 10 && homeLayout.fadeWidth >= 40, JSON.stringify(homeLayout));
  assert.ok(homeLayout.copyPanelTopDifference <= 2, JSON.stringify(homeLayout));
  assert.ok(homeLayout.heroDiscoveryGap <= 2, JSON.stringify(homeLayout));
  assert.ok(homeLayout.discoveryTop < homeLayout.viewportHeight, JSON.stringify(homeLayout));

  const launcher = page.locator("#lz-chat-open-button");
  await launcher.click();
  await page.locator("#lz-chat-overlay.is-open").waitFor({ state: "visible", timeout: 5_000 });
  const emptySections = await page.evaluate(() => Array.from(
    document.querySelectorAll("#lz-chat-overlay .lz-chat-left .lz-chat-panel-section")
  ).map((section) => ({
    title: section.querySelector(".lz-chat-kicker span")?.textContent?.trim() || "",
    quiet: section.classList.contains("is-quiet-empty"),
    label: section.dataset.lzEmptyLabel || "",
    height: section.getBoundingClientRect().height,
  })));
  const party = emptySections.find((section) => section.title === "My Party");
  const active = emptySections.find((section) => section.title === "Active Chats");
  assert.ok(party?.quiet && party.label === "No party yet" && party.height < 52, JSON.stringify(emptySections));
  assert.ok(active?.quiet && active.label === "Nothing active" && active.height < 56, JSON.stringify(emptySections));

  await page.goto(`${baseUrl}/community`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('[data-testid="site-header"]').waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await page.locator("#lz-home-beta-trigger:visible").count(), 0, "The Beta badge must stay homepage-only.");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
  await context.close();
}

async function inspectMobile() {
  const context = await createContext({ width: 390, height: 844 }, "reduce");
  const { page, pageErrors } = await openHome(context);
  const layout = await page.evaluate(() => {
    const beta = document.getElementById("lz-home-beta-trigger");
    const panel = document.getElementById("lz-home-featured-panel")?.getBoundingClientRect();
    const discovery = document.getElementById("lz-home-discovery")?.getBoundingClientRect();
    return {
      betaHidden: beta?.hidden,
      betaDisplay: beta ? getComputedStyle(beta).display : "",
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelLeft: panel?.left,
      panelRight: panel?.right,
      discoveryLeft: discovery?.left,
      discoveryRight: discovery?.right,
      viewportWidth: innerWidth,
    };
  });
  assert.equal(layout.betaHidden, true);
  assert.equal(layout.betaDisplay, "none");
  assert.ok(layout.pageOverflow <= 1, JSON.stringify(layout));
  assert.ok(layout.panelLeft >= 0 && layout.panelRight <= layout.viewportWidth, JSON.stringify(layout));
  assert.ok(layout.discoveryLeft >= 0 && layout.discoveryRight <= layout.viewportWidth, JSON.stringify(layout));
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
  await context.close();
}

try {
  await inspectDesktop();
  await inspectMobile();
  console.log("Homepage Beta/UI smoke: passed");
} finally {
  await browser.close();
}
