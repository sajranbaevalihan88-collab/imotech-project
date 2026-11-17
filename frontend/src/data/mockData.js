export const mockDigitsCatalog = [
  { symbol: "0", symbol_type: "digit", fingers: [0, 0, 0, 0, 0], label_ru: "Цифра 0 (Ноль)", label_kg: "Сан 0 (Нөл)", label_en: "Digit 0", rule: "Все 5 пальцев сомкнуты в кольцо/кулак [0, 0, 0, 0, 0]" },
  { symbol: "1", symbol_type: "digit", fingers: [0, 1, 0, 0, 0], label_ru: "Цифра 1 (Один)", label_kg: "Сан 1 (Бир)", label_en: "Digit 1", rule: "Поднят только указательный палец [0, 1, 0, 0, 0]" },
  { symbol: "2", symbol_type: "digit", fingers: [0, 1, 1, 0, 0], label_ru: "Цифра 2 (Два)", label_kg: "Сан 2 (Эки)", label_en: "Digit 2", rule: "Подняты указательный и средний пальцы (V-жест) [0, 1, 1, 0, 0]" },
  { symbol: "3", symbol_type: "digit", fingers: [1, 1, 1, 0, 0], label_ru: "Цифра 3 (Три)", label_kg: "Сан 3 (Үч)", label_en: "Digit 3", rule: "Раскрыты большой, указательный и средний пальцы [1, 1, 1, 0, 0]" },
  { symbol: "4", symbol_type: "digit", fingers: [0, 1, 1, 1, 1], label_ru: "Цифра 4 (Четыре)", label_kg: "Сан 4 (Төрт)", label_en: "Digit 4", rule: "Подняты 4 пальца, большой палец прижат к ладони [0, 1, 1, 1, 1]" },
  { symbol: "5", symbol_type: "digit", fingers: [1, 1, 1, 1, 1], label_ru: "Цифра 5 (Пять)", label_kg: "Сан 5 (Беш)", label_en: "Digit 5", rule: "Полностью раскрытая ладонь — все 5 пальцев прямые [1, 1, 1, 1, 1]" },
  { symbol: "6", symbol_type: "digit", fingers: [1, 0, 0, 0, 1], label_ru: "Цифра 6 (Шесть)", label_kg: "Сан 6 (Алты)", label_en: "Digit 6", rule: "Раскрыты большой палец и мизинец, средние согнуты [1, 0, 0, 0, 1]" },
  { symbol: "7", symbol_type: "digit", fingers: [1, 1, 0, 0, 1], label_ru: "Цифра 7 (Семь)", label_kg: "Сан 7 (Жети)", label_en: "Digit 7", rule: "Раскрыты большой, указательный и мизинец [1, 1, 0, 0, 1]" },
  { symbol: "8", symbol_type: "digit", fingers: [1, 1, 1, 0, 1], label_ru: "Цифра 8 (Восемь)", label_kg: "Сан 8 (Сегиз)", label_en: "Digit 8", rule: "Раскрыты большой, указательный, средний и мизинец [1, 1, 1, 0, 1]" },
  { symbol: "9", symbol_type: "digit", fingers: [0, 0, 1, 1, 1], label_ru: "Цифра 9 (Девять)", label_kg: "Сан 9 (Тогуз)", label_en: "Digit 9", rule: "Большой и указательный сомкнуты кольцом, три пальца вверх [0, 0, 1, 1, 1]" }
];

