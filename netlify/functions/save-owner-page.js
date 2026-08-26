"use strict";

var FIREBASE_ROOT = "https://taco-chat-c1539-default-rtdb.firebaseio.com/rooms/_deluxeAppState/state";
var ALLOWED_PAGES = new Set(["chat", "community", "gamemaker", "party"]);
var OWNER_USERNAMES = new Set(["carterb", "london", "ryanh"]);
var MAX_HTML_BYTES = 4_500_000;

function jsonResponse(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/[.#$/[\]@\s]/g, "");
}

function readBearerToken(headers) {
  var authorization = String((headers && (headers.authorization || headers.Authorization)) || "");
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

async function isOwner(username, signal) {
  if (OWNER_USERNAMES.has(username)) return true;

  var response = await fetch(FIREBASE_ROOT + "/accounts/" + encodeURIComponent(username) + ".json", {
    cache: "no-store",
    signal: signal
  });
  if (!response.ok) return false;

  var account = await response.json();
  var badges = account && Array.isArray(account.badges) ? account.badges : [];
  return Boolean(account && (
    String(account.role || "").toLowerCase() === "owner" ||
    badges.some(function (badge) { return String(badge).toLowerCase() === "owner"; })
  ));
}

export async function handler(event) {
  if (event.httpMethod !== "PUT") {
    return jsonResponse(405, { detail: "Method not allowed" });
  }

  var page = String((event.queryStringParameters && event.queryStringParameters.page) || "").toLowerCase();
  if (!ALLOWED_PAGES.has(page)) {
    return jsonResponse(400, { detail: "Unknown page" });
  }

  var token = readBearerToken(event.headers);
  if (!token.startsWith("static-firebase:")) {
    return jsonResponse(401, { detail: "Please sign in again" });
  }

  var username;
  try {
    username = normalizeUsername(decodeURIComponent(token.slice("static-firebase:".length)));
  } catch (error) {
    return jsonResponse(401, { detail: "Invalid session" });
  }

  var rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : String(event.body || "");
  if (Buffer.byteLength(rawBody, "utf8") > MAX_HTML_BYTES) {
    return jsonResponse(413, { detail: "Page HTML is too large" });
  }

  var html;
  try {
    var parsed = JSON.parse(rawBody || "\"\"");
    html = typeof parsed === "string" ? parsed : String((parsed && parsed.html) || "");
  } catch (error) {
    return jsonResponse(400, { detail: "Invalid page HTML payload" });
  }

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 25_000);
  try {
    if (!(await isOwner(username, controller.signal))) {
      return jsonResponse(403, { detail: "Owner access required" });
    }

    var firebaseResponse = await fetch(
      FIREBASE_ROOT + "/ultimateGameStash/pages/" + encodeURIComponent(page) + ".json?print=silent",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(html),
        signal: controller.signal
      }
    );

    if (!firebaseResponse.ok) {
      return jsonResponse(502, { detail: "Page storage rejected the save" });
    }

    return {
      statusCode: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Learning-Zones-Saved-Page": page
      },
      body: ""
    };
  } catch (error) {
    if (error && error.name === "AbortError") {
      return jsonResponse(504, { detail: "Page save timed out" });
    }
    return jsonResponse(500, { detail: "Could not save page HTML" });
  } finally {
    clearTimeout(timer);
  }
}
