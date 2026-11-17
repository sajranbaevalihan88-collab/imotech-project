import React, { useState, useEffect, useRef } from "react";
import { apiService } from "./services/api.js";
import {
  mockSigns,
  mockDigitsCatalog,
  mockLettersCatalog,
  buildLandmarks21FromFingers
} from "./data/mockData.js";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Большой палец (Thumb)
  [0, 5], [5, 6], [6, 7], [7, 8],       // Указательный (Index)
  [0, 9], [9, 10], [10, 11], [11, 12],  // Средний (Middle)
  [0, 13], [13, 14], [14, 15], [15, 16],// Безымянный (Ring)
  [0, 17], [17, 18], [18, 19], [19, 20],// Мизинец (Pinky)
  [5, 9], [9, 13], [13, 17], [0, 17]    // Ладонная дуга (Palm)
];

const FINGER_NAMES = [
  { idx: 0, ru: "Большой", kg: "Баш бармак", color: "#06b6d4" },
  { idx: 1, ru: "Указательный", kg: "Сөөмөй", color: "#8b5cf6" },
  { idx: 2, ru: "Средний", kg: "Ортон", color: "#10b981" },
  { idx: 3, ru: "Безымянный", kg: "Аты жок", color: "#f59e0b" },
  { idx: 4, ru: "Мизинец", kg: "Чыпалак", color: "#ec4899" }
];

// ============================================================================
// REAL 21-LANDMARK GEOMETRIC GESTURE CLASSIFIER (MediaPipe Hands 60 FPS)
// Translates real 3D hand landmarks into Digits (0-9), Letters (А-Я, Ө, Ү, Ң) & Words
// ============================================================================
function classifyRealLandmarks(lm, scanMode = "auto", stableSymbolOverride = null) {
  if (!lm || lm.length < 21) return null;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrist = lm[0];
  const palmLen = dist(lm[9], wrist) || 0.15;

  // Finger extension states [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen]
  const thumbOpen =
    dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.12 &&
    dist(lm[4], lm[5]) > palmLen * 0.55
      ? 1
      : 0;

  const indexOpen =
    dist(lm[8], wrist) > dist(lm[6], wrist) * 1.08 &&
    dist(lm[8], lm[5]) > dist(lm[6], lm[5]) * 1.15
      ? 1
      : 0;

  const middleOpen =
    dist(lm[12], wrist) > dist(lm[10], wrist) * 1.08 &&
    dist(lm[12], lm[9]) > dist(lm[10], lm[9]) * 1.15
      ? 1
      : 0;

  const ringOpen =
    dist(lm[16], wrist) > dist(lm[14], wrist) * 1.08 &&
    dist(lm[16], lm[13]) > dist(lm[14], lm[13]) * 1.15
      ? 1
      : 0;

  const pinkyOpen =
    dist(lm[20], wrist) > dist(lm[18], wrist) * 1.08 &&
    dist(lm[20], lm[17]) > dist(lm[18], lm[17]) * 1.15
      ? 1
      : 0;

  const f = [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen];
  const key = f.join(",");

  // Geometric features
  const pinchThumbIndex = dist(lm[4], lm[8]) / palmLen;
  const spreadIndexMiddle = dist(lm[8], lm[12]) / palmLen;
  const handHorizontal = Math.abs(lm[9].x - wrist.x) > Math.abs(lm[9].y - wrist.y) * 1.15;
  const fingersPointDown = lm[9].y > wrist.y + palmLen * 0.3;
  const thumbPointUp = lm[4].y < lm[3].y && lm[4].y < lm[5].y - palmLen * 0.25;

  // Mirrored landmarks for selfie canvas rendering
  const mirroredLandmarks = lm.map(p => ({
    x: Number((1 - p.x).toFixed(4)),
    y: Number(p.y.toFixed(4)),
    z: Number((p.z || 0).toFixed(4))
  }));

  const makeDigitResult = (sym, customRule, conf = 0.98) => {
    const dObj = mockDigitsCatalog.find(d => d.symbol === sym) || mockDigitsCatalog[0];
    return {
      detected_symbol: dObj.symbol,
      symbol_type: "digit",
      label_ru: dObj.label_ru,
      label_kg: dObj.label_kg,
      label_en: dObj.label_en,
      finger_states: f,
      confidence: conf,
      hand_landmarks_21: mirroredLandmarks,
      anatomical_rule: customRule || dObj.rule
    };
  };

  const makeLetterResult = (sym, customRule, conf = 0.97) => {
    const lObj = mockLettersCatalog.find(l => l.symbol === sym) || {
      symbol: sym,
      label_ru: `Буква ${sym}`,
      label_kg: `Тамга ${sym}`,
      label_en: `Letter ${sym}`,
      rule: customRule || `Дактильный жест буквы ${sym} [${key}]`
    };
    return {
      detected_symbol: lObj.symbol,
      symbol_type: "letter",
      label_ru: lObj.label_ru,
      label_kg: lObj.label_kg,
      label_en: lObj.label_en,
      finger_states: f,
      confidence: conf,
      hand_landmarks_21: mirroredLandmarks,
      anatomical_rule: customRule || lObj.rule
    };
  };

  const makeWordResult = (gloss, customRule, conf = 0.97) => {
    const sObj = mockSigns.find(s => s.gloss_ky === gloss) || mockSigns[0];
    return {
      detected_symbol: sObj.gloss_ky,
      symbol_type: "word",
      label_ru: `Жест «${sObj.gloss_ru}»`,
      label_kg: `Жаңсоо «${sObj.gloss_ky}»`,
      label_en: `Sign '${sObj.gloss_ky}'`,
      finger_states: f,
      confidence: conf,
      hand_landmarks_21: mirroredLandmarks,
      anatomical_rule: customRule || sObj.description_ky
    };
  };

  // 1. WORDS MODE
  if (scanMode === "words") {
    if (key === "1,1,1,1,1") return makeWordResult("САЛАМ", "Открытая ладонь (все 5 пальцев раскрыты) — приветствие САЛАМ");
    if (key === "1,0,0,0,0") return makeWordResult("РАХМАТ", "Большой палец вверх/от груди — благодарность РАХМАТ");
    if (key === "0,1,1,1,1") return makeWordResult("ПАСПОРТ", "4 пальца прямые вертикально — жест ПАСПОРТ");
    if (key === "0,1,1,0,0") return makeWordResult("ДАРЫГЕР", "Указательный и средний пальцы (проверка пульса) — ВРАЧ / ДАРЫГЕР");
    if (key === "1,0,0,0,1") return makeWordResult("ЖАРДАМ", "Большой палец и мизинец — сигнал ЖАРДАМ (Помощь)");
    if (key === "1,1,0,0,0") return makeWordResult("СПРАВКА", "Большой и указательный пальцы — жест СПРАВКА / ДОКУМЕНТ");
    if (key === "1,1,1,1,0") return makeWordResult("ДО СВИДАНИЯ", "4 пальца раскрыты, мизинец прижат — жест ДО СВИДАНИЯ");
    if (key === "0,0,0,1,1") return makeWordResult("ПОЖАЛУЙСТА", "Безымянный и мизинец вверх — жест ПОЖАЛУЙСТА");
    if (pinchThumbIndex < 0.42 && middleOpen && ringOpen && pinkyOpen) return makeWordResult("ОШГУ", "Кольцо пальцев О — жест ОШГУ");
    if (key === "0,1,0,0,0") return makeWordResult("МЕН", "Указательный палец — жест МЕН (Я)");
    if (key === "0,0,1,1,1") return makeWordResult("ОШГУ", "Переход пальцев из кольца О в форму У — жест ОШГУ");
    return makeWordResult("САЛАМ");
  }

  // 2. DIGITS MODE (0-9)
  if (scanMode === "digits") {
    if (pinchThumbIndex < 0.42 && middleOpen && ringOpen && pinkyOpen) {
      return makeDigitResult("9", "Кольцо ОК (большой + указательный сомкнуты) и 3 пальца вверх ➔ Цифра 9");
    }
    if (key === "0,0,0,0,0" || (pinchThumbIndex < 0.38 && !middleOpen && !ringOpen && !pinkyOpen)) {
      return makeDigitResult("0", "Все пальцы сжаты в кулак / кольцо O ➔ Цифра 0");
    }
    if (key === "0,1,0,0,0" || key === "1,0,0,0,0") {
      return makeDigitResult("1", "Поднят 1 палец вверх ➔ Цифра 1");
    }
    if (key === "0,1,1,0,0" || key === "1,1,0,0,0") {
      return makeDigitResult("2", "Подняты указательный и средний пальцы ➔ Цифра 2");
    }
    if (key === "1,1,1,0,0" || key === "0,1,1,1,0") {
      return makeDigitResult("3", "Раскрыты три пальца ➔ Цифра 3");
    }
    if (key === "0,1,1,1,1") {
      return makeDigitResult("4", "Подняты 4 пальца, большой прижат к ладони ➔ Цифра 4");
    }
    if (key === "1,1,1,1,1") {
      return makeDigitResult("5", "Все 5 пальцев раскрыты ➔ Цифра 5");
    }
    if (key === "1,0,0,0,1" || key === "0,0,0,0,1") {
      return makeDigitResult("6", "Большой палец и мизинец (шака) ➔ Цифра 6");
    }
    if (key === "1,1,0,0,1") {
      return makeDigitResult("7", "Большой, указательный и мизинец ➔ Цифра 7");
    }
    if (key === "1,1,1,0,1" || key === "0,1,0,1,1" || key === "0,1,1,0,1") {
      return makeDigitResult("8", "Четыре пальца с согнутым безымянным/указательным ➔ Цифра 8");
    }
    if (key === "0,0,1,1,1" || key === "1,0,1,1,1") {
      return makeDigitResult("9", "Большой и указательный кольцом, 3 пальца вверх ➔ Цифра 9");
    }
    const openCount = f.reduce((a, b) => a + b, 0);
    return makeDigitResult(String(openCount), `Раскрыто пальцев: ${openCount} [${key}]`);
  }

  // 3. LETTERS MODE (А-Я, Ө, Ү, Ң)
  if (scanMode === "letters") {
    if (pinchThumbIndex < 0.40 && middleOpen && ringOpen && pinkyOpen) {
      return makeLetterResult("О", "Большой и указательный смыкаются кольцом О, 3 пальца вверх");
    }
    if (key === "0,0,0,0,0") {
      return makeLetterResult("А", "Пальцы сжаты в кулак, большой сбоку — Буква А");
    }
    if (key === "1,0,0,0,0") {
      return makeLetterResult("Т", "Большой палец отведён вверх/в сторону — Буква Т");
    }
    if (key === "0,1,0,0,0") {
      if (fingersPointDown) return makeLetterResult("Р", "Указательный палец направлен вниз — Буква Р");
      if (handHorizontal) return makeLetterResult("Г", "Горизонтальный наклон с указательным пальцем — Буква Г");
      return makeLetterResult("И", "Указательный палец вертикально вверх — Буква И");
    }
    if (key === "1,1,0,0,0") {
      if (fingersPointDown) return makeLetterResult("Л", "L-жест с наклоном вниз — Буква Л");
      if (handHorizontal) return makeLetterResult("Г", "Большой и указательный под прямым углом Г — Буква Г");
      return makeLetterResult("Л", "L-жест (большой + указательный раскрыты) — Буква Л");
    }
    if (key === "0,1,1,0,0") {
      if (spreadIndexMiddle > 0.35) {
        return makeLetterResult("В", "Указательный и средний широко разведены V-образно — Буква В");
      }
      return makeLetterResult("П", "Указательный и средний сомкнуты вместе — Буква П");
    }
    if (key === "0,1,1,1,0") {
      if (fingersPointDown) return makeLetterResult("М", "Три пальца опущены вниз тремя ножками — Буква М");
      return makeLetterResult("Ш", "Три пальца (указательный, средний, безымянный) вверх — Буква Ш");
    }
    if (key === "1,1,1,0,0") {
      return makeLetterResult("К", "Большой, указательный и средний раскрыты — Буква К");
    }
    if (key === "0,1,1,1,1") {
      return makeLetterResult("Б", "Четыре пальца подняты вверх, большой прижат — Буква Б");
    }
    if (key === "1,1,1,1,1") {
      return makeLetterResult("Ж", "Открытая ладонь, все 5 пальцев раскрыты — Буква Ж");
    }
    if (key === "1,0,0,0,1") {
      return makeLetterResult("Ы", "Большой палец и мизинец раскрыты — Буква Ы");
    }
    if (key === "0,0,0,0,1") {
      return makeLetterResult("Ң", "Только мизинец строго вверх — Кыргызская буква Ң");
    }
    if (key === "1,1,0,0,1") {
      return makeLetterResult("Ү", "Большой, указательный и мизинец вверх — Кыргызская буква Ү");
    }
    if (key === "0,1,0,0,1" || key === "0,1,0,1,1") {
      return makeLetterResult("Ө", "Указательный и мизинец вверх — Кыргызская буква Ө");
    }
    if (key === "0,0,1,1,1" || key === "1,0,1,1,1") {
      return makeLetterResult("О", "Кольцо пальцев — Буква О");
    }
    if (key === "0,0,0,1,1") {
      return makeLetterResult("И", "Безымянный и мизинец вверх — Буква И");
    }
    if (key === "0,1,1,0,1") {
      return makeLetterResult("Н", "Безымянный палец согнут, остальные прямые — Буква Н");
    }
    return makeLetterResult("А");
  }

  // 4. AUTO MODE (Smart hybrid: distinctive dactyl orientations + digits 0-9)
  // NOTE: "OK-ring + 3 fingers" is ambiguous (digit 9 / letter О) — in AUTO mode
  // we always resolve it to digit 9 (server-side classifier does the same),
  // letter О is available in the dedicated "Буквы" mode.
  if (pinchThumbIndex < 0.40 && middleOpen && ringOpen && pinkyOpen) {
    return makeDigitResult("9", "Кольцо ОК (большой + указательный сомкнуты) и 3 пальца вверх ➔ Цифра 9 (или буква О в режиме «Буквы»)");
  }
  if (fingersPointDown && key === "0,1,1,1,0") {
    return makeLetterResult("М", "Три пальца направлены вниз — Буква М");
  }
  if (fingersPointDown && (key === "0,1,0,0,0" || key === "0,1,1,0,0")) {
    return makeLetterResult("Р", "Пальцы направлены вниз — Буква Р");
  }
  if (handHorizontal && (key === "1,1,0,0,0" || key === "0,1,0,0,0")) {
    return makeLetterResult("Г", "Горизонтальный угол большого и указательного — Буква Г");
  }
  if (key === "0,0,0,0,1") {
    return makeLetterResult("Ң", "Мизинец строго вверх — Кыргызская буква Ң");
  }
  if (key === "0,1,0,0,1") {
    return makeLetterResult("Ө", "Указательный и мизинец — Кыргызская буква Ө");
  }
  if (key === "1,0,0,0,0") {
    return thumbPointUp
      ? makeLetterResult("А", "Кулак с поднятым большим пальцем — Буква А")
      : makeLetterResult("Т", "Большой палец в сторону — Буква Т");
  }
  if (key === "1,1,0,0,0") {
    return makeLetterResult("Л", "Большой и указательный раскрыты L-жестом — Буква Л");
  }
  if (key === "0,1,1,0,0" && spreadIndexMiddle <= 0.35) {
    return makeLetterResult("П", "Указательный и средний сомкнуты вместе — Буква П");
  }
  if (key === "0,0,0,0,0") return makeDigitResult("0", "Кулак (все пальцы сжаты) ➔ Цифра 0 (или буква А)");
  if (key === "0,1,0,0,0") return makeDigitResult("1", "Указательный палец вверх ➔ Цифра 1 (или буква И)");
  if (key === "0,1,1,0,0") return makeDigitResult("2", "Указательный и средний V-жестом ➔ Цифра 2 (или буква В)");
  if (key === "1,1,1,0,0") return makeDigitResult("3", "Большой, указательный и средний ➔ Цифра 3 (или буква К)");
  if (key === "0,1,1,1,0") return makeLetterResult("Ш", "Три пальца вверх (указательный, средний, безымянный) ➔ Буква Ш / Цифра 3");
  if (key === "0,1,1,1,1") return makeDigitResult("4", "Четыре пальца вверх ➔ Цифра 4 (или буква Б)");
  if (key === "1,1,1,1,1") return makeDigitResult("5", "Все 5 пальцев раскрыты ➔ Цифра 5 (или жест САЛАМ / буква Ж)");
  if (key === "1,0,0,0,1") return makeDigitResult("6", "Большой палец и мизинец ➔ Цифра 6 (или буква Ы)");
  if (key === "1,1,0,0,1") return makeDigitResult("7", "Большой, указательный и мизинец ➔ Цифра 7 (или буква Ү)");
  if (key === "1,1,1,0,1" || key === "0,1,0,1,1" || key === "0,1,1,0,1") {
    return makeDigitResult("8", "Четыре пальца с согнутым безымянным ➔ Цифра 8");
  }
  if (key === "0,0,1,1,1" || key === "1,0,1,1,1") {
    return makeDigitResult("9", "Кольцо ОК + 3 пальца вверх ➔ Цифра 9 (или буква О)");
  }

  // Temporal majority-vote override: keep the symbol that was stable across
  // recent frames even when the current raw classification flickers.
  if (stableSymbolOverride) {
    const ov = String(stableSymbolOverride);
    const dObj = mockDigitsCatalog.find(d => d.symbol === ov);
    if (dObj) return makeDigitResult(ov, null, 0.96);
    const sObj = mockSigns.find(s => s.gloss_ky === ov);
    if (sObj) return makeWordResult(ov, null, 0.96);
    return makeLetterResult(ov, null, 0.96);
  }

  return makeLetterResult("А");
}

