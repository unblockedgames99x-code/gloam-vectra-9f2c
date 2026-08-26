import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { handler } from "../netlify/functions/save-owner-page.js";

function event(overrides = {}) {
  return {
    httpMethod: "PUT",
    headers: { authorization: "Bearer static-firebase:carterb" },
    queryStringParameters: { page: "chat" },
    body: JSON.stringify("<!doctype html><title>Chat</title>"),
    ...overrides
  };
}

test("rejects missing owner authentication", async () => {
  const response = await handler(event({ headers: {} }));
  assert.equal(response.statusCode, 401);
});

test("rejects unknown page keys", async () => {
  const response = await handler(event({ queryStringParameters: { page: "other" } }));
  assert.equal(response.statusCode, 400);
});

test("saves an allowed page to its existing Firebase path", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  };

  try {
    const response = await handler(event());
    assert.equal(response.statusCode, 204);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /ultimateGameStash\/pages\/chat\.json\?print=silent$/);
    assert.equal(calls[0].init.method, "PUT");
    assert.equal(JSON.parse(calls[0].init.body), "<!doctype html><title>Chat</title>");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser bridge reroutes only owner page PUT requests", async () => {
  const calls = [];
  const window = {
    __learningZonesOwnerSaveBridge: false,
    localStorage: { getItem: () => "static-firebase:carterb" },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: 204 });
    }
  };
  const context = vm.createContext({ window, localStorage: window.localStorage });
  const bridge = fs.readFileSync(new URL("../owner-page-save-bridge.js", import.meta.url), "utf8");
  vm.runInContext(bridge, context);

  const htmlBody = JSON.stringify("<html>chat</html>");
  await window.fetch(
    "https://taco-chat-c1539-default-rtdb.firebaseio.com/rooms/_deluxeAppState/state/ultimateGameStash/pages/chat.json?print=silent",
    { method: "PUT", body: htmlBody }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/.netlify/functions/save-owner-page?page=chat");
  assert.equal(calls[0].init.body, htmlBody);
  assert.equal(calls[0].init.headers.Authorization, "Bearer static-firebase:carterb");
});

test("browser bridge rejects an SPA fallback instead of reporting a false save", async () => {
  const window = {
    __learningZonesOwnerSaveBridge: false,
    localStorage: { getItem: () => "static-firebase:carterb" },
    fetch: async () => new Response("<!doctype html><title>Learning Zones</title>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    })
  };
  const context = vm.createContext({
    window,
    localStorage: window.localStorage,
    Response
  });
  const bridge = fs.readFileSync(new URL("../owner-page-save-bridge.js", import.meta.url), "utf8");
  vm.runInContext(bridge, context);

  const response = await window.fetch(
    "https://taco-chat-c1539-default-rtdb.firebaseio.com/rooms/_deluxeAppState/state/ultimateGameStash/pages/chat.json",
    { method: "PUT", body: JSON.stringify("<html>chat</html>") }
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { detail: "Owner save service is unavailable" });
});