export const mockLettersCatalog = [
  { symbol: "А", symbol_type: "letter", fingers: [1, 0, 0, 0, 0], label_ru: "Буква А", label_kg: "Тамга А", label_en: "Letter A", rule: "Кулак, большой палец прижат сбоку вертикально вверх [1, 0, 0, 0, 0]" },
  { symbol: "Б", symbol_type: "letter", fingers: [0, 1, 1, 1, 0], label_ru: "Буква Б", label_kg: "Тамга Б", label_en: "Letter B", rule: "Указательный и средний прямые, безымянный полусогнут [0, 1, 1, 1, 0]" },
  { symbol: "В", symbol_type: "letter", fingers: [0, 1, 1, 1, 1], label_ru: "Буква В", label_kg: "Тамга В", label_en: "Letter V", rule: "Четыре пальца сомкнуты и вытянуты вверх, большой к ладони [0, 1, 1, 1, 1]" },
  { symbol: "Г", symbol_type: "letter", fingers: [1, 1, 0, 0, 0], label_ru: "Буква Г", label_kg: "Тамга Г", label_en: "Letter G", rule: "Большой и указательный образуют прямой угол Г [1, 1, 0, 0, 0]" },
  { symbol: "Д", symbol_type: "letter", fingers: [0, 1, 1, 0, 0], label_ru: "Буква Д", label_kg: "Тамга Д", label_en: "Letter D", rule: "Указательный и средний прямые вверх (круговое движение) [0, 1, 1, 0, 0]" },
  { symbol: "Е", symbol_type: "letter", fingers: [0, 0, 0, 0, 0], label_ru: "Буква Е", label_kg: "Тамга Е", label_en: "Letter E", rule: "Все пальцы полусогнуты сводом к большому пальцу [0, 0, 0, 0, 0]" },
  { symbol: "Ж", symbol_type: "letter", fingers: [1, 1, 1, 1, 1], label_ru: "Буква Ж", label_kg: "Тамга Ж", label_en: "Letter ZH", rule: "Все 5 пальцев сведены пучком вперёд (бутон) [1, 1, 1, 1, 1]" },
  { symbol: "З", symbol_type: "letter", fingers: [0, 1, 0, 0, 0], label_ru: "Буква З", label_kg: "Тамга З", label_en: "Letter Z", rule: "Указательный палец рисует в воздухе контур буквы З [0, 1, 0, 0, 0]" },
  { symbol: "И", symbol_type: "letter", fingers: [0, 0, 0, 1, 1], label_ru: "Буква И", label_kg: "Тамга И", label_en: "Letter I", rule: "Безымянный и мизинец подняты вверх V-образно [0, 0, 0, 1, 1]" },
  { symbol: "К", symbol_type: "letter", fingers: [1, 1, 1, 0, 0], label_ru: "Буква К", label_kg: "Тамга К", label_en: "Letter K", rule: "Указательный и средний вверх, большой у основания среднего [1, 1, 1, 0, 0]" },
  { symbol: "Л", symbol_type: "letter", fingers: [0, 1, 1, 0, 0], label_ru: "Буква Л", label_kg: "Тамга Л", label_en: "Letter L", rule: "Указательный и средний разведены ножками Л [0, 1, 1, 0, 0]" },
  { symbol: "М", symbol_type: "letter", fingers: [0, 1, 1, 1, 0], label_ru: "Буква М", label_kg: "Тамга М", label_en: "Letter M", rule: "Указательный, средний и безымянный опущены тремя ножками М [0, 1, 1, 1, 0]" },
  { symbol: "Н", symbol_type: "letter", fingers: [0, 1, 1, 0, 1], label_ru: "Буква Н", label_kg: "Тамга Н", label_en: "Letter N", rule: "Безымянный прижат большим пальцем, остальные прямые [0, 1, 1, 0, 1]" },
  { symbol: "Ң", symbol_type: "letter", fingers: [0, 0, 0, 0, 1], label_ru: "Буква Ң (Кыргыз дактили)", label_kg: "Тамга Ң (Кыргыз дактили)", label_en: "Letter NG (Kyrgyz)", rule: "Мизинец строго вертикально вверх, остальные 4 пальца в кулаке [0, 0, 0, 0, 1]" },
  { symbol: "О", symbol_type: "letter", fingers: [0, 0, 1, 1, 1], label_ru: "Буква О", label_kg: "Тамга О", label_en: "Letter O", rule: "Большой и указательный смыкаются кольцом О, три пальца вверх [0, 0, 1, 1, 1]" },
  { symbol: "Ө", symbol_type: "letter", fingers: [1, 0, 1, 1, 1], label_ru: "Буква Ө (Кыргыз дактили)", label_kg: "Тамга Ө (Кыргыз дактили)", label_en: "Letter OE (Kyrgyz)", rule: "Округлое кольцо Ө с боковым разворотом кисти [1, 0, 1, 1, 1]" },
  { symbol: "П", symbol_type: "letter", fingers: [0, 1, 1, 0, 0], label_ru: "Буква П", label_kg: "Тамга П", label_en: "Letter P", rule: "Указательный и средний сомкнуты параллельно [0, 1, 1, 0, 0]" },
  { symbol: "Р", symbol_type: "letter", fingers: [0, 1, 0, 1, 1], label_ru: "Буква Р", label_kg: "Тамга Р", label_en: "Letter R", rule: "Средний палец прижат большим, указательный, безымянный и мизинец вверх [0, 1, 0, 1, 1]" },
  { symbol: "С", symbol_type: "letter", fingers: [1, 1, 0, 0, 0], label_ru: "Буква С", label_kg: "Тамга С", label_en: "Letter S", rule: "Большой и остальные пальцы изогнуты полумесяцем С [1, 1, 0, 0, 0]" },
  { symbol: "Т", symbol_type: "letter", fingers: [0, 1, 1, 1, 0], label_ru: "Буква Т", label_kg: "Тамга Т", label_en: "Letter T", rule: "Три пальца сомкнуты вместе [0, 1, 1, 1, 0]" },
  { symbol: "У", symbol_type: "letter", fingers: [1, 0, 0, 0, 1], label_ru: "Буква У", label_kg: "Тамга У", label_en: "Letter U", rule: "Отведены большой палец и мизинец, средние 3 пальца сжаты [1, 0, 0, 0, 1]" },
  { symbol: "Ү", symbol_type: "letter", fingers: [0, 1, 1, 0, 0], label_ru: "Буква Ү (Кыргыз дактили)", label_kg: "Тамга Ү (Кыргыз дактили)", label_en: "Letter UE (Kyrgyz)", rule: "Указательный и средний образуют чёткую V-рогатку Ү [0, 1, 1, 0, 0]" },
  { symbol: "Х", symbol_type: "letter", fingers: [0, 1, 0, 0, 0], label_ru: "Буква Х", label_kg: "Тамга Х", label_en: "Letter KH", rule: "Указательный палец согнут крючком [0, 1, 0, 0, 0]" },
  { symbol: "Ч", symbol_type: "letter", fingers: [1, 1, 1, 0, 0], label_ru: "Буква Ч", label_kg: "Тамга Ч", label_en: "Letter CH", rule: "Большой, указательный и средний смыкаются клювом [1, 1, 1, 0, 0]" },
  { symbol: "Ш", symbol_type: "letter", fingers: [0, 1, 1, 1, 0], label_ru: "Буква Ш", label_kg: "Тамга Ш", label_en: "Letter SH", rule: "Указательный, средний и безымянный широко расставлены вверх [0, 1, 1, 1, 0]" },
  { symbol: "Ы", symbol_type: "letter", fingers: [1, 1, 0, 0, 1], label_ru: "Буква Ы", label_kg: "Тамга Ы", label_en: "Letter Y", rule: "Вытянуты большой, указательный и мизинец [1, 1, 0, 0, 1]" },
  { symbol: "Э", symbol_type: "letter", fingers: [1, 1, 0, 0, 0], label_ru: "Буква Э", label_kg: "Тамга Э", label_en: "Letter E", rule: "Полукруг большого и указательного пальцев [1, 1, 0, 0, 0]" },
  { symbol: "Ю", symbol_type: "letter", fingers: [0, 0, 0, 0, 1], label_ru: "Буква Ю", label_kg: "Тамга Ю", label_en: "Letter YU", rule: "Мизинец отведён, остальные пальцы кольцом [0, 0, 0, 0, 1]" },
  { symbol: "Я", symbol_type: "letter", fingers: [0, 1, 1, 0, 0], label_ru: "Буква Я", label_kg: "Тамга Я", label_en: "Letter YA", rule: "Средний палец перекрещен с указательным [0, 1, 1, 0, 0]" }
];

