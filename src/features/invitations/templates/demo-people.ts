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
