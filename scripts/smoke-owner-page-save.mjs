import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const baseUrl = process.argv[2] || "http://127.0.0.1:4188";
const bundleName = "main.9ee8cc75.js";

const [indexHtml, manifestText, bundle, saveBridge] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "asset-manifest.json"), "utf8"),
  readFile(path.join(root, "static", "js", bundleName), "utf8"),
  readFile(path.join(root, "owner-page-save-bridge.js"), "utf8"),
]);
const manifest = JSON.parse(manifestText);

assert.match(indexHtml, new RegExp(`/static/js/${bundleName.replaceAll(".", "\\.")}`));
assert.equal(manifest.files["main.js"], `/static/js/${bundleName}`);
assert.ok(bundle.includes('?print=silent'), "Firebase writes must suppress the echoed HTML response.");
assert.ok(bundle.includes("Save took too long. Try again."), "Firebase writes must have a bounded timeout.");
assert.ok(bundle.includes("setTimeout(()=>l.abort(),15e3)"), "Large owner HTML saves need a longer bounded timeout.");
assert.ok(bundle.includes("[.#$/[\\]@\\s]"), "Owner names should normalize @carterb and CarterB the same way.");
assert.ok(bundle.includes("ugp_session"), "Owner saves should recover from a missing static Firebase token.");
assert.ok(bundle.includes("204===u.status"), "Silent Firebase responses must be handled without JSON parsing.");
assert.match(indexHtml, /owner-page-save-bridge\.js/);
assert.match(saveBridge, /\.netlify\/functions\/save-owner-page/);

const account = {
  username: "CarterB",
  role: "owner",
  ugpStatus: "approved",
  status: "online",
  password: "not-used-by-this-test",
};
const pageHtml = "<!doctype html><html><body><main>Owner save smoke test</main></body></html>";
let saveRequest = null;

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.removeItem("ugp_token");
    localStorage.setItem(
      "ugp_session",
      JSON.stringify({ id: "@carterb", username: "@CarterB", role: "owner", status: "approved" })
    );
  });
  await context.route("https://taco-chat-c1539-default-rtdb.firebaseio.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === "PUT" || method === "PATCH" || method === "DELETE") {
      if (url.pathname.endsWith("/ultimateGameStash/pages/chat.json")) {
        saveRequest = { method, url: url.href, body: request.postData() || "" };
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    let value = null;
    if (url.pathname.endsWith("/accounts/carterb.json")) value = account;
    else if (url.pathname.endsWith("/accounts.json")) value = { carterb: account };
    else if (/\/ultimateGameStash\/pages\/(chat|community|gamemaker|party)\.json$/.test(url.pathname)) value = pageHtml;
    else if (url.pathname.endsWith("/ultimateGameStash/suggestions.json")) value = {};

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  await context.route("**/.netlify/functions/save-owner-page**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    saveRequest = {
      method: request.method(),
      url: url.href,
      body: request.postData() || "",
      page: url.searchParams.get("page"),
    };
    await new Promise((resolve) => setTimeout(resolve, 60));
    await route.fulfill({ status: 204, body: "" });
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/owner`, { waitUntil: "domcontentloaded", timeout: 20_000 });

  const textarea = page.locator('[data-testid="page-html-textarea-chat"]');
  const saveButton = page.locator('[data-testid="save-html-btn-chat"]');
  await page.getByRole("button", { name: "Page HTML", exact: true }).click();
  try {
    await textarea.waitFor({ state: "visible", timeout: 20_000 });
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          url: page.url(),
          title: await page.title(),
          body: (await page.locator("body").innerText()).slice(0, 1_200),
          pageErrors,
        },
        null,
        2
      )
    );
    throw error;
  }
  const payload = `${pageHtml}\n<!-- ${"owner-save-large-payload ".repeat(1200)} -->`;
  await textarea.fill(payload);

  const startedAt = Date.now();
  await saveButton.click();
  await assert.doesNotReject(
    saveButton.getByText("Save HTML", { exact: true }).waitFor({ state: "visible", timeout: 2_000 })
  );
  const elapsedMs = Date.now() - startedAt;

  assert.ok(saveRequest, "The owner save button must issue a same-domain save request.");
  assert.equal(saveRequest.method, "PUT");
  assert.equal(saveRequest.page, "chat");
  assert.equal(JSON.parse(saveRequest.body), payload);
  assert.ok(elapsedMs < 2_500, `Mocked save should finish promptly, received ${elapsedMs}ms.`);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({ passed: true, elapsedMs, saveUrl: saveRequest.url }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
