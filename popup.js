/**
 * popup.js — settings panel (EN/中文 UI).
 * Added: interface language switcher (English / 中文) with persistence.
 */
const UI_STRINGS = {
  en: {
    title: "Sign Language Buddy",
    showBuddy: "Show assistant",
    size: "Assistant size",
    languagePair: "Language pair",
    demo: "Show gesture demo",
    stop: "Stop",
    source: "Word source",
    srcDom: "Page subtitles (DOM)",
    srcMic: "Microphone (Web Speech)",
    srcBoth: "Both",
    sourceHint: "For video choose DOM and enable CC/subtitles in the player. The microphone hears the room, not the tab's audio (it won't hear it through headphones).",
    micStart: "▶ Start microphone",
    micStop: "■ Stop microphone",
    micPerm: "🔑 Allow microphone (one time)",
    micOff: "Microphone off. Pick a recognition language and a source.",
    startingMic: "Starting microphone…",
    micOn: (lang) => `🎤 Listening to the device microphone (${lang}). This is not the tab's direct audio.`,
    micOnCsl: (lang) => `🎤 Recognizing Mandarin Chinese (${lang}); available prototypes: 嗨, 谢谢, 抱歉, 妈妈.`,
    micAlready: (lang) => `🎤 Already listening to the device microphone (${lang}).`,
    micError: (e) => "❌ Error: " + (e || "unknown"),
    domOnly: "Microphone is off — DOM subtitles selected",
    pickMicFirst: "First choose \"Microphone\" or \"Both\" as the word source.",
    pairAsl: "ASL: 28 isolated demo signs. Sentence translation is not supported.",
    pairCsl: "CSL: 4 educational prototypes (嗨, 谢谢, 抱歉, 妈妈). Not validated by native signers.",
    cslSelected: "Mandarin Chinese → CSL selected. Prototypes: 嗨, 谢谢, 抱歉, 妈妈; other words are not translated.",
    aslSelected: "English (US) → ASL selected.",
    recognized: (text) => `Recognized: ${text}`,
    reloadHint: " Reload the page to connect the extension, then pick the pair again.",
    micDenied: "❌ Microphone blocked. Click \"🔑 Allow microphone (one time)\" and retry.",
    micNotFound: "❌ Microphone not found. Check the connection.",
    speechUnsupported: "❌ Web Speech API is not supported in this browser.",
    speechError: (e) => "⚠️ Recognition error: " + e,
    diagChecking: "Checking video and subtitles…",
    diagNoScan: "Couldn't check the tab. Reload the page and open the popup again.",
    diagNotScanned: "Page not scanned yet. Reload it; Chrome service pages are not supported.",
    diagActiveMic: (n) => `Subtitles found, but \"Microphone\" mode ignores them. Choose \"DOM subtitles\" or \"Both\".`,
    diagOk: (frames) => `✅ Reader works in ${frames} frame(s); active subtitles found.`,
    diagNoCue: (v) => `Video found (${v}), a text track exists, but no active cues. Enable CC/subtitles.`,
    diagEmptyCaption: (v) => `Video found (${v}), caption container exists but is empty. Enable subtitles.`,
    diagNoText: (v) => `Video found (${v}), but no subtitle text is visible. Enable CC; without subtitles the DOM cannot read speech.`,
    diagNoVideo: (nodes) => `No video tag, but caption nodes exist (${nodes}). Try DOM mode.`,
    diagNone: (frames) => `Page connected (${frames} frame(s)), but no video/subtitles found.`,
  },
  zh: {
    title: "手语小助手",
    showBuddy: "显示助手",
    size: "助手大小",
    languagePair: "语言组合",
    demo: "手势演示",
    stop: "停止",
    source: "文字来源",
    srcDom: "页面字幕（DOM）",
    srcMic: "麦克风（Web Speech）",
    srcBoth: "两者",
    sourceHint: "看视频请选择 DOM 并在播放器中打开 CC/字幕。麦克风听的是设备周围的声音，不是网页音频（戴耳机时听不到）。",
    micStart: "▶ 开启麦克风",
    micStop: "■ 关闭麦克风",
    micPerm: "🔑 允许使用麦克风（一次）",
    micOff: "麦克风已关闭。请选择识别语言和文字来源。",
    startingMic: "正在启动麦克风…",
    micOn: (lang) => `🎤 正在聆听设备麦克风（${lang}）。这不是网页的直接声音。`,
    micOnCsl: (lang) => `🎤 正在识别中文普通话（${lang}）；可用原型：嗨、谢谢、抱歉、妈妈。`,
    micAlready: (lang) => `🎤 已在聆听设备麦克风（${lang}）。`,
    micError: (e) => "❌ 错误：" + (e || "未知"),
    domOnly: "麦克风已关闭 —— 已选择 DOM 字幕",
    pickMicFirst: "请先将文字来源设为“麦克风”或“两者”。",
    pairAsl: "ASL：仅 28 个独立演示手势，不支持整句翻译。",
    pairCsl: "CSL：4 个教学原型（嗨、谢谢、抱歉、妈妈），未经母语者验证。",
    cslSelected: "已选择 中文普通话 → CSL。原型：嗨、谢谢、抱歉、妈妈；其他词汇暂不翻译。",
    aslSelected: "已选择 English (US) → ASL。",
    recognized: (text) => `识别结果：${text}`,
    reloadHint: "请刷新页面以连接扩展，然后重新选择语言组合。",
    micDenied: "❌ 麦克风被禁止。点击“🔑 允许使用麦克风（一次）”后重试。",
    micNotFound: "❌ 未找到麦克风，请检查连接。",
    speechUnsupported: "❌ 此浏览器不支持 Web Speech API。",
    speechError: (e) => "⚠️ 识别错误：" + e,
    diagChecking: "正在检查视频和字幕…",
    diagNoScan: "无法检查该标签页。请刷新页面后重新打开弹窗。",
    diagNotScanned: "尚未扫描页面。请刷新；Chrome 内部页面不受支持。",
    diagActiveMic: (n) => `已找到字幕，但“麦克风”模式会忽略它们。请选择“DOM 字幕”或“两者”。`,
    diagOk: (frames) => `✅ 读取器在 ${frames} 个 frame 中工作；已找到活动字幕。`,
    diagNoCue: (v) => `找到视频（${v}），有文本轨道，但没有活动的 cue。请打开 CC/字幕。`,
    diagEmptyCaption: (v) => `找到视频（${v}），有字幕容器但内容为空。请打开字幕。`,
    diagNoText: (v) => `找到视频（${v}），但看不到字幕文字。请打开 CC；没有字幕 DOM 无法读取语音。`,
    diagNoVideo: (nodes) => `未找到 video 标签，但有字幕节点（${nodes}）。可尝试 DOM 模式。`,
    diagNone: (frames) => `页面已连接（${frames} 个 frame），但未找到视频/字幕。`,
  },
};

