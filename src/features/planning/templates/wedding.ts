import type { PlanTemplate } from '../model/types';

/**
 * The wedding: the whole road, from about fourteen months before to two weeks after. Nothing here
 * assumes who the couple is or how religious: the legal ceremony and registration stay neutral, and
 * the religious or traditional items (kashrut, ketubah, Sheva Brachot) are worded as options.
 * The invitation, the guest list, the replies, the seating and the entrance are system tasks
 * (see systemTasksFor), so they are not repeated here.
 */
export const wedding: PlanTemplate = {
  key: 'wedding',
  eventTypes: ['wedding'],
  size: 'full',
  tasks: [
    // --- the frame: budget, guests, venue, food (about 14 to 10 months before)
    {
      key: 'set_budget',
      title: {
        he: 'לקבוע תקציב ולתאם ציפיות עם המשפחות',
        en: 'Set the budget and align expectations with both families',
      },
      notes: {
        he: 'כמה אתם רוצים להשקיע, מי משתתף במימון ומה הכי חשוב לכם. החלוקה המומלצת בתקציב היא נקודת פתיחה טובה.',
        en: 'How much you want to spend, who is contributing and what matters most to you. The suggested budget split is a good starting point.',
      },
      offset: -410,
    },
    {
      key: 'estimate_guest_count',
      title: { he: 'להעריך כמה אורחים יהיו', en: 'Estimate the guest count' },
      notes: {
        he: 'טווח גס מספיק כדי לבחור אולם ולחשב תקציב. את הרשימה המלאה תבנו בהמשך.',
        en: 'A rough range is enough to choose a venue and plan the budget. You will build the full list later.',
      },
      offset: -395,
    },
    {
      key: 'visit_venues',
      title: { he: 'לסייר באולמות ולהשוות הצעות', en: 'Tour venues and compare quotes' },
      notes: {
        he: 'לבדוק זמינות בכמה תאריכים, לבקש הצעה בכתב ולוודא מה כלול. תאריך באמצע השבוע לרוב זול יותר.',
        en: 'Check several dates, get quotes in writing and see what is included. A midweek date is often cheaper.',
      },
      offset: -380,
      category: 'venue',
      minDays: 150,
    },
    {
      key: 'book_venue_and_date',
      title: { he: 'לסגור אולם ותאריך', en: 'Book the venue and lock the date' },
      notes: {
        he: 'לפני החתימה לוודא שהתאריך מתאים למשפחה הקרובה ולא מתנגש עם חג או אירוע חשוב.',
        en: 'Before signing, make sure the date works for close family and does not clash with a holiday or a key event.',
      },
      offset: -350,
      category: 'venue',
      minDays: 120,
      priority: 1,
    },
    {
      key: 'review_venue_contract',
      title: {
        he: 'לעבור על תנאי החוזה והביטולים עם האולם',
        en: "Go through the venue's contract and cancellation terms",
      },
      notes: {
        he: 'מדיניות ביטול ושינוי תאריך, שעות האירוע, לוח תשלומים, חניה וגיבוי למזג אוויר אם יש חלק בחוץ.',
        en: 'Cancellation and date-change policy, event hours, payment schedule, parking, and a rain plan if part of it is outdoors.',
      },
      offset: -345,
      category: 'venue',
      minDays: 90,
    },
    {
      key: 'choose_catering',
      title: { he: 'לסגור קייטרינג', en: 'Book the catering' },
      notes: {
        he: 'אם האולם כולל קייטרינג, לעבור על מה בדיוק כלול. אחרת לקבל הצעות מכמה ספקים ולהשוות מחיר לאדם.',
        en: 'If the venue includes catering, check exactly what is covered. Otherwise get quotes from a few caterers and compare the price per person.',
      },
      offset: -325,
      category: 'catering',
      minDays: 90,
    },
    {
      key: 'check_kashrut',
      title: { he: 'לברר כשרות והתאמות תפריט לאורחים', en: 'Sort out kashrut and dietary needs' },
      notes: {
        he: 'איזו תעודת כשרות מתאימה לכם ולאורחים, ואילו מנות יידרשו לצמחונים, לטבעונים ולבעלי אלרגיות.',
        en: 'Which kashrut certificate suits you and your guests, and which meals you need for vegetarians, vegans and guests with allergies.',
      },
      offset: -310,
      category: 'catering',
      minDays: 60,
    },
    {
      key: 'build_inspiration',
      title: { he: 'ליצור לוח השראה משותף', en: 'Create a shared inspiration board' },
      notes: {
        he: 'צבעים, סגנון ואווירה. זה מקל על כל ספק להבין מה אתם מחפשים.',
        en: 'Colors, style and mood. It helps every vendor understand what you are after.',
      },
      offset: -300,
      category: 'design',
      minDays: 60,
    },

    // --- the vendors who book up early (about 9 to 7 months before)
    {
      key: 'book_photographer',
      title: { he: 'לבחור צילום סטילס', en: 'Choose a photographer' },
      notes: {
        he: 'לראות אלבומים שלמים ולא רק תמונות נבחרות, ולברר מתי מקבלים את התמונות.',
        en: 'Look at full albums, not just highlights, and ask when you will receive the photos.',
      },
      offset: -270,
      category: 'photographer',
      minDays: 90,
    },
    {
      key: 'book_videographer',
      title: { he: 'לבחור צילום וידאו (אם רוצים)', en: 'Choose a videographer (optional)' },
      notes: {
        he: 'אם רוצים סרט: לבדוק אם אפשר חבילה משותפת עם הצילום, ומה זמן המסירה.',
        en: 'If you want a film, ask about a joint package with the photographer and about the delivery time.',
      },
      offset: -260,
      category: 'videographer',
      minDays: 90,
    },
    {
      key: 'book_dj',
      title: { he: "לסגור די-ג'יי", en: 'Book a DJ' },
      notes: {
        he: 'לשמוע סטים מאירועים אמיתיים ולוודא שהסגנון מתאים לכם ולקהל האורחים.',
        en: 'Listen to sets from real events and make sure the style fits you and your guests.',
      },
      offset: -250,
      category: 'dj',
      minDays: 75,
    },
    {
      key: 'book_band',
      title: {
        he: 'לסגור להקה או נגנים (אם רוצים מוזיקה חיה)',
        en: 'Book a band or live musicians (optional)',
      },
      notes: {
        he: 'מוזיקה חיה לחופה או לריקודים. לבדוק ציוד, סאונד ושעות הופעה מול האולם.',
        en: 'Live music for the ceremony or the dancing. Check equipment, sound and set times with the venue.',
      },
      offset: -245,
      category: 'band',
      minDays: 90,
    },
    {
      key: 'plan_honeymoon',
      title: { he: 'לתכנן חופשת ירח דבש', en: 'Plan the honeymoon' },
      notes: {
        he: 'לבחור יעד ותאריכים, ולבדוק בזמן תוקף דרכונים, ויזות וחיסונים.',
        en: 'Pick a destination and dates, and check passports, visas and vaccinations early.',
      },
      offset: -240,
      category: 'other',
      minDays: 60,
    },
    {
      key: 'book_designer',
      title: { he: 'לסגור עיצוב לאולם ולחופה', en: 'Book the event design' },
      notes: {
        he: 'להביא תמונות השראה ולבקש הדמיה. לבדוק מה העיצוב של האולם כבר כולל.',
        en: "Bring inspiration photos and ask for a mock-up. Check what the venue's own decor already includes.",
      },
      offset: -235,
      category: 'design',
      minDays: 60,
    },
    {
      key: 'book_florist',
      title: { he: 'לבחור פרחים וקישוטי פרחים', en: 'Choose the flowers' },
      notes: {
        he: 'אם העיצוב כולל פרחים, לברר מה בדיוק כלול, ולהחליט אם רוצים גם פרחים אישיים לבני הזוג.',
        en: 'If the design includes flowers, check exactly what is covered, and decide whether you want personal flowers too.',
      },
      offset: -225,
      category: 'flowers',
      minDays: 45,
    },

    // --- outfits, rings, officiant, honeymoon booking (about 6 to 4 months before)
    {
      key: 'start_attire_search',
      title: { he: 'להתחיל לחפש את בגדי האירוע', en: 'Start looking for your wedding outfits' },
      notes: {
        he: 'שמלה, חליפה או כל לבוש שמרגיש לכם נכון. לתכנן זמן למדידות ותיקונים.',
        en: 'A dress, a suit or anything that feels right to you. Leave time for fittings and alterations.',
      },
      offset: -200,
      category: 'attire',
      minDays: 90,
    },
    {
      key: 'choose_officiant',
      title: { he: 'לבחור מי יערוך את הטקס', en: 'Choose who will officiate the ceremony' },
      notes: {
        he: 'רב או רבנית, מסדר קידושין או עורך טקס אישי. לבדוק זמינות בתאריך ולהכיר לפני כן.',
        en: 'A rabbi, a marriage officiant or a personal celebrant. Check availability on your date and meet beforehand.',
      },
      offset: -150,
      category: 'officiant',
      minDays: 60,
      priority: 1,
    },
    {
      key: 'order_attire',
      title: { he: 'להזמין או לקנות את בגדי האירוע', en: 'Order or buy your wedding outfits' },
      notes: {
        he: 'לקחת בחשבון זמני אספקה ותיקונים, ולסדר גם נעליים ואקססוריז.',
        en: 'Allow for delivery and alteration times, and sort out shoes and accessories too.',
      },
      offset: -150,
      category: 'attire',
      minDays: 60,
    },
    {
      key: 'open_gift_account',
      title: {
        he: 'לפתוח חשבון או ארנק דיגיטלי למתנות',
        en: 'Set up an account or digital wallet for gifts',
      },
      notes: {
        he: "כדי לרכז צ'קים, העברות ושוברי מתנה במקום אחד ולהקל על האורחים.",
        en: 'To keep checks, transfers and gift vouchers in one place and make it easy for guests.',
      },
      offset: -150,
      category: 'other',
      minDays: 30,
    },
    {
      key: 'book_honeymoon',
      title: { he: 'להזמין טיסות ולינה לירח הדבש', en: 'Book honeymoon flights and stays' },
      notes: {
        he: 'הזמנה מוקדמת חוסכת כסף. כדאי לבחור תנאי ביטול גמישים למקרה של שינוי תאריך.',
        en: 'Booking early saves money. Choose flexible cancellation in case anything changes.',
      },
      offset: -140,
      category: 'other',
      minDays: 45,
    },
    {
      key: 'book_makeup_hair',
      title: { he: 'לסגור איפור ושיער', en: 'Book hair and makeup' },
      notes: {
        he: 'לברר מי מתארגן איפה ובאיזו שעה, ולקבוע ניסיון לפני האירוע.',
        en: 'Work out who gets ready where and when, and schedule a trial before the day.',
      },
      offset: -140,
      category: 'makeup_hair',
      minDays: 30,
    },
    {
      key: 'choose_rings',
      title: { he: 'לבחור ולהזמין טבעות', en: 'Choose and order the rings' },
      notes: {
        he: 'להשאיר זמן לחריטה ולמידות. כדאי לאסוף אותן לפחות שבועיים לפני.',
        en: 'Leave time for sizing and engraving. Aim to collect them at least two weeks before.',
      },
      offset: -130,
      category: 'other',
      minDays: 45,
    },

    // --- the legal ceremony and registration, the ketubah, the bar and the sweets (about 4 to 2 months before)
    {
      key: 'legal_route',
      title: {
        he: 'להחליט על מסלול הטקס והרישום החוקי',
        en: 'Decide how to handle the ceremony and legal registration',
      },
      notes: {
        he: 'רישום ברבנות, נישואים אזרחיים בחו״ל או ברית זוגיות. לכל מסלול מסמכים וזמנים אחרים.',
        en: 'Rabbinate registration, a civil marriage abroad or a civil union. Each route has its own documents and timelines.',
      },
      offset: -120,
      minDays: 60,
      priority: 1,
    },
    {
      key: 'bar_plan',
      title: { he: 'לתכנן בר ומשקאות', en: 'Plan the bar and drinks' },
      notes: {
        he: 'לבדוק מה כלול בחבילה, כמה אלכוהול ומשקאות קלים צריך, ואם אפשר להביא משקאות משלכם.',
        en: 'Check what the package includes, how much alcohol and soft drinks you need, and whether you can bring your own.',
      },
      offset: -110,
      category: 'bar',
      minDays: 30,
    },
    {
      key: 'gather_documents',
      title: { he: 'לאסוף את המסמכים לרישום', en: 'Gather the documents for registration' },
      notes: {
        he: 'תעודות זהות, אישורי מצב אישי ומסמכים נוספים לפי המסלול שבחרתם. כדאי לברר מוקדם מה נדרש.',
        en: 'IDs, personal status certificates and any other papers your route requires. Find out early what is needed.',
      },
      offset: -100,
      minDays: 45,
      priority: 1,
    },
    {
      key: 'order_dessert',
      title: { he: 'להזמין עוגה ושולחן מתוקים', en: 'Order the cake and dessert table' },
      notes: {
        he: 'לטעום מראש, ולבדוק עם הקייטרינג אם מותר להכניס קינוחים מבחוץ וכמה זה עולה.',
        en: 'Taste in advance and check with the caterer whether outside desserts are allowed and at what cost.',
      },
      offset: -100,
      category: 'cakes_sweets',
      minDays: 21,
    },
    {
      key: 'choose_ketubah',
      title: { he: 'לבחור כתובה או מסמך נישואין', en: 'Choose a ketubah or marriage document' },
      notes: {
        he: 'נוסח מסורתי, שוויוני או אישי. לבדוק עם מי שמסדר את הטקס מה מתאים, ולהזמין בזמן.',
        en: 'Traditional, egalitarian or personal wording. Check with your officiant what fits, and order in time.',
      },
      offset: -90,
      category: 'other',
      minDays: 30,
    },
    {
      key: 'plan_transport',
      title: { he: 'לארגן הסעות וחניה לאורחים', en: 'Arrange transportation and parking for guests' },
      notes: {
        he: 'הסעות מהעיר, חניה באולם ודרך הביתה בסוף הערב. לבדוק מי באמת צריך הסעה.',
        en: 'Shuttles from the city, parking at the venue and a way home at the end of the night. Ask who really needs a ride.',
      },
      offset: -90,
      category: 'transport',
      minDays: 21,
    },
    {
      key: 'order_printing',
      title: { he: 'להזמין הדפסות לאירוע', en: 'Order printed items for the event' },
      notes: {
        he: 'שלטים, תפריטים וכרטיסי תודה, ואם רוצים גם הזמנות מודפסות לקרובים שמעדיפים נייר.',
        en: 'Signs, menus and thank-you cards, plus printed invitations for relatives who prefer paper, if you like.',
      },
      offset: -90,
      category: 'invitations_print',
      minDays: 30,
    },
    {
      key: 'wedding_night_stay',
      title: { he: 'לסגור מקום ללילה שאחרי האירוע', en: 'Book a place to stay after the wedding' },
      notes: {
        he: 'חדר, צימר או מלון קרוב לאולם. כדאי להזמין מוקדם, בעיקר בעונות העמוסות.',
        en: 'A room, a cabin or a hotel near the venue. Book early, especially in busy seasons.',
      },
      offset: -80,
      category: 'other',
      minDays: 14,
    },
    {
      key: 'submit_registration',
      title: {
        he: 'להגיש בקשה ולקבוע מועד לרישום',
        en: 'File the application and book a registration appointment',
      },
      notes: {
        he: 'להביא את כל המסמכים, לברר אם נדרשים עדים, ולהבין כמה זמן לוקח לקבל אישור.',
        en: 'Bring all the documents, ask whether witnesses are needed, and find out how long approval takes.',
      },
      offset: -75,
      minDays: 30,
      priority: 1,
    },
    {
      key: 'plan_ceremony',
      title: { he: 'לתכנן את סדר הטקס והחופה', en: 'Plan the ceremony' },
      notes: {
        he: 'מי מלווה, מי עומד תחת החופה, אילו ברכות ושירים, ואילו דברים אישיים רוצים להגיד.',
        en: 'Who walks with you, who stands under the chuppah, which blessings and songs, and any personal words you want to say.',
      },
      offset: -70,
      category: 'officiant',
      minDays: 14,
    },

    // --- the last two months: meetings, fittings, details
    {
      key: 'meet_officiant',
      title: { he: 'להיפגש עם מי שיערוך את הטקס', en: 'Meet your officiant' },
      notes: {
        he: 'לעבור על הסדר, על התפקידים ועל מה שחשוב לכם, ולסגור את שעת ההגעה.',
        en: 'Go over the order, the roles and what matters to you, and agree on the arrival time.',
      },
      offset: -60,
      category: 'officiant',
      minDays: 14,
    },
    {
      key: 'attire_fitting',
      title: { he: 'למדוד ולתקן את בגדי האירוע', en: 'Fit and alter your outfits' },
      notes: {
        he: 'כמה מדידות לפני, עם הנעליים והאקססוריז שתלבשו, ולהשאיר זמן לתיקונים.',
        en: 'A few fittings, with the shoes and accessories you will wear, leaving time for alterations.',
      },
      offset: -50,
      category: 'attire',
      minDays: 21,
    },
    {
      key: 'makeup_trial',
      title: { he: 'לעשות ניסיון איפור ושיער', en: 'Do a hair and makeup trial' },
      notes: {
        he: 'לצלם את התוצאה ולבדוק איך היא נראית באור יום ובצילום.',
        en: 'Take photos of the result and check how it looks in daylight and on camera.',
      },
      offset: -45,
      category: 'makeup_hair',
      minDays: 21,
    },
    {
      key: 'music_list',
      title: { he: 'להכין רשימת שירים: חובה ואסור', en: 'Prepare the playlist: must-play and do-not-play' },
      notes: {
        he: "שיר לכניסה, לחופה ולריקוד הראשון, ושירים שלא רוצים לשמוע. לשלוח לדי-ג'יי או ללהקה.",
        en: 'Songs for the entrance, the ceremony and the first dance, plus any you never want to hear. Send it to the DJ or band.',
      },
      offset: -35,
      category: 'dj',
      minDays: 14,
    },
    {
      key: 'shot_list',
      title: { he: 'להעביר לצוות הצילום רשימת תמונות', en: 'Send the photography team a shot list' },
      notes: {
        he: 'קבוצות משפחה, אנשים חשובים ורגעים שאסור לפספס, ומי יכול לעזור לזהות קרובים.',
        en: 'Family groups, important people and moments you cannot miss, and who can help point out relatives.',
      },
      offset: -30,
      category: 'photographer',
      minDays: 7,
    },
    {
      key: 'final_venue_visit',
      title: { he: 'לעבור סיור אחרון באולם', en: 'Do a final walkthrough of the venue' },
      notes: {
        he: 'לבדוק מיקום החופה, סאונד, תאורה, כניסת ספקים ונקודות חשמל, ולסגור שאלות פתוחות.',
        en: 'Check the ceremony spot, sound, lighting, vendor access and power points, and settle any open questions.',
      },
      offset: -30,
      category: 'venue',
      minDays: 10,
    },
    {
      key: 'sheva_brachot',
      title: { he: 'לתכנן ארוחות שבע ברכות (אם רוצים)', en: 'Plan Sheva Brachot meals (optional)' },
      notes: {
        he: 'ארוחות קטנות עם משפחה וחברים בשבוע שאחרי. אפשר לבקש מקרובים לארגן, וזה לגמרי אופציונלי.',
        en: 'Small meals with family and friends in the week after. You can ask relatives to host, and it is entirely optional.',
      },
      offset: -30,
      minDays: 10,
    },
    {
      key: 'run_sheet',
      title: { he: 'לבנות לוח זמנים ליום האירוע', en: 'Build the day-of timeline' },
      notes: {
        he: 'מההתארגנות ועד הריקוד האחרון, עם שעות לכל ספק ולכל צד במשפחה. לשלוח לכל מי שמעורב.',
        en: 'From getting ready to the last dance, with times for every vendor and each side of the family. Share it with everyone involved.',
      },
      offset: -21,
      minDays: 7,
    },
    {
      key: 'speeches',
      title: { he: 'לתאם מי נושא דברים או מרים כוסית', en: 'Plan who gives speeches or toasts' },
      notes: {
        he: 'לבקש מכמה אנשים מראש, להגביל כל אחד לכמה דקות ולקבוע מתי בערב.',
        en: 'Ask a few people ahead of time, keep each to a few minutes and decide when in the evening.',
      },
      offset: -20,
      minDays: 7,
    },

    // --- final confirmations (two weeks to one week before)
    {
      key: 'vendor_contacts',
      title: { he: 'לרכז את פרטי הספקים בדף אחד', en: 'Put all vendor details on one sheet' },
      notes: {
        he: 'שם, טלפון, שעת הגעה ומה סוכם עם כל ספק. לשלוח למי שאחראי ביום האירוע.',
        en: 'Name, phone, arrival time and what was agreed with each vendor. Send it to whoever is in charge on the day.',
      },
      offset: -14,
    },
    {
      key: 'attire_pickup',
      title: { he: 'לאסוף את בגדי האירוע והאקססוריז', en: 'Pick up the outfits and accessories' },
      notes: {
        he: 'לבדוק שהכל במידה ושלם, ולשמור במקום בטוח. להכין גם תיק להתארגנות.',
        en: 'Check that everything fits and is complete, and store it somewhere safe. Pack a getting-ready bag too.',
      },
      offset: -10,
      category: 'attire',
    },
    {
      key: 'confirm_venue_catering',
      title: {
        he: 'לאשר עם האולם והקייטרינג את פרטי היום',
        en: "Confirm the day's details with the venue and caterer",
      },
      notes: {
        he: 'שעות הגעה, תפריט ומנות מיוחדות, מי מקבל את הספקים ואיך ומתי משלמים את היתרה.',
        en: 'Arrival times, menu and special meals, who receives vendors, and how and when the balance is paid.',
      },
      offset: -10,
      category: 'venue',
    },
    {
      key: 'final_payments_prep',
      title: { he: 'להכין תשלומים ותשר לספקים', en: 'Prepare final payments and tips for vendors' },
      notes: {
        he: "להחליט מה משלמים מראש ומה ביום האירוע, ולהכין צ'קים, מעטפות או הוראות העברה.",
        en: 'Decide what is paid in advance and what on the day, and prepare checks, envelopes or transfer details.',
      },
      offset: -10,
      category: 'other',
    },
    {
      key: 'confirm_photo_video',
      title: { he: 'לאשר פרטים אחרונים עם צוותי הצילום', en: 'Confirm final details with photo and video' },
      notes: {
        he: 'מקום ושעת הגעה, רשימת התמונות ואיש קשר ביום האירוע.',
        en: 'Arrival place and time, the shot list and a contact person for the day.',
      },
      offset: -9,
      category: 'photographer',
    },
    {
      key: 'confirm_music',
      title: {
        he: "לאשר שעות וציוד עם הדי-ג'יי או הלהקה",
        en: 'Confirm times and equipment with the DJ or band',
      },
      notes: {
        he: 'לוודא שהם יודעים איפה להתקין, מתי בדיקת הסאונד ומה סדר הערב.',
        en: 'Make sure they know where to set up, when the sound check is and the order of the evening.',
      },
      offset: -9,
      category: 'dj',
    },
    {
      key: 'confirm_other_vendors',
      title: {
        he: 'לאשר עיצוב, פרחים, איפור והסעות',
        en: 'Confirm design, flowers, hair and makeup, and transport',
      },
      notes: {
        he: 'שיחה קצרה עם כל אחד: שעה, כתובת, מי מקבל אותם ומי משלם.',
        en: 'A short call with each: time, address, who receives them and who pays.',
      },
      offset: -8,
      category: 'design',
    },
    {
      key: 'confirm_officiant',
      title: {
        he: 'לאשר שעה ופרטים עם מי שיערוך את הטקס',
        en: 'Confirm the time and details with your officiant',
      },
      notes: {
        he: 'לוודא שהמסמכים מוכנים, ושיש מי שמקבל אותם בהגעה.',
        en: 'Check that the papers are ready and that someone will greet them on arrival.',
      },
      offset: -7,
      category: 'officiant',
    },

    // --- the last days
    {
      key: 'ceremony_rehearsal',
      title: { he: 'לעשות חזרה על הטקס (אם רוצים)', en: 'Rehearse the ceremony (optional)' },
      notes: {
        he: 'לעבור על הכניסה, על מי עומד איפה ועל התנועה. לרוב מספיקה חזרה של רבע שעה.',
        en: 'Go over the entrance, who stands where and how people move. A quarter of an hour is usually enough.',
      },
      offset: -3,
    },
    {
      key: 'pack_ceremony_items',
      title: { he: 'לארוז את מה שצריך לטקס ולערב', en: 'Pack what the ceremony and evening need' },
      notes: {
        he: 'טבעות, כתובה, תעודות זהות, תשלומים ונעליים להחלפה. להניח הכל במקום אחד.',
        en: 'Rings, ketubah, IDs, payments and a spare pair of shoes. Put everything in one place.',
      },
      offset: -2,
    },
    {
      key: 'rest_day_before',
      title: { he: 'לנוח, לאכול טוב ולישון', en: 'Rest, eat well and get some sleep' },
      notes: {
        he: 'אין עוד מה להוסיף. מה שלא הסתדר אפשר להעביר למשפחה או לחברים.',
        en: 'Nothing more to add. Hand anything unfinished to family or friends.',
      },
      offset: -1,
    },

    // --- the day itself
    {
      key: 'emergency_kit',
      title: { he: 'להכין סל חירום ליום האירוע', en: 'Prepare an emergency kit for the day' },
      notes: {
        he: 'פלסטרים, מחט וחוט, משכך כאבים, מטען, מגבונים, מסרק ונעליים נוחות להחלפה.',
        en: 'Band-aids, needle and thread, painkillers, a charger, wipes, a comb and comfortable spare shoes.',
      },
      offset: 0,
    },
    {
      key: 'payment_person',
      title: { he: 'למנות אדם אחראי לתשלומי יום האירוע', en: 'Name someone in charge of day-of payments' },
      notes: {
        he: "מי שמחזיק את המעטפות והצ'קים לספקים ומשלם בסוף הערב, כדי שלא תצטרכו להתעסק בזה.",
        en: 'Someone to hold the envelopes and checks for vendors and pay at the end of the night, so you do not have to.',
      },
      offset: 0,
      category: 'other',
    },
    {
      key: 'day_of_coordinator',
      title: { he: 'למנות אדם שמתאם מול הספקים ביום האירוע', en: 'Name a day-of contact for the vendors' },
      notes: {
        he: 'אדם אחד שהספקים פונים אליו עם שאלות, כדי שלא יפנו אליכם.',
        en: 'One person vendors can turn to with questions, so that nobody needs to ask you.',
      },
      offset: 0,
    },
    {
      key: 'gifts_keeper',
      title: {
        he: 'למנות אדם שישמור על המתנות והמעטפות',
        en: 'Name someone to look after gifts and envelopes',
      },
      notes: {
        he: 'ארגז או שולחן נפרד, והחלטה מראש מי לוקח אותם הביתה בסוף הערב.',
        en: 'A separate box or table, and a decision in advance about who takes them home at the end.',
      },
      offset: 0,
      category: 'other',
    },
    {
      key: 'pause_and_enjoy',
      title: { he: 'לעצור רגע ולהסתכל סביב', en: 'Pause for a moment and take it all in' },
      notes: {
        he: 'לפחות פעם אחת בערב לעצור ולראות את כל האנשים שבאו בשבילכם.',
        en: 'At least once during the evening, stop and look at everyone who came for you.',
      },
      offset: 0,
    },

    // --- after the wedding (the first two weeks)
    {
      key: 'count_gifts',
      title: { he: 'לספור ולרשום מתנות ומעטפות', en: 'Count and log gifts and envelopes' },
      notes: {
        he: "לרשום מי נתן מה, להפקיד צ'קים בזמן ולבדוק תוקף של שוברי מתנה.",
        en: 'Note who gave what, deposit checks on time and check when gift vouchers expire.',
      },
      offset: 2,
      category: 'other',
    },
    {
      key: 'thank_you_messages',
      title: { he: 'לשלוח הודעות תודה לאורחים', en: 'Send thank-you messages to guests' },
      notes: {
        he: 'הודעה אישית לקרובים והודעה כללית לכולם. אפשר לצרף תמונה מהאירוע.',
        en: 'A personal note to close ones and a general message to everyone. A photo from the day is a nice touch.',
      },
      offset: 3,
    },
    {
      key: 'thank_vendors',
      title: { he: 'להודות לספקים ולכתוב המלצות', en: 'Thank your vendors and leave reviews' },
      notes: {
        he: 'מילה טובה והמלצה עוזרות לספקים ולבני זוג שאחריכם.',
        en: 'A kind word and a review help vendors and the couples who come after you.',
      },
      offset: 4,
    },
    {
      key: 'pay_final_balances',
      title: { he: 'לשלם יתרות לספקים ולסגור חשבונות', en: 'Pay remaining balances and close the accounts' },
      notes: {
        he: 'לעבור על כל הספקים, לוודא שיש קבלה או חשבונית, ולעדכן את התקציב.',
        en: 'Go through every vendor, make sure you have a receipt or invoice, and update the budget.',
      },
      offset: 5,
      category: 'other',
    },
    {
      key: 'collect_photos_video',
      title: {
        he: 'לאסוף תמונות וסרטונים מהאורחים ומהספקים',
        en: 'Collect photos and videos from guests and vendors',
      },
      notes: {
        he: 'לבקש מהאורחים תמונות, לברר מתי מגיעים התמונות והסרט הסופיים, ולגבות את הקבצים.',
        en: 'Ask guests for photos, find out when the final photos and film arrive, and back up the files.',
      },
      offset: 7,
      category: 'photographer',
    },
    {
      key: 'marriage_certificate',
      title: {
        he: 'לוודא שהרישום הושלם ולקבל תעודה',
        en: 'Make sure registration is complete and get your certificate',
      },
      notes: {
        he: 'לשמור עותקים, ולברר מה עוד צריך לעדכן אחרי הנישואין.',
        en: 'Keep copies, and find out what else needs updating after the wedding.',
      },
      offset: 10,
      priority: 1,
    },
    {
      key: 'update_details',
      title: { he: 'לעדכן שם וכתובת בגופים הרלוונטיים', en: 'Update your name and address records' },
      notes: {
        he: 'אם שיניתם שם או כתובת: משרד הפנים, בנק, ביטוחים, קופת חולים ומקום העבודה.',
        en: 'If you changed a name or address: the Ministry of Interior, bank, insurance, health fund and workplace.',
      },
      offset: 12,
    },
  ],
  categories: [
    { key: 'venue', pct: 22, basis: 'fixed' },
    { key: 'catering', pct: 24, basis: 'per_adult' },
    { key: 'bar', pct: 5, basis: 'per_guest' },
    { key: 'photographer', pct: 6, basis: 'fixed' },
    { key: 'videographer', pct: 3, basis: 'fixed' },
    { key: 'dj', pct: 6, basis: 'fixed' },
    { key: 'band', pct: 4, basis: 'fixed' },
    { key: 'design', pct: 5, basis: 'fixed' },
    { key: 'flowers', pct: 4, basis: 'fixed' },
    { key: 'makeup_hair', pct: 3, basis: 'fixed' },
    { key: 'attire', pct: 6, basis: 'fixed' },
    { key: 'officiant', pct: 1, basis: 'fixed' },
    { key: 'cakes_sweets', pct: 2, basis: 'fixed' },
    { key: 'invitations_print', pct: 1, basis: 'fixed' },
    { key: 'transport', pct: 2, basis: 'fixed' },
    { key: 'other', pct: 6, basis: 'fixed' },
  ],
  requiredVendors: ['venue', 'catering', 'photographer', 'dj', 'officiant'],
};
