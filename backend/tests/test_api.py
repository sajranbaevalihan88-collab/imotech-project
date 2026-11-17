import json
import asyncio
import asyncio.proactor_events
from urllib.parse import urlparse, parse_qsl, urlencode, quote
import pytest
from ..main import app
from ..database import init_db
from ..seed_data import seed_database

# Sandbox-safe event loop: SelectorEventLoop wakes up correctly on Windows
# (the previous ProactorEventLoop self-pipe patch blocked run_until_complete forever).


class SandboxTestClient:
    """In-memory ASGI test client running full FastAPI/Starlette middleware & routing stack."""
    def __init__(self, asgi_app):
        self.app = asgi_app

    def request(self, method: str, url: str, json_data=None, params: dict = None, headers: dict = None, files=None, form_fields=None):
        parsed = urlparse(url)
        path = parsed.path
        query_items = parse_qsl(parsed.query, keep_blank_values=True)
        if params:
            for k, v in params.items():
                if v is not None:
                    query_items.append((str(k), str(v)))
        raw_query = urlencode(query_items).encode("ascii")

        body_bytes = b""
        req_headers = [(b"host", b"testserver")]
        if files is not None:
            # Minimal multipart/form-data builder (single file + optional fields)
            import secrets
            boundary = b"----imotechedge" + secrets.token_hex(12).encode("ascii")
            parts = []
            if form_fields:
                for fk, fv in form_fields.items():
                    if fv is None:
                        continue
                    parts.append(b"--" + boundary + b"\r\n")
                    parts.append(f'Content-Disposition: form-data; name="{fk}"\r\n\r\n'.encode("utf-8"))
                    parts.append(str(fv).encode("utf-8") + b"\r\n")
            for fname, fcontent, ftype in files:
                parts.append(b"--" + boundary + b"\r\n")
                parts.append(
                    f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\n'.encode("utf-8")
                )
                parts.append(f"Content-Type: {ftype}\r\n\r\n".encode("utf-8"))
                parts.append(fcontent + b"\r\n")
            parts.append(b"--" + boundary + b"--\r\n")
            body_bytes = b"".join(parts)
            req_headers.append((b"content-type", b"multipart/form-data; boundary=" + boundary))
        elif json_data is not None:
            body_bytes = json.dumps(json_data).encode("utf-8")
            req_headers.append((b"content-type", b"application/json"))
        if headers:
            for hk, hv in headers.items():
                req_headers.append((hk.lower().encode("latin-1"), str(hv).encode("latin-1")))
        req_headers.append((b"content-length", str(len(body_bytes)).encode("latin-1")))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method.upper(),
            "path": path,
            "raw_path": quote(path, safe="/:@!$&'()*+,;=").encode("ascii"),
            "query_string": raw_query,
            "headers": req_headers,
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }

        messages = [{"type": "http.request", "body": body_bytes, "more_body": False}]
        res_start = {}
        res_body = []

        async def receive():
            if messages:
                return messages.pop(0)
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(msg):
            if msg["type"] == "http.response.start":
                res_start.update(msg)
            elif msg["type"] == "http.response.body":
                res_body.append(msg.get("body", b""))

        loop = asyncio.SelectorEventLoop()
        try:
            loop.run_until_complete(self.app(scope, receive, send))
        finally:
            loop.close()

        class ResponseWrapper:
            def __init__(self, status, body):
                self.status_code = status
                self.content = body
                self.text = body.decode("utf-8", errors="replace")
            def json(self):
                return json.loads(self.text)

        return ResponseWrapper(res_start.get("status", 500), b"".join(res_body))

    def get(self, url: str, params: dict = None, headers: dict = None):
        return self.request("GET", url, params=params, headers=headers)

    def post(self, url: str, json: any = None, params: dict = None, headers: dict = None, files=None, form_fields=None):
        return self.request("POST", url, json_data=json, params=params, headers=headers, files=files, form_fields=form_fields)

    def put(self, url: str, json: any = None, params: dict = None, headers: dict = None):
        return self.request("PUT", url, json_data=json, params=params, headers=headers)

    def delete(self, url: str, params: dict = None, headers: dict = None):
        return self.request("DELETE", url, params=params, headers=headers)