// Extract finger extension states [thumb, index, middle, ring, pinky] from real
// 21 landmarks — standalone helper used by the two-hand phrase classifier.
function getFingerStatesFromLandmarks(lm) {
  if (!lm || lm.length < 21) return [0, 1, 0, 0, 0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrist = lm[0];
  const palmLen = dist(lm[9], wrist) || 0.15;
  const thumbOpen =
    dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.12 &&
    dist(lm[4], lm[5]) > palmLen * 0.55
      ? 1
      : 0;
  const indexOpen =
    dist(lm[8], wrist) > dist(lm[6], wrist) * 1.08 &&
    dist(lm[8], lm[5]) > dist(lm[6], lm[5]) * 1.15
      ? 1
      : 0;
  const middleOpen =
    dist(lm[12], wrist) > dist(lm[10], wrist) * 1.08 &&
    dist(lm[12], lm[9]) > dist(lm[10], lm[9]) * 1.15
      ? 1
      : 0;
  const ringOpen =
    dist(lm[16], wrist) > dist(lm[14], wrist) * 1.08 &&
    dist(lm[16], lm[13]) > dist(lm[14], lm[13]) * 1.15
      ? 1
      : 0;
  const pinkyOpen =
    dist(lm[20], wrist) > dist(lm[18], wrist) * 1.08 &&
    dist(lm[20], lm[17]) > dist(lm[18], lm[17]) * 1.15
      ? 1
      : 0;
  return [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen];
}

// TWO-HAND phrase recognition: in real Kyrgyz sign language many phrases are
// performed with BOTH hands simultaneously (e.g. ЖАРДАМ = fist on open palm).
// Matches finger-extension combos of hand A and hand B, words mode only.
function classifyTwoHands(lmA, lmB) {
  if (!lmA || !lmB || lmA.length < 21 || lmB.length < 21) return null;
  const fsA = getFingerStatesFromLandmarks(lmA);
  const fsB = getFingerStatesFromLandmarks(lmB);
  const same = (fs, t) => fs.every((v, i) => v === t[i]);
  const both = t => same(fsA, t) && same(fsB, t);
  const pair = (p, q) => (same(fsA, p) && same(fsB, q)) || (same(fsA, q) && same(fsB, p));

  let gloss = null;
  let rule = "";
  if (both([1, 1, 1, 1, 1])) {
    gloss = "САЛАМ";
    rule = "Две открытые ладони [1,1,1,1,1]+[1,1,1,1,1] — приветствие САЛАМ двумя руками";
  } else if (pair([0, 0, 0, 0, 0], [1, 1, 1, 1, 1])) {
    gloss = "ЖАРДАМ";
    rule = "Кулак, опирающийся на открытую ладонь — ЖАРДАМ (Помощь), двухручный жест";
  } else if (both([0, 1, 1, 1, 1])) {
    gloss = "ПАСПОРТ";
    rule = "Обе ладони четырьмя пальцами [0,1,1,1,1] — контур документа ПАСПОРТ";
  } else if (both([0, 1, 1, 0, 0])) {
    gloss = "ДАРЫГЕР";
    rule = "Обе руки двумя пальцами [0,1,1,0,0] к запястью — ДАРЫГЕР (Врач)";
  } else if (both([1, 0, 0, 0, 0])) {
    gloss = "РАХМАТ";
    rule = "Обе руки с поднятым большим пальцем [1,0,0,0,0] от груди — РАХМАТ (Спасибо)";
  } else if (both([1, 1, 0, 0, 0])) {
    gloss = "СПРАВКА";
    rule = "Обе руки большим и указательным [1,1,0,0,0] — СПРАВКА (Документ)";
  }
  if (!gloss) return null;

  const sObj = mockSigns.find(s => s.gloss_ky === gloss);
  const mirror = lm =>
    lm.slice(0, 21).map(p => ({
      x: Number((1 - p.x).toFixed(4)),
      y: Number(p.y.toFixed(4)),
      z: Number((p.z || 0).toFixed(4))
    }));
  return {
    detected_symbol: gloss,
    symbol_type: "word",
    label_ru: `Двухручный жест «${sObj ? sObj.gloss_ru : gloss}»`,
    label_kg: `Эки колдуу жаңсоо «${gloss}»`,
    label_en: `Two-handed sign '${gloss}'`,
    finger_states: fsA,
    finger_states_second_hand: fsB,
    confidence: 0.97,
    hand_landmarks_21: mirror(lmA),
    hand_landmarks_21_second: mirror(lmB),
    anatomical_rule: rule,
    two_handed: true
  };
}

// Cheat-sheet reference cards for webcam users
// ============================================================================
// CAMERA DEVICE SELECTION HELPERS
// Prefer the laptop's own built-in webcam and skip phone/virtual cameras
// (DroidCam, Iriun, EpocCam, Camo, OBS, Snap Camera, ManyCam, Continuity и т.п.)
// ============================================================================
const CAMERA_PREF_KEY = "imotech_camera_device_id";

const VIRTUAL_CAMERA_KEYWORDS = [
  "virtual", "droid", "iriun", "epoc", "camo", "manycam", "snap", "obs ",
  "phone", "android", "iphone", "ios", "continuity", "remote", "wireless",
  "wifi", "виртуал", "телефон", "смартфон", "screen share", "mirroring"
];

const BUILTIN_CAMERA_KEYWORDS = [
  "integrated", "built-in", "builtin", "internal", "webcam", "notebook",
  "laptop", "easycamera", "front", "встроен", "интегрир", "hd camera",
  "hd webcam", "thinkpad", "truesense", "truevision", "lifebook", "travelmate"
];

function scoreCameraLabel(label) {
  const l = String(label || "").toLowerCase();
  if (!l) return 0;
  let score = 0;
  for (const k of VIRTUAL_CAMERA_KEYWORDS) {
    if (l.includes(k)) score -= 60;
  }
  for (const k of BUILTIN_CAMERA_KEYWORDS) {
    if (l.includes(k)) score += 35;
  }
  return score;
}

function pickBestCamera(cameras, currentDeviceId) {
  if (!cameras || cameras.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const cam of cameras) {
    // +5 for currently active device (avoids pointless switches on ties)
    const score = scoreCameraLabel(cam.label) + (cam.deviceId === currentDeviceId ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = cam;
    }
  }
  return best;
}

const WEBCAM_CHEAT_DIGITS = [
  { sym: "0", pose: "✊ Кулак [0,0,0,0,0]", hint: "Сожмите все пальцы в кулак" },
  { sym: "1", pose: "☝️ Указательный [0,1,0,0,0]", hint: "Поднимите указательный палец" },
  { sym: "2", pose: "✌️ Два пальца V [0,1,1,0,0]", hint: "Указательный + средний разведены" },
  { sym: "3", pose: "🤟 Три пальца [1,1,1,0,0]", hint: "Большой + указательный + средний" },
  { sym: "4", pose: "🖖 Четыре пальца [0,1,1,1,1]", hint: "4 пальца вверх, большой прижат" },
  { sym: "5", pose: "🖐️ Открытая ладонь [1,1,1,1,1]", hint: "Раскройте все 5 пальцев" },
  { sym: "6", pose: "🤙 Шака [1,0,0,0,1]", hint: "Большой палец + мизинец" },
  { sym: "7", pose: "🤟 [1,1,0,0,1]", hint: "Большой + указательный + мизинец" },
  { sym: "8", pose: "🖐️ Без безымянного [1,1,1,0,1]", hint: "Согните только безымянный" },
  { sym: "9", pose: "👌 Кольцо ОК [0,0,1,1,1]", hint: "Большой + указательный в кольцо, 3 вверх" }
];

const WEBCAM_CHEAT_LETTERS = [
  { sym: "А", pose: "✊ Кулак / 👍 Вверх", hint: "Кулак (в режиме Буквы) или большой вверх" },
  { sym: "Б", pose: "🖖 4 пальца [0,1,1,1,1]", hint: "4 пальца вверх, большой к ладони" },
  { sym: "В", pose: "✌️ V-жест широко", hint: "Указательный и средний разведены" },
  { sym: "Г", pose: "👉 Кисть горизонтально", hint: "Указательный + большой вбок" },
  { sym: "И", pose: "☝️ Указательный [0,1,0,0,0]", hint: "Указательный вверх (в режиме Буквы)" },
  { sym: "К", pose: "🤟 Три пальца [1,1,1,0,0]", hint: "Большой + указательный + средний" },
  { sym: "Л", pose: "👆 L-жест [1,1,0,0,0]", hint: "Большой + указательный углом" },
  { sym: "М", pose: "👇 3 пальца вниз", hint: "Опустите 3 пальца вниз" },
  { sym: "Ң", pose: "🤙 Только мизинец [0,0,0,0,1]", hint: "Мизинец вертикально вверх" },
  { sym: "О", pose: "👌 Кольцо ОК", hint: "Сомкните большой и указательный кольцом" },
  { sym: "Ө", pose: "🤘 Рокер [0,1,0,0,1]", hint: "Указательный + мизинец вверх" },
  { sym: "П", pose: "🤞 2 пальца вместе", hint: "Указательный и средний сомкнуты" },
  { sym: "Р", pose: "👇 Пальцы вниз", hint: "Указательный палец вниз" },
  { sym: "Т", pose: "👍 Большой вбок [1,0,0,0,0]", hint: "Только большой палец открыт" },
  { sym: "Ү", pose: "🤟 [1,1,0,0,1]", hint: "Большой + указательный + мизинец" },
  { sym: "Ш", pose: "🖖 3 пальца вверх [0,1,1,1,0]", hint: "Указательный + средний + безымянный" },
  { sym: "Ы", pose: "🤙 Шака [1,0,0,0,1]", hint: "Большой палец + мизинец" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("scanner"); // 'scanner' | 'photo' | 'video' | 'youtube'
  const [backendStatus, setBackendStatus] = useState({ online: false, mode: "checking" });

  // === TAB 1: LIVE GESTURE SCANNER (LETTERS & DIGITS) ===
  const [scanMode, setScanMode] = useState("auto"); // 'auto' | 'digits' | 'letters' | 'words'
  const [photoMode, setPhotoMode] = useState("auto"); // own mode selector for the Photo tab
  const [fingerStates, setFingerStates] = useState([0, 1, 1, 0, 0]);
  const [wristAngle, setWristAngle] = useState(0);
  const [classifiedGesture, setClassifiedGesture] = useState({
    detected_symbol: "2",
    symbol_type: "digit",
    label_ru: "Цифра 2 (Два)",
    label_kg: "Сан 2 (Эки)",
    label_en: "Digit 2 (Two)",
    finger_states: [0, 1, 1, 0, 0],
    confidence: 0.98,
    hand_landmarks_21: buildLandmarks21FromFingers([0, 1, 1, 0, 0], 0),
    anatomical_rule: "Подняты указательный и средний пальцы (V-жест) [0, 1, 1, 0, 0]"
  });
  const [assembledText, setAssembledText] = useState("ОШ-2027 ");
  const [autoAppend, setAutoAppend] = useState(true);
  const [webcamActive, setWebcamActive] = useState(false);
  const [handDetectedLive, setHandDetectedLive] = useState(false);
  const [webcamStatus, setWebcamStatus] = useState("Нажмите зелёную кнопку «Включить веб-камеру», чтобы нейросеть MediaPipe Hands считывала вашу руку вживую");
  const [dwellProgress, setDwellProgress] = useState(0);
  const [dwellAddedFlash, setDwellAddedFlash] = useState(false);
  const [isAutoDemoRunning, setIsAutoDemoRunning] = useState(false);
  const [catalogTab, setCatalogTab] = useState("digits"); // 'digits' | 'letters' | 'words'
  const [copyNotice, setCopyNotice] = useState("");
  const [cameraDevices, setCameraDevices] = useState([]);   // [{deviceId, label}]
  const [selectedCameraId, setSelectedCameraId] = useState(
    (() => {
      try { return window.localStorage.getItem("imotech_camera_device_id") || ""; } catch (_e) { return ""; }
    })()
  );
  const selectedCameraIdRef = useRef(selectedCameraId);

  useEffect(() => {
    selectedCameraIdRef.current = selectedCameraId;
    try { window.localStorage.setItem("imotech_camera_device_id", selectedCameraId); } catch (_e) { /* ignore */ }
  }, [selectedCameraId]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const webcamRafRef = useRef(null);
  const isSendingMpRef = useRef(false);
  const webcamActiveRef = useRef(false);
  const scanModeRef = useRef(scanMode);
  const photoModeRef = useRef(photoMode);
  const autoAppendRef = useRef(autoAppend);
  const dwellRef = useRef({ symbol: null, frames: 0, cooldownUntil: 0 });
  const smoothedLandmarksRef = useRef(null); // EMA-smoothed 21 landmarks (jitter killer)
  const symbolVoteBufferRef = useRef([]);    // temporal majority-vote buffer

  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  useEffect(() => {
    photoModeRef.current = photoMode;
  }, [photoMode]);

  useEffect(() => {
    autoAppendRef.current = autoAppend;
  }, [autoAppend]);

  // === TAB 2: VIDEO FILE PROCESSING ===
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);
  const [uploadedFileMeta, setUploadedFileMeta] = useState({
    name: "",
    duration: 0.0,
    sizeMb: "—"
  });
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoResult, setVideoResult] = useState(null);
  const [activeVideoSegmentIdx, setActiveVideoSegmentIdx] = useState(0);
  const [liveVideoScanning, setLiveVideoScanning] = useState(false);
  const uploadVideoElRef = useRef(null);
  const videoCanvasRef = useRef(null);
  const videoHandsRef = useRef(null);
  const videoLastSymbolRef = useRef({ sym: null, time: -10 });

  // === TAB 2: PHOTO FILE PROCESSING (JPG / PNG / WEBP + webcam snapshot) ===
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState(null);
  const [photoFileMeta, setPhotoFileMeta] = useState({ name: "gesture_photo.jpg", sizeMb: "—" });
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoStatus, setPhotoStatus] = useState(
    "Загрузите фото с жестом руки (JPG / PNG / WEBP) — нейросеть MediaPipe Hands найдёт 21 ключевую точку кисти и переведёт жест в букву, цифру или слово"
  );
  const [photoResult, setPhotoResult] = useState(null);
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const photoCanvasRef = useRef(null);
  const photoImgRef = useRef(null);   // last analyzed HTMLImageElement
  const photoMetaRef = useRef({ name: "gesture_photo.jpg", sizeMb: "—", source: "upload" });
  const photoHandsRef = useRef(null); // cached MediaPipe Hands instance for photos

  // === TAB 3: YOUTUBE LINK TRANSLATOR ===
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("https://www.youtube.com/watch?v=feA64wXhbjo");
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeResult, setYoutubeResult] = useState(null);
  const [activeYoutubeSegIdx, setActiveYoutubeSegIdx] = useState(0);
  const [youtubeCapturing, setYoutubeCapturing] = useState(false);
  const [youtubeCaptureStatus, setYoutubeCaptureStatus] = useState("");
  const youtubeIframeRef = useRef(null);
  const youtubeCanvasRef = useRef(null);
  const youtubeCaptureVideoRef = useRef(null);
  const youtubeStreamRef = useRef(null);
  const youtubeHandsRef = useRef(null);
  const youtubeRafRef = useRef(null);
  const youtubeCapturingRef = useRef(false);
  const youtubeLastSymRef = useRef({ sym: null, time: -10 });
  const youtubeCaptureStartRef = useRef(0);

  // === REAL SERVER PROCESSING STATE (YouTube / video / photo uploads) ===
  // === REAL SERVER PROCESSING STATE (YouTube / video / photo uploads) ===
  const [realProcessing, setRealProcessing] = useState(false); // busy flag for server CV jobs
  const [realProgress, setRealProgress] = useState(0);          // upload progress %
  const [realError, setRealError] = useState("");               // last server error message
  const [videoStatus, setVideoStatus] = useState("");
  const [youtubeStatus, setYoutubeStatus] = useState("");

  // Initial load
  useEffect(() => {
    async function initApp() {
      const health = await apiService.getHealth();
      setBackendStatus({ online: health.status === "ok" && health.mode !== "standalone", mode: health.mode || "live" });

      const initialGesture = await apiService.classifyGesture({
        mode: "auto",
        finger_states: [0, 1, 1, 0, 0]
      });
      setClassifiedGesture(initialGesture);

      // Populate camera list for the manual camera selector (labels fill in after permission)
      refreshCameraList();
    }
    initApp();

    return () => {
      stopWebcam();
      stopYouTubeScreenCapture();
    };
  }, []);

  // ============================================================================
  // HELPER: Draw 21-point hand skeleton onto any 2D canvas context
  // ============================================================================
  function drawSkeleton21OnCanvas(ctx, w, h, pts, scaleX = 1.0, offsetX = 0) {
    if (!pts || pts.length < 21) return;

    // Draw bone connections
    for (const [i, j] of HAND_CONNECTIONS) {
      const p1 = pts[i];
      const p2 = pts[j];
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x * w * scaleX + offsetX, p1.y * h);
      ctx.lineTo(p2.x * w * scaleX + offsetX, p2.y * h);
      ctx.strokeStyle =
        j <= 4 ? "#06b6d4" : j <= 8 ? "#a855f7" : j <= 12 ? "#10b981" : j <= 16 ? "#f59e0b" : "#ec4899";
      ctx.lineWidth = 4.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw 21 landmark nodes with index numbers
    pts.forEach((p, idx) => {
      const cx = p.x * w * scaleX + offsetX;
      const cy = p.y * h;
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      ctx.beginPath();
      ctx.arc(cx, cy, isTip ? 8 : idx === 0 ? 9 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? "#6366f1" : isTip ? "#34d399" : "#f8fafc";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();

      if (isTip || idx === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(String(idx), cx + 10, cy + 4);
      }
    });
  }

  function drawHudBadgeOnCanvas(ctx, w, classified) {
    if (!classified?.detected_symbol) return;
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = "rgba(16, 185, 129, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(w - 138, 14, 122, 100, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      classified.symbol_type === "digit"
        ? "ЦИФРА (0–9)"
        : classified.symbol_type === "letter"
        ? "БУКВА ДАКТИЛЯ"
        : "ЖЕСТ / ФРАЗА",
      w - 77,
      32
    );

    ctx.fillStyle = "#34d399";
    ctx.font = classified.detected_symbol.length > 2 ? "bold 19px sans-serif" : "bold 46px sans-serif";
    ctx.fillText(classified.detected_symbol, w - 77, 78);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`${Math.round((classified.confidence || 0.97) * 100)}% точность`, w - 77, 102);
    ctx.textAlign = "start";
  }

  // ============================================================================
  // REAL MEDIAPIPE HANDS RESULTS CALLBACK (60 FPS LIVE WEBCAM)
  // ============================================================================
  // === LIVE RECOGNITION QUALITY: EMA landmark smoothing + temporal majority vote ===
  function smoothLandmarks(lm) {
    // Exponential moving average across frames kills MediaPipe jitter
    // without adding perceptible latency (A=0.45: 45% new frame, 55% history).
    const prev = smoothedLandmarksRef.current;
    if (!prev || prev.length !== lm.length) {
      smoothedLandmarksRef.current = lm.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
      return smoothedLandmarksRef.current;
    }
    const A = 0.45;
    for (let i = 0; i < lm.length; i++) {
      const s = prev[i];
      s.x = s.x * (1 - A) + lm[i].x * A;
      s.y = s.y * (1 - A) + lm[i].y * A;
      s.z = (s.z || 0) * (1 - A) + (lm[i].z || 0) * A;
    }
    return prev;
  }

  function voteStableSymbol(rawSymbol) {
    // Temporal majority vote over the last 5 raw classifications:
    // the dwell timer only reacts to symbols stable in >= 60% of frames.
    const vb = symbolVoteBufferRef.current;
    vb.push(rawSymbol);
    if (vb.length > 5) vb.shift();
    const counts = {};
    vb.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    let bestSym = rawSymbol;
    let bestN = 0;
    for (const s in counts) {
      if (counts[s] > bestN) { bestN = counts[s]; bestSym = s; }
    }
    return { symbol: bestSym, stable: bestN >= Math.ceil(vb.length * 0.6) };
  }

  function onMediaPipeResults(results) {
    if (!webcamActiveRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Mirror-draw webcam image
    const imgSource = results.image || videoRef.current;
    if (imgSource) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(imgSource, 0, 0, w, h);
      ctx.restore();
      ctx.fillStyle = "rgba(7, 11, 20, 0.22)";
      ctx.fillRect(0, 0, w, h);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const hands = results.multiHandLandmarks;
      setHandDetectedLive(true);

      let stableClassified = null;
      let secondaryLm = null;
      let voteStable = true;

      // TWO-HAND phrase detection (words mode): both hands together form one phrase
      if (hands.length >= 2 && scanModeRef.current === "words") {
        const two = classifyTwoHands(hands[0], hands[1]);
        if (two) {
          const vote2 = voteStableSymbol(two.detected_symbol);
          if (vote2.stable) {
            stableClassified = two;
            secondaryLm = two.hand_landmarks_21_second;
          } else {
            // Two-hand gesture is forming — preview skeletons, no dwell yet
            const mirrorPts = lm =>
              lm.slice(0, 21).map(p => ({ x: 1 - p.x, y: p.y, z: p.z || 0 }));
            drawSkeleton21OnCanvas(ctx, w, h, mirrorPts(hands[0]));
            drawSkeleton21OnCanvas(ctx, w, h, mirrorPts(hands[1]));
            setFingerStates(getFingerStatesFromLandmarks(hands[0]));
            setWebcamStatus(
              `✋✋ ДВЕ РУКИ В КАДРЕ — двухручный жест формируется: «${two.detected_symbol}» (держите обе ладони)`
            );
            drawHudBadgeOnCanvas(ctx, w, two);
            setDwellProgress(0);
            return;
          }
        }
      }

      if (!stableClassified) {
        const lm = smoothLandmarks(hands[0]);
        const realClassified = classifyRealLandmarks(lm, scanModeRef.current);
        if (realClassified) {
          // Stabilize symbol with temporal majority vote before showing/dwelling
          const vote = voteStableSymbol(realClassified.detected_symbol);
          voteStable = vote.stable;
          stableClassified =
            vote.symbol !== realClassified.detected_symbol
              ? classifyRealLandmarks(lm, scanModeRef.current, vote.symbol)
              : realClassified;
        }
      }

      if (stableClassified) {
        setFingerStates(stableClassified.finger_states);
        setClassifiedGesture(stableClassified);
        const handCountLabel = hands.length >= 2 ? "2 РУКИ" : "1 РУКА";
        setWebcamStatus(
          `✅ КИСТЬ ОБНАРУЖЕНА (${handCountLabel}, 21 точка MediaPipe) • Жест: «${stableClassified.detected_symbol}» (${stableClassified.label_ru})`
        );

        // Draw real 21 landmarks onto mirrored canvas (each detected hand)
        drawSkeleton21OnCanvas(ctx, w, h, stableClassified.hand_landmarks_21);
        if (secondaryLm) drawSkeleton21OnCanvas(ctx, w, h, secondaryLm);
        drawHudBadgeOnCanvas(ctx, w, stableClassified);

        // Hold-to-Append Dwell Timer (~18 frames = ~1.1 sec), driven by the
        // majority-voted stable symbol — no flicker from single noisy frames.
        const now = Date.now();
        const dw = dwellRef.current;
        if (!voteStable) {
          // classification in transition — keep current dwell state untouched
          setDwellProgress(prev => prev);
        } else if (dw.symbol === stableClassified.detected_symbol) {
          if (now > dw.cooldownUntil) {
            dw.frames += 1;
            const pct = Math.min(100, Math.round((dw.frames / 18) * 100));
            setDwellProgress(pct);

            if (dw.frames >= 18 && autoAppendRef.current) {
              const sym = stableClassified.detected_symbol;
              setAssembledText(prev => (sym.length > 1 ? `${prev.trimEnd()} ${sym} ` : `${prev}${sym}`));
              setDwellAddedFlash(true);
              setTimeout(() => setDwellAddedFlash(false), 1100);
              dw.frames = 0;
              dw.cooldownUntil = now + 1800;
              setDwellProgress(100);
            }
          } else {
            setDwellProgress(0);
          }
        } else {
          dw.symbol = stableClassified.detected_symbol;
          dw.frames = 1;
          dw.cooldownUntil = 0;
          setDwellProgress(6);
        }
      }
    } else {
      // No hand visible in front of camera — DO NOT draw fake static skeleton!
      setHandDetectedLive(false);
      dwellRef.current.frames = 0;
      smoothedLandmarksRef.current = null;
      symbolVoteBufferRef.current = [];
      setDwellProgress(0);
      setWebcamStatus("В кадре нет руки — поднесите ладонь к камере");

      // Draw clear instructional prompt banner on live camera canvas
      ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w * 0.08, h - 78, w * 0.84, 58, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("В кадре нет руки — поднесите ладонь к камере", w * 0.5, h - 50);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "12px sans-serif";
      ctx.fillText("Разгибайте или сгибайте пальцы перед объективом для перевода в цифры (0–9) и буквы (А–Я)", w * 0.5, h - 31);
      ctx.textAlign = "start";
    }
  }

  // Draw static/interactive 21-point hand skeleton ONLY when webcam is OFF
  useEffect(() => {
    if (webcamActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Tech radar grid background
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, "#172554");
    grad.addColorStop(0.6, "#0f172a");
    grad.addColorStop(1, "#070b14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const pts =
      classifiedGesture?.hand_landmarks_21 && classifiedGesture.hand_landmarks_21.length === 21
        ? classifiedGesture.hand_landmarks_21
        : buildLandmarks21FromFingers(fingerStates, wristAngle);

    drawSkeleton21OnCanvas(ctx, w, h, pts);
    drawHudBadgeOnCanvas(ctx, w, classifiedGesture);
  }, [classifiedGesture, fingerStates, wristAngle, webcamActive]);

  // Draw Video Frame Analysis preview on Tab 2 canvas (when not actively playing live MediaPipe video scan)
  useEffect(() => {
    if (liveVideoScanning || isProcessingVideo) return;
    const canvas = videoCanvasRef.current;
    if (!canvas || !videoResult || !videoResult.segments) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(99, 102, 241, 0.12)";
    for (let x = 0; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    if (videoResult.segments.length === 0) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = "rgba(244, 63, 94, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(24, h * 0.25, w - 48, h * 0.5, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fda4af";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("В загруженном видео кисти рук не обнаружены (распознано 0 жестов).", w * 0.5, h * 0.46);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "12px sans-serif";
      ctx.fillText("Загрузите видео с жестами руки перед камерой или нажмите Play для живого сканирования.", w * 0.5, h * 0.60);
      ctx.textAlign = "start";
      return;
    }

    const seg = videoResult.segments[activeVideoSegmentIdx] || videoResult.segments[0];
    if (!seg) return;

    const pts = seg.hand_landmarks_21 || buildLandmarks21FromFingers(seg.finger_states || [0, 1, 1, 0, 0], 0);
    drawSkeleton21OnCanvas(ctx, w, h, pts, 0.62, 18);

    // Draw HUD info on right side of video frame
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.beginPath();
    ctx.roundRect(w - 235, 14, 220, h - 28, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`ТАЙМКОД: ${seg.timecode}`, w - 220, 40);

    ctx.fillStyle = "#34d399";
    ctx.font = seg.symbol.length > 2 ? "bold 24px sans-serif" : "bold 42px sans-serif";
    ctx.fillText(seg.symbol, w - 220, 90);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText((seg.word_ru || "").slice(0, 25), w - 220, 124);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText((seg.word_kg || "").slice(0, 26), w - 220, 145);

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`Пальцы: [${(seg.finger_states || []).join(", ")}]`, w - 220, 174);
    ctx.fillText(`Точность: ${Math.round((seg.confidence || 0.97) * 100)}%`, w - 220, 194);
  }, [videoResult, activeVideoSegmentIdx, liveVideoScanning, isProcessingVideo]);

  // Draw YouTube Synchronized 21-Point Skeleton on Tab 3 canvas (when not actively capturing live screen)
  useEffect(() => {
    if (youtubeCapturing) return;
    const canvas = youtubeCanvasRef.current;
    if (!canvas || !youtubeResult || !youtubeResult.detected_timeline) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#090d16");
    grad.addColorStop(1, "#172554");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (youtubeResult.detected_timeline.length === 0) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(18, 22, w - 36, h - 44, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎥 Пользовательское видео YouTube (вне предразмеченного корпуса)", w * 0.5, h * 0.42);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px sans-serif";
      ctx.fillText("Нажмите кнопку «Запустить живой нейросетевой захват окна YouTube» ниже,", w * 0.5, h * 0.58);
      ctx.fillText("чтобы MediaPipe Hands считывал реальные жесты руки прямо из видеопотока!", w * 0.5, h * 0.72);
      ctx.textAlign = "start";
      return;
    }

    const seg = youtubeResult.detected_timeline[activeYoutubeSegIdx] || youtubeResult.detected_timeline[0];
    if (!seg) return;

    const pts = seg.hand_landmarks_21 || buildLandmarks21FromFingers(seg.finger_states || [1, 1, 1, 1, 1], 0);
    drawSkeleton21OnCanvas(ctx, w, h, pts, 0.58, 20);

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.beginPath();
    ctx.roundRect(w - 245, 12, 230, h - 24, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`YOUTUBE ТАЙМКОД: ${seg.timestamp_label}`, w - 230, 36);

    ctx.fillStyle = "#34d399";
    ctx.font = seg.symbol.length > 2 ? "bold 22px sans-serif" : "bold 40px sans-serif";
    ctx.fillText(seg.symbol, w - 230, 82);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText((seg.text_ru || "").slice(0, 28), w - 230, 110);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "11.5px sans-serif";
    ctx.fillText(`🇰🇬 ${(seg.text_kg || "").slice(0, 26)}`, w - 230, 130);

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`Код пальцев: [${(seg.finger_states || []).join(", ")}]`, w - 230, 156);
  }, [youtubeResult, activeYoutubeSegIdx, youtubeCapturing]);

  // === HANDLERS FOR TAB 1: GESTURE SCANNER ===
  async function triggerClassify(nextFingers, nextMode = scanMode, explicitCode = null, nextAngle = wristAngle, shouldAppend = false) {
    setFingerStates(nextFingers);
    const res = await apiService.classifyGesture({
      mode: nextMode,
      finger_states: nextFingers,
      gesture_code: explicitCode,
      wrist_angle_deg: nextAngle
    });
    setClassifiedGesture(res);
    if (shouldAppend && res?.detected_symbol) {
      const sym = res.detected_symbol;
      setAssembledText(prev => (sym.length > 1 ? `${prev.trimEnd()} ${sym} ` : `${prev}${sym}`));
    }
  }

  function handleToggleFinger(idx) {
    const updated = [...fingerStates];
    updated[idx] = updated[idx] === 1 ? 0 : 1;
    triggerClassify(updated, scanMode, null, wristAngle, false);
  }

  function handleSelectCatalogItem(item) {
    const targetMode =
      item.symbol_type === "digit"
        ? "digits"
        : item.symbol_type === "letter"
        ? "letters"
        : "words";
    if (scanMode !== "auto" && scanMode !== targetMode) {
      setScanMode(targetMode);
    }
    triggerClassify(item.fingers, scanMode === "auto" ? "auto" : targetMode, item.symbol, wristAngle, autoAppend);
  }

  async function refreshCameraList() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter(d => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Камера ${i + 1}` }));
      setCameraDevices(cams);
      return cams;
    } catch (_e) {
      return [];
    }
  }

  async function openCameraStream(deviceId) {
    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId }, width: 640, height: 480 }, audio: false }
      : { video: { width: 640, height: 480, facingMode: "user" }, audio: false };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  function attachStreamToVideo(stream) {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      return videoRef.current.play().catch(() => {});
    }
    return Promise.resolve();
  }

  async function toggleWebcam() {
    if (webcamActive) {
      stopWebcam();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWebcamStatus("⚠️ Браузер не предоставил доступ к веб-камере — работает интерактивный 21-Point трекер");
      return;
    }
    let stream = null;
    try {
      setWebcamStatus("⏳ Запуск камеры и загрузка нейросети MediaPipe Hands (21 точка кисти)...");

      // 1) Open the saved / preferred camera
      try {
        stream = await openCameraStream(selectedCameraIdRef.current || undefined);
      } catch (_firstErr) {
        // saved device may be disconnected — fall back to browser default
        stream = await openCameraStream(undefined);
      }
      await attachStreamToVideo(stream);

      // 2) Now that permission is granted, enumerate cameras (labels become readable)
      const cams = await refreshCameraList();
      const activeTrack = stream.getVideoTracks()[0];
      const activeLabel = (activeTrack && activeTrack.label) || "";
      const activeSettings = (activeTrack && activeTrack.getSettings && activeTrack.getSettings()) || {};
      const activeId = activeSettings.deviceId || "";

      // 3) If no explicit user choice and the active camera is a phone/virtual one,
      //    auto-switch to the built-in webcam
      let autoSwitched = false;
      if (!selectedCameraIdRef.current && activeId && cams.length > 1) {
        const best = pickBestCamera(cams, activeId);
        const activeScore = scoreCameraLabel(activeLabel) + 5;
        if (best && best.deviceId && best.deviceId !== activeId && scoreCameraLabel(best.label) > activeScore) {
          setWebcamStatus(`🔄 Обнаружена камера телефона/виртуальная («${activeLabel}»). Переключаюсь на встроенную камеру ноутбука: ${best.label}...`);
          try {
            stream.getTracks().forEach(t => t.stop());
            const betterStream = await openCameraStream(best.deviceId);
            await attachStreamToVideo(betterStream);
            stream = betterStream;
            setSelectedCameraId(best.deviceId);
            autoSwitched = true;
          } catch (_switchErr) {
            // keep the original stream if the switch failed
            try {
              stream = await openCameraStream(activeId);
              await attachStreamToVideo(stream);
            } catch (_restoreErr) {
              /* ignore */
            }
          }
        }
      }

      // Initialize real @mediapipe/hands instance
      if (window.Hands && !handsRef.current) {
        const hands = new window.Hands({
          locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: 2, // two-handed phrases (ЖАРДАМ, ПАСПОРТ, ДАРЫГЕР...)
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6
        });
        hands.onResults(onMediaPipeResults);
        handsRef.current = hands;
      }

      webcamActiveRef.current = true;
      setWebcamActive(true);
      const camName = (stream.getVideoTracks()[0] && stream.getVideoTracks()[0].label) || "встроенная камера";
      setWebcamStatus(`🟢 ВЕБ-КАМЕРА АКТИВНА (${camName}) • Покажите руку перед объективом для перевода в цифры и буквы!`);

      // Start live requestAnimationFrame loop sending frames to MediaPipe Hands
      const pumpFrames = async () => {
        if (!webcamActiveRef.current) return;
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2) {
          if (handsRef.current && !isSendingMpRef.current) {
            isSendingMpRef.current = true;
            try {
              await handsRef.current.send({ image: vid });
            } catch (_mpErr) {
              // Fallback draw if CDN asset blocked offline
              onMediaPipeResults({ image: vid, multiHandLandmarks: [] });
            }
            isSendingMpRef.current = false;
          } else if (!handsRef.current) {
            onMediaPipeResults({ image: vid, multiHandLandmarks: [] });
          }
        }
        if (webcamActiveRef.current) {
          webcamRafRef.current = requestAnimationFrame(pumpFrames);
        }
      };
      webcamRafRef.current = requestAnimationFrame(pumpFrames);
    } catch (_err) {
      if (stream) {
        try { stream.getTracks().forEach(t => t.stop()); } catch (_e) { /* ignore */ }
      }
      webcamActiveRef.current = false;
      setWebcamActive(false);
      setWebcamStatus("⚠️ Камера недоступна или доступ отклонён — используйте интерактивный 21-Point конструктор пальцев ниже");
    }
  }

  async function switchCamera(deviceId) {
    setSelectedCameraId(deviceId);
    if (!webcamActiveRef.current) {
      setWebcamStatus(deviceId ? "📷 Камера выбрана — нажмите «Включить веб-камеру»" : "📷 Авто-выбор камеры (встроенная камера ноутбука в приоритете)");
      return;
    }
    try {
      const stream = await openCameraStream(deviceId || undefined);
      streamRef.current.getTracks().forEach(t => t.stop());
      await attachStreamToVideo(stream);
      const camName = (stream.getVideoTracks()[0] && stream.getVideoTracks()[0].label) || "камера по умолчанию";
      setWebcamStatus(`🟢 Камера переключена: ${camName} • Покажите руку перед объективом`);
    } catch (_err) {
      setWebcamStatus("⚠️ Не удалось переключить камеру — она может быть занята другой программой. Пробую вернуть предыдущую...");
      try {
        const fallback = await openCameraStream(undefined);
        streamRef.current.getTracks().forEach(t => t.stop());
        await attachStreamToVideo(fallback);
      } catch (_e2) {
        stopWebcam();
      }
    }
  }

  function stopWebcam() {
    webcamActiveRef.current = false;
    if (webcamRafRef.current) {
      cancelAnimationFrame(webcamRafRef.current);
      webcamRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
    setHandDetectedLive(false);
    setDwellProgress(0);
    setWebcamStatus("Веб-камера отключена • Нажмите зелёную кнопку, чтобы снова включить живое распознавание руки");
  }

  function runLiveDemoSequence() {
    if (isAutoDemoRunning) return;
    setIsAutoDemoRunning(true);
    setAssembledText("");
    const demoSteps = [
      { fingers: [0, 0, 1, 1, 1], code: "О", mode: "letters" },
      { fingers: [0, 1, 1, 1, 0], code: "Ш", mode: "letters" },
      { fingers: [0, 1, 1, 0, 0], code: "2", mode: "digits" },
      { fingers: [0, 0, 0, 0, 0], code: "0", mode: "digits" },
      { fingers: [0, 1, 1, 0, 0], code: "2", mode: "digits" },
      { fingers: [1, 1, 0, 0, 1], code: "7", mode: "digits" }
    ];
    let stepIdx = 0;
    const timer = setInterval(() => {
      const s = demoSteps[stepIdx];
      triggerClassify(s.fingers, s.mode, s.code, 0, true);
      stepIdx++;
      if (stepIdx >= demoSteps.length) {
        clearInterval(timer);
        setIsAutoDemoRunning(false);
      }
    }, 650);
  }

  function handleCopyAssembled() {
    if (navigator.clipboard && assembledText) {
      navigator.clipboard.writeText(assembledText);
      setCopyNotice("Скопировано!");
      setTimeout(() => setCopyNotice(""), 1800);
    }
  }

  // === HANDLERS FOR TAB 2: VIDEO FILE PROCESSING & REAL MEDIAPIPE VIDEO SCAN ===
  async function scanUploadedVideoWithMediaPipe(file, objUrl) {
    setIsProcessingVideo(true);
    setVideoProgress(5);

    const probeVideo = document.createElement("video");
    probeVideo.src = objUrl;
    probeVideo.muted = true;
    probeVideo.playsInline = true;
    probeVideo.crossOrigin = "anonymous";

    await new Promise(resolve => {
      const done = () => resolve();
      probeVideo.onloadedmetadata = done;
      probeVideo.onerror = done;
      setTimeout(done, 2500);
    });

    const realDuration =
      Number.isFinite(probeVideo.duration) && probeVideo.duration > 0
        ? Number(probeVideo.duration.toFixed(1))
        : 10.0;

    setUploadedFileMeta(prev => ({
      ...prev,
      duration: realDuration
    }));

    const detectedFrames = [];
    const maxScanSec = Math.min(realDuration, 24.0);
    const stepSec = 0.5;
    const totalSteps = Math.max(1, Math.floor(maxScanSec / stepSec));

    let scannerHands = null;
    let latestResults = null;

    if (window.Hands) {
      try {
        scannerHands = new window.Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        });
        scannerHands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
        scannerHands.onResults(res => {
          latestResults = res;
        });
      } catch (_err) {
        scannerHands = null;
      }
    }

    let lastSymbol = null;
    let lastTime = -10;

    for (let i = 0; i <= totalSteps; i++) {
      const t = Number(Math.min(i * stepSec, maxScanSec).toFixed(2));
      try {
        probeVideo.currentTime = t;
        await new Promise(resolve => {
          const onSeek = () => resolve();
          probeVideo.onseeked = onSeek;
          setTimeout(onSeek, 350);
        });
      } catch (_e) {
        // ignore seek error
      }

      setVideoProgress(Math.min(95, Math.round(((i + 1) / (totalSteps + 1)) * 92)));

      const canvas = videoCanvasRef.current;
      const ctx = canvas ? canvas.getContext("2d") : null;
      if (canvas && ctx && probeVideo.readyState >= 2) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(probeVideo, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(10, 15, 29, 0.28)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      latestResults = null;
      if (scannerHands && probeVideo.readyState >= 2) {
        try {
          await scannerHands.send({ image: probeVideo });
        } catch (_mpErr) {
          latestResults = null;
        }
      }

      if (latestResults && latestResults.multiHandLandmarks && latestResults.multiHandLandmarks.length > 0) {
        const lm = latestResults.multiHandLandmarks[0];
        const unmirroredPts = lm.map(p => ({
          x: Number(p.x.toFixed(4)),
          y: Number(p.y.toFixed(4)),
          z: Number((p.z || 0).toFixed(4))
        }));
        const classified = classifyRealLandmarks(lm, scanModeRef.current);
        if (canvas && ctx) {
          drawSkeleton21OnCanvas(ctx, canvas.width, canvas.height, unmirroredPts);
          if (classified) {
            drawHudBadgeOnCanvas(ctx, canvas.width, classified);
          }
        }
        if (classified && (classified.detected_symbol !== lastSymbol || t - lastTime >= 1.0)) {
          lastSymbol = classified.detected_symbol;
          lastTime = t;
          detectedFrames.push({
            timestamp_sec: t,
            finger_states: classified.finger_states,
            gesture_code: classified.detected_symbol,
            mode: scanModeRef.current,
            hand_landmarks_21: unmirroredPts
          });
        }
      }
    }

    const res = await apiService.processVideo({
      filename: file.name,
      duration_sec: realDuration,
      fps: 30,
      frame_gestures: detectedFrames
    });

    if (detectedFrames.length === 0) {
      res.segments = [];
      res.assembled_string = "";
      res.translation_ru =
        "В загруженном видео кисти рук не обнаружены (распознано 0 жестов). Загрузите видео с жестами руки перед камерой.";
      res.translation_kg =
        "Жүктөлгөн видеодо колдун манжалары табылган жок (0 жаңсоо таанылды). Камера алдындагы кол жаңсоолору бар видеону жүктөңүз.";
      res.srt_subtitles = "";
      res.average_confidence = 0.0;
    }

    setVideoProgress(100);
    setIsProcessingVideo(false);
    setVideoResult(res);
    setActiveVideoSegmentIdx(0);
  }

  async function handleVideoFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const objUrl = URL.createObjectURL(file);
    setUploadedVideoUrl(objUrl);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " МБ";
    setUploadedFileMeta({
      name: file.name,
      duration: 0.0,
      sizeMb: sizeStr
    });

    await scanUploadedVideoWithMediaPipe(file, objUrl);
    // Real server-side CV processing of the exact same file (OpenCV + MediaPipe on pixels)
    handleVideoReal(file);
  }

  // Real MediaPipe frame scanning when uploaded video plays
  async function handleUploadedVideoPlay() {
    const vidEl = uploadVideoElRef.current;
    if (!vidEl) return;
    setLiveVideoScanning(true);

    if (window.Hands && !videoHandsRef.current) {
      const vh = new window.Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      vh.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
      vh.onResults(results => {
        const canvas = videoCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (results.image) {
          ctx.drawImage(results.image, 0, 0, w, h);
          ctx.fillStyle = "rgba(10, 15, 29, 0.3)";
          ctx.fillRect(0, 0, w, h);
        }
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const lm = results.multiHandLandmarks[0];
          const unmirroredPts = lm.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
          const classified = classifyRealLandmarks(lm, scanModeRef.current);
          drawSkeleton21OnCanvas(ctx, w, h, unmirroredPts);
          if (classified) {
            drawHudBadgeOnCanvas(ctx, w, classified);
            const curT = vidEl.currentTime || 0;
            if (
              classified.detected_symbol !== videoLastSymbolRef.current.sym ||
              curT - videoLastSymbolRef.current.time > 1.5
            ) {
              videoLastSymbolRef.current = { sym: classified.detected_symbol, time: curT };
              const startS = Number(curT.toFixed(1));
              const endS = Number((curT + 1.2).toFixed(1));
              const newSeg = {
                segment_id: Date.now(),
                start_sec: startS,
                end_sec: endS,
                timecode: `00:${String(startS).padStart(4, "0")} – 00:${String(endS).padStart(4, "0")}`,
                symbol: classified.detected_symbol,
                symbol_type: classified.symbol_type,
                finger_states: classified.finger_states,
                word_ru: classified.label_ru,
                word_kg: classified.label_kg,
                word_en: classified.label_en,
                confidence: classified.confidence,
                hand_landmarks_21: unmirroredPts
              };
              setVideoResult(prev => {
                if (!prev) return prev;
                const nextSegments = [...prev.segments, newSeg];
                return {
                  ...prev,
                  segments: nextSegments,
                  assembled_string: nextSegments.map(s => s.symbol).join(" ")
                };
              });
            }
          }
        }
      });
      videoHandsRef.current = vh;
    }

    const scanStep = async () => {
      if (!vidEl || vidEl.paused || vidEl.ended) {
        setLiveVideoScanning(false);
        return;
      }
      if (videoHandsRef.current && vidEl.readyState >= 2) {
        try {
          await videoHandsRef.current.send({ image: vidEl });
        } catch (_e) {
          // ignore
        }
      }
      requestAnimationFrame(scanStep);
    };
    requestAnimationFrame(scanStep);
  }

  async function runVideoRecognition(payload) {
    setIsProcessingVideo(true);
    setVideoProgress(15);
    const p1 = setTimeout(() => setVideoProgress(55), 180);
    const p2 = setTimeout(() => setVideoProgress(85), 350);

    const res = await apiService.processVideo(payload);
    clearTimeout(p1);
    clearTimeout(p2);
    setVideoProgress(100);
    setIsProcessingVideo(false);
    setVideoResult(res);
    setActiveVideoSegmentIdx(0);
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // === HANDLERS FOR PHOTO TAB: PHOTO FILE / WEBCAM SNAPSHOT ANALYSIS ===
  function drawPhotoBase(imgEl, w, h) {
    const canvas = photoCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgEl, 0, 0, w, h);
    ctx.fillStyle = "rgba(10, 15, 29, 0.18)";
    ctx.fillRect(0, 0, w, h);
    return ctx;
  }

  async function analyzePhotoWithMediaPipe(imgEl, meta, source) {
    photoImgRef.current = imgEl;
    photoMetaRef.current = { ...meta, source };
    setIsAnalyzingPhoto(true);
    setPhotoResult(null);
    setPhotoStatus("⏳ Нейросеть MediaPipe Hands сканирует фото (21-точечный захват кисти)...");

    const W = 560;
    const H = 360;
    const ctx = drawPhotoBase(imgEl, W, H);

    let detections = [];

    if (window.Hands) {
      if (!photoHandsRef.current) {
        try {
          const ph = new window.Hands({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
          });
          ph.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          photoHandsRef.current = ph;
        } catch (_err) {
          photoHandsRef.current = null;
        }
      }
    }

    if (photoHandsRef.current) {
      let latestResults = null;
      photoHandsRef.current.onResults(res => {
        latestResults = res;
      });
      try {
        await photoHandsRef.current.send({ image: imgEl });
      } catch (_mpErr) {
        latestResults = null;
      }

      if (latestResults && latestResults.multiHandLandmarks && latestResults.multiHandLandmarks.length > 0) {
        const handedList = latestResults.multiHandedness || [];
        latestResults.multiHandLandmarks.forEach((lm, i) => {
          const unmirroredPts = lm.map(p => ({
            x: Number(p.x.toFixed(4)),
            y: Number(p.y.toFixed(4)),
            z: Number((p.z || 0).toFixed(4))
          }));
          const classified = classifyRealLandmarks(lm, photoModeRef.current);
          if (classified) {
            drawSkeleton21OnCanvas(ctx, W, H, unmirroredPts);
            if (i === 0) drawHudBadgeOnCanvas(ctx, W, classified);
            detections.push({
              hand_side:
                handedList[i] && handedList[i].label
                  ? String(hedList[i].label).toLowerCase()
                  : i === 0
                  ? "right"
                  : "left",
              finger_states: classified.finger_states,
              gesture_code: classified.detected_symbol,
              mode: photoModeRef.current,
              confidence: classified.confidence,
              landmarks: unmirroredPts
            });
          }
        });
      }
    }

    // HUD summary line on canvas
    if (ctx) {
      ctx.fillStyle = "rgba(9, 13, 22, 0.82)";
      ctx.fillRect(14, H - 40, W - 28, 30);
      ctx.fillStyle = detections.length > 0 ? "#34d399" : "#fda4af";
      ctx.font = "bold 12px sans-serif";
      const hudText =
        detections.length > 0
          ? `PHOTO SCAN: кистей — ${detections.length} • символ(ы): ${detections.map(d => d.gesture_code).join(" ")}`
          : "PHOTO SCAN: кисть руки не обнаружена на этом фото";
      ctx.fillText(hudText, 24, H - 21);
    }

    const res = await apiService.analyzePhoto({
      filename: meta.name,
      image_width: imgEl.naturalWidth || imgEl.width || 640,
      image_height: imgEl.naturalHeight || imgEl.height || 480,
      source,
      detected_hands: detections
    });

    setPhotoResult(res);
    setPhotoStatus(
      detections.length > 0
        ? `🟢 Анализ фото завершён • распознано жестов: ${detections.length} — ${detections.map(d => d.gesture_code).join(" ")}`
        : "🔍 Кисть руки не найдена на этом фото. Загрузите снимок, где рука с жестом хорошо видна и хорошо освещена."
    );
    setIsAnalyzingPhoto(false);
  }

  function loadPhotoFromFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setPhotoStatus("⚠️ Это не изображение. Поддерживаются JPG, PNG, WEBP и другие фото-форматы.");
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setUploadedPhotoUrl(objUrl);
    const meta = { name: file.name, sizeMb: (file.size / (1024 * 1024)).toFixed(2) + " МБ", source: "upload" };
    setPhotoFileMeta({ name: meta.name, sizeMb: meta.sizeMb });

    const img = new Image();
    img.onload = () => {
      analyzePhotoWithMediaPipe(img, meta, "upload");
      // Real server-side CV processing of the exact same file (pixels -> MediaPipe)
      handlePhotoReal(file);
    };
    img.onerror = () => {
      setPhotoStatus("⚠️ Не удалось прочитать изображение. Попробуйте другой файл.");
      setIsAnalyzingPhoto(false);
    };
    img.src = objUrl;
  }

  async function handlePhotoFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (file) loadPhotoFromFile(file);
    // allow selecting the same file again later
    e.target.value = "";
  }

  function handlePhotoDragOver(e) {
    e.preventDefault();
    setPhotoDragOver(true);
  }

  function handlePhotoDragLeave() {
    setPhotoDragOver(false);
  }

  function handlePhotoDrop(e) {
    e.preventDefault();
    setPhotoDragOver(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadPhotoFromFile(file);
  }

  async function handlePhotoWebcamSnapshot() {
    const stream = streamRef.current;
    if (!stream || stream.getVideoTracks().length === 0) {
      setPhotoStatus("⚠️ Веб-камера не активна. Откройте вкладку «Живая Веб-Камера» и включите камеру, затем снимите фото здесь.");
      return;
    }
    setPhotoStatus("📸 Снимок с веб-камеры обрабатывается...");
    try {
      const tmpVideo = document.createElement("video");
      tmpVideo.srcObject = stream;
      tmpVideo.muted = true;
      tmpVideo.playsInline = true;
      await tmpVideo.play();
      await new Promise(r => setTimeout(r, 150));

      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = tmpVideo.videoWidth || 640;
      snapCanvas.height = tmpVideo.videoHeight || 480;
      snapCanvas.getContext("2d").drawImage(tmpVideo, 0, 0, snapCanvas.width, snapCanvas.height);
      const dataUrl = snapCanvas.toDataURL("image/png");

      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const meta = { name: `webcam_snapshot_${stamp}.png`, sizeMb: "снимок камеры", source: "webcam_snapshot" };
      setPhotoFileMeta({ name: meta.name, sizeMb: meta.sizeMb });

      const img = new Image();
      img.onload = () => analyzePhotoWithMediaPipe(img, meta, "webcam_snapshot");
      img.onerror = () => {
        setPhotoStatus("⚠️ Не удалось снять кадр с камеры. Попробуйте ещё раз.");
        setIsAnalyzingPhoto(false);
      };
      img.src = dataUrl;
    } catch (_err) {
      setPhotoStatus("⚠️ Не удалось получить кадр с веб-камеры. Убедитесь, что камера включена.");
      setIsAnalyzingPhoto(false);
    }
  }

  // === HANDLERS FOR TAB 3: YOUTUBE LINK TRANSLATOR & LIVE SCREEN CAPTURE ===
  async function handleAnalyzeYouTube(customUrl) {
    const targetUrl = (customUrl !== undefined ? customUrl : youtubeUrlInput).trim();
    if (!targetUrl) return;
    stopYouTubeScreenCapture();
    setYoutubeUrlInput(targetUrl);
    setYoutubeError("");
    setYoutubeLoading(true);

    const isValidYt =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,15})/.test(targetUrl) ||
      /[?&]v=([A-Za-z0-9_-]{6,15})/.test(targetUrl);

    if (!isValidYt) {
      setYoutubeLoading(false);
      setYoutubeError("Пожалуйста, укажите корректную ссылку YouTube (например: https://www.youtube.com/watch?v=... или https://youtu.be/...)");
      return;
    }

    const res = await apiService.analyzeYouTube(targetUrl, "ru");
    setYoutubeResult(res);
    setActiveYoutubeSegIdx(0);
    setYoutubeLoading(false);
  }

  async function startYouTubeScreenCapture() {
    if (youtubeCapturingRef.current) {
      stopYouTubeScreenCapture();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setYoutubeCaptureStatus("⚠️ Браузер не поддерживает захват экрана (getDisplayMedia).");
      return;
    }
    try {
      setYoutubeCaptureStatus("⏳ Выберите вкладку браузера с воспроизведением YouTube для живого нейросетевого захвата...");
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false
      });
      youtubeStreamRef.current = displayStream;

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopYouTubeScreenCapture();
        };
      }

      if (youtubeCaptureVideoRef.current) {
        youtubeCaptureVideoRef.current.srcObject = displayStream;
        await youtubeCaptureVideoRef.current.play();
      }

      if (window.Hands && !youtubeHandsRef.current) {
        const yh = new window.Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        });
        yh.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
        yh.onResults(results => {
          if (!youtubeCapturingRef.current) return;
          const canvas = youtubeCanvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          if (results.image) {
            ctx.drawImage(results.image, 0, 0, w, h);
            ctx.fillStyle = "rgba(9, 13, 22, 0.28)";
            ctx.fillRect(0, 0, w, h);
          }

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const lm = results.multiHandLandmarks[0];
            const unmirroredPts = lm.map(p => ({
              x: Number(p.x.toFixed(4)),
              y: Number(p.y.toFixed(4)),
              z: Number((p.z || 0).toFixed(4))
            }));
            const classified = classifyRealLandmarks(lm, scanModeRef.current);
            drawSkeleton21OnCanvas(ctx, w, h, unmirroredPts);
            if (classified) {
              drawHudBadgeOnCanvas(ctx, w, classified);
              setYoutubeCaptureStatus(
                `🟢 КИСТЬ В КАДРЕ YOUTUBE • Распознан жест: «${classified.detected_symbol}» (${classified.label_ru})`
              );

              const elapsedSec = Number(((Date.now() - youtubeCaptureStartRef.current) / 1000).toFixed(1));
              if (
                classified.detected_symbol !== youtubeLastSymRef.current.sym ||
                elapsedSec - youtubeLastSymRef.current.time >= 1.5
              ) {
                youtubeLastSymRef.current = { sym: classified.detected_symbol, time: elapsedSec };
                const endSec = Number((elapsedSec + 1.5).toFixed(1));
                const minsS = Math.floor(elapsedSec / 60);
                const remS = (elapsedSec - minsS * 60).toFixed(1).padStart(4, "0");
                const minsE = Math.floor(endSec / 60);
                const remE = (endSec - minsE * 60).toFixed(1).padStart(4, "0");
                const label = `${String(minsS).padStart(2, "0")}:${remS} – ${String(minsE).padStart(2, "0")}:${remE}`;

                setYoutubeResult(prev => {
                  if (!prev) return prev;
                  const nextId = prev.detected_timeline.length + 1;
                  const newItem = {
                    id: nextId,
                    start_sec: elapsedSec,
                    end_sec: endSec,
                    timestamp_label: label,
                    symbol: classified.detected_symbol,
                    symbol_type: classified.symbol_type,
                    finger_states: classified.finger_states,
                    text_ru: classified.label_ru,
                    text_kg: classified.label_kg,
                    text_en: classified.label_en,
                    confidence: classified.confidence,
                    hand_landmarks_21: unmirroredPts
                  };
                  const nextTimeline = [...prev.detected_timeline, newItem];
                  const nextAssembled = nextTimeline.map(t => t.symbol).join(" • ");
                  const avgConf = Number(
                    (nextTimeline.reduce((acc, it) => acc + it.confidence, 0) / nextTimeline.length).toFixed(3)
                  );
                  const nextSrt = nextTimeline
                    .map(
                      t =>
                        `${t.id}\n00:00:${String(Math.floor(t.start_sec)).padStart(2, "0")},000 --> 00:00:${String(Math.floor(t.end_sec)).padStart(2, "0")},000\n[${t.symbol}] ${t.text_ru} | ${t.text_kg}`
                    )
                    .join("\n\n");
                  setActiveYoutubeSegIdx(nextTimeline.length - 1);
                  return {
                    ...prev,
                    detected_timeline: nextTimeline,
                    assembled_symbols: nextAssembled,
                    total_recognized_symbols: nextTimeline.length,
                    average_confidence: avgConf,
                    srt_export: nextSrt,
                    summary_ru: `Живой нейросетевой захват YouTube (${prev.video_id}): в реальном времени распознано жестов: ${nextTimeline.length} (${nextAssembled}).`,
                    summary_kg: `YouTube түз эфирдик таануу (${prev.video_id}): таанылган жаңсоолор: ${nextTimeline.length} (${nextAssembled}).`
                  };
                });
              }
            }
          } else {
            setYoutubeCaptureStatus("🔍 Захват YouTube активен • В кадре нет руки — ожидание жестов в видеопотоке...");
            ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
            ctx.fillRect(14, h - 42, w - 28, 30);
            ctx.fillStyle = "#38bdf8";
            ctx.font = "bold 12px sans-serif";
            ctx.fillText("🔍 MediaPipe Screen Capture: ожидание появления кисти руки в кадре YouTube...", 24, h - 22);
          }
        });
        youtubeHandsRef.current = yh;
      }

      youtubeCapturingRef.current = true;
      youtubeCaptureStartRef.current = Date.now();
      youtubeLastSymRef.current = { sym: null, time: -10 };
      setYoutubeCapturing(true);
      setYoutubeCaptureStatus("🟢 Живой нейросетевой захват окна YouTube активен (MediaPipe Hands 21-Point)...");

      const pumpYouTubeCapture = async () => {
        if (!youtubeCapturingRef.current) return;
        const vidEl = youtubeCaptureVideoRef.current;
        if (vidEl && vidEl.readyState >= 2 && youtubeHandsRef.current) {
          try {
            await youtubeHandsRef.current.send({ image: vidEl });
          } catch (_e) {
            // ignore frame error
          }
        }
        if (youtubeCapturingRef.current) {
          youtubeRafRef.current = requestAnimationFrame(pumpYouTubeCapture);
        }
      };
      youtubeRafRef.current = requestAnimationFrame(pumpYouTubeCapture);
    } catch (_err) {
      youtubeCapturingRef.current = false;
      setYoutubeCapturing(false);
      setYoutubeCaptureStatus("⚠️ Захват окна YouTube отменён пользователем.");
    }
  }

  function stopYouTubeScreenCapture() {
    youtubeCapturingRef.current = false;
    if (youtubeRafRef.current) {
      cancelAnimationFrame(youtubeRafRef.current);
      youtubeRafRef.current = null;
    }
    if (youtubeStreamRef.current) {
      youtubeStreamRef.current.getTracks().forEach(t => t.stop());
      youtubeStreamRef.current = null;
    }
    setYoutubeCapturing(false);
    setYoutubeCaptureStatus("");
  }

  function handleSelectYouTubeSegment(idx, seg) {
    setActiveYoutubeSegIdx(idx);
    if (youtubeIframeRef.current && youtubeIframeRef.current.contentWindow && seg) {
      try {
        youtubeIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "seekTo", args: [ Math.floor(seg.start_sec || 0), true ] }),
          "*"
        );
      } catch (_e) {
        // ignore cross-origin restrictions
      }
    }
  }

  // === HANDLERS FOR REAL SERVER-SIDE PROCESSING ===
  async function handleYouTubeReal() {
    const url = youtubeUrlInput || document.getElementById("youtube-url-input")?.value || "";
    if (!url.trim()) {
      setRealError("Введите ссылку YouTube");
      return;
    }
    setRealProcessing(true);
    setRealProgress(0);
    setRealError("");
    setYoutubeStatus("⏳ Реальная обработка на сервере: скачивание видео (yt-dlp), выборка кадров (OpenCV), MediaPipe Hands...");
    try {
      const data = await apiService.analyzeYouTubeReal(url.trim());
      setYoutubeResult(data);
      setYoutubeStatus(
        data.detected_timeline.length > 0
          ? `✅ Реальная обработка завершена: ${data.total_recognized_symbols} жестов распознано по реальным кадрам (MediaPipe Hands)`
          : "✅ Обработка завершена: жестов рук в видео не найдено (руки не в кадре или без дактиля)"
      );
    } catch (e) {
      setRealError(e.message || "Ошибка реальной обработки");
      setYoutubeStatus(
        "⚠️ Сервер не смог скачать видео (YouTube может требовать подтверждение). Используйте «🎥 Живой захват экрана YouTube» ниже — нейросеть распознает жесты из окна плеера."
      );
    } finally {
      setRealProcessing(false);
    }
  }

  async function handleVideoReal(file) {
    if (!file) return;
    setRealProcessing(true);
    setRealProgress(0);
    setRealError("");
    setVideoStatus(`⏳ Реальная обработка «${file.name}» на сервере: MediaPipe Hands анализирует кадры...`);
    try {
      const data = await apiService.uploadVideoReal(file, p => setRealProgress(p));
      setVideoResult(data);
      setVideoStatus(
        data.segments.length > 0
          ? `✅ Реальная обработка «${file.name}»: ${data.segments.length} сегментов жестов, ${data.total_frames_sampled} кадров проанализировано`
          : `✅ Обработка «${file.name}» завершена: жесты рук в кадрах не найдены`
      );
    } catch (e) {
      setRealError(e.message || "Ошибка реальной обработки видео");
      setVideoStatus("⚠️ Реальная серверная обработка не удалась. Используйте разметку кадров вручную ниже.");
    } finally {
      setRealProcessing(false);
    }
  }

  async function handlePhotoReal(file) {
    if (!file) return;
    setRealProcessing(true);
    setRealProgress(0);
    setRealError("");
    setPhotoStatus(`⏳ Реальная обработка «${file.name}» на сервере: MediaPipe Hands ищет кисти рук...`);
    try {
      const data = await apiService.uploadPhotoReal(file, photoMode || "auto");
      setPhotoResult(data);
      setPhotoStatus(
        data.hands_detected > 0
          ? `✅ Реальная обработка «${file.name}»: распознано ${data.hands_detected} кистей — ${data.translation_ru}`
          : `✅ Обработка «${file.name}» завершена: кисти рук на фото не найдены`
      );
    } catch (e) {
      setRealError(e.message || "Ошибка реальной обработки фото");
      setPhotoStatus("⚠️ Серверная обработка не удалась. Используйте браузерный MediaPipe анализ ниже.");
    } finally {
      setRealProcessing(false);
    }
  }

  return (
    <div className="app-container">
      {/* Compact Modern Startup Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">🤟</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 className="brand-title">ImoTech • ЫмТили</h1>
              <span className="badge badge-live">
                <span className="badge-pulse"></span>
                MediaPipe Hands 21-Point Live AI
              </span>
              <span className="badge badge-teal">
                Буквы (А–Я, Ө, Ү, Ң) + Цифры (0–9)
              </span>
            </div>
            <p className="brand-subtitle">
              Живой нейросетевой сурдопереводчик жестов через веб-камеру в реальном времени, покадровый разбор видео (.MP4) и перевод из YouTube
            </p>
          </div>
        </div>

        <div className="header-stats">
          <button
            className={`btn ${webcamActive ? "btn-rose" : "btn-camera-cta"}`}
            onClick={() => {
              setActiveTab("scanner");
              toggleWebcam();
            }}
          >
            {webcamActive
              ? "⏹️ Остановить веб-камеру"
              : "🎥 Включить веб-камеру (Живое распознавание руки)"}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === "scanner" ? "active" : ""}`}
          onClick={() => setActiveTab("scanner")}
        >
          📷 Живая Веб-Камера ➔ Буквы (А–Я) и Цифры (0–9)
        </button>
        <button
          className={`tab-btn ${activeTab === "video" ? "active" : ""}`}
          onClick={() => setActiveTab("video")}
        >
          🎬 Обработка видеофайла (.MP4 / Кадры)
        </button>
        <button
          className={`tab-btn ${activeTab === "photo" ? "active" : ""}`}
          onClick={() => setActiveTab("photo")}
        >
          🖼️ Обработка фото (JPG / PNG)
        </button>
        <button
          className={`tab-btn ${activeTab === "youtube" ? "active" : ""}`}
          onClick={() => setActiveTab("youtube")}
        >
          ▶️ Перевод из YouTube по ссылке
        </button>
      </nav>

      {/* =====================================================================
          TAB 1: LIVE WEBCAM GESTURE SCANNER -> LETTERS & DIGITS
         ===================================================================== */}
      {activeTab === "scanner" && (
        <div>
          <div className="grid-2col" style={{ marginBottom: "22px" }}>
            {/* Left Column: Live Camera & Hand Skeleton Viewport */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">
                    📹 Веб-камера & 21-точечный скелет руки
                    {webcamActive && (
                      <span className={`badge ${handDetectedLive ? "badge-live" : "badge-teal"}`} style={{ fontSize: "11px" }}>
                        {handDetectedLive ? "🖐️ РУКА В КАДРЕ (60 FPS)" : "🔍 ПОИСК РУКИ..."}
                      </span>
                    )}
                  </h2>
                  <div style={{ fontSize: "12.5px", color: handDetectedLive ? "#34d399" : "var(--text-secondary)", marginTop: "3px", fontWeight: handDetectedLive ? "700" : "500" }}>
                    {webcamStatus}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-outline"
                    style={{ padding: "8px 13px", fontSize: "12.5px" }}
                    onClick={runLiveDemoSequence}
                    disabled={isAutoDemoRunning}
                  >
                    {isAutoDemoRunning ? "⏳ Набор ОШ-2027..." : "✨ Авто-демо «ОШ2027»"}
                  </button>
                </div>
              </div>

              {/* Prominent Mode Selector Bar */}
              <div className="mode-pill-bar">
                {[
                  { id: "auto", label: "⚡ Авто (Буквы + Цифры)" },
                  { id: "digits", label: "🔢 Только Цифры (0–9)" },
                  { id: "letters", label: "🔤 Только Буквы (А–Я, Ө, Ү, Ң)" },
                  { id: "words", label: "💬 Фразы (САЛАМ, ПАСПОРТ)" }
                ].map(m => (
                  <button
                    key={m.id}
                    className={`mode-pill ${scanMode === m.id ? "active" : ""}`}
                    onClick={() => {
                      setScanMode(m.id);
                      if (!webcamActive) {
                        triggerClassify(fingerStates, m.id, null, wristAngle, false);
                      }
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Camera Device Selector (built-in webcam preferred, phone/virtual cameras skipped) */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", margin: "10px 0 2px 0" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0" }}>📷 Камера:</span>
                <select
                  className="input-text"
                  style={{ flex: 1, minWidth: "200px", maxWidth: "340px", padding: "7px 10px", fontSize: "12.5px", cursor: "pointer" }}
                  value={selectedCameraId}
                  onChange={e => switchCamera(e.target.value)}
                >
                  <option value="">⚡ Авто — встроенная камера ноутбука (телефон/виртуальные пропускаются)</option>
                  {cameraDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {scoreCameraLabel(d.label) < 0 ? "📱" : "💻"} {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Viewport + 1-Click Center Launch Overlay when camera is off */}
              <div className="viewport-box" style={{ height: "390px", position: "relative" }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ display: "none" }}
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={390}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />

                <div className="hud-overlay">
                  <span className="hud-tag">
                    {webcamActive ? "🟢 LIVE MediaPipe Hands (21 точка)" : "🖐️ Интерактивный 21-Point скелет"}
                  </span>
                  <span className="hud-tag">
                    Пальцы: [{fingerStates.join(", ")}]
                  </span>
                  <span className="hud-tag" style={{ color: "#34d399", borderLeftColor: "#10b981" }}>
                    Режим: {scanMode === "digits" ? "ЦИФРЫ 0–9" : scanMode === "letters" ? "БУКВЫ А–Я" : scanMode === "words" ? "ФРАЗЫ КЖЯ" : "АВТО (БУКВЫ+ЦИФРЫ)"}
                  </span>
                </div>

                {/* Unmistakable 1-click Webcam Activation Button floating at bottom of viewport when camera is OFF */}
                {!webcamActive && (
                  <div className="camera-launch-banner">
                    <button className="btn btn-camera-cta-large" onClick={toggleWebcam}>
                      📷 ВКЛЮЧИТЬ ВЕБ-КАМЕРУ (РАСПОЗНАВАНИЕ ЖЕСТОВ В РЕАЛЬНОМ ВРЕМЕНИ)
                    </button>
                  </div>
                )}
              </div>

              {/* Real-Time 5-Finger Indicators (lights up live from webcam OR manual click) */}
              <div className="finger-controller-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#e2e8f0" }}>
                    {webcamActive
                      ? "🖐️ Живые индикаторы 5 пальцев (сгибайте пальцы перед камерой):"
                      : "🖐️ Индикаторы и ручной тест 5 пальцев (кликните на палец или включите камеру):"}
                  </span>
                  {!webcamActive && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                      <span>Наклон кисти: <b>{wristAngle}°</b></span>
                      <input
                        type="range"
                        min="-35"
                        max="35"
                        value={wristAngle}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setWristAngle(val);
                          triggerClassify(fingerStates, scanMode, null, val, false);
                        }}
                        style={{ width: "85px", accentColor: "#06b6d4" }}
                      />
                    </div>
                  )}
                </div>

                <div className="finger-toggles-grid">
                  {FINGER_NAMES.map(f => {
                    const isUp = fingerStates[f.idx] === 1;
                    return (
                      <button
                        key={f.idx}
                        className={`finger-toggle-btn ${isUp ? "up" : "down"}`}
                        style={{ borderColor: isUp ? f.color : "rgba(255,255,255,0.12)" }}
                        onClick={() => handleToggleFinger(f.idx)}
                      >
                        <span className="finger-state-indicator" style={{ background: isUp ? f.color : "#475569" }}>
                          {isUp ? "1 • Прямой" : "0 • Согнут"}
                        </span>
                        <span className="finger-name-ru">{f.ru}</span>
                        <span className="finger-name-kg">{f.kg}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Giant Detected Symbol Display + Hold Timer + Assembled Text + Quick Catalog */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="card-header">
                  <h2 className="card-title">🎯 Распознанный символ (Буква / Цифра)</h2>
                  <span className="badge badge-live">
                    Точность: {Math.round((classifiedGesture.confidence || 0.97) * 100)}%
                  </span>
                </div>

                {/* Big Recognized Symbol Readout */}
                <div className={`recognized-readout-box ${dwellAddedFlash ? "flash-added" : ""}`}>
                  <div className="recognized-symbol-badge">
                    <span className="symbol-type-pill">
                      {classifiedGesture.symbol_type === "digit"
                        ? "🔢 ЦИФРА"
                        : classifiedGesture.symbol_type === "letter"
                        ? "🔤 БУКВА"
                        : "💬 ФРАЗА"}
                    </span>
                    <div className="symbol-giant-text">{classifiedGesture.detected_symbol}</div>
                  </div>

                  <div className="recognized-details">
                    <div className="recognized-label-ru">{classifiedGesture.label_ru}</div>
                    <div className="recognized-label-kg">🇰🇬 {classifiedGesture.label_kg} • 🌐 {classifiedGesture.label_en}</div>
                    <div className="recognized-rule">
                      <b>Геометрия 21 точки:</b> {classifiedGesture.anatomical_rule}
                    </div>
                  </div>
                </div>

                {/* Hold-to-Append Dwell Progress Bar (for live webcam) */}
                <div className="dwell-bar-container">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                    <span style={{ fontWeight: "700", color: dwellAddedFlash ? "#34d399" : "#cbd5e1" }}>
                      {dwellAddedFlash
                        ? `✅ Символ «${classifiedGesture.detected_symbol}» автоматически добавлен в строку!`
                        : "⏱️ Удержание жеста перед камерой (1.2 сек) ➔ Авто-ввод в строку:"}
                    </span>
                    <b style={{ color: "#34d399" }}>{dwellProgress}%</b>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${dwellProgress}%`,
                        background: dwellAddedFlash
                          ? "#10b981"
                          : "linear-gradient(90deg, #06b6d4, #10b981)"
                      }}
                    />
                  </div>
                </div>

                {/* Live Word & Number Builder */}
                <div className="word-builder-box">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#38bdf8" }}>
                      ✍️ Собранный текст и числа:
                    </span>
                    <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "var(--text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={autoAppend}
                        onChange={e => setAutoAppend(e.target.checked)}
                      />
                      Авто-ввод при удержании жеста (1.2 сек) / клике
                    </label>
                  </div>

                  <div className="assembled-string-display">
                    {assembledText || <span style={{ opacity: 0.45 }}>Покажите жест в камеру или нажмите на букву/цифру ниже...</span>}
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                    <button
                      className="btn btn-teal"
                      style={{ padding: "7px 13px", fontSize: "12px" }}
                      onClick={() => {
                        const sym = classifiedGesture.detected_symbol;
                        setAssembledText(prev => (sym.length > 1 ? `${prev.trimEnd()} ${sym} ` : `${prev}${sym}`));
                      }}
                    >
                      ➕ Добавить «{classifiedGesture.detected_symbol}»
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "7px 12px", fontSize: "12px" }}
                      onClick={() => setAssembledText(prev => prev + " ")}
                    >
                      ␣ Пробел
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "7px 12px", fontSize: "12px" }}
                      onClick={() => setAssembledText(prev => prev.slice(0, -1))}
                    >
                      ⌫ Стереть
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "7px 12px", fontSize: "12px" }}
                      onClick={() => setAssembledText("")}
                    >
                      🗑️ Очистить
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "7px 12px", fontSize: "12px" }}
                      onClick={handleCopyAssembled}
                    >
                      📋 {copyNotice || "Копировать"}
                    </button>
                  </div>
                </div>

                {/* Interactive Dictionary Matrix: Digits 0-9, Letters A-YA, Words */}
                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700" }}>
                      📚 Каталог жестов (кликните для проверки или покажите жест в камеру):
                    </span>
                    <div className="mini-tab-group">
                      <button
                        className={`mini-tab ${catalogTab === "digits" ? "active" : ""}`}
                        onClick={() => setCatalogTab("digits")}
                      >
                        🔢 Цифры 0–9 (10)
                      </button>
                      <button
                        className={`mini-tab ${catalogTab === "letters" ? "active" : ""}`}
                        onClick={() => setCatalogTab("letters")}
                      >
                        🔤 Буквы А–Я, Ө, Ү, Ң ({mockLettersCatalog.length})
                      </button>
                      <button
                        className={`mini-tab ${catalogTab === "words" ? "active" : ""}`}
                        onClick={() => setCatalogTab("words")}
                      >
                        💬 Фразы ({mockSigns.length})
                      </button>
                    </div>
                  </div>

                  {catalogTab === "digits" && (
                    <div className="gesture-matrix-grid digits-grid">
                      {mockDigitsCatalog.map(d => (
                        <button
                          key={d.symbol}
                          className={`gesture-chip ${classifiedGesture.detected_symbol === d.symbol ? "active" : ""}`}
                          onClick={() => handleSelectCatalogItem(d)}
                          title={d.rule}
                        >
                          <span className="chip-sym">{d.symbol}</span>
                          <span className="chip-fingers">[{d.fingers.join("")}]</span>
                          <span className="chip-sub">{d.label_kg.replace("Сан ", "")}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {catalogTab === "letters" && (
                    <div className="gesture-matrix-grid letters-grid">
                      {mockLettersCatalog.map(l => (
                        <button
                          key={l.symbol}
                          className={`gesture-chip ${classifiedGesture.detected_symbol === l.symbol ? "active" : ""}`}
                          onClick={() => handleSelectCatalogItem(l)}
                          title={l.rule}
                        >
                          <span className="chip-sym">{l.symbol}</span>
                          <span className="chip-fingers">[{l.fingers.join("")}]</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {catalogTab === "words" && (
                    <div className="gesture-matrix-grid words-grid">
                      {mockSigns.map(s => (
                        <button
                          key={s.id}
                          className={`gesture-chip word-chip ${classifiedGesture.detected_symbol === s.gloss_ky ? "active" : ""}`}
                          onClick={() =>
                            handleSelectCatalogItem({
                              symbol: s.gloss_ky,
                              symbol_type: "word",
                              fingers: s.fingers || [1, 1, 1, 1, 1]
                            })
                          }
                        >
                          <span className="chip-sym" style={{ fontSize: "15px" }}>{s.gloss_ky}</span>
                          <span className="chip-sub">{s.gloss_ru}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Visual Cheat-Sheet Cards for Live Webcam Gestures */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: "12px" }}>
              <div>
                <h3 className="card-title">🖐️ Памятка жестов для живой веб-камеры (что показать перед камерой)</h3>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Покажите любой из этих жестов перед включённой камерой — MediaPipe Hands мгновенно распознает цифру или букву:
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className={`btn ${scanMode === "digits" ? "btn-teal" : "btn-outline"}`}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => setScanMode("digits")}
                >
                  🔢 Режим Цифр (0–9)
                </button>
                <button
                  className={`btn ${scanMode === "letters" ? "btn-teal" : "btn-outline"}`}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => setScanMode("letters")}
                >
                  🔤 Режим Букв (А–Я)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "10px", fontSize: "12.5px", fontWeight: "700", color: "#38bdf8" }}>
              🔢 Жестовый счёт цифр (0–9):
            </div>
            <div className="cheatsheet-grid" style={{ marginBottom: "16px" }}>
              {WEBCAM_CHEAT_DIGITS.map(c => (
                <div key={c.sym} className="cheatsheet-card">
                  <div className="cheatsheet-sym">{c.sym}</div>
                  <div>
                    <div className="cheatsheet-pose">{c.pose}</div>
                    <div className="cheatsheet-hint">{c.hint}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "10px", fontSize: "12.5px", fontWeight: "700", color: "#a5b4fc" }}>
              🔤 Дактильные буквы (А–Я, включая кыргызские Ө, Ү, Ң):
            </div>
            <div className="cheatsheet-grid">
              {WEBCAM_CHEAT_LETTERS.map(c => (
                <div key={c.sym} className="cheatsheet-card">
                  <div className="cheatsheet-sym" style={{ color: "#a855f7" }}>{c.sym}</div>
                  <div>
                    <div className="cheatsheet-pose">{c.pose}</div>
                    <div className="cheatsheet-hint">{c.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: VIDEO FILE PROCESSING (.MP4 / .WEBM / FRAME-BY-FRAME)
         ===================================================================== */}
      {activeTab === "video" && (
        <div className="grid-2col">
          {/* Left Column: File Upload Dropzone + Presets + Frame Analyzer Canvas */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🎬 Загрузка и покадровая обработка видеофайла</h2>
              <span className="badge badge-teal">MediaPipe Video Scanner</span>
            </div>

            {/* File Upload Box */}
            <label className="video-upload-dropzone">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                style={{ display: "none" }}
                onChange={handleVideoFileUpload}
              />
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>📂</div>
              <div style={{ fontWeight: "700", fontSize: "15px", color: "#f8fafc" }}>
                Нажмите, чтобы загрузить своё видео (.MP4, .WEBM, .MOV) с жестами руки
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {uploadedFileMeta.name
                  ? <>Активный файл: <b style={{ color: "#38bdf8" }}>{uploadedFileMeta.name}</b> ({uploadedFileMeta.sizeMb})</>
                  : "Файл не выбран — загрузите своё видео с реальным жестом руки"}
              </div>
            </label>

            {/* Real Uploaded Video Player with live MediaPipe hook */}
            {(realProcessing || videoStatus) && (
              <div style={{ marginTop: "12px" }}>
                {realProcessing && (
                  <div className="progress-track" style={{ marginBottom: "8px" }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: realProgress > 0 ? `${realProgress}%` : "100%",
                        opacity: realProgress > 0 ? 1 : 0.5,
                        background: "linear-gradient(90deg, #f59e0b, #06b6d4)",
                        animation: realProgress > 0 ? "none" : "imotech-pulse 1.2s ease-in-out infinite"
                      }}
                    />
                  </div>
                )}
                <div style={{ fontSize: "12.5px", fontWeight: "600", color: videoStatus.startsWith("✅") ? "#34d399" : videoStatus.startsWith("⚠️") ? "#fda4af" : "#38bdf8" }}>
                  {videoStatus}
                </div>
                {realError && (
                  <div style={{ color: "#fda4af", fontSize: "12.5px", marginTop: "6px" }}>⚠️ {realError}</div>
                )}
              </div>
            )}

            {uploadedVideoUrl && (
              <div style={{ marginTop: "14px", marginBottom: "14px", background: "rgba(0,0,0,0.35)", padding: "12px", borderRadius: "12px", border: "1px solid rgba(56,189,248,0.35)" }}>
                <div style={{ fontSize: "12px", color: "#34d399", fontWeight: "700", marginBottom: "6px" }}>
                  ▶️ Нажмите Play — нейросеть MediaPipe Hands в реальном времени отсканирует кадры вашего видео:
                </div>
                <video
                  ref={uploadVideoElRef}
                  src={uploadedVideoUrl}
                  controls
                  onPlay={handleUploadedVideoPlay}
                  style={{ width: "100%", maxHeight: "240px", borderRadius: "10px", background: "#000" }}
                />
              </div>
            )}

            {/* Progress Bar */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                <span>
                  {isProcessingVideo
                    ? "⏳ Извлечение кадров и 21-точечного скелета..."
                    : liveVideoScanning
                    ? "🟢 Живое сканирование кадров видео через MediaPipe..."
                    : uploadedFileMeta.name
                    ? "✅ Покадровая расшифровка готова"
                    : "Загрузите видео, чтобы начать покадровую расшифровку"}
                </span>
                <b>{videoProgress}%</b>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${videoProgress}%` }}></div>
              </div>
            </div>

            <div className="viewport-box" style={{ height: "235px" }}>
              <canvas
                ref={videoCanvasRef}
                width={560}
                height={235}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>

          {/* Right Column: Recognized Video Timeline + Assembled String + SRT Download */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📋 Таймлайн распознанных букв, цифр и фраз</h2>
              {videoResult && (
                <span className="badge badge-live">
                  Сегментов: {videoResult.segments.length} • Точность {Math.round(videoResult.average_confidence * 100)}%
                </span>
              )}
            </div>

            {videoResult && (
              <>
                <div className="word-builder-box" style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", marginBottom: "4px" }}>
                    Расшифрованная последовательность символов из видео:
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", letterSpacing: "1px", color: videoResult.segments.length > 0 ? "#34d399" : "#fda4af", marginBottom: "6px" }}>
                    {videoResult.assembled_string || "0 жестов обнаружено"}
                  </div>
                  <div style={{ fontSize: "13px", color: videoResult.segments.length > 0 ? "#f8fafc" : "#fda4af", fontWeight: "600" }}>
                    🇷🇺 {videoResult.translation_ru}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    🇰🇬 {videoResult.translation_kg}
                  </div>

                  {videoResult.segments.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                      <button
                        className="btn btn-teal"
                        style={{ padding: "7px 14px", fontSize: "12px" }}
                        onClick={() => downloadTextFile(`${videoResult.filename}.srt`, videoResult.srt_subtitles)}
                      >
                        💾 Скачать субтитры (.SRT)
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "7px 14px", fontSize: "12px" }}
                        onClick={() =>
                          downloadTextFile(
                            `${videoResult.filename}_transcript.txt`,
                            `${videoResult.translation_ru}\n${videoResult.translation_kg}\n\n${videoResult.srt_subtitles}`
                          )
                        }
                      >
                        📄 Скачать полный отчёт (.TXT)
                      </button>
                    </div>
                  )}
                </div>

                {videoResult.segments.length === 0 ? (
                  <div
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      background: "rgba(244, 63, 94, 0.12)",
                      border: "1px solid rgba(244, 63, 94, 0.45)",
                      color: "#fda4af",
                      fontSize: "13.5px",
                      lineHeight: "1.5"
                    }}
                  >
                    <strong>⚠️ В загруженном видео кисти рук не обнаружены (распознано 0 жестов).</strong>
                    <div style={{ marginTop: "6px", color: "#e2e8f0", fontSize: "12.5px" }}>
                      Загрузите видео с жестами руки перед камерой или нажмите <b>Play</b> в видеоплеере слева для живого сканирования через <code>MediaPipe Hands</code>. Система никогда не генерирует фальшивые жесты из имени файла.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      Нажмите на любой таймкод, чтобы просмотреть 21-точечный скелет кисти на этом кадре:
                    </div>

                    <div className="timeline-list">
                      {videoResult.segments.map((seg, idx) => (
                        <div
                          key={seg.segment_id}
                          className={`timeline-item ${activeVideoSegmentIdx === idx ? "active" : ""}`}
                          onClick={() => setActiveVideoSegmentIdx(idx)}
                        >
                          <div className="timeline-symbol-box">
                            <span className="timeline-sym">{seg.symbol}</span>
                            <span className="timeline-type">
                              {seg.symbol_type === "digit" ? "Цифра" : seg.symbol_type === "letter" ? "Буква" : "Жест"}
                            </span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span className="timeline-timecode">⏱️ {seg.timecode}</span>
                              <span className="timeline-conf">{Math.round(seg.confidence * 100)}% • [{seg.finger_states.join(",")}]</span>
                            </div>
                            <div style={{ fontWeight: "700", fontSize: "14px", marginTop: "3px" }}>{seg.word_ru}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>🇰🇬 {seg.word_kg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {!videoResult && (
              <div style={{ padding: "18px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.08)", border: "1px dashed rgba(56, 189, 248, 0.45)", fontSize: "13px", color: "var(--text-secondary)" }}>
                📥 Таймлайн пуст — загрузите свой видеофайл слева. Сервер (OpenCV + MediaPipe Hands) отсканирует реальные кадры и покажет здесь только действительно распознанные жесты. Фейковые пресеты удалены.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2b: PHOTO PROCESSING — JEGE / PNG ANALYSIS WITH MEDIAPIPE HANDS
         ===================================================================== */}
      {activeTab === "photo" && (
        <div className="grid-2col">
          {/* Left Column: Photo Upload / Snapshot + Analyzer Canvas */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🖼️ Обработка фото с жестом руки</h2>
              <span className="badge badge-teal">MediaPipe Photo Scanner</span>
            </div>

            {/* File Upload + Drag & Drop Zone */}
            <div
              className="video-upload-dropzone"
              style={photoDragOver ? { borderColor: "#34d399", background: "rgba(52, 211, 153, 0.08)" } : undefined}
              onDragOver={handlePhotoDragOver}
              onDragLeave={handlePhotoDragLeave}
              onDrop={handlePhotoDrop}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>🖼️</div>
              <div style={{ fontWeight: "700", fontSize: "15px", color: "#f8fafc" }}>
                Перетащите фото сюда или нажмите, чтобы выбрать файл (JPG, PNG, WEBP)
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Активный файл: <b style={{ color: "#38bdf8" }}>{photoFileMeta.name}</b> ({photoFileMeta.sizeMb})
              </div>
              <label style={{ display: "inline-block", marginTop: "10px", cursor: "pointer" }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoFileUpload}
                />
                <span className="btn btn-teal" style={{ padding: "8px 16px", fontSize: "13px" }}>
                  📂 Выбрать фото
                </span>              </label>
            </div>

            {/* Real server processing status / errors */}
            {(realProcessing || realError) && (
              <div style={{ marginTop: "10px" }}>
                {realProcessing && (
                  <div className="progress-track" style={{ marginBottom: "8px" }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: realProgress > 0 ? `${realProgress}%` : "100%",
                        opacity: realProgress > 0 ? 1 : 0.5,
                        background: "linear-gradient(90deg, #f59e0b, #06b6d4)",
                        animation: realProgress > 0 ? "none" : "imotech-pulse 1.2s ease-in-out infinite"
                      }}
                    />
                  </div>
                )}
                {realError && (
                  <div style={{ color: "#fda4af", background: "rgba(244,63,94,0.14)", border: "1px solid #f43f5e", padding: "8px 12px", borderRadius: "10px", fontSize: "12.5px" }}>
                    ⚠️ {realError}
                  </div>
                )}
              </div>
            )}

            {/* Webcam snapshot */}
            <div style={{ marginTop: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)" }}>
                  Режим распознавания фото:
                </span>
                {[
                  { id: "auto", label: "🤖 Авто (буквы+цифры)" },
                  { id: "digits", label: "🔢 Цифры (0–9)" },
                  { id: "letters", label: "🔤 Буквы (А–Я, Ө, Ү, Ң)" },
                  { id: "words", label: "🗣️ Фразы (КЖЯ)" }
                ].map(m => (
                  <button
                    key={m.id}
                    className={`mode-pill ${photoMode === m.id ? "active" : ""}`}
                    onClick={() => setPhotoMode(m.id)}
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-camera-cta"
                style={{ padding: "9px 16px", fontSize: "13px" }}
                onClick={handlePhotoWebcamSnapshot}
              >
                📸 Снять фото с веб-камеры и проанализировать
              </button>
              <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "6px" }}>
                Снимок делается с активной веб-камеры (вкладка «Живая Веб-Камера»). Режим — только для вкладки фото, не влияет на сканер: {photoMode === "auto" ? "Авто" : photoMode === "digits" ? "Цифры (0–9)" : photoMode === "letters" ? "Буквы (А–Я, Ө, Ү, Ң)" : "Слова (КЖЯ)"}.
              </div>
            </div>

            {/* Analyzer canvas */}
            <div className="viewport-box" style={{ height: "360px" }}>
              <canvas
                ref={photoCanvasRef}
                width={560}
                height={360}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>

            <div style={{ marginTop: "10px", fontSize: "12.5px", fontWeight: isAnalyzingPhoto ? "700" : "500", color: isAnalyzingPhoto ? "#38bdf8" : photoStatus.startsWith("🟢") ? "#34d399" : "var(--text-secondary)" }}>
              {photoStatus}
            </div>
          </div>

          {/* Right Column: Photo Analysis Result */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📋 Результат анализа фото</h2>
              {photoResult && (
                <span className="badge badge-live">
                  Кистей: {photoResult.hands_detected} • Режим: {photoResult.scan_mode === "auto" ? "Авто" : photoResult.scan_mode === "digits" ? "Цифры" : photoResult.scan_mode === "letters" ? "Буквы" : "Слова"}
                </span>
              )}
            </div>

            {!photoResult ? (
              <div
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  background: "rgba(56, 189, 248, 0.08)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  color: "#bae6fd",
                  fontSize: "13.5px",
                  lineHeight: "1.55"
                }}
              >
                <strong>🖼️ Как это работает:</strong>
                <div style={{ marginTop: "6px", color: "#e2e8f0", fontSize: "12.5px" }}>
                  1. Загрузите фото с жестом руки или снимите кадр с веб-камеры.<br />
                  2. Нейросеть <code>MediaPipe Hands</code> найдёт 21 ключевую точку кисти и определит изгиб каждого пальца.<br />
                  3. Геометрический классификатор переведёт жест в цифру (0–9), букву дактиля (А–Я, Ө, Ү, Ң) или слово КЖЯ.<br />
                  4. Готовый отчёт можно скачать кнопкой ниже.
                </div>
              </div>
            ) : (
              <>
                <div className="word-builder-box" style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", marginBottom: "4px" }}>
                    Распознанный символ(ы) на фото:
                  </div>
                  <div style={{ fontSize: "30px", fontWeight: "800", letterSpacing: "2px", color: photoResult.hands_detected > 0 ? "#34d399" : "#fda4af", marginBottom: "6px" }}>
                    {photoResult.results.map(r => r.detected_symbol).join(" ") || "—"}
                  </div>
                  <div style={{ fontSize: "13px", color: photoResult.hands_detected > 0 ? "#f8fafc" : "#fda4af", fontWeight: "600" }}>
                    🇷🇺 {photoResult.translation_ru}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    🇰🇬 {photoResult.translation_kg}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    🇬🇧 {photoResult.translation_en}
                  </div>

                  {photoResult.hands_detected > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <button
                        className="btn btn-teal"
                        style={{ padding: "7px 14px", fontSize: "12px" }}
                        onClick={() => downloadTextFile(`${photoResult.filename}_photo_report.txt`, photoResult.report_txt)}
                      >
                        💾 Скачать отчёт анализа фото (.TXT)
                      </button>
                    </div>
                  )}
                </div>

                {photoResult.results.map((r, idx) => (
                  <div
                    key={idx}
                    className="timeline-item"
                    style={{ marginBottom: "10px", cursor: "default" }}
                  >
                    <div className="timeline-symbol-box">
                      <span className="timeline-sym">{r.detected_symbol}</span>
                      <span className="timeline-type">
                        {r.symbol_type === "digit" ? "Цифра" : r.symbol_type === "letter" ? "Буква" : "Жест"}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="timeline-timecode">✋ Рука: {r.hand_side.toUpperCase()}</span>
                        <span className="timeline-conf">{Math.round(r.confidence * 100)}% • [{r.finger_states.join(",")}]</span>
                      </div>
                      <div style={{ fontWeight: "700", fontSize: "14px", marginTop: "3px" }}>{r.label_ru}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>🇰🇬 {r.label_kg}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "3px" }}>📐 {r.anatomical_rule}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: YOUTUBE VIDEO LINK SIGN LANGUAGE TRANSLATOR
         ===================================================================== */}
      {activeTab === "youtube" && (
        <div>
          {/* YouTube URL Input Card */}
          <div className="card" style={{ marginBottom: "22px" }}>
            <div className="card-header">
              <h2 className="card-title">▶️ Перевод и распознавание жестов по ссылке из YouTube</h2>
              <span className="badge badge-live">YouTube Stream + 21-Point Таймлайн</span>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
              <input
                type="text"
                className="input-text"
                style={{ flex: 1, minWidth: "280px" }}
                placeholder="Вставьте любую ссылку YouTube (например: https://www.youtube.com/watch?v=... или https://youtu.be/...)"
                value={youtubeUrlInput}
                onChange={e => setYoutubeUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyzeYouTube()}
              />
              <button
                className="btn btn-teal"
                onClick={() => handleAnalyzeYouTube()}
                disabled={youtubeLoading || realProcessing}
              >
                {youtubeLoading ? "⏳ Анализ потока..." : "🔍 Перевести видео с YouTube"}
              </button>
              <button
                className="btn btn-camera-cta"
                onClick={handleYouTubeReal}
                disabled={youtubeLoading || realProcessing}
                title="Сервер скачивает видео (yt-dlp ≤480p), OpenCV выбирает кадры, MediaPipe Hands распознаёт жесты по реальным пикселям"
              >
                {realProcessing ? "⏳ Реальная обработка..." : "🤖 Реальная обработка на сервере (yt-dlp + MediaPipe)"}
              </button>
            </div>

            {(realProcessing || realError) && (
              <div style={{ marginBottom: "12px" }}>
                {realProcessing && (
                  <div className="progress-track" style={{ marginBottom: "8px" }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: realProgress > 0 ? `${realProgress}%` : "100%",
                        opacity: realProgress > 0 ? 1 : 0.5,
                        background: "linear-gradient(90deg, #f59e0b, #06b6d4)",
                        animation: realProgress > 0 ? "none" : "imotech-pulse 1.2s ease-in-out infinite"
                      }}
                    />
                  </div>
                )}
                {realError && (
                  <div style={{ color: "#fda4af", background: "rgba(244,63,94,0.14)", border: "1px solid #f43f5e", padding: "10px 14px", borderRadius: "10px", fontSize: "13px" }}>
                    ⚠️ {realError}
                  </div>
                )}
              </div>
            )}

            {youtubeStatus && (
              <div style={{ fontSize: "12.5px", fontWeight: "600", color: youtubeStatus.startsWith("✅") ? "#34d399" : youtubeStatus.startsWith("⚠️") ? "#fda4af" : "#38bdf8", marginBottom: "12px" }}>
                {youtubeStatus}
              </div>
            )}

            {youtubeError && (
              <div style={{ color: "#fda4af", background: "rgba(244,63,94,0.14)", border: "1px solid #f43f5e", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "12px" }}>
                ⚠️ {youtubeError}
              </div>
            )}

            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              🤖 Сервер скачивает видео по ссылке (yt-dlp ≤480p), OpenCV выбирает кадры, MediaPipe Hands распознаёт жесты по реальным пикселям. Если YouTube блокирует доступ — используйте «🎥 Живой захват экрана» в плеере ниже.
            </div>
          </div>

          {youtubeResult && (
            <div className="grid-2col">
              {/* Left Column: Responsive Embedded YouTube Player + 21-Point Skeleton Visualizer + Summary */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <h3 className="card-title">{youtubeResult.title}</h3>
                      <span className={`badge ${youtubeResult.verified_corpus ? "badge-live" : "badge-teal"}`} style={{ fontSize: "11px" }}>
                        {youtubeResult.verified_corpus
                          ? "✅ Эталонный размеченный корпус КЖЯ/РЖЯ"
                          : "⚡ Пользовательское видео • Живой захват MediaPipe"}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Канал: {youtubeResult.channel} • ID: <code>{youtubeResult.video_id}</code>
                    </div>
                  </div>
                  <a
                    href={`https://www.youtube.com/watch?v=${youtubeResult.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                    style={{ padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
                  >
                    ↗ Открыть на YouTube
                  </a>
                </div>

                {/* Embedded YouTube Iframe with JS API enabled */}
                <div className="youtube-embed-wrapper">
                  <iframe
                    ref={youtubeIframeRef}
                    title={`YouTube Sign Translator ${youtubeResult.video_id}`}
                    src={`https://www.youtube.com/embed/${youtubeResult.video_id}?enablejsapi=1&rel=0`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", borderRadius: "12px" }}
                  />
                </div>

                {/* Hidden video element for getDisplayMedia live screen capture */}
                <video
                  ref={youtubeCaptureVideoRef}
                  muted
                  playsInline
                  style={{ display: "none" }}
                />

                {/* Live Neural Screen Capture CTA for ANY YouTube Video */}
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    background: youtubeCapturing ? "rgba(16, 185, 129, 0.14)" : "rgba(56, 189, 248, 0.10)",
                    border: youtubeCapturing ? "1px solid #10b981" : "1px solid rgba(56, 189, 248, 0.45)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <button
                      className={`btn ${youtubeCapturing ? "btn-rose" : "btn-camera-cta"}`}
                      style={{ width: "100%", justifyContent: "center", fontWeight: "700" }}
                      onClick={startYouTubeScreenCapture}
                    >
                      {youtubeCapturing
                        ? "⏹️ Остановить живой нейросетевой захват окна YouTube"
                        : "🎥 Запустить живой нейросетевой захват окна YouTube (MediaPipe Hands Screen Capture)"}
                    </button>
                  </div>
                  {youtubeCaptureStatus && (
                    <div style={{ fontSize: "12px", color: "#34d399", fontWeight: "600", marginTop: "8px" }}>
                      {youtubeCaptureStatus}
                    </div>
                  )}
                </div>

                {/* Synchronized 21-Point Hand Skeleton for selected YouTube timestamp */}
                <div style={{ marginTop: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#38bdf8", marginBottom: "6px" }}>
                    🖐️ 21-точечный скелет жеста на выбранном таймкоде / в живом захвате YouTube:
                  </div>
                  <div className="viewport-box" style={{ height: "185px" }}>
                    <canvas
                      ref={youtubeCanvasRef}
                      width={540}
                      height={185}
                      style={{ width: "100%", height: "100%", display: "block" }}
                    />
                  </div>
                </div>

                <div className="word-builder-box" style={{ marginTop: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", marginBottom: "4px" }}>
                    Распознанная цепочка жестов, букв и цифр в видеоролике:
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: youtubeResult.assembled_symbols ? "#34d399" : "#94a3b8", marginBottom: "8px" }}>
                    {youtubeResult.assembled_symbols || "Ожидание живого нейросетевого захвата (0 символов)"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#f8fafc", marginBottom: "4px" }}>
                    <b>🇷🇺 Сводка (RU):</b> {youtubeResult.summary_ru}
                  </div>
                  <div style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "4px" }}>
                    <b>🇰🇬 Котормосу (KG):</b> {youtubeResult.summary_kg}
                  </div>

                  {youtubeResult.detected_timeline.length > 0 && (
                    <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        className="btn btn-teal"
                        style={{ padding: "7px 14px", fontSize: "12px" }}
                        onClick={() => downloadTextFile(`youtube_${youtubeResult.video_id}.srt`, youtubeResult.srt_export)}
                      >
                        💾 Скачать субтитры YouTube (.SRT)
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "7px 14px", fontSize: "12px" }}
                        onClick={() => {
                          setAssembledText(prev => `${prev.trimEnd()} ${youtubeResult.detected_timeline.map(t => t.symbol).join("")} `);
                          setActiveTab("scanner");
                        }}
                      >
                        ➕ Перенести все символы в строку переводчика
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Synchronized Interactive Gesture & Dactyl Timeline */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">🕒 Синхронный таймлайн жестов (кликните на таймкод)</h3>
                  <span className="badge badge-teal">
                    Символов: {youtubeResult.total_recognized_symbols} • {Math.round(youtubeResult.average_confidence * 100)}%
                  </span>
                </div>

                {youtubeResult.detected_timeline.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: "12px",
                      background: "rgba(56, 189, 248, 0.08)",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      color: "#e2e8f0",
                      fontSize: "13.5px",
                      lineHeight: "1.6"
                    }}
                  >
                    <div style={{ fontWeight: "700", color: "#38bdf8", fontSize: "15px", marginBottom: "8px" }}>
                      ℹ️ Произвольная ссылка YouTube ({youtubeResult.video_id})
                    </div>
                    <p style={{ margin: "0 0 10px 0" }}>
                      Это видео не входит в предразмеченный корпус из 4 учебных сурдопереводов. Мы <b>не подделываем жесты из хеша ссылки</b>.
                    </p>
                    <p style={{ margin: 0 }}>
                      Чтобы распознать реальные жесты в этом ролике:
                      <br />1. Запустите воспроизведение YouTube-плеера слева.
                      <br />2. Нажмите кнопку <b>«🎥 Запустить живой нейросетевой захват окна YouTube (MediaPipe Hands Screen Capture)»</b> и выберите эту вкладку.
                      <br />3. Нейросеть MediaPipe Hands в реальном времени считает 21 точку кисти из видео и заполнит этот таймлайн!
                    </p>
                  </div>
                ) : (
                  <div className="timeline-list" style={{ maxHeight: "560px" }}>
                    {youtubeResult.detected_timeline.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`timeline-item ${activeYoutubeSegIdx === idx ? "active" : ""}`}
                        onClick={() => handleSelectYouTubeSegment(idx, item)}
                      >
                        <div className="timeline-symbol-box">
                          <span className="timeline-sym">{item.symbol}</span>
                          <span className="timeline-type">
                            {item.symbol_type === "digit" ? "Цифра" : item.symbol_type === "letter" ? "Буква" : "Фраза"}
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                            <span className="timeline-timecode">▶️ {item.timestamp_label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span className="timeline-conf">
                                {Math.round(item.confidence * 100)}% • [{item.finger_states.join(",")}]
                              </span>
                              <button
                                className="btn btn-outline"
                                style={{ padding: "2px 8px", fontSize: "11px" }}
                                onClick={e => {
                                  e.stopPropagation();
                                  setAssembledText(prev =>
                                    item.symbol.length > 1 ? `${prev.trimEnd()} ${item.symbol} ` : `${prev}${item.symbol}`
                                  );
                                }}
                                title="Добавить этот символ в собранную строку"
                              >
                                + В строку
                              </button>
                            </div>
                          </div>
                          <div style={{ fontWeight: "700", fontSize: "14px", marginTop: "3px" }}>
                            🇷🇺 {item.text_ru}
                          </div>
                          <div style={{ fontSize: "12px", color: "#38bdf8", marginTop: "2px" }}>
                            🇰🇬 {item.text_kg} • 🌐 {item.text_en}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
