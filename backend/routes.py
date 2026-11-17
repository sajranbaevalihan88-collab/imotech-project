import json
import os
from fastapi import APIRouter, HTTPException, Query, status, UploadFile, File, Form
from typing import List, Optional, Dict

try:
    from .schemas import (
        HealthResponse,
        StreamInferenceRequest,
        StreamInferenceResponse,
        SpeechToSignRequest,
        SpeechToSignResponse,
        DactylEvaluationRequest,
        DactylEvaluationResponse,
        DactylLetterReference,
        DictionaryItemResponse,
        GestureClassifyRequest,
        GestureClassifyResponse,
        VideoProcessRequest,
        VideoProcessResponse,
        VideoGestureSegment,
        YouTubeAnalyzeRequest,
        YouTubeAnalyzeResponse,
        YouTubeTimelineItem,
        PhotoAnalyzeRequest,
        PhotoAnalyzeResponse,
        PhotoHandResult,
        LandmarkPoint
    )
except ImportError:
    from schemas import (
        HealthResponse,
        StreamInferenceRequest,
        StreamInferenceResponse,
        SpeechToSignRequest,
        SpeechToSignResponse,
        DactylEvaluationRequest,
        DactylEvaluationResponse,
        DactylLetterReference,
        DictionaryItemResponse,
        GestureClassifyRequest,
        GestureClassifyResponse,
        VideoProcessRequest,
        VideoProcessResponse,
        VideoGestureSegment,
        YouTubeAnalyzeRequest,
        YouTubeAnalyzeResponse,
        YouTubeTimelineItem,
        PhotoAnalyzeRequest,
        PhotoAnalyzeResponse,
        PhotoHandResult,
        LandmarkPoint
    )
try:
    from .services import (
        GestureClassifierService,
        AvatarSynthesisService,
        DactylTutorService,
        VideoAnalysisService,
        YouTubeAnalysisService,
        PhotoAnalysisService,
        _format_short_timecode,
        _format_srt_timestamp
    )
except ImportError:
    from services import (
        GestureClassifierService,
        AvatarSynthesisService,
        DactylTutorService,
        VideoAnalysisService,
        YouTubeAnalysisService,
        PhotoAnalysisService,
        _format_short_timecode,
        _format_srt_timestamp
    )
try:
    from . import cv_processing
except ImportError:
    import cv_processing
try:
    from .database import get_connection
except ImportError:
    from database import get_connection

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", app="imotech", port=8010)

@router.post("/gestures/recognize", response_model=StreamInferenceResponse)
def recognize_gesture_stream(payload: StreamInferenceRequest):
    return GestureClassifierService.recognize_stream(payload.frames)

@router.post("/avatar/synthesize", response_model=SpeechToSignResponse)
def synthesize_avatar_animation(payload: SpeechToSignRequest):
    return AvatarSynthesisService.synthesize_avatar(payload.speech_text, payload.source_language)

@router.post("/dactyl/evaluate", response_model=DactylEvaluationResponse)
def evaluate_dactyl_gesture(payload: DactylEvaluationRequest):
    return DactylTutorService.evaluate_dactyl(payload.letter_char, payload.landmarks)

@router.get("/dactyl/letters", response_model=List[DactylLetterReference])
def get_dactyl_letters():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT letter_char, letter_name, difficulty_level, description_ky, target_angles, sample_image_url FROM dactyl_letters ORDER BY difficulty_level, letter_char")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append(DactylLetterReference(
            letter_char=r["letter_char"],
            letter_name=r["letter_name"],
            difficulty_level=r["difficulty_level"],
            description_ky=r["description_ky"],
            target_angles=json.loads(r["target_angles"]),
            sample_image_url=r["sample_image_url"]
        ))
    return result

@router.get("/dictionary/search", response_model=List[DictionaryItemResponse])
def search_sign_dictionary(
    query: Optional[str] = None,
    category: Optional[str] = None
):
    if hasattr(query, "default"):
        query = query.default
    if hasattr(category, "default"):
        category = category.default

    conn = get_connection()
    cursor = conn.cursor()

    sql = "SELECT id, gloss_ky, gloss_ru, category, description_ky, video_demonstration_url, is_two_handed, requires_facial_expression, duration_ms FROM sign_dictionary WHERE 1=1"
    params = []

    if category:
        sql += " AND category = ?"
        params.append(category)

    sql += " ORDER BY category, gloss_ky"
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()

    if query:
        q = query.strip().lower()
        rows = [
            r for r in rows
            if q in r["gloss_ky"].lower() or q in r["gloss_ru"].lower() or q in r["description_ky"].lower()
        ]

    return [
        DictionaryItemResponse(
            id=r["id"],
            gloss_ky=r["gloss_ky"],
            gloss_ru=r["gloss_ru"],
            category=r["category"],
            description_ky=r["description_ky"],
            video_demonstration_url=r["video_demonstration_url"],
            is_two_handed=bool(r["is_two_handed"]),
            requires_facial_expression=bool(r["requires_facial_expression"]),
            duration_ms=r["duration_ms"]
        )
        for r in rows
    ]

