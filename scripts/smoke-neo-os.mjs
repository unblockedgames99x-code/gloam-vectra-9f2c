import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const neoRoot = path.join(root, "neo-os");
const requiredFiles = [
  "index.html",
  "neo-os.css",
  "neo-os.js",
  "neo-browser-runtime.js",
  "neo-browser-runtime.css",
  "neo-browser-ui.css",
  "stream-music-frame.css",
  "browser-newtab.html",
  "browser-newtab.css",
  "browser-sw.js",
  "browser-runtime/client-shell.js",
  "browser-runtime/THIRD_PARTY_NOTICES.md",
  "browser-runtime/baremux/index.js",
  "browser-runtime/baremux/worker.js",
  "browser-runtime/epoxy/index.mjs",
  "browser-runtime/libcurl/index.mjs",
  "browser-runtime/libcurl/index.min.mjs",
  "browser-runtime/libcurl/libcurl_full.wasm",
  "browser-runtime/uv/uv.bundle.js",
  "browser-runtime/uv/uv.client.js",
  "browser-runtime/uv/uv.config.js",
  "browser-runtime/uv/uv.handler.js",
  "browser-runtime/uv/uv.sw.js",
  "browser-runtime/vendor-licenses/libcurl-transport-AGPL-3.0.txt",
  "browser-runtime/vendor-licenses/baremux-AGPL-3.0.txt",
  "browser-runtime/vendor-licenses/epoxy-transport-AGPL-3.0.txt",
  "browser-runtime/vendor-licenses/ultraviolet-AGPL-3.0.txt",
  "neo-account-signin.js",
  "neo-os-features.js",
  "neo-os-features.css",
  "neo-store.js",
  "neo-store.css",
  "neo-files.js",
  "neo-files.css",
  "neo-taskbar-menu.js",
  "neo-taskbar-menu.css",
  "neo-apps.js",
  "neo-apps.css",
  "neo-window-resize.js",
  "neo-window-resize.css",
  "neo-wallpaper-engine.js",
  "neo-wallpaper-web-compat.js",
  "neo-wallpaper-engine.css",
  "neo-wallpaper-quality.js",
  "neo-rainmeter.js",
  "neo-rainmeter.css",
  "neo-launcher-glass.css",
  "neo-flat-ui.css",
  "neo-wallpaper-online.js",
  "neo-wallpaper-discover.css",
  "neo-wallpaper-import.js",
  "wallpaper-engine-projects.json",
  "wallpaper-full-media.json",
  "assets/neo-logo.svg",
  "assets/wallpaper-engine.png",
  "assets/wallpaper-engine-web/3470738721/vendor/p5-1.9.0.min.js",
  "assets/wallpaper-engine-web/3470738721/vendor/suncalc-1.8.0.min.js",
  "assets/duckduckgo.png",
  "assets/messages.png",
  "assets/zones-circle.svg",
  "assets/neo-moonfall.webp",
  "assets/wallpapers/fortnite-fracture-hd.webp",
  "assets/fonts/anurati.otf",
  "assets/fonts/quicksand.otf",
];

let checks = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

for (const file of requiredFiles) {
  await access(path.join(neoRoot, file));
}
assert(requiredFiles.length === 64, "NEO OS file manifest is incomplete");