export const mockVideoPresets = [
  {
    id: "preset_osh_digits",
    title: "ЦОН г. Ош: Замена паспорта + Талон № Б-257",
    filename: "tson_osh_ticket_B257.mp4",
    duration_sec: 14.0,
    fps: 30,
    badge: "Госуслуги • Буквы + Цифры",
    description: "Реальный сценарий глухого заявителя в ЦОН: жест приветствия, паспорт, буква серии талона «Б» и цифры «2», «5», «7»."
  },
  {
    id: "preset_dactyl_osh",
    title: "Дактиль + Числа: Код «О-Ш-2-0-2-7»",
    filename: "dactyl_digits_OSH2027.mp4",
    duration_sec: 12.0,
    fps: 30,
    badge: "Дактиль + Счёт 0–9",
    description: "Посимвольная передача букв «О», «Ш» и цифр «2», «0», «2», «7» перед камерой с отслеживанием 21 точки кисти."
  },
  {
    id: "preset_clinic_sos",
    title: "Поликлиника: Врач • Кабинет 104 • Помощь",
    filename: "hospital_room_104_help.webm",
    duration_sec: 10.0,
    fps: 30,
    badge: "Медицина • Экстренный вызов",
    description: "Обращение неслышащего пациента в регистратуру больницы: жест «Врач», номер кабинета «1-0-4» и жест «Помощь»."
  }
];