let uiLang = "en";
const t = (key) => UI_STRINGS[uiLang][key];

const uiLangSel = document.getElementById("uiLang");

function applyUiLang(lang) {
  uiLang = UI_STRINGS[lang] ? lang : "en";
  uiLangSel.value = uiLang;
  document.documentElement.lang = uiLang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (typeof t(key) === "string") el.textContent = t(key);
  });
  // refresh dynamic texts
  applyLanguagePair(languagePairSel.value);
  micStatus.textContent = t("micOff");
  videoStatus.textContent = t("diagChecking");
  refreshReaderStatus();
  try { chrome.storage.local.set({ surdoUiLang: uiLang }); } catch (_) {}
}

uiLangSel.addEventListener("change", () => applyUiLang(uiLangSel.value));

// restore UI language early
try {
  chrome.storage.local.get("surdoUiLang", (st) => {
    if (chrome.runtime.lastError) return;
    if (st?.surdoUiLang && UI_STRINGS[st.surdoUiLang]) applyUiLang(st.surdoUiLang);
  });
} catch (_) {}


const sizeInput = document.getElementById("size");
const sizeVal = document.getElementById("sizeVal");
const visibleChk = document.getElementById("visible");
const languagePairSel = document.getElementById("languagePair");
const pairStatus = document.getElementById("pairStatus");
const demoButton = document.getElementById("demo");

const LANGUAGE_PAIRS = {
  "en-asl": { speechLang: "en-US", signLang: "asl", ready: true },
  "zh-csl": { speechLang: "zh-CN", signLang: "csl", ready: true, prototypeOnly: true },
};

const sourceSel = document.getElementById("source");
const micStart = document.getElementById("micStart");
const micStop = document.getElementById("micStop");
const micStatus = document.getElementById("micStatus");
const videoStatus = document.getElementById("videoStatus");

