import type { PluralEntry } from './guest';

/**
 * The AI photos on the gallery's guest page (features/ai-photos) — Hebrew. {names}: the people of honor
 * ("אביב ורוני"), {name}: the first of them. The suggestions are by kind of event.
 */
export const aiPhotosGuestHe = {
  card: {
    title: 'תמונה עם {names}',
    body: 'צלמו או בחרו תמונה מהאירוע, כתבו מה תרצו — וה־AI ישלב את {names} בתמונה.',
    cta: 'יצירת תמונה',
    left: { one: 'נשארה לכם תמונה אחת', other: 'נשארו לכם {n} תמונות' } as PluralEntry,
    none: 'ניצלתם את כל התמונות שלכם',
    full: 'נגמרו התמונות לאירוע הזה',
  },
  and: ' ו',
  title: 'תמונה עם בעלי השמחה',
  photo: {
    label: 'התמונה',
    take: 'צילום',
    pick: 'מהטלפון',
    none: 'סצנה חדשה',
    help: 'תמונה שצילמתם באירוע: ה־AI ישאיר אותה כמו שהיא ויוסיף את בעלי השמחה.',
    noneHelp: 'בלי תמונה: ה־AI ייצור תמונה חדשה לפי מה שתכתבו.',
    remove: 'הסרת התמונה',
    failed: 'לא הצלחנו לפתוח את התמונה. נסו אחרת.',
  },
  who: {
    label: 'מי בתמונה',
    help: 'מסומנים לבד לפי מה שכתבתם — אפשר לשנות.',
  },
  what: {
    label: 'מה לעשות?',
    placeholder: 'למשל: תוסיף את {name} לתמונה כשהוא שותה מים',
    ideas: 'רעיונות',
  },
  roles: {
    groom: 'החתן',
    bride: 'הכלה',
    partner: 'בעלי השמחה',
    bar_mitzvah: 'חתן בר המצווה',
    bat_mitzvah: 'כלת בת המצווה',
    birthday: 'חוגג/ת יום ההולדת',
    parent: 'הורה',
    baby: 'התינוק/ת',
    honoree: 'אורח/ת כבוד',
  },
  consent:
    'התמונה והבקשה נשלחות לעיבוד אצל OpenAI, ונשמרות אצל המארחים עד 30 יום אחרי האירוע. בקשות לא ראויות נחסמות.',
  privacy: 'מדיניות הפרטיות',
  create: 'יצירת התמונה',
  working: {
    title: 'יוצרים את התמונה…',
    body: 'בדרך כלל זה לוקח עד דקה או שתיים. אפשר להשאיר את העמוד פתוח — או לחזור אליו אחר כך.',
    tips: ['מתאימים את התאורה…', 'מכניסים את בעלי השמחה לתמונה…', 'מסדרים חיוכים…', 'עוד רגע…'],
  },
  done: {
    title: 'התמונה מוכנה!',
    download: 'הורדה',
    share: 'שיתוף',
    toGallery: 'הוספה לגלריה',
    added: 'התמונה נוספה לגלריה',
    addedPending: 'התמונה נשלחה לגלריה ותופיע אחרי שהמארחים יאשרו',
    again: 'תמונה נוספת',
  },
  errors: {
    blocked: 'הבקשה הזאת לא מתאימה לתמונה. נסו לנסח אחרת — היא לא נספרה.',
    failed: 'לא הצלחנו ליצור את התמונה. נסו שוב — היא לא נספרה.',
    guest_limit: 'ניצלתם את כל התמונות שלכם באירוע הזה.',
    event_limit: 'נגמרו התמונות לאירוע הזה.',
    daily_limit: 'היום נוצרו הרבה תמונות. נסו שוב מחר.',
    rate: 'יותר מדי בקשות. נסו שוב בעוד כמה דקות.',
    too_large: 'התמונה גדולה מדי. נסו אחרת.',
    offline: 'אין חיבור לאינטרנט. בדקו ונסו שוב.',
    off: 'המארחים כיבו את האפשרות הזאת.',
    shared: 'התמונה כבר בגלריה.',
    no_gallery: 'הגלריה סגורה כרגע.',
    full: 'הגלריה מלאה.',
    generic: 'משהו השתבש. נסו שוב.',
  },
  mine: {
    title: 'התמונות שיצרתם',
    waiting: 'בתהליך…',
    blocked: 'נחסמה',
    failed: 'לא הצליחה',
    inGallery: 'בגלריה',
    delete: 'מחיקה',
    confirmDelete: 'למחוק את התמונה?',
  },
  ai: 'AI',
  close: 'סגירה',
  back: 'חזרה',
  ideas: {
    couple: [
      'מרימים כוסית עם {names}',
      'רוקדים עם {names} על הרחבה',
      'חיבוק קבוצתי עם {names}',
      '{names} בסגנון ציור בצבעי מים',
    ],
    child: ['מרימים את {name} על הכיסא', 'היי־פייב עם {name}', 'רוקדים עם {name}', '{name} בתור גיבור־על'],
    birthday: [
      '{name} מכבה נרות יחד איתנו',
      'מרימים כוסית ל{name}',
      'סלפי עם {name}',
      '{name} עם כתר וזיקוקים',
    ],
    family: [
      'צילום משפחתי עם {names}',
      'מרימים כוסית עם {names}',
      'חיבוק גדול עם {names}',
      '{names} בסגנון ציור',
    ],
    other: [
      'צילום קבוצתי עם {names}',
      'מרימים כוסית עם {names}',
      'לחיצת יד עם {names}',
      '{names} בסגנון קומיקס',
    ],
  },
};

export type AiPhotosGuestDict = typeof aiPhotosGuestHe;
