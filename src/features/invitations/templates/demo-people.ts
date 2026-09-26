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
    birthday: { primary: { he: 'יואב', en: 'Yoav' }, monogram: { he: 'יואב 1', en: 'YOAV 1' } },
    brit: {
      primary: { he: 'הדר ועומר', en: 'Hadar & Omer' },
      parents: { he: 'סבא וסבתא: אורית ויוסי מזרחי', en: 'Grandparents Orit & Yossi Mizrahi' },
      monogram: { he: 'ה&ע', en: 'H&O' },
    },
    baby_shower: { primary: { he: 'יעל', en: 'Yael' }, monogram: { he: 'י', en: 'Y' } },
  },
  'dig-it': { birthday: { primary: { he: 'איתן', en: 'Etan' }, monogram: { he: 'איתן 3', en: 'ETAN 3' } } },
  'ocean-friends': {
    birthday: { primary: { he: 'נוי', en: 'Noy' }, monogram: { he: 'נוי 4', en: 'NOY 4' } },
    baby_shower: { primary: { he: 'שני', en: 'Shani' }, monogram: { he: 'ש', en: 'S' } },
    brit: {
      primary: { he: 'רוני ועמית', en: 'Roni & Amit' },
      parents: { he: 'סבא וסבתא: דליה ושמעון לוי', en: 'Grandparents Dalia & Shimon Levi' },
      monogram: { he: 'ר&ע', en: 'R&A' },
    },
  },
  'rocket-launch': {
    birthday: { primary: { he: 'אורי', en: 'Ori' }, monogram: { he: 'אורי 7', en: 'ORI 7' } },
    bar_mitzvah: {
      primary: { he: 'איתמר', en: 'Itamar' },
      parents: { he: 'קרן ואלון שגיא', en: 'Keren & Alon Sagi' },
      monogram: { he: 'א', en: 'I' },
    },
  },
  'unicorn-dream': {
    birthday: { primary: { he: 'מיקה', en: 'Mika' }, monogram: { he: 'מיקה 6', en: 'MIKA 6' } },
    bat_mitzvah: {
      primary: { he: 'אלה', en: 'Ella' },
      parents: { he: 'רותם ויואב ברק', en: 'Rotem & Yoav Barak' },
      monogram: { he: 'א', en: 'E' },
    },
  },
  // T4: grown-ups & golden years
  'tropical-tiki': {
    birthday: { primary: { he: 'יעל', en: 'Yael' }, monogram: { he: 'יעל 35', en: 'YAEL 35' } },
    other: { primary: { he: 'יעל ורון', en: 'Yael & Ron' }, monogram: { he: 'י&ר', en: 'Y&R' } },
  },
  'vineyard-harvest': {
    birthday: { primary: { he: 'אבי', en: 'Avi' }, monogram: { he: 'אבי 60', en: 'AVI 60' } },
  },
  'campfire-night': {
    birthday: { primary: { he: 'תום', en: 'Tom' }, monogram: { he: 'תום 11', en: 'TOM 11' } },
    bar_mitzvah: {
      primary: { he: 'יונתן', en: 'Jonathan' },
      parents: { he: 'מיכל ודוד לוי', en: 'Michal & David Levi' },
      monogram: { he: 'י', en: 'J' },
    },
    other: { primary: { he: 'משפחת כהן', en: 'The Cohens' }, monogram: { he: 'כהן', en: 'COHEN' } },
  },
  'golden-years': {
    birthday: { primary: { he: 'משה', en: 'Moshe' }, monogram: { he: 'משה 80', en: 'MOSHE 80' } },
    other: { primary: { he: 'רחל ומשה', en: 'Rachel & Moshe' }, monogram: { he: 'ר&מ', en: 'R&M' } },
  },
  'grandma-garden': {
    birthday: { primary: { he: 'רחל', en: 'Rachel' }, monogram: { he: 'רחל 90', en: 'RACHEL 90' } },
    other: { primary: { he: 'משפחת לוי', en: 'The Levis' }, monogram: { he: 'לוי', en: 'LEVI' } },
  },
  // T2: sports & action — a kid of the design's age for its birthdays; its bar/bat mitzvahs keep the
  // event's own Jonathan and Tamar
  'hoop-stars': {
    birthday: { primary: { he: 'אלון', en: 'Alon' }, monogram: { he: 'אלון 10', en: 'ALON 10' } },
    bar_mitzvah: PEOPLE.bar_mitzvah,
    bat_mitzvah: PEOPLE.bat_mitzvah,
  },
  'superhero-pow': {
    birthday: { primary: { he: 'רועי', en: 'Roy' }, monogram: { he: 'רועי 8', en: 'ROY 8' } },
    bar_mitzvah: PEOPLE.bar_mitzvah,
  },
  'circus-top': {
    birthday: { primary: { he: 'שירה', en: 'Shira' }, monogram: { he: 'שירה 5', en: 'SHIRA 5' } },
  },
  'grand-prix': {
    birthday: { primary: { he: 'עומר', en: 'Omer' }, monogram: { he: 'עומר 9', en: 'OMER 9' } },
    bar_mitzvah: PEOPLE.bar_mitzvah,
  },
  'skate-graffiti': {
    bar_mitzvah: PEOPLE.bar_mitzvah,
    bat_mitzvah: PEOPLE.bat_mitzvah,
    birthday: { primary: { he: 'נדב', en: 'Nadav' }, monogram: { he: 'נדב 14', en: 'NADAV 14' } },
  },
  // T3: teens & music
  'pixel-quest': {
    birthday: { primary: { he: 'גיא', en: 'Guy' }, monogram: { he: 'גיא 12', en: 'GUY 12' } },
    bar_mitzvah: PEOPLE.bar_mitzvah!,
    bat_mitzvah: PEOPLE.bat_mitzvah!,
  },
  'disco-ball': {
    birthday: { primary: { he: 'נועה', en: 'Noa' }, monogram: { he: 'נועה 16', en: 'NOA 16' } },
  },
  'ballet-rose': {
    birthday: { primary: { he: 'אלה', en: 'Ella' }, monogram: { he: 'אלה 8', en: 'ELLA 8' } },
  },
  'vinyl-groove': {
    birthday: { primary: { he: 'רון', en: 'Ron' }, monogram: { he: 'רון 40', en: 'RON 40' } },
  },
  'retro-80s': {
    birthday: { primary: { he: 'מיכל', en: 'Michal' }, monogram: { he: 'מיכל 45', en: 'MICHAL 45' } },
  },
};

/** The Hebrew and English of `own`, the other languages from `other` (when it has the text). */
const completed = (own: L10n, other: L10n | undefined): L10n => ({ ...other, ...own });

/**
 * Who a demo of this event type is for: the design's own sample person when it has one, else a
 * couple, or the event's own sample person. A design's own person is written in Hebrew and English:
 * the other languages show the event's sample.
 */
export function demoPeople(type: EventType, templateId?: string): DemoPeople {
  const own = templateId ? TEMPLATE_PEOPLE[templateId]?.[type] : undefined;
  const sample = COUPLE_EVENTS.includes(type) ? COUPLE : (PEOPLE[type] ?? COUPLE);
  if (!own) return sample;
  return {
    primary: completed(own.primary, sample.primary),
    ...(own.secondary ? { secondary: completed(own.secondary, sample.secondary) } : {}),
    ...(own.parents ? { parents: completed(own.parents, sample.parents) } : {}),
    ...(own.monogram ? { monogram: completed(own.monogram, sample.monogram) } : {}),
  };
}
