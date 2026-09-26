import type { EventType, L10n } from '../contracts/types';
import { COUPLE_EVENTS } from './seed-copy';

/**
 * The sample people of the demo invitations (demo.ts) and of the template posters (app/poster.ts) —
 * kept apart from the demo builder so the gallery doesn't load it.
 */
export interface DemoPeople {
  primary: L10n;
  secondary?: L10n;
  parents?: L10n;
  monogram?: L10n;
}

// every sample in every invitation language — the same people, written the way each language writes
// their names
const LEVI_PARENTS: L10n = {
  he: 'מיכל ודוד לוי',
  en: 'Michal & David Levi',
  ru: 'Михаль и Давид Леви',
  ar: 'ميخال ودافيد ليفي',
  fr: 'Michal et David Lévy',
  es: 'Michal y David Leví',
  am: 'ሚካል እና ዳዊት ሌቪ',
};
const PEOPLE: Partial<Record<EventType, DemoPeople>> = {
  bar_mitzvah: {
    primary: {
      he: 'יונתן',
      en: 'Jonathan',
      ru: 'Йонатан',
      ar: 'يوناتان',
      fr: 'Jonathan',
      es: 'Jonatán',
      am: 'ዮናታን',
    },
    parents: LEVI_PARENTS,
    monogram: { he: 'י', en: 'J', ru: 'Й', ar: 'ي', fr: 'J', es: 'J', am: 'ዮ' },
  },
  bat_mitzvah: {
    primary: { he: 'תמר', en: 'Tamar', ru: 'Тамар', ar: 'تامار', fr: 'Tamar', es: 'Tamar', am: 'ታማር' },
    parents: LEVI_PARENTS,
    monogram: { he: 'ת', en: 'T', ru: 'Т', ar: 'ت', fr: 'T', es: 'T', am: 'ታ' },
  },
  brit: {
    primary: {
      he: 'שירה ואורי',
      en: 'Shira & Ori',
      ru: 'Шира и Ори',
      ar: 'شيرا وأوري',
      fr: 'Shira et Ori',
      es: 'Shira y Ori',
      am: 'ሺራ እና ኦሪ',
    },
    parents: {
      he: 'סבא וסבתא: רות ומשה כהן',
      en: 'Grandparents Ruth & Moshe Cohen',
      ru: 'Бабушка и дедушка: Рут и Моше Коэн',
      ar: 'الجدّان: روت وموشيه كوهين',
      fr: 'Les grands-parents Ruth et Moshé Cohen',
      es: 'Los abuelos Ruth y Moshé Cohen',
      am: 'አያቶች፦ ሩት እና ሞሼ ኮኸን',
    },
    monogram: { he: 'ש&א', en: 'S&O', ru: 'Ш&О', ar: 'ش&أ', fr: 'S&O', es: 'S&O', am: 'ሺ&ኦ' },
  },
  baby_shower: {
    primary: { he: 'מאיה', en: 'Maya', ru: 'Майя', ar: 'مايا', fr: 'Maya', es: 'Maya', am: 'ማያ' },
    monogram: { he: 'מ', en: 'M', ru: 'М', ar: 'م', fr: 'M', es: 'M', am: 'ማ' },
  },
  birthday: {
    primary: { he: 'דנה', en: 'Dana', ru: 'Дана', ar: 'دانا', fr: 'Dana', es: 'Dana', am: 'ዳና' },
    monogram: {
      he: 'דנה 30',
      en: 'DANA 30',
      ru: 'ДАНА 30',
      ar: 'دانا 30',
      fr: 'DANA 30',
      es: 'DANA 30',
      am: 'ዳና 30',
    },
  },
  corporate: {
    primary: {
      he: 'צוות אקמה',
      en: 'Team Acme',
      ru: 'Команда Acme',
      ar: 'فريق أكمي',
      fr: "L'équipe Acme",
      es: 'Equipo Acme',
      am: 'የአክሜ ቡድን',
    },
    monogram: { he: 'אקמה', en: 'ACME', ru: 'ACME', ar: 'أكمي', fr: 'ACME', es: 'ACME', am: 'አክሜ' },
  },
};
const COUPLE: DemoPeople = {
  primary: { he: 'נועה', en: 'Noa', ru: 'Ноа', ar: 'نوعا', fr: 'Noa', es: 'Noa', am: 'ኖዓ' },
  secondary: { he: 'איתי', en: 'Itay', ru: 'Итай', ar: 'إيتاي', fr: 'Itay', es: 'Itay', am: 'ኢታይ' },
  parents: {
    he: 'מרים ודני לוי · רונית ואבי כהן',
    en: 'Miriam & Dani Levi · Ronit & Avi Cohen',
    ru: 'Мирьям и Дани Леви · Ронит и Ави Коэн',
    ar: 'مريام وداني ليفي · رونيت وآفي كوهين',
    fr: 'Miriam et Dani Lévy · Ronit et Avi Cohen',
    es: 'Miriam y Dani Leví · Ronit y Avi Cohen',
    am: 'ሚርያም እና ዳኒ ሌቪ · ሮኒት እና አቪ ኮኸን',
  },
};

