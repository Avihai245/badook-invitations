/**
 * Scheduling a send for later (features/scheduler) — Hebrew. {when}: a date and a time, {city}: a time
 * zone's city ("ניו יורק" stays as the zone names it: "New York").
 */
export const scheduleHe = {
  open: 'תזמון לשליחה מאוחרת',
  openHint: 'בוחרים תאריך, שעה ואזור זמן — והמערכת שולחת בדיוק אז, גם כשהדף סגור.',
  title: 'שליחה בתאריך ובשעה שתבחרו',
  date: 'תאריך',
  time: 'שעה',
  zone: 'לפי שעון',
  zoneEvent: 'שעון האירוע — {city}',
  zoneMine: 'השעון שלי — {city}',
  zoneOther: 'אזורי זמן נוספים',
  audience: 'למי',
  audienceUnsent: 'למי שעוד לא קיבל',
  audienceAll: 'לכל מי שאפשר',
  willSend: 'יישלח ב־{when} לפי שעון {city}.',
  alsoEvent: 'שעון האירוע ({city}): {when}.',
  alsoMine: 'אצלכם ({city}): {when}.',
  save: 'תזמון השליחה',
  saved: 'השליחה תוזמנה',
  back: 'חזרה',
  scheduled: 'מתוזמן ל־{when} לפי שעון {city}',
  scheduledFor: { unsent: 'למי שעוד לא יקבל עד אז', all: 'לכל מי שאפשר' },
  change: 'שינוי',
  cancel: 'ביטול התזמון',
  canceled: 'התזמון בוטל',
  running: 'השליחה המתוזמנת יוצאת עכשיו…',
  done: {
    one: 'השליחה המתוזמנת יצאה ב־{when}: הודעה אחת',
    other: 'השליחה המתוזמנת יצאה ב־{when}: {n} הודעות',
  },
  failed: 'השליחה המתוזמנת ל־{when} לא יצאה: {reason}',
  reasons: {
    credits: 'לא היו מספיק קרדיטים',
    not_configured: 'השליחה מהמספר הרשמי לא הייתה זמינה',
    feature_off: 'האפשרות לא כלולה בחבילה',
    no_gallery: 'הגלריה הייתה כבויה',
    no_album: 'האלבום היה כבוי',
    timeout: 'השליחה לא הושלמה',
    other: 'משהו השתבש',
  },
  errors: {
    past: 'הזמן הזה כבר עבר — בחרו זמן עתידי.',
    too_far: 'אפשר לתזמן עד 400 יום קדימה.',
    time_zone: 'אזור הזמן לא מוכר. בחרו אחר.',
    no_such_time: 'השעה הזאת לא קיימת באותו יום לפי השעון הזה (מעבר לשעון קיץ). בחרו שעה אחרת.',
    running: 'השליחה כבר יוצאת עכשיו.',
    not_configured: 'השליחה מהמספר הרשמי עוד לא זמינה.',
    failed: 'משהו השתבש. נסו שוב.',
  },
};

export type ScheduleDict = typeof scheduleHe;
