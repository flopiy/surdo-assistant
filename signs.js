/**
 * Словник демонстраційних жестів ASL (анімації векторних поз кисті).
 * Кожен жест — послідовність кадрів {pose, x, y, rot, yaw, t}, t ∈ 0..1,
 * які інтерполюються з crossfade. x/y — зсув від базової точки руки
 * у початковій області малюнка 420×300 всередині збільшеного прозорого viewBox.
 */
(function () {
  "use strict";

  const FOREHEAD = { x: -52, y: -88 };
  const CHIN = { x: -72, y: -58 };
  const MOUTH = { x: -80, y: -66 };
  const CHEST = { x: -58, y: -14 };
  const FORWARD = { x: -118, y: -38 };
  const REST = { x: 0, y: 0 };
  const REST_END = { pose: "relax", x: 0, y: 0, rot: 0, t: 1 };

  const fr = (pose, t, x = 0, y = 0, rot = 0, yaw = 0) => ({ pose, x, y, rot, yaw, t });

  const ASL_SIGNS = {
    hello: {
      en: "HELLO", dur: 2000,
      right: [
        fr("open", 0, FOREHEAD.x, FOREHEAD.y, -20),
        fr("open", 0.15, FOREHEAD.x, FOREHEAD.y, 18),
        fr("open", 0.3, FOREHEAD.x, FOREHEAD.y, -20),
        fr("open", 0.45, FOREHEAD.x, FOREHEAD.y, 18),
        fr("open", 0.6, FOREHEAD.x, FOREHEAD.y, -20),
        REST_END,
      ],
    },
    welcome: {
      en: "WELCOME", dur: 1800,
      right: [fr("open", 0, -88, -8, 8), fr("open", 0.5, -36, -4, -8), REST_END],
      left: [fr("open", 0, 88, -8, -8), fr("open", 0.5, 36, -4, 8), REST_END],
    },
    thankyou: {
      en: "THANK YOU", dur: 1900,
      right: [
        fr("open", 0, CHIN.x, CHIN.y, 8),
        fr("open", 0.3, CHIN.x, CHIN.y, 8),
        fr("open", 0.8, -132, -22, -12),
        REST_END,
      ],
    },
    please: {
      en: "PLEASE", dur: 2100,
      right: [
        fr("open", 0, CHEST.x, CHEST.y - 10, 0),
        fr("open", 0.22, CHEST.x + 13, CHEST.y, 10),
        fr("open", 0.44, CHEST.x, CHEST.y + 10, 0),
        fr("open", 0.66, CHEST.x - 13, CHEST.y, -10),
        fr("open", 0.88, CHEST.x, CHEST.y - 10, 0),
        REST_END,
      ],
    },
    sorry: {
      en: "SORRY", dur: 2100,
      right: [
        fr("fist", 0, CHEST.x, CHEST.y - 10, 0),
        fr("fist", 0.22, CHEST.x + 13, CHEST.y, 8),
        fr("fist", 0.44, CHEST.x, CHEST.y + 10, 0),
        fr("fist", 0.66, CHEST.x - 13, CHEST.y, -8),
        fr("fist", 0.88, CHEST.x, CHEST.y - 10, 0),
        REST_END,
      ],
    },
    yes: {
      en: "YES", dur: 1500,
      right: [
        fr("fist", 0, -88, -34, 0),
        fr("fist", 0.3, -88, -14, 22),
        fr("fist", 0.6, -88, -36, -6),
        fr("fist", 0.85, -88, -16, 18),
        REST_END,
      ],
    },
    no: {
      en: "NO", dur: 1500,
      right: [
        fr("point", 0, -98, -40, 0),
        fr("point", 0.35, -98, -30, 0),
        fr("point", 0.55, -98, -30, 0),
        fr("point", 0.8, -98, -40, 0),
        REST_END,
      ],
    },
    good: {
      en: "GOOD", dur: 1900,
      right: [
        fr("open", 0, CHIN.x, CHIN.y, 5),
        fr("open", 0.35, CHIN.x, CHIN.y, 5),
        fr("open", 0.8, -88, 4, -8),
        REST_END,
      ],
      left: [fr("open", 0, 64, -8, 0), fr("open", 0.9, 64, -8, 0), REST_END],
    },
    help: {
      en: "HELP", dur: 2000,
      right: [
        fr("thumbsup", 0, -74, 0, 0),
        fr("thumbsup", 0.45, -74, -58, 0),
        fr("thumbsup", 0.75, -74, -58, 0),
        REST_END,
      ],
      left: [
        fr("open", 0, 56, -4, 0),
        fr("open", 0.45, 56, -36, 0),
        fr("open", 0.75, 56, -36, 0),
        REST_END,
      ],
    },
    eat: {
      en: "EAT", dur: 1800,
      right: [
        fr("claw", 0, MOUTH.x + 12, MOUTH.y + 12, 0),
        fr("claw", 0.25, MOUTH.x, MOUTH.y, 0),
        fr("claw", 0.5, MOUTH.x + 12, MOUTH.y + 12, 0),
        fr("claw", 0.72, MOUTH.x, MOUTH.y, 0),
        REST_END,
      ],
    },
    drink: {
      en: "DRINK", dur: 1800,
      right: [
        fr("thumbsup", 0, MOUTH.x + 8, MOUTH.y + 20, 0),
        fr("thumbsup", 0.45, MOUTH.x, MOUTH.y, -38),
        fr("thumbsup", 0.75, MOUTH.x, MOUTH.y, -38),
        REST_END,
      ],
    },
    love: {
      en: "LOVE", dur: 1900,
      right: [
        fr("fist", 0, REST.x, REST.y, 0),
        fr("fist", 0.4, -70, -28, 14),
        fr("fist", 0.8, -70, -28, 14),
        REST_END,
      ],
      left: [
        fr("fist", 0, REST.x, REST.y, 0),
        fr("fist", 0.4, 58, -34, -14),
        fr("fist", 0.8, 58, -34, -14),
        REST_END,
      ],
    },
    me: {
      en: "I / ME", dur: 1400,
      right: [
        fr("point", 0, -66, -22, 0),
        fr("point", 0.4, -72, -18, 0),
        fr("point", 0.75, -66, -22, 0),
        REST_END,
      ],
    },
    you: {
      en: "YOU", dur: 1400,
      right: [
        fr("point", 0, FORWARD.x, FORWARD.y, -4),
        fr("point", 0.45, FORWARD.x - 8, FORWARD.y - 4, -4),
        fr("point", 0.8, FORWARD.x, FORWARD.y, -4),
        REST_END,
      ],
    },
    learn: {
      en: "LEARN", dur: 2000,
      right: [
        fr("claw", 0, -140, 0, 0),
        fr("claw", 0.35, -140, 0, 0),
        fr("claw", 0.82, FOREHEAD.x, FOREHEAD.y, -8),
        REST_END,
      ],
      left: [fr("open", 0, 56, -4, 0), fr("open", 0.9, 56, -4, 0), REST_END],
    },
    friend: {
      en: "FRIEND", dur: 1900,
      right: [
        fr("point", 0, REST.x, REST.y, 0),
        fr("point", 0.35, -66, -32, 22),
        fr("point", 0.6, -66, -22, 22),
        fr("point", 0.85, -66, -32, 22),
        REST_END,
      ],
      left: [
        fr("point", 0, REST.x, REST.y, 0),
        fr("point", 0.35, 66, -22, -22),
        fr("point", 0.6, 66, -32, -22),
        fr("point", 0.85, 66, -22, -22),
        REST_END,
      ],
    },
    stop: {
      en: "STOP", dur: 1600,
      right: [
        fr("flat", 0, -80, -64, 0),
        fr("flat", 0.4, -104, -2, 0),
        fr("flat", 0.7, -104, -2, 0),
        REST_END,
      ],
      left: [fr("open", 0, 52, -4, 0), fr("open", 0.9, 52, -4, 0), REST_END],
    },
    understand: {
      en: "UNDERSTAND", dur: 1600,
      right: [
        fr("point", 0, -42, -86, 0),
        fr("point", 0.45, -42, -94, -4),
        fr("point", 0.8, -42, -94, -4),
        REST_END,
      ],
    },
    water: {
      en: "WATER", dur: 1750,
      right: [
        fr("w", 0, -100, -60, 0),
        fr("w", 0.18, -100, -55, 5),
        fr("w", 0.36, -100, -62, -4),
        fr("w", 0.54, -100, -55, 5),
        fr("w", 0.72, -100, -60, 0),
        REST_END,
      ],
    },
    bathroom: {
      en: "BATHROOM", dur: 1700,
      right: [
        fr("t", 0, -94, -28, -8),
        fr("t", 0.22, -82, -28, 9),
        fr("t", 0.44, -94, -28, -8),
        fr("t", 0.66, -82, -28, 9),
        fr("t", 0.86, -94, -28, 0),
        REST_END,
      ],
    },
    family: {
      en: "FAMILY", dur: 2200,
      right: [
        fr("f", 0, -126, -42, -8),
        fr("f", 0.3, -102, -50, -3),
        fr("f", 0.72, -80, -42, 8),
        REST_END,
      ],
      left: [
        fr("f", 0, 126, -42, 8),
        fr("f", 0.3, 102, -50, 3),
        fr("f", 0.72, 80, -42, -8),
        REST_END,
      ],
    },
    book: {
      en: "BOOK", dur: 1900,
      right: [
        fr("flat", 0, -112, -34, -82),
        fr("flat", 0.34, -92, -34, -68),
        fr("flat", 0.72, -68, -34, -58),
        REST_END,
      ],
      left: [
        fr("flat", 0, 112, -34, 82),
        fr("flat", 0.34, 92, -34, 68),
        fr("flat", 0.72, 68, -34, 58),
        REST_END,
      ],
    },
    school: {
      en: "SCHOOL", dur: 1900,
      right: [
        fr("flat", 0, -108, -32, 0),
        fr("flat", 0.18, -108, -20, 0),
        fr("flat", 0.34, -108, -32, 0),
        fr("flat", 0.5, -108, -20, 0),
        fr("flat", 0.68, -108, -32, 0),
        REST_END,
      ],
      left: [fr("flat", 0, 108, -32, 180), fr("flat", 0.72, 108, -32, 180), REST_END],
    },
    work: {
      en: "WORK", dur: 1800,
      right: [
        fr("fist", 0, -98, -24, 0),
        fr("fist", 0.2, -98, -12, 0),
        fr("fist", 0.36, -98, -24, 0),
        fr("fist", 0.54, -98, -12, 0),
        fr("fist", 0.72, -98, -24, 0),
        REST_END,
      ],
      left: [fr("fist", 0, 98, -24, 0), fr("fist", 0.72, 98, -24, 0), REST_END],
    },
    go: {
      en: "GO", dur: 1700,
      right: [fr("point", 0, -88, -28, -6), fr("point", 0.35, -70, -24, -3), fr("point", 0.78, -52, -18, 0), REST_END],
      left: [fr("point", 0, 88, -28, 6), fr("point", 0.35, 70, -24, 3), fr("point", 0.78, 52, -18, 0), REST_END],
    },
    come: {
      en: "COME", dur: 1600,
      right: [fr("point", 0, -50, -34, 20), fr("point", 0.42, -82, -34, 8), fr("point", 0.78, -108, -30, -10), REST_END],
    },
    home: {
      en: "HOME", dur: 1800,
      right: [
        fr("o", 0, -104, -54, 0),
        fr("o", 0.25, -104, -48, -4),
        fr("o", 0.5, -76, -54, 5),
        fr("o", 0.75, -76, -48, 0),
        REST_END,
      ],
    },
    play: {
      en: "PLAY", dur: 1800,
      right: [fr("y", 0, -62, -22, -24), fr("y", 0.25, -62, -22, 24), fr("y", 0.5, -62, -22, -24), fr("y", 0.75, -62, -22, 24), REST_END],
      left: [fr("y", 0, 62, -22, 24), fr("y", 0.25, 62, -22, -24), fr("y", 0.5, 62, -22, 24), fr("y", 0.75, 62, -22, -24), REST_END],
    },
  };

  // Окремі словники: ASL не можна показувати як CSL.
  // Усі CSL-рухи нижче — навчальні прототипи за відеоджерелами,
  // не перевірені носієм CSL; джерела та обмеження зібрані в SIGN_SOURCES.md.
  const cslHi = {
    en: "HI · CSL prototype",
    native: "嗨",
    dur: 1500,
    right: [
      fr("open", 0, -28, -42, -7),
      fr("open", 0.18, -28, -38, 8),
      fr("open", 0.34, -28, -42, -7),
      fr("open", 0.51, -28, -38, 8),
      fr("open", 0.68, -28, -42, -7),
      fr("open", 0.84, -28, -42, 0),
      REST_END,
    ],
    _prototype: true,
    _source: "https://www.youtube.com/watch?v=pXnK3Kbpa2c",
  };
  const cslThanks = {
    en: "THANK YOU · CSL prototype",
    native: "谢谢",
    dur: 1550,
    right: [
      fr("open", 0, -38, -46, -8),
      fr("open", 0.28, -24, -43, 0),
      fr("open", 0.62, -4, -49, 14),
      fr("open", 0.84, -10, -47, 7),
      REST_END,
    ],
    _prototype: true,
    _source: "https://www.youtube.com/watch?v=pXnK3Kbpa2c",
  };
  const cslSorry = {
    en: "SORRY · CSL prototype",
    native: "抱歉",
    dur: 1750,
    right: [
      fr("flat", 0, -105, -150, 0),
      fr("flat", 0.28, -105, -118, 0),
      fr("flat", 0.72, -105, -38, 0),
      fr("flat", 0.86, -105, -38, 0),
      REST_END,
    ],
    _prototype: true,
    _source: "https://www.youtube.com/watch?v=71ipUGQSVnY",
  };
  const cslMother = {
    en: "MOTHER · CSL prototype",
    native: "妈妈",
    dur: 1750,
    right: [
      fr("point", 0, -100, -58, 0),
      fr("point", 0.2, -100, -52, 0),
      fr("point", 0.38, -100, -58, 0),
      fr("point", 0.58, -100, -52, 0),
      fr("point", 0.78, -100, -58, 0),
      REST_END,
    ],
    _prototype: true,
    _source: "https://www.youtube.com/watch?v=71ipUGQSVnY",
  };
  const CSL_SIGNS = {
    "嗨": cslHi,
    hi: cslHi,
    "谢谢": cslThanks,
    thankyou: cslThanks,
    "抱歉": cslSorry,
    "对不起": cslSorry,
    sorry: cslSorry,
    "妈妈": cslMother,
    mother: cslMother,
  };

  window.SIGN_LANGUAGES = {
    asl: {
      code: "asl",
      name: "American Sign Language",
      locale: "en-US",
      ready: true,
      signs: ASL_SIGNS,
    },
    csl: {
      code: "csl",
      name: "Chinese Sign Language",
      locale: "zh-CN",
      ready: true,
      prototypeOnly: true,
      signs: CSL_SIGNS,
    },
  };

  // Зворотна сумісність зі сторінковим API, яке історично читало window.SIGNS.
  window.SIGNS = ASL_SIGNS;
})();
