/**
 * offscreen.js — SpeechRecognition у фоні.
 * Виправлено:
 *  - send() більше не дає unhandled promise rejection (ваші "Uncaught (in promise)");
 *  - рестарт не може мовчки померти: backoff-ретрай продовжується, поки running;
 *  - audio-capture (відсутній мікрофон) теж фатальна помилка.
 */

let rec = null;
let running = false;
let restartDelay = 300;          // мс
const RESTART_DELAY_MIN = 300;
const RESTART_DELAY_MAX = 8000;
let lastStartAt = 0;

// Помилки, після яких немає сенсу перезапускати
const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
]);

function send(msg) {
  // ВАЖЛИВО: помилка sendMessage приходить як відмова промісу,
  // try/catch тут не спрацює — обов'язково .catch()
  chrome.runtime
    .sendMessage({ source: "surdo-offscreen", ...msg })
    .catch(() => {});
}

function scheduleRestart() {
  if (!running) return;
  setTimeout(() => {
    if (!running || !rec) return;
    try {
      rec.start();
    } catch (e) {
      // start() кинув — подвоюємо backoff і пробуємо знову (не здаємось)
      restartDelay = Math.min(RESTART_DELAY_MAX, restartDelay * 2);
      scheduleRestart();
    }
  }, restartDelay);
}

function createRecognition(lang) {
  const SR = self.SpeechRecognition || self.webkitSpeechRecognition;
  if (!SR) { send({ type: "speechError", error: "unsupported" }); return null; }

  const r = new SR();
  r.lang = lang || "en-US";
  r.continuous = true;
  r.interimResults = false;
  r.maxAlternatives = 1;

  r.onstart = () => {
    lastStartAt = Date.now();
    restartDelay = RESTART_DELAY_MIN;
  };

  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = res[0]?.transcript?.trim();
      if (!text) continue;
      send({ type: "transcript", text, final: res.isFinal });
    }
  };

  r.onerror = (e) => {
    send({ type: "speechError", error: e.error });
    if (FATAL_ERRORS.has(e.error)) {
      running = false;
    }
  };

  r.onend = () => {
    if (!running) return;
    const session = Date.now() - lastStartAt;
    if (session < 1000) {
      restartDelay = Math.min(RESTART_DELAY_MAX, restartDelay * 2);
    }
    scheduleRestart();
  };

  return r;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.source !== "surdo-bg") return;

  if (msg.type === "speechStart") {
    if (running) {
      sendResponse({ ok: true, already: true });
      return;                    // без true — відповідь синхронна
    }

    rec = createRecognition(msg.lang);
    if (!rec) {
      sendResponse({ ok: false, error: "unsupported" });
      return;
    }

    running = true;
    try {
      rec.start();
      sendResponse({ ok: true });
    } catch (e) {
      running = false;
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return;
  }

  if (msg.type === "speechStop") {
    running = false;             // спочатку прапорець — щоб onend не рестартнув
    try { rec?.stop(); } catch (e) {}
    rec = null;
    sendResponse({ ok: true });
    return;
  }

  // Невідомий тип — теж відповідаємо, щоб не було "port closed"
  sendResponse({ ok: false, error: "unknown-type" });
});

// pagehide замість deprecated unload
self.addEventListener("pagehide", () => {
  running = false;
  try { rec?.stop(); } catch (e) {}
});