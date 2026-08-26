import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const overlay = await readFile(path.join(root, "chat-site-sync.js"), "utf8");

assert.match(overlay, /\.lz-chat-message-card\s*\{\s*padding:\s*8px;/);
assert.match(overlay, /\.lz-chat-message-feed\s*\{\s*display:\s*grid;\s*gap:\s*6px;/);
assert.match(overlay, /\.lz-chat-message-row\s*\{[^}]*grid-template-columns:\s*30px minmax\(0,\s*1fr\) auto;[^}]*gap:\s*8px;/s);
assert.match(overlay, /\.lz-chat-message-row > \.lz-chat-avatar\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/s);
assert.match(overlay, /\.lz-chat-message-meta\s*\{[^}]*grid-template-areas:\s*"controls";[^}]*min-height:\s*24px;/s);
assert.match(overlay, /<div class="lz-chat-message-actions">/);
assert.match(overlay, /\.lz-chat-message-actions\s*\{[^}]*display:\s*flex;[^}]*opacity:\s*0;/s);
assert.match(overlay, /\.lz-chat-message-action\s*\{\s*min-height:\s*22px;/);

console.log(JSON.stringify({
  passed: true,
  compactCardPadding: true,
  compactAvatar: true,
  singleRowActions: true,
  noHiddenVerticalActionSpace: true
}, null, 2));
