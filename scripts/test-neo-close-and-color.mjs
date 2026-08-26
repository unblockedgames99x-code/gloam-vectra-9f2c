import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [html, shell, browserRuntime, browserClient, browserConfig, browserWorker, css] = await Promise.all([
  read("neo-os/index.html"),
  read("neo-os/neo-os.js"),
  read("neo-os/neo-browser-runtime.js"),
  read("neo-os/browser-runtime/client-shell.js"),
  read("neo-os/browser-runtime/uv/uv.config.js"),
  read("neo-os/browser-sw.js"),
  read("neo-os/neo-os.css"),
]);

assert.match(shell, /designVersion:\s*11/);
assert.match(shell, /brightness:\s*100/);
assert.match(shell, /saturation:\s*100/);
assert.match(shell, /savedDesignVersion < 11/);
assert.match(css, /--wallpaper-brightness:\s*1;/);
assert.match(css, /--wallpaper-saturation:\s*1;/);

const closeWindowSource = shell.slice(shell.indexOf("function closeWindow"), shell.indexOf("function minimizeWindow"));
assert.ok(!closeWindowSource.includes('src = "about:blank"'), "App close must not navigate an iframe before removing it");

const closeTabSource = browserRuntime.slice(browserRuntime.indexOf("function closeTab"), browserRuntime.indexOf("function cycleTabs"));
assert.ok(!closeTabSource.includes('src = "about:blank"'), "Tab close must not navigate an iframe before removing it");
assert.match(closeTabSource, /tab\.frame\.remove\(\)/);

const cleanupSource = browserRuntime.slice(browserRuntime.indexOf("shell._neoBrowserCleanup"), browserRuntime.indexOf("createTab(target)"));
assert.ok(!cleanupSource.includes('src = "about:blank"'), "App cleanup must detach frames without a leave-confirmation navigation");
assert.match(cleanupSource, /tab\.frame\.remove\(\)/);

assert.match(browserClient, /disableLeaveConfirmation/);
assert.match(browserClient, /String\(type\)\.toLowerCase\(\) === "beforeunload"/);
assert.match(browserClient, /event\.stopImmediatePropagation\(\)/);
assert.match(browserClient, /Object\.defineProperty\(window, "onbeforeunload"/);

for (const source of [html, browserRuntime, browserConfig, browserWorker]) {
  assert.match(source, /neo-browse-v51/);
}

console.log("NEO app close and wallpaper color checks passed.");
