from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional, Dict, Any

class HealthResponse(BaseModel):
    status: str
    app: str
    port: int

class LandmarkPoint(BaseModel):
    x: float = Field(..., ge=-5.0, le=5.0)
    y: float = Field(..., ge=-5.0, le=5.0)
    z: float = Field(..., ge=-5.0, le=5.0)

class GestureFramePayload(BaseModel):
    frame_index: int = Field(..., ge=0)
    timestamp_ms: int = Field(..., ge=0)
    left_hand: Optional[List[LandmarkPoint]] = Field(None, max_length=21)
    right_hand: Optional[List[LandmarkPoint]] = Field(None, max_length=21)
    face_contour: Optional[List[LandmarkPoint]] = Field(None, max_length=40)

class StreamInferenceRequest(BaseModel):
    session_token: str = Field(..., min_length=1)
    terminal_id: str = Field(..., min_length=1)
    frames: List[GestureFramePayload] = Field(..., min_length=15, max_length=60)

    @field_validator("frames")
    @classmethod
    def validate_frames_landmarks(cls, v: List[GestureFramePayload]) -> List[GestureFramePayload]:
        if not v:
            raise ValueError("Скелеттик кадрлардын массиви бош болбошу керек (frames cannot be empty)")
        has_any_hand = any((f.left_hand and len(f.left_hand) > 0) or (f.right_hand and len(f.right_hand) > 0) for f in v)
        if not has_any_hand:
            raise ValueError("Эч бир кадрда колдун соот-белгилери (landmarks) табылган жок")
        return v

class RecognizedGlossCandidate(BaseModel):
    gloss_ky: str
    gloss_ru: str
    confidence: float = Field(..., ge=0.0, le=1.0)

class StreamInferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    recognized_text_ky: str
    recognized_text_ru: str
    top_candidates: List[RecognizedGlossCandidate]
    audio_tts_base64: Optional[str] = None
    processing_latency_ms: int