/**
 * Designs made for one age or crowd show a person who fits them — a toddler's third birthday, a
 * grandmother's eightieth — instead of the event type's sample: by template id, then event type.
 */
const TEMPLATE_PEOPLE: Record<string, Partial<Record<EventType, DemoPeople>>> = {
  // T1: little ones
  'safari-pals': {
    birthday: {
      primary: { he: 'יואב', en: 'Yoav', ru: 'Йоав', ar: 'يوآف', fr: 'Yoav', es: 'Yoav', am: 'ዮአቭ' },
      monogram: {
        he: 'יואב 1',
        en: 'YOAV 1',
        ru: 'ЙОАВ 1',
        ar: 'يوآف 1',
        fr: 'YOAV 1',
        es: 'YOAV 1',
        am: 'ዮአቭ 1',
      },
    },
    brit: {
      primary: {
        he: 'הדר ועומר',
        en: 'Hadar & Omer',
        ru: 'Хадар и Омер',
        ar: 'هدار وعومر',
        fr: 'Hadar et Omer',
        es: 'Hadar y Omer',
        am: 'ሀዳር እና ኦሜር',
      },
      parents: {
        he: 'סבא וסבתא: אורית ויוסי מזרחי',
        en: 'Grandparents Orit & Yossi Mizrahi',
        ru: 'Бабушка и дедушка: Орит и Йоси Мизрахи',
        ar: 'الجدّان: أوريت ويوسي مزراحي',
        fr: 'Les grands-parents Orit et Yossi Mizrahi',
        es: 'Los abuelos Orit y Yossi Mizrahi',
        am: 'አያቶች፦ ኦሪት እና ዮሲ ሚዝራሒ',
      },
      monogram: { he: 'ה&ע', en: 'H&O', ru: 'Х&О', ar: 'ه&ع', fr: 'H&O', es: 'H&O', am: 'ሀ&ኦ' },
    },
    baby_shower: {
      primary: { he: 'יעל', en: 'Yael', ru: 'Яэль', ar: 'ياعيل', fr: 'Yaël', es: 'Yael', am: 'ያኤል' },
      monogram: { he: 'י', en: 'Y', ru: 'Я', ar: 'ي', fr: 'Y', es: 'Y', am: 'ያ' },
    },
  },
  'dig-it': {
    birthday: {
      primary: { he: 'איתן', en: 'Etan', ru: 'Эйтан', ar: 'إيتان', fr: 'Etan', es: 'Etan', am: 'ኤታን' },
      monogram: {
        he: 'איתן 3',
        en: 'ETAN 3',
        ru: 'ЭЙТАН 3',
        ar: 'إيتان 3',
        fr: 'ETAN 3',
        es: 'ETAN 3',
        am: 'ኤታን 3',
      },
    },
  },
  'ocean-friends': {
    birthday: {
      primary: { he: 'נוי', en: 'Noy', ru: 'Нои', ar: 'نوي', fr: 'Noy', es: 'Noy', am: 'ኖይ' },
      monogram: { he: 'נוי 4', en: 'NOY 4', ru: 'НОИ 4', ar: 'نوي 4', fr: 'NOY 4', es: 'NOY 4', am: 'ኖይ 4' },
    },
    baby_shower: {
      primary: { he: 'שני', en: 'Shani', ru: 'Шани', ar: 'شاني', fr: 'Shani', es: 'Shani', am: 'ሻኒ' },
      monogram: { he: 'ש', en: 'S', ru: 'Ш', ar: 'ش', fr: 'S', es: 'S', am: 'ሻ' },
    },
    brit: {
      primary: {
        he: 'רוני ועמית',
        en: 'Roni & Amit',
        ru: 'Рони и Амит',
        ar: 'روني وعميت',
        fr: 'Roni et Amit',
        es: 'Roni y Amit',
        am: 'ሮኒ እና አሚት',
      },
      parents: {
        he: 'סבא וסבתא: דליה ושמעון לוי',
        en: 'Grandparents Dalia & Shimon Levi',
        ru: 'Бабушка и дедушка: Далия и Шимон Леви',
        ar: 'الجدّان: داليا وشمعون ليفي',
        fr: 'Les grands-parents Dalia et Shimon Lévy',
        es: 'Los abuelos Dalia y Shimon Leví',
        am: 'አያቶች፦ ዳሊያ እና ሺሞን ሌቪ',
      },
      monogram: { he: 'ר&ע', en: 'R&A', ru: 'Р&А', ar: 'ر&ع', fr: 'R&A', es: 'R&A', am: 'ሮ&አ' },
    },
  },
  'rocket-launch': {
    birthday: {
      primary: { he: 'אורי', en: 'Ori', ru: 'Ори', ar: 'أوري', fr: 'Ori', es: 'Ori', am: 'ኦሪ' },
      monogram: {
        he: 'אורי 7',
        en: 'ORI 7',
        ru: 'ОРИ 7',
        ar: 'أوري 7',
        fr: 'ORI 7',
        es: 'ORI 7',
        am: 'ኦሪ 7',
      },
    },
    bar_mitzvah: {
      primary: {
        he: 'איתמר',
        en: 'Itamar',
        ru: 'Итамар',
        ar: 'إيتمار',
        fr: 'Itamar',
        es: 'Itamar',
        am: 'ኢታማር',
      },
      parents: {
        he: 'קרן ואלון שגיא',
        en: 'Keren & Alon Sagi',
        ru: 'Керен и Алон Саги',
        ar: 'كيرن وألون ساغي',
        fr: 'Keren et Alon Sagi',
        es: 'Keren y Alon Sagi',
        am: 'ኬሬን እና አሎን ሳጊ',
      },
      monogram: { he: 'א', en: 'I', ru: 'И', ar: 'إ', fr: 'I', es: 'I', am: 'ኢ' },
    },
  },
  'unicorn-dream': {
    birthday: {
      primary: { he: 'מיקה', en: 'Mika', ru: 'Мика', ar: 'ميكا', fr: 'Mika', es: 'Mika', am: 'ሚካ' },
      monogram: {
        he: 'מיקה 6',
        en: 'MIKA 6',
        ru: 'МИКА 6',
        ar: 'ميكا 6',
        fr: 'MIKA 6',
        es: 'MIKA 6',
        am: 'ሚካ 6',
      },
    },
    bat_mitzvah: {
      primary: { he: 'אלה', en: 'Ella', ru: 'Элла', ar: 'إيلا', fr: 'Ella', es: 'Ella', am: 'ኤላ' },
      parents: {
        he: 'רותם ויואב ברק',
        en: 'Rotem & Yoav Barak',
        ru: 'Ротем и Йоав Барак',
        ar: 'روتم ويوآف باراك',
        fr: 'Rotem et Yoav Barak',
        es: 'Rotem y Yoav Barak',
        am: 'ሮቴም እና ዮአቭ ባራክ',
      },
      monogram: { he: 'א', en: 'E', ru: 'Э', ar: 'إ', fr: 'E', es: 'E', am: 'ኤ' },
    },
  },
  // T4: grown-ups & golden years
  'tropical-tiki': {
    birthday: {
      primary: { he: 'יעל', en: 'Yael', ru: 'Яэль', ar: 'ياعيل', fr: 'Yaël', es: 'Yael', am: 'ያኤል' },
      monogram: {
        he: 'יעל 35',
        en: 'YAEL 35',
        ru: 'ЯЭЛЬ 35',
        ar: 'ياعيل 35',
        fr: 'YAËL 35',
        es: 'YAEL 35',
        am: 'ያኤል 35',
      },
    },
    other: {
      primary: {
        he: 'יעל ורון',
        en: 'Yael & Ron',
        ru: 'Яэль и Рон',
        ar: 'ياعيل ورون',
        fr: 'Yaël et Ron',
        es: 'Yael y Ron',
        am: 'ያኤል እና ሮን',
      },
      monogram: { he: 'י&ר', en: 'Y&R', ru: 'Я&Р', ar: 'ي&ر', fr: 'Y&R', es: 'Y&R', am: 'ያ&ሮ' },
    },
  },
  'vineyard-harvest': {
    birthday: {
      primary: { he: 'אבי', en: 'Avi', ru: 'Ави', ar: 'آفي', fr: 'Avi', es: 'Avi', am: 'አቪ' },
      monogram: {
        he: 'אבי 60',
        en: 'AVI 60',
        ru: 'АВИ 60',
        ar: 'آفي 60',
        fr: 'AVI 60',
        es: 'AVI 60',
        am: 'አቪ 60',
      },
    },
  },
  'campfire-night': {
    birthday: {
      primary: { he: 'תום', en: 'Tom', ru: 'Том', ar: 'توم', fr: 'Tom', es: 'Tom', am: 'ቶም' },
      monogram: {
        he: 'תום 11',
        en: 'TOM 11',
        ru: 'ТОМ 11',
        ar: 'توم 11',
        fr: 'TOM 11',
        es: 'TOM 11',
        am: 'ቶም 11',
      },
    },
    bar_mitzvah: PEOPLE.bar_mitzvah,
    other: {
      primary: {
        he: 'משפחת כהן',
        en: 'The Cohens',
        ru: 'Семья Коэн',
        ar: 'عائلة كوهين',
        fr: 'La famille Cohen',
        es: 'La familia Cohen',
        am: 'የኮኸን ቤተሰብ',
      },
      monogram: { he: 'כהן', en: 'COHEN', ru: 'КОЭН', ar: 'كوهين', fr: 'COHEN', es: 'COHEN', am: 'ኮኸን' },
    },
  },
  'golden-years': {
    birthday: {
      primary: { he: 'משה', en: 'Moshe', ru: 'Моше', ar: 'موشيه', fr: 'Moshé', es: 'Moshé', am: 'ሞሼ' },
      monogram: {
        he: 'משה 80',
        en: 'MOSHE 80',
        ru: 'МОШЕ 80',
        ar: 'موشيه 80',
        fr: 'MOSHÉ 80',
        es: 'MOSHÉ 80',
        am: 'ሞሼ 80',
      },
    },
    other: {
      primary: {
        he: 'רחל ומשה',
        en: 'Rachel & Moshe',
        ru: 'Рахель и Моше',
        ar: 'راحيل وموشيه',
        fr: 'Rachel et Moshé',
        es: 'Rachel y Moshé',
        am: 'ራሔል እና ሞሼ',
      },
      monogram: { he: 'ר&מ', en: 'R&M', ru: 'Р&М', ar: 'ر&م', fr: 'R&M', es: 'R&M', am: 'ራ&ሞ' },
    },
  },
  'grandma-garden': {
    birthday: {
      primary: { he: 'רחל', en: 'Rachel', ru: 'Рахель', ar: 'راحيل', fr: 'Rachel', es: 'Rachel', am: 'ራሔል' },
      monogram: {
        he: 'רחל 90',
        en: 'RACHEL 90',
        ru: 'РАХЕЛЬ 90',
        ar: 'راحيل 90',
        fr: 'RACHEL 90',
        es: 'RACHEL 90',
        am: 'ራሔል 90',
      },
    },
    other: {
      primary: {
        he: 'משפחת לוי',
        en: 'The Levis',
        ru: 'Семья Леви',
        ar: 'عائلة ليفي',
        fr: 'La famille Lévy',
        es: 'La familia Leví',
        am: 'የሌቪ ቤተሰብ',
      },
      monogram: { he: 'לוי', en: 'LEVI', ru: 'ЛЕВИ', ar: 'ليفي', fr: 'LÉVY', es: 'LEVÍ', am: 'ሌቪ' },
    },
  },
  // T2: sports & action — a kid of the design's age for its birthdays; its bar/bat mitzvahs keep the
  // event's own Jonathan and Tamar
  'hoop-stars': {
    birthday: {
      primary: { he: 'אלון', en: 'Alon', ru: 'Алон', ar: 'ألون', fr: 'Alon', es: 'Alon', am: 'አሎን' },
      monogram: {
        he: 'אלון 10',
        en: 'ALON 10',
        ru: 'АЛОН 10',
        ar: 'ألون 10',
        fr: 'ALON 10',
        es: 'ALON 10',
        am: 'አሎን 10',
      },
    },
    bar_mitzvah: PEOPLE.bar_mitzvah,
    bat_mitzvah: PEOPLE.bat_mitzvah,
  },
  'superhero-pow': {
    birthday: {
      primary: { he: 'רועי', en: 'Roy', ru: 'Рои', ar: 'روعي', fr: 'Roy', es: 'Roy', am: 'ሮይ' },
      monogram: {
        he: 'רועי 8',
        en: 'ROY 8',
        ru: 'РОИ 8',
        ar: 'روعي 8',
        fr: 'ROY 8',
        es: 'ROY 8',
        am: 'ሮይ 8',
      },
    },
    bar_mitzvah: PEOPLE.bar_mitzvah,
  },
  'circus-top': {
    birthday: {
      primary: { he: 'שירה', en: 'Shira', ru: 'Шира', ar: 'شيرا', fr: 'Shira', es: 'Shira', am: 'ሺራ' },
      monogram: {
        he: 'שירה 5',
        en: 'SHIRA 5',
        ru: 'ШИРА 5',
        ar: 'شيرا 5',
        fr: 'SHIRA 5',
        es: 'SHIRA 5',
        am: 'ሺራ 5',
      },
    },
  },
  'grand-prix': {
    birthday: {
      primary: { he: 'עומר', en: 'Omer', ru: 'Омер', ar: 'عومر', fr: 'Omer', es: 'Omer', am: 'ኦሜር' },
      monogram: {
        he: 'עומר 9',
        en: 'OMER 9',
        ru: 'ОМЕР 9',
        ar: 'عومر 9',
        fr: 'OMER 9',
        es: 'OMER 9',
        am: 'ኦሜር 9',
      },
    },
    bar_mitzvah: PEOPLE.bar_mitzvah,
  },
  'skate-graffiti': {
    bar_mitzvah: PEOPLE.bar_mitzvah,
    bat_mitzvah: PEOPLE.bat_mitzvah,
    birthday: {
      primary: { he: 'נדב', en: 'Nadav', ru: 'Надав', ar: 'ناداف', fr: 'Nadav', es: 'Nadav', am: 'ናዳቭ' },
      monogram: {
        he: 'נדב 14',
        en: 'NADAV 14',
        ru: 'НАДАВ 14',
        ar: 'ناداف 14',
        fr: 'NADAV 14',
        es: 'NADAV 14',
        am: 'ናዳቭ 14',
      },
    },
  },
  // T3: teens & music
  'pixel-quest': {
    birthday: {
      primary: { he: 'גיא', en: 'Guy', ru: 'Гай', ar: 'غاي', fr: 'Guy', es: 'Guy', am: 'ጋይ' },
      monogram: {
        he: 'גיא 12',
        en: 'GUY 12',
        ru: 'ГАЙ 12',
        ar: 'غاي 12',
        fr: 'GUY 12',
        es: 'GUY 12',
        am: 'ጋይ 12',
      },
    },
    bar_mitzvah: PEOPLE.bar_mitzvah!,
    bat_mitzvah: PEOPLE.bat_mitzvah!,
  },
  'disco-ball': {
    birthday: {
      primary: { he: 'נועה', en: 'Noa', ru: 'Ноа', ar: 'نوعا', fr: 'Noa', es: 'Noa', am: 'ኖዓ' },
      monogram: {
        he: 'נועה 16',
        en: 'NOA 16',
        ru: 'НОА 16',
        ar: 'نوعا 16',
        fr: 'NOA 16',
        es: 'NOA 16',
        am: 'ኖዓ 16',
      },
    },
  },
  'ballet-rose': {
    birthday: {
      primary: { he: 'אלה', en: 'Ella', ru: 'Элла', ar: 'إيلا', fr: 'Ella', es: 'Ella', am: 'ኤላ' },
      monogram: {
        he: 'אלה 8',
        en: 'ELLA 8',
        ru: 'ЭЛЛА 8',
        ar: 'إيلا 8',
        fr: 'ELLA 8',
        es: 'ELLA 8',
        am: 'ኤላ 8',
      },
    },
  },
  'vinyl-groove': {
    birthday: {
      primary: { he: 'רון', en: 'Ron', ru: 'Рон', ar: 'رون', fr: 'Ron', es: 'Ron', am: 'ሮን' },
      monogram: {
        he: 'רון 40',
        en: 'RON 40',
        ru: 'РОН 40',
        ar: 'رون 40',
        fr: 'RON 40',
        es: 'RON 40',
        am: 'ሮን 40',
      },
    },
  },
  'retro-80s': {
    birthday: {
      primary: { he: 'מיכל', en: 'Michal', ru: 'Михаль', ar: 'ميخال', fr: 'Michal', es: 'Michal', am: 'ሚካል' },
      monogram: {
        he: 'מיכל 45',
        en: 'MICHAL 45',
        ru: 'МИХАЛЬ 45',
        ar: 'ميخال 45',
        fr: 'MICHAL 45',
        es: 'MICHAL 45',
        am: 'ሚካል 45',
      },
    },
  },
};

/**
 * Who a demo of this event type is for: the design's own sample person when it has one, else a
 * couple, or the event's own sample person — the same people in every language.
 */
export function demoPeople(type: EventType, templateId?: string): DemoPeople {
  const own = templateId ? TEMPLATE_PEOPLE[templateId]?.[type] : undefined;
  const sample = COUPLE_EVENTS.includes(type) ? COUPLE : (PEOPLE[type] ?? COUPLE);
  return own ?? sample;
}