@router.post("/gesture/classify", response_model=GestureClassifyResponse)
def classify_single_gesture(payload: GestureClassifyRequest):
    return GestureClassifierService.classify_gesture(payload)

@router.post("/video/process", response_model=VideoProcessResponse)
def process_uploaded_video(payload: VideoProcessRequest):
    return VideoAnalysisService.process_video(payload)

@router.post("/youtube/analyze", response_model=YouTubeAnalyzeResponse)
def analyze_youtube_sign_video(payload: YouTubeAnalyzeRequest):
    return YouTubeAnalysisService.analyze_youtube(payload)

@router.post("/photo/analyze", response_model=PhotoAnalyzeResponse)
def analyze_uploaded_photo(payload: PhotoAnalyzeRequest):
    return PhotoAnalysisService.process_photo(payload)


# =====================================================================
# REAL SERVER-SIDE CV PROCESSING (yt-dlp + OpenCV + MediaPipe on pixels)
# =====================================================================

_ALLOWED_MODES = ("auto", "letters", "digits", "words")


def _norm_mode(mode: Optional[str]) -> str:
    return mode if mode in _ALLOWED_MODES else "auto"


def _build_srt(segments: List[Dict]) -> str:
    lines = []
    for i, s in enumerate(segments, 1):
        lines.append(str(i))
        lines.append(f"{_format_srt_timestamp(s['start'])} --> {_format_srt_timestamp(s['end'])}")
        lines.append(f"{s['symbol']} ({s['label_ru']})")
        lines.append("")
    return "\n".join(lines)


def _segments_to_video_response(filename: str, result: Dict) -> VideoProcessResponse:
    segments = [
        VideoGestureSegment(
            segment_id=i + 1,
            start_sec=round(s["start"], 2),
            end_sec=round(s["end"], 2),
            timecode=f"{_format_short_timecode(s['start'])} – {_format_short_timecode(s['end'])}",
            symbol=s["symbol"],
            symbol_type=s["symbol_type"],
            finger_states=s["finger_states"],
            word_ru=s["label_ru"],
            word_kg=s["label_kg"],
            word_en=s["label_en"],
            confidence=round(s["confidence"], 3)
        )
        for i, s in enumerate(result["segments"])
    ]
    assembled = " ".join(s.symbol for s in segments)
    return VideoProcessResponse(
        filename=filename,
        duration_sec=round(result["duration_sec"], 2),
        fps=round(result["fps"], 2),
        total_frames_sampled=result["total_frames_sampled"],
        segments=segments,
        assembled_string=assembled,
        translation_ru=f"Реальное распознавание по кадрам «{filename}»: {assembled}" if assembled else f"В видео «{filename}» не обнаружено жестов",
        translation_kg=f"«{filename}» видеосунан кадрлар боюнча реалдуу таануу: {assembled}" if assembled else f"«{filename}» видеосунда жаңсоолор табылган жок",
        srt_subtitles=_build_srt(result["segments"]),
        average_confidence=round(result["average_confidence"], 3)
    )


