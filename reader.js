/**
 * reader.js — читає слова зі сторінки (DOM-субтитри)
 * та відстежує стан відеоплеєра (play/pause/seeking).
 */
(function () {
  "use strict";
  if (window.__surdoReader) return;
  window.__surdoReader = true;

  const isTop = window === window.top;
  let activeFrameId = 0;

  function extAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); }
    catch (_) { return false; }
  }

  /* ---------- Спільна черга ---------- */
  const pending = [];
  let flushTimer = 0;
  let lastFlushAt = 0;
  let flushRetries = 0;
  const MAX_PENDING = 300;

  const STOP = new Set(["", " ", ".", ",", "!", "?", "-", "—", "…", ":", ";"]);

  function normalize(w) {
    if (languagePair === "zh-csl") {
      return String(w).toLowerCase().replace(/[^\p{Script=Han}\p{N}]/gu, "").trim();
    }
    return w
      .toLowerCase()
      .replace(/['’`]/g, "")
      .replace(/[^a-zа-яїієґ]/gi, "")
      .trim();
  }

  function postToTop(msg) {
    if (isTop) return;
    if (!extAlive()) return;
    try {
      chrome.runtime.sendMessage({ source: "surdo-reader", ...msg }).catch(() => {});
    } catch (_) {}
  }

  function flush() {
    flushTimer = 0;
    if (!pending.length) return;
    const words = pending.splice(0, pending.length);
    lastFlushAt = performance.now();

    if (isTop) {
      if (window.surdo?.signWords) {
        activeFrameId = 0;
        flushRetries = 0;
        window.surdo.signWords(words);
      } else if (flushRetries < 25) {
        // assistant.js ще не завантажився (або впав) — чекаємо, але не вічно:
        // після 25 спроб (~5 с) здаємось, щоб не крутити таймер нескінченно.
        flushRetries++;
        pending.unshift(...words);
        flushTimer = setTimeout(flush, 200);
      } else {
        // Скидаємо накопичене, щоб pending не залишався повним назавжди.
        flushRetries = 0;
        reportStatus();
      }
    } else {
      // ПЕРЕДАЧА СЛІВ З IFRAME У ГОЛОВНЕ ВІКНО
      postToTop({ type: "words", words });
    }
  }

  const domDedup = { value: "", at: 0 };
  let sourceMode = "dom";
  let sourceReady = false;
  let languagePair = "en-asl";

  function setSourceMode(value) {
    const next = ["dom", "mic", "both"].includes(value) ? value : "dom";
    const replayCurrent = (!sourceReady || next !== sourceMode) && (next === "dom" || next === "both");
    sourceMode = next;
    sourceReady = true;
    setTimeout(() => {
      if (replayCurrent) {
        for (const el of bound) {
          el.__surdoLastText = "";
          handleCaptionContainer(el);
        }
        for (const video of document.querySelectorAll("video")) {
          const tracks = video.textTracks;
          for (let i = 0; tracks && i < tracks.length; i++) {
            tracks[i].__surdoLastText = "";
            handleTrackCues(tracks[i]);
          }
        }
      }
      reportStatus();
    }, 0);
  }

  if (extAlive()) {
    try {
      chrome.storage.local.get(["surdoSource", "surdoPair"], (st) => {
        if (chrome.runtime.lastError) { setSourceMode("dom"); return; }
        setSourceMode(st?.surdoSource || "dom");
        languagePair = st?.surdoPair === "zh-csl" ? "zh-csl" : "en-asl";
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.surdoSource) {
          setSourceMode(changes.surdoSource.newValue);
        }
        if (area === "local" && changes.surdoPair) {
          languagePair = changes.surdoPair.newValue === "zh-csl" ? "zh-csl" : "en-asl";
        }
      });
    } catch (_) { setSourceMode("dom"); }
  } else {
    setSourceMode("dom");
  }

  window.addEventListener("surdo-language-change", () => {
    if (sourceMode !== "dom" && sourceMode !== "both") return;
    for (const el of bound) {
      el.__surdoLastText = "";
      handleCaptionContainer(el);
    }
    for (const video of document.querySelectorAll("video")) {
      const tracks = video.textTracks;
      for (let i = 0; tracks && i < tracks.length; i++) {
        tracks[i].__surdoLastText = "";
        handleTrackCues(tracks[i]);
      }
    }
  });

  function pushText(text, { minGap = 300, dedupKey = null, source = "dom" } = {}) {
    const expectedSignLanguage = languagePair === "zh-csl" ? "csl" : "asl";
    if (window.__surdoActiveSignLanguage !== expectedSignLanguage) return;
    if (source !== "manual") {
      if (!sourceReady) return;
      if (sourceMode !== "both" && sourceMode !== source) return;
    }
    if (!text) return;
    const clean = text.trim();
    if (dedupKey) {
      const now = performance.now();
      if (clean === dedupKey.value && now - (dedupKey.at || 0) < 900) return;
      dedupKey.value = clean;
      dedupKey.at = now;
    }

    let words;
    if (languagePair === "zh-csl" && typeof Intl.Segmenter === "function") {
      const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
      words = [...segmenter.segment(clean)]
        .filter((part) => part.isWordLike)
        .map((part) => normalize(part.segment))
        .filter(Boolean);
    } else {
      words = clean.split(/\s+/).map(normalize).filter((w) => w && !STOP.has(w));
    }
    if (!words.length) return;

    pending.push(...words);
    if (pending.length > MAX_PENDING) {
      pending.splice(0, pending.length - MAX_PENDING);
    }

    clearTimeout(flushTimer);
    const wait = Math.max(120, minGap - (performance.now() - lastFlushAt));
    flushTimer = setTimeout(flush, wait);
  }

  /* ---------- Відстеження стану HTML5 Video ---------- */
  let pauseTimer = 0;

  function hardReset(force = false) {
    clearTimeout(pauseTimer);
    clearTimeout(flushTimer); // СКИДАННЯ ТАЙМЕРА
    flushTimer = 0;
    pending.length = 0;
    domDedup.value = "";
    domDedup.at = 0;
    if (!force && sourceMode === "mic") return;
    if (isTop) {
      if (force || activeFrameId === 0) {
        activeFrameId = 0;
        try { window.surdo?.stop(); } catch (_) {}
      }
    } else {
      postToTop({ type: "stop" });
    }
  }

  function handleVideoEvents(video) {
    if (video.__surdoBound) return;
    video.__surdoBound = true;

    const bindTextTracks = () => {
      let tracks;
      try { tracks = video.textTracks; } catch (_) { return; }
      if (!tracks) return;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.__surdoBound) continue;
        track.__surdoBound = true;
        track.addEventListener("cuechange", () => handleTrackCues(track));
        handleTrackCues(track);
      }
      reportStatus();
    };

    video.addEventListener("loadedmetadata", bindTextTracks);
    video.addEventListener("play", bindTextTracks);
    try { video.textTracks?.addEventListener("addtrack", bindTextTracks); } catch (_) {}
    bindTextTracks();

    video.addEventListener("seeking", () => hardReset());
    video.addEventListener("emptied", () => hardReset());

    video.addEventListener("pause", () => {
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => hardReset(), 600);
    });

    video.addEventListener("play", () => {
      clearTimeout(pauseTimer);
    });
  }

  function scanVideos() {
    document.querySelectorAll("video").forEach(handleVideoEvents);
  }

  /* ---------- DOM-субтитри ---------- */
  const SUBTITLE_SELECTORS = [
    ".ytp-caption-segment",              // YouTube
    ".caption-visual-line",              // YouTube (рядки)
    ".ytp-caption-window-container",     // YouTube (контейнер)
    ".vjs-text-track-display",           // Video.js
    ".jw-text-track-container",          // JW Player
    ".shaka-text-container",             // Shaka Player
    "[class*='subtitle']",
    "[class*='caption']",
  ];

  const MAX_OBSERVED = 200;
  const bound = new Set();
  const captionObservers = new Map();
  let lastReportedStatus = "";
  let statusTimer = 0;

  function getReaderStatus() {
    let videoCount = 0;
    let textTrackCount = 0;
    let activeTrackCount = 0;
    try {
      const videos = [...document.querySelectorAll("video")];
      videoCount = videos.length;
      for (const video of videos) {
        const tracks = video.textTracks;
        textTrackCount += tracks?.length || 0;
        for (let i = 0; tracks && i < tracks.length; i++) {
          if (tracks[i].activeCues?.length) activeTrackCount++;
        }
      }
    } catch (_) {}
    let activeCaptionCount = 0;
    for (const el of bound) {
      if (el.isConnected && (el.textContent || "").trim()) activeCaptionCount++;
    }
    return {
      sourceMode,
      isTop,
      videoCount,
      textTrackCount,
      activeTrackCount,
      captionNodes: bound.size,
      activeCaptionCount,
    };
  }

  function reportStatus(force = false) {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusTimer = 0;
      const status = getReaderStatus();
      const signature = JSON.stringify(status);
      if ((!force && signature === lastReportedStatus) || !extAlive()) return;
      lastReportedStatus = signature;
      try {
        chrome.runtime.sendMessage({ source: "surdo-reader-status", type: "update", status }).catch(() => {});
      } catch (_) {}
    }, 100);
  }

  function handleCaptionText(el, rawText) {
    const text = (rawText || "").replace(/\s+/g, " ").trim();
    if (!text) {
      el.__surdoLastText = "";
      reportStatus();
      return;
    }
    if (text.length > 500) return;

    const last = el.__surdoLastText || "";
    if (text === last) return;

    let newPart = "";
    if (!last) {
      newPart = text;
    } else if (text.startsWith(last)) {
      newPart = text.slice(last.length).trim();
    } else {
      const lastWords = last.split(/\s+/);
      const textWords = text.split(/\s+/);
      let commonPrefix = 0;
      while (
        commonPrefix < lastWords.length &&
        commonPrefix < textWords.length &&
        lastWords[commonPrefix] === textWords[commonPrefix]
      ) {
        commonPrefix++;
      }
      newPart = textWords.slice(commonPrefix).join(" ");
    }

    el.__surdoLastText = text;
    if (newPart) pushText(newPart, { minGap: 250, dedupKey: domDedup, source: "dom" });
    reportStatus();
  }

  function handleCaptionContainer(el) {
    handleCaptionText(el, el.textContent || "");
  }

  function handleTrackCues(track) {
    let text = "";
    try {
      text = Array.from(track.activeCues || []).map((cue) => cue.text || "").join(" ");
    } catch (_) {}
    handleCaptionText(track, text);
  }

  function attachTo(el, priority = false) {
    if (el.__surdoBound) return;
    if (bound.size >= MAX_OBSERVED) {
      if (!priority) return;
      const generic = [...bound].find((candidate) => candidate.__surdoGeneric);
      if (!generic) return;
      captionObservers.get(generic)?.disconnect();
      captionObservers.delete(generic);
      generic.__surdoBound = false;
      bound.delete(generic);
    }
    el.__surdoBound = true;
    el.__surdoGeneric = !priority;
    bound.add(el);

    const update = () => handleCaptionContainer(el);
    update();

    const observer = new MutationObserver(update);
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    captionObservers.set(el, observer);
  }

  let scanScheduled = false;
  function scanNow() {
    scanScheduled = false;
    for (const el of bound) {
      if (!el.isConnected) {
        captionObservers.get(el)?.disconnect();
        captionObservers.delete(el);
        el.__surdoBound = false;
        bound.delete(el);
      }
    }
    scanVideos();
    for (const sel of SUBTITLE_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (sel.startsWith("[class*=")) {
          const text = (el.textContent || "").trim();
          if (!text || text.length > 500) return;
          // Не спостерігай за батьківським контейнером, якщо вже є
          // вкладений caption-вузол — інакше той самий текст дублюється.
          if (el.querySelector("[class*='subtitle'], [class*='caption']")) return;
        }
        attachTo(el, !sel.startsWith("[class*="));
      });
    }
    reportStatus();
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(scanNow, 250);
  }

  scanNow();
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (extAlive()) {
    const speechDedup = { value: "" };
    try {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || msg.source !== "surdo-bg") return;
        if (msg.type === "readerStatusRefresh") {
          reportStatus(true);
          sendResponse({ ok: true, status: getReaderStatus() });
          return;
        }
        if (!isTop) return;
        if (msg.type === "transcript" && msg.final) {
          pushText(msg.text, { minGap: 500, dedupKey: speechDedup, source: "mic" });
        } else if (msg.type === "readerWords" && Array.isArray(msg.words)) {
          activeFrameId = Number(msg.frameId) || 0;
          // Слова з iframe вже нормалізовані (для zh-csl — у Han-токени).
          window.surdo?.signWords(msg.words);
          sendResponse({ ok: true });
        } else if (msg.type === "readerStop" && Number(msg.frameId) === activeFrameId) {
          activeFrameId = 0;
          window.surdo?.stop();
          sendResponse({ ok: true });
        }
      });
    } catch (_) {}
  }

  window.surdoReader = {
    getStatus: getReaderStatus,
    feed(text) {
      domDedup.value = "";
      domDedup.at = 0;
      pushText(text, { minGap: 0, dedupKey: domDedup, source: "manual" });
    },
    reset: () => hardReset(true),
    isTop,
  };
})();
