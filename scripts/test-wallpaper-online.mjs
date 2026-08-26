import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "neo-os", "neo-wallpaper-online.js"), "utf8");
const context = {
  window: { location: { href: "https://learningzone.online/neo-os/" } },
  URL,
  document: {
    createElement(tag) {
      assert.equal(tag, "video");
      return {
        canPlayType(type) {
          return type === "video/webm" ? "probably" : "";
        },
      };
    },
  },
  setTimeout,
  clearTimeout,
};

runInNewContext(source, context);
const runtime = context.window.NEO_WALLPAPER_ONLINE;
assert.ok(runtime);
assert.equal(runtime.matchesSearch("Mountain forest landscape", "mountian"), true);
assert.equal(runtime.matchesSearch("Abstract particle animation", "abstrct"), true);
assert.equal(runtime.matchesSearch("Ocean waves at sunset", "ocean sunset"), true);
assert.equal(runtime.matchesSearch("Ocean waves at sunset", "forest"), false);
assert.equal(runtime.matchesSearch("Carina Nebula animation", "spcae"), true);
assert.equal(runtime.matchesSearch("Minecraft Beta Gameplay", "minecraft"), true);
assert.equal(runtime.matchesSearch("Performance de Exedra", "minecraft"), false);

const options = runtime.__test.normalizeOptions({
  source: "not-valid",
  query: "  space    scene  ",
  catalog: "browser-ready",
  page: 5000,
});
assert.equal(options.source, "discover");
assert.equal(options.query, "space scene");
assert.equal(options.catalog, "browser-ready");
assert.equal(options.page, 1000);
assert.equal(runtime.__test.cacheKey(options), "discover|space scene|featured||browser-ready|1000");
assert.equal(runtime.__test.normalizeOptions({ catalog: "unknown" }).catalog, "");

const sourceChoice = runtime.__test.supportedSource({
  downloadUrl: "https://example.test/wallpaper.mp4",
  downloadMime: "video/mp4",
  downloadSources: [{
    url: "https://example.test/wallpaper.webm",
    mime: "video/webm",
    width: 1920,
    height: 1080,
  }],
});
assert.equal(sourceChoice.mime, "video/webm");
assert.equal(sourceChoice.width, 1920);

assert.equal(runtime.__test.canInstall({
  browserPlayable: true,
  downloadUrl: "https://example.test/wallpaper.webm",
  fileSize: 12_000_000,
}), true);
assert.equal(runtime.__test.canUse({
  browserPlayable: false,
  preview: "https://images.steamusercontent.com/ugc/123/ABC/",
}), false);
assert.equal(runtime.__test.canUse({
  browserPlayable: true,
  downloadUrl: "https://example.test/wallpaper.webm",
  fileSize: 12_000_000,
}), true);
assert.match(source, /Get in Wallpaper Engine/);
assert.doesNotMatch(source, /Full file unavailable/);
console.log("Wallpaper online runtime checks passed: 20");
