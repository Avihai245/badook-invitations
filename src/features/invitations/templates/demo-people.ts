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

/** Who a demo of this event type is for: a couple, or the event's own sample person. */
export function demoPeople(type: EventType): DemoPeople {
  return COUPLE_EVENTS.includes(type) ? COUPLE : (PEOPLE[type] ?? COUPLE);
}
