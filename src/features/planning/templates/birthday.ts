import type { PlanTemplate } from '../model/types';

/**
 * A birthday at any age: the wording works for a child's party and an adult's evening alike, with one
 * optional task for kids' parties (which the host can hide).
 */
export const birthday: PlanTemplate = {
  key: 'birthday',
  eventTypes: ['birthday'],
  size: 'light',
  tasks: [
    {
      key: 'budget_and_size',
      title: { he: 'להגדיר תקציב ומספר אורחים משוער', en: 'Set the budget and a rough guest count' },
      notes: {
        he: 'גיל האורחים משפיע על העלות: ילדים, מבוגרים או קהל מעורב.',
        en: "Guests' ages affect the cost: children, adults or a mix.",
      },
      offset: -75,
      priority: 1,
    },
    {
      key: 'choose_theme',
      title: { he: 'לבחור אופי וסגנון למסיבה', en: 'Choose the feel and style of the party' },
      notes: {
        he: 'נושא שמתאים למי שחוגג: תחביב, סרט, צבעים או סגנון מוזיקה.',
        en: 'A theme that suits the guest of honor: a hobby, a film, colors or a music style.',
      },
      offset: -70,
      category: 'design',
    },
    {
      key: 'book_venue',
      title: { he: 'לסגור מקום', en: 'Book the venue' },
      notes: {
        he: 'בית, גן, מסעדה, אולם או מתחם פעילות: בדקו קיבולת, חניה ושעות.',
        en: 'Home, garden, restaurant, hall or activity center: check capacity, parking and hours.',
      },
      offset: -65,
      category: 'venue',
      minDays: 30,
      priority: 1,
    },
    {
      key: 'plan_menu',
      title: { he: 'לתכנן תפריט ולסגור קייטרינג', en: 'Plan the menu and book catering' },
      notes: {
        he: 'התאימו לגיל האורחים: ארוחה מלאה, כיבוד קל או אוכל לילדים.',
        en: "Match it to the guests' ages: a full meal, light bites or kids' food.",
      },
      offset: -55,
      category: 'catering',
      minDays: 21,
      priority: 1,
    },
    {
      key: 'plan_drinks',
      title: { he: 'לתכנן שתייה לערב', en: 'Plan drinks for the party' },
      notes: {
        he: 'שתייה קלה לכולם, ואלכוהול רק אם האורחים מבוגרים.',
        en: 'Soft drinks for everyone, and alcohol only if the guests are adults.',
      },
      offset: -50,
      category: 'bar',
      minDays: 21,
    },
    {
      key: 'book_entertainment',
      title: { he: 'לסגור בידור או פעילות', en: 'Book entertainment or an activity' },
      notes: {
        he: 'DJ, מופע, קוסם, פעילות יצירה או מתנפחים: לפי גיל האורחים.',
        en: 'A DJ, a show, a magician, a craft activity or bouncy castles: to suit the guests.',
      },
      offset: -50,
      category: 'entertainment',
      minDays: 21,
    },
    {
      key: 'decide_gifts_policy',
      title: { he: 'להחליט אם מבקשים מתנות', en: 'Decide whether to ask for gifts' },
      notes: {
        he: 'אפשר לבקש קופה משותפת, תרומה לעמותה או לכתוב שלא צריך מתנות.',
        en: 'You can ask for a group fund, a charity donation or say no gifts are needed.',
      },
      offset: -40,
      category: 'other',
    },
    {
      key: 'order_cake',
      title: { he: 'להזמין עוגה', en: 'Order the cake' },
      notes: {
        he: 'בדקו אלרגיות והעדפות, ושאלו אם צריך נרות ומתקן להגשה.',
        en: 'Check allergies and preferences, and ask whether candles and a serving stand are included.',
      },
      offset: -35,
      category: 'cakes_sweets',
      minDays: 14,
    },
    {
      key: 'plan_decor',
      title: { he: 'לתכנן עיצוב ובלונים', en: 'Plan decor and balloons' },
      notes: {
        he: 'שלט ברכה, בלונים, מפות וקישוטים בצבעי הנושא שנבחר.',
        en: 'A greeting banner, balloons, tablecloths and decorations in the theme colors.',
      },
      offset: -35,
      category: 'design',
      minDays: 14,
    },
    {
      key: 'decide_photography',
      title: { he: 'לסגור מי מצלם', en: 'Decide who takes the photos' },
      notes: {
        he: 'צילום מקצועי או אורח מתנדב: כדאי לצלם את העוגה ואת הברכות.',
        en: 'A professional or a volunteer guest: capture the cake and the good wishes.',
      },
      offset: -30,
      category: 'photographer',
      minDays: 14,
    },
    {
      key: 'coordinate_kids_parents',
      title: { he: 'למסיבת ילדים: לתאם עם ההורים', en: "For a kids' party: coordinate with the parents" },
      notes: {
        he: 'שאלו על אלרגיות, האם ההורים נשארים, ומי אוסף בסוף המסיבה.',
        en: 'Ask about allergies, whether parents stay, and who picks up at the end.',
      },
      offset: -21,
    },
    {
      key: 'prepare_favors',
      title: { he: 'להכין מזכרות לאורחים', en: 'Prepare party favors' },
      notes: {
        he: 'לא חובה: שקית ממתקים, יצירה קטנה או תודה אישית.',
        en: 'Optional: a bag of treats, a small craft or a personal thank-you.',
      },
      offset: -21,
      category: 'other',
    },
    {
      key: 'prepare_playlist_surprise',
      title: { he: 'להכין פלייליסט ותוכנית הפתעה', en: 'Prepare a playlist and any surprise' },
      notes: {
        he: 'אם זו הפתעה: מי מביא את מי שחוגג, ומי מזכיר לאורחים לשמור סוד.',
        en: 'For a surprise: who brings the guest of honor, and who reminds guests to keep the secret.',
      },
      offset: -14,
    },
    {
      key: 'build_program',
      title: { he: 'לבנות סדר ערב', en: 'Build the schedule' },
      notes: {
        he: 'הגעה, אוכל, פעילות, עוגה ושירה, עם זמן משוער לכל חלק.',
        en: 'Arrival, food, activity, cake and singing, each with a rough time.',
      },
      offset: -10,
    },
    {
      key: 'confirm_vendors',
      title: { he: 'לאשר עם הספקים שעות והגעה', en: 'Confirm times and arrivals with vendors' },
      notes: {
        he: 'הודעה קצרה לכל ספק עם כתובת, שעה ואיש קשר ליום האירוע.',
        en: 'A short message to each vendor with address, time and a day-of contact.',
      },
      offset: -4,
      priority: 1,
    },
    {
      key: 'pack_supplies',
      title: { he: 'להכין נרות, מצית וציוד קטן', en: 'Prepare candles, a lighter and small supplies' },
      notes: {
        he: 'נרות, מצית, סכין לעוגה, מצלמה, שקיות אשפה ותיק חירום קטן.',
        en: 'Candles, a lighter, a cake knife, a camera, trash bags and a small emergency kit.',
      },
      offset: -2,
    },
    {
      key: 'send_thanks',
      title: { he: 'לשלוח תודה לאורחים', en: 'Send thanks to the guests' },
      notes: {
        he: 'הודעה קצרה עם תמונה מהמסיבה, ואפשר לשתף קישור לגלריה.',
        en: 'A short message with a photo from the party; a gallery link is a nice touch.',
      },
      offset: 2,
    },
  ],
  categories: [
    { key: 'venue', pct: 25, basis: 'fixed' },
    { key: 'catering', pct: 32, basis: 'per_guest' },
    { key: 'bar', pct: 8, basis: 'per_guest' },
    { key: 'cakes_sweets', pct: 8, basis: 'fixed' },
    { key: 'design', pct: 10, basis: 'fixed' },
    { key: 'entertainment', pct: 9, basis: 'fixed' },
    { key: 'photographer', pct: 4, basis: 'fixed' },
    { key: 'other', pct: 4, basis: 'fixed' },
  ],
  requiredVendors: ['catering'],
};