@router.post("/video/upload-analyze", response_model=VideoProcessResponse)
def upload_and_analyze_video(
    file: UploadFile = File(...),
    mode: Optional[str] = Form(None)
):
    """Real upload analysis: OpenCV decodes the actual file, MediaPipe finds hands."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".mp4", ".avi", ".mov", ".webm", ".mkv", ".m4v"):
        raise HTTPException(status_code=415, detail=f"Неподдерживаемый формат видео: {ext or '—'}")

    data = file.file.read()
    if len(data) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Видео слишком большое (макс. 200 МБ)")
    if not data:
        raise HTTPException(status_code=422, detail="Пустой файл видео")

    import tempfile, shutil
    tmp_dir = tempfile.mkdtemp(prefix="imotech_vid_")
    try:
        tmp_path = os.path.join(tmp_dir, f"video{ext}")
        with open(tmp_path, "wb") as fh:
            fh.write(data)
        result = cv_processing.analyze_video_file(tmp_path, mode=_norm_mode(mode))
        return _segments_to_video_response(file.filename or "video.mp4", result)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки видео: {exc}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/photo/upload-analyze", response_model=PhotoAnalyzeResponse)
def upload_and_analyze_photo(
    file: UploadFile = File(...),
    mode: Optional[str] = Form(None)
):
    """Real photo analysis: pixels -> MediaPipe Hands -> gesture."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
        raise HTTPException(status_code=415, detail=f"Неподдерживаемый формат изображения: {ext or '—'}")

    data = file.file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Фото слишком большое (макс. 25 МБ)")
    if not data:
        raise HTTPException(status_code=422, detail="Пустой файл изображения")

    try:
        result = cv_processing.analyze_image_bytes(data, mode=_norm_mode(mode))
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки фото: {exc}")

    hand_results = []
    for r in result["results"]:
        hand_results.append(PhotoHandResult(
            hand_side=r["hand_side"],
            detected_symbol=r["detected_symbol"],
            symbol_type=r["symbol_type"],
            label_ru=r["label_ru"],
            label_kg=r["label_kg"],
            label_en=r["label_en"],
            finger_states=r["finger_states"],
            confidence=round(r["confidence"], 3),
            anatomical_rule=r["anatomical_rule"],
            hand_landmarks_21=r["hand_landmarks_21"]
        ))

    symbols = [r.detected_symbol for r in hand_results]
    translation = " ".join(symbols) if symbols else "Жест не распознан"
    report_lines = [
        f"ImoTech — Отчёт реального анализа фото «{file.filename}»",
        f"Разрешение: {result['width']}x{result['height']} • Обнаружено рук: {result['hands_detected']}",
        ""
    ]
    for i, r in enumerate(hand_results, 1):
        report_lines.append(
            f"{i}. {r.detected_symbol} ({r.label_ru}) • уверенность {r.confidence:.2f} • пальцы {r.finger_states} • правило: {r.anatomical_rule}"
        )
    report_txt = "\n".join(report_lines)

    primary = hand_results[0] if hand_results else None
    return PhotoAnalyzeResponse(
        filename=file.filename or "photo.jpg",
        source="upload",
        image_width=result["width"],
        image_height=result["height"],
        hands_detected=result["hands_detected"],
        scan_mode=_norm_mode(mode),
        primary_result=primary,
        results=hand_results,
        translation_ru=translation,
        translation_kg=translation,
        translation_en=translation,
        report_txt=report_txt
    )


@router.post("/youtube/process-real", response_model=YouTubeAnalyzeResponse)
def process_youtube_real(payload: YouTubeAnalyzeRequest):
    """Real YouTube processing: yt-dlp download -> OpenCV frames -> MediaPipe."""
    url = payload.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=422, detail="Некорректная ссылка YouTube")

    try:
        result = cv_processing.analyze_youtube_url(url, mode=_norm_mode(None), max_duration_sec=180)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки YouTube: {exc}")

    timeline = [
        YouTubeTimelineItem(
            id=i + 1,
            start_sec=round(s["start"], 2),
            end_sec=round(s["end"], 2),
            timestamp_label=f"{_format_short_timecode(s['start'])} – {_format_short_timecode(s['end'])}",
            symbol=s["symbol"],
            symbol_type=s["symbol_type"],
            finger_states=s["finger_states"],
            text_ru=s["label_ru"],
            text_kg=s["label_kg"],
            text_en=s["label_en"],
            confidence=round(s["confidence"], 3)
        )
        for i, s in enumerate(result["segments"])
    ]
    assembled = " ".join(t.symbol for t in timeline)
    title = result.get("title") or "YouTube видео"
    if timeline:
        summary_ru = f"Реальное распознавание видео «{title}»: найдено {len(timeline)} жестов ({assembled}) • MediaPipe по реальным кадрам"
        summary_kg = f"«{title}» видеосунун реалдуу таануу: {len(timeline)} жаңсоо табылды ({assembled})"
        summary_en = f"Real recognition of '{title}': {len(timeline)} gestures found ({assembled})"
    else:
        summary_ru = f"В видео «{title}» жесты рукой не обнаружены (возможно, руки вне кадра или без дактиля)"
        summary_kg = f"«{title}» видеосунда жаңсоолор табылган жок"
        summary_en = f"No hand gestures detected in '{title}'"

    return YouTubeAnalyzeResponse(
        video_id=result["video_id"],
        embed_url=result["embed_url"],
        title=title,
        channel=result.get("channel") or "",
        duration_sec=result.get("duration_sec", 0),
        verified_corpus=False,
        detected_timeline=timeline,
        assembled_symbols=assembled,
        summary_ru=summary_ru,
        summary_kg=summary_kg,
        summary_en=summary_en,
        total_recognized_symbols=len(timeline),
        average_confidence=round(result["average_confidence"], 3),
        srt_export=_build_srt(result["segments"])
    )