export const mockYouTubePresets = [
  {
    video_id: "feA64wXhbjo",
    url: "https://www.youtube.com/watch?v=feA64wXhbjo",
    title: "Дактильная азбука (А–Я, Ң, Ө, Ү) и счёт цифр (0–9)",
    tag: "Корпус #1: Азбука + Цифры"
  },
  {
    video_id: "v1desDduz5M",
    url: "https://www.youtube.com/watch?v=v1desDduz5M",
    title: "Жестовый язык в ЦОН и поликлинике (Диалог и номера окон)",
    tag: "Корпус #2: ЦОН / Госуслуги"
  },
  {
    video_id: "0FCWzMq4iWg",
    url: "https://www.youtube.com/watch?v=0FCWzMq4iWg",
    title: "Пальцевый счёт от 0 до 9 и быстрые дактильные связки",
    tag: "Корпус #3: Тренажёр цифр"
  },
  {
    video_id: "jNQXAC9IVRw",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    title: "Базовые жесты приветствия, медицины и экстренного вызова",
    tag: "Корпус #4: Медицина / SOS"
  }
];

export const mockSigns = [
  {
    id: "sign_salam",
    gloss_ky: "САЛАМ",
    gloss_ru: "Здравствуйте / Привет",
    category: "daily",
    fingers: [1, 1, 1, 1, 1],
    description_ky: "Ачык оң алакан чекеден алдыга карай жылат",
    video_demonstration_url: "/assets/signs/salam.mp4",
    is_two_handed: false,
    requires_facial_expression: true,
    duration_ms: 1200
  },
  {
    id: "sign_pasport",
    gloss_ky: "ПАСПОРТ",
    gloss_ru: "Паспорт",
    category: "public_service",
    fingers: [0, 1, 1, 1, 1],
    description_ky: "Сол алакан тик турат, оң кол төрт бурчтук тартат",
    video_demonstration_url: "/assets/signs/pasport.mp4",
    is_two_handed: true,
    requires_facial_expression: false,
    duration_ms: 1500
  },
  {
    id: "sign_rahmat",
    gloss_ky: "РАХМАТ",
    gloss_ru: "Спасибо / Благодарю",
    category: "daily",
    fingers: [1, 0, 0, 0, 0],
    description_ky: "Оң кол жүрөктүн тушунан алдыга карай таазим менен ачылат",
    video_demonstration_url: "/assets/signs/rahmat.mp4",
    is_two_handed: false,
    requires_facial_expression: true,
    duration_ms: 1100
  },
  {
    id: "sign_daryger",
    gloss_ky: "ДАРЫГЕР",
    gloss_ru: "Врач / Доктор",
    category: "medical",
    fingers: [0, 1, 1, 0, 0],
    description_ky: "Оң колдун эки манжасы сол билектин тамырын кармайт",
    video_demonstration_url: "/assets/signs/daryger.mp4",
    is_two_handed: true,
    requires_facial_expression: false,
    duration_ms: 1400
  },
  {
    id: "sign_jardam",
    gloss_ky: "ЖАРДАМ",
    gloss_ru: "Помощь",
    category: "public_service",
    fingers: [1, 0, 0, 0, 1],
    description_ky: "Оң муштум сол ачык алакандын үстүнө коюлуп, чогуу өйдө көтөрүлөт",
    video_demonstration_url: "/assets/signs/jardam.mp4",
    is_two_handed: true,
    requires_facial_expression: true,
    duration_ms: 1300
  },
  {
    id: "sign_spravka",
    gloss_ky: "СПРАВКА",
    gloss_ru: "Справка / Документ",
    category: "public_service",
    fingers: [1, 1, 0, 0, 0],
    description_ky: "Оң кол сол алаканга кол коюу кыймылын жасайт",
    video_demonstration_url: "/assets/signs/spravka.mp4",
    is_two_handed: true,
    requires_facial_expression: false,
    duration_ms: 1250
  },
  {
    id: "sign_dekanat",
    gloss_ky: "ДЕКАНАТ",
    gloss_ru: "Деканат / Факультет",
    category: "education",
    fingers: [1, 1, 1, 1, 1],
    description_ky: "Эки кол чатырча формасында биригип, капталга ачылат",
    video_demonstration_url: "/assets/signs/dekanat.mp4",
    is_two_handed: true,
    requires_facial_expression: false,
    duration_ms: 1350
  },
  {
    id: "sign_baa",
    gloss_ky: "БАА",
    gloss_ru: "Оценка / Балл",
    category: "education",
    fingers: [0, 1, 0, 0, 0],
    description_ky: "Сөөмөй менен абада бештик же канат белгиси сызылат",
    video_demonstration_url: "/assets/signs/baa.mp4",
    is_two_handed: false,
    requires_facial_expression: true,
    duration_ms: 1000
  },
  {
    id: "sign_oshsu",
    gloss_ky: "ОШГУ",
    gloss_ru: "ОшГУ / Университет",
    category: "education",
    fingers: [0, 0, 1, 1, 1],
    description_ky: "Оң кол «О» формасынан «У» формасына өтүп, алдыга сунулат",
    video_demonstration_url: "/assets/signs/oshsu.mp4",
    is_two_handed: false,
    requires_facial_expression: true,
    duration_ms: 1400
  },
  {
    id: "sign_men",
    gloss_ky: "МЕН",
    gloss_ru: "Я / Мен",
    category: "daily",
    fingers: [0, 1, 0, 0, 0],
    description_ky: "Оң сөөмөй өз төшүнө багытталат",
    video_demonstration_url: "/assets/signs/men.mp4",
    is_two_handed: false,
    requires_facial_expression: false,
    duration_ms: 900
  },
  {
    id: "sign_goodbye",
    gloss_ky: "ДО СВИДАНИЯ",
    gloss_ru: "До свидания / Пока",
    category: "daily",
    fingers: [1, 1, 1, 1, 0],
    description_ky: "Төрт манжа ачылып, кичинекей манжа бүгүлүп, кол эки жакка кыймылдайт",
    video_demonstration_url: "/assets/signs/goodbye.mp4",
    is_two_handed: false,
    requires_facial_expression: true,
    duration_ms: 1300
  },
  {
    id: "sign_please",
    gloss_ky: "ПОЖАЛУЙСТА",
    gloss_ru: "Пожалуйста / Прошу",
    category: "daily",
    fingers: [0, 0, 0, 1, 1],
    description_ky: "Ачык алакан көкүрөктөн алдыга тегерек кыймыл менен сунулат",
    video_demonstration_url: "/assets/signs/please.mp4",
    is_two_handed: false,
    requires_facial_expression: true,
    duration_ms: 1200
  }
];

