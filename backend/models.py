from dataclasses import dataclass
from typing import List, Optional, Dict, Any

@dataclass
class SignDictionaryModel:
    id: str
    gloss_ky: str
    gloss_ru: str
    category: str
    description_ky: str
    video_demonstration_url: str
    is_two_handed: bool
    requires_facial_expression: bool
    duration_ms: int
    landmark_signature: str
    created_at: str

@dataclass
class DactylLetterModel:
    letter_char: str
    letter_name: str
    difficulty_level: int
    description_ky: str
    target_angles: Dict[str, float]
    sample_image_url: str

@dataclass
class AvatarAnimationModel:
    id: str
    sign_id: str
    bone_names: List[str]
    keyframes_json: List[Dict[str, Any]]
    facial_blendshapes_json: Optional[Dict[str, float]]
    duration_ms: int

@dataclass
class TerminalSessionModel:
    session_id: str
    terminal_identifier: str
    location_name: str
    started_at: str
    signs_translated_count: int
    phrases_synthesized_count: int
    average_latency_ms: int
