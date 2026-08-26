import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handler } from "../netlify/functions/account-register.js";

const originalFetch = globalThis.fetch;

function event(username, password, address) {
  return {
    httpMethod: "POST",
    headers: { "x-forwarded-for": address },
    body: JSON.stringify({ username, password }),
    isBase64Encoded: false
  };
}

try {
  let writtenAccount = null;
  globalThis.fetch = async (_url, options = {}) => {
    if (!options.method) {
      return new Response("null", { status: 200, headers: { etag: '"null_etag"', "content-type": "application/json" } });
    }
    writtenAccount = JSON.parse(options.body);
    assert.equal(options.headers["If-Match"], '"null_etag"');
    return new Response(JSON.stringify(writtenAccount), { status: 200, headers: { "content-type": "application/json" } });
  };

  const created = await handler(event("NeoTester_47", "correct-horse-battery", "registration-test-success"));
  const createdBody = JSON.parse(created.body);
  assert.equal(created.statusCode, 201);
  assert.equal(createdBody.user.username, "NeoTester_47");
  assert.equal(writtenAccount.password, "");
  assert.equal(writtenAccount.passwordHash.version, "pbkdf2-sha256-v1");
  assert.ok(writtenAccount.passwordHash.iterations >= 120_000);
  assert.notEqual(writtenAccount.passwordHash.hash, "correct-horse-battery");

  globalThis.fetch = async () => new Response(JSON.stringify({ username: "TakenUser" }), {
    status: 200,
    headers: { etag: '"existing"', "content-type": "application/json" }
  });
  const duplicate = await handler(event("TakenUser", "another-secure-password", "registration-test-duplicate"));
  assert.equal(duplicate.statusCode, 409);
  assert.equal(JSON.parse(duplicate.body).code, "username_taken");

  const invalid = await handler(event("bad name", "another-secure-password", "registration-test-invalid"));
  assert.equal(invalid.statusCode, 400);
  assert.equal(JSON.parse(invalid.body).code, "invalid_username");

  const signInSource = await readFile(new URL("../neo-os/neo-account-signin.js", import.meta.url), "utf8");
  const previewServerSource = await readFile(new URL("../local-preview-server.mjs", import.meta.url), "utf8");
  assert.match(signInSource, /window\.location\.protocol === "file:"/);
  assert.match(signInSource, /http:\/\/127\.0\.0\.1:4195/);
  assert.match(previewServerSource, /Access-Control-Allow-Private-Network/);
  assert.match(previewServerSource, /origin === "null"/);

  console.log("NEO registration checks passed: create, duplicate, validation, hashed storage, and local preview transport.");
} finally {
  globalThis.fetch = originalFetch;
}
