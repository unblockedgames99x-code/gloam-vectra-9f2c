import "./browser-runtime/uv/uv.bundle.js?engine=neo-browse-v57";
import "./browser-runtime/uv/uv.config.js?engine=neo-browse-v57";
import "./browser-runtime/uv/uv.sw.js";

const ENGINE_VERSION = "neo-browse-v57";
const ultraviolet = new UVServiceWorker();
const RETRYABLE_METHODS = new Set(["GET", "HEAD"]);
const FALLBACK_TIMEOUT_MS = 8000;
let fallbackRequest = null;

function requestFallbackFromClient() {
  if (fallbackRequest) return fallbackRequest;

  fallbackRequest = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      if (!clients.length) throw new Error("No web client is available.");

      return new Promise((resolve, reject) => {
        let remaining = clients.length;
        let settled = false;
        const timeoutIds = new Set();
        let lastError = new Error("The web fallback was unavailable.");
        const failed = (error) => {
          if (settled) return;
          lastError = error instanceof Error ? error : lastError;
          remaining -= 1;
          if (remaining === 0) {
            settled = true;
            for (const timeoutId of timeoutIds) clearTimeout(timeoutId);
            reject(lastError);
          }
        };
        const succeeded = (transport) => {
          if (settled) return;
          settled = true;
          for (const timeoutId of timeoutIds) clearTimeout(timeoutId);
          resolve(transport);
        };

        for (const client of clients) {
          const channel = new MessageChannel();
          const timeoutId = setTimeout(
            () => failed(new Error("The web fallback response timed out.")),
            FALLBACK_TIMEOUT_MS,
          );
          timeoutIds.add(timeoutId);
          channel.port1.onmessage = (event) => {
            clearTimeout(timeoutId);
            timeoutIds.delete(timeoutId);
            if (event.data?.ok) succeeded(event.data.transport);
            else failed(new Error(event.data?.message || "The web fallback failed."));
          };
          channel.port1.onmessageerror = () => {
            clearTimeout(timeoutId);
            timeoutIds.delete(timeoutId);
            failed(new Error("The web fallback response was invalid."));
          };
          try {
            client.postMessage({ type: "neo-browser:transport-fallback", engine: ENGINE_VERSION }, [
              channel.port2,
            ]);
          } catch (error) {
            clearTimeout(timeoutId);
            timeoutIds.delete(timeoutId);
            failed(error);
          }
        }
      });
    })
    .finally(() => {
      fallbackRequest = null;
    });
  return fallbackRequest;
}

const bareFetch = ultraviolet.bareClient.fetch.bind(ultraviolet.bareClient);
ultraviolet.bareClient.fetch = async (input, options = {}) => {
  try {
    return await bareFetch(input, options);
  } catch (error) {
    const method = String(
      options.method || (input instanceof Request ? input.method : "GET"),
    ).toUpperCase();
    if (!RETRYABLE_METHODS.has(method)) throw error;
    await requestFallbackFromClient();
    return bareFetch(input, options);
  }
};

function isNavigationRequest(request) {
  return request.mode === "navigate" || ["document", "iframe"].includes(request.destination);
}

async function isMissingTransportResponse(response) {
  if (!response || response.status !== 500) return false;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return false;
  const body = await response.clone().text().catch(() => "");
  return /there are no bare clients|No BareTransport was set|wasm not loaded yet|please call libcurl\.load_wasm/i.test(body);
}

async function proxyFetchWithRecovery(event) {
  let response = await ultraviolet.fetch(event);
  if (!isNavigationRequest(event.request) || !(await isMissingTransportResponse(response))) {
    return response;
  }

  try {
    await requestFallbackFromClient();
    response = await ultraviolet.fetch(event);
    if (!(await isMissingTransportResponse(response))) return response;
  } catch (error) {
    // The polished navigation fallback below replaces Ultraviolet's raw error page.
  }
  return navigationError();
}

function navigationError() {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Page unavailable</title><style>` +
      `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#f5f5f7;font:14px system-ui}` +
      `main{max-width:520px;padding:32px;text-align:center}h1{font-size:22px}p{color:#a1a1aa;line-height:1.55}` +
      `</style><main><h1>This page could not be loaded</h1>` +
      `<p>This destination could not be reached. Check the address and try again.</p></main></html>`,
    { status: 502, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "neo-browser:warm") return;
  if (event.data.bareMuxPort instanceof MessagePort) {
    ultraviolet.bareClient = new self.Ultraviolet.BareClient(event.data.bareMuxPort);
  }
  event.ports[0]?.postMessage({ ok: true, engine: ENGINE_VERSION });
});

self.addEventListener("fetch", (event) => {
  if (!ultraviolet.route(event)) return;

  event.respondWith(
    proxyFetchWithRecovery(event).catch(() => {
      if (event.request.mode === "navigate") return navigationError();
      return new Response(null, { status: 502 });
    }),
  );
});
