import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [parentSource, frameSource, embedSource, indexSource] = await Promise.all([
  readFile(path.join(root, "chat-site-sync.js"), "utf8"),
  readFile(path.join(root, "chat-account-link-frame.js"), "utf8"),
  readFile(path.join(root, "page-embed.html"), "utf8"),
  readFile(path.join(root, "index.html"), "utf8")
]);

assert.match(parentSource, /learning-zones-profile-media-update/);
assert.match(parentSource, /isChatFrameSource\(source\)/);
assert.match(parentSource, /siteProfileButtonIcon\(profile\)/);
assert.match(parentSource, /siteProfileBannerBackground\(profile\)/);
assert.match(embedSource, /\brender,\s*\n\s*normalizeProfileFields,/);
assert.match(embedSource, /chat-account-link-frame\.js\?v=20260724-typingavatars1/);
assert.match(indexSource, /chat-site-sync\.js\?v=20260724-savefeedback2/);

const origin = "https://learningzone.online";
const parentMessages = [];
const parentWindow = {
  postMessage(payload, targetOrigin) {
    parentMessages.push({ payload, targetOrigin });
  }
};
const windowListeners = new Map();
const documentListeners = new Map();
const storage = new Map();
let saveCount = 0;
let renderCount = 0;

const oldAvatar = "data:image/png;base64,T0xE";
const newAvatar = "data:image/png;base64,TkVX";
const newBanner = "data:image/webp;base64,QkFOTkVS";
const chatBanner = "data:image/jpeg;base64,Q0hBVA==";
const account = {
  username: "CarterB",
  avatar: oldAvatar,
  profileBanner: "solid",
  profileBannerColor: "#2d3039",
  profileBannerImage: "",
  profileMediaUpdatedAt: 100,
  updatedAt: 100
};
const state = { accounts: { carterb: account } };

function on(target, type, handler, capture = false) {
  const bucket = target.get(type) || [];
  bucket.push({ handler, capture: capture === true });
  target.set(type, bucket);
}

const bridge = {
  passwordMinLength: 8,
  browserId: "browser-smoke",
  browserFingerprintKey: "fingerprint-smoke",
  getState: () => state,
  setState: () => state,
  getMe: () => account.username,
  setMe: () => account.username,
  stopPresenceTimer() {},
  element: () => null,
  loginError() {},
  isOwnerName: () => true,
  currentBrowserIds: () => [],
  currentBrowserFingerprints: () => [],
  constantTimeEqual: (a, b) => a === b,
  verifyAccountPassword: async () => ({ ok: true }),
  securePasswordHashingAvailable: () => true,
  setAccountPassword: async () => {},
  createPasswordHashRecord: async () => ({}),
  fetchAccountForLogin: async () => account,
  normalize: value => value,
  normalizeProfileFields: value => value,
  activeBrowserBan: () => null,
  activeAccountBan: () => null,
  linkAccountToBrowser: () => false,
  banMessage: () => "",
  touchAccount: () => true,
  save: () => { saveCount += 1; },
  forceCloudSaveNow: async () => {},
  render: () => { renderCount += 1; },
  openApp() {},
  account: () => account,
  installLinkedLogin() {}
};

const sandbox = {
  console,
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  structuredClone,
  location: { origin },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  document: {
    addEventListener(type, handler, options) {
      on(documentListeners, type, handler, options);
    },
    visibilityState: "visible",
    hasFocus: () => true
  },
  window: {
    __learningZonesChatAccountBridge: bridge,
    parent: parentWindow,
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    setTimeout,
    clearTimeout,
    addEventListener(type, handler, options) {
      on(windowListeners, type, handler, options);
    }
  },
  setTimeout,
  clearTimeout
};
sandbox.window.window = sandbox.window;

vm.runInNewContext(frameSource, sandbox, { filename: "chat-account-link-frame.js" });

const messageHandler = windowListeners.get("message")?.[0]?.handler;
assert.equal(typeof messageHandler, "function", "The Chat frame must install the profile-media message listener.");

messageHandler({
  origin,
  source: parentWindow,
  data: {
    type: "learning-zones-profile-media",
    username: "CarterB",
    profile: {
      avatar: newAvatar,
      banner: "ocean",
      bannerColor: "#123456",
      bannerImage: newBanner,
      mediaUpdatedAt: 200
    }
  }
});

assert.equal(account.avatar, newAvatar);
assert.equal(account.profileBanner, "ocean");
assert.equal(account.profileBannerColor, "#123456");
assert.equal(account.profileBannerImage, newBanner);
assert.equal(account.profileMediaUpdatedAt, 200);
assert.equal(saveCount, 1);
assert.equal(renderCount, 1);

messageHandler({
  origin,
  source: parentWindow,
  data: {
    type: "learning-zones-profile-media",
    username: "CarterB",
    profile: {
      avatar: oldAvatar,
      banner: "solid",
      bannerColor: "#000000",
      bannerImage: "",
      mediaUpdatedAt: 150
    }
  }
});
assert.equal(account.avatar, newAvatar, "An older site snapshot must not overwrite newer Chat media.");

const clickListeners = documentListeners.get("click") || [];
const saveTarget = {
  closest(selector) {
    return selector.includes("#settings-save-profile") ? this : null;
  }
};
const clickEvent = {
  target: saveTarget,
  preventDefault() {},
  stopImmediatePropagation() {}
};
clickListeners.filter(item => item.capture).forEach(item => item.handler(clickEvent));
account.avatar = "data:image/png;base64,Q0hBVEFWQVRBUg==";
account.profileBanner = "galaxy";
account.profileBannerColor = "#654321";
account.profileBannerImage = chatBanner;
clickListeners.filter(item => !item.capture).forEach(item => item.handler(clickEvent));
await new Promise(resolve => setTimeout(resolve, 10));

const mediaMessage = parentMessages.findLast(item => item.payload?.type === "learning-zones-profile-media-update");
assert.ok(mediaMessage, "Saving Chat profile media must immediately notify the parent site.");
assert.equal(mediaMessage.targetOrigin, origin);
assert.equal(mediaMessage.payload.username, "CarterB");
assert.equal(mediaMessage.payload.profile.avatar, account.avatar);
assert.equal(mediaMessage.payload.profile.banner, "galaxy");
assert.equal(mediaMessage.payload.profile.bannerImage, chatBanner);
assert.ok(mediaMessage.payload.profile.mediaUpdatedAt > 200);

console.log(JSON.stringify({
  passed: true,
  siteToChat: true,
  chatToSite: true,
  staleWriteRejected: true,
  sharedAvatar: true,
  sharedBanner: true
}, null, 2));
