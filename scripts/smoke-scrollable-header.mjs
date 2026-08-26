import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const [css, index] = await Promise.all([
  readFile(path.join(root, "premium-polish.css"), "utf8"),
  readFile(path.join(root, "index.html"), "utf8")
]);

const navRules = Array.from(css.matchAll(/\[data-testid="site-header"\] nav\s*\{([\s\S]*?)\}/g), match => match[1]);
const navRule = navRules.find(rule => /justify-content:\s*safe center;/.test(rule)) || "";
assert.match(navRule, /flex-wrap:\s*nowrap !important;/);
assert.match(navRule, /justify-content:\s*flex-start;/);
assert.match(navRule, /justify-content:\s*safe center;/);
assert.match(navRule, /overflow-x:\s*auto;/);
assert.match(navRule, /overscroll-behavior-inline:\s*contain;/);
assert.match(navRule, /scrollbar-width:\s*thin;/);
assert.match(navRule, /-webkit-overflow-scrolling:\s*touch;/);
assert.match(css, /nav::\-webkit-scrollbar\s*\{[\s\S]*?display:\s*block;[\s\S]*?height:\s*4px;/);
assert.match(css, /@media \(max-width: 1120px\)[\s\S]*?\[data-testid="site-header"\] nav\s*\{[\s\S]*?justify-content:\s*flex-start;/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?scroll-behavior:\s*auto;/);
assert.match(index, /premium-polish\.css\?v=20260724-savefeedback2/);

console.log(JSON.stringify({
  passed: true,
  horizontalOverflow: true,
  safeCenterFallback: true,
  visibleDesktopScrollbar: true,
  touchMomentum: true,
  reducedMotion: true
}, null, 2));
