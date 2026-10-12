/**
 * background.js — service worker.
 * Виправлено: broadcast лише на http(s)-вкладки; speechStop чекає ack від
 * offscreen перед закриттям; коректна відповідь при cold start.
 */
const OFFSCREEN_PATH = "offscreen.html";
let creating = null;
let speechTabId = null;
const readerStatusByTab = new Map();

async function getSpeechTabId() {
  if (speechTabId != null) return speechTabId;
  try {
    const stored = await chrome.storage.session.get("surdoSpeechTabId");
    speechTabId = stored.surdoSpeechTabId ?? null;
  } catch (_) {}
  return speechTabId;
}

async function hasOffscreen() {
  // Chrome 116+ має chrome.runtime.getContexts
  if (chrome.runtime.getContexts) {
    try {
      const ctxs = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
      });
      return ctxs.length > 0;
    } catch (_) { /* fallback */ }
  }
  // Fallback: просто намагаємось createDocument — якщо вже є, кине помилку
  return false;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;

  if (creating) { await creating; return; }
  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
    justification: "Web Speech API для транскрипції аудіо у фоні",
  }).catch((e) => {
    // Якщо вже існує — ігноруємо
    if (!/single offscreen|already exists/i.test(e.message)) throw e;
  });
  await creating;
  creating = null;
}

async function closeOffscreen() {
  try {
    await chrome.offscreen.closeDocument();
  } catch (_) { /* не існує — ок */ }
}

