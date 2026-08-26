import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);

const shellFiles = [
  "index.html",
  "site.webmanifest",
  "metadata.json",
  "report-bug-link.js",
  "chat-site-sync.js",
  "chat-account-link-frame.js",
  "pages/chat_html.html",
  "pages/community_html.html",
  "pages/gamemaker_html.html",
  "pages/party_html.html",
  "neo-os/index.html",
  "neo-os/neo-os.js",
  "neo-os/neo-wallpaper-engine.js",
  "neo-os/neo-wallpaper-online.js",
  "static/js/main.9ee8cc75.js",
  "static/js/115.64107d9c.chunk.js",
  "static/js/655.06dd81ee.chunk.js",
  "static/js/693.save4fix.chunk.js",
  "static/js/939.668fbd8a.chunk.js",
];

const legacyVisiblePhrases = [
  "Learning Zones browser games",
  "Browser games, party",
  "Right in your browser",
  "members-only library of browser games",
  "Search games",
  "Search a game",
  "Sort games",
  "Loading games",
  "Featured games",
  "Popular games",
  "New games",
  "No games found",
  "Sign in to save games",
  "Could not load games",
  "Save game",
  "3,989 games",
  "Party Games",
  "Weekly Game",
  "Favorite Game",
  "Game Maker",
  "Community Games",
  "Browser Zone",
  "Original Learning Zones browser entry",
  "Optional reason shown to the banned browser",
  "Unblocked Zones Premium",
];

const sources = new Map(
  await Promise.all(
    shellFiles.map(async (relativePath) => [
      relativePath,
      await readFile(path.join(root, relativePath), "utf8"),
    ])
  )
);

const failures = [];
for (const [relativePath, source] of sources) {
  for (const phrase of legacyVisiblePhrases) {
    if (source.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`${relativePath}: ${JSON.stringify(phrase)}`);
    }
  }
}

assert.deepEqual(
  failures,
  [],
  `Legacy visitor-facing terminology remains:\n${failures.join("\n")}`
);

const homepage = sources.get("index.html");
const mainBundle = sources.get("static/js/main.9ee8cc75.js");
const playerBundle = sources.get("static/js/693.save4fix.chunk.js");

assert.match(homepage, /\/games\/index\.json/, "The catalog preload path must remain compatible.");
assert.match(mainBundle, /\/games\/index\.json/, "The app must keep the existing catalog endpoint.");
assert.match(mainBundle, /games-grid/, "Stable grid selectors must remain available.");
assert.match(playerBundle, /game-iframe/, "Stable player selectors must remain available.");

console.log(`Visible terminology check passed across ${shellFiles.length} shell files.`);
console.log("Compatibility routes and selectors remain unchanged.");
