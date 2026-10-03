import type { PlanTemplate } from '../model/types';

/** An engagement party: a one-evening celebration, planned in about three months. */
export const engagement: PlanTemplate = {
  key: 'engagement',
  eventTypes: ['engagement'],
  size: 'light',
  tasks: [
    {
      key: 'budget_and_range',
      title: { he: 'להגדיר תקציב ומספר אורחים משוער', en: 'Set the budget and a rough guest count' },
      notes: {
        he: 'כדאי להסכים מראש מי משתתף בעלויות, ומה הסכום שלא חורגים ממנו.',
        en: "Agree up front who contributes and the ceiling you won't go over.",
      },
      offset: -90,
      priority: 1,
    },
    {
      key: 'choose_format',
      title: { he: 'לבחור סגנון: בית, מסעדה או אולם', en: 'Choose the style: home, restaurant or hall' },
      notes: {
        he: 'הסגנון קובע כמעט הכול: תקציב, מספר אורחים וכמה אפשר להכין לבד.',
        en: 'The style shapes almost everything: budget, guests and how much you can DIY.',
      },
      offset: -85,
    },
    {
      key: 'book_venue',
      title: { he: 'לסגור מקום', en: 'Book the venue' },
      notes: {
        he: 'בדקו קיבולת, חניה, שעות וצרכי כשרות לפני שמשלמים מקדמה.',
        en: 'Check capacity, parking, hours and any kosher needs before paying a deposit.',
      },
      offset: -80,
      category: 'venue',
      minDays: 45,
      priority: 1,
    },
    {
      key: 'book_catering',
      title: { he: 'לסגור קייטרינג ותפריט', en: 'Book catering and the menu' },
      notes: {
        he: 'שאלו על אלרגיות והעדפות תזונה, ובקשו טעימה לפני החתימה.',
        en: 'Ask about allergies and dietary needs, and request a tasting before signing.',
      },
      offset: -70,
      category: 'catering',
      minDays: 30,
      priority: 1,
    },
    {
      key: 'book_photographer',
      title: { he: 'להזמין צילום לערב', en: 'Book photography for the evening' },
      notes: {
        he: 'צילום מקצועי או חבר עם מצלמה טובה: העיקר להחליט מי אחראי לתמונות.',
        en: 'A pro or a friend with a good camera: just decide who owns the photos.',
      },
      offset: -60,
      category: 'photographer',
      minDays: 30,
    },
    {
      key: 'plan_drinks',
      title: { he: 'לתכנן שתייה ובר', en: 'Plan drinks and the bar' },
      notes: {
        he: 'שתייה קלה לכולם, ועוד יין, קוקטייל חגיגי או בר מלא לפי התקציב.',
        en: 'Soft drinks for all, plus wine, a signature cocktail or a full bar as budget allows.',
      },
      offset: -55,
      category: 'bar',
      minDays: 21,
    },
    {
      key: 'book_music',
      title: { he: 'לסגור מוזיקה: DJ או פלייליסט', en: 'Sort out music: DJ or playlist' },
      notes: {
        he: 'מוזיקת רקע לקבלת הפנים, ואם רוצים ריקודים, שעה של שירים אהובים.',
        en: 'Background music for the welcome, and an hour of favorites if you want dancing.',
      },
      offset: -50,
      category: 'dj',
      minDays: 21,
    },
    {
      key: 'plan_decor',
      title: { he: 'לתכנן עיצוב ופרחים', en: 'Plan decor and flowers' },
      notes: {
        he: 'פינת צילום, פרחים ושולחן תמונות מספיקים כדי ליצור אווירה.',
        en: 'A photo corner, flowers and a table of pictures go a long way.',
      },
      offset: -45,
      category: 'design',
      minDays: 21,
    },
    {
      key: 'coordinate_families',
      title: { he: 'לתאם עם המשפחות את פרטי הערב', en: "Coordinate the evening's details with the families" },
      notes: {
        he: 'שעה, קוד לבוש, ומי רוצה לברך או לקיים טקס קטן.',
        en: 'Timing, dress code and who would like to say a few words or hold a small ritual.',
      },
      offset: -40,
    },
    {
      key: 'choose_outfits',
      title: { he: 'לבחור לבוש לערב', en: 'Choose outfits for the evening' },
      notes: {
        he: 'אם יש קוד לבוש, כדאי לעדכן את האורחים.',
        en: 'If there is a dress code, let guests know.',
      },
      offset: -35,
    },
    {
      key: 'order_cake',
      title: { he: 'להזמין עוגה וקינוחים', en: 'Order the cake and desserts' },
      notes: {
        he: 'אשרו תאריך ושעה מדויקים, ושאלו על אלרגנים והובלה.',
        en: 'Confirm the exact date and time, and ask about allergens and delivery.',
      },
      offset: -30,
      category: 'cakes_sweets',
      minDays: 14,
    },
    {
      key: 'run_of_show',
      title: { he: 'לבנות סדר ערב', en: "Build the evening's run of show" },
      notes: {
        he: 'קבלת פנים, אוכל, ברכות, חיתוך עוגה וריקודים, עם זמן משוער לכל חלק.',
        en: 'Welcome, food, toasts, cake and dancing, each with a rough time.',
      },
      offset: -21,
    },
    {
      key: 'line_up_toasts',
      title: { he: 'לתאם ברכות ונאומים', en: 'Line up toasts and speeches' },
      notes: {
        he: 'מי מברך, באיזה סדר ולכמה זמן: שלוש דקות לכל אחד בדרך כלל מספיקות.',
        en: 'Who speaks, in what order and for how long: about three minutes each works well.',
      },
      offset: -14,
    },
    {
      key: 'family_photo_list',
      title: { he: 'להכין רשימת תמונות משפחתיות', en: 'Prepare a family photo shot list' },
      notes: {
        he: 'כך אף קבוצה חשובה לא נשכחת, והצילומים עוברים מהר ובנעימים.',
        en: 'So no important group is missed and photos go quickly and pleasantly.',
      },
      offset: -10,
      category: 'photographer',
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
      title: { he: 'לארוז ציוד ליום האירוע', en: 'Pack supplies for the day' },
      notes: {
        he: 'שלטים, תמונות, מתנות, קישוטים ותיק חירום קטן עם פלסטרים וסיכות.',
        en: 'Signs, photos, gifts, decorations and a small emergency kit.',
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
    { key: 'venue', pct: 26, basis: 'fixed' },
    { key: 'catering', pct: 32, basis: 'per_adult' },
    { key: 'bar', pct: 8, basis: 'per_guest' },
    { key: 'cakes_sweets', pct: 6, basis: 'fixed' },
    { key: 'design', pct: 8, basis: 'fixed' },
    { key: 'photographer', pct: 8, basis: 'fixed' },
    { key: 'dj', pct: 6, basis: 'fixed' },
    { key: 'other', pct: 6, basis: 'fixed' },
  ],
  requiredVendors: ['venue', 'catering'],
};
