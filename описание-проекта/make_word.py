# -*- coding: utf-8 -*-
"""
Генератор официального документа Word (.docx) для жюри StudExpo:
«Описание проекта — ImoTech.docx»
"""

import os
import json
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

SPEC = json.loads(r"""{
  "num": "10",
  "key": "imotech",
  "title": "ImoTech (ЫмТили)",
  "subtitle": "Интеллектуальная платформа распознавания языка жестов в буквы и цифры (0–9, А–Я, Ө, Ү, Ң), обработки видеофайлов и YouTube-потоков",
  "category": "StudExpo ОшГУ • ЫмТили",
  "org": "Ошский государственный университет (ОшГУ) / Южный регион КР",
  "backend_port": 8010,
  "frontend_port": 3010,
  "backend_layout": "flat",
  "problem": "На весь южный регион работает менее 15 дипломированных сурдопереводчиков — глухой человек не может без посредника объяснить симптомы врачу, назвать номер талона или оформить документ в ЦОНе. Зарубежные системы компьютерного зрения обучены только на американском амслене (ASL) и не понимают кыргызскую и русскую дактильную азбуку (А–Я, включая Ө, Ү, Ң), пальцевый счёт цифр (0–9) и лексику КЖЯ.",
  "stat": "В Кыргызстане проживает более 32 000 граждан с нарушениями слуха и речи, из них свыше 9 000 — в Ошской, Джалал-Абадской и Баткенской областях.",
  "why": "Представьте, что вы пришли в больницу или ЦОН, вам больно или срочно нужна справка, но вас никто не понимает, а единственный сурдопереводчик расписан на неделю вперёд. В Кыргызстане более тридцати тысяч неслышащих людей сталкиваются с этой стеной тишины каждый день. Я разработал ImoTech (ЫмТили): камера в реальном времени считывает 21 точку кисти и переводит жесты в дактильные буквы, цифры (0–9) и фразы, а также обрабатывает загруженные видеофайлы и ссылки из YouTube с формированием таймкодов и субтитров.",
  "roles": [
    {
      "role": "admin",
      "title_ru": "Администратор инклюзивного центра / ЦОН г. Ош",
      "title_kg": "Инклюзивдик борбордун / КТБ администратору",
      "title_en": "Inclusive Center / Public Service Admin",
      "username": "admin_imotech",
      "name_ru": "Сулайманова Назира (Инклюзивный центр ОшГУ / КОГ)",
      "desc_ru": "Создаёт аккаунты сурдопереводчиков-педагогов, операторов окон ЦОН/клиник и родителей, привязывает учеников к родителям и модерирует базу жестов КЖЯ."
    },
    {
      "role": "specialist",
      "title_ru": "Сурдопедагог / Преподаватель КЖЯ",
      "title_kg": "Сурдопедагог / КЖТ мугалими",
      "title_en": "Sign Language Teacher (Surdopedagogue)",
      "username": "teacher_ksl",
      "name_ru": "Абдылдаева Роза (школа-интернат для глухих и слабослышащих детей, г. Ош)",
      "desc_ru": "Создаёт учебную группу с 6-значным кодом, выдаёт уроки кыргызского дактиля (А–Я, Ө, Ү, Ң) и счёта цифр (0–9), ведёт журнал успеваемости и автоотчёт."
    },
    {
      "role": "user",
      "title_ru": "Неслышащий гражданин / Ученик курса КЖЯ",
      "title_kg": "Угуусу начар жаран / Окуучу",
      "title_en": "Deaf Citizen / KSL Student",
      "username": "student_nursultan",
      "name_ru": "Нурсултан Асанов (ученик группы КЖЯ-101)",
      "desc_ru": "Вступает в группу по 6-значному коду, использует живой сканер жестов в буквы и цифры, обработку видеофайлов и перевод ссылок YouTube. Изменить оценки в журнале сам не может (403)."
    },
    {
      "role": "supervisor",
      "title_ru": "Родитель неслышащего ребёнка",
      "title_kg": "Баланын ата-энеси",
      "title_en": "Parent of Deaf Child",
      "username": "parent_asanova",
      "name_ru": "Асанова Жылдыз (мама Нурсултана)",
      "desc_ru": "Получает личный вход от школы и видит раздел «Мои дети»: освоенные жесты, буквы дактиля, цифры и историю обращений только своего ребёнка. Чужие дневники закрыты (403)."
    }
  ],
  "groups": [
    {
      "code": "360101",
      "name": "Группа КЖЯ-101 (Дактиль А–Я, Ө, Ү, Ң и счёт цифр 0–9)",
      "specialist": "teacher_ksl"
    },
    {
      "code": "360205",
      "name": "Группа ЦОН-ОШ (Инклюзивный курс для операторов госуслуг и медиков)",
      "specialist": "teacher_ksl"
    }
  ],
  "demo_steps": [
    "Включаю живой сканер жестов (21 точка MediaPipe Hands): комбинации пальцев переводятся в цифры (0–9) и буквы дактиля (А–Я, Ө, Ү, Ң), собирая слова и номера талонов.",
    "Загружаю видеофайл (.MP4) и запускаю покадровую обработку с автоматической сборкой распознанных символов и выгрузкой субтитров .SRT.",
    "Вставляю ссылку на видео из YouTube: система встраивает плеер и выводит синхронный таймлайн распознанных жестов, букв и цифр на RU / KG / EN.",
    "Демонстрирую двусторонний терминал ЦОН/больницы и ролевую защиту данных HTTP 403 Forbidden."
  ]
}""")