export const mockDactylLetters = [
  {
    letter_char: "Ң",
    letter_name: "Кыргыз дактили Ң (Нг)",
    difficulty_level: 4,
    description_ky: "Чыпалак тик өйдө сунулган, калган манжалар муштумга түйүлгөн, баш бармак үстүнө басылган",
    target_angles: { thumb: 90.0, index: 90.0, middle: 90.0, ring: 90.0, pinky: 15.0 },
    sample_image_url: "/assets/dactyl/ng.png"
  },
  {
    letter_char: "Ө",
    letter_name: "Кыргыз дактили Ө",
    difficulty_level: 3,
    description_ky: "Бардык манжалардын учтары баш бармак менен биригип «Ө» тегерегин түзөт",
    target_angles: { thumb: 45.0, index: 50.0, middle: 50.0, ring: 50.0, pinky: 50.0 },
    sample_image_url: "/assets/dactyl/oe.png"
  },
  {
    letter_char: "Ү",
    letter_name: "Кыргыз дактили Ү",
    difficulty_level: 3,
    description_ky: "Сөөмөй жана ортон V-формасында ачылат, чыпалак менен аты жок алаканга бүгүлөт",
    target_angles: { thumb: 75.0, index: 10.0, middle: 10.0, ring: 90.0, pinky: 90.0 },
    sample_image_url: "/assets/dactyl/ue.png"
  },
  {
    letter_char: "А",
    letter_name: "Кыргыз дактили А",
    difficulty_level: 1,
    description_ky: "Бардык манжалар муштумга түйүлгөн, баш бармак сөөмөйдүн капталында түз турат",
    target_angles: { thumb: 15.0, index: 90.0, middle: 90.0, ring: 90.0, pinky: 90.0 },
    sample_image_url: "/assets/dactyl/a.png"
  },
  {
    letter_char: "Б",
    letter_name: "Кыргыз дактили Б",
    difficulty_level: 1,
    description_ky: "Төрт манжа өйдө тик турат, баш бармак алакандын ортосуна ийилген",
    target_angles: { thumb: 90.0, index: 10.0, middle: 10.0, ring: 10.0, pinky: 10.0 },
    sample_image_url: "/assets/dactyl/b.png"
  },
  {
    letter_char: "С",
    letter_name: "Кыргыз дактили С",
    difficulty_level: 2,
    description_ky: "Бардык манжалар C тамгасынын жарым тегерек формасында ийилген",
    target_angles: { thumb: 35.0, index: 40.0, middle: 40.0, ring: 40.0, pinky: 40.0 },
    sample_image_url: "/assets/dactyl/s.png"
  }
];

