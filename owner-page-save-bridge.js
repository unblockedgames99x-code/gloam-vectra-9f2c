(function () {
  "use strict";

  if (window.__learningZonesOwnerSaveBridge) return;
  window.__learningZonesOwnerSaveBridge = true;

  var originalFetch = window.fetch.bind(window);
  var pageSavePattern = /^https:\/\/taco-chat-c1539-default-rtdb\.firebaseio\.com\/rooms\/_deluxeAppState\/state\/ultimateGameStash\/pages\/(chat|community|gamemaker|party)\.json(?:\?.*)?$/i;

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var match = method === "PUT" && typeof url === "string" ? url.match(pageSavePattern) : null;

    if (!match) return originalFetch(input, init);

    var token = "";
    try {
      token = localStorage.getItem("ugp_token") || "";
    } catch (error) {}

    return originalFetch("/.netlify/functions/save-owner-page?page=" + encodeURIComponent(match[1].toLowerCase()), {
      method: "PUT",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: init && init.body != null ? init.body : "\"\""
    }).then(function (response) {
      var contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
      if (response.status === 200 && contentType.indexOf("text/html") >= 0) {
        return new Response(JSON.stringify({ detail: "Owner save service is unavailable" }), {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8"
          }
        });
      }
      return response;
    });
  };
})();
