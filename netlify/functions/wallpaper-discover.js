"use strict";

var STEAM_WORKSHOP_APP_ID = "431960";
var MAX_RESULTS = 30;
var MAX_PAGE = 1000;
var COMMONS_API = "https://commons.wikimedia.org/w/api.php";
var WALLPAPER_ENGINE_API = "https://www.wallpaperengineapi.com/api/backupquery/v1";
var WALLPAPER_ENGINE_PAGE_SIZE = 50;
var COMMONS_RESULTS = 30;
var COMMONS_MAX_PAGE = 200;
var COMMONS_MAX_FILE_SIZE = 512 * 1024 * 1024;
var COMMONS_CACHE_TTL = 10 * 60 * 1000;
var COMMONS_STALE_TTL = 6 * 60 * 60 * 1000;
var commonsCache = new Map();
var COMMONS_FALLBACK_CACHE_KEY = "v5|last-known-good";
var COMMONS_DEFAULT_SEARCH = "(4K OR UHD OR 2160p OR 1080p) (timelapse OR animation OR loop OR aerial)";
var DISCOVER_TOPICS = {
  abstract: ["abstract", "fractal", "particles", "generative"],
  calm: ["calm", "relaxing", "clouds", "sunset"],
  cars: ["car", "automotive", "racing"],
  city: ["city", "skyline", "urban"],
  nature: ["nature", "landscape", "forest", "mountain"],
  ocean: ["ocean", "sea", "underwater", "waves"],
  rain: ["rain", "rainfall", "storm"],
  space: ["space", "nebula", "planet", "astronomy"]
};
var DISCOVER_WORDS = Object.keys(DISCOVER_TOPICS).concat([
  "aerial", "animation", "clouds", "forest", "landscape", "mountain", "night", "snow", "sunset", "waterfall"
]);
var SORTS = {
  featured: { mode: "trend", days: "7" },
  popular: { mode: "mostsubscribed" },
  rated: { mode: "toprated" },
  recent: { mode: "mostrecent" },
  updated: { mode: "lastupdated" },
  relevance: { mode: "textsearch" }
};
var TYPE_TAGS = {
  scene: "Scene",
  video: "Video",
  web: "Web",
  application: "Application",
  image: "Image",
  preview: "Preview"
};
var COMMONS_SORTS = {
  recent: "create_timestamp_desc",
  updated: "last_edit_desc",
  popular: "incoming_links_desc"
};
var WALLPAPER_ENGINE_SORTS = {
  featured: "trend_week",
  popular: "subscriptions",
  rated: "top_rated",
  recent: "most_recent",
  updated: "most_recent",
  relevance: "relevance"
};

function response(statusCode, payload, cacheControl) {
  return {
    statusCode: statusCode,
    headers: {
      "Cache-Control": cacheControl || "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    body: JSON.stringify(payload)
  };
}

function commonsCacheKey(sort, page, search) {
  return ["v5", sort, page, safeText(search, 120).toLowerCase()].join("|");
}

function readCommonsCache(key, maxAge) {
  var entry = commonsCache.get(key);
  if (!entry || Date.now() - entry.savedAt > maxAge) return null;
  commonsCache.delete(key);
  commonsCache.set(key, entry);
  return entry.payload;
}

function writeCommonsCache(key, payload) {
  if (commonsCache.has(key)) commonsCache.delete(key);
  commonsCache.set(key, { savedAt: Date.now(), payload: payload });
  while (commonsCache.size > 80) commonsCache.delete(commonsCache.keys().next().value);
}

function decodeHtml(value) {
  var names = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, function (match, entity) {
    var lowered = entity.toLowerCase();
    if (names[lowered]) return names[lowered];
    var code = lowered.indexOf("#x") === 0 ? parseInt(lowered.slice(2), 16) : parseInt(lowered.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  });
}

function safeText(value, limit) {
  return decodeHtml(value).replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeMetadataText(value, limit) {
  return safeText(String(value || "").replace(/<[^>]*>/g, " "), limit);
}

function safeNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function safePreview(value) {
  try {
    var url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "images.steamusercontent.com") return "";
    return url.toString();
  } catch (_error) {
    return "";
  }
}

function safeCommonsAsset(value) {
  try {
    var url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org") return "";
    return url.toString();
  } catch (_error) {
    return "";
  }
}

function safeCommonsPage(value) {
  try {
    var url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "commons.wikimedia.org") return "";
    return url.toString();
  } catch (_error) {
    return "";
  }
}

function editDistanceAtMostOne(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    var mismatch = [];
    for (var index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatch.push(index);
      if (mismatch.length > 2) return false;
    }
    return mismatch.length <= 1 || (mismatch.length === 2
      && mismatch[1] === mismatch[0] + 1
      && left[mismatch[0]] === right[mismatch[1]]
      && left[mismatch[1]] === right[mismatch[0]]);
  }
  var longer = left.length >= right.length ? left : right;
  var shorter = left.length >= right.length ? right : left;
  var longIndex = 0;
  var shortIndex = 0;
  var edits = 0;
  while (longIndex < longer.length && shortIndex < shorter.length) {
    if (longer[longIndex] === shorter[shortIndex]) {
      longIndex += 1;
      shortIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    longIndex += 1;
  }
  return true;
}