function activeTab() {
  return new Promise((res) =>
    chrome.tabs.query({ active: true, currentWindow: true }, (t) => res(t[0]))
  );
}

/* ---- Send to the active tab's content script (silently) ---- */
async function sendToTab(msg) {
  const tab = await activeTab();
  if (tab?.id == null) return { ok: false, error: "no-active-tab" };

  try {
    const res = await chrome.tabs.sendMessage(tab.id, {
      source: "surdo-popup", ...msg,
    });
    return { ok: true, res };
  } catch (e) {
    // No content script on this tab — that's fine, stay silent
    return { ok: false, error: e.message };
  }
}

/* ---- Send to background with retry ---- */
async function sendToBg(msg, { retries = 3, delay = 150 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await chrome.runtime.sendMessage({
        source: "surdo-popup", ...msg,
      });
      return res || { ok: true };
    } catch (e) {
      // "Receiving end does not exist" — the service worker is still waking up
      const isColdStart = /Receiving end does not exist/i.test(e.message);
      if (isColdStart && i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: "retries-exhausted" };
}

/* ---- Speech errors from background/offscreen ---- */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.source === "surdo-popup-status" && msg.type === "transcriptPreview") {
    const text = String(msg.text || "").slice(0, 180);
    if (languagePairSel.value === "zh-csl") {
      micStatus.textContent = `${t("recognized")(text)} — 嗨 · 谢谢 · 抱歉 · 妈妈`;
    } else {
      micStatus.textContent = t("recognized")(text);
    }
    return;
  }
  if (!msg || msg.source !== "surdo-bg") return;

  if (msg.type === "speechError") {
    if (msg.error === "not-allowed" || msg.error === "service-not-allowed") {
      micStatus.textContent = t("micDenied");
    } else if (msg.error === "audio-capture") {
      micStatus.textContent = t("micNotFound");
    } else if (msg.error === "unsupported") {
      micStatus.textContent = t("speechUnsupported");
    } else if (msg.error !== "aborted" && msg.error !== "no-speech") {
      micStatus.textContent = t("speechError")(msg.error);
    }
  }
});

function applyLanguagePair(pairKey) {
  const pair = LANGUAGE_PAIRS[pairKey] || LANGUAGE_PAIRS["en-asl"];
  languagePairSel.value = pairKey in LANGUAGE_PAIRS ? pairKey : "en-asl";
  pairStatus.textContent = pairKey === "zh-csl" ? t("pairCsl") : t("pairAsl");
  demoButton.disabled = !pair.ready;
}

/* ---- Restore state ---- */
chrome.storage.local.get(
  ["surdoSize", "surdoVisible", "surdoPair", "surdoSignLang", "surdoSource", "surdoSpeechLang", "surdoUiLang"],
  (st) => {
    if (st.surdoUiLang && UI_STRINGS[st.surdoUiLang]) uiLang = st.surdoUiLang;
    uiLangSel.value = uiLang;
    document.documentElement.lang = uiLang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (typeof t(key) === "string") el.textContent = t(key);
    });
    if (st.surdoSize) { sizeInput.value = st.surdoSize; sizeVal.textContent = st.surdoSize + " px"; }
    if (st.surdoVisible === false) visibleChk.checked = false;
    const savedPair = LANGUAGE_PAIRS[st.surdoPair]
      ? st.surdoPair
      : (st.surdoSignLang === "csl" || st.surdoSpeechLang === "zh-CN" ? "zh-csl" : "en-asl");
    applyLanguagePair(savedPair);
    if (st.surdoSource) sourceSel.value = st.surdoSource;
    chrome.storage.local.set({
      surdoPair: savedPair,
      surdoSpeechLang: LANGUAGE_PAIRS[savedPair].speechLang,
      surdoSignLang: LANGUAGE_PAIRS[savedPair].signLang,
    });
    micStatus.textContent = t("micOff");
    videoStatus.textContent = t("diagChecking");
    refreshReaderStatus();
  }
);

