import sqlite3
import os
from pathlib import Path

DB_FILE = os.environ.get("IMOTECH_DB", str(Path(__file__).parent / "imotech.db"))

def get_connection():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS sign_dictionary (
        id TEXT PRIMARY KEY,
        gloss_ky TEXT NOT NULL,
        gloss_ru TEXT NOT NULL,
        category TEXT NOT NULL,
        description_ky TEXT NOT NULL,
        video_demonstration_url TEXT NOT NULL,
        is_two_handed BOOLEAN NOT NULL DEFAULT 0,
        requires_facial_expression BOOLEAN NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 1200,
        landmark_signature TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dactyl_letters (
        letter_char TEXT PRIMARY KEY,
        letter_name TEXT NOT NULL,
        difficulty_level INTEGER NOT NULL DEFAULT 1,
        description_ky TEXT NOT NULL,
        target_angles TEXT NOT NULL,
        sample_image_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS avatar_animations (
        id TEXT PRIMARY KEY,
        sign_id TEXT NOT NULL,
        bone_names TEXT NOT NULL,
        keyframes_json TEXT NOT NULL,
        facial_blendshapes_json TEXT,
        duration_ms INTEGER NOT NULL,
        FOREIGN KEY (sign_id) REFERENCES sign_dictionary(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS terminal_sessions (
        session_id TEXT PRIMARY KEY,
        terminal_identifier TEXT NOT NULL,
        location_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        signs_translated_count INTEGER NOT NULL DEFAULT 0,
        phrases_synthesized_count INTEGER NOT NULL DEFAULT 0,
        average_latency_ms INTEGER DEFAULT 45
    );

    CREATE TABLE IF NOT EXISTS dialogue_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        input_text TEXT NOT NULL,
        output_text_ky TEXT NOT NULL,
        output_text_ru TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES terminal_sessions(session_id)
    );
    """)
    conn.commit()
    conn.close()