const [html, css, js, accountSignInJs, featureJs, featureCss, taskbarMenuJs, taskbarMenuCss, appJs, appCss, resizeJs, resizeCss, wallpaperEngineJs, wallpaperEngineCss, wallpaperQualityJs, wallpaperProjectSource, wallpaperFullMediaSource, wallpaperInfo, gameIndexSource, gameCoverSource, gameFiles, storeJs, storeCss, filesJs, filesCss, wallpaperOnlineJs, wallpaperImportJs, wallpaperDiscoverFunction, rainmeterJs, rainmeterCss, launcherGlassCss] = await Promise.all([
  readFile(path.join(neoRoot, "index.html"), "utf8"),
  readFile(path.join(neoRoot, "neo-os.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-os.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-account-signin.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-os-features.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-os-features.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-taskbar-menu.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-taskbar-menu.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-apps.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-apps.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-window-resize.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-window-resize.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-wallpaper-engine.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-wallpaper-engine.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-wallpaper-quality.js"), "utf8"),
  readFile(path.join(neoRoot, "wallpaper-engine-projects.json"), "utf8"),
  readFile(path.join(neoRoot, "wallpaper-full-media.json"), "utf8"),
  stat(path.join(neoRoot, "assets/neo-logo.svg")),
  readFile(path.join(root, "games", "index.json"), "utf8"),
  readFile(path.join(root, "games", "covers.json"), "utf8"),
  readdir(path.join(root, "games")),
  readFile(path.join(neoRoot, "neo-store.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-store.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-files.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-files.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-wallpaper-online.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-wallpaper-import.js"), "utf8"),
  readFile(path.join(root, "netlify", "functions", "wallpaper-discover.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-rainmeter.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-rainmeter.css"), "utf8"),
  readFile(path.join(neoRoot, "neo-launcher-glass.css"), "utf8"),
]);
const gameIndex = JSON.parse(gameIndexSource);
const gameCovers = JSON.parse(gameCoverSource);
const wallpaperProjects = JSON.parse(wallpaperProjectSource.replace(/^\uFEFF/, ""));
const wallpaperFullMedia = JSON.parse(wallpaperFullMediaSource.replace(/^\uFEFF/, ""));
const controlTemplate = html.match(/<template id="control-template">([\s\S]*?)<\/template>/)?.[1] || "";
const wallpaperWebCompatJs = await readFile(path.join(neoRoot, "neo-wallpaper-web-compat.js"), "utf8");
const wallpaperBuilder = await readFile(path.join(root, "scripts", "build-neo-wallpaper-media.ps1"), "utf8");
const rainyDayCss = await readFile(path.join(neoRoot, "assets", "wallpaper-engine-web", "1403160205", "css", "style1.css"), "utf8");
const rainyDayIndex = await readFile(path.join(neoRoot, "assets", "wallpaper-engine-web", "1403160205", "index.html"), "utf8");
const rainyDayViewportSync = await readFile(path.join(neoRoot, "assets", "wallpaper-engine-web", "1403160205", "js", "viewport-sync.js"), "utf8");
const whiteTreeIndex = await readFile(path.join(neoRoot, "assets", "wallpaper-engine-web", "1789171537", "index.html"), "utf8");
const whiteTreeCss = await readFile(path.join(neoRoot, "assets", "wallpaper-engine-web", "1789171537", "assets", "css", "stylesheet.css"), "utf8");
const whiteTreeJs = await readFile(path.join(neoRoot, "assets", "wallpaper-engine-web", "1789171537", "assets", "js", "app.js"), "utf8");
const wallpaperPreviewRuntimeJs = await readFile(path.join(neoRoot, "neo-wallpaper-preview-runtime.js"), "utf8");
const wallpaperPreviewRuntimeCss = await readFile(path.join(neoRoot, "neo-wallpaper-preview-runtime.css"), "utf8");
const wallpaperDiscoverCss = await readFile(path.join(neoRoot, "neo-wallpaper-discover.css"), "utf8");
const localPreviewServer = await readFile(path.join(root, "local-preview-server.mjs"), "utf8");
const chatStateFunction = await readFile(path.join(root, "netlify", "functions", "chat-state.js"), "utf8");
const hostingHeaders = await readFile(path.join(root, "_headers"), "utf8");
const [browserRuntimeJs, browserRuntimeCss, browserWorkerJs, browserConfigJs, browserClientShellJs, browserNotices, bareMuxRuntimeJs, bareMuxWorkerJs] = await Promise.all([
  readFile(path.join(neoRoot, "neo-browser-runtime.js"), "utf8"),
  readFile(path.join(neoRoot, "neo-browser-runtime.css"), "utf8"),
  readFile(path.join(neoRoot, "browser-sw.js"), "utf8"),
  readFile(path.join(neoRoot, "browser-runtime", "uv", "uv.config.js"), "utf8"),
  readFile(path.join(neoRoot, "browser-runtime", "client-shell.js"), "utf8"),
  readFile(path.join(neoRoot, "browser-runtime", "THIRD_PARTY_NOTICES.md"), "utf8"),
  readFile(path.join(neoRoot, "browser-runtime", "baremux", "index.js"), "utf8"),
  readFile(path.join(neoRoot, "browser-runtime", "baremux", "worker.js"), "utf8"),
]);
const browserTransportJs = await readFile(path.join(neoRoot, "browser-runtime", "libcurl", "index.mjs"), "utf8");
const browserPrimaryTransportJs = await readFile(path.join(neoRoot, "browser-runtime", "epoxy", "index.mjs"), "utf8");
const browserTransportWasm = await readFile(path.join(neoRoot, "browser-runtime", "libcurl", "libcurl_full.wasm"));
const localGameFiles = new Set(gameFiles);
const flatUiCss = await readFile(path.join(neoRoot, "neo-flat-ui.css"), "utf8");
const browserUiCss = await readFile(path.join(neoRoot, "neo-browser-ui.css"), "utf8");
const browserNewTabHtml = await readFile(path.join(neoRoot, "browser-newtab.html"), "utf8");
const browserNewTabCss = await readFile(path.join(neoRoot, "browser-newtab.css"), "utf8");
const streamMusicCss = await readFile(path.join(neoRoot, "stream-music-frame.css"), "utf8");
assert(html.includes('<title>NEO OS</title>'), "NEO OS title is missing");
assert(html.includes('rel="preload"') && html.includes("neo-logo.svg"), "Critical wallpaper is not preloaded");
assert(html.includes("neo_proxy_scope_recovered_") && html.includes('expectedEngine = "neo-browse-v51"') && html.includes("window.__neoProxyRecovery") && html.includes("registration.unregister()"), "Stale or mixed-version proxy workers are not recovered during startup");
assert(html.includes('aria-label="System taskbar"') && html.includes('aria-label="Pinned apps"'), "The taskbar needs accessible names");
assert(!html.includes('class="taskbar-notification') && !html.includes('notification-toggle'), "The removed taskbar notification button returned");
assert(/id="neo-dock"[\s\S]{0,400}data-app="apps"[\s\S]{0,400}data-app="browser"/.test(html), "My Apps must be the first shortcut beside the NEO logo");
assert(html.includes('aria-label="Search installed applications"'), "Launcher search needs an explicit accessible name");
assert(html.includes('id="launcher-recent"') && html.includes('id="launcher-categories"'), "Launcher discovery sections are incomplete");
assert(html.includes("neo-launcher-glass.css") && !html.includes("data-power") && !html.includes("Browser workspace"), "The polished launcher footer regressed");
assert(html.includes("neo-flat-ui.css") && flatUiCss.includes("body *::before") && flatUiCss.includes("box-shadow: none !important") && flatUiCss.includes("border-color: transparent !important"), "The borderless flat UI layer is missing or incomplete");
assert(flatUiCss.includes(":focus-visible") && flatUiCss.includes("var(--neo-accent-soft") && flatUiCss.includes("accent-color: var(--neo-accent-visible"), "Flat UI keyboard focus feedback is not connected to the system accent");
assert(js.includes("buildAccentPalette") && js.includes('setProperty("--neo-accent-visible"') && js.includes('setProperty("--neo-accent-contrast"'), "The saved accent is not expanded into a complete live UI palette");
const accentContext = {};
runInNewContext(js.slice(js.indexOf("  function colorToRgb"), js.indexOf("  function applySettings")), accentContext);
const purpleAccent = accentContext.buildAccentPalette("#a855f7");
assert(purpleAccent.visible === "#a855f7" && purpleAccent.visibleRgb === "168, 85, 247" && purpleAccent.contrast === "#ffffff", "Colored accent palette generation is incorrect");
assert(accentContext.buildAccentPalette("#ffffff").contrast === "#000000", "Light accents do not receive readable foreground text");
assert(accentContext.buildAccentPalette("invalid").visible === "#ffffff", "Invalid saved accents do not fall back safely");
assert(css.includes("--neo-accent-visible-rgb") && css.includes("--neo-accent-contrast") && css.includes("--neo-accent-on-light"), "The global accent fallback tokens are incomplete");
assert(controlTemplate.includes("All interface highlights") && controlTemplate.includes('data-setting="taskbarAccent"'), "Settings does not explain or expose the system-wide accent");
assert(launcherGlassCss.includes("var(--neo-accent-visible") && rainmeterCss.includes("var(--neo-accent-visible") && featureCss.includes("var(--neo-accent-visible"), "Shell feature styles are bypassing the shared accent palette");
assert(filesCss.includes("--files-accent: var(--neo-accent-visible") && storeCss.includes("--store-blue: var(--neo-accent-on-light"), "Lazy-loaded app styles are bypassing the shared accent palette");
assert(browserRuntimeCss.includes("var(--neo-accent-visible") && flatUiCss.includes(".we-source-tabs") && flatUiCss.includes(".wallpaper-online-install:not(:disabled)"), "Browse or Wallpaper Engine interaction states are bypassing the shared accent palette");
assert(flatUiCss.includes(".neo-window,") && !flatUiCss.includes('[class*="card"]'), "Flat UI shading rules must not erase wallpaper or game artwork");
assert(html.includes("neo-browser-ui.css") && html.includes("neo-browser-start-tabbar") && html.includes("Search DuckDuckGo or type a URL"), "The compact Browse start interface is incomplete");
assert(browserUiCss.includes("grid-template-rows: 38px 44px") && browserUiCss.includes("background: #080808") && browserUiCss.includes("neo-browser-newtab-prompt"), "The OLED Browse start interface regressed");
assert(browserNewTabHtml.includes("data-newtab-search") && browserNewTabHtml.includes("DuckDuckGo") && browserNewTabCss.includes("background: #111111"), "The local Browse new-tab page is incomplete");
assert(launcherGlassCss.includes("backdrop-filter: blur(38px)") && launcherGlassCss.includes("@supports not") && launcherGlassCss.includes("prefers-reduced-motion"), "The launcher glass treatment is incomplete or lacks safe fallbacks");
assert(/\/neo-os\/neo-\*\.js\s+Cache-Control: public, max-age=0, must-revalidate/.test(hostingHeaders), "Editable NEO JavaScript can be pinned to an old deployment");
assert(/\/neo-os\/neo-\*\.css\s+Cache-Control: public, max-age=0, must-revalidate/.test(hostingHeaders), "Editable NEO CSS can be pinned to an old deployment");
assert(Buffer.byteLength(launcherGlassCss) < 12_000, "Launcher glass CSS exceeds the 12 KB source budget");
assert(launcherGlassCss.includes("Optical icon sizing") && launcherGlassCss.includes("app-icon-duckduckgo") && launcherGlassCss.includes("app-icon-wallpaper"), "Launcher artwork is not optically normalized");
assert(js.includes('closest("#app-launcher, [data-open-launcher]")') && !js.includes('closest("[data-power]")'), "Outside clicks must dismiss the launcher before other controls run");
assert(css.includes("touch-action: pan-y pinch-zoom") && css.includes("scrollbar-gutter: stable") && css.includes("overscroll-behavior: contain"), "Launcher touch and overscroll behavior is incomplete");
assert(js.includes('launcher.addEventListener("wheel"') && js.includes('event.target.closest(".launcher-scroll-region")'), "Launcher chrome does not forward wheel input to its scroll region");
assert(/report:\s*\{[\s\S]*?launcher:\s*false/.test(js), "Support must stay out of the Apps launcher");
assert(html.includes('data-taskbar-material="acrylic"') && html.includes('data-setting="taskbarOpacity"'), "Taskbar appearance controls are incomplete");
assert(controlTemplate.includes("TASKBAR SETTINGS") && controlTemplate.includes('data-setting="taskbarOpacity"') && controlTemplate.includes('data-setting="taskbarAccent"') && !/Desktop widgets|Render profile|Core apps|ABOUT/.test(controlTemplate), "Settings is not restricted to taskbar controls");
assert(css.includes('--neo-panel-solid: #000000') && css.includes('--neo-taskbar-accent: var(--neo-accent-visible') && launcherGlassCss.includes('--launcher-glass: rgba(0, 0, 0, 0.92)') && taskbarMenuCss.includes('background: rgba(0, 0, 0, 0.96)'), "The OLED shell or live taskbar accent is incomplete");
assert(css.includes('data-taskbar-material="acrylic"') && css.includes('var(--neo-taskbar-opacity)') && css.includes('blur(var(--neo-taskbar-blur))'), "Taskbar material controls are not connected to their live CSS values");
assert(/\.taskbar\s*\{[\s\S]{0,700}?background:\s*transparent;[\s\S]{0,300}?backdrop-filter:\s*none;/.test(css), "The taskbar must not paint a full-width blurred strip over the wallpaper");
assert(!rainyDayIndex.includes('width="1920" height="1017"') && rainyDayIndex.includes("viewport-sync.js?v=20260804-responsive-v1"), "Rainy Day still has a fixed-size render surface");
assert(rainyDayCss.includes("width: 100vw !important") && rainyDayCss.includes("height: 100vh !important"), "Rainy Day does not cover the live viewport");
assert(rainyDayViewportSync.includes('window.addEventListener("resize"') && rainyDayViewportSync.includes("window.location.reload()"), "Rainy Day does not rebuild its WebGL buffer after fullscreen or resize");
assert(css.includes("@media (prefers-reduced-motion: reduce)"), "Reduced-motion support is missing");
assert(css.includes("@supports not ((backdrop-filter"), "Glass fallback is missing");
assert(wallpaperInfo.size < 150_000, "The critical wallpaper exceeds the local 150 KB budget");
assert(Buffer.byteLength(css) < 145_000, "NEO OS CSS exceeds the 145 KB source budget");
assert(Buffer.byteLength(js) < 220_000, "NEO OS shell JavaScript exceeds the 220 KB source budget");
assert(html.includes("20260805-desktop-menu-v3"), "The desktop command-menu cache key is stale");
assert(js.includes("openWindows.forEach(function (_, id)") && js.includes('button.classList.toggle("is-minimized", minimized)'), "Open and minimized windows are not represented on the taskbar");
assert(html.includes('data-context-submenu="new"') && html.includes('data-context-submenu="view"') && html.includes('data-context-submenu="sort"') && html.includes('data-context-submenu="widgets"'), "The desktop context menu is missing nested command groups");
assert(html.includes('data-desktop-action="add-files"') && html.includes('data-desktop-action="record"') && html.includes('data-desktop-action="terminal"') && html.includes('data-desktop-action="fullscreen"'), "The desktop context menu is missing core commands");
assert(featureJs.includes("getDisplayMedia") && featureJs.includes("MediaRecorder") && featureJs.includes('folder: "Videos"'), "Desktop recording is not connected to browser capture and Files");
assert(featureJs.includes("mountTerminal") && featureJs.includes("runTerminalCommand") && featureJs.includes("toggleDesktopFullscreen"), "The local terminal app is incomplete");
assert(featureJs.includes("DESKTOP_VIEW_KEY") && featureJs.includes("DESKTOP_SORT_KEY") && featureJs.includes("sortDesktopShortcuts"), "Desktop view and sort preferences are not persistent");
assert(filesJs.includes("openCreate") && filesJs.includes("New Text Document.txt"), "Desktop New commands are not connected to Files");
assert(featureCss.includes(".context-submenu") && featureCss.includes(".neo-terminal") && featureCss.includes("backdrop-filter"), "Desktop menu or terminal styling is incomplete");
assert(Buffer.byteLength(accountSignInJs) < 8_000, "Lazy NEO sign-in JavaScript exceeds the 8 KB source budget");
assert(Buffer.byteLength(wallpaperEngineJs) < 54_000, "Browser wallpaper runtime exceeds the 54 KB source budget");
assert(Buffer.byteLength(wallpaperEngineCss) < 17_000, "Browser wallpaper styles exceed the 17 KB source budget");
assert(Buffer.byteLength(wallpaperQualityJs) < 13_000, "Wallpaper quality scaler exceeds the 13 KB source budget");
assert(Buffer.byteLength(featureJs) < 105_000, "Lazy NEO feature JavaScript exceeds the 105 KB source budget");
assert(Buffer.byteLength(featureCss) < 35_000, "Lazy NEO feature CSS exceeds the 35 KB source budget");
assert(Buffer.byteLength(storeJs) < 16_000 && Buffer.byteLength(storeCss) < 12_000, "Lazy NEO Store assets exceed their source budgets");
assert(Buffer.byteLength(filesJs) < 56_000 && Buffer.byteLength(filesCss) < 38_000, "Lazy NEO Files assets exceed their source budgets");
assert(Buffer.byteLength(wallpaperOnlineJs) < 30_000 && Buffer.byteLength(wallpaperDiscoverCss) < 13_000, "Lazy Discover assets exceed their source budgets");
assert(Buffer.byteLength(wallpaperImportJs) < 15_000, "Lazy original-media importer exceeds the 15 KB source budget");
assert(Buffer.byteLength(wallpaperPreviewRuntimeJs) < 11_000 && Buffer.byteLength(wallpaperPreviewRuntimeCss) < 4_000, "Lazy animated-preview assets exceed their source budgets");
assert(js.includes('fetch("/games/index.json"'), "Catalog search is not connected to the existing data");
assert(js.includes('fetch("/games/covers.json?v=20260802-neo-v2"') && js.includes('"-capture.webp"'), "Library artwork is not connected to the site cover manifest");
assert(js.includes('template: "messages-template"') && js.includes('template: "library-template"'), "Core NEO apps are incomplete");
assert(!html.includes('data-app="community"') && !js.includes('title: "People"') && !js.includes('route: "/community"'), "Removed People app must stay out of NEO");
assert(html.includes('id="browser-template"') && html.includes('data-browser-search-form'), "The internal NEO Browser window is incomplete");
assert(js.includes('Promise.all([loadCatalog(), loadCoverManifest()]).then(function (loaded)') && js.includes('renderSearchResults(results, state, count'), "Search Library can overwrite its results container while loading data");
assert(html.includes('src="./assets/duckduckgo.png"') && html.includes("DuckDuckGo") && js.includes('template: "browser-template"'), "NEO Browse branding is incomplete");
assert(!js.includes('title: "YouTube Music"') && !js.includes('browserTarget: "https://music.youtube.com/"') && !appJs.includes('id: "youtube-music"') && !appJs.includes('id: "youtube"'), "The retired YouTube apps returned");
assert(js.includes('app.template === "browser-template"') && js.includes("openTarget(initialTarget"), "Web apps must launch through the internal browser session");
assert(!js.includes("externalUrl") && !js.includes("learningzone-online-next.netlify.app/browse"), "NEO Browser must not escape to the authenticated Browse page");
assert(!js.includes('route: "/party"') && !js.includes('route: "/gamemaker"'), "Removed Party and Maker apps must stay out of NEO");
assert(html.includes("data-wallpaper-studio") && html.includes("data-wallpaper-favorite") && html.includes("data-wallpaper-apply"), "Wallpaper Studio controls are incomplete");
assert(js.includes("wireWallpaperStudio") && js.includes("wallpaperFavorites") && js.includes("wallpaperRecent"), "Wallpaper Studio state is incomplete");
assert(html.includes("neo-wallpaper-engine.js") && html.includes("neo-wallpaper-engine.css") && html.includes("neo-wallpaper-quality.js") && html.includes('id="wallpaper-media"'), "The browser wallpaper runtime is not loaded");
assert(wallpaperQualityJs.includes('getContext("webgl"') && wallpaperQualityJs.includes("UPSCALE_THRESHOLD") && wallpaperQualityJs.includes("naturalWidth"), "Undersized wallpapers are not routed through the GPU quality scaler");
assert(wallpaperQualityJs.includes("ResizeObserver") && wallpaperQualityJs.includes("MutationObserver") && wallpaperQualityJs.includes("cancelAnimationFrame"), "Wallpaper quality rendering does not resize or clean up safely");
assert(wallpaperQualityJs.includes('root.dataset.wallpaperPlayback === "playing"') && wallpaperQualityJs.includes("time - item.lastFrame >= 33"), "Animated wallpaper quality rendering is not frame-limited");
assert(!js.includes("nativeWallpaperEngine") && !js.includes("requires NEO Desktop") && !js.includes("launchNativeWallpaperEngine"), "Wallpaper Engine must stay browser-native");
assert(wallpaperEngineJs.includes("getBundledLibrary") && wallpaperEngineJs.includes("wallpaper-full-media.json") && wallpaperEngineJs.includes('project.mediaType === "video"') && wallpaperEngineJs.includes('project.mediaType === "web"') && wallpaperEngineJs.includes("Number(project.width) < 1920") && wallpaperEngineJs.includes("isBundled"), "The browser wallpaper runtime is not restricted to verified full media");
assert(js.includes("effectiveWallpaperMotion") && js.includes("motion: effectiveWallpaperMotion()") && !js.includes("root.dataset.motion = effectiveMotion()"), "Chrome performance hints can still disable wallpaper animation");
assert(wallpaperEngineJs.includes("bundledFor") && wallpaperEngineJs.includes("visibleLibrary") && wallpaperEngineJs.includes('record.id !== id') && wallpaperEngineJs.includes('emit("alias")'), "Stale Workshop previews can still shadow bundled animated originals");
assert((js.match(/settings\.wallpaperPaused = false;/g) || []).length >= 4, "Applying a different wallpaper can preserve a stale paused state");
assert(wallpaperEngineJs.includes('media.preload = "auto"') && wallpaperEngineJs.includes('layer.style.backgroundImage = ""'), "Video wallpapers do not replace their poster with eager full-resolution playback");
assert(wallpaperEngineJs.includes("function prepareAssetMedia") && wallpaperEngineJs.includes("function commitPreparedMedia") && wallpaperEngineJs.includes("requestVideoFrameCallback") && wallpaperEngineJs.includes("Chrome could not decode this wallpaper in time") && wallpaperEngineJs.includes("urlFor(record, true) || record.preview"), "Downloaded wallpapers can replace the desktop before Chrome decodes a frame or without a poster fallback");
assert(wallpaperEngineJs.includes("return mountRecord(record, sequence).then") && js.includes("Your previous wallpaper was kept"), "A failed downloaded wallpaper can still destroy or overwrite the previous desktop state");
assert(localPreviewServer.includes('"Accept-Ranges": "bytes"') && localPreviewServer.includes('"Content-Range"') && localPreviewServer.includes("createReadStream(filePath, { start, end })"), "The local preview server cannot stream large wallpaper videos to Chrome");
assert(localPreviewServer.includes('handler as sendChatMessage') && localPreviewServer.includes('requestUrl.pathname === "/.netlify/functions/send-chat-message"'), "The local preview cannot send native Messages");
assert(!wallpaperEngineJs.includes("document.hidden || fullscreen") && wallpaperEngineJs.includes("watchVideo") && wallpaperEngineJs.includes('media.addEventListener("canplay", resumePlayback)') && wallpaperEngineJs.includes('window.addEventListener("pageshow", resumePlayback)'), "Animated wallpapers can still freeze during fullscreen or browser lifecycle changes");
assert(!wallpaperEngineCss.includes("scale(1.005)"), "Wallpaper media still uses a soft subpixel scale");
assert(!wallpaperBuilder.includes("ddagrab=output_idx") && wallpaperBuilder.includes("display-wide capture can expose desktop or gameplay footage"), "The wallpaper builder can still record the user's display");
assert(wallpaperEngineCss.includes(".we-source-tabs") && wallpaperEngineCss.includes(".we-playlist-bar"), "The compact Wallpaper Engine interface is incomplete");
assert(wallpaperEngineCss.includes(".wallpaper-card[hidden]") && wallpaperEngineCss.includes("display: none !important"), "Hidden wallpaper cards can leak into another catalog tab");
assert(html.includes('data-we-source="installed"') && html.includes('data-we-source="discover"') && html.includes('data-we-source="workshop"'), "Wallpaper source tabs are incomplete");
assert(html.includes("data-we-source-intro") && html.includes("data-we-online-title") && html.includes("data-we-online-retry") && html.includes("data-we-online-pager"), "Discover does not expose its live catalog state");
assert(js.includes('nextSource === "workshop" || nextSource === "discover"') && js.includes("requestOnlinePage(1, false)"), "Discover and Workshop tabs do not start live catalog requests");
assert(!html.includes("wallpaper-package") && !js.includes("data-wallpaper-package"), "Shipped wallpapers must not show install controls");
assert(js.includes("neo-wallpaper-online.js") && wallpaperOnlineJs.includes("wallpaper-discover") && wallpaperOnlineJs.includes("data-wallpaper-online"), "The online Wallpaper Engine catalog is not lazy-loaded");
assert(html.includes("data-we-online-pager") && html.includes("data-we-page-input") && html.includes("data-we-result-count"), "The online Wallpaper Engine catalog is missing pagination controls");
assert(js.includes("requestOnlinePage") && js.includes("onlineTotalPages") && js.includes("Filtering now; refreshing online results") && html.includes("data-wallpaper-search-clear") && html.includes("data-wallpaper-search-form") && html.includes("wallpaper-search-submit") && html.includes("data-wallpaper-topic"), "The rebuilt Discover search controls are not connected");
assert(js.includes("submitWallpaperSearch") && wallpaperOnlineJs.includes("SEARCH_TOPICS") && wallpaperOnlineJs.includes("correctedSearchWord") && !js.includes("serverSearchMatch"), "Discover search can still trust irrelevant provider hits or lose typo/topic matching");
assert(wallpaperOnlineJs.includes("URLSearchParams") && wallpaperOnlineJs.includes("options.query") && wallpaperOnlineJs.includes("options.page") && wallpaperOnlineJs.includes("activeRequests") && wallpaperOnlineJs.includes("previous.abort()"), "The online Wallpaper Engine client cannot search, paginate, or cancel stale work");
assert(wallpaperOnlineJs.includes("wallpaperInstall") && wallpaperOnlineJs.includes("downloadOriginal") && !wallpaperOnlineJs.includes("downloadPreview") && wallpaperOnlineJs.includes('button.textContent = active ? "Active" : record ? "Use"') && wallpaperOnlineJs.includes("Downloading") && wallpaperOnlineJs.includes("wallpaperPlayable") && !wallpaperOnlineJs.includes('input.type = "file"'), "Wallpaper installs must use verified animated originals without a native file picker or fake preview fallback");
assert(wallpaperOnlineJs.includes('previewImage.loading = index < 8 ? "eager" : "lazy"') && wallpaperOnlineJs.includes('previewImage.decoding = "async"'), "Discover thumbnails are not prioritized and lazy-loaded correctly");
assert(wallpaperOnlineJs.includes("MAX_ORIGINAL_SIZE") && wallpaperDiscoverFunction.includes("COMMONS_MAX_FILE_SIZE") && wallpaperDiscoverFunction.includes("fileSize > COMMONS_MAX_FILE_SIZE"), "Oversized Discover videos can still be offered as installable wallpapers");
assert(wallpaperOnlineJs.includes('wallpaperInstallState = "downloading"') && wallpaperOnlineJs.includes('new Event("neo-wallpaper-install-state")') && js.includes('selectedInstallState === "downloading"'), "Discover downloads can still be mistaken for unavailable wallpapers");
assert(wallpaperEngineJs.includes("installOnline") && wallpaperEngineJs.includes("refreshLibrary") && wallpaperEngineJs.includes("invalidOnlineRecord") && wallpaperEngineJs.includes("record.fullMedia !== true"), "Preview-only records are not removed from the installed library");
assert(wallpaperImportJs.includes("1920") && wallpaperImportJs.includes("1080") && wallpaperImportJs.includes("animatedGif") && wallpaperImportJs.includes("fullMedia: true") && !wallpaperImportJs.includes("downloadPreview") && wallpaperImportJs.includes("upload.wikimedia.org") && wallpaperImportJs.includes("video/mp4") && wallpaperImportJs.includes("video/webm") && wallpaperImportJs.includes("refreshLibrary"), "Verified online media validation is incomplete");
assert(wallpaperImportJs.includes("fetchWithRetry") && wallpaperImportJs.includes("response.status === 429") && wallpaperImportJs.includes('cache: "default"'), "Discover downloads do not recover from temporary media throttling");
assert(wallpaperImportJs.includes('onProgress(blob.size, blob.size, "verify")') && wallpaperOnlineJs.includes('wallpaperInstallState = "installed"') && wallpaperOnlineJs.includes('install.textContent = "Verifying"'), "Discover downloads can remain stuck in a false in-progress state");
assert(!wallpaperOnlineJs.includes("NEOWallpaperPreviewImport") && !wallpaperOnlineJs.includes("downloadPreview") && wallpaperOnlineJs.includes("Get in Wallpaper Engine"), "Preview-only wallpaper installation is still reachable or native projects are dead ends");
assert(wallpaperEngineJs.includes("function acceptStoredRecord") && wallpaperImportJs.includes("engine.acceptStoredRecord(record)"), "Wallpaper installs still reload the entire IndexedDB library after every save");
assert(wallpaperOnlineJs.includes("studio.dataset.selectedWallpaper === id") && wallpaperOnlineJs.includes("wallpaperSelectionRevision") && js.includes("wallpaperSelectionRevision"), "A completed wallpaper install can still override a newer selection");
assert(js.includes("wallpaperCardEventsReady") && js.includes("target.closest(\"[data-wallpaper-option]\")") && js.includes("function invalidateOnlineRequest"), "Wallpaper cards or catalog tabs can lose interaction state after a re-render");
assert(!/data-online-state=\"(?:loading|pending)\"[^}]*pointer-events:\s*none/s.test(wallpaperEngineCss), "Wallpaper cards are blocked while catalog state changes");
assert(js.includes("dataset.cardOrder") && !js.includes("if (grid) grid.appendChild(card);"), "Wallpaper refreshes still detach every card and interrupt focus or repeated clicks");
assert(html.includes("20260825-ready-discover-v2") && js.includes("20260825-ready-discover-v2") && wallpaperEngineJs.includes("20260805-wallpaper-playback-v1") && wallpaperOnlineJs.includes("neo-wallpaper-import.js?v=20260824-discover-download-v4") && wallpaperOnlineJs.includes("neo-wallpaper-discover.css?v=20260825-ready-discover-v1"), "Wallpaper runtime, install assets, or Discover styles have stale cache keys");
assert(!js.includes("Steam did not provide a usable web preview") && js.includes("Download in progress") && wallpaperOnlineJs.includes("Get in Wallpaper Engine") && !wallpaperOnlineJs.includes("Full file unavailable") && js.includes("Every result downloads once and can be applied immediately"), "Wallpaper availability feedback is stale or provider-incorrect");
assert(wallpaperEngineJs.includes("repairInstalledLibraryOnStartup") && wallpaperEngineJs.includes("invalidOnlineRecord") && !wallpaperEngineJs.includes('store.clear()'), "Verified wallpaper installs do not persist or stale preview records are not repaired");
assert(!wallpaperEngineJs.includes('record.id==="steam-2897087992"') && !wallpaperEngineJs.includes("fortnite-fracture-hd.webp"), "A static preview override can still replace animated playback");
assert(!js.includes('" Use animated preview"') && js.includes("applyAfterInstall") && js.includes('var browserReadyOnly = source === "discover"') && js.includes("Finding web-compatible animated wallpapers") && wallpaperOnlineJs.includes('detailsAvailable ? "Get in Wallpaper Engine" : "Project unavailable"'), "The verified Discover install state is incomplete");
assert(wallpaperEngineJs.includes("startPreviewCanvas") && wallpaperEngineJs.includes("neo-wallpaper-preview-runtime.js") && wallpaperEngineJs.includes("record.previewFallback"), "Discover previews are not routed through the lazy animation runtime");
assert(!wallpaperEngineJs.includes("wallpaper-discover-animated-backdrop") && !wallpaperEngineJs.includes('isAnimatedPreview(activeRecord) && fit === "cover"'), "Animated Discover wallpapers can still render as an inset over a duplicate backdrop");
assert(wallpaperPreviewRuntimeJs.includes('return "matrix"') && wallpaperPreviewRuntimeJs.includes("drawMatrix") && wallpaperPreviewRuntimeJs.includes("minimumScale") && wallpaperPreviewRuntimeJs.includes("requestAnimationFrame"), "Discover previews are not upgraded to high-DPI browser animations");
assert(wallpaperPreviewRuntimeCss.includes(".wallpaper-preview-canvas") && wallpaperPreviewRuntimeCss.includes("neo-preview-source-drift") && wallpaperPreviewRuntimeCss.includes('data-wallpaper-playback="paused"') && !wallpaperPreviewRuntimeCss.includes(".wallpaper-preview-backdrop") && wallpaperPreviewRuntimeCss.includes(".wallpaper-discover-animated-source") && wallpaperPreviewRuntimeCss.includes("object-fit: cover"), "Discover preview animation styling is incomplete or still duplicates the wallpaper surface");
assert(wallpaperQualityJs.includes('classList.contains("wallpaper-preview-source")') && wallpaperPreviewRuntimeJs.includes("wallpaper-preview-canvas"), "Discover still previews are not isolated from the GPU scaler or animation runtime");
assert(wallpaperEngineJs.includes("animatedImage") && wallpaperEngineJs.includes("wallpaper-animated-image-source") && wallpaperQualityJs.includes(':not(.wallpaper-animated-image-source)') && wallpaperEngineJs.includes('media.decoding = animatedImage ? "auto" : "async"'), "Animated images can still be hidden behind a Chrome-throttled replacement canvas");
assert(rainyDayCss.includes("../img/city.png") && !rainyDayCss.includes("../img/city.jpg"), "Rainy Day still references a missing background asset");
assert(wallpaperEngineJs.includes('media.setAttribute("sandbox", "allow-scripts allow-same-origin")') && !wallpaperEngineJs.includes("media.credentialless = true"), "Bundled WebGL wallpapers do not have the local texture access they require");
assert(wallpaperEngineJs.includes('activeMedia.style.visibility = document.hidden ? "hidden" : "visible"') && wallpaperEngineJs.includes("media.addEventListener(\"load\", function () { syncPlayback();"), "Web wallpapers can disappear instead of retaining a paused frame");
assert(js.includes("isCanvas || isVideo || isWeb") && js.includes("isPreview") && js.includes('isPreview ? "High-DPI animation"') && js.includes('isWeb ? "Live animation"') && js.includes('isPaused ? " paused" : " playing"'), "Animated wallpaper playback controls are not active");
assert(whiteTreeIndex.includes('id="snow"') && whiteTreeIndex.includes("20260804-4k-snow-v2") && !whiteTreeIndex.includes("jquery") && !whiteTreeIndex.includes("bootstrap") && !whiteTreeIndex.includes("particles.min.js"), "White Tree still loads its obsolete or stale web shell");
assert(whiteTreeCss.includes('bg.jpg\") center / contain') && whiteTreeCss.includes("image-rendering: auto"), "White Tree does not preserve its full-resolution composition");
assert(whiteTreeJs.includes("requestAnimationFrame") && whiteTreeJs.includes("neo-wallpaper-playback") && whiteTreeJs.includes("devicePixelRatio"), "White Tree does not provide efficient high-DPI animated snow");
const whiteTreeProject = wallpaperFullMedia.projects.find((project) => project.id === "we-steam-1789171537");
assert(whiteTreeProject?.width === 3840 && whiteTreeProject?.height === 2160, "White Tree is not identified as a native 4K web project");
assert(js.includes('var remote = source === "discover" || source === "workshop"') && !js.includes("wallpaperEngine.listBundled()") && js.includes('source === "installed"') && js.includes(': onlineCard && card.getAttribute("data-wallpaper-online-source") === source'), "Discover is not connected to the live paginated catalog");
assert(wallpaperDiscoverFunction.includes("steamcommunity.com/workshop/browse") && wallpaperDiscoverFunction.includes("steamusercontent") && !wallpaperDiscoverFunction.includes("STEAM_WEB_API_KEY"), "The live Workshop catalog endpoint is unsafe or incomplete");
assert(wallpaperDiscoverFunction.includes("parseRenderContext") && wallpaperDiscoverFunction.includes("total_count") && wallpaperDiscoverFunction.includes('requiredtags[]') && wallpaperDiscoverFunction.includes("GetPublishedFileDetails") && wallpaperDiscoverFunction.includes("safeDownload"), "The live Workshop endpoint is missing catalog metadata, filters, or the official browser-media lookup");
assert(wallpaperDiscoverFunction.includes("commons.wikimedia.org/w/api.php") && wallpaperDiscoverFunction.includes("upload.wikimedia.org") && wallpaperDiscoverFunction.includes("viprop") && wallpaperDiscoverFunction.includes("derivatives") && wallpaperDiscoverFunction.includes("filew:>1919") && wallpaperDiscoverFunction.includes("fileh:>1079") && wallpaperDiscoverFunction.includes('"intitle:" + word') && wallpaperDiscoverFunction.includes("fuzzyDiscoverSearch") && wallpaperDiscoverFunction.includes("downloadSources"), "Discover is not backed by title-relevant, searchable, verified high-resolution Commons media");
assert(wallpaperDiscoverFunction.includes("mergeRelevantCommonsItems") && wallpaperDiscoverFunction.includes('request(search, "broad", 1, 120)') && wallpaperDiscoverFunction.includes("commonsRelevance") && !wallpaperDiscoverFunction.includes("DISCOVER_RELATED") && !wallpaperDiscoverFunction.includes("relatedDiscoverSearch"), "Low-result Discover searches are not strictly ranked or can still substitute unrelated topics");
assert(wallpaperDiscoverCss.includes("we-discover-topics") && wallpaperDiscoverCss.includes("wallpaper-card-skeleton") && wallpaperDiscoverCss.includes("var(--neo-accent-visible)"), "The lazy Discover interface is incomplete or bypasses the shared accent palette");
assert(Array.isArray(wallpaperProjects.projects) && wallpaperProjects.projects.length === 19, "The supplied wallpaper project catalog is incomplete");
for (const project of wallpaperProjects.projects) {
  assert(project.id && project.title && project.preview, "A supplied wallpaper project is missing required metadata");
  await access(path.join(neoRoot, project.preview.split("?")[0].replace(/^\.\//, "")));
}
const requiredSafeWallpaperIds = [
  "we-eagleflag",
  "we-steam-2976057265",
  "we-steam-3120899076",
  "we-steam-3192588052",
  "we-steam-3422465318",
];
const requiredWebWallpaperIds = [
  "we-steam-1153238076",
  "we-steam-1403160205",
  "we-steam-1509243786",
  "we-steam-1748506393",
  "we-steam-1789171537",
  "we-steam-3137947556",
  "we-steam-3470738721",
];
const blockedCaptureIds = [
  "we-arsenal",
  "we-audiophile",
  "we-beach",
  "we-corsair_collection",
  "we-corsair_o_tron",
  "we-deep_space",
  "we-demon_core",
  "we-dino_run",
  "we-dna_fragment",
  "we-fantasticcar",
  "we-neon_sunset",
];
assert(Array.isArray(wallpaperFullMedia.projects) && wallpaperFullMedia.projects.length >= requiredSafeWallpaperIds.length, "The verified full-media wallpaper catalog is incomplete");
assert(requiredSafeWallpaperIds.every((id) => wallpaperFullMedia.projects.some((project) => project.id === id)), "A verified safe wallpaper is missing");
assert(requiredWebWallpaperIds.every((id) => wallpaperFullMedia.projects.some((project) => project.id === id && project.mediaType === "web")), "An original browser-native Workshop wallpaper is missing");
assert(blockedCaptureIds.every((id) => !wallpaperFullMedia.projects.some((project) => project.id === id)), "Desktop or gameplay footage entered the wallpaper catalog");
assert(wallpaperWebCompatJs.includes("wallpaperRegisterAudioListener") && wallpaperWebCompatJs.includes("wallpaperRegisterMediaPlaybackListener"), "The Wallpaper Engine browser host API compatibility layer is incomplete");
assert(wallpaperWebCompatJs.includes("Float32Array(128)") && wallpaperWebCompatJs.includes("nativeRequestAnimationFrame(audioTick)"), "Audio-reactive web wallpapers do not have efficient browser animation input");
assert(wallpaperWebCompatJs.includes('event.data.type !== "neo-wallpaper-playback"'), "Web wallpaper playback does not follow the NEO desktop pause state");
assert(wallpaperWebCompatJs.includes('type: "neo-wallpaper-health"') && wallpaperWebCompatJs.includes("projectFrames") && wallpaperWebCompatJs.includes("animationAdvanced"), "Web wallpapers do not report real animation progress");
assert(wallpaperEngineJs.includes("handleWebMessage") && wallpaperEngineJs.includes("startWebHealthWatch") && wallpaperEngineJs.includes("startWebFallback"), "The desktop cannot recover a stalled bundled web wallpaper");
for (const project of wallpaperFullMedia.projects) {
  assert(["video", "web", "animated-image"].includes(project.mediaType), `${project.id} is not supported animated media`);
  assert(Number(project.width) >= 1920 && Number(project.height) >= 1080, `${project.id} is below 1080p`);
  const validFullMedia = project.mediaType === "video"
    ? /^\.\/assets\/wallpaper-engine-full\/.+\.(mp4|webm)$/i.test(project.file)
    : project.mediaType === "animated-image"
      ? /^\.\/assets\/wallpaper-engine-full\/.+\.gif$/i.test(project.file)
      : /^\.\/assets\/wallpaper-engine-web\/[A-Za-z0-9_-]+\/.+\.html?(?:\?[^#]*)?$/i.test(project.file);
  assert(validFullMedia, `${project.id} has an unsupported full-media source`);
  const mediaPath = path.join(neoRoot, project.file.split("?")[0].replace(/^\.\//, ""));
  await access(mediaPath);
  await access(path.join(neoRoot, project.preview.split("?")[0].replace(/^\.\//, "")));
  if (project.mediaType === "web") {
    const webSource = await readFile(mediaPath, "utf8");
    assert(webSource.includes("neo-wallpaper-web-compat.js?v=20260805-chrome-v1"), `${project.id} does not load the browser host API compatibility layer`);
    if (project.id === "we-steam-3470738721") {
      assert(webSource.includes("vendor/p5-1.9.0.min.js") && webSource.includes("vendor/suncalc-1.8.0.min.js"), "Widget Wallpaper still depends on remote animation libraries");
    }
  }
}
assert(!wallpaperFullMedia.projects.some((project) => String(project.sourceId || "") === "3719119251"), "Long-form movie content entered the wallpaper library");
assert(js.includes("RECENT_APPS_KEY") && js.includes("recordRecentApp"), "Recent application state is incomplete");
assert(js.includes("ctrlTapCandidate") && js.includes('event.key !== "Control"'), "Standalone Ctrl launcher behavior is missing");
assert(js.includes("launcherMatchScore") && js.includes("subsequenceScore"), "Launcher fuzzy matching is missing");
assert(js.includes("WINDOW_STATE_KEY") && js.includes("wireWindowPersistence"), "Window layout persistence is incomplete");
assert(html.includes("neo-apps.css?v=20260825-white-accents-v1") && html.includes("neo-wallpaper-engine.css?v=20260825-white-accents-v1") && js.includes("designVersion: 11"), "The browser shell asset version is stale");
assert(html.includes('neo-os.js?v=20260825-ready-discover-v2') && html.includes('neo-os.css?v=20260825-white-accents-v1') && html.includes('neo-apps.js?v=20260824-remove-store-v1'), "The NEO shell does not invalidate stale shell, media-app, or browser loader code");
assert(html.includes('neo-flat-ui.css?v=20260819-launcher-oled-v1') && html.includes('neo-logo.svg?v=20260819-launcher-oled-v1') && flatUiCss.includes('.taskbar-start-button img') && flatUiCss.includes('filter: brightness(.9) contrast(3) !important'), "The taskbar launcher logo still exposes its pale source fringe");
assert(!html.includes("QUICK CONTROLS") && !html.includes('data-widget="quick"') && !html.includes('data-quick="') && !js.includes("handleQuickAction") && !css.includes(".quick-grid"), "Removed desktop quick controls are still present");
assert(html.includes('data-widget="now-playing"') && html.includes("data-now-playing-cover") && html.includes("data-now-playing-wave") && html.includes('aria-live="polite"'), "The desktop Now Playing summary is incomplete");
assert(css.includes("neo-now-playing-wave") && css.includes(".now-playing-widget.is-playing.is-reactive") && css.includes("--neo-wave-level") && css.includes("prefers-reduced-motion"), "The Now Playing waveform or reduced-motion fallback is incomplete");
assert(js.includes("function renderNowPlaying") && js.includes("function renderNowPlayingLevels") && js.includes('window.addEventListener("neo-media-state"') && js.includes('window.addEventListener("neo-media-levels"'), "The shell does not render live media state and levels");
assert(featureJs.includes('source: "local-music"') && featureJs.includes('source: "local-video"') && featureJs.includes("captureVideoCover"), "Local audio or video does not report Now Playing metadata");
assert(featureJs.includes("MUSIC_VOLUME_KEY") && featureJs.includes("0.55") && featureJs.includes("writeJson(MUSIC_VOLUME_KEY"), "The quieter MP3 volume preference is not persistent");
assert(!js.includes('title: "Spotify"') && !js.includes('title: "Netflix"') && !js.includes('title: "Crunchyroll"') && !js.includes("netflix.com") && !js.includes("crunchyroll.com"), "Retired external media apps must remain disconnected");
assert(!html.includes('<script src="./neo-browser-runtime.js'), "Browse must not load its proxy runtime on the desktop critical path");
assert(js.includes("function loadBrowseRuntime") && js.includes('script.src = "./neo-browser-runtime.js?v=20260825-drive-downloads-v2"'), "The lazy NEO Browse loader is incomplete");
assert(browserRuntimeJs.includes("function isNeoShellDestination") && browserRuntimeJs.includes("function returnToDesktop") && browserRuntimeJs.includes("closeButton?.click()"), "NEO Browse can recursively load the desktop shell");
assert(js.includes("function scheduleBrowsePrewarm") && js.includes("prewarmOnPointer") && js.includes("connection.saveData"), "Browse does not prewarm safely from user intent");
assert(!js.includes("/api/browse/session") && js.includes("prepareBrowserEngine") && js.includes("engine.openQuery"), "NEO Browse still depends on the removed placeholder bridge");
assert(js.includes("function destinationFromEntry") && js.includes('new URL("https://" + entry)') && js.includes("openTarget(direct.href"), "The Browse launcher must open URLs directly instead of searching for them");
assert(browserRuntimeJs.includes("window.NEO_BROWSER_ENGINE") && browserRuntimeJs.includes("navigator.serviceWorker.register") && browserRuntimeJs.includes("mountBrowser"), "The in-window NEO Browse runtime is incomplete");
assert(browserRuntimeJs.includes("await Promise.resolve(window.__neoProxyRecovery)"), "Browse can race stale worker recovery during startup");
assert(browserRuntimeJs.includes("data-browser-tabs") && browserRuntimeJs.includes("function createTab") && browserRuntimeJs.includes("function activateTab") && browserRuntimeJs.includes("function closeTab"), "NEO Browse tabs are incomplete");
assert(browserRuntimeJs.includes('NEW_TAB_DESTINATION = "neo://newtab"') && browserRuntimeJs.includes("function wireNewTabFrame") && browserRuntimeJs.includes("browser-newtab.html"), "Local proxy-safe new tabs are incomplete");
assert(!browserRuntimeJs.includes("data-browser-home") && !browserRuntimeJs.includes("data-browser-go") && browserRuntimeJs.includes("data-browser-submit"), "Browse toolbar controls are incomplete or excessive");
assert(browserRuntimeJs.includes('key === "t"') && browserRuntimeJs.includes('key === "w"') && browserRuntimeJs.includes("cycleTabs"), "NEO Browse tab keyboard controls are incomplete");
assert(browserRuntimeJs.includes('createTab(NEW_TAB_DESTINATION, { focusAddress: true })') && browserRuntimeJs.includes("const normalizedDestination = normalizeDestination(destination)"), "NEO Browse creates slow or repeatedly normalized new tabs");
assert(browserRuntimeCss.includes("width: max-content") && browserRuntimeCss.includes("max-width: calc(100% - 34px)"), "The new-tab button is not positioned beside the last tab");
assert(js.includes('browser.classList.toggle(') && js.includes('"has-tabs"') && browserUiCss.includes(".neo-browser-app.has-tabs .neo-browser-session"), "The legacy Browse header is not removed once tabs are active");
assert(browserRuntimeJs.includes('updateViaCache: "none"'), "The proxy worker can reuse stale runtime imports");
assert(browserRuntimeJs.includes("scope: ROUTE_PREFIX") && !browserRuntimeJs.includes("scope: OS_SCOPE"), "The proxy worker can control the NEO desktop shell");
assert(browserRuntimeJs.includes("uv/uv.bundle.js") && browserRuntimeJs.includes("activateWorker().then") && browserRuntimeJs.includes("new window.BareMux.BareMuxConnection") && browserRuntimeJs.indexOf("await configureTransport()") < browserRuntimeJs.indexOf("await activateWorker()"), "The lazy proxy client runtime does not configure BareMux before worker activation");
assert(browserRuntimeJs.includes("loadStyles") && browserRuntimeCss.includes(".neo-browser-toolbar") && browserRuntimeCss.includes(".neo-browser-tabs") && browserRuntimeCss.includes(".neo-browser-pages") && browserRuntimeCss.includes("prefers-reduced-motion"), "NEO Browse styles are not loaded lazily, tab-ready, or motion-safe");
assert(browserRuntimeCss.includes("grid-template-rows: 38px 44px") && browserRuntimeCss.includes(".neo-browser-tab-icon") && browserRuntimeCss.includes("border-radius: 999px"), "The compact Chrome-style Browse runtime regressed");
assert(Buffer.byteLength(browserUiCss) < 8_000 && Buffer.byteLength(browserNewTabCss) < 4_000, "Browse start UI exceeds its source budget");
assert(browserRuntimeJs.includes('PRIMARY_TRANSPORT_URL = `${RUNTIME_ROOT}/epoxy/index.mjs?engine=${ENGINE_VERSION}`') && browserRuntimeJs.includes('FALLBACK_TRANSPORT_URL = `${RUNTIME_ROOT}/libcurl/index.mjs?engine=${ENGINE_VERSION}`') && browserRuntimeJs.indexOf("PRIMARY_TRANSPORT_URL") < browserRuntimeJs.indexOf("FALLBACK_TRANSPORT_URL"), "NEO Browse transport priority or fallback is incomplete");
assert(browserRuntimeJs.includes('WISP_RELAY = "wss://wisp.classroom.lat/"') && browserRuntimeJs.includes("connection.setTransport(transportUrl, [{ wisp: WISP_RELAY }])"), "NEO Browse is not configuring the relay through BareMux");
assert(browserRuntimeJs.includes("function switchToFallbackTransport") && browserRuntimeJs.includes('event.data?.type !== "neo-browser:transport-fallback"') && browserRuntimeJs.includes("event.data.engine !== ENGINE_VERSION") && browserRuntimeJs.includes("transportFallbackPromise") && browserRuntimeJs.includes("recoverMissingTransport") && browserRuntimeJs.includes("configureTransport().then"), "The NEO shell cannot recover a failed, reclaimed, or stale transport");
assert(browserWorkerJs.includes("new UVServiceWorker()") && browserWorkerJs.includes("ultraviolet.fetch(event)") && !browserWorkerJs.includes("new BareTransport") && !browserWorkerJs.includes("monitorBody") && !browserWorkerJs.includes("replaceLiteralStream"), "NEO Browse must preserve stock Ultraviolet streaming in the service worker");
assert(browserWorkerJs.includes('new Set(["GET", "HEAD"])') && browserWorkerJs.includes("requestFallbackFromClient") && browserWorkerJs.includes("engine: ENGINE_VERSION") && browserWorkerJs.includes("return bareFetch(input, options)") && browserWorkerJs.includes("proxyFetchWithRecovery") && browserWorkerJs.includes("isMissingTransportResponse") && !browserWorkerJs.includes("fallbackActivated"), "NEO Browse transport failover is missing, one-shot, or can replay unsafe requests");
assert(browserWorkerJs.includes('ENGINE_VERSION = "neo-browse-v51"') && browserWorkerJs.includes("neo-browser:warm"), "NEO Browse worker activation checks are stale");
assert(browserConfigJs.includes("__neoBrowserDynamicImportFix") && browserConfigJs.includes("rewriteDynamicImport"), "NEO Browse dynamic-import compatibility handling is missing");
assert(browserPrimaryTransportJs.includes("EpoxyClient = class") && browserPrimaryTransportJs.includes("EpoxyTransport as default"), "The Epoxy primary transport is incomplete");
assert(browserTransportJs.includes("libcurl.js@0.7.4") && browserTransportJs.includes("data:application/octet-stream;base64,AGFzbQ") && browserTransportJs.includes("await libcurl.load_wasm()"), "The self-contained fallback transport does not wait for WASM readiness");
assert(browserTransportWasm.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d])), "The external proxy WebAssembly payload is invalid");
assert(bareMuxRuntimeJs.includes("BareMuxConnection") && bareMuxRuntimeJs.includes("bare-mux workerPath"), "The BareMux client runtime is incomplete");
assert(bareMuxWorkerJs.includes("No BareTransport was set") && bareMuxWorkerJs.includes("setTransport"), "The BareMux shared worker is incomplete");
assert(browserConfigJs.includes('prefix: "/neo-os/browse/"') && browserConfigJs.includes("encodeURIComponent") && browserConfigJs.includes("decodeURIComponent"), "NEO Browse destinations must stay visible and NEO-scoped");
assert(browserClientShellJs.includes("window.open = function openInNeoBrowser") && browserClientShellJs.includes("neo-browser:navigation"), "Proxied pages can escape the NEO Browse window");
assert(browserRuntimeJs.includes("data-browser-context-menu") && browserRuntimeJs.includes("data-browser-context-action=\"inspect\"") && browserRuntimeJs.includes("function startInspectorPicker"), "NEO Browse element inspection controls are incomplete");
assert(browserRuntimeJs.includes("neo-browser:inspect-selected") && browserRuntimeJs.includes('key === "i"') && browserRuntimeJs.includes("closeInspector"), "NEO Browse inspector messaging, shortcut, or cleanup is incomplete");
assert(browserRuntimeCss.includes(".neo-browser-context-menu") && browserRuntimeCss.includes(".neo-browser-inspector.is-open") && browserRuntimeCss.includes("contain: layout paint"), "NEO Browse inspector styling is incomplete or repaint-heavy");
assert(browserClientShellJs.includes("function describeElement") && browserClientShellJs.includes("neo-browser:context-menu") && browserClientShellJs.includes("neo-browser:context-dismiss"), "Proxied pages do not expose the safe inspection bridge");
assert(browserClientShellJs.includes('attribute.name.toLowerCase() !== "value"') && browserClientShellJs.includes('element.matches("input, textarea, select, option")'), "NEO Browse inspection can expose live form values");
assert(browserConfigJs.includes('engineVersion = "neo-browse-v51"') && browserConfigJs.includes("-shell-v3"), "The proxied navigation, media, and download bridge can remain stale after an update");
assert(browserClientShellJs.includes("downloadRequestForLink") && browserClientShellJs.includes('type: "neo-browser:download-start"') && browserClientShellJs.includes('type: "neo-browser:download-request"') && browserClientShellJs.includes('credentials: "include"') && browserClientShellJs.includes("response.blob()"), "Proxied pages do not fetch link or generated-file downloads in their own session before handing them to NEO Drive");
assert(browserRuntimeJs.includes("saveDownloadToDrive") && browserRuntimeJs.includes('folder: "Downloads"') && browserRuntimeJs.includes("runtime.routeFor(destination)") && browserRuntimeJs.includes("downloadNameFromDisposition"), "Web downloads are not fetched safely or saved to Drive > Downloads");
assert(browserRuntimeJs.includes("ensureDownloadStorage") && browserRuntimeJs.includes("activeDownloads.size >= 4") && browserRuntimeJs.includes('detail.userActivated !== true'), "Web downloads are missing storage, concurrency, or user-activation protections");
assert(browserRuntimeCss.includes(".neo-browser-download-status") && browserRuntimeCss.includes("neo-browser-download-pulse"), "Web download status is not visible or motion-safe");
assert(browserClientShellJs.includes("neo-browser:media-state") && browserClientShellJs.includes("navigator.mediaSession") && browserClientShellJs.includes("mediaDetails"), "Proxied media does not expose safe title and artwork metadata");
assert(browserClientShellJs.includes("__neoMappedBlobFix") && browserClientShellJs.includes("blobUrls?.get") && browserClientShellJs.includes("media instanceof HTMLAudioElement") && browserClientShellJs.includes("captureStream") && browserClientShellJs.includes("createAnalyser") && browserClientShellJs.includes("neo-browser:media-levels"), "Proxied audio workers or media-safe reactive levels are incomplete");
assert(browserClientShellJs.indexOf("media instanceof HTMLAudioElement") < browserClientShellJs.indexOf("captureStream"), "Proxied video can still start a duplicate capture pipeline");
assert(browserRuntimeJs.includes("emitBrowserMediaState") && browserRuntimeJs.includes("emitBrowserMediaLevels") && browserRuntimeJs.includes('source: mediaSource') && browserRuntimeJs.includes('appId: options.appId || "browser"'), "Browse media state is not connected to the desktop widget");
assert(!browserRuntimeJs.includes("options.openYouTube") && !js.includes("loadYouTubeRuntime") && !js.includes('openApp("youtube")'), "Standalone YouTube app routing remains in the shell");
assert(browserClientShellJs.includes("function isYouTubeDestination") && browserClientShellJs.includes("neo-browser:navigate-request"), "YouTube links inside web sessions cannot stay in the current NEO tab");
assert(!browserWorkerJs.includes("navigation-policy") && !browserConfigJs.includes("navigation-policy") && !browserClientShellJs.includes("keepYouTubeInGuestMode") && !browserRuntimeJs.includes("neo-browser:auth-blocked"), "Removed YouTube-only proxy policy code is still referenced");
assert(browserClientShellJs.includes('element.setAttribute("target", "_self")') && browserClientShellJs.includes('submitter.setAttribute("formtarget", "_self")'), "Cross-site links or form actions can escape the NEO tab");
assert(browserClientShellJs.includes('"auxclick"') && browserClientShellJs.includes("HTMLFormElement.prototype.submit") && browserClientShellJs.includes("window.open = function openInNeoBrowser"), "Middle-click, scripted forms, or popup buttons can escape the NEO transport");
assert(browserClientShellJs.includes("unwrapDuckDuckGoRedirect") && browserClientShellJs.includes("neo-browser:navigate-request") && !browserClientShellJs.includes('window.location.assign(`/neo-os/browse/'), "Search result redirects can still be encoded twice");
assert(browserClientShellJs.includes("lastReport") && browserClientShellJs.includes("scheduleNavigationReport") && browserClientShellJs.includes('["pushState", "replaceState"]'), "Proxied SPA navigation updates are not coalesced");
assert(browserRuntimeJs.includes("pendingDestination") && browserRuntimeJs.includes("actualDestination !== destination") && browserRuntimeJs.includes('messageType === "neo-browser:navigate-request"') && browserRuntimeJs.match(/tab\.loading && tab\.pendingDestination/g)?.length >= 3, "Stale frame history, popup, or authentication navigation is not guarded");
assert(browserRuntimeJs.includes("addressForm.requestSubmit()") && js.includes("form.requestSubmit()"), "Enter does not reliably submit web searches");
assert(wallpaperEngineJs.includes("setMediaPriority") && wallpaperEngineJs.includes("mediaPriorityPaused") && js.includes('window.addEventListener("neo-media-priority"'), "Animated wallpaper playback can compete with active web media");
assert(browserNotices.includes("Ultraviolet") && browserNotices.includes("Epoxy transport 3.0.1") && browserNotices.includes("libcurl.js") && browserNotices.includes("AGPL"), "Third-party browser runtime notices are incomplete");
assert(!js.toLowerCase().includes("cloud gaming"), "Cloud gaming must not be connected in this pass");
assert(html.includes('id="library-template"') && js.includes('template: "library-template"'), "The local game library is incomplete");
assert(js.includes("function localGameRoute") && js.includes('route: route'), "Games must launch from validated local files");
assert(!js.includes('route: "/zone/"') && !js.includes('route: "/"'), "Games must not launch through protected LearningZone routes");
assert(html.includes('id="messages-template"') && html.includes("data-messages-app"), "The native Messages interface is missing");
assert(!js.includes('route: "/chat"') && js.includes('template: "messages-template"'), "Messages must not use a URL embed");
assert(js.includes("send-chat-message") && js.includes("ugp_token"), "Native Messages must preserve authenticated sending");
assert(js.includes("var linkedUsername") && js.includes("nativeChatStateRequest") && js.includes("/.netlify/functions/chat-state") && chatStateFunction.includes('readJson("rooms"') && chatStateFunction.includes(".catch(function () { return {}; })"), "Native Messages still blocks Global Chat on optional room metadata");
assert(chatStateFunction.includes('orderBy: JSON.stringify("$key")') && chatStateFunction.includes("limitToLast: String(MESSAGE_LIMIT)"), "Native Messages must use a bounded recent-message query");
assert(!chatStateFunction.includes('readJson("accounts",') && chatStateFunction.includes('ultimateGameStash/siteSync/chatProfiles'), "Native Messages must not download the full account database");
assert(Array.isArray(gameIndex) && gameIndex.length > 0, "The local game catalog is empty");
assert(gameIndex.every((entry) => /^games\/[A-Za-z0-9._()\[\] -]+\.html$/.test(entry.file)), "The game catalog contains a non-local route");
assert(gameIndex.every((entry) => localGameFiles.has(path.basename(entry.file))), "The game catalog contains a missing local file");
assert(new Set(gameIndex.map((entry) => entry.slug)).size === gameIndex.length, "The game catalog contains duplicate slugs");
assert(Object.keys(gameCovers).length === gameIndex.length, "The game cover manifest does not cover the full catalog");
assert(Object.values(gameCovers).every((cover) => /^\/games\/captured-covers\/|^https:\/\//.test(cover)), "The game cover manifest contains an insecure or unsupported source");
assert(html.includes("app-icon-duckduckgo") && html.includes("app-icon-gamepad") && html.includes("app-icon-chat"), "Dock app identities are incomplete");
assert(js.includes("function appIconClass") && js.includes("app-icon-shape"), "Dynamic app icons do not preserve their identities");
assert(html.includes('id="i-gamepad"') && html.includes("assets/messages.png") && js.includes("assets/messages.png"), "The HTML Games controller or official Messages artwork is missing");
assert(html.includes("data-chat-pinned-list") && html.includes("messages-composer-shell") && js.includes("createRoomButton(room, pinned)"), "The Apple-style Messages structure is incomplete");
assert(css.includes("Taskbar finish: shared geometry") && css.includes("--dock-hit: 42px") && css.includes("width: var(--dock-art)"), "Dock icons do not share stable optical geometry");
assert(html.includes("02 AUGUST, 2026.") && js.includes("rainmeterWeekday.replaceChildren") && css.includes("anurati.otf") && css.includes("quicksand.otf"), "The Mond clock treatment is incomplete");
assert(html.includes("neo-rainmeter.css") && html.includes("neo-rainmeter.js"), "The Rainmeter editor is not loaded");
assert(Buffer.byteLength(rainmeterJs) < 12_000 && Buffer.byteLength(rainmeterCss) < 14_000, "Rainmeter customization exceeds its source budget");
assert(rainmeterJs.includes('addEventListener("contextmenu"') && rainmeterJs.includes('neo_os_rainmeter_v1') && rainmeterJs.includes('"bottom-right"'), "Rainmeter customization behavior is incomplete");
assert(rainmeterCss.includes(".rainmeter-position-grid") && rainmeterCss.includes("prefers-reduced-motion"), "Rainmeter customization is not polished or motion-safe");
assert(js.includes("neo-os-features.js") && js.includes("function loadFeatureRuntime"), "Feature apps must stay off the initial critical path");
assert(!js.includes('id: "store"') && !js.includes("loadStoreRuntime") && !html.includes('id="i-store"'), "The retired App Store remains registered in the shell");
assert(appJs.includes("neo_os_remove_app_store_v1") && appJs.includes('id !== "store"'), "Existing workspaces do not remove the retired App Store");
assert(!html.includes('data-app="store"') && !appCss.includes('[data-app="store"]'), "The retired App Store remains visible in shell markup or styles");
assert(js.includes('runtime: "files"') && js.includes("function loadFilesRuntime") && js.includes("saveToFiles"), "NEO Files is not connected to the shell or lazy loader");
assert(html.includes('data-app="files"') && html.includes('id="i-folder"') && appCss.includes(".app-icon-folder"), "NEO Files is missing its taskbar identity");
assert(appJs.includes("neo_os_files_app_v1") && appJs.includes('filesPins.splice'), "Existing workspaces do not receive the Files taskbar pin");
assert(appJs.includes("neo_os_my_apps_pin_v1") && appJs.includes('appPins.unshift("apps")'), "Existing workspaces do not receive the My Apps taskbar pin");
assert(/^\s*var apps = \{\s*apps:\s*\{/m.test(js) && /apps:\s*\{[\s\S]*?pinned:\s*true/.test(js), "My Apps must remain first and pinned by default");
assert(appCss.includes('dock-button[data-app="apps"]') && appCss.includes("background: transparent !important") && appCss.includes("backdrop-filter: none"), "The My Apps taskbar icon is not transparent");
assert(filesJs.includes("indexedDB.open") && filesJs.includes('neo_os_files_v1') && filesJs.includes("saveBlob"), "NEO Drive persistence is incomplete");
assert(filesJs.includes('addEventListener("neo-files-save"') && filesJs.includes('dispatchEvent(new CustomEvent("neo-file-saved"'), "NEO apps cannot save into the shared drive");
assert(filesJs.includes("data-files-input") && filesJs.includes("event.dataTransfer.files") && filesJs.includes("showSaveFilePicker"), "File import, drop, or device export is incomplete");
assert(filesJs.includes("trashEntry") && filesJs.includes("restoreEntry") && filesJs.includes("deletePermanently"), "Trash lifecycle controls are incomplete");
assert(filesCss.includes("container: neo-files / inline-size") && filesCss.includes("@container neo-files (max-width: 700px)") && filesCss.includes("prefers-reduced-motion") && filesCss.includes(".files-collection.is-list"), "NEO Files is not responsive or motion-safe");
assert(featureJs.includes('type: "audio"') && featureJs.includes('type: "video"'), "Local Music and Media storage are incomplete");
assert(featureJs.includes("requestPictureInPicture") && featureJs.includes("data-app-pin"), "Media pop-out and My Apps controls are incomplete");
assert(!featureJs.includes("<iframe") && !featureJs.includes("https://"), "Feature apps must not use URL embeds or external media sources");
assert(html.includes("neo-taskbar-menu.css") && html.includes("neo-taskbar-menu.js"), "Taskbar app controls are not loaded");
assert(taskbarMenuJs.includes('event.target.closest(".dock-button[data-app], #app-launcher [data-app]")') && taskbarMenuJs.includes("Unpin from taskbar") && taskbarMenuJs.includes("Close all windows"), "Taskbar and launcher app controls are incomplete");
assert(taskbarMenuJs.includes("menu.dataset.taskbarApp") && !taskbarMenuJs.includes("menu.dataset.app") && taskbarMenuJs.includes("event.stopPropagation()"), "Taskbar menu actions can still bubble into the app launcher");
assert(taskbarMenuJs.includes('event.key !== "ContextMenu"') && taskbarMenuJs.includes('event.shiftKey && event.key === "F10"'), "Taskbar app controls need keyboard access");
assert(taskbarMenuCss.includes(".neo-taskbar-menu.is-open") && taskbarMenuCss.includes("prefers-reduced-motion"), "Taskbar app menu styling is incomplete");
assert(html.includes("neo-apps.js") && html.includes("neo-apps.css") && js.includes("window.NEO_EXTRA_APPS"), "External NEO app registration is not loaded");
assert(appJs.includes('id: "stream"') && appJs.includes('title: "Music"') && appJs.includes('browserTarget: "https://vcsa.huangqirui.xyz/listen"') && appJs.includes('browserDirect: false') && appJs.includes('browserChrome: false') && appJs.includes('browserTheme: "stream-music"'), "Music is not routed through the current chromeless streaming mode");
assert(browserRuntimeJs.includes("directOrigin") && browserRuntimeJs.includes("tab.frame.src = tab.destination") && browserRuntimeJs.includes("tab.frame.src = runtime.routeFor(tab.destination)"), "Origin-bound media apps cannot load directly inside the NEO window");
assert(appJs.includes("neo_os_stream_music_v1") && appJs.includes('ids.push("stream")') && appJs.includes("neo_os_remove_youtube_music_v1") && appJs.includes("neo_os_remove_youtube_app_v1"), "Music or retired-app state migration is missing");
assert(browserRuntimeJs.includes("is-app-mode") && browserRuntimeJs.includes("loadAppTheme") && browserRuntimeJs.includes("applyAppTheme") && browserRuntimeCss.includes("neo-browser-runtime.is-app-mode"), "Chromeless proxied app mode is incomplete");
assert(browserRuntimeJs.includes('theme === "stream-music"') && browserRuntimeJs.includes("enhanceStreamMusic(frameDocument)"), "Music does not load or enhance its current app theme");
assert(browserRuntimeJs.includes("BAREMUX_WORKER_URL") && browserRuntimeJs.includes("new window.BareMux.BareMuxConnection(BAREMUX_WORKER_URL)"), "NEO Browse cannot recover its client transport after navigation");
assert(streamMusicCss.includes('data-neo-app-theme="stream-music"') && streamMusicCss.includes("#1ed760") && streamMusicCss.includes(".player") && streamMusicCss.includes("prefers-reduced-motion"), "Music player styling is incomplete");
assert(streamMusicCss.includes('.nv[data-view="discover"]') && streamMusicCss.includes("display: none !important"), "Music still exposes the removed Discover navigation");
assert(js.includes('title: "Find HTML Games"') && js.includes('pinned: false') && appJs.includes("neo_os_unpin_search_v1"), "The separate HTML Games search shortcut was not removed");
assert(html.includes('id="i-stream"') && html.includes("assets/spotify.svg") && appCss.includes(".app-icon-stream") && appCss.includes("background: transparent"), "Music app artwork is incomplete");
assert(html.includes("data-active-app-icon") && appJs.includes("window.NEORenderActiveApp") && js.includes("window.NEORenderActiveApp(app, iconMarkup(app.icon), appIconClass(app.icon))"), "The active-app widget is not bound to each app's registered artwork");
assert(js.includes('title: "MP3 Player"') && js.includes('icon: "music"') && js.includes('launcher: false') && js.includes('data-unified-music-mode="mp3"') && js.includes('"mp3", "songs"'), "The local MP3 Player is not merged into Music");
assert(html.includes('id="i-music"') && js.includes("music-mp3-panel") && featureJs.includes("mountMusic"), "MP3 Player artwork or unified panel is incomplete");
assert(js.includes('title: "Media Player"') && js.includes('"media player", "video"') && html.includes('aria-label="Media Player"'), "Media was not renamed to Media Player");
assert(featureJs.includes("<strong>Media Player</strong>") && featureJs.includes('aria-label="Media Player views"'), "Media Player branding is incomplete");
assert(appCss.includes("Flat app artwork") && appCss.includes('background: #35b86f !important') && appCss.includes("box-shadow: none !important"), "Flat green Media Player artwork is incomplete");
assert(html.includes('fetchpriority="high" draggable="false"') && css.includes("-webkit-user-drag: none") && css.includes(".wallpaper *"), "Wallpaper artwork can still be selected or dragged");
assert(html.includes('id="neo-account-sign-in-template"') && html.includes('data-chat-sign-in type="button"') && !html.includes('data-chat-sign-in href=') && html.includes('data-neo-auth-mode="register"') && js.includes("function openSignInPage") && js.includes('import("./neo-account-signin.js') && accountSignInJs.includes('requestMode === "register" ? "account-register" : "account-login"') && accountSignInJs.includes('"/.netlify/functions/" + functionName') && appCss.includes(".neo-browser-auth-tabs"), "Messages is missing its native NEO sign-in and registration flow");
assert(js.includes('strong.textContent = "Sign in to message"') && js.includes('username = token ?') && js.includes('app.classList.toggle("is-signed-out"') && appCss.includes(".messages-auth-action"), "Signed-out Messages does not show or enforce its account gate");
assert(html.includes("neo-window-resize.js") && html.includes("neo-window-resize.css"), "Window resizing assets are not loaded");
assert(resizeJs.includes('directions = ["n", "e", "s", "w", "ne", "nw", "se", "sw"]') && resizeJs.includes("setPointerCapture") && resizeJs.includes("keyboardResize"), "Window edge, corner, or keyboard resizing is incomplete");
assert(resizeCss.includes('[data-window-resize="se"]') && resizeCss.includes(".neo-window.is-maximized .window-resize-handle") && resizeCss.includes("@media (max-width: 720px)"), "Window resize handles are not responsive");
assert(resizeCss.includes("@media (min-width: 761px)") && resizeCss.includes("max-width: calc(100vw - 14px)") && resizeCss.includes("max-height: calc(100dvh - 106px)"), "Restored desktop windows can overflow tablet viewports");
assert(resizeJs.includes('event.code === "KeyB"') && resizeJs.includes("enterTabFullscreen") && resizeCss.includes(".neo-window.is-tab-fullscreen") && resizeCss.includes("html.has-tab-fullscreen .taskbar"), "Ctrl+B tab fullscreen is incomplete");
assert(resizeJs.includes('data-window-action="fullscreen"') && resizeJs.includes("handleFullscreenButton"), "Clickable app fullscreen control is incomplete");
assert((html.match(/<template\b/g) || []).length === (html.match(/<\/template>/g) || []).length, "Template tags are unbalanced");

console.log(`NEO OS smoke checks passed: ${checks}`);
