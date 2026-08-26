(function () {
  if (window.__learningZonesMidnightArcadeBg) return;
  window.__learningZonesMidnightArcadeBg = true;

  var STYLE_ID = "lz-midnight-arcade-style";
  var ROOT_ID = "lz-midnight-arcade-bg";
  var routeState = "library";
  var pointer = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, active: false };
  var particles = [];
  var canvas;
  var ctx;
  var raf = 0;
  var lastFrame = 0;
  var finePointer = false;
  var reducedMotion = false;
  var dpr = 1;
  var backgroundMode = "matrix";

  function normalizeBackgroundMode(mode) {
    var value = String(mode || "").toLowerCase();
    return /^(matrix|topography|constellation|starfield|aurora|circuit)$/.test(value) ? value : "matrix";
  }

  function readBackgroundMode() {
    try {
      var raw = localStorage.getItem("ugp_site_settings_v1");
      var parsed = raw ? JSON.parse(raw) : null;
      var mode = String(parsed && parsed.background || document.documentElement.dataset.lzBackground || "matrix").toLowerCase();
      return normalizeBackgroundMode(mode);
    } catch (error) {
      return "matrix";
    }
  }

  function applyBackgroundMode() {
    backgroundMode = readBackgroundMode();
    document.documentElement.dataset.lzBackground = backgroundMode;
    if (document.body) document.body.dataset.lzBackground = backgroundMode;
  }

  function css() {
    return `
      :root {
        --lz-arcade-base: #070a14;
        --lz-arcade-base-rgb: 7, 10, 20;
        --lz-arcade-theme-cyan: 80, 200, 255;
        --lz-arcade-theme-violet: 148, 102, 255;
        --lz-arcade-theme-blue: 72, 118, 255;
        --lz-arcade-cyan: var(--lz-arcade-theme-cyan);
        --lz-arcade-violet: var(--lz-arcade-theme-violet);
        --lz-arcade-blue: var(--lz-arcade-theme-blue);
        --lz-arcade-opacity: 0.78;
        --lz-arcade-grid-opacity: 0.16;
        --lz-arcade-trace-opacity: 0.26;
        --lz-arcade-texture-opacity: 0.22;
        --lz-arcade-vignette: 0.76;
        --lz-arcade-parallax-x: 0px;
        --lz-arcade-parallax-y: 0px;
      }

      html.lz-midnight-arcade {
        background: var(--lz-arcade-base);
      }

      html.lz-midnight-arcade body {
        background-color: var(--lz-arcade-base) !important;
        background-image:
          radial-gradient(circle at 16% 0%, rgba(var(--lz-arcade-cyan), 0.08), transparent 34%),
          radial-gradient(circle at 84% 12%, rgba(var(--lz-arcade-violet), 0.08), transparent 32%) !important;
      }

      html.lz-midnight-arcade #root {
        position: relative;
        z-index: 1;
        min-height: 100dvh;
        isolation: isolate;
      }

      #${ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: 0;
        width: 100vw;
        height: 100dvh;
        min-height: 100vh;
        pointer-events: none;
        overflow: hidden;
        contain: strict;
        background:
          radial-gradient(circle at 50% 42%, rgba(var(--lz-arcade-base-rgb), 0), rgba(var(--lz-arcade-base-rgb), 0.34) 48%, rgba(var(--lz-arcade-base-rgb), var(--lz-arcade-vignette)) 100%),
          linear-gradient(180deg, var(--lz-arcade-base) 0%, var(--lz-arcade-base) 48%, var(--lz-arcade-base) 100%);
        opacity: var(--lz-arcade-opacity);
        color: rgba(var(--lz-arcade-cyan), 0.75);
        transform: translateZ(0);
      }

      #${ROOT_ID} * {
        pointer-events: none;
        box-sizing: border-box;
      }

      .lz-arcade-ambient,
      .lz-arcade-grid,
      .lz-arcade-traces,
      .lz-arcade-particles,
      .lz-arcade-texture {
        position: absolute;
        inset: 0;
        transform: translate3d(var(--lz-arcade-parallax-x), var(--lz-arcade-parallax-y), 0);
        will-change: transform, opacity;
      }

      .lz-arcade-ambient {
        background:
          radial-gradient(circle at 18% 22%, rgba(var(--lz-arcade-cyan), 0.22), transparent 31%),
          radial-gradient(circle at 78% 18%, rgba(var(--lz-arcade-violet), 0.18), transparent 34%),
          radial-gradient(circle at 62% 72%, rgba(var(--lz-arcade-blue), 0.13), transparent 42%),
          conic-gradient(from 120deg at 50% 52%, rgba(var(--lz-arcade-cyan), 0.06), transparent 18%, rgba(var(--lz-arcade-violet), 0.08), transparent 54%, rgba(var(--lz-arcade-blue), 0.05), rgba(var(--lz-arcade-cyan), 0.06));
        filter: blur(2px) saturate(110%);
        animation: lzArcadeAmbient 34s cubic-bezier(0.2, 0.8, 0.2, 1) infinite alternate;
      }

      .lz-arcade-pointer {
        position: absolute;
        left: calc(var(--lz-pointer-x, 50) * 1%);
        top: calc(var(--lz-pointer-y, 45) * 1%);
        width: 34vw;
        max-width: 520px;
        min-width: 260px;
        aspect-ratio: 1;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(var(--lz-arcade-cyan), 0.12), rgba(var(--lz-arcade-violet), 0.06) 38%, transparent 68%);
        opacity: 0;
        transform: translate3d(-50%, -50%, 0);
        transition: opacity 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      html[data-lz-arcade-pointer="true"] .lz-arcade-pointer {
        opacity: 1;
      }

      .lz-arcade-grid {
        top: auto;
        height: 46vh;
        min-height: 230px;
        transform-origin: 50% 100%;
        transform: perspective(620px) rotateX(64deg) translate3d(calc(var(--lz-arcade-parallax-x) * -0.22), 10vh, 0);
        opacity: var(--lz-arcade-grid-opacity);
        background-image:
          linear-gradient(rgba(var(--lz-arcade-cyan), 0.4) 1px, transparent 1px),
          linear-gradient(90deg, rgba(var(--lz-arcade-cyan), 0.34) 1px, transparent 1px);
        background-size: 42px 42px;
        -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.28) 50%, transparent 92%);
        mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.28) 50%, transparent 92%);
        animation: lzArcadeGrid 18s linear infinite;
      }

      .lz-arcade-grid::after {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 8%, rgba(var(--lz-arcade-violet), 0.18), transparent 54%);
      }

      .lz-arcade-traces {
        opacity: var(--lz-arcade-trace-opacity);
        transform: translate3d(calc(var(--lz-arcade-parallax-x) * 0.45), calc(var(--lz-arcade-parallax-y) * 0.45), 0);
      }

      .lz-arcade-traces svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .lz-arcade-ring-a,
      .lz-arcade-ring-b,
      .lz-arcade-circuit {
        fill: none;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }

      .lz-arcade-ring-a {
        stroke: rgba(var(--lz-arcade-cyan), 0.45);
        stroke-width: 1.15;
        stroke-dasharray: 120 34 12 54;
        transform-origin: 18% 34%;
        animation: lzArcadeTraceSpin 72s linear infinite;
      }

      .lz-arcade-ring-b {
        stroke: rgba(var(--lz-arcade-violet), 0.4);
        stroke-width: 1;
        stroke-dasharray: 78 30 8 40;
        transform-origin: 86% 26%;
        animation: lzArcadeTraceSpin 94s linear infinite reverse;
      }

      .lz-arcade-circuit {
        stroke: rgba(var(--lz-arcade-blue), 0.34);
        stroke-width: 1;
        stroke-dasharray: 1 18 74 28;
        animation: lzArcadeTracePulse 12s ease-in-out infinite alternate;
      }

      .lz-arcade-node {
        fill: rgba(var(--lz-arcade-cyan), 0.64);
        filter: drop-shadow(0 0 8px rgba(var(--lz-arcade-cyan), 0.45));
        animation: lzArcadeNodePulse 9s ease-in-out infinite alternate;
      }

      .lz-arcade-particles {
        width: 100%;
        height: 100%;
        opacity: 0.9;
        transform: translate3d(calc(var(--lz-arcade-parallax-x) * 0.7), calc(var(--lz-arcade-parallax-y) * 0.7), 0);
      }

      .lz-arcade-texture {
        opacity: var(--lz-arcade-texture-opacity);
        background-image:
          repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.028) 0 1px, transparent 1px 4px),
          radial-gradient(circle at 22% 18%, rgba(255, 255, 255, 0.035), transparent 22%),
          radial-gradient(circle at 70% 78%, rgba(0, 0, 0, 0.24), transparent 38%);
        mix-blend-mode: screen;
      }

      html[data-lz-background="starfield"] {
        --lz-arcade-grid-opacity: 0;
        --lz-arcade-trace-opacity: 0.06;
        --lz-arcade-texture-opacity: 0.34;
      }

      html[data-lz-background="starfield"] #${ROOT_ID} {
        background:
          radial-gradient(circle at 50% 46%, rgba(var(--lz-arcade-base-rgb), 0), rgba(var(--lz-arcade-base-rgb), 0.28) 46%, rgba(var(--lz-arcade-base-rgb), var(--lz-arcade-vignette)) 100%),
          radial-gradient(circle at 18% 18%, rgba(var(--lz-arcade-cyan), 0.12), transparent 30%),
          radial-gradient(circle at 78% 24%, rgba(var(--lz-arcade-violet), 0.13), transparent 34%),
          linear-gradient(180deg, var(--lz-arcade-base) 0%, var(--lz-arcade-base) 52%, var(--lz-arcade-base) 100%);
      }

      html[data-lz-background="starfield"] .lz-arcade-grid {
        display: none;
      }

      html[data-lz-background="starfield"] .lz-arcade-ambient {
        filter: blur(4px) saturate(108%);
        opacity: 0.86;
      }

      html[data-lz-background="starfield"] .lz-arcade-traces {
        opacity: var(--lz-arcade-trace-opacity);
      }

      html[data-lz-background="starfield"] .lz-arcade-texture {
        background-image:
          radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.84) 0 1px, transparent 1.8px),
          radial-gradient(circle at 30% 68%, rgba(255, 255, 255, 0.56) 0 1px, transparent 1.7px),
          radial-gradient(circle at 70% 28%, rgba(255, 255, 255, 0.72) 0 1px, transparent 1.9px),
          radial-gradient(circle at 84% 76%, rgba(255, 255, 255, 0.48) 0 1px, transparent 1.6px);
        background-size: 180px 160px, 240px 220px, 320px 260px, 420px 320px;
        mix-blend-mode: screen;
      }

      html[data-lz-background="constellation"] {
        --lz-arcade-grid-opacity: 0;
        --lz-arcade-trace-opacity: 0.46;
        --lz-arcade-texture-opacity: 0.2;
      }

      html[data-lz-background="constellation"] .lz-arcade-grid {
        display: none;
      }

      html[data-lz-background="constellation"] .lz-arcade-traces {
        opacity: var(--lz-arcade-trace-opacity);
      }

      html[data-lz-background="topography"] {
        --lz-arcade-grid-opacity: 0;
        --lz-arcade-trace-opacity: 0.16;
        --lz-arcade-texture-opacity: 0.3;
      }

      html[data-lz-background="topography"] #${ROOT_ID} {
        background:
          radial-gradient(circle at 50% 42%, rgba(var(--lz-arcade-base-rgb), 0), rgba(var(--lz-arcade-base-rgb), 0.34) 48%, rgba(var(--lz-arcade-base-rgb), var(--lz-arcade-vignette)) 100%),
          repeating-radial-gradient(ellipse at 50% 44%, rgba(var(--lz-arcade-cyan), 0.22) 0 1px, transparent 1px 21px),
          linear-gradient(180deg, var(--lz-arcade-base) 0%, var(--lz-arcade-base) 48%, var(--lz-arcade-base) 100%);
      }

      html[data-lz-background="topography"] .lz-arcade-grid {
        display: none;
      }

      html[data-lz-background="topography"] .lz-arcade-ambient {
        opacity: 0.42;
      }

      html[data-lz-background="matrix"] {
        --lz-arcade-grid-opacity: 0.16;
      }

      html[data-lz-background="aurora"] {
        --lz-arcade-grid-opacity: 0;
        --lz-arcade-trace-opacity: 0.18;
        --lz-arcade-texture-opacity: 0.14;
      }

      html[data-lz-background="aurora"] #${ROOT_ID} {
        background:
          radial-gradient(circle at 50% 42%, rgba(var(--lz-arcade-base-rgb), 0), rgba(var(--lz-arcade-base-rgb), 0.26) 48%, rgba(var(--lz-arcade-base-rgb), var(--lz-arcade-vignette)) 100%),
          linear-gradient(116deg, transparent 8%, rgba(var(--lz-arcade-cyan), 0.16) 32%, transparent 54%),
          linear-gradient(64deg, transparent 20%, rgba(var(--lz-arcade-violet), 0.15) 52%, transparent 78%),
          linear-gradient(180deg, var(--lz-arcade-base) 0%, var(--lz-arcade-base) 48%, var(--lz-arcade-base) 100%);
      }

      html[data-lz-background="aurora"] .lz-arcade-grid {
        display: none;
      }

      html[data-lz-background="aurora"] .lz-arcade-ambient {
        background:
          linear-gradient(104deg, transparent 8%, rgba(var(--lz-arcade-cyan), 0.2) 34%, transparent 60%),
          linear-gradient(76deg, transparent 20%, rgba(var(--lz-arcade-violet), 0.18) 50%, transparent 74%),
          linear-gradient(124deg, transparent 12%, rgba(var(--lz-arcade-blue), 0.14) 44%, transparent 70%);
        filter: blur(5px) saturate(122%);
        animation-duration: 22s;
      }

      html[data-lz-background="aurora"] .lz-arcade-traces {
        opacity: var(--lz-arcade-trace-opacity);
      }

      html[data-lz-background="circuit"] {
        --lz-arcade-grid-opacity: 0.3;
        --lz-arcade-trace-opacity: 0.52;
        --lz-arcade-texture-opacity: 0.2;
      }

      html[data-lz-background="circuit"] #${ROOT_ID} {
        background:
          radial-gradient(circle at 50% 42%, rgba(var(--lz-arcade-base-rgb), 0), rgba(var(--lz-arcade-base-rgb), 0.32) 48%, rgba(var(--lz-arcade-base-rgb), var(--lz-arcade-vignette)) 100%),
          linear-gradient(180deg, var(--lz-arcade-base) 0%, var(--lz-arcade-base) 48%, var(--lz-arcade-base) 100%);
      }

      html[data-lz-background="circuit"] .lz-arcade-grid {
        background-image:
          linear-gradient(rgba(var(--lz-arcade-cyan), 0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(var(--lz-arcade-cyan), 0.14) 1px, transparent 1px),
          linear-gradient(135deg, transparent 0 44%, rgba(var(--lz-arcade-violet), 0.14) 44.15% 44.5%, transparent 44.65%);
        background-size: 84px 84px, 84px 84px, 280px 220px;
      }

      html[data-lz-background="circuit"] .lz-arcade-texture {
        background-image:
          linear-gradient(90deg, transparent 0 18%, rgba(var(--lz-arcade-blue), 0.12) 18.1% 18.35%, transparent 18.5% 100%),
          linear-gradient(0deg, transparent 0 64%, rgba(var(--lz-arcade-cyan), 0.1) 64.1% 64.35%, transparent 64.5% 100%),
          repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 4px);
        background-size: 320px 220px, 260px 180px, auto;
      }

      html[data-lz-arcade-route="public"] #${ROOT_ID} {
        --lz-arcade-opacity: 0.96;
        --lz-arcade-grid-opacity: 0.28;
        --lz-arcade-trace-opacity: 0.38;
        --lz-arcade-texture-opacity: 0.24;
      }

      html[data-lz-arcade-route="library"] #${ROOT_ID},
      html[data-lz-arcade-route="community"] #${ROOT_ID} {
        --lz-arcade-opacity: 0.72;
        --lz-arcade-grid-opacity: 0.11;
        --lz-arcade-trace-opacity: 0.2;
        --lz-arcade-texture-opacity: 0.16;
      }

      html[data-lz-arcade-route="play"] #${ROOT_ID} {
        --lz-arcade-opacity: 0.38;
        --lz-arcade-grid-opacity: 0.05;
        --lz-arcade-trace-opacity: 0.1;
        --lz-arcade-texture-opacity: 0.1;
      }

      html[data-lz-arcade-route="settings"] #${ROOT_ID} {
        --lz-arcade-opacity: 0.34;
        --lz-arcade-grid-opacity: 0.04;
        --lz-arcade-trace-opacity: 0.08;
        --lz-arcade-texture-opacity: 0.08;
      }

      html[data-lz-arcade-route="play"] .lz-arcade-ambient {
        filter: blur(5px) saturate(94%);
      }

      html[data-lz-arcade-route="play"] .lz-arcade-traces {
        display: none;
      }

      html[data-lz-arcade-route="library"] [data-testid="games-grid"],
      html[data-lz-arcade-route="community"] [data-testid="games-grid"] {
        position: relative;
      }

      html[data-lz-arcade-route="library"] [data-testid="games-grid"]::before,
      html[data-lz-arcade-route="community"] [data-testid="games-grid"]::before {
        content: "";
        position: absolute;
        inset: -18px;
        z-index: -1;
        border-radius: 24px;
        background: radial-gradient(ellipse at 50% 0%, rgba(5, 7, 12, 0.36), rgba(5, 7, 12, 0.18) 52%, transparent 76%);
        pointer-events: none;
      }

      @keyframes lzArcadeAmbient {
        0% { transform: translate3d(-1.2%, -0.8%, 0) scale(1); filter: blur(2px) saturate(108%); }
        48% { transform: translate3d(1.4%, 0.8%, 0) scale(1.035); filter: blur(3px) saturate(116%); }
        100% { transform: translate3d(-0.4%, 1.2%, 0) scale(1.06); filter: blur(2px) saturate(110%); }
      }

      @keyframes lzArcadeGrid {
        from { background-position: 0 0, 0 0; }
        to { background-position: 0 42px, 42px 0; }
      }

      @keyframes lzArcadeTraceSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes lzArcadeTracePulse {
        from { opacity: 0.42; stroke-dashoffset: 0; }
        to { opacity: 0.78; stroke-dashoffset: -70; }
      }

      @keyframes lzArcadeNodePulse {
        from { opacity: 0.34; transform: scale(0.92); }
        to { opacity: 0.76; transform: scale(1); }
      }

      @media (max-width: 700px) {
        #${ROOT_ID} {
          --lz-arcade-opacity: 0.62;
          --lz-arcade-grid-opacity: 0.08;
          --lz-arcade-trace-opacity: 0.14;
        }

        .lz-arcade-grid {
          height: 36vh;
          min-height: 180px;
          background-size: 34px 34px;
        }

        .lz-arcade-ring-b {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #${ROOT_ID},
        #${ROOT_ID} * {
          animation: none !important;
          transition-duration: 0.001ms !important;
        }

        .lz-arcade-particles {
          opacity: 0.16;
        }
      }

      html[data-lz-arcade-paused="true"] #${ROOT_ID} * {
        animation-play-state: paused !important;
      }
    `;
  }

  function routeKind() {
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var signedIn = false;
    try {
      signedIn = !!localStorage.getItem("ugp_token");
    } catch (error) {}
    if (path === "/login" || path === "/register" || path === "/pending") return "public";
    if (!signedIn && path === "/") return "public";
    if (path.indexOf("/zone/") === 0 || path.indexOf("/games/") === 0) return "play";
    if (path === "/chat" || path === "/community" || path === "/party" || path === "/gamemaker" || path === "/suggest" || path === "/owner") return "community";
    if (path === "/settings" || path === "/settings.html") return "settings";
    return "library";
  }

  function particleTargetCount() {
    if (reducedMotion || routeState === "settings") return 0;
    var width = Math.max(window.innerWidth || 0, 320);
    var mobileFactor = width < 720 ? 0.55 : 1;
    var base = routeState === "public" ? 58 : routeState === "play" ? 12 : 34;
    if (backgroundMode === "starfield") base = routeState === "play" ? 18 : routeState === "public" ? 76 : 54;
    else if (backgroundMode === "constellation") base = routeState === "play" ? 10 : 28;
    else if (backgroundMode === "topography") base = routeState === "play" ? 6 : 14;
    else if (backgroundMode === "aurora") base = routeState === "play" ? 8 : routeState === "public" ? 36 : 26;
    else if (backgroundMode === "circuit") base = routeState === "play" ? 10 : routeState === "public" ? 44 : 32;
    return Math.max(8, Math.round(base * mobileFactor));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css();
    document.head.appendChild(style);
  }

  function layerMarkup() {
    return [
      '<div class="lz-arcade-ambient"></div>',
      '<div class="lz-arcade-pointer"></div>',
      '<div class="lz-arcade-grid"></div>',
      '<div class="lz-arcade-traces">',
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">',
      '<ellipse class="lz-arcade-ring-a" cx="12" cy="30" rx="19" ry="27"></ellipse>',
      '<ellipse class="lz-arcade-ring-b" cx="88" cy="24" rx="22" ry="16"></ellipse>',
      '<path class="lz-arcade-circuit" d="M6 72 C20 62 27 66 36 58 S54 38 68 46 S82 68 96 56"></path>',
      '<circle class="lz-arcade-node" cx="30" cy="60" r=".9"></circle>',
      '<circle class="lz-arcade-node" cx="68" cy="46" r=".75"></circle>',
      '<circle class="lz-arcade-node" cx="87" cy="62" r=".65"></circle>',
      '</svg>',
      '</div>',
      '<canvas class="lz-arcade-particles" aria-hidden="true"></canvas>',
      '<div class="lz-arcade-texture"></div>'
    ].join("");
  }

  function ensureLayer() {
    if (!document.body) return null;
    var existing = document.getElementById(ROOT_ID);
    if (existing) return existing;
    var layer = document.createElement("div");
    layer.id = ROOT_ID;
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = layerMarkup();
    document.body.insertBefore(layer, document.body.firstChild);
    return layer;
  }

  function configureRoute() {
    applyBackgroundMode();
    routeState = routeKind();
    document.documentElement.classList.add("lz-midnight-arcade");
    document.documentElement.dataset.lzArcadeRoute = routeState;
    syncParticles();
    updatePausedState();
  }

  function resetParticle(p, first) {
    p.x = first ? Math.random() : (Math.random() < 0.5 ? -0.04 : 1.04);
    p.y = Math.random();
    p.z = 0.35 + Math.random() * 0.9;
    p.vx = (Math.random() - 0.5) * (0.003 + 0.004 * p.z);
    p.vy = (-0.002 - Math.random() * 0.006) * p.z;
    p.size = 0.7 + Math.random() * 1.8 * p.z;
    p.alpha = 0.18 + Math.random() * 0.48;
    p.hue = Math.random() > 0.58 ? "violet" : Math.random() > 0.34 ? "cyan" : "blue";
    p.fragment = false;
  }

  function syncParticles() {
    var target = particleTargetCount();
    while (particles.length < target) {
      var p = {};
      resetParticle(p, true);
      particles.push(p);
    }
    particles.length = target;
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var width = Math.max(1, Math.floor(window.innerWidth * dpr));
    var height = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cssRgbVar(name, fallback) {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(value)) return value;
    } catch (error) {}
    return fallback;
  }

  function particleColors() {
    return {
      cyan: cssRgbVar("--lz-arcade-cyan", "80, 200, 255"),
      violet: cssRgbVar("--lz-arcade-violet", "148, 102, 255"),
      blue: cssRgbVar("--lz-arcade-blue", "72, 118, 255")
    };
  }

  function colorForParticle(p, colors) {
    if (p.hue === "violet") return colors.violet;
    if (p.hue === "blue") return colors.blue;
    return colors.cyan;
  }

  function drawParticles(now) {
    if (!ctx || !canvas) return;
    var width = window.innerWidth || 1;
    var height = window.innerHeight || 1;
    ctx.clearRect(0, 0, width, height);
    if (reducedMotion || !particles.length) return;
    var dt = Math.min(40, Math.max(12, now - lastFrame || 16)) / 16.67;
    var routeAlpha = routeState === "public" ? 1 : routeState === "play" ? 0.45 : 0.7;
    var px = finePointer ? (pointer.x - 0.5) * 12 : 0;
    var py = finePointer ? (pointer.y - 0.5) * 10 : 0;
    var colors = particleColors();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    particles.forEach(function (p) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -0.08 || p.x > 1.08 || p.y < -0.08 || p.y > 1.08) resetParticle(p, false);
      var x = p.x * width + px * p.z;
      var y = p.y * height + py * p.z;
      var rgb = colorForParticle(p, colors);
      var alpha = p.alpha * routeAlpha;
      ctx.fillStyle = "rgba(" + rgb + "," + alpha + ")";
      ctx.shadowColor = "rgba(" + rgb + "," + Math.min(0.42, alpha) + ")";
      ctx.shadowBlur = 8 * p.z;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function tick(now) {
    raf = 0;
    if (!document.documentElement.classList.contains("lz-midnight-arcade")) return;
    if (shouldPauseCanvas()) {
      if (ctx) ctx.clearRect(0, 0, window.innerWidth || 1, window.innerHeight || 1);
      return;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.055;
    pointer.y += (pointer.ty - pointer.y) * 0.055;
    document.documentElement.style.setProperty("--lz-pointer-x", (pointer.x * 100).toFixed(2));
    document.documentElement.style.setProperty("--lz-pointer-y", (pointer.y * 100).toFixed(2));
    document.documentElement.style.setProperty("--lz-arcade-parallax-x", ((pointer.x - 0.5) * -8).toFixed(2) + "px");
    document.documentElement.style.setProperty("--lz-arcade-parallax-y", ((pointer.y - 0.5) * -6).toFixed(2) + "px");
    drawParticles(now);
    lastFrame = now;
    raf = requestAnimationFrame(tick);
  }

  function shouldPauseCanvas() {
    return reducedMotion || document.visibilityState === "hidden" || !!document.fullscreenElement || routeState === "settings";
  }

  function updatePausedState() {
    var paused = shouldPauseCanvas();
    document.documentElement.dataset.lzArcadePaused = paused ? "true" : "false";
    if (!paused && !raf) {
      lastFrame = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function installWatchers() {
    var pointerQuery = window.matchMedia ? window.matchMedia("(pointer: fine)") : null;
    var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    finePointer = !!(pointerQuery && pointerQuery.matches);
    reducedMotion = !!(motionQuery && motionQuery.matches);
    document.documentElement.dataset.lzArcadePointer = finePointer ? "true" : "false";

    if (pointerQuery) {
      var onPointerChange = function () {
        finePointer = pointerQuery.matches;
        document.documentElement.dataset.lzArcadePointer = finePointer ? "true" : "false";
      };
      if (pointerQuery.addEventListener) pointerQuery.addEventListener("change", onPointerChange);
      else if (pointerQuery.addListener) pointerQuery.addListener(onPointerChange);
    }
    if (motionQuery) {
      var onMotionChange = function () {
        reducedMotion = motionQuery.matches;
        syncParticles();
        updatePausedState();
      };
      if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
      else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
    }

    window.addEventListener("pointermove", function (event) {
      if (!finePointer) return;
      pointer.tx = Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth || 1)));
      pointer.ty = Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight || 1)));
      pointer.active = true;
    }, { passive: true });
    window.addEventListener("resize", function () {
      resizeCanvas();
      syncParticles();
    }, { passive: true });
    document.addEventListener("visibilitychange", updatePausedState);
    document.addEventListener("fullscreenchange", updatePausedState);
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        if (!mutations.some(function (mutation) {
          return /^(data-lz-background|data-lz-theme|data-lz-theme-value|data-lz-color-mode)$/.test(mutation.attributeName || "");
        })) return;
        backgroundMode = readBackgroundMode();
        syncParticles();
        updatePausedState();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lz-background", "data-lz-theme", "data-lz-theme-value", "data-lz-color-mode"] });
    }
    window.addEventListener("storage", function (event) {
      if (event.key && event.key !== "ugp_site_settings_v1" && event.key !== "ugp_site_theme") return;
      applyBackgroundMode();
      syncParticles();
      updatePausedState();
    });
    window.addEventListener("learningzones:site-background", function () {
      applyBackgroundMode();
      syncParticles();
      updatePausedState();
    });
    window.addEventListener("learningzones:site-settings", function () {
      applyBackgroundMode();
      syncParticles();
      updatePausedState();
    });
    window.addEventListener("learningzones:site-theme", function () {
      syncParticles();
      updatePausedState();
    });
    window.addEventListener("learningzones:site-appearance", function () {
      applyBackgroundMode();
      syncParticles();
      updatePausedState();
    });

    ["pushState", "replaceState"].forEach(function (method) {
      var original = history[method];
      if (typeof original !== "function" || original.__lzArcadePatched) return;
      history[method] = function () {
        var result = original.apply(this, arguments);
        setTimeout(configureRoute, 80);
        return result;
      };
      history[method].__lzArcadePatched = true;
    });
    window.addEventListener("popstate", function () { setTimeout(configureRoute, 80); });
    window.addEventListener("hashchange", function () { setTimeout(configureRoute, 80); });
  }

  function init() {
    injectStyle();
    var layer = ensureLayer();
    if (!layer) return;
    applyBackgroundMode();
    canvas = layer.querySelector("canvas");
    ctx = canvas && canvas.getContext ? canvas.getContext("2d", { alpha: true }) : null;
    installWatchers();
    resizeCanvas();
    configureRoute();
    updatePausedState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
