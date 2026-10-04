import type { UiLocale } from '@/lib/i18n/app';
import { isCategoryKey, type CategoryKey } from './categories';
import { addDays, isIsoDate } from './payment-terms';

/**
 * The tasks proposed when a vendor is closed: the contract, the deposit, the coordination call and the
 * final confirmation, dated around today and the event. Never in the past; when little time is left the
 * four are compressed into it (the event is tomorrow: all of them today, the confirmation last). Pure —
 * the host sees them as checkboxes in the closing dialog and nothing is saved until they choose.
 */

export type FollowUpKey = 'contract' | 'deposit' | 'coordination' | 'confirmation';

export interface FollowUp {
  key: FollowUpKey;
  title: string;
  /** YYYY-MM-DD; null when it hangs on an event date that is not set */
  dueDate: string | null;
  category: CategoryKey | null;
}

type Titles = Record<FollowUpKey, string>;

/** The words, by language. A vendor's name is appended as " – name" so several vendors stay apart. */
const TITLES: Record<UiLocale, Titles> = {
  he: {
    contract: 'לחתום על חוזה',
    deposit: 'להעביר מקדמה',
    coordination: 'לתאם פרטים ולוחות זמנים',
    confirmation: 'אישור סופי לפני האירוע',
  },
  en: {
    contract: 'Sign the contract',
    deposit: 'Pay the deposit',
    coordination: 'Coordinate details and timing',
    confirmation: 'Final confirmation before the event',
  },
};

/** What the coordination is about, for the categories where it is specific. */
const COORDINATION: Partial<Record<CategoryKey, Record<UiLocale, string>>> = {
  venue: { he: 'לתאם הגעה, הקמה ושעות', en: 'Coordinate arrival, set-up and hours' },
  catering: { he: 'לתאם תפריט וכמות סופית', en: 'Confirm the menu and the final head-count' },
  photographer: { he: 'להעביר רשימת רגעים וקבוצות לצילום', en: 'Send the shot list and family groups' },
  videographer: { he: 'להעביר רשימת רגעים לצילום', en: 'Send the shot list' },
  dj: { he: 'להעביר רשימת שירים ולוח זמנים', en: 'Send the song list and the running order' },
  band: { he: 'להעביר רשימת שירים ולוח זמנים', en: 'Send the song list and the running order' },
  flowers: { he: 'לאשר צבעים, סוגי פרחים והגעה', en: 'Confirm colours, flowers and delivery' },
  design: { he: 'לאשר קונספט, צבעים והקמה', en: 'Confirm the concept, colours and set-up' },
  cakes_sweets: { he: 'לאשר טעמים, עיצוב ומשלוח', en: 'Confirm flavours, design and delivery' },
  transport: { he: 'לתאם כתובות איסוף ושעות', en: 'Confirm pick-up addresses and times' },
  makeup_hair: { he: 'לקבוע ניסיון ושעת הגעה', en: 'Book the trial and the arrival time' },
  attire: { he: 'לקבוע מדידה אחרונה ואיסוף', en: 'Book the last fitting and the pick-up' },
};

/** Days from today, on the usual calendar: far enough from the event, and spread out when it is near. */
const NOMINAL = { contract: 3, deposit: 7, coordination: 14, confirmation: 28 } as const;
/** The coordination call is three weeks out and the confirmation a week out, when there is room. */
const COORDINATION_LEAD = 21;
const CONFIRMATION_LEAD = 7;

const today = () => new Date().toISOString().slice(0, 10);
const daysFrom = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The four follow-ups for a vendor of `categoryKey`. `eventDate` null (or not a date): the contract and
 * the deposit are dated from today, the other two have no date. An event that is over: nothing to follow
 * up. `vendorName` is appended to each title.
 */
export function buildFollowUps(
  categoryKey: CategoryKey | string | null | undefined,
  eventDate: string | null | undefined,
  todayDate: string,
  locale: UiLocale = 'he',
  vendorName?: string | null,
): FollowUp[] {
  const now = isIsoDate(todayDate) ? todayDate : today();
  const category = isCategoryKey(categoryKey) ? categoryKey : null;
  const lang: UiLocale = locale === 'en' ? 'en' : 'he';
  const base = TITLES[lang];
  const titles: Titles = {
    ...base,
    coordination: (category && COORDINATION[category]?.[lang]) || base.coordination,
  };
  const name = typeof vendorName === 'string' ? vendorName.trim().slice(0, 60) : '';
  const titled = (key: FollowUpKey) => (name ? `${titles[key]} – ${name}` : titles[key]);
  const make = (key: FollowUpKey, dueDate: string | null): FollowUp => ({
    key,
    title: titled(key),
    dueDate,
    category,
  });

  if (!isIsoDate(eventDate)) {
    // no event date to hang the last two on: only what follows from closing today
    return [
      make('contract', addDays(now, NOMINAL.contract)),
      make('deposit', addDays(now, NOMINAL.deposit)),
      make('coordination', null),
      make('confirmation', null),
    ];
  }
  const daysLeft = daysFrom(now, eventDate);
  // the event is over: nothing is scheduled into the past
  if (daysLeft < 0) return [];

  // the last day a task may fall on: the day before the event (today, when there is no day before)
  const last = Math.max(0, daysLeft - 1);
  const nominal = [
    NOMINAL.contract,
    NOMINAL.deposit,
    Math.max(NOMINAL.coordination, daysLeft - COORDINATION_LEAD),
    Math.max(NOMINAL.confirmation, daysLeft - CONFIRMATION_LEAD),
  ];
  // not enough room for the usual spread: every task moves in by the same share, so the order holds
  const fit = nominal[3]! > last ? last / nominal[3]! : 1;
  const offsets = nominal.map((n) => Math.min(last, Math.max(0, Math.round(n * fit))));
  const keys: FollowUpKey[] = ['contract', 'deposit', 'coordination', 'confirmation'];
  return keys.map((key, i) => make(key, addDays(now, offsets[i]!)));
}
