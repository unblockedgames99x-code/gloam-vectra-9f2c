import assert from "node:assert/strict";
import { handler } from "../netlify/functions/send-chat-message.js";

const originalFetch = globalThis.fetch;
const writes = [];
const storedMessages = {};
let account = { username: "Message Smoke", role: "member", banned: false };
let globalEnabled = true;
let filters = [];
let room = { id: "dm_message_smoke_friend", kind: "dm", members: ["message_smoke", "friend"] };

globalThis.fetch = async (url, init = {}) => {
  const path = new URL(String(url)).pathname;
  const method = String(init.method || "GET").toUpperCase();
  if (method === "PATCH" && path.endsWith("/state.json")) {
    const updates = JSON.parse(String(init.body || "{}"));
    const messageEntry = Object.entries(updates).find(([key]) => key.startsWith("messages/"));
    if (messageEntry) {
      const firebaseKey = messageEntry[0].slice("messages/".length);
      storedMessages[firebaseKey] = messageEntry[1];
      writes.push({ firebaseKey, message: messageEntry[1], updates });
    }
    return new Response(JSON.stringify(updates), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  let value = null;
  if (path.endsWith("/accounts/message_smoke.json")) value = account;
  else if (path.endsWith("/globalEnabled.json")) value = globalEnabled;
  else if (path.endsWith("/filters.json")) value = filters;
  else if (path.endsWith("/rooms/dm_message_smoke_friend.json")) value = room;
  else {
    const messageMatch = path.match(/\/messages\/([^/]+)\.json$/);
    if (messageMatch) value = storedMessages[decodeURIComponent(messageMatch[1])] || null;
  }
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

function event(body, options = {}) {
  return {
    httpMethod: options.method || "POST",
    headers: options.auth === false ? {} : { authorization: "Bearer static-firebase:Message%20Smoke" },
    body: JSON.stringify(body || {}),
    isBase64Encoded: false
  };
}

function payload(response) {
  return JSON.parse(response.body || "{}");
}

try {
  assert.equal((await handler(event({}, { method: "GET" }))).statusCode, 405);
  assert.equal((await handler(event({ text: "Hello" }, { auth: false }))).statusCode, 401);
  assert.equal((await handler(event({ text: " " }))).statusCode, 400);

  const messageEvent = event({ text: "Hello from the overlay", roomId: "global", clientId: "client_smoke_1" });
  const sent = await handler(messageEvent);
  assert.equal(sent.statusCode, 201);
  assert.equal(payload(sent).message.firebaseKey, "neo_message_smoke_client_smoke_1");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].message.text, "Hello from the overlay");
  assert.equal(writes[0].message.room, "global");
  assert.equal(writes[0].message.user, "Message Smoke");
  assert.equal(writes[0].message.clientId, "client_smoke_1");

  const repeated = await handler(messageEvent);
  assert.equal(repeated.statusCode, 200, "Retrying the same client message must be idempotent.");
  assert.equal(payload(repeated).duplicate, true);
  assert.equal(writes.length, 1, "An idempotent retry must not create a second Firebase write.");

  const conflict = await handler(event({ text: "Changed text", roomId: "global", clientId: "client_smoke_1" }));
  assert.equal(conflict.statusCode, 409, "A reused client ID with different content must be rejected.");

  filters = ["blocked phrase"];
  const filtered = await handler(event({ text: "A blocked phrase appears", roomId: "global" }));
  assert.equal(filtered.statusCode, 400);
  assert.match(payload(filtered).code, /^filtered:/);
  filters = [];

  account = { ...account, banned: true };
  const banned = await handler(event({ text: "Cannot send", roomId: "global" }));
  assert.equal(banned.statusCode, 403);
  assert.equal(payload(banned).code, "banned");
  account = { ...account, banned: false };

  room = { ...room, members: ["friend", "other"] };
  const forbidden = await handler(event({ text: "Private message", roomId: room.id }));
  assert.equal(forbidden.statusCode, 403);
  assert.equal(payload(forbidden).code, "room_forbidden");

  globalEnabled = false;
  const disabled = await handler(event({ text: "Global message", roomId: "global" }));
  assert.equal(disabled.statusCode, 403);
  assert.equal(payload(disabled).code, "global_disabled");

  console.log(JSON.stringify({
    passed: true,
    writes: writes.length,
    boundaries: ["method", "auth", "empty", "filter", "ban", "room", "global-disabled", "idempotent-retry", "retry-conflict"]
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
