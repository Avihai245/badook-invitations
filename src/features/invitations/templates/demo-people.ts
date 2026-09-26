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

const PEOPLE: Partial<Record<EventType, DemoPeople>> = {
  bar_mitzvah: {
    primary: { he: 'יונתן', en: 'Jonathan' },
    parents: { he: 'מיכל ודוד לוי', en: 'Michal & David Levi' },
    monogram: { he: 'י', en: 'J' },
  },
  bat_mitzvah: {
    primary: { he: 'תמר', en: 'Tamar' },
    parents: { he: 'מיכל ודוד לוי', en: 'Michal & David Levi' },
    monogram: { he: 'ת', en: 'T' },
  },
  brit: {
    primary: { he: 'שירה ואורי', en: 'Shira & Ori' },
    parents: { he: 'סבא וסבתא: רות ומשה כהן', en: 'Grandparents Ruth & Moshe Cohen' },
    monogram: { he: 'ש&א', en: 'S&O' },
  },
  baby_shower: { primary: { he: 'מאיה', en: 'Maya' }, monogram: { he: 'מ', en: 'M' } },
  birthday: { primary: { he: 'דנה', en: 'Dana' }, monogram: { he: 'דנה 30', en: 'DANA 30' } },
  corporate: { primary: { he: 'צוות אקמה', en: 'Team Acme' }, monogram: { he: 'אקמה', en: 'ACME' } },
};
const COUPLE: DemoPeople = {
  primary: { he: 'נועה', en: 'Noa' },
  secondary: { he: 'איתי', en: 'Itay' },
  parents: { he: 'מרים ודני לוי · רונית ואבי כהן', en: 'Miriam & Dani Levi · Ronit & Avi Cohen' },
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

/**
 * Who a demo of this event type is for: the design's own sample person when it has one, else a
 * couple, or the event's own sample person.
 */
export function demoPeople(type: EventType, templateId?: string): DemoPeople {
  const own = templateId ? TEMPLATE_PEOPLE[templateId]?.[type] : undefined;
  if (own) return own;
  return COUPLE_EVENTS.includes(type) ? COUPLE : (PEOPLE[type] ?? COUPLE);
}
