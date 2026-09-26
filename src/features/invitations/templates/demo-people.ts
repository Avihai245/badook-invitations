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
