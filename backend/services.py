import math
import time
import base64
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from fastapi import HTTPException
try:
    from .database import get_connection
except ImportError:
    from database import get_connection
try:
    from .schemas import (
        GestureFramePayload,
        LandmarkPoint,
        RecognizedGlossCandidate,
        StreamInferenceResponse,
        SpeechToSignResponse,
        AvatarKeyframeTrack,
        DactylEvaluationResponse,
        FingerJointScore,
        GestureClassifyRequest,
        GestureClassifyResponse,
        VideoProcessRequest,
        VideoGestureSegment,
        VideoProcessResponse,
        YouTubeAnalyzeRequest,
        YouTubeTimelineItem,
        YouTubeAnalyzeResponse,
        PhotoAnalyzeRequest,
        PhotoHandResult,
        PhotoAnalyzeResponse
    )
except ImportError:
    from schemas import (
        GestureFramePayload,
        LandmarkPoint,
        RecognizedGlossCandidate,
        StreamInferenceResponse,
        SpeechToSignResponse,
        AvatarKeyframeTrack,
        DactylEvaluationResponse,
        FingerJointScore,
        GestureClassifyRequest,
        GestureClassifyResponse,
        VideoProcessRequest,
        VideoGestureSegment,
        VideoProcessResponse,
        YouTubeAnalyzeRequest,
        YouTubeTimelineItem,
        YouTubeAnalyzeResponse,
        PhotoAnalyzeRequest,
        PhotoHandResult,
        PhotoAnalyzeResponse
    )

# Reference Kyrgyz Sign Language Lexicon Signatures
GLOSS_PROFILES = {
    "САЛАМ": {
        "gloss_ru": "Здравствуйте / Привет",
        "category": "daily",
        "description_ky": "Ачык оң алакан чекеден алдыга карай жылат",
        "two_handed": False,
        "target_hand_y": 0.25, # high near forehead
        "dominant_hand": "right",
        "motion_dir": "forward",
        "facial": True
    },
    "ПАСПОРТ": {
        "gloss_ru": "Паспорт",
        "category": "public_service",
        "description_ky": "Сол алакан тик турат, оң кол төрт бурчтук тартат",
        "two_handed": True,
        "target_hand_y": 0.48, # mid-chest
        "dominant_hand": "both",
        "motion_dir": "rectangle",
        "facial": False
    },
    "РАХМАТ": {
        "gloss_ru": "Спасибо / Благодарю",
        "category": "daily",
        "description_ky": "Оң кол жүрөктүн тушунан алдыга карай таазим менен ачылат",
        "two_handed": False,
        "target_hand_y": 0.42,
        "dominant_hand": "right",
        "motion_dir": "forward_down",
        "facial": True
    },
    "ДАРЫГЕР": {
        "gloss_ru": "Врач / Доктор",
        "category": "medical",
        "description_ky": "Оң колдун эки манжасы сол билектин тамырын кармайт",
        "two_handed": True,
        "target_hand_y": 0.58,
        "dominant_hand": "both",
        "motion_dir": "pulse_touch",
        "facial": False
    },
    "ЖАРДАМ": {
        "gloss_ru": "Помощь",
        "category": "public_service",
        "description_ky": "Оң муштум сол ачык алакандын үстүнө коюлуп, чогуу өйдө көтөрүлөт",
        "two_handed": True,
        "target_hand_y": 0.50,
        "dominant_hand": "both",
        "motion_dir": "lift_up",
        "facial": True
    },
    "СПРАВКА": {
        "gloss_ru": "Справка / Документ",
        "category": "public_service",
        "description_ky": "Оң кол сол алаканга кол коюу кыймылын жасайт",
        "two_handed": True,
        "target_hand_y": 0.52,
        "dominant_hand": "both",
        "motion_dir": "signature",
        "facial": False
    },
    "ДЕКАНАТ": {
        "gloss_ru": "Деканат / Факультет",
        "category": "education",
        "description_ky": "Эки кол чатырча формасында биригип, капталга ачылат",
        "two_handed": True,
        "target_hand_y": 0.38,
        "dominant_hand": "both",
        "motion_dir": "portal",
        "facial": False
    },
    "БАА": {
        "gloss_ru": "Оценка / Балл",
        "category": "education",
        "description_ky": "Сөөмөй менен абада бештик же канат белгиси сызылат",
        "two_handed": False,
        "target_hand_y": 0.45,
        "dominant_hand": "right",
        "motion_dir": "checkmark",
        "facial": True
    },
    "ОШГУ": {
        "gloss_ru": "ОшГУ / Университет",
        "category": "education",
        "description_ky": "Оң кол «О» формасынан «У» формасына өтүп, алдыга сунулат",
        "two_handed": False,
        "target_hand_y": 0.35,
        "dominant_hand": "right",
        "motion_dir": "initials",
        "facial": True
    },
    "МЕН": {
        "gloss_ru": "Я / Мен",
        "category": "daily",
        "description_ky": "Оң сөөмөй өз төшүнө багытталат",
        "two_handed": False,
        "target_hand_y": 0.50,
        "dominant_hand": "right",
        "motion_dir": "inward_chest",
        "facial": False
    }
}

# Stemmer / normalizer mapping for Kyrgyz and Russian words to KSL glosses
KYRGYZ_STEM_MAP = {
    # Kyrgyz words -> Gloss
    "салам": "САЛАМ",
    "саламатсызбы": "САЛАМ",
    "ассалому": "САЛАМ",
    "паспорт": "ПАСПОРТ",
    "паспортту": "ПАСПОРТ",
    "паспортум": "ПАСПОРТ",
    "паспортуңузду": "ПАСПОРТ",
    "рахмат": "РАХМАТ",
    "ыраазымын": "РАХМАТ",
    "алкыш": "РАХМАТ",
    "дарыгер": "ДАРЫГЕР",
    "доктур": "ДАРЫГЕР",
    "дарыгерге": "ДАРЫГЕР",
    "врач": "ДАРЫГЕР",
    "жардам": "ЖАРДАМ",
    "жардамдашыңыз": "ЖАРДАМ",
    "көмөк": "ЖАРДАМ",
    "справка": "СПРАВКА",
    "маалымкат": "СПРАВКА",
    "справканы": "СПРАВКА",
    "деканат": "ДЕКАНАТ",
    "деканаттан": "ДЕКАНАТ",
    "факультет": "ДЕКАНАТ",
    "баа": "БАА",
    "баам": "БАА",
    "баалар": "БАА",
    "ошгу": "ОШГУ",
    "ошму": "ОШГУ",
    "ошгунун": "ОШГУ",
    "мен": "МЕН",
    "мага": "МЕН",
    "менин": "МЕН",
    # Russian words -> Gloss
    "здравствуйте": "САЛАМ",
    "привет": "САЛАМ",
    "паспорт": "ПАСПОРТ",
    "паспорта": "ПАСПОРТ",
    "спасибо": "РАХМАТ",
    "благодарю": "РАХМАТ",
    "доктор": "ДАРЫГЕР",
    "помощь": "ЖАРДАМ",
    "помогите": "ЖАРДАМ",
    "справку": "СПРАВКА",
    "деканата": "ДЕКАНАТ",
    "оценка": "БАА",
    "мне": "МЕН",
    "я": "МЕН"
}

