import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [apps, runtime, runtimeCss, streamCss, os, osCss, appCss, features, clientShell, html] = await Promise.all([
  readFile(path.join(root, "neo-os", "neo-apps.js"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-browser-runtime.js"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-browser-runtime.css"), "utf8"),
  readFile(path.join(root, "neo-os", "stream-music-frame.css"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-os.js"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-os.css"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-apps.css"), "utf8"),
  readFile(path.join(root, "neo-os", "neo-os-features.js"), "utf8"),
  readFile(path.join(root, "neo-os", "browser-runtime", "client-shell.js"), "utf8"),
  readFile(path.join(root, "neo-os", "index.html"), "utf8"),
]);

assert.match(apps, /browserTarget:\s*"https:\/\/vcsa\.huangqirui\.xyz\/listen"/);
assert.match(apps, /browserTheme:\s*"stream-music"/);
assert.match(runtime, /function enhanceStreamMusic\(frameDocument\)/);
assert.match(runtime, /__neoMusicCleanupEnhancer/);
assert.match(runtime, /\.nv\[data-view=\\?"discover\\?"\]/);
assert.match(runtime, /open music inside tung tung\|use parties/i);
assert.doesNotMatch(runtime, /function createPartyHub/);
assert.doesNotMatch(runtime, /partyControl\("ppStart"\)/);
assert.doesNotMatch(runtime, /partyControl\("ppJoin"\)/);
assert.match(runtimeCss, /\.neo-browser-runtime\.is-app-mode/);
assert.match(streamCss, /\.nv\[data-view="discover"\]/);
assert.match(streamCss, /#partyBtn/);
assert.match(streamCss, /--neo-music-accent:\s*#ffffff\s*!important/);
assert.match(os, /function mountUnifiedMusic\(app, body\)/);
assert.match(os, /runtime\.mount\("music", mp3Panel, shellApi\)/);
assert.match(appCss, /\.music-unified-shell/);
assert.match(appCss, /\.music-unified-panel \.music-app \.music-player/);
assert.match(features, /appId:\s*"stream"/);
assert.doesNotMatch(html, /data-app="music"/);

const sharedSourceCount = (os.match(/browse-media:stream/g) || []).length;
assert.ok(sharedSourceCount >= 2, "Music focus and cleanup must use the runtime media source.");
assert.match(os, /detail\.visualizer === true/);
assert.match(osCss, /\.now-playing-widget\.is-visualizing \.now-playing-wave i/);
assert.match(html, /data-now-playing-cover/);
assert.match(html, /data-now-playing-elapsed/);
assert.match(html, /data-now-playing-duration/);
assert.match(html, /data-now-playing-volume/);
assert.match(os, /function formatMediaTime\(value\)/);
assert.match(os, /neo-media-volume-request/);
assert.match(os, /detail\.kind === "video" \|\| detail\.pauseWallpaper === true/);
assert.match(osCss, /\.now-playing-volume-flyout/);
assert.match(features, /function embeddedTrackArtwork\(buffer\)/);
assert.match(features, /canvas\.toDataURL\("image\/png"\)/);
assert.match(features, /volumeControl:\s*true/);
assert.match(features, /setVolume:\s*setVolume/);
assert.match(features, /kind:\s*"audio"/);
assert.match(features, /kind:\s*"video"/);
assert.match(clientShell, /position,/);
assert.match(clientShell, /duration,/);
assert.match(clientShell, /neo-browser:set-volume/);
assert.match(clientShell, /HTMLMediaElement\.prototype\.play/);
assert.match(clientShell, /observeMediaElement/);
assert.match(clientShell, /function installMusicCatalogWarmup\(\)/);
assert.match(clientShell, /method:\s*"GET"/);
assert.match(clientShell, /Range:\s*"bytes=0-65535"/);
assert.match(clientShell, /response\.arrayBuffer\(\)/);
assert.match(clientShell, /top%20hits%202025/);
assert.match(clientShell, /priority:\s*"low"/);
assert.match(clientShell, /function installMusicAudioFastStart\(\)/);
assert.match(clientShell, /pendingAudioTrackReset/);
assert.match(clientShell, /media\.currentTime = 0/);
assert.match(clientShell, /media\.preload = "auto"/);
assert.match(clientShell, /currentTrackDetails/);
assert.match(clientShell, /\.npt/);
assert.match(clientShell, /\.npa/);
assert.match(runtime, /handleMediaVolumeRequest/);
assert.match(runtime, /tab\.mediaState\?\.playing && tab\.mediaState\.kind === "video"/);
assert.match(runtime, /kind:\s*media\.kind/);

console.log("NEO Music shell smoke checks passed.");
