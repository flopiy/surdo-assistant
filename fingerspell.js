/**
 * fingerspell.js — генерація жестів "по літерах" для слів,
 * яких немає в SIGNS. Підтримується лише латиниця для ASL.
 *
 * Виправлено: кеш тепер справжній LRU (на hit ключ оновлює
 * порядок видалення), а не FIFO.
 */
(function () {
  "use strict";

  const L = {
    /* Latin */
    a: { pose: "fist",  x: -70, y: -30, rot: -8 },
    b: { pose: "flat",  x: -70, y: -34, rot: 0 },
    c: { pose: "claw",  x: -70, y: -30, rot: 0 },
    d: { pose: "point", x: -70, y: -34, rot: 0 },
    e: { pose: "claw",  x: -70, y: -32, rot: 6 },
    f: { pose: "open",  x: -70, y: -36, rot: -6 },
    g: { pose: "point", x: -80, y: -22, rot: -60 },
    h: { pose: "flat",  x: -78, y: -30, rot: -80 },
    i: { pose: "fist",  x: -70, y: -34, rot: 8 },
    j: { pose: "point", x: -78, y: -20, rot: -90 },
    k: { pose: "point", x: -72, y: -34, rot: -20 },
    l: { pose: "point", x: -72, y: -34, rot: 20 },
    m: { pose: "fist",  x: -64, y: -28, rot: -20 },
    n: { pose: "fist",  x: -64, y: -28, rot: 20 },
    o: { pose: "claw",  x: -70, y: -30, rot: -6 },
    p: { pose: "point", x: -80, y: -18, rot: -70 },
    q: { pose: "point", x: -80, y: -18, rot: 70 },
    r: { pose: "point", x: -70, y: -34, rot: -12 },
    s: { pose: "fist",  x: -70, y: -32, rot: 0 },
    t: { pose: "fist",  x: -66, y: -28, rot: 6 },
    u: { pose: "point", x: -70, y: -34, rot: -10 },
    v: { pose: "point", x: -70, y: -34, rot: -22 },
    w: { pose: "open",  x: -70, y: -34, rot: 0 },
    x: { pose: "point", x: -72, y: -26, rot: -50 },
    y: { pose: "open",  x: -70, y: -30, rot: -8 },
    z: { pose: "point", x: -78, y: -26, rot: -70 },
  };

  const LETTER_DUR = 420;
  const CACHE_MAX = 200;
  const cache = new Map();       // word → sign object (insertion order = LRU order)

  function fingerspell(word) {
    const w = String(word);

    if (cache.has(w)) {
      // Справжній LRU: на hit пересуваємо ключ у кінець черги видалення
      const hit = cache.get(w);
      cache.delete(w);
      cache.set(w, hit);
      return hit;
    }

    const normalized = w.toLowerCase().replace(/['’`]/g, "");
    if (!/^[a-z]+$/.test(normalized)) return null;
    const letters = normalized.split("");

    if (!letters.length) return null;

    const right = [];
    const n = letters.length;
    let used = 0;
    letters.forEach((ch, i) => {
      const p = L[ch];
      if (!p) return;
      used++;
      right.push({ pose: p.pose, x: p.x, y: p.y, rot: p.rot, t: i / n });
    });
    if (!used) return null;
    right.push({ pose: "relax", x: 0, y: 0, rot: 0, t: 1 });

    const sign = {
      en: w.toUpperCase(),
      ua: w,
      dur: LETTER_DUR * used + 300,
      right,
      _fingerspelled: true,
    };

    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(w, sign);
    return sign;
  }

  window.__surdoFingerspell = fingerspell;
  window.__surdoFingerspellCacheSize = () => cache.size;
})();