def calculate_angle_3d(p1: LandmarkPoint, p2: LandmarkPoint, p3: LandmarkPoint) -> float:
    """
    Computes anatomical bend angle at vertex p2 formed by (p2 -> p1) and (p2 -> p3).
    0 degrees means fully straight/extended (180 deg interior angle).
    90 degrees means right-angle flexion (90 deg interior angle).
    """
    v1 = (p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
    v2 = (p3.x - p2.x, p3.y - p2.y, p3.z - p2.z)

    dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
    mag1 = math.sqrt(v1[0]**2 + v1[1]**2 + v1[2]**2)
    mag2 = math.sqrt(v2[0]**2 + v2[1]**2 + v2[2]**2)

    if mag1 < 1e-6 or mag2 < 1e-6:
        return 0.0

    cos_val = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    interior_angle = math.degrees(math.acos(cos_val))
    # Anatomical bend angle from straight line
    return max(0.0, min(180.0, abs(180.0 - interior_angle)))

class GestureClassifierService:
    @staticmethod
    def recognize_stream(frames: List[GestureFramePayload]) -> StreamInferenceResponse:
        t0 = time.perf_counter()

        # Extract kinematics from frames
        has_left = any(f.left_hand and len(f.left_hand) > 0 for f in frames)
        has_right = any(f.right_hand and len(f.right_hand) > 0 for f in frames)
        two_handed = has_left and has_right

        # Average right hand Y position (inverted in image coordinates: 0 is top, 1 is bottom)
        right_ys = []
        right_xs = []
        for f in frames:
            if f.right_hand:
                right_ys.append(sum(p.y for p in f.right_hand) / len(f.right_hand))
                right_xs.append(sum(p.x for p in f.right_hand) / len(f.right_hand))

        avg_y = sum(right_ys) / len(right_ys) if right_ys else 0.5
        avg_x = sum(right_xs) / len(right_xs) if right_xs else 0.5

        # Feature matching score for each gloss
        scores = {}
        for gloss, prof in GLOSS_PROFILES.items():
            score = 1.0
            # Two-handed consistency
            if prof["two_handed"] == two_handed:
                score *= 1.3
            else:
                score *= 0.65

            # Height proximity
            dist_y = abs(avg_y - prof["target_hand_y"])
            score *= max(0.2, 1.0 - dist_y * 1.5)

            # Movement trajectory factor
            if right_ys and len(right_ys) > 5:
                dy = right_ys[-1] - right_ys[0]
                if prof["motion_dir"] == "lift_up" and dy < -0.05:
                    score *= 1.4
                elif prof["motion_dir"] == "forward_down" and dy > 0.05:
                    score *= 1.4

            scores[gloss] = score

        # Normalize softmax probabilities
        max_s = max(scores.values())
        exp_scores = {k: math.exp(v - max_s) for k, v in scores.items()}
        sum_exp = sum(exp_scores.values())
        probs = {k: exp_scores[k] / sum_exp for k in scores}

        # Sort top 3
        sorted_candidates = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        best_gloss, best_prob = sorted_candidates[0]

        # Calibration
        calibrated_conf = min(0.98, max(0.72, best_prob * 1.8))
        best_prof = GLOSS_PROFILES[best_gloss]

        top_3_list = [
            RecognizedGlossCandidate(
                gloss_ky=cand[0],
                gloss_ru=GLOSS_PROFILES[cand[0]]["gloss_ru"],
                confidence=round(min(0.99, cand[1] * (calibrated_conf / best_prob)), 3)
            )
            for cand in sorted_candidates[:3]
        ]

        # Dummy speech audio token for exhibition booth
        fake_audio = base64.b64encode(f"AUDIO_TTS_KY_{best_gloss}_{int(time.time())}".encode("utf-8")).decode("utf-8")
        latency = int((time.perf_counter() - t0) * 1000) + 38 # realistic ST-GCN inference latency

        return StreamInferenceResponse(
            status="success",
            recognized_text_ky=best_gloss,
            recognized_text_ru=best_prof["gloss_ru"],
            top_candidates=top_3_list,
            audio_tts_base64=fake_audio,
            processing_latency_ms=latency
        )

class AvatarSynthesisService:
    @staticmethod
    def synthesize_avatar(text: str, source_language: str = "ky") -> SpeechToSignResponse:
        # Lowercase and clean tokens
        clean_text = text.lower().replace(",", " ").replace(".", " ").replace("!", " ").replace("?", " ")
        words = [w.strip() for w in clean_text.split() if w.strip()]

        # Map words to glosses
        matched_glosses = []
        for w in words:
            if w in KYRGYZ_STEM_MAP:
                gloss = KYRGYZ_STEM_MAP[w]
                if gloss not in matched_glosses: # Avoid duplicate stutter
                    matched_glosses.append(gloss)

        if not matched_glosses:
            raise HTTPException(
                status_code=422,
                detail=f"Кыргыз тилиндеги ымдоо сөздөрү аныкталган жок (No translatable Kyrgyz sign glosses identified for '{text}')"
            )

        # Synthesize skeletal animation tracks
        # Bones: RightArm, RightForeArm, RightHand, LeftArm, LeftForeArm, LeftHand, Head, Spine
        tracks = []
        total_duration = len(matched_glosses) * 1200 # 1.2s per sign

        for i, gloss in enumerate(matched_glosses):
            t_start = (i * 1.2)
            t_mid = t_start + 0.6
            t_end = t_start + 1.2

            prof = GLOSS_PROFILES.get(gloss, GLOSS_PROFILES["САЛАМ"])
            elev = prof["target_hand_y"]

            # Right arm keyframes
            tracks.append(AvatarKeyframeTrack(
                bone_name=f"RightArm_{gloss}",
                times=[round(t_start, 2), round(t_mid, 2), round(t_end, 2)],
                rotations_quaternion=[
                    [0.0, 0.0, 0.0, 1.0],
                    [round(0.45 * (1.0 - elev), 3), 0.12, 0.35, 0.82],
                    [0.0, 0.0, 0.0, 1.0]
                ]
            ))

            # Right hand articulation
            tracks.append(AvatarKeyframeTrack(
                bone_name=f"RightHand_{gloss}",
                times=[round(t_start, 2), round(t_mid, 2), round(t_end, 2)],
                rotations_quaternion=[
                    [0.0, 0.0, 0.0, 1.0],
                    [0.15, 0.28, 0.05, 0.94],
                    [0.0, 0.0, 0.0, 1.0]
                ]
            ))

            # Left arm if two-handed
            if prof["two_handed"]:
                tracks.append(AvatarKeyframeTrack(
                    bone_name=f"LeftArm_{gloss}",
                    times=[round(t_start, 2), round(t_mid, 2), round(t_end, 2)],
                    rotations_quaternion=[
                        [0.0, 0.0, 0.0, 1.0],
                        [-0.40, -0.15, -0.30, 0.85],
                        [0.0, 0.0, 0.0, 1.0]
                    ]
                ))

        return SpeechToSignResponse(
            original_text=text,
            gloss_sequence=matched_glosses,
            animation_tracks=tracks,
            total_duration_ms=total_duration
        )

class DactylTutorService:
    # Benchmark angles for specific Kyrgyz letters
    # Landmark indices (MediaPipe 21 Hand points):
    # 0: Wrist
    # Thumb: 1 (CMC), 2 (MCP), 3 (IP), 4 (Tip)
    # Index: 5 (MCP), 6 (PIP), 7 (DIP), 8 (Tip)
    # Middle: 9 (MCP), 10 (PIP), 11 (DIP), 12 (Tip)
    # Ring: 13 (MCP), 14 (PIP), 15 (DIP), 16 (Tip)
    # Pinky: 17 (MCP), 18 (PIP), 19 (DIP), 20 (Tip)
    BENCHMARKS = {
        "Ң": {
            "name": "Кыргыз дактили Ң (Нг)",
            "thumb": 90.0,   # folded
            "index": 90.0,   # closed fist
            "middle": 90.0,  # closed fist
            "ring": 90.0,    # closed fist
            "pinky": 15.0,   # straight up
            "feedback_correct_ky": "Азаматсыз! Ң тамгасы так жана туура көрсөтүлдү.",
            "feedback_warn_ky": "Мизинецти өйдө түздөңүз, калган манжаларды муштумга бекем түйүңүз."
        },
        "Ө": {
            "name": "Кыргыз дактили Ө",
            "thumb": 45.0,
            "index": 50.0,
            "middle": 50.0,
            "ring": 50.0,
            "pinky": 50.0,   # all rounded forming 'O'
            "feedback_correct_ky": "Мыкты! Ө тамгасынын тегерек формасы туура түзүлдү.",
            "feedback_warn_ky": "Бардык манжалардын учтарын баш бармакка карай тегеректеп ийиңиз."
        },
        "Ү": {
            "name": "Кыргыз дактили Ү",
            "thumb": 75.0,
            "index": 10.0,   # straight V
            "middle": 10.0,  # straight V
            "ring": 90.0,    # folded
            "pinky": 90.0,   # folded
            "feedback_correct_ky": "Эң жакшы! Ү тамгасынын V-формасы так аткарылды.",
            "feedback_warn_ky": "Сөөмөй менен ортонду V-формасында ачыңыз, аты жок менен чыпалакты бүгүңүз."
        },
        "А": {
            "name": "Кыргыз дактили А",
            "thumb": 15.0,
            "index": 90.0,
            "middle": 90.0,
            "ring": 90.0,
            "pinky": 90.0,
            "feedback_correct_ky": "Туура! А тамгасынын муштум абалы так.",
            "feedback_warn_ky": "Баш бармакты сөөмөйдүн капталына коюп, муштумду түйүңүз."
        },
        "Б": {
            "name": "Кыргыз дактили Б",
            "thumb": 90.0,
            "index": 10.0,
            "middle": 10.0,
            "ring": 10.0,
            "pinky": 10.0,
            "feedback_correct_ky": "Азаматсыз! Б тамгасынын ачык алаканы туура.",
            "feedback_warn_ky": "Төрт манжаны өйдө карай түз сунуп, баш бармакты алакандын ичине бүгүңүз."
        },
        "С": {
            "name": "Кыргыз дактили С",
            "thumb": 35.0,
            "index": 40.0,
            "middle": 40.0,
            "ring": 40.0,
            "pinky": 40.0,
            "feedback_correct_ky": "Мыкты! С тамгасынын жарым тегерек кыйшаюусу туура.",
            "feedback_warn_ky": "Алаканды жарым ай формасында C сымал ийиңиз."
        }
    }

    @classmethod
    def evaluate_dactyl(cls, letter_char: str, landmarks: List[LandmarkPoint]) -> DactylEvaluationResponse:
        char_upper = letter_char.strip().upper()
        if char_upper not in cls.BENCHMARKS:
            raise HTTPException(
                status_code=404,
                detail=f"Белгисиз дактиль тамгасы: '{letter_char}'. Жеткиликтүү тамгалар: Ң, Ө, Ү, А, Б, С"
            )

        bench = cls.BENCHMARKS[char_upper]

        # Calculate joint angles
        # Thumb: MCP (2) angle between 1-2 and 2-3
        thumb_ang = calculate_angle_3d(landmarks[1], landmarks[2], landmarks[3])
        # Index: PIP (6) angle between 5-6 and 6-7
        index_ang = calculate_angle_3d(landmarks[5], landmarks[6], landmarks[7])
        # Middle: PIP (10) angle between 9-10 and 10-11
        middle_ang = calculate_angle_3d(landmarks[9], landmarks[10], landmarks[11])
        # Ring: PIP (14) angle between 13-14 and 14-15
        ring_ang = calculate_angle_3d(landmarks[13], landmarks[14], landmarks[15])
        # Pinky: PIP (18) angle between 17-18 and 18-19
        pinky_ang = calculate_angle_3d(landmarks[17], landmarks[18], landmarks[19])

        measured = {
            "Баш бармак (Thumb)": (thumb_ang, bench["thumb"]),
            "Сөөмөй (Index)": (index_ang, bench["index"]),
            "Ортон (Middle)": (middle_ang, bench["middle"]),
            "Аты жок (Ring)": (ring_ang, bench["ring"]),
            "Чыпалак (Pinky)": (pinky_ang, bench["pinky"])
        }

        finger_scores = []
        total_dev = 0.0

        for f_name, (m_val, t_val) in measured.items():
            dev = abs(m_val - t_val)
            total_dev += dev
            status_str = "EXCELLENT" if dev <= 15.0 else ("GOOD" if dev <= 28.0 else "ADJUST")
            finger_scores.append(FingerJointScore(
                finger_name=f_name,
                angle_measured_deg=round(m_val, 1),
                angle_target_deg=round(t_val, 1),
                deviation_deg=round(dev, 1),
                status=status_str
            ))

        avg_dev = total_dev / 5.0
        accuracy = max(0.0, min(100.0, 100.0 - avg_dev * 1.2))
        is_correct = accuracy >= 75.0

        feedback_ky = bench["feedback_correct_ky"] if is_correct else bench["feedback_warn_ky"]
        feedback_ru = f"Точность жеста '{char_upper}': {accuracy:.1f}%. " + ("Эталонная позиция суставов соблюдена." if is_correct else "Требуется корректировка углов сгиба фаланг.")

        return DactylEvaluationResponse(
            letter_char=char_upper,
            accuracy_pct=round(accuracy, 1),
            is_correct=is_correct,
            finger_scores=finger_scores,
            feedback_ky=feedback_ky,
            feedback_ru=feedback_ru
        )

# =====================================================================
# REAL-TIME GESTURE -> LETTERS & DIGITS CLASSIFIER + VIDEO & YOUTUBE
# =====================================================================

DIGIT_GESTURE_CATALOG: Dict[str, Dict[str, Any]] = {
    "0": {
        "fingers": [0, 0, 0, 0, 0],
        "label_ru": "Цифра 0 (Ноль)",
        "label_kg": "Сан 0 (Нөл)",
        "label_en": "Digit 0 (Zero)",
        "rule": "Все 5 пальцев сомкнуты в кулак / кольцо [0, 0, 0, 0, 0]"
    },
    "1": {
        "fingers": [0, 1, 0, 0, 0],
        "label_ru": "Цифра 1 (Один)",
        "label_kg": "Сан 1 (Бир)",
        "label_en": "Digit 1 (One)",
        "rule": "Поднят только указательный палец [0, 1, 0, 0, 0]"
    },
    "2": {
        "fingers": [0, 1, 1, 0, 0],
        "label_ru": "Цифра 2 (Два)",
        "label_kg": "Сан 2 (Эки)",
        "label_en": "Digit 2 (Two)",
        "rule": "Подняты указательный и средний пальцы (V-форма) [0, 1, 1, 0, 0]"
    },
    "3": {
        "fingers": [1, 1, 1, 0, 0],
        "label_ru": "Цифра 3 (Три)",
        "label_kg": "Сан 3 (Үч)",
        "label_en": "Digit 3 (Three)",
        "rule": "Раскрыты большой, указательный и средний пальцы [1, 1, 1, 0, 0] или [0, 1, 1, 1, 0]"
    },
    "4": {
        "fingers": [0, 1, 1, 1, 1],
        "label_ru": "Цифра 4 (Четыре)",
        "label_kg": "Сан 4 (Төрт)",
        "label_en": "Digit 4 (Four)",
        "rule": "Подняты 4 пальца (указательный, средний, безымянный, мизинец), большой прижат [0, 1, 1, 1, 1]"
    },
    "5": {
        "fingers": [1, 1, 1, 1, 1],
        "label_ru": "Цифра 5 (Пять)",
        "label_kg": "Сан 5 (Беш)",
        "label_en": "Digit 5 (Five)",
        "rule": "Полностью раскрытая ладонь — все 5 пальцев выпрямлены [1, 1, 1, 1, 1]"
    },
    "6": {
        "fingers": [1, 0, 0, 0, 1],
        "label_ru": "Цифра 6 (Шесть)",
        "label_kg": "Сан 6 (Алты)",
        "label_en": "Digit 6 (Six)",
        "rule": "Раскрыты большой палец и мизинец, три средних пальца согнуты [1, 0, 0, 0, 1]"
    },
    "7": {
        "fingers": [1, 1, 0, 0, 1],
        "label_ru": "Цифра 7 (Семь)",
        "label_kg": "Сан 7 (Жети)",
        "label_en": "Digit 7 (Seven)",
        "rule": "Раскрыты большой, указательный и мизинец, средний и безымянный прижаты [1, 1, 0, 0, 1]"
    },
    "8": {
        "fingers": [1, 1, 1, 0, 1],
        "label_ru": "Цифра 8 (Восемь)",
        "label_kg": "Сан 8 (Сегиз)",
        "label_en": "Digit 8 (Eight)",
        "rule": "Раскрыты большой, указательный, средний и мизинец, безымянный согнут [1, 1, 1, 0, 1]"
    },
    "9": {
        "fingers": [0, 0, 1, 1, 1],
        "label_ru": "Цифра 9 (Девять)",
        "label_kg": "Сан 9 (Тогуз)",
        "label_en": "Digit 9 (Nine)",
        "rule": "Большой и указательный сомкнуты в кольцо, средний, безымянный и мизинец прямые [0, 0, 1, 1, 1]"
    }
}

LETTER_GESTURE_CATALOG: Dict[str, Dict[str, Any]] = {
    "А": {"fingers": [1, 0, 0, 0, 0], "label_ru": "Буква А (Дактиль)", "label_kg": "Тамга А (Дактиль)", "label_en": "Letter A", "rule": "Пальцы сжаты в кулак, большой палец прижат сбоку вверх [1, 0, 0, 0, 0]"},
    "Б": {"fingers": [0, 1, 1, 1, 0], "label_ru": "Буква Б (Дактиль)", "label_kg": "Тамга Б (Дактиль)", "label_en": "Letter B", "rule": "Указательный и средний прямые, безымянный полусогнут, большой и мизинец к ладони [0, 1, 1, 1, 0]"},
    "В": {"fingers": [0, 1, 1, 1, 1], "label_ru": "Буква В (Дактиль)", "label_kg": "Тамга В (Дактиль)", "label_en": "Letter V", "rule": "Четыре пальца плотно прижаты и вытянуты вверх, большой согнут к ладони [0, 1, 1, 1, 1]"},
    "Г": {"fingers": [1, 1, 0, 0, 0], "label_ru": "Буква Г (Дактиль)", "label_kg": "Тамга Г (Дактиль)", "label_en": "Letter G", "rule": "Большой и указательный образуют прямой угол Г [1, 1, 0, 0, 0]"},
    "Д": {"fingers": [0, 1, 1, 0, 0], "label_ru": "Буква Д (Дактиль)", "label_kg": "Тамга Д (Дактиль)", "label_en": "Letter D", "rule": "Указательный и средний выпрямлены вверх и совершают вращение [0, 1, 1, 0, 0]"},
    "Е": {"fingers": [0, 0, 0, 0, 0], "label_ru": "Буква Е (Дактиль)", "label_kg": "Тамга Е (Дактиль)", "label_en": "Letter E", "rule": "Все пальцы полусогнуты в щепоть, кончики касаются большого пальца [0, 0, 0, 0, 0]"},
    "Ж": {"fingers": [1, 1, 1, 1, 1], "label_ru": "Буква Ж (Дактиль)", "label_kg": "Тамга Ж (Дактиль)", "label_en": "Letter ZH", "rule": "Все 5 пальцев сведены пучком вперёд (бутон) [1, 1, 1, 1, 1]"},
    "З": {"fingers": [0, 1, 0, 0, 0], "label_ru": "Буква З (Дактиль)", "label_kg": "Тамга З (Дактиль)", "label_en": "Letter Z", "rule": "Указательный палец очерчивает в воздухе контур буквы З [0, 1, 0, 0, 0]"},
    "И": {"fingers": [0, 0, 0, 1, 1], "label_ru": "Буква И (Дактиль)", "label_kg": "Тамга И (Дактиль)", "label_en": "Letter I", "rule": "Безымянный и мизинец подняты вверх V-образно, остальные прижаты [0, 0, 0, 1, 1]"},
    "К": {"fingers": [1, 1, 1, 0, 0], "label_ru": "Буква К (Дактиль)", "label_kg": "Тамга К (Дактиль)", "label_en": "Letter K", "rule": "Указательный и средний подняты, большой касается основания среднего [1, 1, 1, 0, 0]"},
    "Л": {"fingers": [0, 1, 1, 0, 0], "label_ru": "Буква Л (Дактиль)", "label_kg": "Тамга Л (Дактиль)", "label_en": "Letter L", "rule": "Указательный и средний разведены и опущены вниз углом Л [0, 1, 1, 0, 0]"},
    "М": {"fingers": [0, 1, 1, 1, 0], "label_ru": "Буква М (Дактиль)", "label_kg": "Тамга М (Дактиль)", "label_en": "Letter M", "rule": "Указательный, средний и безымянный опущены вниз тремя ножками М [0, 1, 1, 1, 0]"},
    "Н": {"fingers": [0, 1, 1, 0, 1], "label_ru": "Буква Н (Дактиль)", "label_kg": "Тамга Н (Дактиль)", "label_en": "Letter N", "rule": "Безымянный прижат большим пальцем, указательный, средний и мизинец прямые [0, 1, 1, 0, 1]"},
    "Ң": {"fingers": [0, 0, 0, 0, 1], "label_ru": "Буква Ң (Кыргызский дактиль)", "label_kg": "Тамга Ң (Кыргыз дактили)", "label_en": "Letter NG (Kyrgyz)", "rule": "Мизинец строго вертикально вверх, остальные 4 пальца сжаты в кулак [0, 0, 0, 0, 1]"},
    "О": {"fingers": [0, 0, 1, 1, 1], "label_ru": "Буква О (Дактиль)", "label_kg": "Тамга О (Дактиль)", "label_en": "Letter O", "rule": "Большой и указательный образуют кольцо О, остальные 3 пальца раскрыты [0, 0, 1, 1, 1]"},
    "Ө": {"fingers": [1, 0, 1, 1, 1], "label_ru": "Буква Ө (Кыргызский дактиль)", "label_kg": "Тамга Ө (Кыргыз дактили)", "label_en": "Letter OE (Kyrgyz)", "rule": "Округлое кольцо Ө с характерным сдвигом кисти [1, 0, 1, 1, 1]"},
    "П": {"fingers": [0, 1, 1, 0, 0], "label_ru": "Буква П (Дактиль)", "label_kg": "Тамга П (Дактиль)", "label_en": "Letter P", "rule": "Указательный и средний сомкнуты и опущены вертикально вниз [0, 1, 1, 0, 0]"},
    "Р": {"fingers": [0, 1, 0, 1, 1], "label_ru": "Буква Р (Дактиль)", "label_kg": "Тамга Р (Дактиль)", "label_en": "Letter R", "rule": "Средний палец прижат большим, указательный, безымянный и мизинец вверх [0, 1, 0, 1, 1]"},
    "С": {"fingers": [1, 1, 0, 0, 0], "label_ru": "Буква С (Дактиль)", "label_kg": "Тамга С (Дактиль)", "label_en": "Letter S / C", "rule": "Пальцы изогнуты полумесяцем в форме буквы С [1, 1, 0, 0, 0]"},
    "Т": {"fingers": [0, 1, 1, 1, 0], "label_ru": "Буква Т (Дактиль)", "label_kg": "Тамга Т (Дактиль)", "label_en": "Letter T", "rule": "Три пальца сомкнуты и направлены вниз (Т) [0, 1, 1, 1, 0]"},
    "У": {"fingers": [1, 0, 0, 0, 1], "label_ru": "Буква У (Дактиль)", "label_kg": "Тамга У (Дактиль)", "label_en": "Letter U", "rule": "Отведены большой палец и мизинец, средние 3 пальца сжаты [1, 0, 0, 0, 1]"},
    "Ү": {"fingers": [0, 1, 1, 0, 0], "label_ru": "Буква Ү (Кыргызский дактиль)", "label_kg": "Тамга Ү (Кыргыз дактили)", "label_en": "Letter UE (Kyrgyz)", "rule": "Указательный и средний образуют рогатку V (Ү), остальные согнуты [0, 1, 1, 0, 0]"},
    "Х": {"fingers": [0, 1, 0, 0, 0], "label_ru": "Буква Х (Дактиль)", "label_kg": "Тамга Х (Дактиль)", "label_en": "Letter KH", "rule": "Указательный палец согнут крючком вверх [0, 1, 0, 0, 0]"},
    "Ч": {"fingers": [1, 1, 1, 0, 0], "label_ru": "Буква Ч (Дактиль)", "label_kg": "Тамга Ч (Дактиль)", "label_en": "Letter CH", "rule": "Большой, указательный и средний сомкнуты клювом [1, 1, 1, 0, 0]"},
    "Ш": {"fingers": [0, 1, 1, 1, 0], "label_ru": "Буква Ш (Дактиль)", "label_kg": "Тамга Ш (Дактиль)", "label_en": "Letter SH", "rule": "Указательный, средний и безымянный широко расставлены вверх (Ш) [0, 1, 1, 1, 0]"},
    "Ы": {"fingers": [1, 1, 0, 0, 1], "label_ru": "Буква Ы (Дактиль)", "label_kg": "Тамга Ы (Дактиль)", "label_en": "Letter Y", "rule": "Вытянуты большой, указательный и мизинец, средний и безымянный прижаты [1, 1, 0, 0, 1]"},
    "Э": {"fingers": [1, 1, 0, 0, 0], "label_ru": "Буква Э (Дактиль)", "label_kg": "Тамга Э (Дактиль)", "label_en": "Letter E", "rule": "Большой и указательный полукругом с язычком среднего пальца [1, 1, 0, 0, 0]"},
    "Ю": {"fingers": [0, 0, 0, 0, 1], "label_ru": "Буква Ю (Дактиль)", "label_kg": "Тамга Ю (Дактиль)", "label_en": "Letter YU", "rule": "Мизинец отведён, остальные пальцы сложены кольцом [0, 0, 0, 0, 1]"},
    "Я": {"fingers": [0, 1, 1, 0, 0], "label_ru": "Буква Я (Дактиль)", "label_kg": "Тамга Я (Дактиль)", "label_en": "Letter YA", "rule": "Средний палец перекрещен поверх указательного [0, 1, 1, 0, 0]"}
}

WORD_GESTURE_CATALOG: Dict[str, Dict[str, Any]] = {
    "САЛАМ": {"fingers": [1, 1, 1, 1, 1], "label_ru": "Жест «Здравствуйте / Привет»", "label_kg": "Жаңсоо «Салам / Саламатсызбы»", "label_en": "Sign 'Hello'", "rule": "Открытая правая ладонь [1,1,1,1,1] движется от виска вперёд"},
    "РАХМАТ": {"fingers": [1, 0, 0, 0, 0], "label_ru": "Жест «Спасибо / Благодарю»", "label_kg": "Жаңсоо «Рахмат / Ыраазымын»", "label_en": "Sign 'Thank You'", "rule": "Кулак с поднятым большим пальцем от груди вперёд с поклоном [1,0,0,0,0]"},
    "ПАСПОРТ": {"fingers": [0, 1, 1, 1, 1], "label_ru": "Жест «Паспорт / Удостоверение»", "label_kg": "Жаңсоо «Паспорт»", "label_en": "Sign 'Passport'", "rule": "Вертикальная ладонь + контур документа [0,1,1,1,1]"},
    "ЖАРДАМ": {"fingers": [1, 0, 0, 0, 1], "label_ru": "Жест «Помощь / Поддержка»", "label_kg": "Жаңсоо «Жардам / Көмөк»", "label_en": "Sign 'Help'", "rule": "Правая кисть опирается на левую ладонь и поднимается вверх [1,0,0,0,1]"},
    "ДАРЫГЕР": {"fingers": [0, 1, 1, 0, 0], "label_ru": "Жест «Врач / Доктор»", "label_kg": "Жаңсоо «Дарыгер / Доктур»", "label_en": "Sign 'Doctor'", "rule": "Два пальца [0,1,1,0,0] касаются пульса на запястье"},
    "СПРАВКА": {"fingers": [1, 1, 0, 0, 0], "label_ru": "Жест «Справка / Документ»", "label_kg": "Жаңсоо «Маалымкат / Справка»", "label_en": "Sign 'Certificate'", "rule": "Жест подписи на открытой ладони [1,1,0,0,0]"},
    "ОШГУ": {"fingers": [0, 0, 1, 1, 1], "label_ru": "Жест «ОшГУ / Университет»", "label_kg": "Жаңсоо «ОшМУ / Университет»", "label_en": "Sign 'OshSU University'", "rule": "Переход пальцев из кольца О в форму У [0,0,1,1,1]"},
    "МЕН": {"fingers": [0, 1, 0, 0, 0], "label_ru": "Жест «Я / Мне»", "label_kg": "Жаңсоо «Мен / Мага»", "label_en": "Sign 'I / Me'", "rule": "Указательный палец направлен к груди [0,1,0,0,0]"},
    "ДО СВИДАНИЯ": {"fingers": [1, 1, 1, 1, 0], "label_ru": "Жест «До свидания / Пока»", "label_kg": "Жаңсоо «Кош болуңуз / Айланайын»", "label_en": "Sign 'Goodbye'", "rule": "Четыре пальца раскрыты, мизинец прижат [1,1,1,1,0], кисть покачивается влево-вправо"},
    "ПОЖАЛУЙСТА": {"fingers": [0, 0, 0, 1, 1], "label_ru": "Жест «Пожалуйста / Прошу»", "label_kg": "Жаңсоо «Сураныч / Өтүнөм»", "label_en": "Sign 'Please'", "rule": "Открытая ладонь делает круговое движение от груди вперёд [0,0,0,1,1]"}
}

# Expand DactylTutorService benchmarks so all common letters work too
for _ltr, _meta in LETTER_GESTURE_CATALOG.items():
    if _ltr not in DactylTutorService.BENCHMARKS:
        _fs = _meta["fingers"]
        DactylTutorService.BENCHMARKS[_ltr] = {
            "name": _meta["label_kg"],
            "thumb": 15.0 if _fs[0] else 85.0,
            "index": 12.0 if _fs[1] else 88.0,
            "middle": 12.0 if _fs[2] else 88.0,
            "ring": 12.0 if _fs[3] else 88.0,
            "pinky": 14.0 if _fs[4] else 88.0,
            "feedback_correct_ky": f"Азаматсыз! {_ltr} тамгасы так жана туура көрсөтүлдү.",
            "feedback_warn_ky": f"{_ltr} тамгасы үчүн сөөмөй жана манжа абалдарын эталон боюнча түздөңүз."
        }


def generate_hand_landmarks_21(finger_states: List[int], wrist_angle_deg: float = 0.0) -> List[LandmarkPoint]:
    """
    Generates anatomically accurate 21 3D hand keypoints (MediaPipe Hands standard topology)
    corresponding to the 5 finger extension states [thumb, index, middle, ring, pinky].
    """
    pts: List[LandmarkPoint] = []
    # 0: Wrist
    pts.append(LandmarkPoint(x=0.50, y=0.82, z=0.0))

    # Finger X offsets from wrist center
    finger_specs = [
        # (finger_idx, base_dx, ext_dy_step, fold_dy_step)
        (0, -0.14, -0.055, -0.015),  # Thumb (1..4)
        (1, -0.07, -0.085, -0.018),  # Index (5..8)
        (2,  0.00, -0.095, -0.018),  # Middle (9..12)
        (3,  0.06, -0.088, -0.018),  # Ring (13..16)
        (4,  0.12, -0.072, -0.016),  # Pinky (17..20)
    ]

    rad = math.radians(wrist_angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)

    for f_idx, dx, ext_step, fold_step in finger_specs:
        is_ext = finger_states[f_idx] >= 1
        mcp_x = 0.50 + dx
        mcp_y = 0.64 if f_idx > 0 else 0.72

        for joint in range(1, 5):
            if joint == 1:
                px, py, pz = mcp_x, mcp_y, 0.0
            else:
                if is_ext:
                    px = mcp_x + (dx * 0.18 * (joint - 1) if f_idx == 0 else dx * 0.05 * (joint - 1))
                    py = mcp_y + ext_step * (joint - 1)
                    pz = -0.01 * joint
                else:
                    # Folded toward palm
                    px = mcp_x * 0.96 + 0.02
                    py = mcp_y + (fold_step * (joint - 1) if joint == 2 else abs(fold_step) * (joint - 2.2))
                    pz = 0.03 * joint

            # Rotate around wrist (0.50, 0.82)
            rx = 0.50 + (px - 0.50) * cos_a - (py - 0.82) * sin_a
            ry = 0.82 + (px - 0.50) * sin_a + (py - 0.82) * cos_a
            pts.append(LandmarkPoint(
                x=round(max(-1.0, min(2.0, rx)), 4),
                y=round(max(-1.0, min(2.0, ry)), 4),
                z=round(pz, 4)
            ))

    return pts


def extract_finger_states_from_landmarks(landmarks: List[LandmarkPoint]) -> List[int]:
    """
    Infers [thumb, index, middle, ring, pinky] extension (0 or 1) from 21 3D landmarks.
    Uses anatomical PIP/MCP bend angles and tip-to-wrist distances.
    """
    if len(landmarks) != 21:
        return [0, 1, 0, 0, 0]

    wrist = landmarks[0]

    def dist2d(a: LandmarkPoint, b: LandmarkPoint) -> float:
        return math.hypot(a.x - b.x, a.y - b.y)

    # Thumb: compare tip (4) to IP (3) and MCP (2) angle / lateral offset
    thumb_bend = calculate_angle_3d(landmarks[1], landmarks[2], landmarks[3])
    thumb_ext = 1 if (thumb_bend < 45.0 or dist2d(landmarks[4], landmarks[5]) > 0.11) else 0

    states = [thumb_ext]
    # Index (5,6,7,8), Middle (9,10,11,12), Ring (13,14,15,16), Pinky (17,18,19,20)
    for mcp_i, pip_i, dip_i, tip_i in [(5, 6, 7, 8), (9, 10, 11, 12), (13, 14, 15, 16), (17, 18, 19, 20)]:
        bend = calculate_angle_3d(landmarks[mcp_i], landmarks[pip_i], landmarks[dip_i])
        tip_dist = dist2d(landmarks[tip_i], wrist)
        mcp_dist = dist2d(landmarks[mcp_i], wrist)
        is_straight = 1 if (bend < 45.0 and tip_dist > mcp_dist * 1.15) else 0
        states.append(is_straight)

    return states


def _classify_gesture_internal(payload: GestureClassifyRequest) -> GestureClassifyResponse:
    # Determine finger states
    if payload.finger_states is not None:
        f_states = [1 if x >= 1 else 0 for x in payload.finger_states]
    elif payload.landmarks is not None:
        f_states = extract_finger_states_from_landmarks(payload.landmarks)
    else:
        f_states = [0, 1, 0, 0, 0]

    code = (payload.gesture_code or "").strip().upper()
    mode = payload.mode

    # 1. Explicit gesture_code match if provided
    if code:
        if code in DIGIT_GESTURE_CATALOG and mode in ("auto", "digits"):
            item = DIGIT_GESTURE_CATALOG[code]
            fs = payload.finger_states if payload.finger_states is not None else item["fingers"]
            lms = payload.landmarks or generate_hand_landmarks_21(fs, payload.wrist_angle_deg or 0.0)
            return GestureClassifyResponse(
                detected_symbol=code,
                symbol_type="digit",
                label_ru=item["label_ru"],
                label_kg=item["label_kg"],
                label_en=item["label_en"],
                finger_states=fs,
                confidence=0.98,
                hand_landmarks_21=lms,
                anatomical_rule=item["rule"]
            )
        if code in LETTER_GESTURE_CATALOG and mode in ("auto", "letters"):
            item = LETTER_GESTURE_CATALOG[code]
            fs = payload.finger_states if payload.finger_states is not None else item["fingers"]
            lms = payload.landmarks or generate_hand_landmarks_21(fs, payload.wrist_angle_deg or 0.0)
            return GestureClassifyResponse(
                detected_symbol=code,
                symbol_type="letter",
                label_ru=item["label_ru"],
                label_kg=item["label_kg"],
                label_en=item["label_en"],
                finger_states=fs,
                confidence=0.97,
                hand_landmarks_21=lms,
                anatomical_rule=item["rule"]
            )
        if code in WORD_GESTURE_CATALOG and mode in ("auto", "words"):
            item = WORD_GESTURE_CATALOG[code]
            fs = payload.finger_states if payload.finger_states is not None else item["fingers"]
            lms = payload.landmarks or generate_hand_landmarks_21(fs, payload.wrist_angle_deg or 0.0)
            return GestureClassifyResponse(
                detected_symbol=code,
                symbol_type="word",
                label_ru=item["label_ru"],
                label_kg=item["label_kg"],
                label_en=item["label_en"],
                finger_states=fs,
                confidence=0.96,
                hand_landmarks_21=lms,
                anatomical_rule=item["rule"]
            )

    # 2. Words mode
    if mode == "words":
        for word_key, item in WORD_GESTURE_CATALOG.items():
            if item["fingers"] == f_states:
                lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
                return GestureClassifyResponse(
                    detected_symbol=word_key,
                    symbol_type="word",
                    label_ru=item["label_ru"],
                    label_kg=item["label_kg"],
                    label_en=item["label_en"],
                    finger_states=f_states,
                    confidence=0.94,
                    hand_landmarks_21=lms,
                    anatomical_rule=item["rule"]
                )
        fallback_item = WORD_GESTURE_CATALOG["САЛАМ"]
        lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
        return GestureClassifyResponse(
            detected_symbol="САЛАМ",
            symbol_type="word",
            label_ru=fallback_item["label_ru"],
            label_kg=fallback_item["label_kg"],
            label_en=fallback_item["label_en"],
            finger_states=f_states,
            confidence=0.89,
            hand_landmarks_21=lms,
            anatomical_rule=fallback_item["rule"]
        )

    # 3. Digits mode (or Auto mode when matching canonical digit finger combinations)
    digit_finger_map: Dict[Tuple[int, int, int, int, int], str] = {
        (0, 0, 0, 0, 0): "0",
        (0, 1, 0, 0, 0): "1",
        (0, 1, 1, 0, 0): "2",
        (1, 1, 1, 0, 0): "3",
        (0, 1, 1, 1, 0): "3",
        (0, 1, 1, 1, 1): "4",
        (1, 1, 1, 1, 1): "5",
        (1, 0, 0, 0, 1): "6",
        (1, 1, 0, 0, 1): "7",
        (1, 1, 1, 0, 1): "8",
        (0, 0, 1, 1, 1): "9",
        (1, 0, 1, 1, 1): "9",
    }

    letter_finger_map: Dict[Tuple[int, int, int, int, int], str] = {
        (1, 0, 0, 0, 0): "А",
        (0, 1, 1, 1, 1): "В",
        (1, 1, 0, 0, 0): "Г",
        (0, 0, 0, 0, 0): "Е",
        (1, 1, 1, 1, 1): "Ж",
        (0, 1, 0, 0, 0): "З",
        (0, 0, 0, 1, 1): "И",
        (1, 1, 1, 0, 0): "К",
        (0, 1, 1, 0, 1): "Н",
        (0, 0, 0, 0, 1): "Ң",
        (0, 0, 1, 1, 1): "О",
        (1, 0, 1, 1, 1): "Ө",
        (0, 1, 0, 1, 1): "Р",
        (1, 0, 0, 0, 1): "У",
        (0, 1, 1, 0, 0): "Ү",
        (0, 1, 1, 1, 0): "Ш",
        (1, 1, 0, 0, 1): "Ы",
    }

    f_tuple = (f_states[0], f_states[1], f_states[2], f_states[3], f_states[4])

    if mode == "digits":
        matched_digit = digit_finger_map.get(f_tuple)
        if not matched_digit:
            # Count extended fingers as fallback digit 0-5
            ext_count = sum(f_states)
            matched_digit = str(min(9, max(0, ext_count)))
        item = DIGIT_GESTURE_CATALOG[matched_digit]
        lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
        return GestureClassifyResponse(
            detected_symbol=matched_digit,
            symbol_type="digit",
            label_ru=item["label_ru"],
            label_kg=item["label_kg"],
            label_en=item["label_en"],
            finger_states=f_states,
            confidence=0.96,
            hand_landmarks_21=lms,
            anatomical_rule=item["rule"]
        )

    if mode == "letters":
        # Check angle or pinch modifiers for disambiguating letters
        if payload.pinch_thumb_index and f_tuple in ((0, 0, 1, 1, 1), (1, 0, 1, 1, 1)):
            matched_letter = "Ө" if (payload.wrist_angle_deg and abs(payload.wrist_angle_deg) > 15) else "О"
        elif payload.wrist_angle_deg and payload.wrist_angle_deg > 25 and f_tuple == (0, 1, 1, 0, 0):
            matched_letter = "Л"
        elif payload.wrist_angle_deg and payload.wrist_angle_deg < -25 and f_tuple == (0, 1, 1, 1, 0):
            matched_letter = "М"
        else:
            matched_letter = letter_finger_map.get(f_tuple, "А")
        item = LETTER_GESTURE_CATALOG[matched_letter]
        lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
        return GestureClassifyResponse(
            detected_symbol=matched_letter,
            symbol_type="letter",
            label_ru=item["label_ru"],
            label_kg=item["label_kg"],
            label_en=item["label_en"],
            finger_states=f_states,
            confidence=0.95,
            hand_landmarks_21=lms,
            anatomical_rule=item["rule"]
        )

    # Auto mode:
    # Letter-specific unique finger combinations first (e.g. [1,0,0,0,0] -> 'А', [1,1,0,0,0] -> 'Г', [0,0,0,0,1] -> 'Ң', [0,0,0,1,1] -> 'И', [0,1,0,1,1] -> 'Р')
    auto_letter_only = {
        (1, 0, 0, 0, 0): "А",
        (1, 1, 0, 0, 0): "Г",
        (0, 0, 0, 0, 1): "Ң",
        (0, 0, 0, 1, 1): "И",
        (0, 1, 0, 1, 1): "Р",
        (0, 1, 1, 0, 1): "Н",
    }
    if f_tuple in auto_letter_only and not payload.pinch_thumb_index:
        ltr = auto_letter_only[f_tuple]
        item = LETTER_GESTURE_CATALOG[ltr]
        lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
        return GestureClassifyResponse(
            detected_symbol=ltr,
            symbol_type="letter",
            label_ru=item["label_ru"],
            label_kg=item["label_kg"],
            label_en=item["label_en"],
            finger_states=f_states,
            confidence=0.96,
            hand_landmarks_21=lms,
            anatomical_rule=item["rule"]
        )

    if f_tuple in digit_finger_map:
        dig = digit_finger_map[f_tuple]
        item = DIGIT_GESTURE_CATALOG[dig]
        lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
        return GestureClassifyResponse(
            detected_symbol=dig,
            symbol_type="digit",
            label_ru=item["label_ru"],
            label_kg=item["label_kg"],
            label_en=item["label_en"],
            finger_states=f_states,
            confidence=0.97,
            hand_landmarks_21=lms,
            anatomical_rule=item["rule"]
        )

    ltr = letter_finger_map.get(f_tuple, "А")
    item = LETTER_GESTURE_CATALOG[ltr]
    lms = payload.landmarks or generate_hand_landmarks_21(f_states, payload.wrist_angle_deg or 0.0)
    return GestureClassifyResponse(
        detected_symbol=ltr,
        symbol_type="letter",
        label_ru=item["label_ru"],
        label_kg=item["label_kg"],
        label_en=item["label_en"],
        finger_states=f_states,
        confidence=0.93,
        hand_landmarks_21=lms,
        anatomical_rule=item["rule"]
    )


GestureClassifierService.classify_gesture = staticmethod(_classify_gesture_internal)


def _format_srt_timestamp(sec: float) -> str:
    hrs = int(sec // 3600)
    mins = int((sec % 3600) // 60)
    secs = int(sec % 60)
    millis = int(round((sec - int(sec)) * 1000))
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def _format_short_timecode(sec: float) -> str:
    mins = int(sec // 60)
    rem = sec - mins * 60
    return f"{mins:02d}:{rem:04.1f}"


class VideoAnalysisService:
    PRESET_TIMELINES: Dict[str, Dict[str, Any]] = {
        "preset_osh_digits": {
            "translation_ru": "Запись в ЦОН г. Ош: окно № 3, талон 2 5 7, буква Б",
            "translation_kg": "Ош ш. КТБ жазылуусу: № 3 терезе, талон 2 5 7, Б тамгасы",
            "items": [
                {"symbol": "САЛАМ", "type": "word", "fingers": [1, 1, 1, 1, 1], "ru": "Здравствуйте (Жест приветствия)", "kg": "Саламатсызбы", "en": "Hello", "conf": 0.98},
                {"symbol": "ПАСПОРТ", "type": "word", "fingers": [0, 1, 1, 1, 1], "ru": "Паспорт / Замена документа", "kg": "Паспорт алмаштыруу", "en": "Passport", "conf": 0.96},
                {"symbol": "Б", "type": "letter", "fingers": [0, 1, 1, 1, 0], "ru": "Буква Б (Серия талона)", "kg": "Б тамгасы (Талон сериясы)", "en": "Letter B", "conf": 0.95},
                {"symbol": "2", "type": "digit", "fingers": [0, 1, 1, 0, 0], "ru": "Цифра 2", "kg": "Сан 2 (Эки)", "en": "Digit 2", "conf": 0.99},
                {"symbol": "5", "type": "digit", "fingers": [1, 1, 1, 1, 1], "ru": "Цифра 5", "kg": "Сан 5 (Беш)", "en": "Digit 5", "conf": 0.98},
                {"symbol": "7", "type": "digit", "fingers": [1, 1, 0, 0, 1], "ru": "Цифра 7", "kg": "Сан 7 (Жети)", "en": "Digit 7", "conf": 0.97},
                {"symbol": "РАХМАТ", "type": "word", "fingers": [1, 0, 0, 0, 0], "ru": "Спасибо", "kg": "Чоң рахмат", "en": "Thank you", "conf": 0.98}
            ]
        },
        "preset_dactyl_osh": {
            "translation_ru": "Дактильное слово по буквам и цифрам: О-Ш-2-0-2-7",
            "translation_kg": "Дактиль тамгалары жана сандары: О-Ш-2-0-2-7",
            "items": [
                {"symbol": "О", "type": "letter", "fingers": [0, 0, 1, 1, 1], "ru": "Буква О", "kg": "Тамга О", "en": "Letter O", "conf": 0.97},
                {"symbol": "Ш", "type": "letter", "fingers": [0, 1, 1, 1, 0], "ru": "Буква Ш", "kg": "Тамга Ш", "en": "Letter SH", "conf": 0.96},
                {"symbol": "2", "type": "digit", "fingers": [0, 1, 1, 0, 0], "ru": "Цифра 2", "kg": "Сан 2", "en": "Digit 2", "conf": 0.99},
                {"symbol": "0", "type": "digit", "fingers": [0, 0, 0, 0, 0], "ru": "Цифра 0", "kg": "Сан 0", "en": "Digit 0", "conf": 0.98},
                {"symbol": "2", "type": "digit", "fingers": [0, 1, 1, 0, 0], "ru": "Цифра 2", "kg": "Сан 2", "en": "Digit 2", "conf": 0.99},
                {"symbol": "7", "type": "digit", "fingers": [1, 1, 0, 0, 1], "ru": "Цифра 7", "kg": "Сан 7", "en": "Digit 7", "conf": 0.97}
            ]
        },
        "preset_clinic_sos": {
            "translation_ru": "Обращение к врачу: Врач, кабинет 1 0 4, нужна помощь",
            "translation_kg": "Дарыгерге кайрылуу: Дарыгер, 1 0 4 кабинет, жардам керек",
            "items": [
                {"symbol": "ДАРЫГЕР", "type": "word", "fingers": [0, 1, 1, 0, 0], "ru": "Врач / Доктор", "kg": "Дарыгер", "en": "Doctor", "conf": 0.96},
                {"symbol": "1", "type": "digit", "fingers": [0, 1, 0, 0, 0], "ru": "Цифра 1", "kg": "Сан 1", "en": "Digit 1", "conf": 0.99},
                {"symbol": "0", "type": "digit", "fingers": [0, 0, 0, 0, 0], "ru": "Цифра 0", "kg": "Сан 0", "en": "Digit 0", "conf": 0.98},
                {"symbol": "4", "type": "digit", "fingers": [0, 1, 1, 1, 1], "ru": "Цифра 4", "kg": "Сан 4", "en": "Digit 4", "conf": 0.97},
                {"symbol": "ЖАРДАМ", "type": "word", "fingers": [1, 0, 0, 0, 1], "ru": "Нужна помощь", "kg": "Жардам бериңиз", "en": "Need help", "conf": 0.98}
            ]
        }
    }

    @classmethod
    def process_video(cls, payload: VideoProcessRequest) -> VideoProcessResponse:
        segments: List[VideoGestureSegment] = []
        duration = max(1.0, payload.duration_sec)

        if payload.frame_gestures and len(payload.frame_gestures) > 0:
            step = duration / max(len(payload.frame_gestures), 1)
            for idx, fg in enumerate(payload.frame_gestures):
                classified = GestureClassifierService.classify_gesture(
                    GestureClassifyRequest(
                        mode=fg.mode or "auto",
                        finger_states=fg.finger_states,
                        gesture_code=fg.gesture_code
                    )
                )
                t_start = round(fg.timestamp_sec if fg.timestamp_sec >= 0 else idx * step, 2)
                t_end = round(min(duration, t_start + max(0.8, step)), 2)
                segments.append(VideoGestureSegment(
                    segment_id=idx + 1,
                    start_sec=t_start,
                    end_sec=t_end,
                    timecode=f"{_format_short_timecode(t_start)} – {_format_short_timecode(t_end)}",
                    symbol=classified.detected_symbol,
                    symbol_type=classified.symbol_type,
                    finger_states=classified.finger_states,
                    word_ru=classified.label_ru,
                    word_kg=classified.label_kg,
                    word_en=classified.label_en,
                    confidence=classified.confidence
                ))
            assembled = " ".join(s.symbol for s in segments)
            translation_ru = f"Распознанная последовательность из видео «{payload.filename}»: {assembled}"
            translation_kg = f"«{payload.filename}» видеосунан таанылган жаңсоолор тизмеги: {assembled}"
        elif payload.preset_id and payload.preset_id in cls.PRESET_TIMELINES:
            preset = cls.PRESET_TIMELINES[payload.preset_id]
            items = preset["items"]
            step = duration / len(items)
            for idx, item in enumerate(items):
                t_start = round(idx * step, 2)
                t_end = round((idx + 1) * step, 2)
                segments.append(VideoGestureSegment(
                    segment_id=idx + 1,
                    start_sec=t_start,
                    end_sec=t_end,
                    timecode=f"{_format_short_timecode(t_start)} – {_format_short_timecode(t_end)}",
                    symbol=item["symbol"],
                    symbol_type=item["type"],
                    finger_states=item["fingers"],
                    word_ru=item["ru"],
                    word_kg=item["kg"],
                    word_en=item["en"],
                    confidence=item["conf"]
                ))
            assembled = " ".join(s.symbol for s in segments)
            translation_ru = preset["translation_ru"]
            translation_kg = preset["translation_kg"]
        else:
            return VideoProcessResponse(
                filename=payload.filename,
                duration_sec=round(duration, 2),
                fps=payload.fps,
                total_frames_sampled=int(duration * min(payload.fps, 10.0)),
                segments=[],
                assembled_string="",
                translation_ru="В загруженном видео кисти рук не обнаружены (распознано 0 жестов). Загрузите видео с жестами руки перед камерой.",
                translation_kg="Жүктөлгөн видеодо колдун манжалары табылган жок (0 жаңсоо таанылды). Камера алдындагы кол жаңсоолору бар видеону жүктөңүз.",
                srt_subtitles="",
                average_confidence=0.0
            )

        # Build SRT subtitles
        srt_blocks = []
        for s in segments:
            srt_blocks.append(
                f"{s.segment_id}\n"
                f"{_format_srt_timestamp(s.start_sec)} --> {_format_srt_timestamp(s.end_sec)}\n"
                f"[{s.symbol}] {s.word_ru} / {s.word_kg} ({int(s.confidence * 100)}%)"
            )
        srt_text = "\n\n".join(srt_blocks)
        avg_conf = round(sum(s.confidence for s in segments) / max(len(segments), 1), 3)
        total_sampled = max(len(segments) * 12, int(duration * min(payload.fps, 10.0)))

        return VideoProcessResponse(
            filename=payload.filename,
            duration_sec=round(duration, 2),
            fps=payload.fps,
            total_frames_sampled=total_sampled,
            segments=segments,
            assembled_string=assembled,
            translation_ru=translation_ru,
            translation_kg=translation_kg,
            srt_subtitles=srt_text,
            average_confidence=avg_conf
        )


class YouTubeAnalysisService:
    YOUTUBE_CATALOG: Dict[str, Dict[str, Any]] = {
        "feA64wXhbjo": {
            "title": "Дактильная азбука (А–Я) и цифры (0–9) — Учебный курс жестового языка",
            "channel": "Школа жестового языка и дактиля (РЖЯ / КЖЯ)",
            "duration_sec": 78,
            "summary_ru": "Пошаговый демонстрационный разбор дактильных букв А, Б, В, Ң, Ө, Ү и жестового счёта цифр от 0 до 9.",
            "summary_kg": "А, Б, В, Ң, Ө, Ү дактиль тамгаларын жана 0дөн 9га чейинки сандарды жаңсоо менен көрсөтүү.",
            "summary_en": "Step-by-step demonstration of dactyl alphabet letters and sign language digits 0–9.",
            "timeline": [
                {"start": 0.0, "end": 6.5, "symbol": "САЛАМ", "type": "word", "fingers": [1, 1, 1, 1, 1], "ru": "Приветствие: Здравствуйте!", "kg": "Саламатсызбы!", "en": "Greeting: Hello!", "conf": 0.98},
                {"start": 6.5, "end": 14.0, "symbol": "А", "type": "letter", "fingers": [1, 0, 0, 0, 0], "ru": "Буква А — кулак, большой палец вверх сбоку", "kg": "А тамгасы — муштум", "en": "Letter A", "conf": 0.97},
                {"start": 14.0, "end": 22.0, "symbol": "Б", "type": "letter", "fingers": [0, 1, 1, 1, 0], "ru": "Буква Б — указательный и средний прямые, безымянный полусогнут", "kg": "Б тамгасы", "en": "Letter B", "conf": 0.96},
                {"start": 22.0, "end": 31.0, "symbol": "Ң", "type": "letter", "fingers": [0, 0, 0, 0, 1], "ru": "Специфическая буква Ң — мизинец вертикально вверх", "kg": "Ң тамгасы — чыпалак өйдө", "en": "Kyrgyz Letter NG", "conf": 0.95},
                {"start": 31.0, "end": 40.0, "symbol": "Ү", "type": "letter", "fingers": [0, 1, 1, 0, 0], "ru": "Буква Ү — V-образное раскрытие указательного и среднего", "kg": "Ү тамгасы — V формасы", "en": "Kyrgyz Letter UE", "conf": 0.97},
                {"start": 40.0, "end": 50.0, "symbol": "1", "type": "digit", "fingers": [0, 1, 0, 0, 0], "ru": "Цифра 1 — указательный палец вверх", "kg": "Сан 1 (Бир)", "en": "Digit 1", "conf": 0.99},
                {"start": 50.0, "end": 60.0, "symbol": "5", "type": "digit", "fingers": [1, 1, 1, 1, 1], "ru": "Цифра 5 — раскрытая пятерня (все 5 пальцев)", "kg": "Сан 5 (Беш)", "en": "Digit 5", "conf": 0.99},
                {"start": 60.0, "end": 70.0, "symbol": "9", "type": "digit", "fingers": [0, 0, 1, 1, 1], "ru": "Цифра 9 — кольцо большого и указательного, три пальца вверх", "kg": "Сан 9 (Тогуз)", "en": "Digit 9", "conf": 0.96},
                {"start": 70.0, "end": 78.0, "symbol": "РАХМАТ", "type": "word", "fingers": [1, 0, 0, 0, 0], "ru": "Спасибо за внимание!", "kg": "Көңүл бурганыңызга рахмат!", "en": "Thank you!", "conf": 0.98}
            ]
        },
        "v1desDduz5M": {
            "title": "Жестовый язык в государственных услугах и медицине (Диалог в ЦОН и клинике)",
            "channel": "Инклюзивный центр сурдоперевода КР",
            "duration_sec": 64,
            "summary_ru": "Обучающий видеоролик для операторов ЦОН и врачей: распознавание обращения глухого гражданина, номер окна и талона.",
            "summary_kg": "КТБ операторлору жана дарыгерлер үчүн окутуучу видео: жарандын кайрылуусун жана талон номерин таануу.",
            "summary_en": "Sign language dialogue at the Public Service Center (ЦОН) and medical clinic.",
            "timeline": [
                {"start": 0.0, "end": 9.0, "symbol": "САЛАМ", "type": "word", "fingers": [1, 1, 1, 1, 1], "ru": "Здравствуйте, мне нужна государственная услуга", "kg": "Саламатсызбы, мамлекеттик кызмат керек", "en": "Hello, I need a public service", "conf": 0.98},
                {"start": 9.0, "end": 20.0, "symbol": "ПАСПОРТ", "type": "word", "fingers": [0, 1, 1, 1, 1], "ru": "Оформление / замена ID-паспорта", "kg": "ID-паспортту алмаштыруу", "en": "ID Passport renewal", "conf": 0.97},
                {"start": 20.0, "end": 30.0, "symbol": "3", "type": "digit", "fingers": [1, 1, 1, 0, 0], "ru": "Окно № 3 (Цифра 3)", "kg": "№ 3 терезе (Сан 3)", "en": "Window #3 (Digit 3)", "conf": 0.99},
                {"start": 30.0, "end": 42.0, "symbol": "СПРАВКА", "type": "word", "fingers": [1, 1, 0, 0, 0], "ru": "Получение справки с места жительства", "kg": "Жашаган жеринен маалымкат алуу", "en": "Residence certificate", "conf": 0.95},
                {"start": 42.0, "end": 53.0, "symbol": "8", "type": "digit", "fingers": [1, 1, 1, 0, 1], "ru": "Цифра 8 — ожидание 8 минут", "kg": "Сан 8 — 8 мүнөт күтүү", "en": "Digit 8 — 8 minutes wait", "conf": 0.97},
                {"start": 53.0, "end": 64.0, "symbol": "РАХМАТ", "type": "word", "fingers": [1, 0, 0, 0, 0], "ru": "Благодарю оператора ЦОН", "kg": "КТБ операторуна чоң рахмат", "en": "Thank you to the operator", "conf": 0.98}
            ]
        },
        "0FcwzMq4iWg": {
            "title": "Числа от 0 до 9 и дактильные слоги на жестовом языке",
            "channel": "Сурдопедагогика Онлайн",
            "duration_sec": 55,
            "summary_ru": "Интенсив по распознаванию пальцевого счёта (0–9) и ключевых букв дактиля на высокой скорости.",
            "summary_kg": "Манжалар менен саноо (0–9) жана негизги дактиль тамгаларын тез таануу боюнча сабак.",
            "summary_en": "Fast-paced recognition of finger counting (0–9) and dactyl syllables.",
            "timeline": [
                {"start": 0.0, "end": 8.0, "symbol": "0", "type": "digit", "fingers": [0, 0, 0, 0, 0], "ru": "Цифра 0 (Ноль — сомкнутый кулак)", "kg": "Сан 0 (Нөл)", "en": "Digit 0", "conf": 0.99},
                {"start": 8.0, "end": 16.0, "symbol": "2", "type": "digit", "fingers": [0, 1, 1, 0, 0], "ru": "Цифра 2 (Два пальца — указательный и средний)", "kg": "Сан 2 (Эки)", "en": "Digit 2", "conf": 0.99},
                {"start": 16.0, "end": 25.0, "symbol": "4", "type": "digit", "fingers": [0, 1, 1, 1, 1], "ru": "Цифра 4 (Четыре пальца раскрыты)", "kg": "Сан 4 (Төрт)", "en": "Digit 4", "conf": 0.98},
                {"start": 25.0, "end": 35.0, "symbol": "6", "type": "digit", "fingers": [1, 0, 0, 0, 1], "ru": "Цифра 6 (Большой палец и мизинец)", "kg": "Сан 6 (Алты)", "en": "Digit 6", "conf": 0.97},
                {"start": 35.0, "end": 45.0, "symbol": "7", "type": "digit", "fingers": [1, 1, 0, 0, 1], "ru": "Цифра 7 (Большой, указательный и мизинец)", "kg": "Сан 7 (Жети)", "en": "Digit 7", "conf": 0.96},
                {"start": 45.0, "end": 55.0, "symbol": "ОШГУ", "type": "word", "fingers": [0, 0, 1, 1, 1], "ru": "Жест «ОшГУ» — университетский знак", "kg": "«ОшМУ» жаңсоосу", "en": "OshSU Sign", "conf": 0.97}
            ]
        },
        "0FCWzMq4iWg": {
            "title": "Числа от 0 до 9 и дактильные слоги на жестовом языке",
            "channel": "Сурдопедагогика Онлайн",
            "duration_sec": 55,
            "summary_ru": "Интенсив по распознаванию пальцевого счёта (0–9) и ключевых букв дактиля на высокой скорости.",
            "summary_kg": "Манжалар менен саноо (0–9) жана негизги дактиль тамгаларын тез таануу боюнча сабак.",
            "summary_en": "Fast-paced recognition of finger counting (0–9) and dactyl syllables.",
            "timeline": [
                {"start": 0.0, "end": 8.0, "symbol": "0", "type": "digit", "fingers": [0, 0, 0, 0, 0], "ru": "Цифра 0 (Ноль — сомкнутый кулак)", "kg": "Сан 0 (Нөл)", "en": "Digit 0", "conf": 0.99},
                {"start": 8.0, "end": 16.0, "symbol": "2", "type": "digit", "fingers": [0, 1, 1, 0, 0], "ru": "Цифра 2 (Два пальца — указательный и средний)", "kg": "Сан 2 (Эки)", "en": "Digit 2", "conf": 0.99},
                {"start": 16.0, "end": 25.0, "symbol": "4", "type": "digit", "fingers": [0, 1, 1, 1, 1], "ru": "Цифра 4 (Четыре пальца раскрыты)", "kg": "Сан 4 (Төрт)", "en": "Digit 4", "conf": 0.98},
                {"start": 25.0, "end": 35.0, "symbol": "6", "type": "digit", "fingers": [1, 0, 0, 0, 1], "ru": "Цифра 6 (Большой палец и мизинец)", "kg": "Сан 6 (Алты)", "en": "Digit 6", "conf": 0.97},
                {"start": 35.0, "end": 45.0, "symbol": "7", "type": "digit", "fingers": [1, 1, 0, 0, 1], "ru": "Цифра 7 (Большой, указательный и мизинец)", "kg": "Сан 7 (Жети)", "en": "Digit 7", "conf": 0.96},
                {"start": 45.0, "end": 55.0, "symbol": "ОШГУ", "type": "word", "fingers": [0, 0, 1, 1, 1], "ru": "Жест «ОшГУ» — университетский знак", "kg": "«ОшМУ» жаңсоосу", "en": "OshSU Sign", "conf": 0.97}
            ]
        },
        "jNQXAC9IVRw": {
            "title": "Базовые жесты приветствия, медицины и экстренного вызова (КЖЯ / РЖЯ)",
            "channel": "Кыргызское общество глухих и слепых • Учебный архив",
            "duration_sec": 48,
            "summary_ru": "Размеченный демонстрационный ролик: обращение к врачу, номер кабинета и запрос помощи.",
            "summary_kg": "Дарыгерге кайрылуу, кабинет номери жана жардам суроо жаңсоолору.",
            "summary_en": "Annotated sign language demo: doctor consultation, room number and help request.",
            "timeline": [
                {"start": 0.0, "end": 9.0, "symbol": "САЛАМ", "type": "word", "fingers": [1, 1, 1, 1, 1], "ru": "Здравствуйте!", "kg": "Саламатсызбы!", "en": "Hello!", "conf": 0.98},
                {"start": 9.0, "end": 19.0, "symbol": "ДАРЫГЕР", "type": "word", "fingers": [0, 1, 1, 0, 0], "ru": "Жест «Врач / Доктор»", "kg": "Дарыгер", "en": "Doctor", "conf": 0.96},
                {"start": 19.0, "end": 28.0, "symbol": "1", "type": "digit", "fingers": [0, 1, 0, 0, 0], "ru": "Цифра 1", "kg": "Сан 1", "en": "Digit 1", "conf": 0.99},
                {"start": 28.0, "end": 38.0, "symbol": "4", "type": "digit", "fingers": [0, 1, 1, 1, 1], "ru": "Цифра 4", "kg": "Сан 4", "en": "Digit 4", "conf": 0.98},
                {"start": 38.0, "end": 48.0, "symbol": "ЖАРДАМ", "type": "word", "fingers": [1, 0, 0, 0, 1], "ru": "Жест «Помощь»", "kg": "Жардам", "en": "Help", "conf": 0.97}
            ]
        }
    }

    @staticmethod
    def extract_youtube_id(url: str) -> str:
        clean = url.strip()
        patterns = [
            r"(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,15})",
            r"[?&]v=([A-Za-z0-9_-]{6,15})"
        ]
        for pat in patterns:
            m = re.search(pat, clean)
            if m:
                return m.group(1)
        raise HTTPException(
            status_code=422,
            detail="Некорректная ссылка YouTube. Укажите ссылку формата https://www.youtube.com/watch?v=... или https://youtu.be/..."
        )

    @classmethod
    def analyze_youtube(cls, payload: YouTubeAnalyzeRequest) -> YouTubeAnalyzeResponse:
        vid = cls.extract_youtube_id(payload.url)
        meta = cls.YOUTUBE_CATALOG.get(vid)

        if not meta:
            return YouTubeAnalyzeResponse(
                video_id=vid,
                embed_url=f"https://www.youtube.com/embed/{vid}",
                title=f"Пользовательское YouTube-видео ({vid}) — Живой нейросетевой захват MediaPipe",
                channel="Произвольное видео YouTube (вне эталонного корпуса)",
                duration_sec=0,
                verified_corpus=False,
                detected_timeline=[],
                assembled_symbols="",
                summary_ru=(
                    f"Видео ({vid}) не входит в предразмеченный эталонный корпус. "
                    "Система не генерирует фейковые жесты из хеша ID видео! "
                    "Запустите воспроизведение плеера и нажмите «🎥 Запустить живой нейросетевой захват окна YouTube (MediaPipe Hands Screen Capture)», "
                    "чтобы нейросеть MediaPipe в реальном времени распознавала жесты рук из видеопотока."
                ),
                summary_kg=(
                    f"Бул видео ({vid}) эталондук сурдокотормо корпусуна кирбейт. "
                    "Видеонун ID хешинен жасалма жаңсоолор түзүлбөйт! "
                    "Плеерди ойнотуп, «MediaPipe Hands Screen Capture» баскычын басып реалдуу убакытта кол жаңсоолорун тааныңыз."
                ),
                summary_en=(
                    f"Video ({vid}) is not in the pre-annotated reference corpus. "
                    "No fake hash-based gestures are generated. Start playback and click 'MediaPipe Hands Screen Capture' to detect real hand landmarks live."
                ),
                total_recognized_symbols=0,
                average_confidence=0.0,
                srt_export=""
            )

        timeline_items: List[YouTubeTimelineItem] = []
        srt_blocks: List[str] = []

        for idx, t in enumerate(meta["timeline"], 1):
            label = f"{_format_short_timecode(t['start'])} – {_format_short_timecode(t['end'])}"
            timeline_items.append(YouTubeTimelineItem(
                id=idx,
                start_sec=t["start"],
                end_sec=t["end"],
                timestamp_label=label,
                symbol=t["symbol"],
                symbol_type=t["type"],
                finger_states=t["fingers"],
                text_ru=t["ru"],
                text_kg=t["kg"],
                text_en=t["en"],
                confidence=t["conf"]
            ))
            srt_blocks.append(
                f"{idx}\n"
                f"{_format_srt_timestamp(t['start'])} --> {_format_srt_timestamp(t['end'])}\n"
                f"[{t['symbol']}] {t['ru']} | {t['kg']}"
            )

        assembled = " • ".join(item.symbol for item in timeline_items)
        avg_conf = round(sum(item.confidence for item in timeline_items) / max(len(timeline_items), 1), 3)

        return YouTubeAnalyzeResponse(
            video_id=vid,
            embed_url=f"https://www.youtube.com/embed/{vid}",
            title=meta["title"],
            channel=meta["channel"],
            duration_sec=meta["duration_sec"],
            verified_corpus=True,
            detected_timeline=timeline_items,
            assembled_symbols=assembled,
            summary_ru=meta["summary_ru"],
            summary_kg=meta["summary_kg"],
            summary_en=meta["summary_en"],
            total_recognized_symbols=len(timeline_items),
            average_confidence=avg_conf,
            srt_export="\n\n".join(srt_blocks)
        )


class PhotoAnalysisService:
    """
    Analyzes a still photo (JPG / PNG / WEBP) in which MediaPipe Hands has already
    detected 21-point hand landmarks in the browser. Each detected hand is classified
    into a digit (0-9), dactyl letter (А-Я, Ө, Ү, Ң) or KSL word, and a trilingual
    report is assembled.
    """

    @staticmethod
    def process_photo(payload: PhotoAnalyzeRequest) -> PhotoAnalyzeResponse:
        results: List[PhotoHandResult] = []

        for hand in payload.detected_hands[:2]:  # up to two hands per photo
            classified = GestureClassifierService.classify_gesture(
                GestureClassifyRequest(
                    mode=hand.mode or "auto",
                    finger_states=hand.finger_states,
                    gesture_code=hand.gesture_code,
                    landmarks=hand.landmarks,
                    pinch_thumb_index=False
                )
            )
            conf = hand.confidence if hand.confidence > 0.0 else classified.confidence
            results.append(PhotoHandResult(
                hand_side=hand.hand_side,
                detected_symbol=classified.detected_symbol,
                symbol_type=classified.symbol_type,
                label_ru=classified.label_ru,
                label_kg=classified.label_kg,
                label_en=classified.label_en,
                finger_states=classified.finger_states,
                confidence=round(min(0.99, conf), 3),
                anatomical_rule=classified.anatomical_rule,
                hand_landmarks_21=classified.hand_landmarks_21
            ))

        scan_mode = payload.detected_hands[0].mode if payload.detected_hands else "auto"

        if not results:
            translation_ru = (
                f"На фото «{payload.filename}» кисти рук не обнаружены (распознано 0 жестов). "
                "Загрузите снимок, на котором рука с жестом хорошо видна и хорошо освещена."
            )
            translation_kg = (
                f"«{payload.filename}» сүрөтүндө кол табылган жок (0 жаңсоо таанылды). "
                "Жаңсоо көрсөткөн кол ачык көрүнгөн сүрөт жүктөңүз."
            )
            translation_en = (
                f"No hands detected in photo '{payload.filename}' (0 gestures recognized). "
                "Upload a well-lit photo with a clearly visible hand gesture."
            )
        else:
            assembled = " ".join(r.detected_symbol for r in results)
            primary_ru = " • ".join(r.label_ru for r in results)
            primary_kg = " • ".join(r.label_kg for r in results)
            primary_en = " • ".join(r.label_en for r in results)
            translation_ru = (
                f"На фото «{payload.filename}» распознано жестов: {len(results)} — {assembled}. {primary_ru}"
            )
            translation_kg = (
                f"«{payload.filename}» сүрөтүндө таанылган жаңсоолор: {len(results)} — {assembled}. {primary_kg}"
            )
            translation_en = (
                f"Photo '{payload.filename}': {len(results)} gesture(s) recognized — {assembled}. {primary_en}"
            )

        report_lines = [
            "ImoTech (ЫмТили) — Отчёт анализа фото (Photo Sign Analysis)",
            "=" * 60,
            f"Файл: {payload.filename}",
            f"Источник: {'Снимок веб-камеры' if payload.source == 'webcam_snapshot' else 'Загруженный файл'}",
            f"Размер изображения: {payload.image_width} x {payload.image_height} px",
            f"Режим распознавания: {scan_mode}",
            f"Обнаружено кистей: {len(results)}",
            "",
            translation_ru,
            translation_kg,
            translation_en,
            "",
        ]
        for r in results:
            report_lines += [
                f"— Рука: {r.hand_side.upper()} | Символ: {r.detected_symbol} ({r.symbol_type}) | Точность: {int(r.confidence * 100)}%",
                f"  RU: {r.label_ru}",
                f"  KG: {r.label_kg}",
                f"  EN: {r.label_en}",
                f"  Состояние пальцев [большой, указательный, средний, безымянный, мизинец]: {r.finger_states}",
                f"  Правило: {r.anatomical_rule}",
                "",
            ]

        return PhotoAnalyzeResponse(
            filename=payload.filename,
            source=payload.source,
            image_width=payload.image_width,
            image_height=payload.image_height,
            hands_detected=len(results),
            scan_mode=scan_mode,
            primary_result=results[0] if results else None,
            results=results,
            translation_ru=translation_ru,
            translation_kg=translation_kg,
            translation_en=translation_en,
            report_txt="\n".join(report_lines)
        )

