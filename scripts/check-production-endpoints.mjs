import assert from "node:assert/strict";

const baseUrl = String(process.argv[2] || "https://learningzone.online").replace(/\/+$/, "");

const [functionResponse, chatMessageResponse, accountLoginResponse, catalogResponse] = await Promise.all([
  fetch(`${baseUrl}/.netlify/functions/save-owner-page?page=chat`, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json" }
  }),
  fetch(`${baseUrl}/.netlify/functions/send-chat-message`, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json" }
  }),
  fetch(`${baseUrl}/.netlify/functions/account-login`, {
    method: "DELETE",
    redirect: "manual",
    headers: { Accept: "application/json" }
  }),
  fetch(`${baseUrl}/games/index.json`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  })
]);

const functionType = String(functionResponse.headers.get("content-type") || "").toLowerCase();
assert.equal(functionResponse.status, 405, "The owner-save function is missing or routed to the SPA shell.");
assert.match(functionType, /application\/json/, "The owner-save health check must return JSON.");
const functionBody = await functionResponse.json();
assert.equal(functionBody.detail, "Method not allowed");

const chatMessageType = String(chatMessageResponse.headers.get("content-type") || "").toLowerCase();
assert.equal(chatMessageResponse.status, 405, "The chat-message function is missing or routed to the SPA shell.");
assert.match(chatMessageType, /application\/json/, "The chat-message health check must return JSON.");
const chatMessageBody = await chatMessageResponse.json();
assert.equal(chatMessageBody.code, "method_not_allowed");

const accountLoginType = String(accountLoginResponse.headers.get("content-type") || "").toLowerCase();
assert.equal(accountLoginResponse.status, 405, "The account-login function is missing or routed to the SPA shell.");
assert.match(accountLoginType, /application\/json/, "The account-login health check must return JSON.");
const accountLoginBody = await accountLoginResponse.json();
assert.equal(accountLoginBody.code, "method_not_allowed");

assert.equal(catalogResponse.status, 200, "The production catalog endpoint is unavailable.");
const catalog = await catalogResponse.json();
assert.ok(Array.isArray(catalog), "The production catalog must remain an array.");
assert.equal(catalog.length, 3989, "The production catalog count changed unexpectedly.");

console.log(JSON.stringify({
  passed: true,
  baseUrl,
  ownerSaveEndpoint: {
    status: functionResponse.status,
    contentType: functionType
  },
  chatMessageEndpoint: {
    status: chatMessageResponse.status,
    contentType: chatMessageType
  },
  accountLoginEndpoint: {
    status: accountLoginResponse.status,
    contentType: accountLoginType
  },
  catalogEntries: catalog.length
}, null, 2));