LocalTestClient = SandboxTestClient
FastAPISyncClient = SandboxTestClient

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    seed_database()

@pytest.fixture
def client():
    return SandboxTestClient(app)

def create_sample_hand_landmarks():
    # 21 3D points
    points = []
    for i in range(21):
        points.append({"x": 0.5 + i * 0.01, "y": 0.4 + (i % 4) * 0.05, "z": 0.02 * i})
    return points

def create_dactyl_hand_landmarks_ng():
    # Tailored points for letter Ң:
    # 0: Wrist
    # Thumb: 1-4, Index: 5-8, Middle: 9-12, Ring: 13-16, Pinky: 17-20
    # Pinky upright: 17(0,0,0), 18(0,0.1,0), 19(0,0.2,0) -> 0 deg bend
    pts = [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)]
    # Pinky (17, 18, 19): straight
    pts[17] = {"x": 0.08, "y": 0.0, "z": 0.0}
    pts[18] = {"x": 0.08, "y": 0.05, "z": 0.0}
    pts[19] = {"x": 0.08, "y": 0.10, "z": 0.0}
    pts[20] = {"x": 0.08, "y": 0.14, "z": 0.0}
    # Thumb folded (1, 2, 3): 90 deg bend
    pts[1] = {"x": -0.04, "y": 0.02, "z": 0.0}
    pts[2] = {"x": -0.06, "y": 0.04, "z": 0.0}
    pts[3] = {"x": -0.06, "y": 0.04, "z": 0.03}
    # Index folded (5, 6, 7): 90 deg bend
    pts[5] = {"x": -0.03, "y": 0.08, "z": 0.0}
    pts[6] = {"x": -0.03, "y": 0.12, "z": 0.0}
    pts[7] = {"x": -0.03, "y": 0.12, "z": 0.04}
    # Middle folded (9, 10, 11): 90 deg bend
    pts[9] = {"x": 0.0, "y": 0.09, "z": 0.0}
    pts[10] = {"x": 0.0, "y": 0.13, "z": 0.0}
    pts[11] = {"x": 0.0, "y": 0.13, "z": 0.04}
    # Ring folded (13, 14, 15): 90 deg bend
    pts[13] = {"x": 0.04, "y": 0.08, "z": 0.0}
    pts[14] = {"x": 0.04, "y": 0.12, "z": 0.0}
    pts[15] = {"x": 0.04, "y": 0.12, "z": 0.04}
    return pts

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "imotech"
    assert data["port"] == 8010

