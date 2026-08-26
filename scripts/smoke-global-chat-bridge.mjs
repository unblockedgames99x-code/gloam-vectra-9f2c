import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const [overlay, chatPage, sendFunction] = await Promise.all([
  readFile(path.join(root, "chat-site-sync.js"), "utf8"),
  readFile(path.join(root, "pages", "chat_html.html"), "utf8"),
  readFile(path.join(root, "netlify", "functions", "send-chat-message.js"), "utf8")
]);

const canonicalStatePath = "rooms/_deluxeAppState/state";

assert.match(chatPage, new RegExp(`CLOUD_STATE_PATH = "${canonicalStatePath}"`));
assert.match(overlay, /function chatStateUrl\(parts\)/);
assert.match(overlay, /"rooms", "_deluxeAppState", "state"/);
assert.match(sendFunction, new RegExp(canonicalStatePath.replaceAll("/", "\\/")));

assert.match(overlay, /sendOverlayMessageThroughSite\(text, targetRoomId\)/);
assert.match(overlay, /body: JSON\.stringify\(\{ text, roomId \}\)/);
assert.match(sendFunction, /var roomId = String\(\(payload && payload\.roomId\) \|\| "global"\)/);

assert.match(overlay, /startOverlayMessageRealtime\(overlay\)/);
assert.match(overlay, /openRealtimeStream\(\s*chatStateUrl\(\["messages"\]\)/);
assert.match(overlay, /message\.room === "global"/);
assert.match(overlay, /stopOverlayMessageRealtime\(\)/);
assert.match(overlay, /rows = await fetchJson\(chatStateUrl\(\["messages"\]\), timeoutMs\)/);

function sourceBetween(startMarker, endMarker) {
  const start = overlay.indexOf(startMarker);
  const end = overlay.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Could not extract ${startMarker}`);
  return overlay.slice(start, end);
}

const bridgeContext = vm.createContext({});
vm.runInContext(`
  const OVERLAY_MESSAGE_LIMIT = 24;
  let overlayMessageStreamReady = true;
  let overlayMessageStreamState = {};
  const numericStamp = value => Number(value || 0);
  ${sourceBetween("function overlayMessageList(", "function globalOverlayMessages(")}
  ${sourceBetween("function mergeOverlayMessageRows(", "function overlayRoomMemberIds(")}
  ${sourceBetween("function overlayMessagesWithRealtime(", "function syncOverlayRealtimeMessages(")}
  globalThis.runBridge = (current, streamed) => {
    overlayMessageStreamState = streamed;
    return overlayMessagesWithRealtime(current);
  };
`, bridgeContext);

const currentMessages = [
  { firebaseKey: "old-global", id: "old-global", room: "global", user: "A", text: "old", time: 10 },
  { firebaseKey: "private-1", id: "private-1", room: "dm_a_b", user: "A", text: "private", time: 15 },
  { firebaseKey: "global-2", id: "global-2", room: "global", user: "B", text: "duplicate", time: 20 }
];
const streamedMessages = {
  "global-2": { id: "global-2", room: "global", user: "B", text: "new", time: 20 },
  "global-3": { id: "global-3", room: "global", user: "C", text: "latest", time: 30 }
};
const mergedMessages = bridgeContext.runBridge(currentMessages, streamedMessages);

assert.deepEqual(
  Array.from(mergedMessages, message => message.id),
  ["private-1", "global-2", "global-3"],
  "Realtime Global Chat must replace stale global rows, preserve private rows, and avoid duplicates."
);
assert.deepEqual(
  Array.from(bridgeContext.runBridge(currentMessages, {}), message => message.id),
  ["private-1"],
  "A canonical stream deletion must remove stale global rows from the overlay."
);

console.log(JSON.stringify({
  passed: true,
  canonicalStatePath,
  canonicalRoomId: "global",
  realtimeWhileOverlayOpen: true,
  fallbackPolling: true,
  duplicatePrevention: true,
  deletionSync: true
}, null, 2));
