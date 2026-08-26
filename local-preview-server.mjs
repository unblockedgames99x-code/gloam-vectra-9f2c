import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handler as accountLogin } from "./netlify/functions/account-login.js";
import { handler as accountRegister } from "./netlify/functions/account-register.js";
import { handler as chatState } from "./netlify/functions/chat-state.js";
import { handler as createChatRoom } from "./netlify/functions/create-chat-room.js";
import { handler as musicPreview } from "./netlify/functions/music-preview.js";
import { handler as searchChatUsers } from "./netlify/functions/search-chat-users.js";
import { handler as sendChatMessage } from "./netlify/functions/send-chat-message.js";
import { handler as wallpaperDiscover } from "./netlify/functions/wallpaper-discover.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const portFlagIndex = process.argv.indexOf("--port");
const port =
  portFlagIndex >= 0 && process.argv[portFlagIndex + 1]
    ? Number(process.argv[portFlagIndex + 1])
    : Number(process.env.PORT || 4188);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".wasm", "application/wasm"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(root, normalized);
}

function sendFile(req, res, filePath, cache = "no-cache") {
  const ext = path.extname(filePath).toLowerCase();
  const size = statSync(filePath).size;
  const headers = {
    "Content-Type": types.get(ext) || "application/octet-stream",
    "Cache-Control": cache,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = match && match[1] ? Number(match[1]) : NaN;
    let end = match && match[2] ? Number(match[2]) : NaN;

    if (match && Number.isNaN(start) && Number.isFinite(end)) {
      start = Math.max(0, size - end);
      end = size - 1;
    } else {
      if (!Number.isFinite(start)) start = 0;
      if (!Number.isFinite(end)) end = size - 1;
    }

    if (!match || start < 0 || end < start || start >= size) {
      res.writeHead(416, {
        ...headers,
        "Content-Length": 0,
        "Content-Range": `bytes */${size}`,
      });
      res.end();
      return;
    }

    end = Math.min(end, size - 1);
    res.writeHead(206, {
      ...headers,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`,
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, headers);
  if (req.method === "HEAD") res.end();
  else createReadStream(filePath).pipe(res);
}

async function readRequestBody(req, maxBytes = 8_192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function localFunctionCorsHeaders(req) {
  const origin = String(req.headers.origin || "");
  const allowed = origin === "null" || /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
  if (!allowed) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

    if (requestUrl.pathname === "/.netlify/functions/wallpaper-discover") {
      const result = await wallpaperDiscover({
        httpMethod: req.method || "GET",
        queryStringParameters: Object.fromEntries(requestUrl.searchParams),
      });
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }

    if (requestUrl.pathname === "/.netlify/functions/music-preview") {
      const result = await musicPreview({
        httpMethod: req.method || "GET",
        headers: req.headers,
        queryStringParameters: Object.fromEntries(requestUrl.searchParams),
      });
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }

    if (requestUrl.pathname === "/.netlify/functions/account-login" || requestUrl.pathname === "/.netlify/functions/account-register") {
      const corsHeaders = localFunctionCorsHeaders(req);
      if (req.method === "OPTIONS") {
        if (!corsHeaders) {
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Origin not allowed");
          return;
        }
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }
      let body = "";
      try {
        body = req.method === "POST" ? await readRequestBody(req) : "";
      } catch (error) {
        res.writeHead(413, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          ...(corsHeaders || {}),
        });
        res.end(JSON.stringify({ code: "auth_too_large", detail: "Account request is too large." }));
        return;
      }
      const accountHandler = requestUrl.pathname.endsWith("account-register") ? accountRegister : accountLogin;
      const result = await accountHandler({
        httpMethod: req.method || "GET",
        headers: req.headers,
        body,
        isBase64Encoded: false,
        queryStringParameters: Object.fromEntries(requestUrl.searchParams),
      });
      res.writeHead(result.statusCode, { ...result.headers, ...(corsHeaders || {}) });
      res.end(result.body);
      return;
    }

    if (requestUrl.pathname === "/.netlify/functions/search-chat-users") {
      const corsHeaders = localFunctionCorsHeaders(req);
      if (req.method === "OPTIONS") {
        if (!corsHeaders) {
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Origin not allowed");
          return;
        }
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }
      const result = await searchChatUsers({
        httpMethod: req.method || "GET",
        headers: req.headers,
        queryStringParameters: Object.fromEntries(requestUrl.searchParams),
      });
      res.writeHead(result.statusCode, { ...result.headers, ...(corsHeaders || {}) });
      res.end(result.body);
      return;
    }

    if (requestUrl.pathname === "/.netlify/functions/chat-state") {
      const corsHeaders = localFunctionCorsHeaders(req);
      if (req.method === "OPTIONS") {
        if (!corsHeaders) {
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Origin not allowed");
          return;
        }
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }
      const result = await chatState({
        httpMethod: req.method || "GET",
        headers: req.headers,
        queryStringParameters: Object.fromEntries(requestUrl.searchParams),
      });
      res.writeHead(result.statusCode, { ...result.headers, ...(corsHeaders || {}) });
      res.end(result.body);
      return;
    }

    if (requestUrl.pathname === "/.netlify/functions/send-chat-message" || requestUrl.pathname === "/.netlify/functions/create-chat-room") {
      const corsHeaders = localFunctionCorsHeaders(req);
      if (req.method === "OPTIONS") {
        if (!corsHeaders) {
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Origin not allowed");
          return;
        }
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }
      let body = "";
      try {
        body = req.method === "POST" ? await readRequestBody(req) : "";
      } catch (error) {
        res.writeHead(413, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          ...(corsHeaders || {}),
        });
        res.end(JSON.stringify({ code: "message_too_large", detail: "Message is too large." }));
        return;
      }
      const chatHandler = requestUrl.pathname.endsWith("create-chat-room") ? createChatRoom : sendChatMessage;
      const result = await chatHandler({
        httpMethod: req.method || "GET",
        headers: req.headers,
        body,
        isBase64Encoded: false,
        queryStringParameters: Object.fromEntries(requestUrl.searchParams),
      });
      res.writeHead(result.statusCode, { ...result.headers, ...(corsHeaders || {}) });
      res.end(result.body);
      return;
    }

    let filePath = safePath(requestUrl.pathname);

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(req, res, filePath, "no-cache");
      return;
    }

    const hasExtension = path.extname(requestUrl.pathname) !== "";
    if (hasExtension) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const appShell = await readFile(path.join(root, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(appShell);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Preview server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`LearningZone preview running at http://127.0.0.1:${port}`);
  console.log(`SPA routes like http://127.0.0.1:${port}/login now work locally.`);
});
