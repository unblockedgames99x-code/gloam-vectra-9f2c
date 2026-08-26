"use strict";

var DEEZER_API_ROOT = "https://api.deezer.com/track/isrc:";
var ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

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

function safePreviewUrl(value) {
  try {
    var url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    if (url.hostname !== "dzcdn.net" && !url.hostname.endsWith(".dzcdn.net")) return "";
    return url.href;
  } catch (error) {
    return "";
  }
}

export async function handler(event) {
  var method = String(event.httpMethod || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return jsonResponse(405, { code: "method_not_allowed", detail: "Method not allowed" });
  }

  var isrc = String((event.queryStringParameters && event.queryStringParameters.isrc) || "").trim().toUpperCase();
  if (!ISRC_PATTERN.test(isrc)) {
    return jsonResponse(400, { code: "invalid_isrc", detail: "A valid track identifier is required." });
  }

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 4_500);
  try {
    var response = await fetch(DEEZER_API_ROOT + encodeURIComponent(isrc), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      return jsonResponse(response.status === 404 ? 404 : 502, {
        code: "preview_unavailable",
        detail: "A playable preview is not available for this track."
      });
    }

    var track = await response.json();
    var preview = safePreviewUrl(track && track.preview);
    if (!preview || track.readable === false) {
      return jsonResponse(404, {
        code: "preview_unavailable",
        detail: "A playable preview is not available for this track."
      });
    }

    return {
      statusCode: 307,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
        Location: preview,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      },
      body: ""
    };
  } catch (error) {
    if (error && error.name === "AbortError") {
      return jsonResponse(504, { code: "preview_timeout", detail: "The preview service took too long to respond." });
    }
    return jsonResponse(502, { code: "preview_unavailable", detail: "The preview service could not be reached." });
  } finally {
    clearTimeout(timer);
  }
}