async function broadcast(msg) {
  // Надсилаємо лише на сторінки, де можуть бути content scripts
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(tabs.map((t) => {
    if (t.id == null) return Promise.resolve();
    return chrome.tabs.sendMessage(t.id, msg).catch(() => {});
  }));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.source === "surdo-reader-status" && msg.type === "update") {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId;
    if (sender.id !== chrome.runtime.id || tabId == null || !Number.isInteger(frameId)) {
      sendResponse({ ok: false, error: "invalid-reader-frame" });
      return;
    }
    let frames = readerStatusByTab.get(tabId);
    if (!frames) { frames = new Map(); readerStatusByTab.set(tabId, frames); }
    const raw = msg.status || {};
    const staleBefore = Date.now() - 15000;
    for (const [id, st] of frames) {
      if ((st.reportedAt || 0) < staleBefore) frames.delete(id);
    }
    const count = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.floor(value))) : 0;
    frames.set(frameId, {
      reportedAt: Date.now(),
      sourceMode: ["dom", "mic", "both"].includes(raw.sourceMode) ? raw.sourceMode : "dom",
      isTop: frameId === 0,
      videoCount: count(raw.videoCount),
      textTrackCount: count(raw.textTrackCount),
      activeTrackCount: count(raw.activeTrackCount),
      captionNodes: count(raw.captionNodes),
      activeCaptionCount: count(raw.activeCaptionCount),
    });
    sendResponse({ ok: true });
    return;
  }

  // ---- iframe content script → головний frame через extension channel ----
  if (msg.source === "surdo-reader") {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId;
    if (sender.id !== chrome.runtime.id || tabId == null || !Number.isInteger(frameId) || frameId <= 0) {
      sendResponse({ ok: false, error: "invalid-frame" });
      return;
    }

    let routed;
    if (msg.type === "words" && Array.isArray(msg.words)) {
      // Літери будь-якої системи письма (включно з Han для CSL) + цифри;
      // слова з iframe уже нормалізовані reader.js.
      const words = msg.words
        .filter((word) => typeof word === "string" && /^[\p{L}\p{N}]{1,80}$/u.test(word))
        .slice(0, 100);
      if (!words.length) {
        sendResponse({ ok: true, delivered: 0 });
        return;
      }
      routed = { source: "surdo-bg", type: "readerWords", frameId, words };
    } else if (msg.type === "stop") {
      routed = { source: "surdo-bg", type: "readerStop", frameId };
    } else {
      sendResponse({ ok: false, error: "unknown-reader-message" });
      return;
    }

    chrome.tabs.sendMessage(tabId, routed, { frameId: 0 })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  // Ігноруємо власні повідомлення — вони для offscreen
  if (msg.source === "surdo-bg") return;

  // ---- popup → background ----
  if (msg.source === "surdo-popup") {
    if (msg.type === "ping") {
      sendResponse({ ok: true, pong: Date.now(), source: "background" });
      return;
    }

    if (msg.type === "readerStatus") {
      chrome.tabs.query({ active: true, lastFocusedWindow: true })
        .then(async (tabs) => {
          const tabId = tabs[0]?.id;
          let refreshSentAt = 0;
          if (tabId != null) {
            refreshSentAt = Date.now();
            await chrome.tabs.sendMessage(tabId, {
              source: "surdo-bg", type: "readerStatusRefresh",
            }).catch(() => {});
            // Every frame reports asynchronously through runtime.sendMessage.
            await new Promise((resolve) => setTimeout(resolve, 220));
          }
          // Віддаємо лише свіжі звіти: записи, що не оновилися після refresh,
          // належать frame, які вже не існують (SPA-навігація, видалений iframe).
          const freshAfter = refreshSentAt;
          const frames = tabId == null ? [] : [...(readerStatusByTab.get(tabId) || new Map())]
            .filter(([, status]) => (status.reportedAt || 0) >= freshAfter)
            .map(([frameId, status]) => ({ frameId, ...status }));
          sendResponse({ ok: true, frames });
        })
        .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
      return true;
    }

    if (msg.type === "speechStart") {
      chrome.tabs.query({ active: true, lastFocusedWindow: true })
        .then((tabs) => {
          speechTabId = tabs[0]?.id ?? null;
          return chrome.storage.session.set({ surdoSpeechTabId: speechTabId })
            .then(() => ensureOffscreen());
        })
        .then(() => chrome.runtime.sendMessage({
          source: "surdo-bg", type: "speechStart",
          lang: msg.lang || "en-US",
        }))
        .then((r) => {
          const response = r && typeof r === "object" ? r : { ok: true };
          if (response.ok === false) {
            speechTabId = null;
            chrome.storage.session.remove("surdoSpeechTabId").catch(() => {})
              .then(() => sendResponse(response));
            return;
          }
          sendResponse(response);
        })
        .catch((e) => {
          speechTabId = null;
          chrome.storage.session.remove("surdoSpeechTabId").catch(() => {})
            .then(() => sendResponse({ ok: false, error: String(e && e.message || e) }));
        });
      return true;
    }

    if (msg.type === "speechStop") {
      speechTabId = null;
      // Спочатку даємо offscreen можливість зупинитися, потім закриваємо
      chrome.runtime.sendMessage({ source: "surdo-bg", type: "speechStop" })
        .catch(() => {})
        .then(() => chrome.storage.session.remove("surdoSpeechTabId"))
        .then(() => closeOffscreen())
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: true }));
      return true;
    }

    if (msg.type === "closeOffscreen") {
      closeOffscreen().finally(() => sendResponse({ ok: true }));
      return true;
    }
  }

  // ---- offscreen → background ----
  if (msg.source === "surdo-offscreen") {
    if (msg.type === "transcript") {
      getSpeechTabId().then((tabId) => {
        if (tabId == null) return;
        chrome.tabs.sendMessage(tabId, {
          source: "surdo-bg", type: "transcript",
          text: msg.text, final: msg.final,
        }).catch(() => {});
        if (msg.final && typeof msg.text === "string") {
          chrome.runtime.sendMessage({
            source: "surdo-popup-status", type: "transcriptPreview",
            text: msg.text.slice(0, 180),
          }).catch(() => {});
        }
      }).catch(() => {});
    } else if (msg.type === "speechError") {
      const errorMessage = {
        source: "surdo-bg", type: "speechError",
        error: msg.error,
      };
      // Popup не входит в chrome.tabs.query({ url: http(s) }); отправляем
      // ошибку отдельно extension-контекстам, а затем — content scripts.
      chrome.runtime.sendMessage(errorMessage).catch(() => {});
      broadcast(errorMessage).catch(() => {});
    }
    sendResponse({ ok: true });
    return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  readerStatusByTab.delete(tabId);
  getSpeechTabId().then((targetId) => {
    if (targetId !== tabId) return;
    speechTabId = null;
    chrome.storage.session.remove("surdoSpeechTabId").catch(() => {});
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") readerStatusByTab.delete(tabId);
});

// Логування для діагностики
console.log("[surdo bg] service worker started");
