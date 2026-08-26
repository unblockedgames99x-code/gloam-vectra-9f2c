import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.join(scriptDir, "..", "route-recovery.js"), "utf8");

function runRoute(pathname, token = "") {
  let redirect = "";
  const listeners = new Map();
  const location = {
    pathname,
    search: "",
    hash: "",
    href: `https://learningzone.online${pathname}`,
    origin: "https://learningzone.online",
    replace(value) {
      redirect = value;
    },
  };
  const history = {
    state: null,
    replaceState(state, _title, value) {
      this.state = state;
      const url = new URL(value, location.origin);
      location.pathname = url.pathname;
      location.search = url.search;
      location.hash = url.hash;
      location.href = url.href;
    },
    pushState() {},
  };
  const storage = new Map(token ? [["ugp_token", token]] : []);
  const document = {
    readyState: "loading",
    body: null,
    getElementById() {
      return null;
    },
    addEventListener(name, handler) {
      listeners.set(`document:${name}`, handler);
    },
  };
  const window = {
    document,
    history,
    location,
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
    },
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    addEventListener(name, handler) {
      listeners.set(`window:${name}`, handler);
    },
    clearTimeout() {},
    setTimeout() {
      return 1;
    },
  };

  vm.runInNewContext(source, {
    document,
    history,
    location,
    window,
    URL,
    PopStateEvent: class PopStateEvent {},
    Set,
    JSON,
    Date,
    Object,
    String,
  });

  return { pathname: location.pathname, redirect };
}

assert.deepEqual(runRoute("/zones", "static-firebase:member"), { pathname: "/", redirect: "" });
assert.deepEqual(runRoute("/games", "static-firebase:member"), { pathname: "/", redirect: "" });
assert.equal(runRoute("/zones").redirect, "/login");
assert.equal(runRoute("/zone/retro-bowl").redirect, "/login");
assert.equal(runRoute("/chat").redirect, "/login");
assert.equal(runRoute("/not-a-route").redirect, "/login");
assert.deepEqual(runRoute("/settings"), { pathname: "/settings", redirect: "" });
assert.deepEqual(runRoute("/report-bug"), { pathname: "/report-bug", redirect: "" });

console.log("Route recovery checks passed (8/8).");
