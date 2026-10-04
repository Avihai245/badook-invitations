import type { PlanTemplate } from '../model/types';

/**
 * A henna ceremony or party: culturally generic (outfits, the henna ritual, music, food, decor) — the
 * families' own customs are theirs to add.
 */
export const henna: PlanTemplate = {
  key: 'henna',
  eventTypes: ['henna'],
  size: 'light',
  tasks: [
    {
      key: 'budget_and_guests',
      title: { he: 'להגדיר תקציב ומספר אורחים משוער', en: 'Set the budget and a rough guest count' },
      notes: {
        he: 'כדאי לדבר עם המשפחות מי משתתף בעלויות, ומי מגיע לערב.',
        en: 'Talk with the families about who contributes and who is coming.',
      },
      offset: -90,
      priority: 1,
    },
    {
      key: 'agree_customs',
      title: { he: 'לתאם עם המשפחות את מנהגי הערב', en: "Agree on the evening's customs with the families" },
      notes: {
        he: 'אילו מנהגים חשובים, מי לוקח חלק בטקס, וכמה זמן הוא אמור להימשך.',
        en: 'Which customs matter, who takes part in the ritual and how long it should run.',
      },
      offset: -85,
    },
    {
      key: 'book_venue',
      title: { he: 'לסגור מקום', en: 'Book the venue' },
      notes: {
        he: 'בית, גן או אולם: בדקו מקום לישיבה, לריקודים ולשולחן הטקס, וגם חניה.',
        en: 'Home, garden or hall: check space for seating, dancing and the ritual table, plus parking.',
      },
      offset: -80,
      category: 'venue',
      minDays: 40,
      priority: 1,
    },
    {
      key: 'book_henna_service',
      title: { he: 'לסגור שירות חינה לטקס ולאורחים', en: 'Book henna service for the ritual and guests' },
      notes: {
        he: 'בדקו אם נדרשת גם ערכת טקס, וכמה אורחים ירצו ציור חינה על היד.',
        en: 'Check whether a ritual set is also needed and how many guests would like henna designs.',
      },
      offset: -70,
      category: 'entertainment',
      minDays: 30,
      priority: 1,
    },
    {
      key: 'choose_outfits',
      title: { he: 'לבחור או להשכיר תלבושות לערב', en: 'Choose or rent outfits for the evening' },
      notes: {
        he: 'אפשר להמליץ לאורחים על לבוש מסורתי או על צבעים מסוימים.',
        en: 'You can suggest traditional dress or particular colors to guests.',
      },
      offset: -65,
      category: 'attire',
      minDays: 30,
    },
    {
      key: 'book_catering',
      title: { he: 'לסגור קייטרינג ותפריט', en: 'Book catering and the menu' },
      notes: {
        he: 'תפריט שמכבד את מנהגי המשפחות, כולל כשרות, אלרגיות והעדפות תזונה.',
        en: "A menu that respects the families' customs, including kosher needs, allergies and dietary preferences.",
      },
      offset: -60,
      category: 'catering',
      minDays: 30,
      priority: 1,
    },
    {
      key: 'book_music',
      title: { he: 'לסגור מוזיקה לטקס ולריקודים', en: 'Book music for the ritual and dancing' },
      notes: {
        he: 'DJ, להקה או פלייליסט: שירים מסורתיים לטקס ושירי ריקוד לשאר הערב.',
        en: 'DJ, band or playlist: traditional songs for the ritual and dance hits for the rest.',
      },
      offset: -55,
      category: 'dj',
      minDays: 21,
    },
    {
      key: 'book_makeup_hair',
      title: { he: 'לקבוע איפור ושיער', en: 'Book makeup and hair' },
      notes: {
        he: 'שווה לקבוע ניסיון מוקדם ולוודא אם מגיעים אל המקום.',
        en: 'Worth booking a trial and checking whether they come to you.',
      },
      offset: -45,
      category: 'makeup_hair',
      minDays: 21,
    },
    {
      key: 'plan_decor',
      title: { he: 'לתכנן עיצוב וקישוט המקום', en: 'Plan the decor and venue styling' },
      notes: {
        he: 'בדים, כריות ישיבה, פנסים, פרחים ושולחן מכובד לערכת החינה.',
        en: 'Fabrics, floor cushions, lanterns, flowers and a pretty table for the ritual set.',
      },
      offset: -45,
      category: 'design',
      minDays: 21,
    },
    {
      key: 'book_photographer',
      title: { he: 'לשריין צילום לערב', en: 'Book photography for the evening' },
      notes: {
        he: 'הטקס קורה פעם אחת: כדאי להחליט מי מצלם, ולבקש גם סרטון קצר.',
        en: 'The ritual happens once, so decide who shoots it and ask for a short video too.',
      },
      offset: -40,
      category: 'photographer',
      minDays: 21,
    },
    {
      key: 'prepare_ritual_set',
      title: { he: 'להכין את ערכת החינה לטקס', en: 'Prepare the henna ritual set' },
      notes: {
        he: 'מגש, חינה, נרות, פרחים וכל מה שהמשפחות נוהגות לכלול בטקס.',
        en: 'A tray, henna, candles, flowers and whatever the families traditionally include.',
      },
      offset: -30,
      category: 'entertainment',
      minDays: 14,
    },
    {
      key: 'order_sweets',
      title: { he: 'להזמין מתוקים ושולחן קינוחים', en: 'Order sweets and a dessert table' },
      notes: {
        he: 'מאפים, פירות ומתוקים מסורתיים, בכמות שמתאימה למספר האורחים.',
        en: 'Pastries, fruit and traditional sweets, sized to the guest count.',
      },
      offset: -25,
      category: 'cakes_sweets',
      minDays: 14,
    },
    {
      key: 'prepare_keepsakes',
      title: { he: 'להכין מזכרות קטנות לאורחים', en: 'Prepare small keepsakes for guests' },
      notes: {
        he: 'למשל שקיות מתוקים או חינה קטנה, ואפשר לצרף ברכה אישית.',
        en: 'For example bags of sweets or a little henna, with a personal note.',
      },
      offset: -21,
      category: 'cakes_sweets',
      minDays: 14,
    },
    {
      key: 'run_of_show',
      title: { he: 'לבנות סדר ערב וזמנים לטקס', en: "Build the evening's schedule and ritual timing" },
      notes: {
        he: 'קבלת פנים, טקס, אוכל וריקודים, ומי מנחה ומכריז על כל שלב.',
        en: 'Welcome, ritual, food and dancing, and who hosts and announces each stage.',
      },
      offset: -14,
    },
    {
      key: 'confirm_vendors',
      title: { he: 'לאשר עם הספקים שעות הגעה והקמה', en: 'Confirm arrival and setup times with vendors' },
      notes: {
        he: 'הודעה קצרה לכל ספק עם כתובת, שעה ואיש קשר ליום האירוע.',
        en: 'A short message to each vendor with address, time and a day-of contact.',
      },
      offset: -5,
      priority: 1,
    },
    {
      key: 'settle_balances',
      title: { he: 'לסגור תשלומי יתרה לספקים', en: 'Settle balance payments with vendors' },
      notes: {
        he: 'הכינו מראש מה משלמים ומתי, כולל תשר אם מתכננים.',
        en: 'Prepare what is paid and when, including tips if you plan them.',
      },
      offset: -3,
    },
    {
      key: 'pack_supplies',
      title: { he: 'לארוז תלבושות וציוד ליום האירוע', en: 'Pack outfits and supplies for the day' },
      notes: {
        he: 'לכל פריט ברשימה יש מקום באריזה, ומישהו אחראי להביא אותו.',
        en: 'Every item has a place in the packing and someone responsible for bringing it.',
      },
      offset: -2,
    },
    {
      key: 'send_thanks',
      title: { he: 'לשלוח תודה לאורחים ולספקים', en: 'Send thanks to guests and vendors' },
      notes: {
        he: 'הודעה קצרה עם תמונה מהערב, ואפשר לשתף קישור לגלריה.',
        en: 'A short message with a photo from the night; a gallery link is a nice touch.',
      },
      offset: 3,
    },
  ],
  categories: [
    { key: 'venue', pct: 18, basis: 'fixed' },
    { key: 'catering', pct: 30, basis: 'per_adult' },
    { key: 'cakes_sweets', pct: 6, basis: 'fixed' },
    { key: 'attire', pct: 10, basis: 'fixed' },
    { key: 'makeup_hair', pct: 6, basis: 'fixed' },
    { key: 'dj', pct: 8, basis: 'fixed' },
    { key: 'design', pct: 10, basis: 'fixed' },
    { key: 'entertainment', pct: 8, basis: 'fixed' },
    { key: 'photographer', pct: 4, basis: 'fixed' },
  ],
  requiredVendors: ['catering', 'entertainment'],
};
