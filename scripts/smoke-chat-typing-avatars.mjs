import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const frameScriptPath = path.join(root, "chat-account-link-frame.js");
const frameSource = await readFile(frameScriptPath, "utf8");
const siteSource = await readFile(path.join(root, "chat-site-sync.js"), "utf8");
const embedSource = await readFile(path.join(root, "page-embed.html"), "utf8");

assert.match(frameSource, /rooms\/_deluxeAppState\/typing/);
assert.match(frameSource, /users\.slice\(0,\s*3\)/);
assert.match(frameSource, /users\.length\s*-\s*3/);
assert.match(frameSource, /aria-live/);
assert.match(frameSource, /prefers-reduced-motion/);
assert.match(siteSource, /scheduleOverlayTypingSignal/);
assert.match(siteSource, /chatTypingUrl/);
assert.match(embedSource, /getCurrentRoom:\s*\(\)\s*=>\s*currentRoom/);
assert.match(embedSource, /chat-account-link-frame\.js\?v=20260724-typingavatars1/);

const chromeCandidates = [
  globalThis.process?.env?.PLAYWRIGHT_CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
].filter(Boolean);
const executablePath = chromeCandidates.find(candidate => existsSync(candidate));
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {})
});

try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  await page.setContent(`
    <!doctype html>
    <html>
      <head><style>
        :root { --panel: #fff; --surface: #fff; --accent: #ff7628; --muted: #756e67; }
        body { margin: 0; }
        .center { position: relative; height: 720px; --composer-height: 104px; }
        .composer { position: absolute; inset: auto 0 0; height: 104px; }
      </style></head>
      <body>
        <main class="center">
          <div class="composer"><textarea id="message-input"></textarea><button id="send-btn">Send</button></div>
        </main>
        <script>
          (() => {
            const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZP3sAAAAASUVORK5CYII=";
            const accounts = {
              carterb: { username: "CarterB", avatar: "CB" },
              london: { username: "London", avatar: pixel },
              ryanh: { username: "RyanH", avatar: "RH" },
              alex: { username: "Alex", avatar: "A" },
              jamie: { username: "Jamie", avatar: "J" }
            };
            const listeners = {};
            const writes = [];
            class Ref {
              constructor(path) { this.path = path; }
              child(name) { return new Ref(this.path + "/" + name); }
              on(type, callback) { if (type === "value") listeners[this.path] = callback; }
              off(type, callback) {
                if (type === "value" && listeners[this.path] === callback) delete listeners[this.path];
              }
              set(value) { writes.push({ op: "set", path: this.path, value }); return Promise.resolve(); }
              remove() { writes.push({ op: "remove", path: this.path }); return Promise.resolve(); }
              onDisconnect() { return { remove: () => Promise.resolve() }; }
            }
            window.__typingMock = {
              writes,
              emit(room, value) {
                const callback = listeners["rooms/_deluxeAppState/typing/" + room];
                if (callback) callback({ val: () => value });
              }
            };
            window.firebase = { database: () => ({ ref: path => new Ref(path) }) };
            window.__learningZonesChatAccountBridge = Object.freeze({
              getState: () => ({ accounts }),
              getMe: () => "CarterB",
              getCurrentRoom: () => "global",
              clientId: "tab_test",
              browserId: "browser_test",
              databaseUrl: "https://example.invalid",
              account: () => accounts.carterb,
              element: id => document.getElementById(id),
              installLinkedLogin: () => {}
            });
          })();
        </script>
      </body>
    </html>
  `);
  await page.addScriptTag({ path: frameScriptPath });
  await page.waitForSelector("#lz-full-chat-typing", { state: "attached" });

  const now = Date.now();
  await page.evaluate(stamp => {
    window.__typingMock.emit("global", {
      carterb: { own: { username: "CarterB", at: stamp } },
      london: { one: { username: "London", at: stamp + 2 } },
      ryanh: { one: { username: "RyanH", at: stamp + 1 } }
    });
  }, now);
  await page.waitForFunction(() => !document.getElementById("lz-full-chat-typing").hidden);

  let rendered = await page.evaluate(() => {
    const indicator = document.getElementById("lz-full-chat-typing");
    return {
      title: indicator.title,
      avatars: indicator.querySelectorAll(".lz-full-chat-typing-avatar").length,
      images: indicator.querySelectorAll(".lz-full-chat-typing-avatar img").length,
      bubble: indicator.querySelector(".lz-full-chat-typing-bubble")?.textContent?.trim(),
      selfShown: indicator.textContent.includes("CB")
    };
  });
  assert.equal(rendered.title, "London and RyanH are typing");
  assert.equal(rendered.avatars, 2);
  assert.equal(rendered.images, 1);
  assert.match(rendered.bubble, /^typing$/);
  assert.equal(rendered.selfShown, false);

  await page.evaluate(stamp => {
    window.__typingMock.emit("global", {
      london: { one: { username: "London", at: stamp + 4 } },
      ryanh: { one: { username: "RyanH", at: stamp + 3 } },
      alex: { one: { username: "Alex", at: stamp + 2 } },
      jamie: { one: { username: "Jamie", at: stamp + 1 } }
    });
  }, now);
  rendered = await page.evaluate(() => {
    const indicator = document.getElementById("lz-full-chat-typing");
    return {
      title: indicator.title,
      avatars: indicator.querySelectorAll(".lz-full-chat-typing-avatar").length,
      more: indicator.querySelector(".lz-full-chat-typing-more")?.textContent
    };
  });
  assert.equal(rendered.title, "London and 3 others are typing");
  assert.equal(rendered.avatars, 3);
  assert.equal(rendered.more, "+1");

  await page.locator("#message-input").fill("Hello");
  await page.waitForFunction(() => window.__typingMock.writes.some(item => item.op === "set"));
  const setWrite = await page.evaluate(() => window.__typingMock.writes.find(item => item.op === "set"));
  assert.equal(setWrite.path, "rooms/_deluxeAppState/typing/global/carterb/tab_test");
  assert.equal(setWrite.value.username, "CarterB");

  await page.locator("#message-input").press("Enter");
  await page.waitForFunction(() => window.__typingMock.writes.some(item => item.op === "remove"));
  const removeWrite = await page.evaluate(() => window.__typingMock.writes.find(item => item.op === "remove"));
  assert.equal(removeWrite.path, "rooms/_deluxeAppState/typing/global/carterb/tab_test");

  console.log("Chat typing avatar smoke passed.");
} finally {
  await browser.close();
}
