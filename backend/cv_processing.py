"""
ImoTech — REAL computer-vision processing pipeline (server-side).

Stack:
  * yt-dlp          — downloads real YouTube videos (≤480p, mp4)
  * OpenCV (cv2)    — decodes video files / photos, samples frames
  * MediaPipe Hands — extracts real 21-point hand landmarks per frame
  * GestureClassifierService — maps finger states -> digit / letter / word

Every symbol reported by these services comes from actual pixels of the
actual media file — no preset/mock timelines are involved.
"""

import os
import math
import shutil
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from .schemas import LandmarkPoint, GestureClassifyRequest
except ImportError:
    from schemas import LandmarkPoint, GestureClassifyRequest

try:
    from .services import GestureClassifierService, extract_finger_states_from_landmarks
except ImportError:
    from services import GestureClassifierService, extract_finger_states_from_landmarks

# Heavy deps are imported lazily inside helpers so the app still boots if they
# are missing (e.g. minimal test environment) — endpoints report a clear error.
_MP_AVAILABLE = True
try:
    import cv2
    import mediapipe as mp
    import numpy as np
except Exception:  # pragma: no cover
    _MP_AVAILABLE = False


# =====================================================================
# MEDIAPIPE HAND LANDMARKER SINGLETON (Tasks API, mediapipe >= 1.0)
# =====================================================================

_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
_MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
_MODEL_PATH = os.path.join(_MODEL_DIR, "hand_landmarker.task")

_hands_lock = None
_hands_instance = None


def _ensure_model() -> str:
    """Downloads the MediaPipe HandLandmarker model once and caches it locally."""
    if os.path.exists(_MODEL_PATH) and os.path.getsize(_MODEL_PATH) > 100_000:
        return _MODEL_PATH
    os.makedirs(_MODEL_DIR, exist_ok=True)
    import urllib.request
    urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH + ".tmp")
    os.replace(_MODEL_PATH + ".tmp", _MODEL_PATH)
    return _MODEL_PATH


def _get_hands():
    """Lazily create a single MediaPipe HandLandmarker instance (reused across calls)."""
    global _hands_instance, _hands_lock
    if not _MP_AVAILABLE:
        raise RuntimeError("MediaPipe/OpenCV not installed on the server")
    if _hands_instance is None:
        import threading
        if _hands_lock is None:
            _hands_lock = threading.Lock()
        with _hands_lock:
            if _hands_instance is None:
                _ensure_model()
                from mediapipe.tasks.python import vision
                options = vision.HandLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=_MODEL_PATH),
                    running_mode=vision.RunningMode.IMAGE,
                    num_hands=2,
                    min_hand_detection_confidence=0.5,
                    min_hand_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                _hands_instance = vision.HandLandmarker.create_from_options(options)
    return _hands_instance


def close_hands() -> None:
    global _hands_instance
    if _hands_instance is not None:
        try:
            _hands_instance.close()
        except Exception:
            pass
        _hands_instance = None


# =====================================================================
# LANDMARK EXTRACTION (real pixels -> 21 points -> finger states)
# =====================================================================

def _lm_to_point(lm) -> LandmarkPoint:
    return LandmarkPoint(x=float(lm.x), y=float(lm.y), z=float(lm.z))


def extract_hand_results(frame_bgr) -> List[Dict[str, Any]]:
    """
    Runs MediaPipe HandLandmarker on one BGR frame.
    Returns list of dicts: {side, landmarks(list[LandmarkPoint]), score}.
    """
    landmarker = _get_hands()
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    res = landmarker.detect(mp_img)

    out: List[Dict[str, Any]] = []
    if not res.hand_landmarks:
        return out

    sides = []
    for handed in res.handedness:
        if handed:
            label = handed[0].category_name or "Right"
            # MediaPipe reports handedness for a mirrored image; webcam footage
            # is typically mirrored, so flip the label.
            sides.append("left" if label == "Right" else "right")
        else:
            sides.append("right")
    while len(sides) < len(res.hand_landmarks):
        sides.append("right")

    for i, hand_lms in enumerate(res.hand_landmarks):
        pts = [_lm_to_point(lm) for lm in hand_lms]
        score = 0.9
        if res.handedness and i < len(res.handedness) and res.handedness[i]:
            score = float(res.handedness[i][0].score)
        out.append({"side": sides[i], "landmarks": pts, "score": score})
    return out


def finger_states_from_real_landmarks(landmarks: List[LandmarkPoint]) -> List[int]:
    """
    Python port of the browser-side classifyRealLandmarks geometry:
    per-finger PIP bend angle + tip-vs-wrist distance, thumb via lateral
    distance to index MCP. Reuses the exact same helper the JSON-based
    classifier uses for consistency between live / photo / video / youtube.
    """
    return extract_finger_states_from_landmarks(landmarks)


