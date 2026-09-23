import type { EventType, L10n } from '../contracts/types';

/**
 * Seed copy for sections that `defaults.json` does not cover (it is user content once seeded,
 * so it lives with the seeding logic rather than in the UI dictionaries).
 */
const EVENING_EVENTS: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];

export const SEED_COPY = {
  timelineTitle: (eventType: EventType): L10n =>
    EVENING_EVENTS.includes(eventType)
      ? { he: 'סדר הערב', en: 'Timeline of the evening' }
      : { he: 'סדר האירוע', en: 'Schedule' },
  faqTitle: { he: 'שאלות נפוצות', en: 'FAQ' } satisfies L10n,
  giftsTitle: { he: 'מתנות', en: 'Gifts' } satisfies L10n,
  giftsBody: {
    he: 'הנוכחות שלכם היא המתנה הגדולה ביותר. למי שרוצה — אפשר גם כאן:',
    en: 'Your presence is the greatest gift. If you wish, you can also give here:',
  } satisfies L10n,
  galleryTitle: { he: 'גלריה', en: 'Gallery' } satisfies L10n,
  revealTitle: { he: 'שמרו את התאריך', en: 'Save the Date' } satisfies L10n,
  revealPrompt: { he: '(גרדו כדי לגלות)', en: '(scratch to reveal)' } satisfies L10n,
  joiner: { he: '&', en: '&' } satisfies L10n,
  /** Titles of text sections added in the editor when the template has no copy for that kind. */
  textTitles: {
    story: { he: 'הסיפור שלנו', en: 'Our story' },
    transport: { he: 'הסעות', en: 'Transportation' },
    accommodation: { he: 'לינה', en: 'Accommodation' },
    dress_code: { he: 'קוד לבוש', en: 'Dress code' },
    menu: { he: 'תפריט', en: 'Menu' },
    activities: { he: 'פעילויות', en: 'Activities' },
    custom: { he: 'חשוב לדעת', en: 'Good to know' },
  } satisfies Record<string, L10n>,
  venueLabel: { he: 'האירוע', en: 'The Celebration' } satisfies L10n,
  timelineSample: { label: { he: 'קבלת פנים', en: 'Welcome' } satisfies L10n },
  faqSample: { he: 'יש חניה במקום?', en: 'Is there parking at the venue?' } satisfies L10n,
} as const;

/** Event types that naturally have two hosts joined by "&". */
export const COUPLE_EVENTS: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];