function correctedDiscoverWord(word) {
  if (word.length < 4 || DISCOVER_WORDS.indexOf(word) !== -1) return word;
  return DISCOVER_WORDS.find(function (candidate) {
    return editDistanceAtMostOne(word, candidate);
  }) || word;
}

function discoverSearchWords(search) {
  return safeText(search, 120)
    .toLowerCase()
    .replace(/["'()[\]{}<>|:!*?~\\/]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .map(correctedDiscoverWord);
}

function normalizedDiscoverSearch(search) {
  var words = discoverSearchWords(search);
  if (!words.length) return "";
  var phrase = words.join(" ");
  return DISCOVER_TOPICS[phrase] ? "(" + DISCOVER_TOPICS[phrase].join(" OR ") + ")" : phrase;
}

function fuzzyDiscoverSearch(search) {
  return safeText(search, 120)
    .toLowerCase()
    .replace(/["'()[\]{}<>|~]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map(function (word) { return word.length > 3 ? word + "~" : word; })
    .join(" ");
}

function safeLicenseUrl(value) {
  try {
    var url = new URL(String(value || ""));
    var hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (hostname !== "creativecommons.org" && !hostname.endsWith(".creativecommons.org"))) return "";
    return url.toString();
  } catch (_error) {
    return "";
  }
}

function safeDownload(entry) {
  try {
    var url = new URL(String(entry && entry.file_url || ""));
    var hostname = url.hostname.toLowerCase();
    var trustedHost = hostname === "steamusercontent.com"
      || hostname.endsWith(".steamusercontent.com")
      || hostname === "steamusercontent-a.akamaihd.net";
    if (url.protocol !== "https:" || !trustedHost) return null;
    var filename = safeText(entry && entry.filename, 180).toLowerCase();
    var mediaName = (url.pathname + " " + filename).toLowerCase();
    var mime = /\.mp4(?:$|[?#\s])/.test(mediaName) ? "video/mp4"
      : /\.webm(?:$|[?#\s])/.test(mediaName) ? "video/webm"
        : /\.gif(?:$|[?#\s])/.test(mediaName) ? "image/gif"
          : "";
    return mime ? { url: url.toString(), mime: mime } : null;
  } catch (_error) {
    return null;
  }
}

function workshopUrl(sort, page, search, type) {
  var config = SORTS[sort] || SORTS.featured;
  if (config.mode === "textsearch" && !search) config = SORTS.featured;
  var url = new URL("https://steamcommunity.com/workshop/browse/");
  url.searchParams.set("appid", STEAM_WORKSHOP_APP_ID);
  url.searchParams.set("section", "readytouseitems");
  url.searchParams.set("browsesort", config.mode);
  url.searchParams.set("actualsort", config.mode);
  url.searchParams.set("p", String(page));
  url.searchParams.set("l", "english");
  if (config.days) url.searchParams.set("days", config.days);
  if (search) url.searchParams.set("searchtext", search);
  if (TYPE_TAGS[type]) url.searchParams.append("requiredtags[]", TYPE_TAGS[type]);
  return url;
}

function wallpaperEngineApiUrl(sort, page, search, type) {
  var url = new URL(WALLPAPER_ENGINE_API);
  url.searchParams.set("sort", WALLPAPER_ENGINE_SORTS[sort] || (search ? "relevance" : "trend_week"));
  url.searchParams.set("page", String(page));
  if (search) url.searchParams.set("text", search);
  if (TYPE_TAGS[type]) url.searchParams.set("requiredTags", TYPE_TAGS[type]);
  return url;
}

function normalizedQueryWords(value) {
  return normalizedMatchText(value).split(" ").filter(Boolean).slice(0, 16);
}

function wallpaperSearchScore(item, search) {
  var title = normalizedMatchText(item && item.title);
  var query = normalizedMatchText(search);
  if (!query) return 1;
  if (title === query) return 1000;
  if (title.indexOf(query) !== -1) return 800 - Math.min(200, title.length - query.length);
  var words = normalizedQueryWords(search);
  var titleWords = title.split(" ");
  var matches = words.filter(function (word) { return titleWords.indexOf(word) !== -1; }).length;
  if (matches === words.length) return 600 + matches;
  return matches ? 200 + matches : 0;
}

var WALLPAPER_SEARCH_STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with"]);

function fuzzyWallpaperSearchScore(item, search) {
  var title = normalizedMatchText(item && item.title);
  var titleWords = title.split(" ").filter(Boolean);
  var queryWords = normalizedQueryWords(search);
  var requiredWords = queryWords.filter(function (word) {
    return word.length >= 3 && !WALLPAPER_SEARCH_STOP_WORDS.has(word);
  });
  if (!requiredWords.length) requiredWords = queryWords;
  if (!requiredWords.length || !titleWords.length) return 0;

  var score = 0;
  for (var index = 0; index < requiredWords.length; index += 1) {
    var queryWord = requiredWords[index];
    if (titleWords.indexOf(queryWord) !== -1) {
      score += 120;
      continue;
    }
    if (queryWord.length >= 4 && title.indexOf(queryWord) !== -1) {
      score += 90;
      continue;
    }
    var typoMatch = titleWords.some(function (titleWord) {
      return titleWord.length >= 3 && editDistanceAtMostOne(queryWord, titleWord);
    });
    if (!typoMatch) return 0;
    score += 70;
  }
  return score + Math.max(0, 80 - title.length);
}

function wallpaperRecoveryQueries(search) {
  var normalized = normalizedMatchText(search);
  var words = normalized.split(" ").filter(function (word) {
    return word.length >= 3 && !WALLPAPER_SEARCH_STOP_WORDS.has(word);
  }).sort(function (left, right) {
    return right.length - left.length;
  });
  var candidates = [];
  words.forEach(function (word) {
    if (word !== normalized) candidates.push(word);
    if (word.length >= 6) candidates.push(word.slice(0, 5));
  });
  return candidates.filter(function (candidate, index) {
    return candidate && candidates.indexOf(candidate) === index;
  }).slice(0, 3);
}

function mapWallpaperEngineItem(entry) {
  var id = /^\d+$/.test(String(entry && entry.i || "")) ? String(entry.i) : "";
  var preview = safePreview(entry && entry.p);
  if (!id || !preview) return null;
  var tags = Array.isArray(entry.tg) ? entry.tg.map(function (tag) {
    return safeText(tag, 48);
  }).filter(Boolean).slice(0, 16) : [];
  var rating = Number(entry.r);
  return {
    id: id,
    title: safeText(entry.t, 160) || "Wallpaper Workshop item",
    description: "",
    preview: preview,
    url: "https://steamcommunity.com/sharedfiles/filedetails/?id=" + id,
    type: onlineType(tags),
    tags: tags,
    subscriptions: 0,
    favorites: 0,
    views: safeNumber(entry.v),
    rating: Number.isFinite(rating) ? Math.round(Math.max(0, Math.min(1, rating)) * 5) : 0,
    updatedAt: safeNumber(entry.u),
    fileSize: safeNumber(entry.s),
    downloadUrl: "",
    downloadMime: "",
    browserPlayable: false,
    compatibility: "native-wallpaper-engine"
  };
}

function mapWallpaperEnginePayload(payload, page, search, fallback) {
  var upstream = payload && payload.response || {};
  var rawItems = Array.isArray(upstream.items) ? upstream.items : [];
  var items = rawItems.map(mapWallpaperEngineItem).filter(Boolean);
  if (search && !fallback) {
    items = items.map(function (item) {
      var score = wallpaperSearchScore(item, search);
      return Object.assign({}, item, {
        matchKind: score >= 600 ? "exact" : "related",
        matchedQuery: search,
        searchScore: score
      });
    }).sort(function (left, right) {
      return right.searchScore - left.searchScore || right.rating - left.rating || right.views - left.views;
    });
  } else if (fallback) {
    items = items.map(function (item) {
      return Object.assign({}, item, { matchKind: "fallback", matchedQuery: search });
    });
  }
  var lastPageIndex = safeNumber(upstream.totalpagecount);
  var totalPages = Math.min(MAX_PAGE, Math.max(1, lastPageIndex + 1));
  var total = totalPages > 1 ? Math.max(items.length, totalPages * WALLPAPER_ENGINE_PAGE_SIZE) : items.length;
  return {
    page: page,
    pageSize: WALLPAPER_ENGINE_PAGE_SIZE,
    totalPages: totalPages,
    total: total,
    totalIsEstimate: totalPages > 1,
    items: items,
    fallback: Boolean(fallback),
    exactCount: fallback ? 0 : items.filter(function (item) { return item.matchKind !== "related"; }).length,
    relatedCount: fallback ? 0 : items.filter(function (item) { return item.matchKind === "related"; }).length
  };
}

async function fetchWallpaperEngineCatalog(sort, page, search, type, signal) {
  var upstream = await fetch(wallpaperEngineApiUrl(sort, page, search, type), {
    headers: { Accept: "application/json", "User-Agent": "NEO-OS-Wallpaper-Catalog/3.0" },
    redirect: "follow",
    signal: signal
  });
  if (!upstream.ok) throw new Error("wallpaper_engine_api_" + upstream.status);
  var catalog = mapWallpaperEnginePayload(await upstream.json(), page, search, false);
  if (search && !catalog.items.length) {
    var recoveryQueries = wallpaperRecoveryQueries(search);
    for (var recoveryIndex = 0; recoveryIndex < recoveryQueries.length; recoveryIndex += 1) {
      var recoveryQuery = recoveryQueries[recoveryIndex];
      var recoveredResponse = await fetch(wallpaperEngineApiUrl("relevance", 1, recoveryQuery, type), {
        headers: { Accept: "application/json", "User-Agent": "NEO-OS-Wallpaper-Catalog/3.0" },
        redirect: "follow",
        signal: signal
      });
      if (!recoveredResponse.ok) continue;
      var recoveredCatalog = mapWallpaperEnginePayload(await recoveredResponse.json(), 1, "", false);
      var recoveredItems = recoveredCatalog.items.map(function (item) {
        return Object.assign({}, item, {
          matchKind: "related",
          matchedQuery: search,
          recoveredQuery: recoveryQuery,
          searchScore: fuzzyWallpaperSearchScore(item, search)
        });
      }).filter(function (item) {
        return item.searchScore > 0;
      }).sort(function (left, right) {
        return right.searchScore - left.searchScore || right.rating - left.rating || right.views - left.views;
      });
      if (recoveredItems.length) {
        return {
          page: 1,
          totalPages: 1,
          total: recoveredItems.length,
          totalIsEstimate: false,
          items: recoveredItems,
          fallback: false,
          recovered: true,
          recoveryQuery: recoveryQuery,
          exactCount: 0,
          relatedCount: recoveredItems.length
        };
      }
    }
    var alternatives = await fetch(wallpaperEngineApiUrl("rated", 1, "", type), {
      headers: { Accept: "application/json", "User-Agent": "NEO-OS-Wallpaper-Catalog/3.0" },
      redirect: "follow",
      signal: signal
    });
    if (!alternatives.ok) return catalog;
    catalog = mapWallpaperEnginePayload(await alternatives.json(), 1, search, true);
  }
  return catalog;
}

function commonsSearchText(search, mode) {
  var words = discoverSearchWords(search);
  var terms = !words.length
    ? COMMONS_DEFAULT_SEARCH
    : mode === "title"
      ? words.map(function (word) { return "intitle:" + word; }).join(" ")
      : mode === "fuzzy" ? fuzzyDiscoverSearch(search) : normalizedDiscoverSearch(search);
  return "filetype:video filew:>1919 fileh:>1079 " + terms;
}

function commonsUrl(sort, page, search, mode, requestedLimit) {
  var query = commonsSearchText(search, mode);
  var limit = Math.min(150, Math.max(1, safeNumber(requestedLimit) || COMMONS_RESULTS));
  var offset = Math.max(0, (page - 1) * limit);
  var url = new URL(COMMONS_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(limit));
  url.searchParams.set("gsroffset", String(offset));
  url.searchParams.set("gsrwhat", "text");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srnamespace", "6");
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("prop", "videoinfo");
  url.searchParams.set("viprop", "url|mime|size|mediatype|extmetadata|derivatives");
  url.searchParams.set("viurlwidth", "640");
  url.searchParams.set("viurlheight", "360");
  if (COMMONS_SORTS[sort]) {
    url.searchParams.set("gsrsort", COMMONS_SORTS[sort]);
    url.searchParams.set("srsort", COMMONS_SORTS[sort]);
  }
  return url;
}

function normalizedMatchText(value) {
  var text = safeText(value, 2000).toLowerCase();
  try { text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch (_error) {}
  return text.replace(/[^a-z0-9]+/g, " ").trim();
}

function commonsRelevance(item, search) {
  var words = discoverSearchWords(search);
  if (!words.length) return 1;
  var phrase = words.join(" ");
  var aliases = DISCOVER_TOPICS[phrase] || words;
  var title = normalizedMatchText(item && item.title);
  var searchable = normalizedMatchText(item && item.searchableText);
  var titleWords = title.split(" ").filter(Boolean);
  var searchableWords = searchable.split(" ").filter(Boolean);
  function contains(text, tokens, word) {
    return tokens.indexOf(word) !== -1 || (word.length > 3 && text.indexOf(word) !== -1);
  }
  var topicMatch = Boolean(DISCOVER_TOPICS[phrase]);
  var titleMatches = topicMatch
    ? aliases.filter(function (word) { return contains(title, titleWords, word); }).length
    : words.filter(function (word) { return contains(title, titleWords, word); }).length;
  var searchableMatches = topicMatch
    ? aliases.filter(function (word) { return contains(searchable, searchableWords, word); }).length
    : words.filter(function (word) { return contains(searchable, searchableWords, word); }).length;
  var relevant = topicMatch ? searchableMatches > 0 : searchableMatches === words.length;
  if (!relevant) return 0;
  var exactPhrase = title.indexOf(phrase) !== -1;
  return (exactPhrase ? 1000 : 0) + titleMatches * 100 + searchableMatches * 10;
}

function mapCommonsPayload(payload) {
  var pages = payload && payload.query && Array.isArray(payload.query.pages) ? payload.query.pages : [];
  return pages.sort(function (a, b) {
    return safeNumber(a.index) - safeNumber(b.index);
  }).map(mapCommonsItem).filter(Boolean);
}

function commonsTotal(payload) {
  return safeNumber(payload && payload.query && payload.query.searchinfo && payload.query.searchinfo.totalhits);
}

function mergeRelevantCommonsItems(primary, supplemental, search) {
  var seen = new Set();
  return primary.concat(supplemental).map(function (item, index) {
    return { item: item, index: index, score: commonsRelevance(item, search) };
  }).filter(function (entry) {
    if (!entry.score || seen.has(entry.item.id)) return false;
    seen.add(entry.item.id);
    return true;
  }).sort(function (a, b) {
    return b.score - a.score || a.index - b.index;
  }).map(function (entry) { return entry.item; });
}

function metadataValue(metadata, name) {
  return metadata && metadata[name] && metadata[name].value || "";
}

function commonsMedia(info) {
  var duration = Number(info && info.duration) || 0;
  var derivatives = Array.isArray(info && info.derivatives) ? info.derivatives : [];
  var candidates = derivatives.map(function (entry) {
    var url = safeCommonsAsset(entry && entry.src);
    var type = safeText(entry && entry.type, 100).toLowerCase();
    var width = safeNumber(entry && entry.width);
    var height = safeNumber(entry && entry.height);
    var bandwidth = safeNumber(entry && entry.bandwidth);
    var mime = type.indexOf("video/webm") === 0 ? "video/webm" : type.indexOf("video/mp4") === 0 ? "video/mp4" : "";
    var estimatedSize = bandwidth && duration ? Math.ceil(bandwidth * duration / 8) : 0;
    return url && mime && width >= 640 && height >= 360 && width / Math.max(1, height) >= 1.5
      ? { url: url, mime: mime, width: width, height: height, bandwidth: bandwidth, estimatedSize: estimatedSize }
      : null;
  }).filter(Boolean);
  var originalMime = safeText(info && info.mime, 80).toLowerCase();
  var originalUrl = safeCommonsAsset(info && info.url);
  var originalWidth = safeNumber(info && info.width);
  var originalHeight = safeNumber(info && info.height);
  if ((originalMime === "video/webm" || originalMime === "video/mp4") && originalUrl && originalWidth >= 640 && originalHeight >= 360 && originalWidth / Math.max(1, originalHeight) >= 1.5) {
    candidates.push({
      url: originalUrl,
      mime: originalMime,
      width: originalWidth,
      height: originalHeight,
      bandwidth: 0,
      estimatedSize: safeNumber(info && info.size)
    });
  }
  var seen = new Set();
  candidates = candidates.filter(function (candidate) {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
  var downloadable = candidates.filter(function (candidate) {
    return candidate.width >= 1920 && candidate.height >= 1080
      && (!candidate.estimatedSize || candidate.estimatedSize <= COMMONS_MAX_FILE_SIZE);
  }).sort(function (a, b) {
    var aPixels = a.width * a.height;
    var bPixels = b.width * b.height;
    return bPixels - aPixels || (a.mime === "video/mp4" ? -1 : 1);
  });
  var previews = candidates.filter(function (candidate) {
    return !candidate.estimatedSize || candidate.estimatedSize <= COMMONS_MAX_FILE_SIZE;
  }).sort(function (a, b) {
    var aPixels = a.width * a.height;
    var bPixels = b.width * b.height;
    return aPixels - bPixels || (a.mime === "video/mp4" ? -1 : 1);
  });
  return downloadable.length ? {
    best: downloadable[0],
    sources: downloadable.slice(0, 4),
    preview: previews[0] || downloadable[downloadable.length - 1]
  } : null;
}

function mapCommonsItem(page) {
  var info = page && Array.isArray(page.videoinfo) ? page.videoinfo[0] : null;
  var mediaSet = commonsMedia(info);
  var media = mediaSet && mediaSet.best;
  var pageId = safeNumber(page && page.pageid);
  var preview = safeCommonsAsset(info && info.responsiveUrls && (info.responsiveUrls["2"] || info.responsiveUrls[2]))
    || safeCommonsAsset(info && info.thumburl);
  var sourceUrl = safeCommonsPage(info && info.descriptionurl);
  var duration = Number(info && info.duration) || 0;
  if (!pageId || !media || !preview || !sourceUrl || duration <= 0) return null;
  var fileSize = media.estimatedSize || (media.bandwidth ? Math.ceil(media.bandwidth * duration / 8) : 0);
  if (fileSize > COMMONS_MAX_FILE_SIZE) return null;
  var metadata = info.extmetadata || {};
  var title = safeText(page.title, 180).replace(/^File:/i, "").replace(/\.(?:webm|mp4|ogv)$/i, "");
  var description = safeMetadataText(metadataValue(metadata, "ImageDescription"), 280);
  var author = safeMetadataText(metadataValue(metadata, "Artist"), 120) || "Wikimedia Commons contributor";
  var license = safeMetadataText(metadataValue(metadata, "LicenseShortName"), 80) || "See source for license";
  var categories = safeText(metadataValue(metadata, "Categories"), 600).split("|").map(function (tag) {
    return safeText(tag, 48);
  }).filter(Boolean).slice(0, 10);
  return {
    id: String(pageId),
    installId: "commons-" + pageId,
    provider: "commons",
    source: "Wikimedia Commons",
    title: title || "Animated Commons wallpaper",
    description: description || "A high-resolution animated video from Wikimedia Commons.",
    author: author,
    license: license,
    licenseUrl: safeLicenseUrl(metadataValue(metadata, "LicenseUrl")),
    preview: preview,
    previewVideoUrl: mediaSet.preview && mediaSet.preview.url || "",
    previewVideoMime: mediaSet.preview && mediaSet.preview.mime || "",
    url: sourceUrl,
    type: "video",
    tags: categories,
    subscriptions: 0,
    favorites: 0,
    views: 0,
    rating: 0,
    updatedAt: 0,
    fileSize: fileSize,
    width: media.width,
    height: media.height,
    duration: duration,
    qualityLabel: media.width >= 3840 && media.height >= 2160 ? "4K" : "1080P",
    downloadUrl: media.url,
    downloadMime: media.mime,
    downloadSources: mediaSet.sources,
    browserPlayable: true,
    compatibility: "browser-media",
    searchableText: [title, description, author].concat(categories).join(" ")
  };
}

async function fetchCommonsCatalog(sort, page, search, signal) {
  async function request(searchText, mode, requestPage, limit) {
    var url = commonsUrl(sort, requestPage || page, searchText, mode, limit);
    for (var attempt = 0; attempt < 3; attempt += 1) {
      var upstream = await fetch(url, {
        headers: { "User-Agent": "NEO-OS-Wallpaper-Catalog/5.0" },
        redirect: "follow",
        signal: signal
      });
      if (upstream.ok) return upstream.json();
      var retryable = upstream.status === 429 || upstream.status === 502 || upstream.status === 503 || upstream.status === 504;
      if (!retryable || attempt === 2) throw new Error("wikimedia_commons_" + upstream.status);
      await new Promise(function (resolve) { setTimeout(resolve, 250 * (attempt + 1)); });
    }
    throw new Error("wikimedia_commons_unavailable");
  }
  var hasSearch = discoverSearchWords(search).length > 0;
  var fallback = false;
  var resultPage = page;
  var payload = await request(search, hasSearch ? "title" : "default", page, COMMONS_RESULTS);
  var items = mapCommonsPayload(payload);
  var total = commonsTotal(payload);
  var exactCount = total;
  var relatedCount = 0;
  if (hasSearch && total > 0 && total <= COMMONS_RESULTS) {
    var primary = page === 1 ? items : mapCommonsPayload(await request(search, "title", 1, COMMONS_RESULTS));
    try {
      var broadPayload = await request(search, "broad", 1, 120).catch(function () { return null; });
      var relevant = mergeRelevantCommonsItems(primary, mapCommonsPayload(broadPayload), search);
      exactCount = relevant.length;
      total = relevant.length;
      items = relevant.slice((page - 1) * COMMONS_RESULTS, page * COMMONS_RESULTS);
    } catch (_error) {
      total = primary.length;
      exactCount = total;
      items = primary.slice((page - 1) * COMMONS_RESULTS, page * COMMONS_RESULTS);
    }
  }
  if (!items.length && hasSearch) {
    var relaxed = fuzzyDiscoverSearch(search);
    try {
      var recoveryPayloads = await Promise.all([
        relaxed ? request(search, "fuzzy", 1, 120).catch(function () { return null; }) : Promise.resolve(null),
        request("", "default", 1, COMMONS_RESULTS).catch(function () { return null; })
      ]);
      var fuzzyItems = mergeRelevantCommonsItems([], mapCommonsPayload(recoveryPayloads[0]), search);
      if (fuzzyItems.length) {
        total = fuzzyItems.length;
        exactCount = total;
        items = fuzzyItems.slice((page - 1) * COMMONS_RESULTS, page * COMMONS_RESULTS);
      } else {
        var fallbackItems = mapCommonsPayload(recoveryPayloads[1]);
        if (fallbackItems.length) {
          items = fallbackItems.map(function (item) {
            return Object.assign({}, item, { matchKind: "fallback", matchedQuery: search });
          });
        fallback = true;
        resultPage = 1;
        total = items.length;
        exactCount = 0;
        relatedCount = 0;
        }
      }
    } catch (_error) {}
  }
  var totalPages = Math.min(COMMONS_MAX_PAGE, Math.max(1, Math.ceil(total / COMMONS_RESULTS)));
  if (totalPages === 1) total = items.length;
  return {
    source: "Wikimedia Commons",
    query: search,
    sort: sort,
    type: "video",
    page: resultPage,
    pageSize: COMMONS_RESULTS,
    totalPages: totalPages,
    total: total,
    exactCount: exactCount,
    relatedCount: relatedCount,
    fallback: fallback,
    count: items.length,
    hasPrevious: resultPage > 1,
    hasNext: resultPage < totalPages,
    items: items
  };
}

function onlineType(tags) {
  var supported = ["scene", "video", "web", "application", "image", "preview"];
  for (var index = 0; index < tags.length; index += 1) {
    var lowered = tags[index].toLowerCase();
    if (supported.indexOf(lowered) !== -1) return lowered;
  }
  return "workshop";
}

function mapWorkshopItem(entry) {
  var id = /^\d+$/.test(String(entry && entry.publishedfileid || "")) ? String(entry.publishedfileid) : "";
  var preview = safePreview(entry && entry.preview_url);
  if (!id || !preview) return null;
  var tags = Array.isArray(entry.tags) ? entry.tags.map(function (tag) {
    return safeText(tag && (tag.display_name || tag.tag), 48);
  }).filter(Boolean).slice(0, 10) : [];
  var download = safeDownload(entry);
  return {
    id: id,
    title: safeText(entry.title, 160) || "Wallpaper Workshop item",
    description: safeText(entry.short_description, 280),
    preview: preview,
    url: "https://steamcommunity.com/sharedfiles/filedetails/?id=" + id,
    type: onlineType(tags),
    tags: tags,
    subscriptions: safeNumber(entry.subscriptions),
    favorites: safeNumber(entry.favorited),
    views: safeNumber(entry.views),
    rating: Math.min(5, safeNumber(entry.star_rating)),
    updatedAt: safeNumber(entry.time_updated),
    fileSize: safeNumber(entry.file_size),
    downloadUrl: download ? download.url : "",
    downloadMime: download ? download.mime : "",
    browserPlayable: Boolean(download),
    compatibility: download ? "browser-media" : "native-wallpaper-engine"
  };
}

function parseRenderContext(html) {
  var marker = "window.SSR.renderContext=JSON.parse(";
  var start = html.indexOf(marker);
  if (start === -1) return null;
  start += marker.length;
  var end = html.indexOf("); </script>", start);
  if (end === -1) end = html.indexOf(");</script>", start);
  if (end === -1 || end - start > 8_000_000) return null;
  try {
    var serializedContext = JSON.parse(html.slice(start, end));
    var context = JSON.parse(serializedContext);
    var queryData = typeof context.queryData === "string" ? JSON.parse(context.queryData) : context.queryData;
    var queries = queryData && Array.isArray(queryData.queries) ? queryData.queries : [];
    var catalog = queries.map(function (query) {
      return query && query.state && query.state.data;
    }).find(function (data) {
      return data && Array.isArray(data.results) && Object.prototype.hasOwnProperty.call(data, "total_count");
    });
    if (!catalog) return null;
    return {
      page: Math.max(1, safeNumber(catalog.current_page) || 1),
      totalPages: Math.min(MAX_PAGE, safeNumber(catalog.total_pages)),
      total: safeNumber(catalog.total_count),
      items: catalog.results.map(mapWorkshopItem).filter(Boolean).slice(0, MAX_RESULTS)
    };
  } catch (_error) {
    return null;
  }
}

function parseLegacyCards(html, page) {
  var items = [];
  var seen = new Set();
  var pattern = /<a[^>]+href="https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d+)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]+alt="([^"]*)"/gi;
  var match;
  while ((match = pattern.exec(html)) && items.length < MAX_RESULTS) {
    var id = match[1];
    var preview = safePreview(decodeHtml(match[2]));
    if (seen.has(id) || !preview) continue;
    seen.add(id);
    items.push({
      id: id,
      title: safeText(match[3], 160) || "Wallpaper Workshop item",
      description: "",
      preview: preview,
      url: "https://steamcommunity.com/sharedfiles/filedetails/?id=" + id,
      type: "workshop",
      tags: [],
      subscriptions: 0,
      favorites: 0,
      views: 0,
      rating: 0,
      updatedAt: 0,
      fileSize: 0,
      downloadUrl: "",
      downloadMime: "",
      browserPlayable: false,
      compatibility: "native-wallpaper-engine"
    });
  }
  if (!items.length) return null;
  return { page: page, totalPages: page, total: items.length, items: items };
}

function parseWorkshop(html, page) {
  return parseRenderContext(html) || parseLegacyCards(html, page);
}

async function addOfficialDownloads(items, signal) {
  if (!items.length) return items;
  var body = new URLSearchParams();
  body.set("itemcount", String(items.length));
  items.forEach(function (item, index) {
    body.set("publishedfileids[" + index + "]", item.id);
  });
  var upstream = await fetch("https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: body.toString(),
    redirect: "follow",
    signal: signal
  });
  if (!upstream.ok) return items;
  var payload = await upstream.json();
  var details = payload && payload.response && Array.isArray(payload.response.publishedfiledetails)
    ? payload.response.publishedfiledetails : [];
  var byId = new Map(details.map(function (detail) { return [String(detail.publishedfileid || ""), detail]; }));
  return items.map(function (item) {
    var detail = byId.get(item.id);
    var download = safeDownload(detail);
    if (!download) return item;
    return Object.assign({}, item, {
      fileSize: safeNumber(detail.file_size) || item.fileSize,
      downloadUrl: download.url,
      downloadMime: download.mime,
      browserPlayable: true,
      compatibility: "browser-media"
    });
  });
}

export async function handler(event) {
  if (String(event.httpMethod || "GET").toUpperCase() !== "GET") {
    return response(405, { code: "method_not_allowed", detail: "Method not allowed" });
  }
  var params = event.queryStringParameters || {};
  var requestedSource = params.source === "workshop" ? "workshop" : "discover";
  var sort = Object.prototype.hasOwnProperty.call(SORTS, params.sort) ? params.sort : "featured";
  var type = Object.prototype.hasOwnProperty.call(TYPE_TAGS, params.type) ? params.type : "";
  var search = safeText(params.q, 120);
  // Discover is intentionally restricted to complete browser-playable files.
  // The separate Workshop tab exposes native Wallpaper Engine projects.
  var source = requestedSource;
  var browserReadyDiscover = source === "discover";
  var pageLimit = browserReadyDiscover ? COMMONS_MAX_PAGE : MAX_PAGE;
  var page = Math.min(pageLimit, Math.max(1, Number.parseInt(params.page, 10) || 1));
  var staleCommonsCatalog = null;
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 12_000);
  try {
    if (browserReadyDiscover) {
      if (type && type !== "video") {
        return response(200, {
          source: "Wikimedia Commons",
          catalogMode: "browser-ready",
          query: search,
          sort: sort,
          type: type,
          page: 1,
          pageSize: COMMONS_RESULTS,
          totalPages: 1,
          total: 0,
          count: 0,
          hasPrevious: false,
          hasNext: false,
          items: []
        }, "private, max-age=60");
      }
      var cacheKey = commonsCacheKey(sort, page, search);
      var freshCommonsCatalog = readCommonsCache(cacheKey, COMMONS_CACHE_TTL);
      if (freshCommonsCatalog) {
        return response(200, freshCommonsCatalog, search ? "private, max-age=300" : "public, max-age=300, s-maxage=900, stale-while-revalidate=1800");
      }
      staleCommonsCatalog = readCommonsCache(cacheKey, COMMONS_STALE_TTL);
      var commonsCatalog;
      try {
        commonsCatalog = await fetchCommonsCatalog(sort, page, search, controller.signal);
      } catch (commonsError) {
        var lastKnownGood = readCommonsCache(COMMONS_FALLBACK_CACHE_KEY, COMMONS_STALE_TTL);
        if (!lastKnownGood || !Array.isArray(lastKnownGood.items) || !lastKnownGood.items.length) throw commonsError;
        var fallbackItems = lastKnownGood.items.map(function (item) {
          return Object.assign({}, item, { matchKind: "fallback", matchedQuery: search });
        });
        commonsCatalog = Object.assign({}, lastKnownGood, {
          query: search,
          sort: sort,
          page: 1,
          totalPages: 1,
          total: fallbackItems.length,
          exactCount: 0,
          relatedCount: 0,
          count: fallbackItems.length,
          hasPrevious: false,
          hasNext: false,
          fallback: true,
          stale: true,
          items: fallbackItems
        });
      }
      commonsCatalog.catalogMode = "browser-ready";
      writeCommonsCache(cacheKey, commonsCatalog);
      if (commonsCatalog.items.length && !commonsCatalog.fallback) {
        writeCommonsCache(COMMONS_FALLBACK_CACHE_KEY, commonsCatalog);
      }
      return response(200, commonsCatalog, search ? "private, max-age=300" : "public, max-age=300, s-maxage=900, stale-while-revalidate=1800");
    }
    var catalog;
    try {
      catalog = await fetchWallpaperEngineCatalog(sort, page, search, type, controller.signal);
    } catch (_apiError) {
      var upstream = await fetch(workshopUrl(sort, page, search, type), {
        headers: { "User-Agent": "NEO-OS-Wallpaper-Catalog/3.0" },
        redirect: "follow",
        signal: controller.signal
      });
      if (!upstream.ok) throw new Error("steam_workshop_" + upstream.status);
      catalog = parseWorkshop(await upstream.text(), page);
      if (!catalog) throw new Error("steam_workshop_unreadable");
      catalog.fallback = false;
      catalog.exactCount = catalog.items.length;
      catalog.relatedCount = 0;
    }
    try {
      catalog.items = await addOfficialDownloads(catalog.items, controller.signal);
    } catch (_error) {
      // The searchable catalog remains useful if Steam's optional detail lookup is unavailable.
    }
    return response(200, {
      source: "Wallpaper Engine Workshop",
      catalogMode: "workshop",
      query: search,
      sort: sort,
      type: type,
      page: catalog.page,
      pageSize: safeNumber(catalog.pageSize) || MAX_RESULTS,
      totalPages: catalog.totalPages,
      total: catalog.total,
      totalIsEstimate: Boolean(catalog.totalIsEstimate),
      fallback: Boolean(catalog.fallback),
      recovered: Boolean(catalog.recovered),
      recoveryQuery: safeText(catalog.recoveryQuery, 120),
      exactCount: safeNumber(catalog.exactCount),
      relatedCount: safeNumber(catalog.relatedCount),
      count: catalog.items.length,
      hasPrevious: catalog.page > 1,
      hasNext: catalog.totalPages > 0 && catalog.page < catalog.totalPages,
      items: catalog.items
    }, search ? "private, max-age=60" : "public, max-age=120, s-maxage=300, stale-while-revalidate=600");
  } catch (error) {
    if (staleCommonsCatalog) {
      return response(200, Object.assign({}, staleCommonsCatalog, { stale: true }), "private, max-age=60");
    }
    var timeout = error && error.name === "AbortError";
    return response(timeout ? 504 : 502, {
      code: timeout ? "catalog_timeout" : "catalog_unavailable",
      detail: timeout ? "The online catalog took too long to respond." : "The online catalog is temporarily unavailable.",
      source: source
    });
  } finally {
    clearTimeout(timer);
  }
}
