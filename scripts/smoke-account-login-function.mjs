import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { handler } from "../netlify/functions/account-login.js";

const originalFetch = globalThis.fetch;
const salt = Buffer.from("account-login-smoke-salt").toString("base64");
const password = "Correct-Smoke-Password!";
const passwordHash = pbkdf2Sync(password, Buffer.from(salt, "base64"), 120_000, 32, "sha256").toString("base64");
const accounts = {
  legacy_user: {
    username: "Legacy_User",
    password,
    role: "member",
    ugpStatus: "approved",
    createdAt: Date.now() - 10_000
  },
  hash_user: {
    username: "Hash_User",
    password: "",
    passwordHash: {
      version: "pbkdf2-sha256-v1",
      iterations: 120_000,
      salt,
      hash: passwordHash
    },
    role: "member",
    ugpStatus: "approved",
    createdAt: Date.now() - 10_000
  }
};

globalThis.fetch = async (url) => {
  const match = new URL(String(url)).pathname.match(/\/accounts\/([^/]+)\.json$/);
  const account = match ? accounts[decodeURIComponent(match[1])] || null : null;
  return new Response(JSON.stringify(account), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

function post(username, submittedPassword, includeAccount = false) {
  return {
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: submittedPassword, includeAccount }),
    isBase64Encoded: false,
    queryStringParameters: {}
  };
}

function get(username, tokenUsername = username) {
  return {
    httpMethod: "GET",
    headers: { authorization: `Bearer static-firebase:${encodeURIComponent(tokenUsername)}` },
    body: "",
    isBase64Encoded: false,
    queryStringParameters: { username }
  };
}

function body(response) {
  return JSON.parse(response.body || "{}");
}

try {
  const legacy = await handler(post("Legacy_User", password, true));
  assert.equal(legacy.statusCode, 200);
  assert.equal(body(legacy).credentialMode, "legacy");
  assert.equal(body(legacy).account.password, password);

  const hashed = await handler(post("Hash_User", password, true));
  assert.equal(hashed.statusCode, 200);
  assert.equal(body(hashed).credentialMode, "hash");
  assert.equal(body(hashed).account.password, undefined);
  assert.equal(body(hashed).account.passwordHash.hash, passwordHash);

  const wrong = await handler(post("Hash_User", "Wrong-Smoke-Password!"));
  assert.equal(wrong.statusCode, 401);
  assert.equal(body(wrong).detail, "Wrong password.");

  const missing = await handler(post("Missing_User", password));
  assert.equal(missing.statusCode, 401);
  assert.equal(body(missing).detail, "Account not found.");

  const accountRead = await handler(get("Hash_User"));
  assert.equal(accountRead.statusCode, 200);
  assert.equal(body(accountRead).account.username, "Hash_User");

  const mismatchedRead = await handler(get("Hash_User", "Legacy_User"));
  assert.equal(mismatchedRead.statusCode, 401);

  const method = await handler({ ...get("Hash_User"), httpMethod: "DELETE" });
  assert.equal(method.statusCode, 405);

  console.log(JSON.stringify({
    passed: true,
    modes: ["legacy", "pbkdf2"],
    boundaries: ["wrong-password", "missing-account", "token-match", "method"]
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