def build_docx():
    doc = Document()

    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2)

    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    style.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Заголовок
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = title_p.add_run(SPEC["title"])
    r_title.bold = True
    r_title.font.size = Pt(22)
    r_title.font.color.rgb = RGBColor(0x1E, 0x40, 0xAF)

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = sub_p.add_run(SPEC["subtitle"] + "\nСекция: " + SPEC["category"] + " | " + SPEC["org"])
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    def add_h1(text: str):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(0x1E, 0x40, 0xAF)
        return p

    add_h1("1. Актуальность, реальная проблема и история создания")
    doc.add_paragraph("Решаемая проблема: " + SPEC["problem"])
    doc.add_paragraph("Статистика и база внедрения: " + SPEC["stat"])
    doc.add_paragraph("Почему создан проект: " + SPEC["why"])

    add_h1("2. Ролевая модель (4 роли) и защита данных (RBAC + 403 Forbidden)")
    table = doc.add_table(rows=1, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "Роль (RU / KG)"
    hdr[1].text = "Демо-логин"
    hdr[2].text = "ФИО в демо-базе"
    hdr[3].text = "Функции и права доступа"

    for r in SPEC["roles"]:
        row_cells = table.add_row().cells
        row_cells[0].text = f"{r['title_ru']} / {r['title_kg']}"
        row_cells[1].text = f"{r['username']} (пароль: demo2027)"
        row_cells[2].text = r["name_ru"]
        row_cells[3].text = r["desc_ru"]

    add_h1("3. Ключевые функциональные модули платформы")
    features = [
        "Живой сканер жестов в буквы (А–Я, Ө, Ү, Ң) и цифры (0–9): отслеживание 21 3D-точки кисти и вектора сгиба 5 пальцев через веб-камеру и интерактивный конструктор.",
        "Покадровая обработка видеофайлов (.MP4 / .WEBM / .MOV): распознавание жестов на видео с генерацией таймкодов и экспортом субтитров .SRT.",
        "Перевод видео по ссылке из YouTube: анализ любого YouTube-ролика со встроенным видеоплеером и синхронным таймлайном жестов, букв и цифр (RU / KG / EN).",
        "Двусторонний терминал для ЦОН и больниц КР: безбарьерный диалог глухого заявителя и оператора.",
        "Интерактивный матричный журнал («Участник × Задание»), вход по 6-значным кодам групп (" + ", ".join(g["code"] for g in SPEC["groups"]) + ") и строгая защита 403 Forbidden."
    ]
    for f_item in features:
        doc.add_paragraph("• " + f_item)

    add_h1("4. Сценарий демонстрации на выставке StudExpo")
    for idx, step_text in enumerate(SPEC["demo_steps"], 1):
        doc.add_paragraph(f"Шаг {idx}. {step_text}")

    add_h1("5. Технический стек и проверка качества")
    doc.add_paragraph(
        f"Backend: Python 3.11+, FastAPI, SQLite, MediaPipe 21-Point Kinematic Classifier, JWT (HMAC-SHA256), порт {SPEC['backend_port']}.\n"
        f"Frontend: React 18, HTML5 Canvas 21-Point Skeleton Renderer, YouTube Embed API, порт {SPEC['frontend_port']}.\n"
        f"Деплой и автотесты: Render Blueprint (render.yaml), Docker, автоматический набор тестов pytest (33 автотеста)."
    )

    out_dir = os.path.dirname(os.path.abspath(__file__))
    safe_title = SPEC["title"].split("(")[0].strip().replace("/", "-")
    out_path = os.path.join(out_dir, f"Описание проекта — {safe_title}.docx")
    doc.save(out_path)
    print(f"Word document saved: {out_path}")
    return out_path


if __name__ == "__main__":
    build_docx()