async function refreshReaderStatus() {
  if (!videoStatus) return;
  const result = await sendToBg({ type: "readerStatus" });
  if (!result?.ok || !result.res?.ok) {
    videoStatus.textContent = t("diagNoScan");
    return;
  }
  const frames = result.res.frames || [];
  if (!frames.length) {
    videoStatus.textContent = t("diagNotScanned");
    return;
  }
  const totals = frames.reduce((a, f) => ({
    videos: a.videos + (f.videoCount || 0),
    tracks: a.tracks + (f.textTrackCount || 0),
    activeTracks: a.activeTracks + (f.activeTrackCount || 0),
    nodes: a.nodes + (f.captionNodes || 0),
    activeCaptions: a.activeCaptions + (f.activeCaptionCount || 0),
  }), { videos: 0, tracks: 0, activeTracks: 0, nodes: 0, activeCaptions: 0 });

  if (totals.activeCaptions || totals.activeTracks) {
    videoStatus.textContent = sourceSel.value === "mic"
      ? t("diagActiveMic")(frames.length)
      : t("diagOk")(frames.length);
  } else if (totals.videos && totals.tracks) {
    videoStatus.textContent = t("diagNoCue")(totals.videos);
  } else if (totals.videos && totals.nodes) {
    videoStatus.textContent = t("diagEmptyCaption")(totals.videos);
  } else if (totals.videos) {
    videoStatus.textContent = t("diagNoText")(totals.videos);
  } else if (totals.nodes) {
    videoStatus.textContent = t("diagNoVideo")(totals.nodes);
  } else {
    videoStatus.textContent = t("diagNone")(frames.length);
  }
}

// Status refreshes when a player, iframe or CC appears.
const diagnosticTimer = setInterval(refreshReaderStatus, 1800);
window.addEventListener("unload", () => clearInterval(diagnosticTimer), { once: true });

/* ---- Size slider with debounce ---- */
let sizeTimer = 0;
sizeInput.addEventListener("input", () => {
  sizeVal.textContent = sizeInput.value + " px";
  chrome.storage.local.set({ surdoSize: Number(sizeInput.value) });
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(() => {
    sendToTab({ type: "setSize", px: Number(sizeInput.value) });
  }, 120);
});

visibleChk.addEventListener("change", () => {
  sendToTab({ type: "setVisible", value: visibleChk.checked });
  chrome.storage.local.set({ surdoVisible: visibleChk.checked });
});

languagePairSel.addEventListener("change", () => {
  const pairKey = languagePairSel.value;
  const pair = LANGUAGE_PAIRS[pairKey];
  applyLanguagePair(pairKey);
  demoButton.disabled = true;
  sendToTab({ type: "stop" });
  sendToBg({ type: "speechStop" });
  chrome.storage.local.set({
    surdoPair: pairKey,
    surdoSpeechLang: pair.speechLang,
    surdoSignLang: pair.signLang,
  }, async () => {
    const switched = await sendToTab({ type: "setLanguage", language: pair.signLang });
    const ready = !!switched?.res?.ok;
    demoButton.disabled = !pair.ready || !ready;
    if (!ready) {
      pairStatus.textContent += t("reloadHint");
    }
  });
  micStatus.textContent = pairKey === "zh-csl" ? t("cslSelected") : t("aslSelected");
});

sourceSel.addEventListener("change", () => {
  chrome.storage.local.set({ surdoSource: sourceSel.value });
  refreshReaderStatus();
  if (sourceSel.value === "dom") {
    sendToBg({ type: "speechStop" });
    micStatus.textContent = t("domOnly");
  }
});

demoButton.addEventListener("click", () => {
  sendToTab({ type: "setVisible", value: true });
  visibleChk.checked = true;
  chrome.storage.local.set({ surdoVisible: true });
  sendToTab({ type: "demo" });
});

document.getElementById("stop").addEventListener("click", () => {
  sendToTab({ type: "stop" });
});

/* ---- Microphone ---- */
micStart.addEventListener("click", async () => {
  if (sourceSel.value === "dom") {
    micStatus.textContent = t("pickMicFirst");
    return;
  }
  const lang = LANGUAGE_PAIRS[languagePairSel.value]?.speechLang || "en-US";
  micStatus.textContent = t("startingMic");
  const res = await sendToBg({ type: "speechStart", lang });
  if (res?.ok && res.already) {
    micStatus.textContent = t("micAlready")(lang);
  } else if (res?.ok) {
    micStatus.textContent = languagePairSel.value === "zh-csl"
      ? t("micOnCsl")(lang)
      : t("micOn")(lang);
  } else {
    micStatus.textContent = t("micError")(res?.error);
  }
});

micStop.addEventListener("click", async () => {
  await sendToBg({ type: "speechStop" });
  micStatus.textContent = t("micOff");
});

/* ---- One-time microphone permission ---- */
document.getElementById("micPerm")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
});