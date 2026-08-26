(function () {
  if (window.__learningZonesAppearanceFrame) return;
  window.__learningZonesAppearanceFrame = true;

  var THEME_KEY = "ugp_site_theme";
  var SETTINGS_KEY = "ugp_site_settings_v1";
  var STYLE_ID = "lz-appearance-frame-style";
  var BACKGROUNDS = ["matrix", "topography", "constellation", "starfield", "aurora", "circuit"];
  var PALETTES = {
    ember: { accent: "#ff7628", hover: "#ed6418", lightBg: "#fbf7f2", lightSurface: "#ffffff", lightSoft: "#fff4eb", lightText: "#191714", lightMuted: "#756e67", lightBorder: "#e8e0d8", darkBg: "#090704", darkSurface: "#15100b", darkSoft: "#1e160f", darkText: "#f7f1eb", darkMuted: "#c7b8aa", darkBorder: "#4f3723" },
    ocean: { accent: "#2378c9", hover: "#1c65aa", lightBg: "#f5f9fc", lightSurface: "#ffffff", lightSoft: "#eaf4ff", lightText: "#17212a", lightMuted: "#65717b", lightBorder: "#dbe8f2", darkBg: "#051018", darkSurface: "#0b1b27", darkSoft: "#102b3d", darkText: "#eef8ff", darkMuted: "#b3cede", darkBorder: "#24495f" },
    berry: { accent: "#d94d7a", hover: "#bd3f69", lightBg: "#fbf6f8", lightSurface: "#ffffff", lightSoft: "#fff0f5", lightText: "#21171b", lightMuted: "#74666c", lightBorder: "#eadde3", darkBg: "#120711", darkSurface: "#1e0c1b", darkSoft: "#2b1327", darkText: "#fff0f8", darkMuted: "#dfbbca", darkBorder: "#59314b" },
    lime: { accent: "#50bf3d", hover: "#43a832", lightBg: "#f7faf2", lightSurface: "#ffffff", lightSoft: "#effbdd", lightText: "#151d12", lightMuted: "#65735d", lightBorder: "#dfe9d2", darkBg: "#071006", darkSurface: "#0f1d0c", darkSoft: "#172b12", darkText: "#f2ffe8", darkMuted: "#bdd6b2", darkBorder: "#345728" },
    purple: { accent: "#6c427f", hover: "#5b346d", lightBg: "#faf7fc", lightSurface: "#ffffff", lightSoft: "#f4ebf8", lightText: "#1e1721", lightMuted: "#716578", lightBorder: "#e6ddea", darkBg: "#0c0910", darkSurface: "#17101d", darkSoft: "#22162b", darkText: "#faf0ff", darkMuted: "#d1bddc", darkBorder: "#463052" }
  };

  function readJson(keyName, fallback) {
    try {
      var raw = localStorage.getItem(keyName);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeColor(value, fallback) {
    var raw = String(value || "").trim();
    return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw) ? raw : fallback;
  }

  function hexToRgb(value) {
    var color = safeColor(value, "");
    if (!color) return { r: 255, g: 118, b: 40 };
    var hex = color.slice(1);
    if (hex.length === 3) hex = hex.split("").map(function (char) { return char + char; }).join("");
    var intValue = parseInt(hex.slice(0, 6), 16);
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  }

  function normalizeTheme(value) {
    var raw = value && typeof value === "object" ? value : { value: value };
    var key = String(raw.value || raw.theme || "ember").toLowerCase();
    if (key === "dark") key = "purple";
    if (key === "teal") key = "ocean";
    if (key === "custom") {
      return {
        value: "custom",
        theme: "custom",
        colorMode: raw.colorMode === "dark" ? "dark" : "light",
        accent: safeColor(raw.accent || raw.color, "#ff7628")
      };
    }
    if (!PALETTES[key]) key = "ember";
    return {
      value: key,
      theme: key,
      colorMode: raw.colorMode === "dark" ? "dark" : "light",
      accent: PALETTES[key].accent
    };
  }

  function normalizeBackground(value) {
    var mode = String(value || "").toLowerCase();
    return BACKGROUNDS.indexOf(mode) >= 0 ? mode : "matrix";
  }

  function currentSettings() {
    var saved = readJson(SETTINGS_KEY, {}) || {};
    return {
      background: normalizeBackground(saved.background),
      reduceMotion: saved.reduceMotion === true,
      performanceMode: /^(auto|standard|low)$/.test(String(saved.performanceMode || "")) ? saved.performanceMode : "auto"
    };
  }

  function paletteFor(theme) {
    var normalized = normalizeTheme(theme);
    if (normalized.value === "custom") {
      var rgb = hexToRgb(normalized.accent);
      var soft = "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", 0.14)";
      return {
        accent: normalized.accent,
        hover: normalized.accent,
        bg: normalized.colorMode === "dark" ? "#090b10" : "#f8f7fb",
        surface: normalized.colorMode === "dark" ? "#151821" : "#ffffff",
        soft: soft,
        text: normalized.colorMode === "dark" ? "#f7f1eb" : "#191714",
        muted: normalized.colorMode === "dark" ? "#c5c8d1" : "#6e6a72",
        border: normalized.colorMode === "dark" ? "#343747" : "#e5e1ea",
        rgb: rgb.r + ", " + rgb.g + ", " + rgb.b
      };
    }
    var preset = PALETTES[normalized.theme] || PALETTES.ember;
    var accentRgb = hexToRgb(preset.accent);
    return {
      accent: preset.accent,
      hover: preset.hover,
      bg: normalized.colorMode === "dark" ? preset.darkBg : preset.lightBg,
      surface: normalized.colorMode === "dark" ? preset.darkSurface : preset.lightSurface,
      soft: normalized.colorMode === "dark" ? preset.darkSoft : preset.lightSoft,
      text: normalized.colorMode === "dark" ? preset.darkText : preset.lightText,
      muted: normalized.colorMode === "dark" ? preset.darkMuted : preset.lightMuted,
      border: normalized.colorMode === "dark" ? preset.darkBorder : preset.lightBorder,
      rgb: accentRgb.r + ", " + accentRgb.g + ", " + accentRgb.b
    };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ""
      + "html{background:var(--lz-frame-bg,#fbf7f2)!important;color-scheme:light;}"
      + "html[data-lz-color-mode='dark']{color-scheme:dark;}"
      + "body{position:relative;isolation:isolate;min-height:100vh;background:transparent!important;color:var(--lz-frame-text,#191714)!important;transition:background-color 180ms cubic-bezier(.2,.8,.2,1),color 180ms cubic-bezier(.2,.8,.2,1);}"
      + "body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:var(--lz-frame-bg,#fbf7f2);opacity:.88;transform:translateZ(0);}"
      + "body::after{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.2;transform:translateZ(0);}"
      + "html[data-lz-background='matrix'] body::after{background-image:linear-gradient(rgba(var(--lz-frame-accent-rgb,255,118,40),.16) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--lz-frame-accent-rgb,255,118,40),.12) 1px,transparent 1px);background-size:42px 42px;}"
      + "html[data-lz-background='topography'] body::after{background:repeating-radial-gradient(ellipse at 45% 35%,rgba(var(--lz-frame-accent-rgb,255,118,40),.22) 0 1px,transparent 1px 28px);opacity:.24;}"
      + "html[data-lz-background='constellation'] body::after{background-image:radial-gradient(circle at 12% 18%,rgba(var(--lz-frame-accent-rgb,255,118,40),.5) 0 1px,transparent 1.8px),radial-gradient(circle at 70% 28%,rgba(var(--lz-frame-accent-rgb,255,118,40),.42) 0 1px,transparent 1.8px),linear-gradient(28deg,transparent 0 18%,rgba(var(--lz-frame-accent-rgb,255,118,40),.14) 18.1% 18.3%,transparent 18.45% 100%);background-size:180px 160px,320px 260px,100% 100%;opacity:.28;}"
      + "html[data-lz-background='starfield'] body::after{background-image:radial-gradient(circle at 12% 18%,rgba(255,255,255,.74) 0 1px,transparent 1.8px),radial-gradient(circle at 30% 68%,rgba(255,255,255,.5) 0 1px,transparent 1.7px),radial-gradient(circle at 70% 28%,rgba(255,255,255,.62) 0 1px,transparent 1.9px);background-size:180px 160px,240px 220px,320px 260px;opacity:.28;}"
      + "html[data-lz-background='aurora'] body::after{background:linear-gradient(112deg,transparent 8%,rgba(var(--lz-frame-accent-rgb,255,118,40),.18) 34%,transparent 58%),linear-gradient(68deg,transparent 18%,rgba(255,255,255,.1) 50%,transparent 74%);opacity:.35;animation:lzFrameAurora 18s cubic-bezier(.2,.8,.2,1) infinite alternate;}"
      + "html[data-lz-background='circuit'] body::after{background-image:linear-gradient(rgba(var(--lz-frame-accent-rgb,255,118,40),.2) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--lz-frame-accent-rgb,255,118,40),.15) 1px,transparent 1px),linear-gradient(135deg,transparent 0 44%,rgba(var(--lz-frame-accent-rgb,255,118,40),.18) 44.1% 44.45%,transparent 44.6%);background-size:84px 84px,84px 84px,280px 220px;opacity:.26;}"
      + "a{color:var(--lz-frame-accent,#ff7628);}"
      + "button,[role='button'],input,select,textarea{border-color:var(--lz-frame-border,#e8e0d8);}"
      + "button,[role='button']{transition:transform 160ms cubic-bezier(.2,.8,.2,1),box-shadow 160ms cubic-bezier(.2,.8,.2,1),border-color 160ms cubic-bezier(.2,.8,.2,1),background-color 160ms cubic-bezier(.2,.8,.2,1),color 160ms cubic-bezier(.2,.8,.2,1);}"
      + "button:hover,[role='button']:hover{transform:translateY(-1px);}"
      + ":focus-visible{outline:3px solid rgba(var(--lz-frame-accent-rgb,255,118,40),.35);outline-offset:3px;}"
      + "@keyframes lzFrameAurora{from{background-position:-40px 0,0 0;filter:saturate(105%)}to{background-position:48px 0,0 24px;filter:saturate(125%)}}"
      + "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}";
    document.head.appendChild(style);
  }

  function applyAppearance(payload) {
    var savedTheme = readJson(THEME_KEY, null);
    var theme = normalizeTheme(payload && (payload.theme || payload.value || payload));
    if (!payload || (!payload.theme && !payload.value && !payload.colorMode && !payload.accent)) theme = normalizeTheme(savedTheme || "ember");
    if (payload && payload.colorMode) theme.colorMode = payload.colorMode === "dark" ? "dark" : "light";
    if (payload && payload.accent && theme.value === "custom") theme.accent = safeColor(payload.accent, theme.accent);
    var settings = currentSettings();
    if (payload && (payload.background || payload.settings && payload.settings.background)) {
      settings.background = normalizeBackground(payload.background || payload.settings.background);
    }
    var palette = paletteFor(theme);
    var root = document.documentElement;
    root.dataset.lzTheme = theme.theme;
    root.dataset.lzThemeValue = theme.value;
    root.dataset.lzColorMode = theme.colorMode;
    root.dataset.lzBackground = settings.background;
    root.dataset.lzReduceMotion = settings.reduceMotion ? "true" : "false";
    root.dataset.lzPerformanceMode = settings.performanceMode;
    root.style.setProperty("--lz-frame-bg", palette.bg);
    root.style.setProperty("--lz-frame-surface", palette.surface);
    root.style.setProperty("--lz-frame-soft", palette.soft);
    root.style.setProperty("--lz-frame-text", palette.text);
    root.style.setProperty("--lz-frame-muted", palette.muted);
    root.style.setProperty("--lz-frame-border", palette.border);
    root.style.setProperty("--lz-frame-accent", palette.accent);
    root.style.setProperty("--lz-frame-accent-hover", palette.hover);
    root.style.setProperty("--lz-frame-accent-rgb", palette.rgb);
    root.style.setProperty("--lz-site-bg", palette.bg);
    root.style.setProperty("--lz-site-surface", palette.surface);
    root.style.setProperty("--lz-site-soft", palette.soft);
    root.style.setProperty("--lz-site-text", palette.text);
    root.style.setProperty("--lz-site-muted", palette.muted);
    root.style.setProperty("--lz-site-border", palette.border);
    root.style.setProperty("--lz-site-accent", palette.accent);
    root.style.setProperty("--lz-site-accent-hover", palette.hover);
    if (document.body) {
      document.body.dataset.lzTheme = theme.theme;
      document.body.dataset.lzThemeValue = theme.value;
      document.body.dataset.lzColorMode = theme.colorMode;
      document.body.dataset.lzBackground = settings.background;
    }
  }

  function syncFromParent() {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: "taco-auth-request" }, location.origin);
    } catch (error) {}
  }

  injectStyle();
  applyAppearance();
  window.addEventListener("message", function (event) {
    if (event.origin !== location.origin) return;
    var data = event.data || {};
    if (data.type === "learning-zones-theme" || data.type === "learning-zones-appearance") applyAppearance(data);
  });
  window.addEventListener("storage", function (event) {
    if (!event.key || event.key === THEME_KEY || event.key === SETTINGS_KEY) applyAppearance();
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromParent, { once: true });
  } else {
    syncFromParent();
  }
})();
