import json
try:
    from .database import get_connection
except ImportError:
    from database import get_connection

SEED_SIGNS = [
    {
        "id": "sign_salam",
        "gloss_ky": "САЛАМ",
        "gloss_ru": "Здравствуйте / Привет",
        "category": "daily",
        "description_ky": "Ачык оң алакан чекеден алдыга карай жылат",
        "video_demonstration_url": "/assets/signs/salam.mp4",
        "is_two_handed": 0,
        "requires_facial_expression": 1,
        "duration_ms": 1200,
        "landmark_signature": json.dumps({"y_elevation": 0.25, "two_handed": False})
    },
    {
        "id": "sign_pasport",
        "gloss_ky": "ПАСПОРТ",
        "gloss_ru": "Паспорт",
        "category": "public_service",
        "description_ky": "Сол алакан тик турат, оң кол төрт бурчтук тартат",
        "video_demonstration_url": "/assets/signs/pasport.mp4",
        "is_two_handed": 1,
        "requires_facial_expression": 0,
        "duration_ms": 1500,
        "landmark_signature": json.dumps({"y_elevation": 0.48, "two_handed": True})
    },
    {
        "id": "sign_rahmat",
        "gloss_ky": "РАХМАТ",
        "gloss_ru": "Спасибо / Благодарю",
        "category": "daily",
        "description_ky": "Оң кол жүрөктүн тушунан алдыга карай таазим менен ачылат",
        "video_demonstration_url": "/assets/signs/rahmat.mp4",
        "is_two_handed": 0,
        "requires_facial_expression": 1,
        "duration_ms": 1100,
        "landmark_signature": json.dumps({"y_elevation": 0.42, "two_handed": False})
    },
    {
        "id": "sign_daryger",
        "gloss_ky": "ДАРЫГЕР",
        "gloss_ru": "Врач / Доктор",
        "category": "medical",
        "description_ky": "Оң колдун эки манжасы сол билектин тамырын кармайт",
        "video_demonstration_url": "/assets/signs/daryger.mp4",
        "is_two_handed": 1,
        "requires_facial_expression": 0,
        "duration_ms": 1400,
        "landmark_signature": json.dumps({"y_elevation": 0.58, "two_handed": True})
    },
    {
        "id": "sign_jardam",
        "gloss_ky": "ЖАРДАМ",
        "gloss_ru": "Помощь",
        "category": "public_service",
        "description_ky": "Оң муштум сол ачык алакандын үстүнө коюлуп, чогуу өйдө көтөрүлөт",
        "video_demonstration_url": "/assets/signs/jardam.mp4",
        "is_two_handed": 1,
        "requires_facial_expression": 1,
        "duration_ms": 1300,
        "landmark_signature": json.dumps({"y_elevation": 0.50, "two_handed": True})
    },
    {
        "id": "sign_spravka",
        "gloss_ky": "СПРАВКА",
        "gloss_ru": "Справка / Документ",
        "category": "public_service",
        "description_ky": "Оң кол сол алаканга кол коюу кыймылын жасайт",
        "video_demonstration_url": "/assets/signs/spravka.mp4",
        "is_two_handed": 1,
        "requires_facial_expression": 0,
        "duration_ms": 1250,
        "landmark_signature": json.dumps({"y_elevation": 0.52, "two_handed": True})
    },
    {
        "id": "sign_dekanat",
        "gloss_ky": "ДЕКАНАТ",
        "gloss_ru": "Деканат / Факультет",
        "category": "education",
        "description_ky": "Эки кол чатырча формасында биригип, капталга ачылат",
        "video_demonstration_url": "/assets/signs/dekanat.mp4",
        "is_two_handed": 1,
        "requires_facial_expression": 0,
        "duration_ms": 1350,
        "landmark_signature": json.dumps({"y_elevation": 0.38, "two_handed": True})
    },
    {
        "id": "sign_baa",
        "gloss_ky": "БАА",
        "gloss_ru": "Оценка / Балл",
        "category": "education",
        "description_ky": "Сөөмөй менен абада бештик же канат белгиси сызылат",
        "video_demonstration_url": "/assets/signs/baa.mp4",
        "is_two_handed": 0,
        "requires_facial_expression": 1,
        "duration_ms": 1000,
        "landmark_signature": json.dumps({"y_elevation": 0.45, "two_handed": False})
    },
    {
        "id": "sign_oshsu",
        "gloss_ky": "ОШГУ",
        "gloss_ru": "ОшГУ / Университет",
        "category": "education",
        "description_ky": "Оң кол «О» формасынан «У» формасына өтүп, алдыга сунулат",
        "video_demonstration_url": "/assets/signs/oshsu.mp4",
        "is_two_handed": 0,
        "requires_facial_expression": 1,
        "duration_ms": 1400,
        "landmark_signature": json.dumps({"y_elevation": 0.35, "two_handed": False})
    },
    {
        "id": "sign_men",
        "gloss_ky": "МЕН",
        "gloss_ru": "Я / Мен",
        "category": "daily",
        "description_ky": "Оң сөөмөй өз төшүнө багытталат",
        "video_demonstration_url": "/assets/signs/men.mp4",
        "is_two_handed": 0,
        "requires_facial_expression": 0,
        "duration_ms": 900,
        "landmark_signature": json.dumps({"y_elevation": 0.50, "two_handed": False})
    }
]

