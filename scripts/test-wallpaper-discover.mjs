import assert from "node:assert/strict";

import { handler } from "../netlify/functions/wallpaper-discover.js";

function workshopHtml() {
  const context = {
    queryData: JSON.stringify({
      queries: [
        {
          state: {
            data: {
              current_page: 2,
              total_pages: 1200,
              total_count: 30123,
              results: [
                {
                  publishedfileid: "3120899076",
                  title: "  Snow &amp; Stars  ",
                  short_description: "A full-resolution animated wallpaper.",
                  preview_url: "https://images.steamusercontent.com/ugc/example/preview/",
                  subscriptions: 12345,
                  favorited: 87,
                  views: 54321,
                  star_rating: 4,
                  time_updated: 1720000000,
                  file_size: 64445882,
                  filename: "snow-and-stars.mp4",
                  file_url: "https://steamusercontent.com/ugc/example/snow-and-stars.mp4",
                  tags: [{ display_name: "Video" }, { display_name: "1920 x 1080" }],
                },
                {
                  publishedfileid: "bad-id",
                  title: "Unsafe",
                  preview_url: "https://example.com/not-allowed.jpg",
                  tags: [],
                },
              ],
            },
          },
        },
      ],
    }),
  };
  return `<script>window.SSR.renderContext=JSON.parse(${JSON.stringify(JSON.stringify(context))}); </script>`;
}

function backupItem(id, title, tags = ["Wallpaper", "Video", "1920 x 1080", "Everyone"]) {
  return {
    i: id,
    t: title,
    p: `https://images.steamusercontent.com/ugc/${id}/PREVIEW/`,
    c: "76561198000000000",
    s: "64445882",
    u: 1720000000,
    r: 0.94,
    v: 54321,
    tg: tags,
  };
}

function backupPayload(items, totalpagecount = 0) {
  return { response: { items, totalpagecount, date: "2026-08-25" } };
}

