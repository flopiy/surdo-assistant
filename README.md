# Sign Language Buddy

**A floating browser assistant that demonstrates individual ASL / CSL sign-language
gestures** for subtitles on a page or speech captured by your microphone.

`Status:` **early development** — see [Project status](#-project-status-early-development) below.

---

## ⚠️ Project status: early development

**This project is a work in progress. Not everything works yet.**

- ❌ It is **not** a sentence translator — there is no grammar handling or full translation pipeline.
- ⚠️ **Vocabulary is very limited:**
  - **ASL — only 28 isolated demo words** (see the list below). Anything else is either
    fingerspelled letter-by-letter (a rough approximation, Latin words only) or shown as
    *"ASL sign unavailable"*.
  - **CSL — only 4 code prototypes** (嗨, 谢谢, 抱歉, 妈妈) recorded from educational
    videos. They have **not been validated by native CSL signers**; every other word is
    shown as *"CSL sign unavailable"*.
- ⚠️ **Ukrainian Sign Language (USL) and BSL are not supported at all.**
- ⚠️ The microphone path listens to the **physical microphone**, not the tab's audio —
  sound playing through your headphones will not be heard.
- ⚠️ Protected/closed-caption players may be unreadable by the content script.
- ❌ No automated test suite yet; no webcam-based user hand-tracking.

Expect rough edges, occasional bugs, and breaking changes.

---

## ✨ What it does

| Feature | Status | Description |
| --- | --- | --- |
| 3D hand | ✅ Works | Smooth procedural 3D hand surface (local Three.js bundle, 21 hidden landmarks driving the rig — no drawn joints, no raster hand images). Mirrored rendering with correct handshape orientation. |
| DOM subtitles | ✅ Works | Reads caption nodes (YouTube, Video.js, JW Player, Shaka…) and active HTML5 `TextTrack` cues |
| Microphone | ✅ Works | Web Speech API transcription running in a background offscreen document |
| Iframe routing | ✅ Works | Words routed iframe → background → top frame |
| Page API | ✅ Works | `window.surdo` bridge for user scripts (MAIN world) |
| Popup panel | ✅ Works | Visibility, size, language pair, source mode, live diagnostics |
| ASL vocabulary | ⚠️ Limited | **28 demo words** + fingerspelling fallback |
| CSL vocabulary | ⚠️ Prototype | **4 unvalidated prototypes** |
| Full translation | ❌ Missing | Sentences, grammar, USL/BSL, validated lexicons |

The buddy's two hands are always visible on screen: between gestures they rest in a
relaxed pose next to the mascot instead of disappearing. If WebGL is unavailable,
an SVG fallback renderer takes over.

---

## 📚 Vocabulary

### ASL — 28 words

`hello, welcome, thankyou, please, sorry, yes, no, good, help, eat, drink, love,
me, you, learn, friend, stop, understand, water, bathroom, family, book, school,
work, go, come, home, play`

Any other Latin word is **fingerspelled** letter-by-letter (approximate demo only);
Cyrillic words and unknown CSL words are honestly labeled *"sign unavailable"*
instead of being replaced with random gestures.

### CSL — 4 prototypes

`嗨 (hi) · 谢谢 (thank you) · 抱歉 / 对不起 (sorry) · 妈妈 (mother)`

Source: educational YouTube videos, **not validated by native signers**.

---

## 🚀 Getting started

### Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the extension folder.
4. Reload the page where you want to use the buddy.

### Use it

1. **Pick a language pair** in the popup: `English (US) → ASL` or `中文（普通话）→ CSL`.
   The choice is persisted and also sets the speech-recognition language.
2. **For video:** choose the **DOM subtitles** source, enable CC/subtitles in the player
   itself, and check the popup diagnostics. The reader watches caption containers and
   active `TextTrack` cues.
3. **For live speech:** choose **Microphone** or **Both**, then press **Start microphone**.
   Grant permission once via **Allow microphone (1 time)** if prompted.
   > The mic hears the room, **not** the tab's digital audio.
4. **Control the buddy:** drag it with the mouse (position is saved), use the size slider
   (160–520 px), the visibility checkbox, and the **Show gesture demo** / **Stop** buttons.

---

## 🎯 What is it for?

The goal of the project is to explore **real-time sign-language presentation in the
browser** — turning accessible text (subtitles, transcripts) into visual gesture
demonstrations, with an honest, non-misleading approach: the buddy never invents a
gesture it doesn't know.

Intended audience and use cases:

- **Deaf and hard-of-hearing users** exploring sign visualization in the browser.
- **Students and educators** demonstrating isolated signs.
- **Developers** experimenting with procedural hand animation, MV3 messaging
  (iframes, offscreen documents), and page APIs.

---

## 🔌 Page API

`window.surdo` is exposed in the top frame via the `bridge-main.js` bridge:

```js
window.surdo.signWords(["hello", "you", "thankyou"]); // queue words
window.surdo.sign("sorry");                           // single word
window.surdo.stop();                                  // stop the queue
window.surdo.hide(); window.surdo.show(); window.surdo.toggle();
window.surdo.setSize(320);
window.surdo.setPosition(100, 200);
window.surdo.onWord((key) => console.log("sign:", key)); // returns an unsubscribe fn

// 21 landmarks of the active hand, or null when idle / WebGL unavailable
window.surdo.getHandPoints("right").then(console.log);

console.log(window.surdo.currentWord, window.surdo.queueLength, window.surdo.language);
console.log(window.surdo.SIGNS); // active dictionary (limited — see Vocabulary)
```

Limits: `signWords()` takes up to 300 strings, each up to 80 characters.

---

## 🧱 Project structure

```
├── manifest.json          # Manifest V3 configuration
├── background.js          # Service worker: iframe ↔ top frame routing, offscreen, diagnostics
├── offscreen.html/js      # Web Speech API in background (with backoff restart)
├── assistant.js           # Content script: Shadow DOM, mascot, queue, keyframe interpolation
├── avatar3d.js            # Smooth procedural 3D hand (21-landmark rig)
├── three.global.js        # Bundled Three.js (MIT, see THREE-LICENSE.txt)
├── signs.js               # ASL (28 words) + CSL (4 prototypes) keyframe dictionaries
├── fingerspell.js         # Letter-by-letter generator for unknown Latin words (ASL)
├── reader.js              # DOM subtitle reader, HTML5 TextTrack, video state
├── bridge-main.js         # MAIN-world bridge (window.surdo)
├── popup.html / popup.js  # Settings panel & diagnostics
├── permission.html/js     # One-time microphone permission page
└── icons/                 # Extension icons
```

---

## 🛠️ Technical notes

- **Hand poses** are keyframe sequences `{pose, x, y, rot, yaw, t}` interpolated with crossfade.
- **Poses** (`open, flat, fist, point, thumbsup, claw, relax` + letter shapes `w, t, f, o, y`)
  are generated procedurally from curl/spread/thumb parameters — no raster images at runtime.
- **Queue** is capped at 300 items; sources (DOM / mic / manual API) are filtered by mode.
- **Context-invalidation safety** — every `chrome.*` call is guarded; if the extension
  reloads, the buddy removes itself from the page.
- **Fingerspell cache** is a true LRU (max 200 words); unsupported-word cache max 100.

---

## 🗺️ Roadmap

- [ ] Validated ASL lexicon checked by native signers (beyond the current 28 words)
- [ ] Expansion of CSL vocabulary (beyond the current 4 prototypes) with validation
- [ ] Sentence-level translation (grammar + proper sign data)
- [ ] Ukrainian Sign Language (USL) and BSL support
- [ ] Separate queues per source (one player's seek shouldn't interrupt another source)
- [ ] Integration tests for DOM/mic/both modes, repeats, iframe stop
- [ ] Optional webcam hand-tracking for the user's hands (the current 21 landmarks drive the avatar only)

---

## 📜 Licenses

- Project code — free for educational/exploratory use.
- Three.js — MIT License © 2010–2026 three.js authors (see `THREE-LICENSE.txt`).

---

*Built as an exploration of sign-language visualization in the browser.*
*Contributions, feedback — and especially validation from native signers — are very welcome.*
