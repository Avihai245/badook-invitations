import type { PlanTemplate } from '../model/types';

/**
 * A brit milah, a brita or any other welcome ceremony for a baby. The horizon is short and the date
 * is uncertain (the birth decides it), so the road runs from about two months before to two weeks
 * after, and most tasks can still be done late. Nothing here assumes the baby's gender, the parents'
 * gender or that there are two of them, or a level of religiousness.
 */
export const brit: PlanTemplate = {
  key: 'brit',
  eventTypes: ['brit'],
  size: 'full',
  tasks: [
    {
      key: 'brit_format',
      title: {
        he: 'להחליט על סוג הטקס ועל גודל האירוע',
        en: 'Decide on the type of ceremony and the size of the gathering',
      },
      notes: {
        he: 'ברית מילה, בריתה או טקס קבלת פנים אחר, בקטן או בגדול. כל מתכונת מתאימה, ואפשר להחליט שוב בהמשך',
        en: 'A brit milah, a brita or another welcoming ceremony, small or large. Any format works, and you can revisit it later.',
      },
      offset: -60,
    },
    {
      key: 'brit_budget',
      title: { he: 'לקבוע תקציב ולהתאים את החלוקה', en: 'Set a budget and adjust the split' },
      notes: {
        he: 'באירוע קטן הקייטרינג הוא בדרך כלל ההוצאה הגדולה. כדאי להשאיר מרווח לשינויים',
        en: 'In a small gathering, catering is usually the biggest cost. Leave some room for changes.',
      },
      offset: -58,
    },
    {
      key: 'brit_leader',
      title: { he: 'לסגור מוהל או מנחה לטקס', en: 'Book a mohel or ceremony leader' },
      notes: {
        he: 'לברר זמינות סביב התאריך המשוער, גם אם יזוז. בטקס קבלה אחר אפשר לבחור רב, רבה, מנחה או בן משפחה',
        en: 'Check availability around the estimated date, even if it shifts. For other welcome ceremonies, a rabbi, a leader or a family member can lead.',
      },
      offset: -50,
      category: 'officiant',
      minDays: 2,
      priority: 1,
    },
    {
      key: 'brit_date_flex',
      title: {
        he: 'לברר מדיניות שינוי תאריך מול כל הספקים',
        en: 'Ask every vendor about their date-change policy',
      },
      notes: {
        he: 'הלידה לא צפויה, ובברית מילה המועד (היום השמיני) יכול להידחות מסיבות רפואיות. כדאי לסכם גמישות בכתב',
        en: 'Births are unpredictable, and a brit milah (day eight) can be postponed for medical reasons. Get flexibility in writing.',
      },
      offset: -45,
      minDays: 10,
    },
    {
      key: 'brit_place_decide',
      title: {
        he: 'להחליט איפה מתקיים הטקס: בבית, באולם או בבית כנסת',
        en: 'Decide where it takes place: home, hall or synagogue',
      },
      notes: {
        he: 'בבית חוסכים, אבל כדאי לבדוק שיש מקום נוח לכולם ולחשוב על חניה ומדרגות לבני המשפחה המבוגרים',
        en: 'Home saves money, but check there is comfortable room for everyone, plus parking and stairs for older relatives.',
      },
      offset: -45,
      category: 'venue',
      minDays: 7,
    },
    {
      key: 'brit_venue_book',
      title: { he: 'לסגור אולם או מקום, אם האירוע לא בבית', en: "Book a hall or venue, if it's not at home" },
      notes: {
        he: 'לבקש תנאי ביטול ושינוי תאריך גמישים, ולברר אם אפשר לקיים את הטקס בשעות הבוקר',
        en: 'Ask for flexible cancellation and date-change terms, and whether morning hours are available.',
      },
      offset: -40,
      category: 'venue',
      minDays: 7,
    },
    {
      key: 'brit_catering_quotes',
      title: { he: 'לבקש הצעות מחיר לקייטרינג או לארוחת בוקר', en: 'Get quotes for catering or a brunch' },
      notes: {
        he: 'ארוחת בוקר, כיבוד קל או ארוחה מלאה. לשאול אם אפשר לשנות כמות ותאריך ברגע האחרון',
        en: 'A brunch, light bites or a full meal. Ask whether quantities and dates can change at the last minute.',
      },
      offset: -40,
      category: 'catering',
      minDays: 10,
    },
    {
      key: 'brit_catering_book',
      title: {
        he: 'לסגור קייטרינג ולהתאים תפריט לאורחים',
        en: 'Book catering and fit the menu to your guests',
      },
      notes: {
        he: 'לוודא רמת כשרות מתאימה, ואפשרויות לצמחונים, לטבעונים ולבעלי אלרגיות',
        en: 'Check the kashrut level suits your guests, and options for vegetarians, vegans and allergies.',
      },
      offset: -30,
      category: 'catering',
      minDays: 5,
      priority: 1,
    },
    {
      key: 'brit_minyan',
      title: {
        he: 'לארגן מניין לטקס, אם זה חשוב לכם',
        en: 'Arrange a minyan for the ceremony, if it matters to you',
      },
      notes: {
        he: 'לבקש מקרובים, מחברים או מבית כנסת בסביבה להישאר פנויים בטווח תאריכים',
        en: 'Ask relatives, friends or a nearby synagogue to keep a range of dates free.',
      },
      offset: -30,
      minDays: 3,
    },
    {
      key: 'brit_photographer',
      title: { he: 'לסגור צלם או לבקש מקרוב לצלם', en: 'Book a photographer or ask a relative to shoot' },
      notes: {
        he: 'לבחור מישהו גמיש בתאריך, ולהסכים מראש מה מצלמים בטקס ומה לא',
        en: "Pick someone flexible on the date, and agree in advance what is and isn't photographed at the ceremony.",
      },
      offset: -30,
      category: 'photographer',
      minDays: 5,
    },
    {
      key: 'brit_name',
      title: { he: 'להחליט על השם ועל הדרך להכריז עליו', en: 'Decide on the name and how to announce it' },
      notes: {
        he: 'יש משפחות שמגלות את השם רק בטקס ויש שמשתפות אותו מראש. נעים להכין משפט על משמעותו',
        en: 'Some families reveal the name at the ceremony, others share it ahead. A sentence on its meaning is a nice touch.',
      },
      offset: -28,
    },
    {
      key: 'brit_roles',
      title: {
        he: 'לחלק כיבודים ותפקידים בטקס: סנדק ועוד',
        en: 'Assign honors and roles at the ceremony: sandak and more',
      },
      notes: {
        he: 'סנדק או סנדקית, מי שמכניסים את התינוק או התינוקת, ומי שמברכים ומקריאים. אפשר לחלק את הכבוד בין כמה אנשים',
        en: 'A sandak (the person who holds the baby), those who bring the baby in, and those who bless or read. Honors can be shared.',
      },
      offset: -25,
      minDays: 2,
    },
    {
      key: 'brit_baby_clothes',
      title: { he: 'להכין לבוש לטקס לתינוק או לתינוקת', en: 'Get a ceremony outfit for the baby' },
      notes: {
        he: 'כדאי שני בגדים במידות שונות ועוד בגד חילוף נוח, כי המידה לא ידועה מראש',
        en: 'Get two outfits in different sizes plus a comfortable spare, since the size is not known in advance.',
      },
      offset: -21,
      category: 'attire',
      minDays: 4,
    },
    {
      key: 'brit_ceremony_items',
      title: {
        he: 'להכין את פריטי הטקס: כרית, שמיכה וכוס יין',
        en: 'Prepare the ceremony items: pillow, blanket and a wine cup',
      },
      notes: {
        he: 'לשאול את מי שמוביל את הטקס מה נדרש ומה כבר כלול בשירות',
        en: 'Ask whoever leads the ceremony what is needed and what is already included.',
      },
      offset: -21,
      category: 'other',
      minDays: 3,
    },
    {
      key: 'brit_print_signs',
      title: {
        he: 'להזמין הדפסה של שלט, חוברת טקס ותפריט',
        en: 'Order a printed sign, ceremony booklet and menu',
      },
      notes: {
        he: 'חוברת קצרה עוזרת לאורחים לעקוב. אם השם עדיין לא ידוע, משאירים מקום להשלמה',
        en: "A short booklet helps guests follow along. If the name isn't set yet, leave room to fill it in.",
      },
      offset: -18,
      category: 'design',
      minDays: 8,
    },
    {
      key: 'brit_ceremony_text',
      title: {
        he: 'להכין את סדר הטקס, הברכות ודברי הברכה',
        en: 'Prepare the ceremony order, blessings and words from the family',
      },
      notes: {
        he: 'אפשר לשלב ברכות מסורתיות, שירים ודברים אישיים קצרים. להעביר עותק לכל מי שמקריא',
        en: 'Mix traditional blessings, songs and short personal words. Share a copy with each person who reads.',
      },
      offset: -14,
      minDays: 2,
    },
    {
      key: 'brit_cake_sweets',
      title: { he: 'להזמין עוגה, מאפים וכיבוד מתוק', en: 'Order a cake, pastries and sweets' },
      notes: {
        he: 'לסכם שעה ודרך אספקה, ולכלול אפשרות ללא גלוטן',
        en: 'Agree on delivery time and method, and include a gluten-free option.',
      },
      offset: -14,
      category: 'cakes_sweets',
      minDays: 4,
    },
    {
      key: 'brit_flowers_decor',
      title: {
        he: 'לסדר פרחים ועיצוב לפינת הטקס ולשולחנות',
        en: 'Arrange flowers and decor for the ceremony corner and tables',
      },
      notes: {
        he: 'כיסא כבוד, שולחן לטקס ופינת צילום. מספיקים כמה פריטים פשוטים',
        en: 'A seat of honor, a ceremony table and a photo corner. A few simple items are enough.',
      },
      offset: -14,
      category: 'flowers',
      minDays: 5,
    },
    {
      key: 'brit_baby_bag',
      title: { he: 'להכין תיק לתינוק או לתינוקת ליום הטקס', en: 'Pack a bag for the baby for the day' },
      notes: {
        he: 'חיתולים, בגדים להחלפה, שמיכה וכל מה שעוזר להרגיע',
        en: 'Diapers, spare clothes, a blanket and anything that helps soothe.',
      },
      offset: -14,
    },
    {
      key: 'brit_medical',
      title: {
        he: 'לברר עם רופא או אחות הנחיות לפני הטקס ואחריו',
        en: 'Ask a doctor or nurse for guidance before and after the ceremony',
      },
      notes: {
        he: 'במיוחד בברית מילה: בריאות התינוק, בדיקות לפני הטקס וטיפול בימים שאחריו. כדאי לדעת למי להתקשר',
        en: "Especially for a brit milah: the baby's health, checks before the ceremony and aftercare. Know who to call.",
      },
      offset: -14,
    },
    {
      key: 'brit_rental',
      title: {
        he: 'לבדוק אם צריך להשכיר כיסאות, שולחנות או כלים',
        en: 'Check whether to rent chairs, tables or dishes',
      },
      notes: {
        he: 'בבית כדאי לחשב כמה אנשים נכנסים בנוחות, ולהזמין כמה ימים מראש',
        en: 'At home, work out how many people fit comfortably, and order a few days ahead.',
      },
      offset: -12,
      category: 'rental',
      minDays: 3,
    },
    {
      key: 'brit_help',
      title: {
        he: 'לבקש מקרובים וחברים עזרה בהכנות ובפינוי',
        en: 'Ask relatives and friends to help with setup and cleanup',
      },
      notes: {
        he: 'בשבועות הראשונים כל עזרה חשובה. אפשר לחלק בין כמה אנשים: הקמה, הגשה ופינוי',
        en: 'In these first weeks every bit of help counts. Split it up: setup, serving and cleanup.',
      },
      offset: -10,
      minDays: 2,
    },
    {
      key: 'brit_confirm_leader',
      title: {
        he: 'לאשר שוב מועד ושעה עם המוהל או המנחה',
        en: 'Reconfirm the date and time with the mohel or ceremony leader',
      },
      notes: {
        he: 'לוודא שיש טלפון זמין גם בלילה שלפני, למקרה שהמועד או השעה משתנים',
        en: 'Make sure you have a number that works even the night before, in case timing changes.',
      },
      offset: -5,
      category: 'officiant',
      priority: 1,
    },
    {
      key: 'brit_confirm_vendors',
      title: {
        he: 'לאשר עם הקייטרינג והצלם את המועד והשעה הסופיים',
        en: 'Confirm the final date and time with the caterer and photographer',
      },
      notes: {
        he: 'אם המועד זז, כדאי לעדכן את כל הספקים באותו יום',
        en: 'If the date moves, update all vendors on the same day.',
      },
      offset: -3,
    },
    {
      key: 'brit_day_setup',
      title: {
        he: 'לסדר את המקום: כיסאות, פינת טקס וכיבוד',
        en: 'Set up the space: seating, ceremony corner and refreshments',
      },
      notes: {
        he: 'לבקש מקרובים להגיע שעה לפני כדי לעזור, ולמנות מי מארח את האורחים',
        en: 'Ask relatives to arrive an hour early to help, and choose who hosts the guests.',
      },
      offset: 0,
    },
    {
      key: 'brit_day_baby',
      title: {
        he: 'לתת לתינוק או לתינוקת זמן שקט ולהאכיל לפני הטקס',
        en: 'Give the baby a quiet moment and a feed before the ceremony',
      },
      notes: {
        he: 'כדאי שמישהו אחר ידאג לשאר המשימות בזמן הזה',
        en: 'Ask someone else to handle everything else during this time.',
      },
      offset: 0,
    },
    {
      key: 'brit_thanks',
      title: {
        he: 'לשלוח הודעות תודה לאורחים ולמי שעזרו',
        en: 'Send thank-you messages to guests and helpers',
      },
      notes: {
        he: 'הודעה קצרה עם תמונה מהטקס משמחת מאוד',
        en: 'A short message with a photo from the ceremony goes a long way.',
      },
      offset: 3,
    },
    {
      key: 'brit_pay_balances',
      title: {
        he: 'לשלם יתרות למוהל או למנחה ולספקים',
        en: 'Pay the balances to the mohel or leader and the vendors',
      },
      notes: {
        he: 'לשמור חשבוניות וקבלות, ולעדכן את התקציב בהוצאות בפועל',
        en: 'Keep invoices and receipts, and update the budget with actual costs.',
      },
      offset: 5,
    },
    {
      key: 'brit_photos_share',
      title: {
        he: 'לאסוף את התמונות ולשתף אותן עם המשפחה',
        en: 'Collect the photos and share them with family',
      },
      notes: {
        he: 'אלבום משותף מאפשר לכל המשפחה להוסיף תמונות משלה',
        en: 'A shared album lets everyone add their own photos.',
      },
      offset: 7,
      category: 'photographer',
    },
    {
      key: 'brit_record_name',
      title: {
        he: 'לרשום או לעדכן את השם ברישומים הרשמיים',
        en: "Register or update the baby's name in official records",
      },
      notes: {
        he: 'אם השם נקבע רק בטקס, לבדוק מול משרד הפנים וקופת החולים מה נדרש',
        en: 'If the name was only chosen at the ceremony, check with the Interior Ministry and your health fund what is needed.',
      },
      offset: 7,
    },
    {
      key: 'brit_keepsake',
      title: {
        he: 'לשמור ברכות ותמונות במקום אחד כזיכרון',
        en: 'Keep the blessings and photos in one place as a keepsake',
      },
      notes: {
        he: 'אלבום או תיבה שהתינוק או התינוקת יוכלו לפתוח כשיגדלו',
        en: 'An album or box the baby can open when they are grown.',
      },
      offset: 14,
    },
  ],
  categories: [
    { key: 'catering', pct: 36, basis: 'per_adult' },
    { key: 'venue', pct: 15, basis: 'fixed' },
    { key: 'officiant', pct: 12, basis: 'fixed' },
    { key: 'photographer', pct: 10, basis: 'fixed' },
    { key: 'cakes_sweets', pct: 6, basis: 'fixed' },
    { key: 'flowers', pct: 4, basis: 'fixed' },
    { key: 'design', pct: 4, basis: 'fixed' },
    { key: 'attire', pct: 4, basis: 'fixed' },
    { key: 'rental', pct: 3, basis: 'per_guest' },
    { key: 'other', pct: 6, basis: 'fixed' },
  ],
  requiredVendors: ['officiant', 'catering'],
};
