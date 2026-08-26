import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = String(process.argv[2] || "http://127.0.0.1:4188").replace(/\/+$/, "");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !/server responded with a status of 401/i.test(message.text())) {
    consoleErrors.push(message.text());
  }
});

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  const username = page.getByTestId("username-input");
  const password = page.getByTestId("password-input");
  const submit = page.getByTestId("login-submit");
  await username.waitFor({ state: "visible", timeout: 10_000 });
  await page.evaluate(() => {
    window.__learningZonesSmokeClickAt = 0;
    window.__learningZonesSmokeErrorAt = 0;
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.('[data-testid="login-submit"]')) {
        window.__learningZonesSmokeClickAt = Date.now();
      }
    }, true);
    new MutationObserver(() => {
      const text = String(document.querySelector('[data-testid="auth-error"]')?.textContent || "").trim();
      if (text && !window.__learningZonesSmokeErrorAt) window.__learningZonesSmokeErrorAt = Date.now();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
  await username.fill("__lz_missing_probe__");
  await password.fill("Wrong-Probe-Password!");

  await submit.click();
  const error = page.getByTestId("auth-error");
  await error.waitFor({ state: "visible", timeout: 5_000 });
  const marks = await page.evaluate(() => ({
    clickAt: Number(window.__learningZonesSmokeClickAt || 0),
    errorAt: Number(window.__learningZonesSmokeErrorAt || 0)
  }));
  const elapsedMs = marks.errorAt - marks.clickAt;
  const message = String(await error.textContent() || "").trim();
  const localPreview = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(baseUrl);
  const feedbackBudgetMs = localPreview ? 4_000 : 2_500;

  assert.match(message, /^Account not found\.?$/);
  assert.ok(marks.clickAt > 0, "The sign-in click was not observed.");
  assert.ok(marks.errorAt >= marks.clickAt, "The sign-in feedback time was not observed.");
  assert.ok(elapsedMs < feedbackBudgetMs, `Sign-in feedback took ${elapsedMs}ms after the click.`);
  assert.equal(await submit.isEnabled(), true, "The sign-in button stayed disabled.");
  assert.equal(String(await submit.textContent() || "").trim(), "Sign in");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  console.log(JSON.stringify({
    passed: true,
    baseUrl,
    elapsedMs,
    feedbackBudgetMs,
    feedback: message,
    buttonRestored: true
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
