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
  /** The reveal's prompt per mechanic (the editor swaps an untouched one when the mechanic changes). */
  revealPrompt: {
    scratch: { he: '(גרדו כדי לגלות)', en: '(scratch to reveal)' },
    tap: { he: '(הקישו כדי לגלות)', en: '(tap to reveal)' },
    spin: { he: '(הקישו לסיבוב)', en: '(tap to spin)' },
  } satisfies Record<'scratch' | 'tap' | 'spin', L10n>,
  /** A save-the-date (§10.3: hero → reveal → a short note → footer) in a template without its own copy. */
  saveTheDate: {
    eyebrow: { he: 'אנחנו מתחתנים!', en: 'We’re getting married!' },
    note: {
      he: 'פרק חדש עומד להתחיל, ואנחנו כל כך מתרגשים לחגוג אותו עם האנשים הכי חשובים לנו.\nהזמנה רשמית תישלח בהמשך.',
      en: 'A new chapter is about to begin, and we can’t wait to celebrate it with the people who matter most to us.\nA formal invitation will follow.',
    },
    closing: { he: 'באהבה,', en: 'With love,' },
  } satisfies Record<string, L10n>,
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
  // ── the schema-v2 sections (parents · when · where · quote · text & picture) ──
  parentsTitle: (eventType: EventType): L10n =>
    COUPLE_EVENTS.includes(eventType)
      ? { he: 'בשמחת ההורים', en: 'Together with our parents' }
      : eventType === 'bar_mitzvah' || eventType === 'bat_mitzvah'
        ? { he: 'ההורים הגאים', en: 'The proud parents' }
        : eventType === 'brit' || eventType === 'baby_shower'
          ? { he: 'המשפחה המאושרת', en: 'The happy family' }
          : { he: 'המארחים', en: 'Your hosts' },
  whenTitle: (eventType: EventType): L10n =>
    COUPLE_EVENTS.includes(eventType)
      ? { he: 'היום שלנו', en: 'Our day' }
      : { he: 'מתי חוגגים', en: 'When we celebrate' },
  whereLabel: { he: 'איפה', en: 'Where' } satisfies L10n,
  /** A verse or a line for the quote section, by the kind of event. */
  quote: (eventType: EventType): { text: L10n; attribution: L10n | null } =>
    COUPLE_EVENTS.includes(eventType)
      ? {
          text: { he: 'אני לדודי ודודי לי', en: 'I am my beloved’s, and my beloved is mine' },
          attribution: { he: 'שיר השירים ו׳, ג׳', en: 'Song of Songs 6:3' },
        }
      : eventType === 'bar_mitzvah' || eventType === 'bat_mitzvah'
        ? {
            text: {
              he: 'בכל דרכיך דעהו, והוא יישר אורחותיך',
              en: 'In all your ways acknowledge Him, and He will make your paths straight',
            },
            attribution: { he: 'משלי ג׳, ו׳', en: 'Proverbs 3:6' },
          }
        : eventType === 'brit' || eventType === 'baby_shower'
          ? {
              text: { he: 'אל הנער הזה התפללתי', en: 'For this child I prayed' },
              attribution: { he: 'שמואל א׳ א׳, כ״ז', en: '1 Samuel 1:27' },
            }
          : {
              text: { he: 'לחיים — ולכל מה שעוד יבוא', en: 'To life — and to everything still to come' },
              attribution: null,
            },
  /** A new "text & picture" section: a title to write over or beside the host's own photo. */
  customTitle: { he: 'רגע משלנו', en: 'A moment of ours' } satisfies L10n,
} as const;

/** Event types that naturally have two hosts joined by "&". */
export const COUPLE_EVENTS: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];