export const mockInitialDialogues = [
  {
    id: "d1",
    direction: "citizen",
    speaker: "Темирлан (Неслышащий гражданин • КЖЯ)",
    text_ky: "Салам! Мага паспортту алмаштыруу керек, талон Б-257.",
    text_ru: "Здравствуйте! Мне нужно заменить паспорт, талон Б-257.",
    time: "10:14"
  },
  {
    id: "d2",
    direction: "operator",
    speaker: "Айнура (Оператор ЦОН №1 г. Ош • Окно 3)",
    text_ky: "Саламатсызбы! Эски паспортуңузду жана туулгандыгы тууралуу күбөлүктү бериңиз.",
    text_ru: "Здравствуйте! Предоставьте ваш старый паспорт и свидетельство о рождении.",
    time: "10:15"
  }
];

export function buildLandmarks21FromFingers(fingerStates = [0, 1, 1, 0, 0], angleDeg = 0) {
  const pts = [{ x: 0.5, y: 0.84, z: 0 }];
  const specs = [
    { idx: 0, dx: -0.15, extStep: -0.055, foldStep: -0.015 },
    { idx: 1, dx: -0.075, extStep: -0.09, foldStep: -0.018 },
    { idx: 2, dx: 0.0, extStep: -0.10, foldStep: -0.018 },
    { idx: 3, dx: 0.065, extStep: -0.092, foldStep: -0.018 },
    { idx: 4, dx: 0.125, extStep: -0.075, foldStep: -0.016 }
  ];
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  for (const sp of specs) {
    const isExt = (fingerStates[sp.idx] || 0) >= 1;
    const mcpX = 0.5 + sp.dx;
    const mcpY = sp.idx === 0 ? 0.73 : 0.63;
    for (let j = 1; j <= 4; j++) {
      let px = mcpX;
      let py = mcpY;
      let pz = 0;
      if (j > 1) {
        if (isExt) {
          px = mcpX + (sp.idx === 0 ? sp.dx * 0.22 * (j - 1) : sp.dx * 0.06 * (j - 1));
          py = mcpY + sp.extStep * (j - 1);
          pz = -0.01 * j;
        } else {
          px = mcpX * 0.95 + 0.025;
          py = mcpY + (j === 2 ? sp.foldStep : Math.abs(sp.foldStep) * (j - 1.8));
          pz = 0.03 * j;
        }
      }
      const rx = 0.5 + (px - 0.5) * cosA - (py - 0.84) * sinA;
      const ry = 0.84 + (px - 0.5) * sinA + (py - 0.84) * cosA;
      pts.push({
        x: Number(rx.toFixed(4)),
        y: Number(ry.toFixed(4)),
        z: Number(pz.toFixed(4))
      });
    }
  }
  return pts;
}
