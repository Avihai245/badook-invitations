import type { PlanTemplate } from '../model/types';

/** A baby shower: neutral about the parents, the gender and the way the family grew. */
export const babyShower: PlanTemplate = {
  key: 'baby_shower',
  eventTypes: ['baby_shower'],
  size: 'light',
  tasks: [
    {
      key: 'budget_and_size',
      title: { he: 'להגדיר תקציב ומספר אורחים משוער', en: 'Set the budget and a rough guest count' },
      notes: {
        he: 'אפשר לחלק את העלויות עם משפחה וחברים: כדאי להחליט מראש מי משתתף.',
        en: 'Costs can be shared with family and friends: decide up front who chips in.',
      },
      offset: -75,
      priority: 1,
    },
    {
      key: 'choose_theme',
      title: { he: 'לבחור נושא וצבעים', en: 'Choose a theme and colors' },
      notes: {
        he: 'נושא שמתאים לכולם: גן, כוכבים, חיות, ספרים או גוונים של טבע.',
        en: 'A theme that suits everyone: garden, stars, animals, books or natural tones.',
      },
      offset: -70,
      category: 'design',
    },
    {
      key: 'pick_place',
      title: { he: 'לבחור מקום: בית, גן או חלל שכור', en: 'Pick a place: home, garden or a rented space' },
      notes: {
        he: 'בבית אין עלות מקום, אבל בדקו מקום ישיבה, חניה ושירותים.',
        en: 'A home costs nothing, but check seating, parking and restrooms.',
      },
      offset: -65,
      category: 'venue',
      minDays: 21,
      priority: 1,
    },
    {
      key: 'plan_menu',
      title: { he: 'לתכנן תפריט ולהזמין אוכל', en: 'Plan the menu and order the food' },
      notes: {
        he: 'שאלו על אלרגיות והעדפות תזונה, ושמרו אפשרויות לצמחונים וטבעונים.',
        en: 'Ask about allergies and dietary needs, and keep options for vegetarians and vegans.',
      },
      offset: -55,
      category: 'catering',
      minDays: 21,
      priority: 1,
    },
    {
      key: 'set_up_gift_list',
      title: { he: 'לפתוח רשימת מתנות או קופה משותפת', en: 'Set up a gift list or a group gift fund' },
      notes: {
        he: 'רשימה בחנות, קופה משותפת או פריטי יד שנייה: מה שמתאים להורים.',
        en: 'A store registry, a group fund or second-hand items: whatever suits the parents.',
      },
      offset: -55,
      category: 'other',
    },
    {
      key: 'choose_games',
      title: { he: 'לבחור משחקים ופעילויות', en: 'Choose games and activities' },
      notes: {
        he: 'משחק ניחושים, בינגו או כתיבת איחולים: משהו קצר ונעים לכל הגילאים.',
        en: 'A guessing game, bingo or a wishes card: short and fun for all ages.',
      },
      offset: -45,
      category: 'entertainment',
    },
    {
      key: 'rent_furniture',
      title: { he: 'להשכיר שולחנות, כיסאות וכלים', en: 'Rent tables, chairs and tableware' },
      notes: {
        he: 'אם מארחים בבית או בגן, בדקו מה חסר לפי מספר האורחים.',
        en: 'If hosting at home or in a garden, check what is missing for your guest count.',
      },
      offset: -40,
      category: 'rental',
      minDays: 21,
    },
    {
      key: 'order_decor',
      title: { he: 'להזמין או להכין עיצוב', en: 'Order or make the decorations' },
      notes: {
        he: 'בלונים, שלטים, זרי פרחים ושולחן מתנות מסודר.',
        en: 'Balloons, banners, flowers and a tidy gift table.',
      },
      offset: -35,
      category: 'design',
      minDays: 14,
    },
    {
      key: 'order_cake',
      title: { he: 'להזמין עוגה וקינוחים', en: 'Order the cake and desserts' },
      notes: {
        he: 'ציינו תאריך ושעה, ושאלו על אלרגנים והובלה.',
        en: 'State the date and time, and ask about allergens and delivery.',
      },
      offset: -30,
      category: 'cakes_sweets',
      minDays: 14,
    },
    {
      key: 'decide_photography',
      title: { he: 'לסגור מי מצלם בערב', en: 'Decide who photographs the day' },
      notes: {
        he: 'צילום מקצועי או אורח מתנדב: כדאי לצלם גם את הברכות.',
        en: 'A professional or a volunteer guest: capture the good wishes too.',
      },
      offset: -30,
      category: 'photographer',
      minDays: 14,
    },
    {
      key: 'prepare_keepsakes',
      title: { he: 'להכין מזכרות לאורחים', en: 'Prepare keepsakes for guests' },
      notes: {
        he: 'לא חובה: שקית מתוקים, נר או כרטיס תודה אישי.',
        en: 'Optional: a bag of sweets, a candle or a personal thank-you card.',
      },
      offset: -21,
      category: 'other',
    },
    {
      key: 'line_up_helpers',
      title: { he: 'לגייס עזרה להקמה ולפירוק', en: 'Line up helpers for setup and cleanup' },
      notes: {
        he: 'חברים או משפחה שיעזרו להכין, לארח ולנקות אחרי.',
        en: 'Friends or family who can help set up, host and clean up afterwards.',
      },
      offset: -14,
    },
    {
      key: 'build_program',
      title: { he: 'לבנות סדר ערב', en: 'Build the program' },
      notes: {
        he: 'קבלת פנים, אוכל, משחקים, פתיחת מתנות ועוגה, עם זמן משוער לכל חלק.',
        en: 'Welcome, food, games, opening gifts and cake, each with a rough time.',
      },
      offset: -10,
    },
    {
      key: 'confirm_vendors',
      title: { he: 'לאשר עם הספקים מועד והגעה', en: 'Confirm timing and delivery with vendors' },
      notes: {
        he: 'הודעה קצרה לכל ספק עם כתובת, שעה ואיש קשר ליום האירוע.',
        en: 'A short message to each vendor with address, time and a day-of contact.',
      },
      offset: -4,
      priority: 1,
    },
    {
      key: 'set_up_gift_log',
      title: { he: 'להכין מקום לרישום מתנות', en: 'Set up a way to log gifts' },
      notes: {
        he: 'מחברת או גיליון קטן שבו רושמים מי נתן מה, כדי שיהיה קל לשלוח תודות.',
        en: 'A notebook or small sheet noting who gave what, so thank-yous are easy.',
      },
      offset: -2,
    },
    {
      key: 'return_rentals',
      title: { he: 'להחזיר ציוד שכור ולסגור חשבונות', en: 'Return rentals and settle accounts' },
      notes: {
        he: 'בדקו שהכול הוחזר במצב טוב ושכל הספקים קיבלו תשלום.',
        en: 'Check that everything is returned in good shape and every vendor is paid.',
      },
      offset: 2,
      category: 'rental',
    },
    {
      key: 'send_thank_yous',
      title: { he: 'לשלוח תודות על המתנות', en: 'Send thank-yous for the gifts' },
      notes: {
        he: 'הודעה אישית קצרה, ואפשר לצרף תמונה מהערב.',
        en: 'A short personal note, with a photo from the day if you like.',
      },
      offset: 5,
    },
  ],
  categories: [
    { key: 'venue', pct: 18, basis: 'fixed' },
    { key: 'catering', pct: 35, basis: 'per_adult' },
    { key: 'cakes_sweets', pct: 10, basis: 'fixed' },
    { key: 'design', pct: 15, basis: 'fixed' },
    { key: 'entertainment', pct: 8, basis: 'fixed' },
    { key: 'rental', pct: 5, basis: 'fixed' },
    { key: 'photographer', pct: 4, basis: 'fixed' },
    { key: 'other', pct: 5, basis: 'fixed' },
  ],
  requiredVendors: ['catering'],
};
