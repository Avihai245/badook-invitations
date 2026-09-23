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
} as const;

/** Event types that naturally have two hosts joined by "&". */
export const COUPLE_EVENTS: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];
