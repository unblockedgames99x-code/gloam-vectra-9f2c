import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [script, styles, index] = await Promise.all([
  readFile(new URL("../chat-site-sync.js", import.meta.url), "utf8"),
  readFile(new URL("../premium-polish.css", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8")
]);

assert.match(script, /const SAVE_BUTTON_SELECTOR = \[/);
assert.match(script, /\[data-testid\^="save-game-tile-"\]/);
assert.match(script, /\[data-testid="game-player-topbar"\] \[data-testid="save-game-btn"\]/);
assert.match(script, /function saveButtonIsSaved\(button\)/);
assert.match(script, /new MutationObserver\(\(\) => check\(\)\)/);
assert.match(script, /function saveButtonForAction\(button, testId\)/);
assert.match(script, /observer\.observe\(document\.body, \{/);
assert.match(script, /syncReplacement/);
assert.match(script, /saveButtonConfirmation\([\s\S]*?wantsSaved \? "Saved" : "Unsaved"[\s\S]*?actionKey,[\s\S]*?testId[\s\S]*?\);/);
assert.match(script, /status\.setAttribute\("role", "status"\)/);
assert.match(script, /status\.textContent = wantsSaved \? "Zone saved\." : "Zone removed from saved zones\."/);
assert.match(script, /document\.addEventListener\("click", event => \{[\s\S]*?watchSaveButtonResult\(button\);[\s\S]*?\}, true\);/);
assert.match(script, /installSaveButtonFeedback\(\);/);

assert.match(styles, /\[data-testid\^="save-game-tile-"\]:hover/);
assert.match(styles, /\.lz-save-activating/);
assert.match(styles, /\.lz-save-confirming::after/);
assert.match(styles, /content: attr\(data-lz-save-confirmation\)/);
assert.match(styles, /@keyframes lz-save-confirm-pop/);
assert.match(styles, /html\[data-lz-reduce-motion="true"\] \[data-testid\^="save-game-tile-"\]/);

assert.match(index, /premium-polish\.css\?v=20260724-savefeedback2/);
assert.match(index, /chat-site-sync\.js\?v=20260724-savefeedback2/);

console.log("Save button feedback smoke checks passed.");