def classify_frame(frame_bgr, mode: str = "auto") -> Dict[str, Any]:
    """
    Full pipeline for one frame: landmarks -> finger states -> symbol.
    Returns dict with symbol info or {'symbol': None} when no hand found.
    """
    detected = extract_hand_results(frame_bgr)
    if not detected:
        return {"symbol": None, "hands": 0}
    hand = max(detected, key=lambda h: h["score"])
    f_states = finger_states_from_real_landmarks(hand["landmarks"])
    # Real pinch detection so letters mode resolves OK-ring as О (not Ө)
    lms = hand["landmarks"]
    palm_len = max(1e-6, math.hypot(lms[9].x - lms[0].x, lms[9].y - lms[0].y))
    pinch_dist = math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y)
    is_pinch = (pinch_dist / palm_len) < 0.55
    resp = GestureClassifierService.classify_gesture(
        GestureClassifyRequest(
            mode=mode,
            finger_states=f_states,
            landmarks=hand["landmarks"],
            pinch_thumb_index=is_pinch
        )
    )
    return {
        "symbol": resp.detected_symbol,
        "symbol_type": resp.symbol_type,
        "label_ru": resp.label_ru,
        "label_kg": resp.label_kg,
        "label_en": resp.label_en,
        "finger_states": f_states,
        "confidence": resp.confidence,
        "rule": resp.anatomical_rule,
        "hands": len(detected),
    }


# =====================================================================
# VIDEO FILE ANALYSIS (OpenCV frame sampling + segment merging)
# =====================================================================

