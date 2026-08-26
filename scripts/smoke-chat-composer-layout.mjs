import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const [overlay, index] = await Promise.all([
  readFile(path.join(root, "chat-site-sync.js"), "utf8"),
  readFile(path.join(root, "index.html"), "utf8")
]);

assert.match(overlay, /\.lz-chat-right > \.lz-chat-messages\s*\{\s*grid-row:\s*6;/);
assert.match(overlay, /\.lz-chat-right > \.lz-chat-right-composer\s*\{\s*grid-row:\s*7;/);
assert.match(overlay, /\.lz-chat-right-composer > \.lz-chat-message-input\s*\{[^}]*height:\s*40px;[^}]*max-height:\s*40px;/s);
assert.match(overlay, /class="lz-chat-status-rail" data-lz-overlay-status-rail="true"/);
assert.match(overlay, /function ensureOverlayStatusRail\(overlay\)/);
assert.match(overlay, /rail\.appendChild\(typing\)/);
assert.match(overlay, /rail\.appendChild\(button\)/);
assert.match(overlay, /@media \(max-width: 860px\) \{[\s\S]*?\.lz-chat-right\s*\{\s*display:\s*grid;/);
assert.doesNotMatch(overlay, /composer\.parentNode\.insertBefore\(typing,\s*composer\)/);
assert.doesNotMatch(overlay, /rightPanel\.insertBefore\(button,\s*composer\)/);
assert.match(overlay, /function chatIcon\(\)\s*\{\s*return '[^']*data-lucide="message-square"[^']*d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"[^']*';\s*\}/s);
assert.doesNotMatch(overlay, /function chatIcon\(\)[\s\S]*?M8 9h8[\s\S]*?\n\s*\}/);
assert.match(index, /chat-site-sync\.js\?v=20260724-savefeedback2/);

console.log(JSON.stringify({
  passed: true,
  stableGridRows: true,
  fixedComposerHeight: true,
  transientStatusRail: true,
  mobileGridPreserved: true,
  canonicalChatIcon: "message-square"
}, null, 2));
