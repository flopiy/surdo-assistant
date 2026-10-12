/* Дозволений сторінковий API для власних скриптів користувача. */
(() => {
  "use strict";
  if (window !== window.top) return;

  let ready = false;
  const waiting = [];
  const wordCallbacks = new Set();
  const pointRequests = new Map();
  let nextPointRequestId = 0;
  const state = { visible: true, currentWord: null, queueLength: 0, language: "asl" };
  let signsDictionary = {};

  function post(command) {
    try { window.postMessage({ source: "surdo-page-api", ...command }, "*"); } catch (_) {}
  }

  function invoke(method, args = []) {
    const command = { type: "command", method, args };
    if (!ready) {
      if (waiting.length < 100) waiting.push(command);
      return;
    }
    post(command);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "surdo-assistant-api") return;
    const msg = event.data;
    if (msg.type === "ready") {
      ready = true;
      while (waiting.length) post(waiting.shift());
    } else if (msg.type === "state") {
      if (typeof msg.visible === "boolean") state.visible = msg.visible;
      state.currentWord = typeof msg.currentWord === "string" ? msg.currentWord : null;
      state.queueLength = Number.isFinite(msg.queueLength) ? msg.queueLength : 0;
    } else if (msg.type === "word" && typeof msg.key === "string") {
      for (const callback of wordCallbacks) {
        try { callback(msg.key); } catch (_) {}
      }
    } else if (msg.type === "handPoints" && Number.isSafeInteger(msg.requestId)) {
      const pending = pointRequests.get(msg.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      pointRequests.delete(msg.requestId);
      const points = Array.isArray(msg.points) && msg.points.length === 21
        ? msg.points.map((point) => ({
            id: Number(point.id), x: Number(point.x), y: Number(point.y), z: Number(point.z),
          }))
        : null;
      pending.resolve(points);
    } else if (msg.type === "language" && ["asl", "csl"].includes(msg.language)) {
      state.language = msg.language;
    } else if (msg.type === "signs" && msg.signs && typeof msg.signs === "object") {
      signsDictionary = Object.freeze(msg.signs);
      if (!Object.prototype.hasOwnProperty.call(window, "SIGNS")) {
        try {
          Object.defineProperty(window, "SIGNS", {
            get: () => signsDictionary, enumerable: false, configurable: false,
          });
        } catch (_) {}
      }
    }
  });

  const api = Object.freeze({
    signWords(words) {
      if (Array.isArray(words) && words.length <= 300 && words.every((w) => typeof w === "string" && w.length <= 80)) {
        invoke("signWords", [words]);
      }
    },
    sign(key) { if (typeof key === "string" && key.length <= 80) invoke("sign", [key]); },
    stop() { invoke("stop"); },
    show() { invoke("show"); },
    hide() { invoke("hide"); },
    toggle() { invoke("toggle"); return !state.visible; },
    isVisible() { return state.visible; },
    setSize(px) { if (Number.isFinite(Number(px))) invoke("setSize", [Number(px)]); },
    setPosition(x, y) {
      if (Number.isFinite(Number(x)) && Number.isFinite(Number(y))) invoke("setPosition", [Number(x), Number(y)]);
    },
    getHandPoints(side = "right") {
      const safeSide = side === "left" ? "left" : "right";
      return new Promise((resolve) => {
        if (pointRequests.size >= 64) { resolve(null); return; }
        const requestId = ++nextPointRequestId;
        const timer = setTimeout(() => {
          pointRequests.delete(requestId);
          resolve(null);
        }, 2500);
        pointRequests.set(requestId, { resolve, timer });
        invoke("getHandPoints", [safeSide, requestId]);
      });
    },
    onWord(callback) {
      if (typeof callback !== "function") return () => {};
      wordCallbacks.add(callback);
      return () => wordCallbacks.delete(callback);
    },
    get currentWord() { return state.currentWord; },
    get queueLength() { return state.queueLength; },
    get language() { return state.language; },
    get SIGNS() { return signsDictionary; },
  });

  try {
    if (!Object.prototype.hasOwnProperty.call(window, "surdo")) {
      Object.defineProperty(window, "surdo", { value: api, enumerable: false, configurable: false });
    } else if (!Object.prototype.hasOwnProperty.call(window, "surdoAssistant")) {
      Object.defineProperty(window, "surdoAssistant", { value: api, enumerable: false, configurable: false });
    }
  } catch (_) {
    try { window.surdoAssistant = api; } catch (_) {}
  }
})();
