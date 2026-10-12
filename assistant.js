/**
 * Помічник сурдо-перекладу (content script).
 * Черга без зациклення: кожне слово грає рівно один раз.
 *
 * Виправлено:
 *  - НЕ створюється в iframe (top window only);
 *  - захист від "Extension context invalidated" (extAlive + обгортки);
 *  - автоматичне прибирання помічника, якщо розширення перезавантажили;
 *  - відновлюється surdoVisible зі сховища;
 *  - бейдж реально показується/ховається (updateBadge);
 *  - немає спалаху у лівому верхньому куті до застосування позиції;
 *  - fingerspell: стабільні ключі __fs_<слово> + LRU-евікція;
 *  - ініціалізація без подвійного виклику setPos.
 */
(function () {
  "use strict";

  // Якщо скрипт випадково запуститься двічі — виходимо
  if (window.__surdoAssistant) return;
  window.__surdoAssistant = true;

  // ⚠️ Не створюємо помічника в iframe — він там непотрібний.
  // reader.js в iframe передає слова через postMessage → top window.
  if (window !== window.top) return;

  /* ---------- Захист від "Extension context invalidated" ---------- */
  function extAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); }
    catch (_) { return false; }
  }

  function safeStorageGet(keys, cb) {
    if (!extAlive() || !chrome.storage?.local?.get) { cb(null); return; }
    try {
      chrome.storage.local.get(keys, (st) => {
        if (chrome.runtime.lastError) { cb(null); return; }
        cb(st || {});
      });
    } catch (_) { cb(null); }
  }

  function safeStorageSet(obj) {
    if (!extAlive() || !chrome.storage?.local?.set) return;
    try { chrome.storage.local.set(obj); } catch (_) {}
  }

  /* ---------- Константи ---------- */
  const SIGN_LANGUAGES = window.SIGN_LANGUAGES || {
    asl: { code: "asl", ready: true, signs: window.SIGNS || {} },
    csl: { code: "csl", ready: false, signs: {} },
  };
  let activeSignLanguage = "asl";
  let SIGNS = SIGN_LANGUAGES.asl?.signs || window.SIGNS || {};
  window.__surdoActiveSignLanguage = activeSignLanguage;
  const DISPLAY_VIEWBOX = { x: -60, y: -45, width: 540, height: 390 };
  const smooth = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, k) => a + (b - a) * k;

  // Параметри кисті локальні відносно зап'ястя (0, 0).
  // Пальці генеруються кодом як заокруглені сегменти, що виростають із долоні.
  const HAND_POSES = {
    open:     { curl: [0, 0, 0, 0], lengths: [0.88, 1, 0.94, 0.82], spread: 1, thumb: "open" },
    flat:     { curl: [0.04, 0.04, 0.04, 0.04], lengths: [0.94, 1, 0.96, 0.9], spread: 0.48, thumb: "open" },
    fist:     { curl: [0.94, 0.94, 0.94, 0.94], lengths: [0.3, 0.28, 0.26, 0.23], spread: 0.12, thumb: "across" },
    point:    { curl: [0, 0.94, 0.94, 0.94], lengths: [1, 0.22, 0.2, 0.18], spread: 0.42, thumb: "across" },
    thumbsup: { curl: [0.94, 0.94, 0.94, 0.94], lengths: [0.22, 0.18, 0.15, 0.12], spread: 0.12, thumb: "up" },
    claw:     { curl: [0.45, 0.42, 0.46, 0.55], lengths: [0.8, 0.84, 0.78, 0.68], spread: 0.78, thumb: "open" },
    relax:    { curl: [0.24, 0.2, 0.22, 0.3], lengths: [0.78, 0.88, 0.82, 0.72], spread: 0.3, thumb: "relaxed" },
    w:        { curl: [0, 0.04, 0.06, 0.94], lengths: [0.98, 0.96, 0.92, 0.22], spread: 0.62, thumb: "across" },
    t:        { curl: [0.94, 0.94, 0.94, 0.94], lengths: [0.28, 0.26, 0.24, 0.22], spread: 0.12, thumb: "tucked" },
    f:        { curl: [0.88, 0.02, 0.04, 0.08], lengths: [0.76, 0.98, 0.94, 0.86], spread: 0.62, thumb: "f" },
    o:        { curl: [0.55, 0.58, 0.62, 0.66], lengths: [0.76, 0.76, 0.72, 0.66], spread: 0.18, thumb: "round" },
    y:        { curl: [0.94, 0.94, 0.94, 0], lengths: [0.24, 0.22, 0.2, 0.98], spread: 0.14, thumb: "open" },
  };

  const THUMB_PATHS = {
    open: "M-22 -30 C-36 -33 -45 -43 -51 -52 C-56 -59 -51 -64 -46 -60 C-39 -55 -34 -49 -27 -46",
    relaxed: "M-22 -31 C-34 -34 -42 -42 -47 -49 C-51 -55 -47 -59 -42 -56 C-36 -52 -31 -47 -26 -44",
    across: "M-23 -32 C-13 -42 1 -45 14 -39 C23 -35 27 -41 21 -48 C14 -55 0 -56 -12 -49",
    tucked: "M-23 -32 C-18 -38 -14 -43 -10 -47 C-6 -51 -7 -56 -12 -56",
    f: "M-22 -30 C-15 -37 -8 -45 0 -51 C5 -55 8 -59 6 -62",
    round: "M-22 -30 C-12 -38 -4 -45 4 -52 C10 -59 4 -65 -4 -63 C-9 -61 -12 -57 -15 -54",
    up: "M-20 -39 C-29 -53 -31 -68 -28 -82 C-26 -92 -14 -93 -11 -82 L-9 -49",
  };

  function lerpPoint(a, b, amount) {
    return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount)];
  }

  function fingerPath(baseX, length, spread, curl) {
    const tipY = -43 - 64 * length;
    const open = [
      [baseX, -43], [baseX + spread * 0.12, -58], [baseX + spread * 0.2, -73],
      [baseX + spread * 0.28, -78], [baseX + spread * 0.45, -84],
      [baseX + spread * 0.8, tipY + 8], [baseX + spread, tipY],
    ];
    const curled = [
      [baseX, -43], [baseX - 5, -55], [baseX - 2, -67], [baseX + 8, -64],
      [baseX + 20, -61], [baseX + 24, -51], [baseX + 8, -50],
    ];
    const p = open.map((point, i) => lerpPoint(point, curled[i], curl));
    return `M${p[0][0]} ${p[0][1]} C${p[1][0]} ${p[1][1]} ${p[2][0]} ${p[2][1]} ${p[3][0]} ${p[3][1]} C${p[4][0]} ${p[4][1]} ${p[5][0]} ${p[5][1]} ${p[6][0]} ${p[6][1]}`;
  }

  function handPoseMarkup(name) {
    const pose = HAND_POSES[name] || HAND_POSES.relax;
    const bases = [-19, -6, 7, 20];
    const fingers = bases.map((baseX, i) => fingerPath(
      baseX,
      pose.lengths[i],
      (i < 2 ? -1 : 1) * pose.spread * (i === 0 || i === 3 ? 10 : 4),
      pose.curl[i]
    ));
    const outlinedFingers = fingers.map((d) =>
      `<path class="finger-outline" d="${d}"/><path class="finger-fill" d="${d}"/>`
    ).join("");
    const thumb = THUMB_PATHS[pose.thumb] || THUMB_PATHS.relaxed;
    const palm = "M-26 -47 C-18 -55 -8 -54 0 -49 C9 -54 20 -51 27 -43 C33 -35 33 -22 32 -11 C34 3 26 15 14 19 L-14 19 C-26 15 -33 4 -31 -11 L-29 -38 C-29 -42 -28 -45 -26 -47 Z";
    const creases = "M-20 -23 Q-5 -30 9 -24 M-14 -9 Q0 -15 14 -9";
    return `<path class="finger-outline" d="${thumb}"/><path class="finger-fill" d="${thumb}"/>${outlinedFingers}<path class="palm-outline" d="${palm}"/><path class="palm-fill" d="${palm}"/><path class="palm-creases" d="${creases}"/>`;
  }

  function extendFingersFromPalm(g) {
    const paths = Array.from(g.querySelectorAll(".finger-outline, .finger-fill"));
    for (const path of paths) {
      const length = path.getTotalLength();
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    }
    requestAnimationFrame(() => {
      for (const path of paths) path.style.strokeDashoffset = "0";
    });
  }

  function sampleFrame(frames, phase) {
    const p = Math.min(1, Math.max(0, phase));
    let i = 0;
    while (i < frames.length - 2 && frames[i + 1].t <= p) i++;
    const a = frames[i], b = frames[i + 1];
    const span = Math.max(0.0001, b.t - a.t);
    const raw = (p - a.t) / span;
    const k = smooth(Math.min(1, Math.max(0, raw)));
    const cross = Math.min(1, Math.max(0, raw * 2.6));
    return {
      pose: a.pose,
      nextPose: a.pose !== b.pose ? b.pose : undefined,
      fade: a.pose !== b.pose ? cross : 0,
      x: lerp(a.x, b.x, k),
      y: lerp(a.y, b.y, k),
      rot: lerp(a.rot, b.rot, k),
      yaw: lerp(a.yaw || 0, b.yaw || 0, k),
    };
  }

  /* ---------------- Shadow DOM ---------------- */
  const host = document.createElement("div");
  host.id = "surdo-assistant-host";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      #root { position: fixed; z-index: 2147483647; pointer-events: none;
              font-family: system-ui, -apple-system, sans-serif; }
      #badge { position: absolute; bottom: 100%; right: 0; margin-bottom: 8px;
               background: rgba(17,24,39,0.88); color: #e5e7eb; font-size: 12px;
               line-height: 1.3; padding: 4px 10px; border-radius: 10px;
               white-space: nowrap; opacity: 0; transition: opacity 0.2s; }
      #badge.on { opacity: 1; }
      #word { position: absolute; bottom: 100%; right: 0; margin-bottom: 8px;
              background: #fff; color: #111827; font-size: 12px; font-weight: 600;
              letter-spacing: 0.04em; padding: 5px 10px; border-radius: 10px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.25); white-space: nowrap;
              max-width: 240px; overflow: hidden; text-overflow: ellipsis;
              opacity: 0; transition: opacity 0.15s; }
      #word.on { opacity: 1; }
      svg { display: block; overflow: visible;
            filter: drop-shadow(0 5px 10px rgba(30,90,200,0.2)); }
      .hand { overflow: visible; }
      .finger-outline { fill: none; stroke: #245fb8; stroke-width: 14;
                        stroke-linecap: round; stroke-linejoin: round; }
      .finger-fill { fill: none; stroke: url(#handFill); stroke-width: 10;
                     stroke-linecap: round; stroke-linejoin: round; }
      .finger-outline, .finger-fill { transition: stroke-dashoffset 220ms cubic-bezier(.2,.75,.25,1); }
      .palm-outline { fill: #397fd5; stroke: #245fb8; stroke-width: 2;
                      stroke-linejoin: round; }
      .palm-fill { fill: url(#handFill); }
      .palm-creases { fill: none; stroke: #d5e7ff; stroke-width: 1.5;
                      stroke-linecap: round; opacity: 0.42; }
      .pose-next { transition: opacity 80ms linear; }
      #hands3d { position: absolute; left: 0; top: 0; z-index: 1;
                  display: none; pointer-events: none;
                  filter: drop-shadow(0 0 5px rgba(76,150,255,0.38))
                          drop-shadow(0 5px 10px rgba(30,90,200,0.2)); }
      #hands3d.idle { animation: surdo-float 3.6s ease-in-out infinite; }
      #char { transform-origin: 210px 150px; }
      #char.idle { animation: surdo-float 3.6s ease-in-out infinite; }
      @keyframes surdo-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-7px); }
      }
      #eyes rect { transform-origin: center; animation: surdo-blink 4.6s infinite; }
      @keyframes surdo-blink {
        0%, 92%, 100% { transform: scaleY(1); }
        95% { transform: scaleY(0.08); }
      }
      #drag { position: absolute; inset: 0; pointer-events: auto;
              cursor: grab; border-radius: 40%; -webkit-user-drag: none; }
      #drag:active { cursor: grabbing; }
    </style>
    <div id="root">
      <div id="badge">Готовий — увімкни субтитри або мікрофон</div>
      <div id="word"></div>
      <svg id="svg" viewBox="${DISPLAY_VIEWBOX.x} ${DISPLAY_VIEWBOX.y} ${DISPLAY_VIEWBOX.width} ${DISPLAY_VIEWBOX.height}" width="260" role="img" aria-label="Помічник сурдо-перекладу">
        <defs>
          <radialGradient id="kimiBall" cx="42%" cy="36%" r="75%">
            <stop offset="0%" stop-color="#9ecbff"/>
            <stop offset="38%" stop-color="#5ea8ff"/>
            <stop offset="72%" stop-color="#2f7df6"/>
            <stop offset="100%" stop-color="#1b5fd9"/>
          </radialGradient>
          <radialGradient id="kimiGlow" cx="50%" cy="50%" r="50%">
            <stop offset="62%" stop-color="#66aaff" stop-opacity="0"/>
            <stop offset="86%" stop-color="#4a90f0" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#3a7de8" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="handFill" cx="38%" cy="28%" r="82%">
            <stop offset="0%" stop-color="#9bc7ff"/>
            <stop offset="42%" stop-color="#629de9"/>
            <stop offset="78%" stop-color="#397fd5"/>
            <stop offset="100%" stop-color="#285fae"/>
          </radialGradient>
        </defs>
        <g id="char" class="idle">
          <circle cx="210" cy="112" r="98" fill="url(#kimiGlow)"/>
          <circle cx="210" cy="112" r="80" fill="url(#kimiBall)"/>
          <g id="eyes">
            <rect x="186" y="72" width="20" height="38" rx="10" fill="#fff"/>
            <rect x="226" y="72" width="20" height="38" rx="10" fill="#fff"/>
          </g>
          <g id="handL" class="hand" style="display:none"></g>
          <g id="handR" class="hand" style="display:none"></g>
        </g>
      </svg>
      <canvas id="hands3d" aria-hidden="true"></canvas>
      <div id="drag" title="Перетягни мене"></div>
    </div>`;

  (document.body || document.documentElement).appendChild(host);

  const root = shadow.getElementById("root");
  const badge = shadow.getElementById("badge");
  const wordEl = shadow.getElementById("word");
  const svg = shadow.getElementById("svg");
  const charG = shadow.getElementById("char");
  const handL = shadow.getElementById("handL");
  const handR = shadow.getElementById("handR");
  const drag = shadow.getElementById("drag");
  const handsCanvas = shadow.getElementById("hands3d");
  let hand3d = null;
  try {
    hand3d = window.SurdoHand3D?.create(handsCanvas) || null;
    if (hand3d) {
      handsCanvas.style.display = "block";
      handsCanvas.classList.add("idle");
    }
  } catch (_) {
    hand3d = null;
  }

  /* ---------------- Стан ---------------- */
  let size = 260;
  let visible = true;
  let signing = false;
  let backlog = [];
  let raf = 0;
  let wordCb = null;
  let lastWordKey = null;
  let positionApplied = false;
  const MAX_BACKLOG = 300;
  const displayWidth = () => size * DISPLAY_VIEWBOX.width / 420;
  const displayHeight = () => size * DISPLAY_VIEWBOX.height / 420;

  function pageApiPost(type, payload = {}) {
    try { window.postMessage({ source: "surdo-assistant-api", type, ...payload }, "*"); } catch (_) {}
  }

  function syncPageState() {
    pageApiPost("state", {
      visible,
      currentWord: lastWordKey,
      queueLength: backlog.length,
    });
  }

  function applySize() {
    const width = displayWidth();
    svg.setAttribute("width", width);
    root.style.width = width + "px";
    if (hand3d) hand3d.resize(width);
  }

  function setPos(x, y) {
    const maxX = Math.max(0, window.innerWidth - displayWidth());
    const maxY = Math.max(0, window.innerHeight - displayHeight());
    root.style.left = Math.min(Math.max(x, 0), maxX) + "px";
    root.style.top = Math.min(Math.max(y, 0), maxY) + "px";
    if (!positionApplied) {
      positionApplied = true;
      root.style.visibility = "visible";
    }
  }

  function resizeTo(px) {
    const x = root.offsetLeft;
    const y = root.offsetTop;
    size = Math.min(520, Math.max(160, Number(px) || 260));
    applySize();
    setPos(x, y);
  }

  function updateBadge() {
    badge.classList.toggle("on", visible && !signing);
    syncPageState();
  }

  function applyDefaults() {
    applySize();
    setPos(window.innerWidth - displayWidth() - 24, window.innerHeight - displayHeight() - 24);
    updateBadge();
  }

  root.style.visibility = "hidden";

  safeStorageGet(
    ["surdoSize", "surdoX", "surdoY", "surdoVisible"],
    (st) => {
      if (!st) { applyDefaults(); return; }
      if (typeof st.surdoVisible === "boolean") {
        visible = st.surdoVisible;
        root.style.display = visible ? "" : "none";
      }
      if (st.surdoSize) { size = st.surdoSize; }
      applySize();
      if (st.surdoX != null) setPos(st.surdoX, st.surdoY);
      else setPos(window.innerWidth - size - 24, window.innerHeight - size * 1.15);
      updateBadge();
    }
  );

  function renderHand(g, pose, mirror, side) {
    // The hands exchange screen sides, so mirror both their paths and handshape orientation.
    if (pose) {
      pose = { ...pose, x: -(pose.x || 0), rot: -(pose.rot || 0), yaw: -(pose.yaw || 0) };
      mirror = !mirror;
    }
    if (hand3d) {
      g.style.display = "none";
      g.removeAttribute("data-render-key");
      hand3d.setHand(side, pose, mirror, HAND_POSES);
      hand3d.render();
      return;
    }
    if (!pose) {
      g.style.display = "none";
      g.removeAttribute("data-render-key");
      return;
    }

    // Swap screen positions: the logical left hand is displayed on the right and vice versa.
    const base = side === "left" ? { x: 324, y: 218 } : { x: 96, y: 218 };
    // Keep the full hand silhouette inside the expanded -60..480, -45..345 canvas.
    const wristX = Math.min(410, Math.max(10, base.x + pose.x));
    const wristY = Math.min(330, Math.max(50, base.y + pose.y));

    g.style.display = "";
    const handScale = 0.78;
    const yawScale = Math.max(0.28, Math.cos((pose.yaw || 0) * Math.PI / 180));
    g.setAttribute("transform", `translate(${wristX} ${wristY}) rotate(${pose.rot}) scale(${yawScale * handScale} ${handScale})`);
    const currentName = HAND_POSES[pose.pose] ? pose.pose : "relax";
    const nextName = HAND_POSES[pose.nextPose] ? pose.nextPose : "";
    const renderKey = `${currentName}|${nextName}|${mirror ? "m" : "n"}`;
    if (g.getAttribute("data-render-key") !== renderKey) {
      const reflected = mirror ? `<g transform="scale(-1 1)">` : "<g>";
      let markup = `${reflected}<g class="pose-current">${handPoseMarkup(currentName)}</g>`;
      if (nextName) markup += `<g class="pose-next">${handPoseMarkup(nextName)}</g>`;
      markup += "</g>";
      g.innerHTML = markup;
      g.setAttribute("data-render-key", renderKey);
      extendFingersFromPalm(g);
    }
    const nextPoseGroup = g.querySelector(".pose-next");
    if (nextPoseGroup) nextPoseGroup.style.opacity = String(Math.max(0, Math.min(1, pose.fade || 0)));
  }

  // Спокійна поза: обидві руки завжди видимі (раніше ховалися між жестами).
  const IDLE_FRAME = { pose: "relax", x: 0, y: 0, rot: 0, yaw: 0, t: 0 };

  function renderIdleHands() {
    renderHand(handL, IDLE_FRAME, true, "left");
    renderHand(handR, IDLE_FRAME, false, "right");
    if (hand3d) hand3d.render();
  }

  function stopPlayback() {
    cancelAnimationFrame(raf);
    signing = false;
    backlog = [];
    lastWordKey = null;
    renderIdleHands();
    charG.classList.add("idle");
    handsCanvas.classList.add("idle");
    wordEl.classList.remove("on");
    updateBadge();
    syncPageState();
  }

  function emitWord(key) {
    const s = SIGNS[key];
    const publicKey = s?._unsupported ? s.originalWord : key;
    lastWordKey = publicKey;
    wordEl.textContent = s?._unsupported
      ? `${s.originalWord} · ${s.message}`
      : (s ? `${s.en}${s.native ? ` · ${s.native}` : ""}${s._fingerspelled ? " · fingerspelled" : ""}` : key);
    wordEl.classList.add("on");
    try { wordCb && wordCb(publicKey); } catch (e) {}
    pageApiPost("word", { key: publicKey, supported: !s?._unsupported });
    syncPageState();
  }

  /* Fingerspell-кеш: стабільні ключі + LRU-евікція. */
  const FS_MAX = 200;
  const fsKeys = new Map();
  const UNSUPPORTED_MAX = 100;
  const unsupportedKeys = new Map();

  function setSignLanguage(language) {
    const next = language === "csl" ? "csl" : "asl";
    if (next === activeSignLanguage) return;
    stopPlayback();
    activeSignLanguage = next;
    SIGNS = SIGN_LANGUAGES[next]?.signs || {};
    window.SIGNS = SIGNS;
    window.__surdoActiveSignLanguage = activeSignLanguage;
    fsKeys.clear();
    unsupportedKeys.clear();
    try { pageApiPost("signs", { signs: JSON.parse(JSON.stringify(SIGNS)) }); } catch (_) {}
    pageApiPost("language", { language: activeSignLanguage });
    window.dispatchEvent(new Event("surdo-language-change"));
  }

  if (extAlive()) {
    safeStorageGet(["surdoPair", "surdoSignLang"], (st) => {
      setSignLanguage(st?.surdoPair === "zh-csl" || st?.surdoSignLang === "csl" ? "csl" : "asl");
    });
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const pairChanged = changes.surdoPair;
        const signLangChanged = changes.surdoSignLang;
        if (!pairChanged && !signLangChanged) return;
        const value = pairChanged ? pairChanged.newValue : signLangChanged.newValue;
        setSignLanguage(value === "zh-csl" || value === "csl" ? "csl" : "asl");
      });
    } catch (_) {}
  }

  function unsupportedSignKey(rawWord) {
    const originalWord = String(rawWord || "слово").slice(0, 80);
    const normalized = originalWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") || "word";
    const key = "__unsupported_" + normalized;
    if (!SIGNS[key]) {
      if (unsupportedKeys.size >= UNSUPPORTED_MAX) {
        const oldest = unsupportedKeys.keys().next().value;
        unsupportedKeys.delete(oldest);
        delete SIGNS[oldest];
      }
      SIGNS[key] = {
        en: originalWord,
        message: activeSignLanguage === "csl" ? "CSL sign unavailable" : "ASL sign unavailable",
        dur: 1400,
        right: [
          { pose: "relax", x: 0, y: 0, rot: 0, t: 0 },
          { pose: "relax", x: 0, y: 0, rot: 0, t: 1 },
        ],
        _unsupported: true,
        originalWord,
      };
    } else {
      SIGNS[key].originalWord = originalWord;
    }
    unsupportedKeys.delete(key);
    unsupportedKeys.set(key, true);
    return key;
  }

  function expandWords(keys) {
    const out = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const current = String(k).toLowerCase().replace(/['’`]/g, "");
      const next = String(keys[i + 1] ?? "").toLowerCase().replace(/['’`]/g, "");
      if (current === "thank" && next === "you") {
        out.push("thankyou");
        i++;
        continue;
      }
      if (current === "i" && SIGNS.me) {
        out.push("me");
        continue;
      }
      if (SIGNS[k]) { out.push(k); continue; }
      const originalWord = String(k).trim().slice(0, 80);
      const word = originalWord.toLowerCase().replace(/['’`]/g, "");
      if (!word) continue;
      if (activeSignLanguage !== "asl") {
        out.push(unsupportedSignKey(originalWord));
        continue;
      }
      // ASL-пальцева анімація тут існує лише для латинки; кирилиця не є перекладом УЖМ.
      if (!/^[a-z]+$/.test(word) || word.length > 40) {
        out.push(unsupportedSignKey(originalWord));
        continue;
      }

      const key = "__fs_" + word;
      if (!SIGNS[key]) {
        const fs = window.__surdoFingerspell?.(word);
        if (!fs) {
          out.push(unsupportedSignKey(originalWord));
          continue;
        }
        if (fsKeys.size >= FS_MAX) {
          const oldest = fsKeys.keys().next().value;
          fsKeys.delete(oldest);
          delete SIGNS["__fs_" + oldest];
        }
        SIGNS[key] = fs;
        fsKeys.set(word, true);
      } else if (!fsKeys.has(word)) {
        fsKeys.set(word, true);
      }
      out.push(key);
    }
    return out;
  }

  function playWords(keys) {
    if (!Array.isArray(keys)) return;
    if (activeSignLanguage === "csl" && !Object.keys(SIGNS).length) return;
    const expanded = expandWords(keys);
    if (!expanded.length) return;
    const room = Math.max(0, MAX_BACKLOG - backlog.length);
    backlog.push(...expanded.slice(0, room));
    syncPageState();
    if (!signing) drainBacklog();
  }

  function drainBacklog() {
    if (!backlog.length) {
      signing = false;
      charG.classList.add("idle");
      handsCanvas.classList.add("idle");
      renderIdleHands();
      wordEl.classList.remove("on");
      updateBadge();
      syncPageState();
      return;
    }

    const key = backlog.shift();
    syncPageState();
    const sign = SIGNS[key];
    if (!sign) { drainBacklog(); return; }

    signing = true;
    charG.classList.remove("idle");
    handsCanvas.classList.remove("idle");
    updateBadge();
    emitWord(key);

    const start = performance.now();
    const tick = (now) => {
      if (!signing) return;
      const phase = (now - start) / sign.dur;
      if (phase >= 1) {
        renderIdleHands();
        drainBacklog();
        return;
      }
      renderHand(handR, sampleFrame(sign.right, phase), false, "right");
      renderHand(handL, sign.left ? sampleFrame(sign.left, phase) : null, true, "left");
      raf = requestAnimationFrame(tick);
    };
    tick(start);
  }

  /* ---------------- Перетягування ---------------- */
  let dragging = null;
  drag.addEventListener("pointerdown", (e) => {
    dragging = { dx: e.clientX - root.offsetLeft, dy: e.clientY - root.offsetTop };
    drag.setPointerCapture(e.pointerId);
  });
  drag.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setPos(e.clientX - dragging.dx, e.clientY - dragging.dy);
  });
  drag.addEventListener("pointerup", () => {
    dragging = null;
    safeStorageSet({ surdoX: root.offsetLeft, surdoY: root.offsetTop });
  });
  drag.addEventListener("pointercancel", () => { dragging = null; });
  drag.addEventListener("lostpointercapture", () => { dragging = null; });
  window.addEventListener("resize", () => {
    if (!positionApplied) return;
    setPos(root.offsetLeft, root.offsetTop);
    safeStorageSet({ surdoX: root.offsetLeft, surdoY: root.offsetTop });
  });

  /* ---------------- Повідомлення від popup ---------------- */
  if (extAlive()) {
    try {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || msg.source !== "surdo-popup") return;
        if (msg.type === "setLanguage") {
          setSignLanguage(msg.language);
          sendResponse({ ok: true, language: activeSignLanguage, signCount: Object.keys(SIGNS).length });
        } else if (msg.type === "setSize") {
          resizeTo(msg.px);
          safeStorageSet({ surdoSize: size });
        } else if (msg.type === "setVisible") {
          visible = !!msg.value;
          root.style.display = visible ? "" : "none";
          updateBadge();
          syncPageState();
        } else if (msg.type === "demo") {
          visible = true;
          root.style.display = "";
          updateBadge();
          syncPageState();
          playWords(activeSignLanguage === "csl"
            ? ["嗨", "抱歉", "妈妈", "谢谢"]
            : ["hello", "water", "family", "book", "home", "play"]);
        } else if (msg.type === "stop") {
          stopPlayback();
        }
      });
    } catch (_) {}
  }

  applySize();

  /* ---------------- Публічне API ---------------- */
  window.surdo = {
    show() { visible = true; root.style.display = ""; updateBadge(); syncPageState(); },
    hide() { visible = false; root.style.display = "none"; updateBadge(); syncPageState(); },
    toggle() { visible ? this.hide() : this.show(); return visible; },
    isVisible: () => visible,
    setSize(px) { resizeTo(px); },
    setPosition(x, y) { setPos(x, y); },
    signWords: playWords,
    sign(key) { playWords([key]); },
    stop: stopPlayback,
    onWord(cb) { wordCb = cb; },
    get currentWord() { return lastWordKey; },
    get queueLength() { return backlog.length; },
    getHandPoints(side = "right") { return hand3d?.getLandmarks(side) || null; },
    get SIGNS() { return SIGNS; },
    get language() { return activeSignLanguage; },
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "surdo-page-api" || event.data.type !== "command") return;
    const { method, args } = event.data;
    const values = Array.isArray(args) ? args : [];
    if (method === "signWords" && Array.isArray(values[0]) && values[0].length <= MAX_BACKLOG) {
      const words = values[0].filter((word) => typeof word === "string" && word.length <= 80);
      playWords(words);
    } else if (method === "sign" && typeof values[0] === "string" && values[0].length <= 80) {
      playWords([values[0]]);
    } else if (method === "getHandPoints" && ["left", "right"].includes(values[0]) && Number.isSafeInteger(values[1])) {
      pageApiPost("handPoints", {
        requestId: values[1],
        points: hand3d?.getLandmarks(values[0]) || null,
      });
    } else if (method === "stop") {
      stopPlayback();
    } else if (method === "show") {
      window.surdo.show();
    } else if (method === "hide") {
      window.surdo.hide();
    } else if (method === "toggle") {
      window.surdo.toggle();
    } else if (method === "setSize" && Number.isFinite(values[0])) {
      resizeTo(values[0]);
    } else if (method === "setPosition" && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
      setPos(values[0], values[1]);
    }
  });

  pageApiPost("ready");
  try { pageApiPost("signs", { signs: JSON.parse(JSON.stringify(SIGNS)) }); } catch (_) {}
  syncPageState();

  /* ---------------- Автоприбирання при інвалідації контексту ---------------- */
  const contextWatch = setInterval(() => {
    if (!extAlive()) {
      clearInterval(contextWatch);
      try { stopPlayback(); } catch (_) {}
      try { host.remove(); } catch (_) {}
      window.__surdoAssistant = false;
    }
  }, 2000);
})();
