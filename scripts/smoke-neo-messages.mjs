import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handler as readChatState } from "../netlify/functions/chat-state.js";
import { handler as createChatRoom } from "../netlify/functions/create-chat-room.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [clientSource, template, styles] = await Promise.all([
  readFile(path.join(root, "neo-os", "neo-os.js"), "utf8"),
  readFile(path.join(root, "neo-os", "index.html"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-os.css"), "utf8")
]);

assert.match(clientSource, /clientId: clientId/);
assert.match(clientSource, /data-chat-retry/);
assert.match(clientSource, /controller\.abort\(\); \}, 8_000\)/);
assert.match(clientSource, /nativeChatStateRequest\(state\.session, state\.controller\.signal, true\)/);
assert.match(clientSource, /document\.addEventListener\("visibilitychange", handleVisibilityChanged\)/);
assert.match(clientSource, /function nativeChatEndpoint\(path\)/);
assert.match(clientSource, /fetch\(nativeChatEndpoint\("\/\.netlify\/functions\/chat-state"/);
assert.match(clientSource, /fetch\(nativeChatEndpoint\("\/\.netlify\/functions\/search-chat-users/);
assert.match(clientSource, /fetch\(nativeChatEndpoint\("\/\.netlify\/functions\/create-chat-room"\)/);
assert.match(clientSource, /fetch\(nativeChatEndpoint\("\/\.netlify\/functions\/send-chat-message"\)/);
assert.match(template, /data-chat-room-list/);
assert.match(template, /data-chat-profile-dm/);
assert.match(styles, /\.native-message-retry/);

const state = {
  accounts: {
    alpha: { username: "Alpha", status: "online" },
    beta: { username: "Beta", status: "online" },
    gamma: { username: "Gamma", status: "online" },
    delta: { username: "Delta", status: "online" }
  },
  rooms: {
    global: { id: "global", kind: "room", members: [] },
    dm_alpha_beta: { id: "dm_alpha_beta", kind: "dm", private: false, members: [{ username: "Alpha" }, { id: "Beta" }] },
    dm_gamma_delta: { id: "dm_gamma_delta", kind: "dm", private: true, members: ["gamma", "delta"] }
  },
  messages: {
    global_one: { id: "global_one", room: "global", user: "Beta", text: "Shared hello", time: 10 },
    dm_one: { id: "dm_one", room: "dm_alpha_beta", user: "Beta", text: "Private hello", time: 20 },
    hidden_one: { id: "hidden_one", room: "dm_gamma_delta", user: "Gamma", text: "Private", time: 30 }
  },
  profiles: {
    alpha: { username: "Alpha", bio: "One" },
    beta: { username: "Beta", bio: "Two" },
    gamma: { username: "Gamma", bio: "Three" }
  }
};

const originalFetch = globalThis.fetch;
const writes = [];
globalThis.fetch = async (rawUrl, init = {}) => {
  const url = new URL(String(rawUrl));
  const pathname = decodeURIComponent(url.pathname);
  const method = String(init.method || "GET").toUpperCase();
  if (method !== "GET") {
    writes.push({ pathname, method, body: JSON.parse(String(init.body || "{}")) });
    return new Response(JSON.stringify(writes.at(-1).body), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  let value = null;
  if (pathname.endsWith("/accounts/alpha.json")) value = state.accounts.alpha;
  else if (pathname.endsWith("/accounts/beta.json")) value = state.accounts.beta;
  else if (pathname.endsWith("/rooms.json")) value = state.rooms;
  else if (pathname.endsWith("/messages.json")) value = state.messages;
  else if (pathname.endsWith("/ultimateGameStash/siteSync/chatProfiles.json")) value = state.profiles;
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
};

const authHeaders = { authorization: "Bearer static-firebase:Alpha" };
try {
  const fullResponse = await readChatState({ httpMethod: "GET", headers: authHeaders, queryStringParameters: {} });
  const full = JSON.parse(fullResponse.body);
  assert.equal(fullResponse.statusCode, 200);
  assert.deepEqual(full.messages.map((message) => message.id), ["global_one", "dm_one"]);
  assert.equal(full.profiles.beta.username, "Beta");
  assert.ok(!full.rooms.dm_gamma_delta, "Private rooms for other users must stay hidden.");

  const compactResponse = await readChatState({ httpMethod: "GET", headers: authHeaders, queryStringParameters: { compact: "1" } });
  const compact = JSON.parse(compactResponse.body);
  assert.equal(compact.compact, true);
  assert.equal(compact.profiles.alpha.username, "Alpha");
  assert.ok(!compact.profiles.beta, "Compact polling must skip the separate profile collection.");

  const roomResponse = await createChatRoom({
    httpMethod: "POST",
    headers: authHeaders,
    body: JSON.stringify({ username: "Beta" }),
    isBase64Encoded: false
  });
  const roomPayload = JSON.parse(roomResponse.body);
  assert.equal(roomResponse.statusCode, 200);
  assert.equal(roomPayload.created, false);
  assert.equal(roomPayload.room.id, "dm_alpha_beta");
  assert.equal(roomPayload.room.private, true);
  assert.deepEqual(roomPayload.room.members, ["alpha", "beta"]);
  assert.equal(writes.length, 0, "Opening an existing DM must not create another room.");

  console.log(JSON.stringify({
    passed: true,
    globalAndDmShareOneState: true,
    privateRoomFiltering: true,
    compactPolling: true,
    deterministicDmReuse: true,
    retryUi: true
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
