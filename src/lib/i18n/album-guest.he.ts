import type { PluralEntry } from './guest';

/**
 * The album's page for guests (features/album: /e/<slug>/album) — Hebrew. A dictionary of its own:
 * guests' phones download these strings only. {event} is where they celebrated ("בחתונה שלנו").
 */
export const albumGuestHe = {
  metaTitle: 'האלבום · {name}',
  metaDescription: 'הרגעים היפים מהאירוע, במקום אחד',
  eyebrow: 'האלבום',
  language: 'שפה',
  invalid: {
    title: 'הקישור לא עובד',
    body: 'אולי בעלי השמחה החליפו אותו בקישור חדש. בקשו מהם את הקישור העדכני.',
  },
  off: { title: 'האלבום סגור', body: 'בעלי השמחה סגרו את האלבום.' },
  soon: {
    title: 'האלבום כמעט מוכן',
    body: 'כל הרגעים מהאירוע מתארגנים עכשיו לאלבום אחד. הוא ייפתח ב־{date}.',
  },
  empty: {
    title: 'עוד אין תמונות באלבום',
    body: 'כשיהיו תמונות בגלריה של האירוע, הן יופיעו כאן.',
  },
  message:
    'תודה שחגגתם איתנו {event}! כל הרגעים שצילמתם — החיוכים, הריקודים והחיבוקים — נאספו כאן לאלבום אחד. תודה שהייתם חלק מהשמחה.',
  enter: 'לרגעים',
  stats: {
    photos: { one: 'תמונה אחת', other: '{n} תמונות' } as PluralEntry,
    videos: { one: 'סרטון אחד', other: '{n} סרטונים' } as PluralEntry,
  },
  highlights: 'הרגעים הנבחרים',
  chapters: {
    opening: 'ההתחלה',
    heart: 'לב השמחה',
    more: 'עוד רגעים',
    ending: 'עד הרגע האחרון',
    all: 'כל הרגעים',
  },
  showAll: { one: 'עוד רגע אחד', other: 'עוד {n} רגעים' } as PluralEntry,
  by: 'צולם על ידי {name}',
  ai: 'נוצר ב־AI',
  photo: 'תמונה',
  video: 'סרטון',
  open: 'פתיחת {kind} {n}',
  viewer: {
    label: 'האלבום',
    close: 'סגירה',
    next: 'הבא',
    previous: 'הקודם',
    position: '{n} מתוך {total}',
  },
  downloadOne: 'הורדה',
  share: 'שיתוף האלבום',
  shareText: 'הרגעים היפים {event} 💛',
  copied: 'הקישור לאלבום הועתק',
  downloadAll: 'הורדת כל האלבום',
  downloading: 'מורידים… {done} מתוך {total}',
  downloaded: 'האלבום ירד למכשיר',
  missingName: 'קבצים-שלא-ירדו.txt',
  missingIntro: 'הקבצים האלה לא ירדו:',
  thanks: 'תודה שחגגתם איתנו',
  love: 'באהבה',
  made: 'האלבום נוצר באמצעות {brand}',
  makeYours: 'הזמנה דיגיטלית, גלריה חיה ואלבום — לאירוע שלכם',
  failed: 'משהו השתבש. נסו שוב.',
  top: 'חזרה למעלה',
};

export type AlbumGuestDict = typeof albumGuestHe;