SEED_DACTYL = [
    {
        "letter_char": "Ң",
        "letter_name": "Кыргыз дактили Ң (Нг)",
        "difficulty_level": 4,
        "description_ky": "Чыпалак тик өйдө сунулган, калган манжалар муштумга түйүлгөн, баш бармак үстүнө басылган",
        "target_angles": json.dumps({"thumb": 90.0, "index": 90.0, "middle": 90.0, "ring": 90.0, "pinky": 15.0}),
        "sample_image_url": "/assets/dactyl/ng.png"
    },
    {
        "letter_char": "Ө",
        "letter_name": "Кыргыз дактили Ө",
        "difficulty_level": 3,
        "description_ky": "Бардык манжалардын учтары баш бармак менен биригип «Ө» тегерегин түзөт",
        "target_angles": json.dumps({"thumb": 45.0, "index": 50.0, "middle": 50.0, "ring": 50.0, "pinky": 50.0}),
        "sample_image_url": "/assets/dactyl/oe.png"
    },
    {
        "letter_char": "Ү",
        "letter_name": "Кыргыз дактили Ү",
        "difficulty_level": 3,
        "description_ky": "Сөөмөй жана ортон V-формасында ачылат, чыпалак менен аты жок алаканга бүгүлөт",
        "target_angles": json.dumps({"thumb": 75.0, "index": 10.0, "middle": 10.0, "ring": 90.0, "pinky": 90.0}),
        "sample_image_url": "/assets/dactyl/ue.png"
    },
    {
        "letter_char": "А",
        "letter_name": "Кыргыз дактили А",
        "difficulty_level": 1,
        "description_ky": "Бардык манжалар муштумга түйүлгөн, баш бармак сөөмөйдүн капталында түз турат",
        "target_angles": json.dumps({"thumb": 15.0, "index": 90.0, "middle": 90.0, "ring": 90.0, "pinky": 90.0}),
        "sample_image_url": "/assets/dactyl/a.png"
    },
    {
        "letter_char": "Б",
        "letter_name": "Кыргыз дактили Б",
        "difficulty_level": 1,
        "description_ky": "Төрт манжа өйдө тик турат, баш бармак алакандын ортосуна ийилген",
        "target_angles": json.dumps({"thumb": 90.0, "index": 10.0, "middle": 10.0, "ring": 10.0, "pinky": 10.0}),
        "sample_image_url": "/assets/dactyl/b.png"
    },
    {
        "letter_char": "С",
        "letter_name": "Кыргыз дактили С",
        "difficulty_level": 2,
        "description_ky": "Бардык манжалар C тамгасынын жарым тегерек формасында ийилген",
        "target_angles": json.dumps({"thumb": 35.0, "index": 40.0, "middle": 40.0, "ring": 40.0, "pinky": 40.0}),
        "sample_image_url": "/assets/dactyl/s.png"
    }
]

def seed_database():
    conn = get_connection()
    cursor = conn.cursor()

    # Seed signs if empty
    cursor.execute("SELECT COUNT(*) FROM sign_dictionary")
    if cursor.fetchone()[0] == 0:
        for s in SEED_SIGNS:
            cursor.execute("""
                INSERT INTO sign_dictionary (id, gloss_ky, gloss_ru, category, description_ky, video_demonstration_url, is_two_handed, requires_facial_expression, duration_ms, landmark_signature, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                s["id"], s["gloss_ky"], s["gloss_ru"], s["category"], s["description_ky"],
                s["video_demonstration_url"], s["is_two_handed"], s["requires_facial_expression"],
                s["duration_ms"], s["landmark_signature"]
            ))

    # Seed dactyl if empty
    cursor.execute("SELECT COUNT(*) FROM dactyl_letters")
    if cursor.fetchone()[0] == 0:
        for d in SEED_DACTYL:
            cursor.execute("""
                INSERT INTO dactyl_letters (letter_char, letter_name, difficulty_level, description_ky, target_angles, sample_image_url)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                d["letter_char"], d["letter_name"], d["difficulty_level"], d["description_ky"],
                d["target_angles"], d["sample_image_url"]
            ))

    # Seed initial terminal sessions
    cursor.execute("SELECT COUNT(*) FROM terminal_sessions")
    if cursor.fetchone()[0] == 0:
        sessions = [
            ("session_osh_con1", "OSH_CON_1_WINDOW_3", "ЦОН №1 г. Ош, ул. Ленина", 42, 68, 44),
            ("session_oshsu_dek", "OSHSU_DEKANAT_IT", "ОшМУ ИМИТ Деканаты", 29, 34, 41),
            ("session_hospital", "OSH_REGIONAL_HOSP_ER", "Ош облустук ооруканасы (Кабыл алуу)", 18, 22, 46)
        ]
        for sid, tid, loc, sc, pc, lat in sessions:
            cursor.execute("""
                INSERT INTO terminal_sessions (session_id, terminal_identifier, location_name, started_at, signs_translated_count, phrases_synthesized_count, average_latency_ms)
                VALUES (?, ?, ?, datetime('now'), ?, ?, ?)
            """, (sid, tid, loc, sc, pc, lat))

    conn.commit()
    conn.close()