function commonsPayload() {
  return {
    query: {
      searchinfo: { totalhits: 120 },
      pages: [
        {
          pageid: 180974155,
          title: "File:Waterfall &amp; stars.webm",
          index: 1,
          videoinfo: [{
            size: 16357613,
            width: 3840,
            height: 2160,
            duration: 7.01,
            thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/waterfall-640.jpg",
            responsiveUrls: { "2": "https://upload.wikimedia.org/wikipedia/commons/thumb/waterfall-1280.jpg" },
            url: "https://upload.wikimedia.org/wikipedia/commons/waterfall-4k.webm",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Waterfall.webm",
            mime: "video/webm",
            extmetadata: {
              ImageDescription: { value: "<b>A looping waterfall.</b>" },
              Artist: { value: "<a>Example Artist</a>" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
              Categories: { value: "Waterfalls|Time-lapse videos" },
            },
            derivatives: [{
              src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/waterfall.360p.webm",
              type: 'video/webm; codecs="vp9, opus"',
              width: 640,
              height: 360,
              bandwidth: 400000,
            }, {
              src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/waterfall.1080p.vp9.webm",
              type: 'video/webm; codecs="vp9, opus"',
              width: 1920,
              height: 1080,
            }],
          }],
        },
        {
          pageid: 2,
          title: "File:Too small.webm",
          index: 2,
          videoinfo: [{
            width: 1280,
            height: 720,
            duration: 5,
            thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/small.jpg",
            url: "https://upload.wikimedia.org/wikipedia/commons/small.webm",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Small.webm",
            mime: "video/webm",
            derivatives: [],
          }],
        },
      ],
    },
  };
}

function commonsVideoPage(id, title, description, categories) {
  const page = structuredClone(commonsPayload().query.pages[0]);
  page.pageid = id;
  page.title = `File:${title}.webm`;
  page.videoinfo[0].thumburl = `https://upload.wikimedia.org/wikipedia/commons/thumb/${id}-640.jpg`;
  page.videoinfo[0].responsiveUrls = { "2": `https://upload.wikimedia.org/wikipedia/commons/thumb/${id}-1280.jpg` };
  page.videoinfo[0].url = `https://upload.wikimedia.org/wikipedia/commons/${id}-4k.webm`;
  page.videoinfo[0].descriptionurl = `https://commons.wikimedia.org/wiki/File:${id}.webm`;
  page.videoinfo[0].derivatives[0].src = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${id}.360p.webm`;
  page.videoinfo[0].derivatives[1].src = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${id}.1080p.vp9.webm`;
  page.videoinfo[0].extmetadata.ImageDescription.value = description;
  page.videoinfo[0].extmetadata.Categories.value = categories;
  return page;
}

const originalFetch = globalThis.fetch;
let requestedUrls = [];

try {
  globalThis.fetch = async (url, options = {}) => {
    const requestedUrl = new URL(String(url));
    requestedUrls.push({ url: requestedUrl, options });
    if (requestedUrl.hostname === "www.wallpaperengineapi.com") {
      const query = requestedUrl.searchParams.get("text") || "";
      const items = query === "zzzxxyyunlikely"
        ? []
        : query === "cal of duty"
          ? []
          : query === "duty"
            ? [backupItem("4000000002", "Call of Duty - Modern Warfare 2"), backupItem("4000000003", "Daily Duty Planner")]
        : query === "shrek"
        ? [backupItem("3280544405", "Miku x Shrek"), backupItem("1950351365", "Shrek plays the saxophone")]
        : query === "minecraft snow"
          ? [backupItem("3120899076", "Snow & Stars")]
          : [backupItem("4000000001", "Popular animated wallpaper")];
      const totalPageCount = query === "minecraft snow" ? 1 : (query ? 0 : 99);
      return { ok: true, json: async () => backupPayload(items, totalPageCount) };
    }
    if (requestedUrl.hostname === "commons.wikimedia.org") {
      return { ok: true, json: async () => commonsPayload() };
    }
    if (requestedUrl.hostname === "api.steampowered.com") {
      return {
        ok: true,
        json: async () => ({
          response: {
            publishedfiledetails: [{
              publishedfileid: "3120899076",
              filename: "snow-and-stars.mp4",
              file_url: "https://steamusercontent.com/ugc/example/snow-and-stars.mp4",
              file_size: 64445882,
            }],
          },
        }),
      };
    }
    return { ok: true, text: async () => workshopHtml() };
  };

  const result = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      source: "workshop",
      q: "  minecraft   snow  ",
      sort: "relevance",
      type: "video",
      page: "2",
    },
  });
  const payload = JSON.parse(result.body);

  assert.equal(result.statusCode, 200);
  assert.equal(payload.page, 2);
  assert.equal(payload.totalPages, 2);
  assert.equal(payload.total, 100);
  assert.equal(payload.count, 1);
  assert.equal(payload.items[0].id, "3120899076");
  assert.equal(payload.items[0].title, "Snow & Stars");
  assert.equal(payload.items[0].type, "video");
  assert.equal(payload.items[0].browserPlayable, true);
  assert.equal(payload.items[0].downloadMime, "video/mp4");
  assert.equal(payload.items[0].downloadUrl, "https://steamusercontent.com/ugc/example/snow-and-stars.mp4");
  assert.equal(payload.items[0].compatibility, "browser-media");
  const catalogRequest = requestedUrls.find((request) => request.url.hostname === "www.wallpaperengineapi.com");
  const detailsRequest = requestedUrls.find((request) => request.url.hostname === "api.steampowered.com");
  assert.equal(catalogRequest.url.searchParams.get("sort"), "relevance");
  assert.equal(catalogRequest.url.searchParams.get("text"), "minecraft snow");
  assert.equal(catalogRequest.url.searchParams.get("requiredTags"), "Video");
  assert.equal(catalogRequest.url.searchParams.get("page"), "2");
  assert.equal(detailsRequest.options.method, "POST");
  assert.match(detailsRequest.options.body, /publishedfileids%5B0%5D=3120899076/);

  requestedUrls = [];
  const discoverDefaultResult = await handler({
    httpMethod: "GET",
    queryStringParameters: { source: "discover", q: "", sort: "popular", page: "1" },
  });
  const discoverDefault = JSON.parse(discoverDefaultResult.body);
  assert.equal(discoverDefaultResult.statusCode, 200);
  assert.equal(discoverDefault.catalogMode, "browser-ready");
  assert.equal(discoverDefault.source, "Wikimedia Commons");
  assert.equal(discoverDefault.sort, "popular");
  assert.equal(discoverDefault.page, 1);
  assert.equal(discoverDefault.pageSize, 30);
  assert.equal(discoverDefault.count, 1);
  assert.equal(discoverDefault.items.every((item) => item.browserPlayable === true && Boolean(item.downloadUrl)), true);
  assert.equal(requestedUrls.some((request) => request.url.hostname === "www.wallpaperengineapi.com"), false);
  assert.ok(requestedUrls.some((request) => request.url.hostname === "commons.wikimedia.org"));

  requestedUrls = [];
  const fullDiscoverSearchResult = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      source: "workshop",
      q: "shrek",
      sort: "featured",
      page: "1",
    },
  });
  const fullDiscoverSearch = JSON.parse(fullDiscoverSearchResult.body);
  assert.equal(fullDiscoverSearchResult.statusCode, 200);
  assert.equal(fullDiscoverSearch.source, "Wallpaper Engine Workshop");
  assert.equal(fullDiscoverSearch.catalogMode, "workshop");
  assert.equal(fullDiscoverSearch.total, 2);
  assert.equal(fullDiscoverSearch.count, 2);
  assert.deepEqual(fullDiscoverSearch.items.map((item) => item.title), ["Miku x Shrek", "Shrek plays the saxophone"]);
  assert.equal(fullDiscoverSearch.items.every((item) => item.browserPlayable === false), true);
  const fullSearchRequest = requestedUrls.find((request) => request.url.hostname === "www.wallpaperengineapi.com");
  assert.ok(fullSearchRequest);
  assert.equal(fullSearchRequest.url.searchParams.get("text"), "shrek");
  assert.equal(requestedUrls.some((request) => request.url.hostname === "steamcommunity.com"), false);

  requestedUrls = [];
  const noExactResult = await handler({
    httpMethod: "GET",
    queryStringParameters: { source: "workshop", q: "zzzxxyyunlikely", sort: "relevance", page: "1" },
  });
  const noExact = JSON.parse(noExactResult.body);
  assert.equal(noExactResult.statusCode, 200);
  assert.equal(noExact.fallback, true);
  assert.equal(noExact.exactCount, 0);
  assert.equal(noExact.count, 1);
  assert.equal(noExact.items[0].matchKind, "fallback");
  assert.equal(noExact.items[0].title, "Popular animated wallpaper");
  const fallbackRequests = requestedUrls.filter((request) => request.url.hostname === "www.wallpaperengineapi.com");
  assert.equal(fallbackRequests.length, 3);
  assert.equal(fallbackRequests[0].url.searchParams.get("text"), "zzzxxyyunlikely");
  assert.equal(fallbackRequests[1].url.searchParams.get("text"), "zzzxx");
  assert.equal(fallbackRequests[2].url.searchParams.has("text"), false);

  requestedUrls = [];
  const recoveredTypoResult = await handler({
    httpMethod: "GET",
    queryStringParameters: { source: "workshop", q: "cal of duty", sort: "relevance", page: "1" },
  });
  const recoveredTypo = JSON.parse(recoveredTypoResult.body);
  assert.equal(recoveredTypoResult.statusCode, 200);
  assert.equal(recoveredTypo.fallback, false);
  assert.equal(recoveredTypo.recovered, true);
  assert.equal(recoveredTypo.recoveryQuery, "duty");
  assert.equal(recoveredTypo.count, 1);
  assert.equal(recoveredTypo.items[0].title, "Call of Duty - Modern Warfare 2");
  assert.equal(recoveredTypo.items[0].matchKind, "related");
  const typoCatalogRequests = requestedUrls.filter((request) => request.url.hostname === "www.wallpaperengineapi.com");
  assert.deepEqual(typoCatalogRequests.map((request) => request.url.searchParams.get("text")), ["cal of duty", "duty"]);

  requestedUrls = [];
  const discoverResult = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      source: "discover",
      q: "waterfall",
      sort: "recent",
      type: "video",
      catalog: "browser-ready",
      page: "1",
    },
  });
  const discover = JSON.parse(discoverResult.body);
  assert.equal(discoverResult.statusCode, 200);
  assert.equal(discover.source, "Wikimedia Commons");
  assert.equal(discover.pageSize, 30);
  assert.equal(discover.totalPages, 4);
  assert.equal(discover.count, 1);
  assert.equal(discover.items[0].installId, "commons-180974155");
  assert.equal(discover.items[0].title, "Waterfall & stars");
  assert.equal(discover.items[0].author, "Example Artist");
  assert.equal(discover.items[0].license, "CC BY-SA 4.0");
  assert.equal(discover.items[0].width, 3840);
  assert.equal(discover.items[0].height, 2160);
  assert.equal(discover.items[0].qualityLabel, "4K");
  assert.equal(discover.items[0].browserPlayable, true);
  assert.match(discover.items[0].downloadUrl, /waterfall-4k\.webm$/);
  assert.equal(discover.items[0].downloadSources.length, 2);
  assert.match(discover.items[0].previewVideoUrl, /\.360p\.webm$/);
  assert.equal(discover.items[0].previewVideoMime, "video/webm");
  assert.ok(discover.items[0].downloadSources.every((source) => source.width >= 1920 && source.height >= 1080));
  assert.match(discover.items[0].searchableText, /Waterfall & stars/);
  const commonsRequest = requestedUrls.find((request) => request.url.hostname === "commons.wikimedia.org");
  assert.equal(commonsRequest.url.searchParams.get("gsrsearch"), "filetype:video filew:>1919 fileh:>1079 intitle:waterfall");
  assert.equal(commonsRequest.url.searchParams.get("gsrsort"), "create_timestamp_desc");
  assert.match(commonsRequest.url.searchParams.get("viprop"), /derivatives/);

  requestedUrls = [];
  const typoResult = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      source: "discover",
      q: "spcae",
      sort: "relevance",
      type: "video",
      catalog: "browser-ready",
      page: "1",
    },
  });
  assert.equal(typoResult.statusCode, 200);
  const typoRequest = requestedUrls.find((request) => request.url.hostname === "commons.wikimedia.org");
  assert.equal(typoRequest.url.searchParams.get("gsrsearch"), "filetype:video filew:>1919 fileh:>1079 intitle:space");

  requestedUrls = [];
  globalThis.fetch = async (url, options = {}) => {
    const requestedUrl = new URL(String(url));
    requestedUrls.push({ url: requestedUrl, options });
    const searchText = requestedUrl.searchParams.get("gsrsearch");
    const strict = searchText.includes("intitle:minecraft");
    const related = searchText.includes("intitle:snow");
    return {
      ok: true,
      json: async () => ({
        query: {
          searchinfo: { totalhits: strict ? 2 : related ? 2 : 80 },
          pages: strict
            ? [
                commonsVideoPage(101, "Minecraft Trails", "Minecraft animation", "Videos of Minecraft"),
                commonsVideoPage(102, "Minecraft Snow", "Minecraft landscape", "Videos of Minecraft"),
              ]
            : related
              ? [
                  commonsVideoPage(201, "Snow clouds", "A winter landscape", "Snow"),
                  commonsVideoPage(202, "Mountain snow", "A snowy mountain", "Snow"),
                ]
            : [
                commonsVideoPage(101, "Minecraft Trails", "Minecraft animation", "Videos of Minecraft"),
                commonsVideoPage(103, "Xbox showcase", "Includes a Minecraft world segment", "Videos of Minecraft"),
                commonsVideoPage(104, "Unrelated performance", "A stage recording", "Performance art"),
              ],
        },
      }),
    };
  };
  const expandedResult = await handler({
    httpMethod: "GET",
    queryStringParameters: { source: "discover", q: "minecraft", sort: "relevance", type: "video", catalog: "browser-ready", page: "1" },
  });
  const expanded = JSON.parse(expandedResult.body);
  assert.equal(expandedResult.statusCode, 200);
  assert.equal(expanded.count, 3);
  assert.equal(expanded.total, 3);
  assert.equal(expanded.totalPages, 1);
  assert.equal(expanded.exactCount, 3);
  assert.equal(expanded.relatedCount, 0);
  assert.deepEqual(expanded.items.map((item) => item.id), ["101", "102", "103"]);
  assert.equal(expanded.items.some((item) => item.id === "104"), false);
  assert.equal(requestedUrls.length, 2);
  assert.equal(requestedUrls[1].url.searchParams.get("gsrlimit"), "120");
  assert.equal(requestedUrls[1].url.searchParams.get("gsrsearch"), "filetype:video filew:>1919 fileh:>1079 minecraft");

  requestedUrls = [];
  globalThis.fetch = async (url, options = {}) => {
    const requestedUrl = new URL(String(url));
    requestedUrls.push({ url: requestedUrl, options });
    const searchText = requestedUrl.searchParams.get("gsrsearch") || "";
    if (searchText.includes("zzzxxyyfullfile")) {
      return {
        ok: true,
        json: async () => ({ query: { searchinfo: { totalhits: 0 }, pages: [] } }),
      };
    }
    return { ok: true, json: async () => commonsPayload() };
  };
  const downloadableFallbackResult = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      source: "discover",
      q: "zzzxxyyfullfile",
      sort: "relevance",
      type: "video",
      catalog: "browser-ready",
      page: "1",
    },
  });
  const downloadableFallback = JSON.parse(downloadableFallbackResult.body);
  assert.equal(downloadableFallbackResult.statusCode, 200);
  assert.equal(downloadableFallback.catalogMode, "browser-ready");
  assert.equal(downloadableFallback.fallback, true);
  assert.equal(downloadableFallback.exactCount, 0);
  assert(downloadableFallback.items.length > 0);
  assert(downloadableFallback.items.every((item) => item.browserPlayable === true));
  assert(downloadableFallback.items.every((item) => item.matchKind === "fallback"));
  assert(requestedUrls.some((request) => !(request.url.searchParams.get("gsrsearch") || "").includes("zzzxxyyfullfile")));

  const methodResult = await handler({ httpMethod: "POST", queryStringParameters: {} });
  assert.equal(methodResult.statusCode, 405);

  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => "" });
  const unavailable = await handler({
    httpMethod: "GET",
    queryStringParameters: { source: "discover", q: "temporary outage", sort: "rated", page: "1" },
  });
  const unavailablePayload = JSON.parse(unavailable.body);
  assert.equal(unavailable.statusCode, 200);
  assert.equal(unavailablePayload.catalogMode, "browser-ready");
  assert.equal(unavailablePayload.fallback, true);
  assert.equal(unavailablePayload.stale, true);
  assert(unavailablePayload.items.every((item) => item.browserPlayable === true && Boolean(item.downloadUrl)));

  globalThis.fetch = async () => ({ ok: true, text: async () => "not a workshop catalog" });
  const malformed = await handler({
    httpMethod: "GET",
    queryStringParameters: { source: "workshop", q: "malformed catalog", sort: "rated", page: "1" },
  });
  assert.equal(malformed.statusCode, 502);
  assert.equal(JSON.parse(malformed.body).code, "catalog_unavailable");

  console.log("Wallpaper Discover checks passed.");
} finally {
  globalThis.fetch = originalFetch;
}