def test_gesture_recognition_success(client):
    hand = create_sample_hand_landmarks()
    frames = []
    for i in range(45):
        frames.append({
            "frame_index": i,
            "timestamp_ms": i * 33,
            "right_hand": hand,
            "left_hand": hand if i % 2 == 0 else None,
            "face_contour": None
        })

    payload = {
        "session_token": "token_demo_osh_01",
        "terminal_id": "OSH_CON_1_WINDOW_3",
        "frames": frames
    }

    res = client.post("/api/gestures/recognize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["recognized_text_ky"]) > 0
    assert len(data["recognized_text_ru"]) > 0
    assert len(data["top_candidates"]) == 3
    assert data["top_candidates"][0]["confidence"] > 0.60
    assert data["audio_tts_base64"] is not None
    assert data["processing_latency_ms"] > 0

def test_gesture_recognition_negative_empty_frames(client):
    payload = {
        "session_token": "token_invalid",
        "terminal_id": "OSH_CON_1",
        "frames": []
    }
    res = client.post("/api/gestures/recognize", json=payload)
    assert res.status_code == 422

def test_gesture_recognition_negative_too_few_frames(client):
    hand = create_sample_hand_landmarks()
    frames = [{
        "frame_index": i,
        "timestamp_ms": i * 33,
        "right_hand": hand
    } for i in range(10)] # < 15 frames

    payload = {
        "session_token": "token_invalid",
        "terminal_id": "OSH_CON_1",
        "frames": frames
    }
    res = client.post("/api/gestures/recognize", json=payload)
    assert res.status_code == 422

def test_gesture_recognition_negative_no_landmarks(client):
    frames = [{
        "frame_index": i,
        "timestamp_ms": i * 33,
        "right_hand": None,
        "left_hand": None
    } for i in range(20)]

    payload = {
        "session_token": "token_invalid",
        "terminal_id": "OSH_CON_1",
        "frames": frames
    }
    res = client.post("/api/gestures/recognize", json=payload)
    assert res.status_code == 422

def test_avatar_synthesis_success(client):
    payload = {
        "speech_text": "Салам! Мага паспортту алмаштыруу керек, жардам бериңизчи",
        "source_language": "ky"
    }
    res = client.post("/api/avatar/synthesize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "САЛАМ" in data["gloss_sequence"]
    assert "ПАСПОРТ" in data["gloss_sequence"]
    assert "ЖАРДАМ" in data["gloss_sequence"]
    assert len(data["animation_tracks"]) > 0
    assert data["total_duration_ms"] >= 2400

def test_avatar_synthesis_negative_untranslatable(client):
    payload = {
        "speech_text": "qwerty12345 zxcvbnm completely unmapped gibberish",
        "source_language": "ky"
    }
    res = client.post("/api/avatar/synthesize", json=payload)
    assert res.status_code == 422

def test_avatar_synthesis_negative_empty_text(client):
    payload = {
        "speech_text": "   ",
        "source_language": "ky"
    }
    res = client.post("/api/avatar/synthesize", json=payload)
    assert res.status_code == 422

def test_dactyl_evaluation_ng_success(client):
    hand = create_dactyl_hand_landmarks_ng()
    payload = {
        "letter_char": "Ң",
        "landmarks": hand
    }
    res = client.post("/api/dactyl/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["letter_char"] == "Ң"
    assert data["accuracy_pct"] >= 75.0
    assert data["is_correct"] is True
    assert len(data["finger_scores"]) == 5
    assert "Азаматсыз" in data["feedback_ky"] or "Ң" in data["feedback_ky"]

def test_dactyl_evaluation_oe_and_ue(client):
    hand = create_sample_hand_landmarks()
    # Test letter Ө
    res_oe = client.post("/api/dactyl/evaluate", json={"letter_char": "Ө", "landmarks": hand})
    assert res_oe.status_code == 200
    assert res_oe.json()["letter_char"] == "Ө"
    # Test letter Ү
    res_ue = client.post("/api/dactyl/evaluate", json={"letter_char": "Ү", "landmarks": hand})
    assert res_ue.status_code == 200
    assert res_ue.json()["letter_char"] == "Ү"

def test_dactyl_evaluation_negative_missing_landmarks(client):
    payload = {
        "letter_char": "Ң",
        "landmarks": [{"x": 0.1, "y": 0.2, "z": 0.3} for _ in range(10)] # Needs 21
    }
    res = client.post("/api/dactyl/evaluate", json=payload)
    assert res.status_code == 422

def test_dactyl_evaluation_negative_unknown_letter(client):
    hand = create_sample_hand_landmarks()
    payload = {
        "letter_char": "ZZ",
        "landmarks": hand
    }
    res = client.post("/api/dactyl/evaluate", json=payload)
    assert res.status_code == 404

def test_dactyl_letters_reference(client):
    res = client.get("/api/dactyl/letters")
    assert res.status_code == 200
    data = res.json()
    letters = [item["letter_char"] for item in data]
    assert "Ң" in letters
    assert "Ө" in letters
    assert "Ү" in letters

def test_sign_dictionary_search_all(client):
    res = client.get("/api/dictionary/search")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 10
    glosses = [item["gloss_ky"] for item in data]
    assert "САЛАМ" in glosses
    assert "ПАСПОРТ" in glosses
    assert "РАХМАТ" in glosses

def test_sign_dictionary_search_filter_category(client):
    res = client.get("/api/dictionary/search", params={"category": "public_service"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3
    for item in data:
        assert item["category"] == "public_service"

def test_sign_dictionary_search_filter_query(client):
    res = client.get("/api/dictionary/search", params={"query": "дарыгер"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["gloss_ky"] == "ДАРЫГЕР"


# === NEW TESTS: GESTURE -> LETTERS & DIGITS, VIDEO PROCESSING, YOUTUBE ANALYSIS ===

def test_gesture_classify_digits_0_to_9(client):
    digit_combos = [
        ([0, 0, 0, 0, 0], "0"),
        ([0, 1, 0, 0, 0], "1"),
        ([0, 1, 1, 0, 0], "2"),
        ([1, 1, 1, 0, 0], "3"),
        ([0, 1, 1, 1, 1], "4"),
        ([1, 1, 1, 1, 1], "5"),
        ([1, 0, 0, 0, 1], "6"),
        ([1, 1, 0, 0, 1], "7"),
        ([1, 1, 1, 0, 1], "8"),
        ([0, 0, 1, 1, 1], "9"),
    ]
    for fingers, expected_digit in digit_combos:
        res = client.post("/api/gesture/classify", json={
            "mode": "digits",
            "finger_states": fingers
        })
        assert res.status_code == 200
        data = res.json()
        assert data["detected_symbol"] == expected_digit
        assert data["symbol_type"] == "digit"
        assert len(data["hand_landmarks_21"]) == 21
        assert data["confidence"] >= 0.85


def test_gesture_classify_dactyl_letters(client):
    letter_combos = [
        ([1, 0, 0, 0, 0], "А"),
        ([1, 1, 0, 0, 0], "Г"),
        ([0, 0, 0, 0, 1], "Ң"),
        ([0, 1, 1, 0, 0], "Ү"),
        ([0, 1, 1, 1, 0], "Ш"),
    ]
    for fingers, expected_letter in letter_combos:
        res = client.post("/api/gesture/classify", json={
            "mode": "letters",
            "finger_states": fingers
        })
        assert res.status_code == 200
        data = res.json()
        assert data["detected_symbol"] == expected_letter
        assert data["symbol_type"] == "letter"
        assert len(data["hand_landmarks_21"]) == 21


def test_gesture_classify_with_21_landmarks(client):
    landmarks = create_dactyl_hand_landmarks_ng()
    res = client.post("/api/gesture/classify", json={
        "mode": "auto",
        "landmarks": landmarks
    })
    assert res.status_code == 200
    data = res.json()
    assert data["detected_symbol"] in ("Ң", "1", "0", "А", "Е")
    assert len(data["finger_states"]) == 5


def test_video_process_preset_and_custom_frames(client):
    res1 = client.post("/api/video/process", json={
        "filename": "osh_tson_visit.mp4",
        "duration_sec": 14.0,
        "fps": 30.0,
        "preset_id": "preset_osh_digits"
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["filename"] == "osh_tson_visit.mp4"
    assert len(data1["segments"]) >= 5
    assert "2" in data1["assembled_string"]
    assert "5" in data1["assembled_string"]
    assert "-->" in data1["srt_subtitles"]

    res2 = client.post("/api/video/process", json={
        "filename": "custom_upload.webm",
        "duration_sec": 6.0,
        "fps": 25.0,
        "frame_gestures": [
            {"timestamp_sec": 0.0, "finger_states": [1, 0, 0, 0, 0], "mode": "letters"},
            {"timestamp_sec": 2.0, "finger_states": [0, 1, 1, 0, 0], "mode": "digits"},
            {"timestamp_sec": 4.0, "finger_states": [1, 1, 1, 1, 1], "mode": "digits"}
        ]
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["assembled_string"] == "А 2 5"

    # Honest empty result when uploaded video has 0 detected hands and no preset_id
    res_empty = client.post("/api/video/process", json={
        "filename": "landscape_no_hands.mp4",
        "duration_sec": 10.0,
        "fps": 30.0,
        "frame_gestures": []
    })
    assert res_empty.status_code == 200
    data_empty = res_empty.json()
    assert data_empty["segments"] == []
    assert data_empty["assembled_string"] == ""
    assert data_empty["average_confidence"] == 0.0
    assert "не обнаружены" in data_empty["translation_ru"]


def test_youtube_analyze_valid_and_invalid_urls(client):
    for vid in ("feA64wXhbjo", "0FCWzMq4iWg", "v1desDduz5M", "jNQXAC9IVRw"):
        res = client.post("/api/youtube/analyze", json={
            "url": f"https://www.youtube.com/watch?v={vid}",
            "language": "ru"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["video_id"] == vid
        assert data["verified_corpus"] is True
        assert data["embed_url"] == f"https://www.youtube.com/embed/{vid}"
        assert len(data["detected_timeline"]) >= 5
        assert "-->" in data["srt_export"]

    # Arbitrary YouTube URL outside curated corpus must NOT invent fake hashed gestures
    res_arbitrary = client.post("/api/youtube/analyze", json={
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "language": "ru"
    })
    assert res_arbitrary.status_code == 200
    data_arb = res_arbitrary.json()
    assert data_arb["video_id"] == "dQw4w9WgXcQ"
    assert data_arb["verified_corpus"] is False
    assert data_arb["detected_timeline"] == []
    assert data_arb["assembled_symbols"] == ""
    assert data_arb["total_recognized_symbols"] == 0
    assert data_arb["average_confidence"] == 0.0

    res_bad = client.post("/api/youtube/analyze", json={
        "url": "https://not-a-video-site.org/hello"
    })
    assert res_bad.status_code == 422


def test_photo_analyze_with_detected_hand(client):
    res = client.post("/api/photo/analyze", json={
        "filename": "gesture_photo_01.jpg",
        "image_width": 1280,
        "image_height": 720,
        "source": "upload",
        "detected_hands": [
            {
                "hand_side": "right",
                "finger_states": [0, 1, 1, 0, 0],
                "mode": "digits",
                "confidence": 0.96
            },
            {
                "hand_side": "left",
                "finger_states": [1, 1, 1, 1, 1],
                "mode": "digits",
                "confidence": 0.94
            }
        ]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "gesture_photo_01.jpg"
    assert data["hands_detected"] == 2
    assert data["primary_result"]["detected_symbol"] == "2"
    assert data["primary_result"]["symbol_type"] == "digit"
    assert len(data["results"]) == 2
    assert "2 5" in data["translation_ru"]
    assert "Отчёт анализа фото" in data["report_txt"]


def test_photo_analyze_no_hands(client):
    res = client.post("/api/photo/analyze", json={
        "filename": "empty_landscape.png",
        "image_width": 800,
        "image_height": 600,
        "detected_hands": []
    })
    assert res.status_code == 200
    data = res.json()
    assert data["hands_detected"] == 0
    assert data["primary_result"] is None
    assert data["results"] == []
    assert "не обнаружены" in data["translation_ru"]


def test_photo_analyze_webcam_snapshot_letters(client):
    res = client.post("/api/photo/analyze", json={
        "filename": "webcam_shot.png",
        "source": "webcam_snapshot",
        "detected_hands": [
            {"hand_side": "right", "finger_states": [0, 0, 0, 0, 1], "mode": "letters"}
        ]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "webcam_snapshot"
    assert data["primary_result"]["detected_symbol"] == "Ң"
    assert data["primary_result"]["symbol_type"] == "letter"


# === REAL SERVER-SIDE CV PROCESSING TESTS ===

def _make_test_png():
    import cv2
    import numpy as np
    img = np.full((240, 320, 3), 40, dtype=np.uint8)
    # Draw a simple hand-like shape so the pipeline has pixels to work with
    cv2.circle(img, (160, 150), 45, (205, 170, 110), -1)
    for dx in (-32, -16, 0, 16, 32):
        cv2.rectangle(img, (155 + dx, 40), (168 + dx, 110), (205, 170, 110), -1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()

def test_photo_upload_analyze_real_pipeline(client):
    res = client.post("/api/photo/upload-analyze", files=[("hand.png", _make_test_png(), "image/png")])
    assert res.status_code == 200
    data = res.json()
    assert data["image_width"] == 320
    assert data["image_height"] == 240
    assert data["hands_detected"] == len(data["results"])
    assert isinstance(data["report_txt"], str) and data["report_txt"]

def test_photo_upload_analyze_invalid_image(client):
    res = client.post("/api/photo/upload-analyze", files=[("broken.png", b"this is not an image", "image/png")])
    assert res.status_code == 422

def test_video_upload_analyze_wrong_format(client):
    res = client.post("/api/video/upload-analyze", files=[("note.txt", b"hello", "text/plain")])
    assert res.status_code == 415

def test_youtube_process_real_bad_url(client):
    res = client.post("/api/youtube/process-real", json={"url": "not-a-youtube-link"})
    assert res.status_code == 422