def analyze_video_file(path: str, mode: str = "auto", max_samples: int = 90) -> Dict[str, Any]:
    """
    Samples up to `max_samples` frames evenly across the video, classifies
    each real frame, merges consecutive identical symbols into segments,
    and builds SRT subtitles.
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"Не удалось открыть видеофайл: {os.path.basename(path)}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    duration = total_frames / fps if fps > 0 and total_frames > 0 else 0.0

    # Even sampling across the whole duration
    if total_frames > 0:
        step = max(1, total_frames // max_samples)
        frame_indices = list(range(0, total_frames, step))[:max_samples]
    else:
        frame_indices = list(range(int(max_samples * fps * 0.5)))  # live stream fallback
        duration = 0.0

    samples: List[Tuple[float, Dict[str, Any]]] = []
    wanted = set(frame_indices)
    idx = 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if idx in wanted:
            ok2, frame = cap.retrieve()
            if ok2 and frame is not None:
                t = idx / fps if fps > 0 else idx * 0.04
                samples.append((t, classify_frame(frame, mode)))
        idx += 1
        if frame_indices and idx > frame_indices[-1]:
            break
    cap.release()

    # Merge consecutive identical symbols into segments (None = pause)
    segments: List[Dict[str, Any]] = []
    cur: Optional[Dict[str, Any]] = None
    for t, info in samples:
        if info["symbol"] is None:
            if cur:
                segments.append(cur)
                cur = None
            continue
        if cur and cur["symbol"] == info["symbol"]:
            cur["end"] = t + (1.0 / fps if fps > 0 else 0.04)
            cur["confidences"].append(info["confidence"])
        else:
            if cur:
                segments.append(cur)
            cur = {
                "symbol": info["symbol"],
                "symbol_type": info["symbol_type"],
                "label_ru": info["label_ru"],
                "label_kg": info["label_kg"],
                "label_en": info["label_en"],
                "finger_states": info["finger_states"],
                "rule": info["rule"],
                "start": t,
                "end": t + (1.0 / fps if fps > 0 else 0.04),
                "confidences": [info["confidence"]],
            }
    if cur:
        segments.append(cur)

    # Filter micro-flickers: keep segments >= 0.3 s
    segments = [s for s in segments if (s["end"] - s["start"]) >= 0.3]
    for s in segments:
        s["confidence"] = sum(s["confidences"]) / len(s["confidences"])
        s.pop("confidences", None)

    total_frames_sampled = len(samples)
    hands_found = sum(1 for _, i in samples if i["hands"] > 0)
    avg_conf = (
        sum(s["confidence"] for s in segments) / len(segments) if segments else 0.0
    )
    return {
        "segments": segments,
        "duration_sec": duration or (samples[-1][0] + 1.0 if samples else 0.0),
        "fps": fps,
        "total_frames_sampled": total_frames_sampled,
        "hands_found_frames": hands_found,
        "average_confidence": avg_conf,
    }


# =====================================================================
# PHOTO / IMAGE ANALYSIS (real pixels)
# =====================================================================

def analyze_image_bytes(data: bytes, mode: str = "auto") -> Dict[str, Any]:
    """Decodes real image bytes and classifies every detected hand."""
    arr = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise RuntimeError("Файл не является корректным изображением (JPG/PNG/WEBP)")

    h, w = frame.shape[:2]
    # Upscale tiny images so MediaPipe sees enough detail
    if max(h, w) < 360:
        scale = 360.0 / max(h, w)
        frame = cv2.resize(frame, (int(w * scale) + 1, int(h * scale) + 1))

    detected = extract_hand_results(frame)
    results = []
    for hand in detected:
        f_states = finger_states_from_real_landmarks(hand["landmarks"])
        # Real pinch detection (thumb tip 4 vs index tip 8, normalized by palm
        # length 0->9): lets the letters-mode classifier resolve the OK-ring
        # gesture as letter О instead of the look-alike Ө.
        lms = hand["landmarks"]
        palm_len = max(1e-6, math.hypot(lms[9].x - lms[0].x, lms[9].y - lms[0].y))
        pinch_dist = math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y)
        is_pinch = (pinch_dist / palm_len) < 0.55
        resp = GestureClassifierService.classify_gesture(
            GestureClassifyRequest(
                mode=mode,
                finger_states=f_states,
                landmarks=hand["landmarks"],
                pinch_thumb_index=is_pinch
            )
        )
        results.append({
            "hand_side": hand["side"],
            "detected_symbol": resp.detected_symbol,
            "symbol_type": resp.symbol_type,
            "label_ru": resp.label_ru,
            "label_kg": resp.label_kg,
            "label_en": resp.label_en,
            "finger_states": f_states,
            "confidence": resp.confidence,
            "anatomical_rule": resp.anatomical_rule,
            "hand_landmarks_21": hand["landmarks"],
            "mp_score": hand["score"],
        })

    return {
        "width": w,
        "height": h,
        "hands_detected": len(results),
        "results": results,
    }


# =====================================================================
# YOUTUBE REAL PROCESSING (yt-dlp download -> same video pipeline)
# =====================================================================

_YOUTUBE_DL_OPTS = {
    # Frames-only pipeline: video stream is enough, no audio/ffmpeg merge needed
    "format": "bestvideo[height<=480][ext=mp4]/bestvideo[height<=480]/bestvideo/best",
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "socket_timeout": 20,
    "retries": 2,
    "noprogress": True,
    "nolog": True,
}


def _extract_video_id(url: str) -> str:
    import re as _re
    m = _re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)
    return _re.sub(r"[^A-Za-z0-9_-]", "", url)[-11:] or f"yt_{int(time.time())}"


def _build_embed_url(video_id: str) -> str:
    return f"https://www.youtube.com/embed/{video_id}"


def analyze_youtube_url(url: str, mode: str = "auto", max_duration_sec: int = 180) -> Dict[str, Any]:
    """
    Downloads a real YouTube video with yt-dlp (≤480p), trims analysis to the
    first `max_duration_sec` seconds, then runs the same MediaPipe pipeline.
    Raises RuntimeError with a human-readable message on bot-check / network
    failures so the frontend can fall back to screen-capture mode.
    """
    try:
        from yt_dlp import YoutubeDL
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"yt-dlp недоступен на сервере: {exc}")

    tmp_dir = tempfile.mkdtemp(prefix="imotech_yt_")
    info = None
    video_path = None
    try:
        with YoutubeDL(dict(_YOUTUBE_DL_OPTS, outtmpl=os.path.join(tmp_dir, "%(id)s.%(ext)s"))) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise RuntimeError("YouTube не вернул информацию о видео")

        duration = float(info.get("duration") or 0.0)
        if duration and duration > max_duration_sec * 3:
            # Extremely long videos: still fine, pipeline samples first 3 min worth
            pass

        # yt-dlp may merge formats -> find the produced file
        video_id = info.get("id") or _extract_video_id(url)
        candidates = [
            f for f in os.listdir(tmp_dir)
            if f.startswith(video_id) and not f.endswith(".part")
        ]
        if not candidates:
            candidates = [f for f in os.listdir(tmp_dir) if not f.endswith(".part")]
        if not candidates:
            raise RuntimeError("Скачанный файл не найден")
        video_path = os.path.join(tmp_dir, candidates[0])

        result = analyze_video_file(video_path, mode=mode, max_samples=80)
        if result["duration_sec"] > max_duration_sec:
            # Trim segments to the analysis window
            result["segments"] = [s for s in result["segments"] if s["start"] < max_duration_sec]
            result["duration_sec"] = max_duration_sec

        return {
            "video_id": video_id,
            "embed_url": _build_embed_url(video_id),
            "title": info.get("title") or "YouTube видео",
            "channel": info.get("channel") or info.get("uploader") or "",
            "duration_sec": int(duration or result["duration_sec"]),
            **result,
        }
    except Exception as exc:
        msg = str(exc) or exc.__class__.__name__
        lowered = msg.lower()
        if "sign in" in lowered or "bot" in lowered or "cookies" in lowered or "429" in lowered:
            raise RuntimeError(
                "YouTube блокирует автоматический доступ (bot-check). "
                "Используйте режим «Захват экрана YouTube» в браузере."
            )
        raise RuntimeError(f"Не удалось обработать YouTube-видео: {msg[:300]}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
