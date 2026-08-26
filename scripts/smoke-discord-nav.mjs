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

assert.match(overlay, /discordLink\.href = "https:\/\/discord\.gg\/H9DRAUKnz";/);
assert.match(overlay, /discordLink\.target = "_blank";/);
assert.match(overlay, /discordLink\.rel = "noopener noreferrer";/);
assert.match(overlay, /nav\.querySelector\("\[data-lz-site-discord-nav\]"\)/);
assert.match(overlay, /discordLink\.dataset\.testid = "nav-discord";/);
assert.match(overlay, /Join our Learning Zones Discord \(opens in a new tab\)/);
assert.match(overlay, /<span>Our Discord<\/span>/);
assert.match(overlay, /nav\.insertBefore\(discordLink, suggestLink \|\| nav\.querySelector\("\[data-lz-site-settings-nav\]"\)\);/);
assert.match(index, /chat-site-sync\.js\?v=20260724-savefeedback2/);

console.log(JSON.stringify({
  passed: true,
  destination: "https://discord.gg/H9DRAUKnz",
  deduplicated: true,
  secureNewTab: true,
  insertedBeforeSuggest: true,
  accessibleLabel: true,
  visibleLabel: "Our Discord"
}, null, 2));