class SpeechToSignRequest(BaseModel):
    speech_text: str = Field(..., min_length=1, max_length=500)
    source_language: str = Field(default="ky", pattern="^(ky|ru)$")

    @field_validator("speech_text")
    @classmethod
    def validate_speech_text(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Сүйлөм тексти бош болбошу керек")
        return stripped

class AvatarKeyframeTrack(BaseModel):
    bone_name: str
    times: List[float]
    rotations_quaternion: List[List[float]]

class SpeechToSignResponse(BaseModel):
    original_text: str
    gloss_sequence: List[str]
    animation_tracks: List[AvatarKeyframeTrack]
    total_duration_ms: int

class DactylEvaluationRequest(BaseModel):
    letter_char: str = Field(..., min_length=1, max_length=4)
    landmarks: List[LandmarkPoint] = Field(...)

    @field_validator("landmarks")
    @classmethod
    def validate_hand_landmarks(cls, v: List[LandmarkPoint]) -> List[LandmarkPoint]:
        if len(v) != 21:
            raise ValueError(f"Дактильди баалоо үчүн кисть соот-белгилеринин саны так 21 болушу керек, берилген: {len(v)}")
        return v

class FingerJointScore(BaseModel):
    finger_name: str
    angle_measured_deg: float
    angle_target_deg: float
    deviation_deg: float
    status: str

class DactylEvaluationResponse(BaseModel):
    letter_char: str
    accuracy_pct: float = Field(..., ge=0.0, le=100.0)
    is_correct: bool
    finger_scores: List[FingerJointScore]
    feedback_ky: str
    feedback_ru: str

class DactylLetterReference(BaseModel):
    letter_char: str
    letter_name: str
    difficulty_level: int
    description_ky: str
    target_angles: Dict[str, float]
    sample_image_url: str

class DictionaryItemResponse(BaseModel):
    id: str
    gloss_ky: str
    gloss_ru: str
    category: str
    description_ky: str
    video_demonstration_url: str
    is_two_handed: bool
    requires_facial_expression: bool
    duration_ms: int

# === NEW GESTURE CLASSIFIER, VIDEO PROCESSING & YOUTUBE ANALYSIS SCHEMAS ===

class GestureClassifyRequest(BaseModel):
    mode: str = Field(default="auto", pattern="^(auto|letters|digits|words)$")
    finger_states: Optional[List[int]] = Field(default=None, min_length=5, max_length=5)
    landmarks: Optional[List[LandmarkPoint]] = Field(default=None, min_length=21, max_length=21)
    gesture_code: Optional[str] = Field(default=None, max_length=32)
    pinch_thumb_index: Optional[bool] = Field(default=False)
    wrist_angle_deg: Optional[float] = Field(default=0.0)

    @field_validator("finger_states")
    @classmethod
    def validate_finger_states(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v is not None:
            if len(v) != 5:
                raise ValueError("finger_states must contain exactly 5 elements [thumb, index, middle, ring, pinky]")
            for state in v:
                if state not in (0, 1, 2):
                    raise ValueError("Each finger state must be 0 (folded), 1 (extended), or 2 (half-bent)")
        return v


class GestureClassifyResponse(BaseModel):
    detected_symbol: str
    symbol_type: str  # "letter" | "digit" | "word"
    label_ru: str
    label_kg: str
    label_en: str
    finger_states: List[int]
    confidence: float = Field(..., ge=0.0, le=1.0)
    hand_landmarks_21: List[LandmarkPoint]
    anatomical_rule: str


class VideoFrameSampleInput(BaseModel):
    timestamp_sec: float = Field(..., ge=0.0)
    finger_states: Optional[List[int]] = Field(default=None, min_length=5, max_length=5)
    gesture_code: Optional[str] = None
    mode: Optional[str] = "auto"


class VideoProcessRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    duration_sec: float = Field(default=6.0, gt=0.0, le=3600.0)
    fps: float = Field(default=30.0, gt=0.0, le=240.0)
    preset_id: Optional[str] = Field(default=None)
    frame_gestures: Optional[List[VideoFrameSampleInput]] = Field(default=None)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Имя видеофайла не может быть пустым")
        return s


class VideoGestureSegment(BaseModel):
    segment_id: int
    start_sec: float
    end_sec: float
    timecode: str
    symbol: str
    symbol_type: str
    finger_states: List[int]
    word_ru: str
    word_kg: str
    word_en: str
    confidence: float


class VideoProcessResponse(BaseModel):
    filename: str
    duration_sec: float
    fps: float
    total_frames_sampled: int
    segments: List[VideoGestureSegment]
    assembled_string: str
    translation_ru: str
    translation_kg: str
    srt_subtitles: str
    average_confidence: float


class YouTubeAnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=500)
    language: str = Field(default="ru", pattern="^(ru|kg|en)$")


class YouTubeTimelineItem(BaseModel):
    id: int
    start_sec: float
    end_sec: float
    timestamp_label: str
    symbol: str
    symbol_type: str
    finger_states: List[int]
    text_ru: str
    text_kg: str
    text_en: str
    confidence: float


class YouTubeAnalyzeResponse(BaseModel):
    video_id: str
    embed_url: str
    title: str
    channel: str
    duration_sec: int
    verified_corpus: bool = True
    detected_timeline: List[YouTubeTimelineItem]
    assembled_symbols: str
    summary_ru: str
    summary_kg: str
    summary_en: str
    total_recognized_symbols: int
    average_confidence: float
    srt_export: str


# === PHOTO (IMAGE FILE) SIGN LANGUAGE ANALYSIS SCHEMAS ===

class PhotoHandDetection(BaseModel):
    hand_side: str = Field(default="right", pattern="^(right|left)$")
    finger_states: List[int] = Field(..., min_length=5, max_length=5)
    gesture_code: Optional[str] = Field(default=None, max_length=32)
    mode: str = Field(default="auto", pattern="^(auto|letters|digits|words)$")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    landmarks: Optional[List[LandmarkPoint]] = Field(default=None, min_length=21, max_length=21)


class PhotoAnalyzeRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    image_width: int = Field(default=640, ge=1, le=10000)
    image_height: int = Field(default=480, ge=1, le=10000)
    source: str = Field(default="upload", pattern="^(upload|webcam_snapshot)$")
    detected_hands: List[PhotoHandDetection] = Field(default_factory=list)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Имя файла изображения не может быть пустым")
        return s


class PhotoHandResult(BaseModel):
    hand_side: str
    detected_symbol: str
    symbol_type: str
    label_ru: str
    label_kg: str
    label_en: str
    finger_states: List[int]
    confidence: float
    anatomical_rule: str
    hand_landmarks_21: List[LandmarkPoint]


class PhotoAnalyzeResponse(BaseModel):
    filename: str
    source: str
    image_width: int
    image_height: int
    hands_detected: int
    scan_mode: str
    primary_result: Optional[PhotoHandResult] = None
    results: List[PhotoHandResult]
    translation_ru: str
    translation_kg: str
    translation_en: str
    report_txt: str

