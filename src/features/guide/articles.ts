import type { GuideArticle, GuideFaq } from './types';

/**
 * The written guide (/app/guide, the help panel's "Guide" tab, and the assistant's knowledge): one
 * article per task, in the event's order — start, plan, invite, arrange, celebrate, account — and the
 * FAQ. Hebrew first; English mirrors it. Button names are the app's own labels (src/lib/i18n), so keep
 * them in step when a label changes. Prices are never written here: the billing page shows them.
 */
export const GUIDE_ARTICLES: GuideArticle[] = [
  // ─── start ──────────────────────────────────────────────────────────────────────────────────
  {
    slug: 'quick-start',
    section: 'start',
    title: { he: 'מתחילים אירוע חדש', en: 'Start a new event' },
    what: {
      he: 'אשף קצר של שלושה מסכים: איזה אירוע חוגגים, כמה פרטים, ומאיפה מתחילים. בסוף מגיעים לבית האירוע או לגלריית העיצובים.',
      en: 'A short three-screen wizard: what you’re celebrating, a few details, and where to start. At the end you land on the event home or in the design gallery.',
    },
    why: {
      he: 'התשובות מתאימות לכם עיצובים, משימות ותקציב לסוג האירוע, כך שלא מתחילים מדף ריק. אפשר לשנות הכול אחר כך.',
      en: 'Your answers fit the designs, tasks and budget to your kind of event, so you never start from a blank page. You can change everything later.',
    },
    steps: [
      {
        he: 'לוחצים "אירוע חדש" בסרגל הצד (בטלפון: "חדש" בסרגל התחתון).',
        en: 'Click “New event” in the sidebar (on a phone: “New” in the bottom bar).',
      },
      {
        he: 'ב"איזה אירוע חוגגים?" בוחרים את סוג האירוע — חתונה, בר מצווה, יום הולדת ועוד — ולוחצים "המשך".',
        en: 'In “What are you celebrating?” pick the kind of event — a wedding, a bar mitzvah, a birthday and more — and click “Next”.',
      },
      {
        he: 'ב"ספרו לנו קצת" ממלאים שמות, תאריך האירוע, כמה אורחים בערך ותקציב משוער (רשות), ולוחצים "המשך".',
        en: 'In “Tell us a little” fill in the names, the event date, roughly how many guests and an estimated budget (optional), then click “Next”.',
      },
      {
        he: 'ב"מאיפה מתחילים?" בוחרים "מתכננים", "מעצבים את ההזמנה" או "הכול" (המומלץ).',
        en: 'In “Where do you want to start?” choose “Planning”, “Designing the invitation” or “Everything” (recommended).',
      },
      {
        he: 'לוחצים "יוצאים לדרך". "מתכננים" פותח ישר את בית האירוע; שתי האפשרויות האחרות פותחות את גלריית העיצובים.',
        en: 'Click “Let’s go”. “Planning” opens the event home right away; the other two open the design gallery.',
      },
      {
        he: 'בבית האירוע עושים את מה שכתוב בכרטיס "הצעד הבא" — תמיד דבר אחד, הכי חשוב עכשיו.',
        en: 'On the event home, do what the “Next step” card says — always one thing, the most important one now.',
      },
    ],
    tips: [
      {
        he: 'רוצים לדלג? "דילוג לגלריית העיצובים" בראש האשף לוקח ישר לבחירת עיצוב.',
        en: 'Want to skip? “Skip to the design gallery” at the top of the wizard goes straight to the designs.',
      },
      {
        he: 'התקציב מתחלק לקטגוריות לבד, בשקלים שלמים, ומספר האורחים המשוער משמש את התקציב עד שיש רשימת מוזמנים.',
        en: 'The budget is split into categories for you, in whole shekels, and the estimated guests drive the budget until there’s a guest list.',
      },
      {
        he: 'בביקור הראשון בבית האירוע מופיע "סיור קצר" של חמש תחנות. אפשר לדלג עליו.',
        en: 'Your first visit to the event home shows “A quick tour” of five stops. You can skip it.',
      },
    ],
    next: ['event-home', 'create-invitation', 'tasks'],
    keywords: {
      he: 'אירוע חדש, הזמנה חדשה, התחלה, אשף, פתיחת אירוע, מתחילים, צעד ראשון, איך מתחילים',
      en: 'new event, new invitation, getting started, wizard, onboarding, create event, first steps, how to start',
    },
  },
  {
    slug: 'event-home',
    section: 'start',
    title: { he: 'בית האירוע', en: 'The event home' },
    what: {
      he: 'המסך הראשון של כל אירוע: ספירה לאחור, הצעד הבא, תקציב, אישורי הגעה ומשימות במבט אחד, ומפת הדרך של ארבעת השלבים.',
      en: 'The first screen of every event: a countdown, the next step, the budget, RSVPs and tasks at a glance, and the road through the four stages.',
    },
    why: {
      he: 'במקום לחפש מה לעשות, רואים דבר אחד שהכי חשוב עכשיו, ואת כל המספרים במקום אחד — אותם מספרים כמו בשאר המערכת.',
      en: 'Instead of hunting for what to do, you see the one thing that matters most now, and every number in one place — the same numbers as everywhere else.',
    },
    steps: [
      {
        he: 'פותחים אירוע מ"האירועים שלי", או לוחצים "בית האירוע" בניווט של האירוע.',
        en: 'Open an event from “My events”, or click “Event home” in the event’s navigation.',
      },
      {
        he: 'למעלה מופיעה הספירה לאחור. "העתקת הקישור" מעתיק את קישור ההזמנה, ו"שליחה ושיתוף" פותח את מסך השיתוף.',
        en: 'The countdown is at the top. “Copy the link” copies the invitation’s link, and “Send & share” opens the sharing screen.',
      },
      {
        he: 'בכרטיס "הצעד הבא" לוחצים על הכפתור, למשל "לפרסום", "להעלאת הרשימה" או "לשליחה". כשמסיימים, מגיע הצעד הבא.',
        en: 'In the “Next step” card, click its button — for example “Publish”, “Upload the list” or “Send”. When it’s done, the next one comes.',
      },
      {
        he: 'מציצים בשלושת הכרטיסים: מד התקציב ("לתקציב המלא"), טבעת אישורי ההגעה ("לכל התשובות") והתקדמות המשימות ("לכל המשימות").',
        en: 'Glance at the three cards: the budget gauge (“The full budget”), the RSVP ring (“All replies”) and the task progress (“All tasks”).',
      },
      {
        he: 'ב"מפת הדרך" רואים את ארבעת השלבים — מתכננים, מזמינים, מסדרים, חוגגים — ואיפה אתם עומדים בכל אחד.',
        en: 'In “The road” you see the four stages — Plan, Invite, Arrange, Celebrate — and where you stand in each.',
      },
      {
        he: 'ב"גם כדאי" מחכים עוד דברים שכדאי לעשות בקרוב, כל אחד עם כפתור שלוקח ישר לשם.',
        en: 'Under “Also worth doing” are more things to do soon, each with a button that takes you straight there.',
      },
    ],
    tips: [
      {
        he: 'טבעת אישורי ההגעה מראה מגיעים, לא מגיעים ועוד לא ענו. תשובות מהקישור הכללי כבר נספרות, ומסומנות "מהקישור הכללי".',
        en: 'The RSVP ring shows coming, not coming and not answered. Replies through the general link already count, marked “from the general link”.',
      },
      {
        he: 'בלי תקציב כולל, כרטיס התקציב מציע "לקביעת תקציב". בלי תוכנית, כרטיס המשימות מציע "לפתיחת התכנון".',
        en: 'With no total budget, the budget card offers “Set a budget”. With no plan, the tasks card offers “Start planning”.',
      },
      {
        he: 'בטלפון, "תובנות" ו"הגדרות האירוע" הם כפתורים בתחתית בית האירוע.',
        en: 'On a phone, “Insights” and “Event settings” are buttons at the foot of the event home.',
      },
    ],
    next: ['navigation', 'budget-gauge', 'rsvp-and-notifications'],
    keywords: {
      he: 'בית האירוע, דשבורד, לוח בקרה, סקירה, הצעד הבא, ספירה לאחור, מפת הדרך, גם כדאי, מסך ראשי',
      en: 'event home, dashboard, overview, next step, countdown, the road, also worth doing, home screen',
    },
    screens: ['home'],
  },
  {
    slug: 'navigation',
    section: 'start',
    title: { he: 'הניווט באירוע', en: 'Getting around an event' },
    what: {
      he: 'בתוך אירוע, הניווט מסודר לפי החיים של האירוע: בית האירוע, ארבעה שלבים — מתכננים, מזמינים, מסדרים, חוגגים — ולמטה תובנות והגדרות האירוע.',
      en: 'Inside an event, navigation follows the event’s life: the event home, four stages — Plan, Invite, Arrange, Celebrate — and, at the bottom, insights and the event settings.',
    },
    why: {
      he: 'כל מסך נמצא בשלב שבו צריכים אותו, וליד כל שלב רואים את המצב שלו: הושלם, כמה פתוחים, או בעוד כמה ימים.',
      en: 'Every screen sits in the stage where you need it, and each stage shows its status: done, how many are open, or in how many days.',
    },
    steps: [
      {
        he: 'במחשב, בסרגל הצד של האירוע לוחצים "בית האירוע", או על מסך מתוך אחד מארבעת השלבים.',
        en: 'On a computer, in the event’s sidebar, click “Event home” or a screen inside one of the four stages.',
      },
      {
        he: '"מתכננים": משימות, תקציב, ספקים, פתקים ורעיונות. "מזמינים": עיצוב ההזמנה, מוזמנים, שליחה ושיתוף, אישורי הגעה.',
        en: '“Plan”: Tasks, Budget, Vendors, Notes & ideas. “Invite”: Invitation design, Guests, Send & share, RSVPs.',
      },
      {
        he: '"מסדרים": סידור שולחנות. "חוגגים": יום האירוע, גלריה חיה ומסך באולם, סרט הרגעים.',
        en: '“Arrange”: Seating plan. “Celebrate”: Event day, Live gallery & hall screen, Moments film.',
      },
      {
        he: 'בתחתית הסרגל: "תובנות", "הגדרות האירוע" ו"מדריך ועזרה". "כל האירועים" למעלה מחזיר לרשימת האירועים.',
        en: 'At the bottom of the sidebar: “Insights”, “Event settings” and “Guide & help”. “All events” at the top takes you back to your events.',
      },
      {
        he: 'בטלפון, בסרגל התחתון לוחצים "בית האירוע" או אחד מארבעת השלבים — נפתח חלון עם המסכים של אותו שלב.',
        en: 'On a phone, tap “Event home” or one of the four stages in the bottom bar — a sheet opens with that stage’s screens.',
      },
      {
        he: 'בפס העליון של כל מסך: "פרסום" כשיש מה לפרסם, ו"פתיחת ההזמנה" כדי לראות אותה כמו האורחים.',
        en: 'In the strip at the top of every screen: “Publish” when there’s something to publish, and “Open the invitation” to see it as guests do.',
      },
    ],
    tips: [
      {
        he: 'מסך עם סימון של חבילה מתקדמת שייך לתוכנית גבוהה יותר. לחיצה עליו מראה מה הוא כולל ואיך לשדרג.',
        en: 'A screen marked as on a higher plan belongs to a bigger plan. Opening it shows what it includes and how to upgrade.',
      },
      {
        he: 'מחוץ לאירוע, הסרגל כולל "האירועים שלי", "אירוע חדש" ו"מדריך ועזרה". החשבון, החבילה והפניות לצוות נמצאים בתפריט החשבון למטה.',
        en: 'Outside an event, the sidebar has “My events”, “New event” and “Guide & help”. Your account, plan and support tickets are in the account menu at the bottom.',
      },
      {
        he: '"מדריך ועזרה" פותח חלונית עם שלוש לשוניות: "מדריך", "שאלו את העוזר" ו"פנייה לצוות".',
        en: '“Guide & help” opens a panel with three tabs: “Guide”, “Ask the assistant” and “Contact the team”.',
      },
    ],
    next: ['event-home', 'event-settings', 'quick-start'],
    keywords: {
      he: 'ניווט, תפריט, סרגל צד, שלבים, מתכננים, מזמינים, מסדרים, חוגגים, איפה נמצא, סרגל תחתון, טלפון, נייד',
      en: 'navigation, menu, sidebar, stages, plan, invite, arrange, celebrate, where is, bottom bar, phone, mobile',
    },
    screens: ['home'],
  },

  // ─── invite ─────────────────────────────────────────────────────────────────────────────────
  {
    slug: 'create-invitation',
    section: 'invite',
    title: { he: 'יוצרים הזמנה מעיצוב', en: 'Create an invitation from a design' },
    what: {
      he: 'בוחרים עיצוב מהגלריה, רואים אותו בתצוגה חיה, ממלאים שלושה שלבים קצרים — ומקבלים בעורך טיוטה עם טקסטים מוכנים.',
      en: 'Pick a design from the gallery, see it live, fill in three short steps — and get a draft with ready texts in the editor.',
    },
    why: {
      he: 'כל עיצוב מגיע עם פתיחה מונפשת, מוזיקה וטקסטים מוכנים, כך שתוך דקות יש הזמנה שאפשר לפרסם.',
      en: 'Every design comes with an animated opening, music and ready texts, so within minutes you have an invitation ready to publish.',
    },
    steps: [
      {
        he: 'מגיעים לגלריית העיצובים מהאשף "אירוע חדש" ("מעצבים את ההזמנה" או "הכול"), או מ"דילוג לגלריית העיצובים".',
        en: 'Reach the design gallery from the “New event” wizard (“Designing the invitation” or “Everything”), or via “Skip to the design gallery”.',
      },
      {
        he: 'מסננים לפי סוג האירוע או "מונפשים", ולוחצים על עיצוב לתצוגה חיה עם "צבעים" ו"גופנים".',
        en: 'Filter by kind of event or “Animated”, and click a design for a live preview with “Colors” and “Fonts”.',
      },
      {
        he: 'רוצים לראות במסך מלא? "דמו חי בלשונית חדשה". אהבתם? לוחצים "שימוש בעיצוב הזה".',
        en: 'Want it full screen? “Live demo in a new tab”. Like it? Click “Use this design”.',
      },
      {
        he: 'בחלון של שלושה שלבים: "איזה אירוע חוגגים?", "פרטי האירוע" (שמות, תאריך ושעה) ו"באיזו שפה?" — ואז "יצירת ההזמנה".',
        en: 'In the three-step window: “What are you celebrating?”, “Event details” (names, date and time) and “Which language?” — then “Create invitation”.',
      },
      {
        he: 'בעורך עוברים על הסקשנים ומשנים טקסטים, תמונות, צבעים ומוזיקה. כל שינוי נשמר לבד.',
        en: 'In the editor, go through the sections and change texts, photos, colors and music. Every change saves by itself.',
      },
      {
        he: 'מוכנים? לוחצים "פרסום" כדי שהקישור יתחיל לעבוד.',
        en: 'Ready? Click “Publish” so the link starts working.',
      },
    ],
    tips: [
      {
        he: 'עיצובים עם התג "פרימיום" אפשר לערוך בכל תוכנית, ולפרסם בתוכניות Pro ו-Business.',
        en: 'Designs tagged “Premium” can be edited on any plan, and published on Pro and Business.',
      },
      {
        he: 'את העורך פותחים שוב בכל רגע מ"עיצוב ההזמנה" בשלב "מזמינים".',
        en: 'Open the editor again any time from “Invitation design” in the “Invite” stage.',
      },
      {
        he: 'מה שמילאתם באשף "אירוע חדש" (תאריך ושמות) כבר ממולא בחלון היצירה.',
        en: 'What you typed in the “New event” wizard (the date and names) is already filled in the create window.',
      },
    ],
    next: ['publish-and-share', 'design-from-photos', 'import-guests'],
    keywords: {
      he: 'עיצוב, תבנית, גלריית עיצובים, בחירת עיצוב, עורך, יצירת הזמנה, פרימיום, מונפשים, דמו, טיוטה',
      en: 'design, template, design gallery, choose a design, editor, create invitation, premium, animated, demo, draft',
    },
    screens: ['design'],
  },
  {
    slug: 'design-from-photos',
    section: 'invite',
    title: { he: 'עצבו לי מהתמונות', en: 'Design it from my photos' },
    what: {
      he: 'בוחרים 3–5 תמונות שאתם אוהבים, ומקבלים שלושה עיצובים שלמים ושונים: תבנית, צבעים, גופנים, פתיחה ומקום לכל תמונה.',
      en: 'Pick 3–5 photos you love and get three complete, different designs: a template, colors, fonts, an opening and a place for each photo.',
    },
    why: {
      he: 'במקום לנסות עיצוב אחרי עיצוב, ההזמנה נבנית סביב התמונות שלכם — וכל עיצוב מגיע עם משפט שמסביר למה.',
      en: 'Instead of trying design after design, the invitation is built around your photos — and each design comes with a line explaining why.',
    },
    steps: [
      {
        he: 'בגלריית העיצובים לוחצים על הכרטיס "עצבו לי מהתמונות" ואז "בואו נתחיל". בהזמנה קיימת: בעורך, לשונית "עיצוב" ← "עצבו לי".',
        en: 'In the gallery, click “Design it from my photos”, then “Let’s start”. For an existing invitation: the editor’s “Design” tab → “Design it for me”.',
      },
      {
        he: 'בהזמנה חדשה ממלאים קודם סוג אירוע, שמות ותאריך, ושפות.',
        en: 'For a new invitation, first fill in the kind of event, the names and date, and the languages.',
      },
      {
        he: 'בוחרים 3–5 תמונות: "מהתמונות של ההזמנה" או "העלאת תמונות". התמונה הראשונה היא תמונת הפתיחה.',
        en: 'Choose 3–5 photos: from the invitation’s photos or “Upload photos”. The first photo is the opening photo.',
      },
      {
        he: 'כותבים "מצב רוח" בכמה מילים (רשות), ולוחצים "הציגו לי 3 עיצובים".',
        en: 'Write a “Mood” in a few words (optional), and click “Show me 3 designs”.',
      },
      {
        he: 'גוללים בכל עיצוב בתצוגה החיה. לא מתאים? "עוד שלושה עיצובים" מאותן תמונות.',
        en: 'Scroll through each design in the live preview. Not quite right? “Three more designs” from the same photos.',
      },
      {
        he: 'לוחצים "בוחרים בעיצוב הזה". בהזמנה חדשה ממשיכים ב"להמשך בעורך".',
        en: 'Click “Use this design”. For a new invitation, go on with “Continue in the editor”.',
      },
    ],
    tips: [
      {
        he: 'כלול בתוכנית Business (חבילת VIP). בלי התוכנית מופיעה הצעה לשדרג.',
        en: 'Included in the Business plan (the VIP package). Without it, you’ll see an offer to upgrade.',
      },
      {
        he: 'בהזמנה קיימת הטקסטים והפרטים נשארים, והעיצוב הקודם נשמר ב"גרסאות" — אפשר לבטל.',
        en: 'In an existing invitation your texts and details stay, and the previous design is kept in “Versions” — you can undo.',
      },
      {
        he: 'התמונות מוקטנות במכשיר לפני שהן נשלחות. כשהבינה המלאכותית לא זמינה, העיצובים מורכבים אוטומטית מהצבעים של התמונות.',
        en: 'Photos are shrunk on your device before they’re sent. When the AI isn’t available, the designs are composed automatically from the photos’ colors.',
      },
    ],
    next: ['create-invitation', 'publish-and-share', 'plans-billing'],
    keywords: {
      he: 'עצבו לי, עיצוב מתמונות, בינה מלאכותית, AI, סטודיו, תמונות, שלושה עיצובים, מצב רוח, עיצוב אוטומטי',
      en: 'design it for me, design from photos, AI, studio, art direction, photos, three designs, mood, automatic design',
    },
    screens: ['design'],
  },
  {
    slug: 'publish-and-share',
    section: 'invite',
    title: { he: 'מפרסמים ומשתפים', en: 'Publish and share' },
    what: {
      he: 'פרסום מעלה את ההזמנה לאוויר בקישור קבוע. במסך "שליחה ושיתוף" יש את הקישור, הודעה מוכנה לוואטסאפ, תצוגה של הקישור וקוד QR.',
      en: 'Publishing puts the invitation live on a fixed link. The “Send & share” screen has the link, a ready WhatsApp message, the link preview and a QR code.',
    },
    why: {
      he: 'עד הפרסום אף אורח לא רואה כלום. אחרי הפרסום כל עדכון מתפרסם באותו קישור, בלי לשלוח מחדש.',
      en: 'Until you publish, no guest sees anything. After that, every update goes out on the same link — no need to send again.',
    },
    steps: [
      {
        he: 'לוחצים "פרסום" בפס העליון של האירוע או בעורך. המערכת בודקת שלא חסר כלום: אדום חייבים לתקן, צהוב כדאי לבדוק.',
        en: 'Click “Publish” in the event’s top strip or in the editor. It checks nothing is missing: red must be fixed, yellow is worth a look.',
      },
      {
        he: 'בוחרים כתובת להזמנה (אותיות באנגלית, מספרים ומקפים) ולוחצים "פרסום".',
        en: 'Choose the invitation’s address (English letters, numbers and hyphens) and click “Publish”.',
      },
      {
        he: 'פותחים "שליחה ושיתוף" בשלב "מזמינים", ולוחצים "העתקה" ליד הקישור.',
        en: 'Open “Send & share” in the “Invite” stage, and click “Copy” next to the link.',
      },
      {
        he: 'בוחרים את שפת ההודעה, עורכים אותה אם רוצים, ולוחצים "שליחה בוואטסאפ" או "העתקת ההודעה".',
        en: 'Choose the message language, edit it if you like, and click “Send on WhatsApp” or “Copy the message”.',
      },
      {
        he: 'מורידים את קוד ה-QR כ-PNG או SVG, להדפסה על הזמנה מודפסת או שלט.',
        en: 'Download the QR code as PNG or SVG, to print on a paper invitation or a sign.',
      },
      {
        he: 'שיניתם משהו בעורך? לוחצים שוב "פרסום" — האורחים יראו את השינוי באותו קישור.',
        en: 'Changed something in the editor? Click “Publish” again — guests see the change on the same link.',
      },
    ],
    tips: [
      {
        he: 'את הכותרת, התיאור והתמונה בתצוגת הקישור בוואטסאפ משנים בעורך: "הגדרות" ← "קישור ושיתוף".',
        en: 'Change the title, description and picture of the WhatsApp link preview in the editor: “Settings” → “Link & sharing”.',
      },
      {
        he: 'וואטסאפ שומר את תצוגת הקישור אצלו, כך שתמונה חדשה עשויה להופיע רק בשיתוף חדש.',
        en: 'WhatsApp caches the link preview, so a new picture may only show in a new share.',
      },
      {
        he: 'עדיף לא לשנות את הכתובת אחרי ששלחתם אותה: הקישור הקודם יפסיק לעבוד.',
        en: 'Better not to change the address after you’ve sent it: the old link stops working.',
      },
    ],
    next: ['import-guests', 'personal-links', 'whatsapp-sending'],
    keywords: {
      he: 'פרסום, קישור, שיתוף, QR, קוד QR, תצוגה מקדימה של קישור, כתובת, שליחה, לפרסם שוב, באוויר',
      en: 'publish, link, share, QR, QR code, link preview, address, slug, send, republish, go live',
    },
    screens: ['share', 'design'],
  },
  {
    slug: 'import-guests',
    section: 'invite',
    title: { he: 'מעלים את רשימת המוזמנים', en: 'Upload your guest list' },
    what: {
      he: 'מעלים קובץ Excel או CSV עם שמות וטלפונים. המערכת מזהה את העמודות לבד ומראה תצוגה מקדימה לפני השמירה.',
      en: 'Upload an Excel or CSV file with names and phone numbers. The columns are recognized by themselves, with a preview before saving.',
    },
    why: {
      he: 'כל מוזמן ברשימה מקבל קישור אישי עם השם שלו, ואפשר לשלוח לכולם ולעקוב מי פתח ומי אישר.',
      en: 'Every guest on the list gets a personal link with their name, and you can send to everyone and see who opened and who said yes.',
    },
    steps: [
      {
        he: 'פותחים "מוזמנים" בשלב "מזמינים" ולוחצים "העלאת רשימה מאקסל".',
        en: 'Open “Guests” in the “Invite” stage and click “Upload a list from Excel”.',
      },
      {
        he: 'גוררים קובץ xlsx או CSV לחלון, או לוחצים לבחירה. אין קובץ? "קובץ לדוגמה" מוריד תבנית עם העמודות.',
        en: 'Drop an xlsx or CSV file into the window, or click to choose one. No file yet? “Sample file” downloads one with the columns.',
      },
      {
        he: 'בודקים את "העמודות שזוהו" ואת השורות הבעייתיות: בלי שם, טלפון לא תקין או טלפון כפול.',
        en: 'Check the “Columns found” and the problem rows: no name, an invalid phone, or a phone that appears twice.',
      },
      {
        he: 'לוחצים "ייבוא N מוזמנים". מוזמן שכבר ברשימה מתעדכן ולא נכפל.',
        en: 'Click “Import N guests”. A guest already on the list is updated, not duplicated.',
      },
      {
        he: 'רוצים להוסיף מישהו אחד? "הוספה ידנית": שם וטלפון, ולא חובה — מייל, כמות, קבוצה ושפה.',
        en: 'Adding just one person? “Add by hand”: a name and phone, and optionally an email, party size, group and language.',
      },
    ],
    tips: [
      {
        he: 'העמודות שהמערכת מזהה: שם (או שם פרטי ושם משפחה), טלפון, מייל, כמות מוזמנים, קבוצה ושפה. אפשר גם בלי שורת כותרות.',
        en: 'Recognized columns: name (or first and last name), phone, email, party size, group and language. A title row is optional.',
      },
      {
        he: 'קובץ xls ישן: פותחים באקסל, "שמירה בשם" כ-xlsx, ומעלים שוב. עד 5,000 שורות בקובץ.',
        en: 'An old xls file: open it in Excel, “Save as” xlsx, and upload again. Up to 5,000 rows per file.',
      },
      {
        he: 'מספר קווי נכנס לרשימה, אבל אי אפשר לשלוח אליו בוואטסאפ. כמה מוזמנים אפשר בכל הזמנה תלוי בתוכנית.',
        en: 'A landline joins the list but can’t get WhatsApp. How many guests an invitation can have depends on your plan.',
      },
    ],
    next: ['personal-links', 'whatsapp-sending', 'rsvp-and-notifications'],
    keywords: {
      he: 'אקסל, Excel, CSV, ייבוא, רשימת מוזמנים, העלאת רשימה, קובץ, הוספת מוזמנים, מוזמנים, טלפונים, גיליון',
      en: 'Excel, CSV, import, guest list, upload list, file, add guests, guests, phone numbers, spreadsheet',
    },
    screens: ['guests'],
  },
  {
    slug: 'personal-links',
    section: 'invite',
    title: { he: 'קישור אישי לכל מוזמן', en: 'A personal link for each guest' },
    what: {
      he: 'כל מוזמן ברשימה מקבל קישור משלו: ההזמנה נפתחת עם השם שלו, בשפה שלו, וטופס אישור ההגעה כבר ממולא בשם ובטלפון.',
      en: 'Each guest on the list gets their own link: the invitation opens with their name, in their language, and the RSVP form is already filled with their name and phone.',
    },
    why: {
      he: 'התשובה מתחברת לבד למוזמן הנכון, ורואים ברשימה מי פתח ומי אישר — בלי לנחש מי זה.',
      en: 'The reply links itself to the right guest, and the list shows who opened and who said yes — no guessing who it was.',
    },
    steps: [
      {
        he: 'מעלים את רשימת המוזמנים ומפרסמים את ההזמנה. הקישורים האישיים עובדים רק אחרי הפרסום.',
        en: 'Upload the guest list and publish the invitation. Personal links only work after publishing.',
      },
      {
        he: 'ברשימה, ליד מוזמן (או בתפריט ⋯ שלו), לוחצים "העתקת הקישור האישי" ושולחים אותו בכל דרך.',
        en: 'In the list, next to a guest (or in their ⋯ menu), click “Copy the personal link” and send it any way you like.',
      },
      {
        he: 'רוצים ברכה עם השם? בכרטיס "ברכה אישית עם שם המוזמן" לוחצים "עריכת הברכה" וכותבים אותה בסקשן הפתיחה.',
        en: 'Want a greeting with their name? In the personal greeting card, click “Edit the greeting” and write it in the opening section.',
      },
      {
        he: 'בהזמנה בכמה שפות, בוחרים לכל מוזמן שפה בעמודת "שפה". הקישור שלו נפתח בה.',
        en: 'In a multi-language invitation, choose each guest’s language in the “Language” column. Their link opens in it.',
      },
      {
        he: 'עוקבים בעמודת "סטטוס": נשלח, נמסר, נקרא, פתח/ה את ההזמנה, מגיע/ה או לא מגיע/ה.',
        en: 'Follow the “Status” column: sent, delivered, read, opened the invitation, coming or not coming.',
      },
    ],
    tips: [
      {
        he: 'בברכה, {guest} מוחלף בשם המוזמן. מי שנכנס מהקישור הכללי רואה את ההזמנה בלי שם.',
        en: 'In the greeting, {guest} is replaced with the guest’s name. Someone using the general link sees the invitation without a name.',
      },
      {
        he: 'כמה מוזמנים באותו מכשיר? כל אחד מקבל את התשובה שלו, לפי הקישור שממנו נכנס.',
        en: 'Several guests on one device? Each keeps their own reply, by the link they came in from.',
      },
      {
        he: 'מחיקת מוזמן מפסיקה את הקישור האישי שלו. תשובה שכבר שלח נשארת.',
        en: 'Deleting a guest stops their personal link. A reply they already sent stays.',
      },
    ],
    next: ['whatsapp-sending', 'rsvp-and-notifications', 'import-guests'],
    keywords: {
      he: 'קישור אישי, ברכה אישית, שם המוזמן, טופס ממולא, קישור לכל אורח, מעקב, מי פתח, סטטוס',
      en: 'personal link, personal greeting, guest name, prefilled form, link per guest, tracking, who opened, status',
    },
    screens: ['guests'],
  },
  {
    slug: 'whatsapp-sending',
    section: 'invite',
    title: { he: 'שולחים בוואטסאפ', en: 'Send on WhatsApp' },
    what: {
      he: 'שולחים לכל מוזמן את הקישור האישי שלו בוואטסאפ: מהמספר הרשמי של Badook עם קרדיטים, או מהוואטסאפ שלכם — אחד אחרי השני.',
      en: 'Send each guest their personal link on WhatsApp: from Badook’s official number using credits, or from your own WhatsApp — one after another.',
    },
    why: {
      he: 'כל אחד מקבל הזמנה עם השם שלו, והסטטוס ברשימה מתעדכן לבד: נשלח, נמסר, נקרא, פתח ואישר.',
      en: 'Everyone gets an invitation with their name, and the list updates by itself: sent, delivered, read, opened and replied.',
    },
    steps: [
      {
        he: 'מפרסמים את ההזמנה, מעלים רשימה עם טלפונים ניידים, ופותחים "מוזמנים".',
        en: 'Publish the invitation, upload a list with mobile numbers, and open “Guests”.',
      },
      {
        he: 'כשהשליחה הרשמית מחוברת: לוחצים "שליחה בוואטסאפ לכל המוזמנים" ובוחרים למי — מי שעוד לא קיבל, המסומנים או כולם.',
        en: 'When official sending is connected: click “Send on WhatsApp to all guests” and choose who — those not yet sent, the selected, or everyone.',
      },
      {
        he: 'בודקים את ההודעה ואת העלות, מסמנים שהמוזמנים מכירים אתכם, ולוחצים "שליחה ל-N מוזמנים".',
        en: 'Check the message and the cost, tick that your guests know you, and click “Send to N guests”.',
      },
      {
        he: 'כשהשליחה הרשמית עוד לא מחוברת: לוחצים "שליחה מהוואטסאפ שלי". נפתח תור של כל מי שעוד לא קיבל.',
        en: 'When official sending isn’t connected yet: click “Send from my WhatsApp”. A queue opens with everyone who hasn’t got it.',
      },
      {
        he: 'בתור לוחצים "פתיחה בוואטסאפ", שולחים את ההודעה המוכנה, חוזרים ולוחצים "הבא". "דילוג" עובר למוזמן הבא.',
        en: 'In the queue, click “Open in WhatsApp”, send the ready message, come back and click “Next”. “Skip” moves to the next guest.',
      },
      {
        he: 'שלחתם בדרך אחרת? בתפריט ⋯ של המוזמן בוחרים "סימון כנשלח" כדי שהסטטוס יתעדכן.',
        en: 'Sent it another way? In the guest’s ⋯ menu choose “Mark as sent” so the status updates.',
      },
    ],
    tips: [
      {
        he: 'כל הודעה מהמספר הרשמי היא קרדיט אחד, והודעה שלא נמסרה מחזירה את הקרדיט. חסרים קרדיטים? "קניית קרדיטים".',
        en: 'Each message from the official number is one credit, and an undelivered message gives it back. Short of credits? “Buy credits”.',
      },
      {
        he: 'מי שכבר קיבל, מספר קווי ומי שביקש לא לקבל הודעות לא נשלחים ולא עולים כסף.',
        en: 'Guests who already got it, landlines and anyone who asked not to get messages are skipped and cost nothing.',
      },
      {
        he: 'כשהמספר הרשמי עוד לא מחובר, ליד הכפתור כתוב "שליחה אוטומטית — בקרוב". עד אז שולחים מהוואטסאפ שלכם.',
        en: 'While the official number isn’t connected, the button says “Automatic sending — coming soon”. Until then, send from your own WhatsApp.',
      },
    ],
    next: ['rsvp-and-notifications', 'personal-links', 'plans-billing'],
    keywords: {
      he: 'וואטסאפ, WhatsApp, שליחה, קרדיטים, הודעה, שליחה מהוואטסאפ שלי, תור, שליחה אוטומטית, המספר הרשמי, תזכורת',
      en: 'WhatsApp, send, credits, message, send from my WhatsApp, queue, automatic sending, official number, reminder',
    },
    screens: ['guests'],
  },
  {
    slug: 'rsvp-and-notifications',
    section: 'invite',
    title: { he: 'אישורי הגעה ותשובות', en: 'RSVPs and replies' },
    what: {
      he: 'האורחים עונים בטופס שבתוך ההזמנה. ב"אישורי הגעה" רואים מי מגיע ועם כמה, וב"מוזמנים" משייכים תשובות שהגיעו מהקישור הכללי.',
      en: 'Guests reply in the form inside the invitation. “RSVPs” shows who’s coming and with how many, and “Guests” is where you match replies from the general link.',
    },
    why: {
      he: 'מספר אחד בכל מקום — מי מגיע, מי לא ומי עוד לא ענה — כדי לסגור כמויות עם המקום ולתזכר בזמן.',
      en: 'One number everywhere — who’s coming, who isn’t and who hasn’t answered — so you can confirm numbers with the venue and remind people in time.',
    },
    steps: [
      {
        he: 'בעורך, בסקשן "אישור הגעה", קובעים מה הטופס שואל. את התאריך האחרון לאישור קובעים בלשונית "הגדרות".',
        en: 'In the editor’s “RSVP” section, set what the form asks. Set the RSVP deadline in the “Settings” tab.',
      },
      {
        he: 'פותחים "אישורי הגעה": מגיעים (מבוגרים וילדים), תשובות, לא מגיעים וזמן עד הדדליין. לחיצה על תשובה פותחת את הפרטים.',
        en: 'Open “RSVPs”: coming (adults and children), replies, not coming, and time to the deadline. Click a reply for its details.',
      },
      {
        he: 'ב"התראות במייל" בוחרים "על כל תשובה", "סיכום יומי" או "כבויות". "ייצוא ל-Excel" מוריד את כל התשובות.',
        en: 'Under “Email notifications” choose “For every reply”, “Daily summary” or “Off”. “Export to Excel” downloads every reply.',
      },
      {
        he: 'ב"מוזמנים", כשמופיע כרטיס על תשובות מהקישור הכללי, לוחצים "שיוך למוזמנים".',
        en: 'In “Guests”, when a card about replies from the general link appears, click “Match to guests”.',
      },
      {
        he: 'לכל תשובה בוחרים מוזמן מ"התאמות אפשריות" (לפי טלפון או שם) או מהרשימה, ולוחצים "שיוך".',
        en: 'For each reply, pick a guest from “Possible matches” (by phone or name) or from the list, and click “Match”.',
      },
      {
        he: 'כדי לתזכר, מסננים "בלי תשובה" ברשימת המוזמנים ושולחים מהתפריט ⋯ "שליחה מהוואטסאפ שלי".',
        en: 'To remind people, filter the guest list by “No reply” and send from the ⋯ menu with “Send from my WhatsApp”.',
      },
    ],
    tips: [
      {
        he: 'תשובה מהקישור הכללי כבר נספרת במגיעים, למשל "מגיעים: 40 (3 מהקישור הכללי)". עם טלפון שנמצא ברשימה היא משויכת לבד.',
        en: 'A reply through the general link already counts as coming, for example “Coming: 40 (3 from the general link)”. With a phone that’s on the list, it’s matched by itself.',
      },
      {
        he: '"עוד לא ענו" הם מוזמנים ברשימה שאין להם תשובה משלהם — לכן שיוך של תשובות מהקישור הכללי מדייק את המספר.',
        en: '“Not answered” means guests on the list with no reply of their own — so matching general-link replies makes that number exact.',
      },
      {
        he: 'אורח שכבר ענה יכול לערוך את התשובה מאותו מכשיר. היא מתעדכנת ולא נכפלת.',
        en: 'A guest who already replied can edit the reply from the same device. It updates, not duplicates.',
      },
    ],
    next: ['personal-links', 'whatsapp-sending', 'seating'],
    keywords: {
      he: 'אישורי הגעה, RSVP, תשובות, מגיעים, לא מגיעים, עוד לא ענו, שיוך, קישור כללי, התראות, מייל, ייצוא, דדליין, תזכורת',
      en: 'RSVP, replies, coming, not coming, not answered, match, general link, notifications, email, export, deadline, reminder',
    },
    screens: ['responses', 'guests'],
  },

  // ─── plan ───────────────────────────────────────────────────────────────────────────────────
  {
    slug: 'tasks',
    section: 'plan',
    title: { he: 'משימות לפי לוח זמנים', en: 'Tasks on a timeline' },
    what: {
      he: 'רשימת המשימות של האירוע, מוכנה לפי סוג האירוע, עם תאריכי יעד שמחושבים מתאריך האירוע.',
      en: 'The event’s task list, ready-made for your kind of event, with due dates counted from the event date.',
    },
    why: {
      he: 'רואים בכל רגע מה דחוף השבוע ומה יכול לחכות, ומשימות של ההזמנה מסומנות לבד כשהן מתבצעות.',
      en: 'You always see what’s urgent this week and what can wait, and the invitation’s own tasks tick themselves when they’re done.',
    },
    steps: [
      {
        he: 'פותחים "משימות" בשלב "מתכננים". בפעם הראשונה עוברים שלושה צעדים קצרים — האירוע, אורחים ותקציב, שילוב — ולוחצים "להתחיל לתכנן".',
        en: 'Open “Tasks” in the “Plan” stage. The first time, go through three short steps — event, guests and budget, linking — then “Start planning”.',
      },
      {
        he: 'בוחרים תצוגה: "ציר זמן" (באיחור, השבוע, החודש, בהמשך), "לפי קטגוריה" או "רשימה".',
        en: 'Choose a view: “Timeline” (overdue, this week, this month, later), “By category” or “List”.',
      },
      {
        he: 'כותבים משימה חדשה בשורה ולוחצים Enter. לחיצה על משימה פותחת פרטים: תאריך, אחראי, הערות וקישור לספק.',
        en: 'Type a new task and press Enter. Click a task for its details: date, who’s on it, notes and a vendor link.',
      },
      {
        he: 'מסמנים משימה כבוצעה. אם יש לה עלות, נשאל "כמה זה עלה?" ואפשר "להוספה לתקציב".',
        en: 'Mark a task as done. If it has a cost, you’re asked “How much did it cost?” and can add it to the budget.',
      },
      {
        he: 'משימות "אוטומטית" — עיצוב, פרסום, רשימה, שליחה ואישורים — מסומנות לבד. "לביצוע" לוקח למקום הנכון.',
        en: 'Automatic tasks — design, publish, the list, sending and RSVPs — tick themselves. “Do it” takes you to the right place.',
      },
      {
        he: 'לוחצים "ליומן" כדי להוריד קובץ יומן, או "הוספה ל-Google Calendar" במשימה אחת.',
        en: 'Click “Calendar” to download a calendar file, or “Add to Google Calendar” on a single task.',
      },
    ],
    tips: [
      {
        he: 'סינונים: "לטיפול עכשיו", "שלי", "עם עלות" ו"הוסתרו". משימה לא רלוונטית מסתירים, והיא נשארת ב"הוסתרו".',
        en: 'Filters: “Needs attention”, “Mine”, “With a cost” and “Hidden”. Hide a task that doesn’t apply; it stays under “Hidden”.',
      },
      {
        he: 'שיניתם את תאריך האירוע? יופיע "לעדכון התאריכים". תאריך שקבעתם בעצמכם לא יזוז.',
        en: 'Changed the event date? You’ll be offered to update the due dates. A date you set yourself won’t move.',
      },
      {
        he: 'כשנשאר מעט זמן, המשימות נדחסות לשבועות הקרובים, ומשימות שכבר לא רלוונטיות מוצעות להסתרה.',
        en: 'When time is short, tasks are squeezed into the coming weeks, and ones that no longer apply are offered for hiding.',
      },
    ],
    next: ['budget-gauge', 'vendors', 'event-home'],
    keywords: {
      he: 'משימות, צ׳קליסט, רשימת משימות, לוח זמנים, ציר זמן, תזכורות, השבוע, יומן, Google Calendar, תכנון',
      en: 'tasks, checklist, to-do, timeline, schedule, reminders, this week, calendar, Google Calendar, planning',
    },
    screens: ['tasks'],
  },
  {
    slug: 'budget-gauge',
    section: 'plan',
    title: { he: 'התקציב ומד התקציב', en: 'The budget and its gauge' },
    what: {
      he: 'מסך התקציב מראה מד כמו של מכונית: כמה מהתקציב כבר התחייבתם, מול מה שתכננתם ומה ששילמתם — ולידו הקטגוריות והתשלומים הקרובים.',
      en: 'The budget screen shows a speedometer: how much of the budget you’ve committed, against what you planned and what you paid — with the categories and upcoming payments beside it.',
    },
    why: {
      he: 'מבט אחד אומר אם אתם בטוחים, מתקרבים לגבול או חורגים — לפני שמתחייבים לעוד ספק.',
      en: 'One look tells you whether you’re safe, getting close or over — before you commit to another vendor.',
    },
    steps: [
      {
        he: 'פותחים "תקציב" בשלב "מתכננים". בפעם הראשונה ממלאים "התקציב הכולל" ו"כמה אורחים צפויים?" ולוחצים "לשמור ולהתחיל".',
        en: 'Open “Budget” in the “Plan” stage. The first time, fill in “Total budget” and “How many guests do you expect?” and click “Save and start”.',
      },
      {
        he: 'קוראים את המד: ירוק עד 85%, צהוב בין 85% ל-100%, ואדום מעל 100%. הסקאלה מגיעה עד 130%.',
        en: 'Read the gauge: green up to 85%, amber from 85% to 100%, red over 100%. The scale runs to 130%.',
      },
      {
        he: 'המחוג הראשי הוא מה שהתחייבתם (סגור ושולם) מתוך התקציב. המחוג המקווקו הוא המתוכנן, והסימון הדק הוא מה ששולם.',
        en: 'The main needle is what you’ve committed (booked and paid) out of the budget. The dashed needle is the plan; the thin mark, what’s paid.',
      },
      {
        he: 'ב"לפי קטגוריה" כל קטגוריה היא מד קטן, והחורגות ביותר ראשונות. לחיצה פותחת את הקטגוריה והסעיפים שלה.',
        en: 'In “By category” each category is a small gauge, the furthest over first. Click one to open it and its items.',
      },
      {
        he: 'ב"התשלומים הבאים" רואים את 30 הימים הקרובים, ולוחצים "סימון כשולם" על תשלום ששילמתם.',
        en: 'In “Next payments” you see the next 30 days; click “Mark as paid” on a payment you’ve made.',
      },
      {
        he: 'ב"מה אם?" מזיזים את מספר האורחים ואת מחיר המנה ורואים את המד זז — שום דבר לא נשמר. "איפוס" מחזיר.',
        en: 'In “What if?” move the number of guests and the plate price and watch the gauge move — nothing is saved. “Reset” puts it back.',
      },
    ],
    tips: [
      {
        he: 'ב"אורחים ושיטת חישוב" רואים זה לצד זה: אורחים צפויים, לפי רשימת המוזמנים, ואנשים שאישרו הגעה. "סנכרון לרשימה" מעדכן את הצפוי.',
        en: '“Guests and how costs are counted” shows side by side: expected guests, by the guest list, and people who said yes. “Sync to the list” updates the expected number.',
      },
      {
        he: 'התקציב מתחלק לקטגוריות בשקלים שלמים, ומה שנשאר מהעיגול נכנס ל"אחר" — כך שהסכום תמיד שווה לתקציב.',
        en: 'The budget is split into categories in whole shekels, and whatever rounding leaves goes to “Other” — so the plan always equals the budget.',
      },
      {
        he: '"ייצוא ל-Excel" מוריד את כל התקציב לקובץ אחד: סיכום, קטגוריות, סעיפים ותשלומים. כלול בתוכנית Pro.',
        en: '“Export to Excel” downloads the whole budget in one file: summary, categories, items and payments. Included in Pro.',
      },
    ],
    next: ['vendors', 'tasks', 'event-home'],
    keywords: {
      he: 'תקציב, מד תקציב, ספידומטר, הוצאות, תשלומים, חריגה, מה אם, מחיר מנה, קטגוריות, אקסל, מע״מ, עלות לאורח',
      en: 'budget, budget gauge, speedometer, expenses, payments, overrun, over budget, what if, plate price, categories, Excel, VAT, cost per guest',
    },
    screens: ['budget'],
  },
  {
    slug: 'vendors',
    section: 'plan',
    title: { he: 'ספקים והצעות מחיר', en: 'Vendors and quotes' },
    what: {
      he: 'לוח של כל הספקים לפי מצב — רעיון, יצרנו קשר, הצעת מחיר, סגרנו — עם השוואת הצעות ורשימה של מה עוד חסר.',
      en: 'A board of every vendor by stage — idea, contacted, quote received, booked — with quote comparison and a list of what’s still missing.',
    },
    why: {
      he: 'רואים מי סגור ומי בדרך, משווים הצעות באותה קטגוריה, וסגירת ספק מעדכנת את התקציב בלחיצה.',
      en: 'You see who’s booked and who’s on the way, compare quotes in a category, and booking a vendor updates the budget in one click.',
    },
    steps: [
      {
        he: 'פותחים "ספקים" בשלב "מתכננים" ולוחצים "הוספת ספק". שם וקטגוריה מספיקים.',
        en: 'Open “Vendors” in the “Plan” stage and click “Add vendor”. A name and a category are enough.',
      },
      {
        he: 'גוררים כרטיס לעמודה הבאה כשמשהו מתקדם, או בוחרים "העברה למצב" בתפריט הספק.',
        en: 'Drag a card to the next column as things move on, or choose “Move to” in the vendor’s menu.',
      },
      {
        he: 'בפרטי הספק רושמים מחיר מוצע, תנאי תשלום ומה כלול. משם גם מתקשרים או כותבים בוואטסאפ.',
        en: 'In the vendor’s details, note the quoted price, payment terms and what’s included. You can call or WhatsApp from there too.',
      },
      {
        he: 'כדי להשוות, מסמנים "השוואה" על שני ספקים או יותר מאותה קטגוריה ולוחצים "השוואת הצעות".',
        en: 'To compare, tick “Compare” on two or more vendors in the same category and click “Compare quotes”.',
      },
      {
        he: 'בחרתם? "סגירת ספק", ובוחרים מה לעדכן: סעיף בתקציב, לוח תשלומים לפי התנאים ומשימות המשך. אפשר לבטל.',
        en: 'Decided? “Close vendor”, and choose what to update: a budget item, a payment schedule from the terms, and follow-up tasks. You can undo.',
      },
    ],
    tips: [
      {
        he: '"מה חסר" מראה את הקטגוריות שחשוב לסגור לסוג האירוע שלכם.',
        en: '“What’s missing” shows the categories worth booking for your kind of event.',
      },
      {
        he: 'עוד לא סגרתם מקום? הכרטיס "מחפשים מקום לאירוע?" פותח את Badook Events בלשונית חדשה.',
        en: 'No venue booked yet? The “Looking for a venue?” card opens Badook Events in a new tab.',
      },
      {
        he: 'צירוף הצעות מחיר וחוזים לספק כלול בתוכנית Pro.',
        en: 'Attaching quotes and contracts to a vendor is included in Pro.',
      },
    ],
    next: ['budget-gauge', 'tasks', 'ideas'],
    keywords: {
      he: 'ספקים, הצעת מחיר, השוואה, צלם, אולם, דיג׳יי, קייטרינג, סגירת ספק, מקום לאירוע, Badook Events, חוזה',
      en: 'vendors, suppliers, quote, compare, photographer, venue, DJ, catering, close vendor, booked, Badook Events, contract',
    },
    screens: ['vendors'],
  },
  {
    slug: 'ideas',
    section: 'plan',
    title: { he: 'פתקים ורעיונות', en: 'Notes and ideas' },
    what: {
      he: 'לוח כרטיסים לכל מה שרוצים לזכור: פתק, קישור עם תצוגה מקדימה, תמונה או רשימה — עם תגיות, צבעים וחיפוש.',
      en: 'A board of cards for everything you want to remember: a note, a link with a preview, a picture or a list — with tags, colors and search.',
    },
    why: {
      he: 'רעיון טוב לא הולך לאיבוד, ובלחיצה הוא הופך למשימה, לספק או לסעיף בתקציב.',
      en: 'A good idea doesn’t get lost, and in one click it becomes a task, a vendor or a budget line.',
    },
    steps: [
      {
        he: 'פותחים "פתקים ורעיונות" בשלב "מתכננים".',
        en: 'Open “Notes & ideas” in the “Plan” stage.',
      },
      {
        he: 'כותבים פתק או מדביקים קישור בשורה שלמעלה, ולוחצים Enter. ב"עוד אפשרויות" בוחרים תמונה או רשימה.',
        en: 'Write a note or paste a link at the top and press Enter. “More options” adds a picture or a list.',
      },
      {
        he: 'מוסיפים תגיות וצבע, ומצמידים כרטיס חשוב ב"הצמדה לראש הלוח".',
        en: 'Add tags and a color, and pin an important card with “Pin to the top”.',
      },
      {
        he: 'מוצאים רעיון בחיפוש, או בסינון לפי תגית.',
        en: 'Find an idea with search, or filter by tag.',
      },
      {
        he: 'לוחצים "הפוך ל…" ובוחרים משימה, ספק או סעיף תקציב. הרעיון נשאר מקושר אליהם.',
        en: 'Click “Turn into…” and choose a task, a vendor or a budget line. The idea stays linked to it.',
      },
    ],
    tips: [
      {
        he: 'בתוכנית Pro: "סיכום והצעת צעדים" — העוזר מסכם את הרעיון ומציע צעדים, ושום דבר לא נשמר עד שתבחרו.',
        en: 'On Pro: “Summarize and suggest steps” — the assistant sums the idea up and suggests steps, and nothing is saved until you choose.',
      },
    ],
    next: ['tasks', 'vendors', 'budget-gauge'],
    keywords: {
      he: 'רעיונות, פתקים, השראה, לוח, קישורים, תמונות, רשימה, תגיות, לוח השראה',
      en: 'ideas, notes, inspiration, board, links, pictures, list, tags, moodboard',
    },
    screens: ['ideas'],
  },

  // ─── arrange ────────────────────────────────────────────────────────────────────────────────
  {
    slug: 'seating',
    section: 'arrange',
    title: { he: 'סידור שולחנות', en: 'Seating plan' },
    what: {
      he: 'מפת האולם עם השולחנות, ולידה רשימת מי שאישר הגעה. מושיבים כל משפחה בגרירה, בלחיצה או בסידור אוטומטי.',
      en: 'The hall map with its tables, beside the list of who said yes. Seat each family by dragging, with a click, or automatically.',
    },
    why: {
      he: 'משפחה תמיד יושבת יחד, שולחן לא מתמלא מעבר למקומות, ובסוף מדפיסים רשימה לכניסה ומפה לאולם.',
      en: 'A family always sits together, no table goes over its seats, and at the end you print a list for the entrance and a map for the hall.',
    },
    steps: [
      {
        he: 'פותחים "סידור שולחנות" בשלב "מסדרים". רוצים את התוכנית האמיתית? "תוכנית האולם" מעלה תמונה או PDF, ומכיילים קנה מידה.',
        en: 'Open “Seating plan” in the “Arrange” stage. Want the real layout? “Floor plan” uploads an image or PDF, then you calibrate the scale.',
      },
      {
        he: 'לוחצים "שולחן" ובוחרים עגול, מרובע או אבירים. "סימון" מוסיף במה, רחבת ריקודים, בר, כניסה ויציאה.',
        en: 'Click “Table” and pick round, square or knights. “Mark” adds a stage, dance floor, bar, entrance and exit.',
      },
      {
        he: 'גוררים משפחה מהרשימה לשולחן במפה, או לוחצים "הושבה" ובוחרים שולחן.',
        en: 'Drag a family from the list onto a table on the map, or click “Seat” and choose a table.',
      },
      {
        he: 'ב"הגדרות ובקשות" של משפחה קובעים קטגוריה, קרבה לבמה או ליציאה, ומי חייב או לא יושב איתה.',
        en: 'In a family’s “Settings and wishes”, set its category, how near the stage or exit, and who must or mustn’t sit with it.',
      },
      {
        he: 'לוחצים "סידור אוטומטי" ואז "סידור". אהבתם שולחן? "נעילת שולחן", ו"סדר מחדש" מסדר רק את השאר.',
        en: 'Click “Auto-seat”, then “Seat everyone”. Like a table? “Lock table”, and “Rearrange” redoes only the rest.',
      },
      {
        he: 'בסוף לוחצים "הדפסה" למפה ולרשימה לפי א״ב עם מספרי השולחנות, או "Excel" לקובץ.',
        en: 'At the end, click “Print” for the map and an A–Z list with table numbers, or “Excel” for a file.',
      },
    ],
    tips: [
      {
        he: 'הסידור הידני כלול בכל התוכניות. הסידור האוטומטי כלול בתוכנית Pro ומעלה.',
        en: 'Seating by hand is on every plan. Auto-seating is included from Pro up.',
      },
      {
        he: 'משפחה שהודיעה שלא תגיע אחרי שהושבה? מופיעה התראה, ו"לפנות את המקומות שלהן" מפנה אותם.',
        en: 'A seated family said they won’t come? A notice appears, and “Free their seats” clears them.',
      },
      {
        he: 'הכול נשמר לבד. בטלפון עוברים בין "מפה" ל"אורחים", ו"מסך מלא" נותן יותר מקום.',
        en: 'Everything saves by itself. On a phone, switch between “Map” and “Guests”, and “Full screen” gives more room.',
      },
    ],
    next: ['send-table', 'event-day', 'rsvp-and-notifications'],
    keywords: {
      he: 'סידור שולחנות, הושבה, שולחנות, מפת אולם, סידור אוטומטי, תוכנית אולם, הדפסה, אבירים, כרטיסי ישיבה, סידורי ישיבה',
      en: 'seating, seating plan, tables, floor plan, auto-seat, hall map, print, seating chart, knights table',
    },
    screens: ['seating'],
  },
  {
    slug: 'send-table',
    section: 'arrange',
    title: { he: 'שולחים לאורחים את השולחן', en: 'Send guests their table' },
    what: {
      he: 'כל משפחה מקבלת את מספר השולחן שלה וקישור אישי למפה עם הדרך מהכניסה — בוואטסאפ, מהוואטסאפ שלכם, או בכרטיס מודפס.',
      en: 'Each family gets its table number and a personal link to a map with the way from the entrance — on WhatsApp, from your own WhatsApp, or on a printed card.',
    },
    why: {
      he: 'האורחים מגיעים ויודעים לאן ללכת, ואם מזיזים מישהו אחרי ששלחתם — רק הוא מקבל עדכון.',
      en: 'Guests arrive knowing where to go, and if you move someone after sending, only they get an update.',
    },
    steps: [
      {
        he: 'מסיימים את סידור השולחנות ולוחצים "לשלוח לאורחים את השולחן" (בסידור השולחנות או ביום האירוע).',
        en: 'Finish the seating and click “Send guests their table” (in the seating plan or on the event day).',
      },
      {
        he: 'בוחרים לשונית: "כולם", "צריכים עדכון", "עוד לא קיבלו" או "קיבלו".',
        en: 'Choose a tab: “Everyone”, “Need an update”, “Not told yet” or “Told”.',
      },
      {
        he: 'כשהשליחה הרשמית מאושרת, לוחצים "שליחה בוואטסאפ ל-N משפחות" — קרדיט אחד לכל משפחה.',
        en: 'When official sending is approved, click “Send on WhatsApp to N families” — one credit per family.',
      },
      {
        he: 'אחרת, ליד כל משפחה: "שליחה מהוואטסאפ שלי" או "העתקת הקישור למפה". אמרתם בעצמכם? "סימון שקיבלו".',
        en: 'Otherwise, next to each family: “Send from my WhatsApp” or “Copy the map link”. Told them yourself? “Mark as told”.',
      },
      {
        he: 'לכרטיסים מודפסים: "כרטיסי שולחן להדפסה", בוחרים "לפי א״ב" או "לפי שולחנות", ולוחצים "הדפסה / שמירה כ-PDF".',
        en: 'For printed cards: “Table cards to print”, choose “A–Z” or “By table”, and click “Print / Save as PDF”.',
      },
    ],
    tips: [
      {
        he: 'שליחת השולחנות כלולה בתוכנית Pro ומעלה.',
        en: 'Sending tables is included from Pro up.',
      },
      {
        he: 'אחרי השליחה המספרים "נועלים": הזזה של מי שכבר קיבל מבקשת אישור, והמשפחה עוברת ל"צריכים עדכון".',
        en: 'After sending, numbers “lock”: moving a family that was told asks you first, and they move to “Need an update”.',
      },
      {
        he: 'כשיש רישום בכניסה, אפשר להוסיף "קוד כניסה על כל כרטיס" — בכניסה סורקים אותו.',
        en: 'With entrance check-in, you can add an entry code on each card — staff scan it at the door.',
      },
    ],
    next: ['event-day', 'seating', 'whatsapp-sending'],
    keywords: {
      he: 'מספר שולחן, כרטיסי שולחן, כרטיסי ישיבה, שליחת שולחן, מפת שולחן, הדפסה, הודעה לאורחים, איפה יושבים',
      en: 'table number, table cards, place cards, send table, table map, print, tell guests, where do I sit',
    },
    screens: ['seating', 'live'],
  },

  // ─── celebrate ──────────────────────────────────────────────────────────────────────────────
  {
    slug: 'event-day',
    section: 'celebrate',
    title: { he: 'יום האירוע', en: 'The event day' },
    what: {
      he: 'מסך שמראה בזמן אמת מי הגיע, איך השולחנות מתמלאים ומה אפשר להזיז — ועמדת כניסה לצוות בקישור, בלי חשבון.',
      en: 'A live screen of who has arrived, how the tables are filling and what you can move — plus an entrance station for staff on a link, no account needed.',
    },
    why: {
      he: 'בכניסה רושמים אורחים בשניות ורואים מיד את מספר השולחן, ואתם רואים את האולם מתמלא ומתקנים תוך כדי.',
      en: 'At the door, guests are checked in within seconds and see their table at once, while you watch the hall fill and fix things as you go.',
    },
    steps: [
      {
        he: 'פותחים "יום האירוע" בשלב "חוגגים". בכרטיס "עמדת הכניסה" לוחצים "העתקת הקישור" או "הורדת QR" ושולחים לצוות.',
        en: 'Open “Event day” in the “Celebrate” stage. In the “Entrance station” card, click “Copy link” or “Download QR” and send it to the staff.',
      },
      {
        he: 'בטלפון או בטאבלט שבכניסה פותחים את הקישור. "סריקת קוד" סורקת את הקוד של האורח, או מחפשים לפי שם או טלפון.',
        en: 'On the phone or tablet at the door, open the link. “Scan a code” reads the guest’s code, or search by name or phone.',
      },
      {
        he: 'בוחרים כמה הגיעו ולוחצים "רישום N אורחים" — מספר השולחן מופיע מיד. טעות? "ביטול".',
        en: 'Choose how many arrived and tap “Check in N guests” — the table number shows at once. A mistake? “Undo”.',
      },
      {
        he: 'אצלכם בוחרים תצוגה: "מפה" (כל שולחן צבוע לפי כמה הגיעו), "שולחנות" או "הגעות". ב"הגיעו לאחרונה" אפשר לבטל.',
        en: 'On your side, pick a view: “Map” (each table colored by how many arrived), “Tables” or “Arrivals”. “Just arrived” lets you undo.',
      },
      {
        he: 'לחיצה על שולחן במפה: "הגיעו" לרישום מהטלפון שלכם, "העברה" לשולחן אחר, או "איחוד לשולחן אחר".',
        en: 'Click a table on the map: “Arrived” to check in from your phone, “Move” to another table, or “Merge into another table”.',
      },
      {
        he: 'כל העברה ואיחוד נשמרים ב"היסטוריה", ואפשר לבטל את השינויים האחרונים.',
        en: 'Every move and merge is kept in “History”, and you can undo the latest changes.',
      },
    ],
    tips: [
      {
        he: 'רישום בכניסה ומפת האולם החיה כלולים בתוכנית Business. "קישור חדש" מבטל מיד את הקישור הקודם של העמדה.',
        en: 'Entrance check-in and the live hall map are included in Business. “New link” cancels the station’s old link at once.',
      },
      {
        he: '45 דקות אחרי תחילת האירוע מופיעה התראה על שולחנות שחצי ריקים, והצעות לאחד אותם.',
        en: '45 minutes after the event starts, you’re alerted to half-empty tables, with suggestions to merge them.',
      },
      {
        he: 'המצלמה לא נפתחת? מאשרים גישה למצלמה בדפדפן, או מחפשים לפי שם. רישומי הכניסה נמחקים 30 יום אחרי האירוע.',
        en: 'Camera won’t open? Allow camera access in the browser, or search by name. Check-in records are deleted 30 days after the event.',
      },
    ],
    next: ['send-table', 'live-gallery', 'hall-screen'],
    keywords: {
      he: 'יום האירוע, עמדת כניסה, צ׳ק אין, check-in, QR, סריקה, רישום הגעה, מפת אולם חיה, הושבה מחדש, מארחת, כניסה',
      en: 'event day, entrance station, check-in, QR, scan, arrivals, live hall map, reseat, hostess, door',
    },
    screens: ['live'],
  },
  {
    slug: 'live-gallery',
    section: 'celebrate',
    title: { he: 'גלריה חיה מהאורחים', en: 'A live gallery from your guests' },
    what: {
      he: 'האורחים מעלים תמונות וסרטונים מהאירוע ישר מהטלפון, בקישור או בקוד QR — בלי הרשמה ובלי אפליקציה — והם מופיעים אצל כולם בזמן אמת.',
      en: 'Guests upload photos and videos straight from their phones, by link or QR code — no sign-up, no app — and they appear for everyone in real time.',
    },
    why: {
      he: 'כל הרגעים שהאורחים צילמו נמצאים במקום אחד, אתם מחליטים מה מופיע, ובסוף מורידים את כל קובצי המקור.',
      en: 'Every moment your guests captured in one place, you decide what shows, and at the end you download all the original files.',
    },
    steps: [
      {
        he: 'פותחים "גלריה חיה ומסך באולם" בשלב "חוגגים" ולוחצים "הפעלת הגלריה".',
        en: 'Open “Live gallery & hall screen” in the “Celebrate” stage and click “Turn on the gallery”.',
      },
      {
        he: 'בכרטיס "הקישור לאורחים": "העתקה", "שליחה בוואטסאפ", או מורידים את קוד ה-QR להדפסה על השולחנות.',
        en: 'In the guests’ link card: “Copy”, “Send on WhatsApp”, or download the QR code to print on the tables.',
      },
      {
        he: 'רוצים לשלוח לכל המוזמנים? "שליחת הקישור לאורחים" שולח לכל אחד את הקישור האישי שלו לגלריה.',
        en: 'Want to send it to every guest? “Send guests the link” sends each one their own gallery link.',
      },
      {
        he: 'ב"הגדרות" בוחרים "מופיעה מיד" או "אחרי אישור שלכם", ואם רוצים גם "קוד כניסה" ו"זמני העלאה".',
        en: 'In “Settings” choose “Shows right away” or “After you approve”, and if you like an “Access code” and “Upload times”.',
      },
      {
        he: 'ב"ממתינים לאישור" לוחצים "אישור", "דחייה" או "הסתרה". "השהיית העלאות" עוצרת העלאות לזמן מה, למשל בחופה.',
        en: 'In “Awaiting approval” click “Approve”, “Reject” or “Hide”. “Pause uploads” stops uploads for a while — during the ceremony, say.',
      },
      {
        he: 'אחרי האירוע לוחצים "הורדת הכל (ZIP)" כדי לקבל את כל קובצי המקור.',
        en: 'After the event, click “Download all (ZIP)” to get every original file.',
      },
    ],
    tips: [
      {
        he: 'הגלריה החיה כלולה בתוכנית Pro ומעלה.',
        en: 'The live gallery is included from Pro up.',
      },
      {
        he: '"קישור חדש" מבטל מיד את הקישור הקודם, גם את הקוד שכבר הודפס. התמונות נשארות.',
        en: '“New link” cancels the old link at once, including a code you already printed. The photos stay.',
      },
      {
        he: 'קוד הכניסה נשמר מוצפן ולא מוצג שוב — אפשר רק להחליף או להסיר. מחיקה של פריט היא לצמיתות.',
        en: 'The access code is stored encrypted and never shown again — you can only replace or remove it. Deleting an item is permanent.',
      },
    ],
    next: ['hall-screen', 'moments-film', 'event-day'],
    keywords: {
      he: 'גלריה, גלריה חיה, תמונות מהאורחים, העלאת תמונות, QR, אלבום, ZIP, הורדה, אישור תמונות, סרטונים',
      en: 'gallery, live gallery, guest photos, upload photos, QR, album, ZIP, download, approve photos, videos, moderation',
    },
    screens: ['gallery'],
  },
  {
    slug: 'hall-screen',
    section: 'celebrate',
    title: { he: 'המסך באולם', en: 'The hall screen' },
    what: {
      he: 'קישור נפרד שפותחים במחשב שמחובר למקרן או לטלוויזיה: התמונות מהגלריה מתחלפות לבד, וחדשות נכנסות תוך שניות.',
      en: 'A separate link you open on a computer connected to a projector or TV: gallery photos change by themselves, and new ones arrive within seconds.',
    },
    why: {
      he: 'האורחים רואים את התמונות שלהם על המסך הגדול כמעט מיד — וזה מעודד עוד אורחים להעלות.',
      en: 'Guests see their photos on the big screen almost at once — which gets even more of them uploading.',
    },
    steps: [
      {
        he: 'מפעילים את הגלריה החיה ב"גלריה חיה ומסך באולם".',
        en: 'Turn on the live gallery in “Live gallery & hall screen”.',
      },
      {
        he: 'בכרטיס "מסך באולם" לוחצים "פתיחת המסך", או "העתקת הקישור" כדי לפתוח אותו במחשב אחר.',
        en: 'In the “Venue screen” card, click “Open the screen”, or “Copy link” to open it on another computer.',
      },
      {
        he: 'פותחים את הקישור במחשב שמחובר למקרן או למסך. אין בו כפתורים ואין סמן — רק התמונות.',
        en: 'Open the link on the computer connected to the projector or screen. No buttons and no cursor — just the photos.',
      },
      {
        he: 'בודקים שהתמונות מתחלפות. רק מה שפורסם בגלריה מגיע למסך; מה שממתין לאישור לא מוצג.',
        en: 'Check that photos are changing. Only what’s published in the gallery reaches the screen; anything awaiting approval doesn’t.',
      },
      {
        he: 'הקישור הגיע למי שלא צריך? "קישור חדש למסך" — המסך הישן מפסיק להתעדכן.',
        en: 'The link reached the wrong people? “New screen link” — the old screen stops updating.',
      },
    ],
    tips: [
      {
        he: 'המסך באולם כלול בתוכנית Business.',
        en: 'The hall screen is included in Business.',
      },
      {
        he: 'אפשר להציג גם את סרט הרגעים: מסמנים "להציג לאורחים בגלריה ובמסך האירוע" כשמוסיפים אותו לגלריה.',
        en: 'You can show the moments film too: tick “Show it to guests in the gallery and on the venue screen” when adding it to the gallery.',
      },
    ],
    next: ['live-gallery', 'moments-film', 'event-day'],
    keywords: {
      he: 'מסך באולם, מקרן, טלוויזיה, הקרנה, מצגת, סלייד שואו, מסך גדול, תמונות על המסך',
      en: 'hall screen, venue screen, projector, TV, slideshow, big screen, photos on screen',
    },
    screens: ['gallery'],
  },
  {
    slug: 'moments-film',
    section: 'celebrate',
    title: { he: 'סרט הרגעים', en: 'The moments film' },
    what: {
      he: 'סרט קצר מהתמונות והסרטונים שבגלריה, ערוך לפי הקצב של השיר, עם כרטיס פתיחה וסיום בעיצוב ההזמנה. נוצר כולו בדפדפן שלכם.',
      en: 'A short film from the gallery’s photos and videos, cut to the beat of the song, with opening and closing cards in your invitation’s style. Made entirely in your browser.',
    },
    why: {
      he: 'מזכרת מוכנה לשיתוף מיד אחרי האירוע, בלי עורך וידאו ובלי לשלוח תמונות לשום מקום.',
      en: 'A keepsake ready to share right after the event — no video editor, and no photos sent anywhere.',
    },
    steps: [
      {
        he: 'פותחים "סרט הרגעים" בשלב "חוגגים", או "יצירת סרט" בכרטיס שבגלריה.',
        en: 'Open “Moments film” in the “Celebrate” stage, or “Make a film” on the gallery’s card.',
      },
      {
        he: 'בוחרים אורך (30, 60 או 90 שניות), "לאורך" או "לרוחב", איכות, ושפת הכרטיסים.',
        en: 'Choose a length (30, 60 or 90 seconds), vertical or horizontal, the quality, and the cards’ language.',
      },
      {
        he: 'בוחרים מוזיקה: "השיר של ההזמנה", "שיר אחר" מהמחשב, או "בלי".',
        en: 'Choose music: the invitation’s song, another song from your computer, or none.',
      },
      {
        he: 'בודקים את הצילומים שנבחרו: "נעיצה" משאירה צילום, "הוצאה מהסרט" מוציאה, ו"הוספת צילומים" פותחת את כל הגלריה.',
        en: 'Check the chosen shots: “Pin” keeps a shot, “Remove from the film” drops it, and “Add shots” opens the whole gallery.',
      },
      {
        he: 'לוחצים "תצוגה מקדימה", ואז "יצירת הסרט". אפשר לבטל באמצע.',
        en: 'Click “Preview”, then “Make the film”. You can cancel midway.',
      },
      {
        he: 'בסוף: "הורדה", או "הוספה לגלריה" — ואם מסמנים, הסרט מוצג לאורחים ובמסך האירוע.',
        en: 'At the end: “Download”, or “Add to the gallery” — and if you tick the box, guests and the venue screen show it.',
      },
    ],
    tips: [
      {
        he: 'סרט הרגעים כלול בתוכנית Business. צריך לפחות 3 תמונות או סרטונים שמוצגים בגלריה.',
        en: 'The moments film is included in Business. You need at least 3 photos or videos showing in the gallery.',
      },
      {
        he: 'עובד הכי טוב ב-Chrome, Edge או Safari עדכניים במחשב. בדפדפן אחר הסרט מוקלט בזמן אמת — משאירים את הלשונית פתוחה עד הסוף.',
        en: 'Works best in an up-to-date Chrome, Edge or Safari on a computer. In other browsers it records in real time — keep the tab open to the end.',
      },
      {
        he: 'הבחירה שלכם (נעיצות והוצאות) נשמרת בדפדפן הזה. "איפוס הבחירה" מתחיל מחדש.',
        en: 'Your choices (pins and removals) are kept in this browser. “Reset the choice” starts over.',
      },
    ],
    next: ['live-gallery', 'hall-screen', 'insights-privacy'],
    keywords: {
      he: 'סרט, סרט הרגעים, וידאו, קליפ, מזכרת, מוזיקה, סרטון מהאירוע, סיכום האירוע',
      en: 'film, moments film, highlights film, video, clip, keepsake, music, event video, reel',
    },
    screens: ['film'],
  },

  // ─── account ────────────────────────────────────────────────────────────────────────────────
  {
    slug: 'insights-privacy',
    section: 'account',
    title: { he: 'תובנות ופרטיות', en: 'Insights and privacy' },
    what: {
      he: '"תובנות" מראה איך האורחים השתמשו בהזמנה: כמה ביקרו, פתחו, קראו עד הסוף ואישרו — לפי יום, שפה, מקור ומכשיר. הכול בסיכומים, בלי לזהות אף אחד.',
      en: '“Insights” shows how guests used the invitation: how many visited, opened it, read to the end and replied — by day, language, source and device. All as totals, identifying no one.',
    },
    why: {
      he: 'מבינים אם ההזמנה עובדת — למשל אם רבים פותחים ולא מאשרים — בלי עוגיות ובלי לעקוב אחרי אורחים.',
      en: 'You see whether the invitation works — say, many open it but don’t reply — with no cookies and no tracking of guests.',
    },
    steps: [
      {
        he: 'לוחצים "תובנות" בתחתית הניווט של האירוע (בטלפון: בראש בית האירוע).',
        en: 'Click “Insights” at the bottom of the event’s navigation (on a phone: at the top of the event home).',
      },
      {
        he: 'בוחרים טווח: "7 ימים", "30 יום" או "מאז הפרסום".',
        en: 'Choose a range: “7 days”, “30 days” or “Since publishing”.',
      },
      {
        he: 'קוראים את "מהפתיחה ועד אישור ההגעה" — כמה ביקורים הגיעו לכל שלב.',
        en: 'Read the funnel from opening to RSVP — how many visits reached each step.',
      },
      {
        he: 'בודקים "לפי יום", "לפי שפה", "מאיפה הגיעו" (קישור אישי, קישור ששותף, קוד QR) ו"באיזה מכשיר".',
        en: 'Check “By day”, “By language”, where they came from (personal link, shared link, QR code) and which device.',
      },
      {
        he: 'כדי שההזמנה לא תופיע במנועי חיפוש, משאירים דלוק בעורך: "הגדרות" ← "קישור ושיתוף" ← "להסתיר ממנועי חיפוש".',
        en: 'To keep the invitation out of search engines, leave this on in the editor: “Settings” → “Link & sharing” → “Hide from search engines”.',
      },
    ],
    tips: [
      {
        he: 'בלי עוגיות ובלי כתובות IP, ומי שביקש בדפדפן לא לעקוב לא נספר. הרישום של כל ביקור נמחק אחרי 7 ימים.',
        en: 'No cookies, no IP addresses, and browsers that ask not to be tracked aren’t counted. Each visit’s record is deleted after 7 days.',
      },
      {
        he: 'הזמנות, רשימות ותשובות נשמרות עד שאתם מוחקים אותן או את החשבון. אחרי מחיקת חשבון המידע נמחק תוך 30 יום, ומהגיבויים תוך 90.',
        en: 'Invitations, lists and replies are kept until you delete them or the account. After an account is deleted, its data is erased within 30 days, and from backups within 90.',
      },
      {
        he: 'רישומי כניסה ונתוני חיפוש לפי פנים נמחקים 30 יום אחרי האירוע. כל הפרטים בעמוד מדיניות הפרטיות.',
        en: 'Check-in records and face-search data are erased 30 days after the event. The privacy policy page has all the details.',
      },
    ],
    next: ['event-settings', 'plans-billing', 'rsvp-and-notifications'],
    keywords: {
      he: 'תובנות, סטטיסטיקה, נתונים, כמה פתחו, אנליטיקס, פרטיות, מנועי חיפוש, עוגיות, מחיקת מידע, שמירת מידע, גוגל',
      en: 'insights, statistics, analytics, data, how many opened, privacy, search engines, noindex, cookies, data deletion, retention, Google',
    },
    screens: ['insights'],
  },
  {
    slug: 'plans-billing',
    section: 'account',
    title: { he: 'תוכניות, קרדיטים ותשלום', en: 'Plans, credits and billing' },
    what: {
      he: 'שלוש תוכניות — חינם, Pro ו-Business — וכל אחת פותחת יותר. ב"חבילה וחיובים" רואים את התוכנית, הניצול, הקרדיטים לוואטסאפ והיסטוריית התשלומים.',
      en: 'Three plans — Free, Pro and Business — each opening more. “Plan & billing” shows your plan, usage, WhatsApp credits and payment history.',
    },
    why: {
      he: 'מתחילים בחינם, ומשדרגים רק כשצריכים עוד הזמנות, עוד מוזמנים או כלים כמו גלריה חיה ויום האירוע.',
      en: 'Start free, and upgrade only when you need more invitations, more guests, or tools like the live gallery and the event day.',
    },
    steps: [
      {
        he: 'פותחים את תפריט החשבון בתחתית הסרגל ולוחצים "חבילה וחיובים". המחירים העדכניים מופיעים שם.',
        en: 'Open the account menu at the bottom of the sidebar and click “Plan & billing”. The current prices are shown there.',
      },
      {
        he: 'ב"השימוש בחבילה" רואים כמה הזמנות פעילות יש, כמה מוזמנים אפשר בכל הזמנה, וכמה קרדיטים לוואטסאפ נשארו.',
        en: 'In the usage cards you see your active invitations, how many guests each invitation can have, and the WhatsApp credits left.',
      },
      {
        he: 'לשדרוג לוחצים "שדרוג ל־Pro" או "שדרוג ל־Business" ומשלמים בעמוד המאובטח של PayPlus.',
        en: 'To upgrade, click “Upgrade to Pro” or “Upgrade to Business” and pay on PayPlus’s secure page.',
      },
      {
        he: 'צריכים עוד הודעות? ב"קרדיטים להודעות וואטסאפ" בוחרים חבילה ולוחצים "קנייה". הקרדיטים לא פגים.',
        en: 'Need more messages? Under WhatsApp credits, pick a pack and click “Buy”. Credits never expire.',
      },
      {
        he: 'רוצים להפסיק? "ביטול המנוי" — התוכנית נשארת עד סוף התקופה ששולמה, ואז עוברים לחינם.',
        en: 'Want to stop? “Cancel subscription” — the plan stays until the end of the paid period, then you move to Free.',
      },
    ],
    tips: [
      {
        he: 'חינם: הזמנה פעילה אחת ועד 150 מוזמנים. Pro: עד 5 הזמנות, עד 1,000 מוזמנים ו-50 הודעות בחודש. Business: הזמנות ללא הגבלה, עד 5,000 מוזמנים, 300 הודעות בחודש ותמיכה בעדיפות.',
        en: 'Free: one active invitation and up to 150 guests. Pro: up to 5 invitations, 1,000 guests and 50 messages a month. Business: unlimited invitations, up to 5,000 guests, 300 messages a month and priority support.',
      },
      {
        he: 'בהצעות לשדרוג התוכניות נקראות גם חבילות: חינם = Basic, Pro = Premium, Business = VIP. כל אחת כוללת את מה שלפניה.',
        en: 'Upgrade offers also name the plans as packages: Free = Basic, Pro = Premium, Business = VIP. Each includes the one before it.',
      },
      {
        he: 'Pro פותחת עיצובי פרימיום, גלריה חיה, סידור אוטומטי ושליחת שולחנות. Business מוסיפה רישום בכניסה, מסך באולם, סרט הרגעים ו"עצבו לי".',
        en: 'Pro opens premium designs, the live gallery, auto-seating and sending tables. Business adds entrance check-in, the hall screen, the moments film and “Design it for me”.',
      },
    ],
    next: ['whatsapp-sending', 'event-settings', 'insights-privacy'],
    keywords: {
      he: 'חבילה, תוכנית, מחיר, מחירים, תשלום, שדרוג, Pro, Business, חינם, קרדיטים, ביטול מנוי, חשבונית, מנוי, חיוב',
      en: 'plan, package, price, pricing, payment, upgrade, Pro, Business, free, credits, cancel subscription, invoice, subscription, billing',
    },
  },
  {
    slug: 'event-settings',
    section: 'account',
    title: { he: 'הגדרות האירוע', en: 'Event settings' },
    what: {
      he: 'מקום אחד לפרטי האירוע, להגדרות התכנון ולחבילה — ולשכפול האירוע או העברה שלו לארכיון.',
      en: 'One place for the event’s details, the planning settings and the package — and for duplicating or archiving the event.',
    },
    why: {
      he: 'כל מה שנוגע לאירוע כולו, ולא למסך אחד, נמצא כאן — בלי לחפש בתפריטים.',
      en: 'Everything about the event as a whole, rather than one screen, is here — no digging through menus.',
    },
    steps: [
      {
        he: 'לוחצים "הגדרות האירוע" בתחתית הניווט (בטלפון: בראש בית האירוע).',
        en: 'Click “Event settings” at the bottom of the navigation (on a phone: at the top of the event home).',
      },
      {
        he: 'ב"פרטי האירוע" לוחצים "עריכה בעורך" כדי לשנות שמות, תאריך, מקום ושפות.',
        en: 'Under “Event details”, click “Edit in the editor” to change names, date, place and languages.',
      },
      {
        he: 'ב"הגדרות התכנון" לוחצים "פתיחת הגדרות התכנון": רמת השילוב (עצמאי, מומלץ, מלא) וסיכום שבועי במייל.',
        en: 'Under “Planning settings”, click “Open planning settings”: how linked the planning is (standalone, recommended, full) and the weekly email.',
      },
      {
        he: 'ב"החבילה" לוחצים "חבילה וחיובים" כדי לראות אילו יכולות פתוחות לאירוע.',
        en: 'Under “Package”, click “Plans & billing” to see which features are open for the event.',
      },
      {
        he: 'לאירוע נוסף באותו סגנון לוחצים "שכפול": אותו עיצוב וטקסטים, בלי המוזמנים והתשובות.',
        en: 'For another event in the same style, click “Duplicate”: the same design and texts, without the guests and replies.',
      },
      {
        he: 'לסגירת האירוע לוחצים "העברה לארכיון". כדי להחזיר: "החזרה מהארכיון".',
        en: 'To close the event, click “Archive”. To bring it back: “Restore”.',
      },
    ],
    tips: [
      {
        he: 'בארכיון ההזמנה לא זמינה לאורחים ולא נספרת בחבילה, ושום דבר לא נמחק.',
        en: 'In the archive the invitation isn’t available to guests and doesn’t count toward your plan, and nothing is deleted.',
      },
      {
        he: 'החזרה מהארכיון אפשרית כשיש מקום בתוכנית להזמנה פעילה נוספת.',
        en: 'Restoring works when your plan has room for another active invitation.',
      },
      {
        he: 'כיבוי חיבור בהגדרות התכנון לא מוחק שום דבר.',
        en: 'Turning a link off in the planning settings deletes nothing.',
      },
    ],
    next: ['plans-billing', 'insights-privacy', 'navigation'],
    keywords: {
      he: 'הגדרות, הגדרות האירוע, ארכיון, שכפול, העתקה, פרטי האירוע, שינוי תאריך, מחיקת אירוע, חבילה, סיכום שבועי',
      en: 'settings, event settings, archive, duplicate, copy, event details, change date, delete event, package, weekly email',
    },
    screens: ['settings'],
  },
];

export const GUIDE_FAQ: GuideFaq[] = [
  {
    q: {
      he: 'למה המספרים של "מגיעים" ו"עוד לא ענו" לא מסתדרים?',
      en: 'Why don’t “Coming” and “Not answered” add up?',
    },
    a: {
      he: 'תשובה שהגיעה מהקישור הכללי כבר נספרת במגיעים (מסומנת "מהקישור הכללי"), אבל היא לא מקושרת למוזמן ברשימה — ולכן אותו מוזמן עדיין ב"עוד לא ענו". ב"מוזמנים" לוחצים "שיוך למוזמנים" ומשייכים כל תשובה.',
      en: 'A reply through the general link already counts as coming (marked “from the general link”), but it isn’t linked to a guest on the list — so that guest still shows as not answered. In “Guests”, click “Match to guests” and match each reply.',
    },
    more: 'rsvp-and-notifications',
  },
  {
    q: {
      he: 'אפשר לשנות את ההזמנה אחרי ששלחתי אותה?',
      en: 'Can I change the invitation after sending it?',
    },
    a: {
      he: 'כן. עורכים ב"עיצוב ההזמנה" ולוחצים שוב "פרסום". האורחים רואים את השינוי באותו קישור, בלי לשלוח מחדש.',
      en: 'Yes. Edit it in “Invitation design” and click “Publish” again. Guests see the change on the same link — no need to send again.',
    },
    more: 'publish-and-share',
  },
  {
    q: {
      he: 'שיניתי משהו והאורחים לא רואים את זה. למה?',
      en: 'I changed something and guests don’t see it. Why?',
    },
    a: {
      he: 'שינויים נשמרים כטיוטה. כשכתוב "יש שינויים שלא פורסמו", לוחצים "פרסום" בפס העליון או בעורך.',
      en: 'Changes are saved as a draft. When it says there are unpublished changes, click “Publish” in the top strip or in the editor.',
    },
    more: 'publish-and-share',
  },
  {
    q: {
      he: 'איך מוסיפים מוזמנים אחרי שכבר שלחתי?',
      en: 'How do I add guests after I’ve already sent?',
    },
    a: {
      he: 'מעלים שוב את הקובץ המעודכן (מי שכבר ברשימה מתעדכן ולא נכפל), או "הוספה ידנית". אחר כך שולחים "למי שעוד לא קיבל" — מי שכבר קיבל לא יקבל שוב.',
      en: 'Upload the updated file again (guests already on the list are updated, not duplicated), or use “Add by hand”. Then send to those who haven’t got it — guests who already did won’t get it twice.',
    },
    more: 'import-guests',
  },
  {
    q: {
      he: 'מה עושים אם השליחה בוואטסאפ לא מחוברת?',
      en: 'What if WhatsApp sending isn’t connected?',
    },
    a: {
      he: 'לוחצים "שליחה מהוואטסאפ שלי": נפתח תור, ולכל מוזמן נפתח צ׳אט עם הודעה מוכנה והקישור האישי שלו. שולחים, חוזרים ולוחצים "הבא". השליחה האוטומטית תגיע בקרוב.',
      en: 'Click “Send from my WhatsApp”: a queue opens, and each guest gets a chat with a ready message and their personal link. Send, come back and click “Next”. Automatic sending is coming soon.',
    },
    more: 'whatsapp-sending',
  },
  {
    q: {
      he: 'אפשר לתכנן בלי לבחור עיצוב הזמנה?',
      en: 'Can I plan without choosing an invitation design?',
    },
    a: {
      he: 'כן. ב"אירוע חדש" בוחרים "מתכננים" — האירוע נפתח עם עיצוב שמתאים לסוג האירוע, וישר לבית האירוע עם משימות ותקציב. את ההזמנה מעצבים אחר כך ב"עיצוב ההזמנה".',
      en: 'Yes. In “New event” choose “Planning” — the event opens with a design that suits its type and goes straight to the event home with tasks and a budget. Design the invitation later in “Invitation design”.',
    },
    more: 'quick-start',
  },
  {
    q: {
      he: 'איך התקציב מתחלק לקטגוריות?',
      en: 'How is the budget split into categories?',
    },
    a: {
      he: 'לפי תוכנית מוכנה לסוג האירוע, בשקלים שלמים. קטגוריה שמחושבת לפי אורח מקבלת מחיר שלם לאורח, ומה שנשאר מהעיגול נכנס ל"אחר" — כך שהסכום שווה בדיוק לתקציב. אפשר לשנות כל קטגוריה.',
      en: 'By a ready plan for your kind of event, in whole shekels. A per-guest category gets a whole-shekel price per guest, and whatever rounding leaves goes to “Other” — so the total equals the budget exactly. You can change any category.',
    },
    more: 'budget-gauge',
  },
  {
    q: {
      he: 'איפה מקבלים עזרה?',
      en: 'Where do I get help?',
    },
    a: {
      he: '"מדריך ועזרה" בסרגל פותח חלונית עם "מדריך", "שאלו את העוזר" ו"פנייה לצוות". המדריך המלא עם חיפוש נמצא גם בעמוד המדריך, ובכל אזור יש "?" שמסביר את הכפתורים שלו.',
      en: '“Guide & help” in the sidebar opens a panel with “Guide”, “Ask the assistant” and “Contact the team”. The full guide with search also has its own page, and every area has a “?” explaining its buttons.',
    },
    more: 'navigation',
  },
  {
    q: {
      he: 'באילו שפות זה עובד?',
      en: 'Which languages does it work in?',
    },
    a: {
      he: 'הממשק בעברית ובאנגלית (בוחרים ב"שפת הממשק"). ההזמנה עצמה יכולה להיות בעד שבע שפות: עברית, אנגלית, רוסית, ערבית, צרפתית, ספרדית ואמהרית. תרגום אוטומטי כלול בתוכנית Pro ומעלה.',
      en: 'The app is in Hebrew and English (choose under “Interface language”). The invitation itself can be in up to seven: Hebrew, English, Russian, Arabic, French, Spanish and Amharic. Automatic translation is included from Pro up.',
    },
    more: 'create-invitation',
  },
  {
    q: {
      he: 'זה בחינם?',
      en: 'Is it free?',
    },
    a: {
      he: 'כן, יש תוכנית חינם: הזמנה פעילה אחת, עד 150 מוזמנים, שליחה מהוואטסאפ שלכם, וכלי התכנון. Pro ו-Business פותחות עוד; המחירים העדכניים מופיעים ב"חבילה וחיובים".',
      en: 'Yes, there’s a free plan: one active invitation, up to 150 guests, sending from your own WhatsApp, and the planning tools. Pro and Business open more; current prices are on “Plan & billing”.',
    },
    more: 'plans-billing',
  },
  {
    q: {
      he: 'האורחים צריכים אפליקציה כדי לאשר הגעה?',
      en: 'Do guests need an app to RSVP?',
    },
    a: {
      he: 'לא. הקישור נפתח בדפדפן של הטלפון, והטופס בתוך ההזמנה. מי שנכנס מהקישור האישי מקבל טופס ממולא בשם ובטלפון. גם העלאה לגלריה החיה עובדת בלי הרשמה ובלי אפליקציה.',
      en: 'No. The link opens in the phone’s browser, and the form is inside the invitation. A guest using their personal link gets the form filled with their name and phone. Uploading to the live gallery needs no sign-up or app either.',
    },
    more: 'rsvp-and-notifications',
  },
  {
    q: {
      he: 'איך מוחקים אירוע או מעבירים אותו לארכיון?',
      en: 'How do I delete or archive an event?',
    },
    a: {
      he: 'ב"הגדרות האירוע" לוחצים "העברה לארכיון": ההזמנה נסגרת לאורחים, לא נספרת בחבילה, ואפשר להחזיר אותה. מוזמנים ותשובות מוחקים מהתפריט שלהם. מחיקת החשבון ב"החשבון שלי" מוחקת לצמיתות את כל האירועים; למחיקה מלאה של אירוע אחד כותבים לנו ב"פנייה לצוות".',
      en: 'In “Event settings”, click “Archive”: the invitation closes to guests, stops counting toward your plan, and can be restored. Delete guests and replies from their own menus. Deleting your account in “My account” permanently erases every event; to fully delete a single event, write to us under “Contact the team”.',
    },
    more: 'event-settings',
  },
  {
    q: {
      he: 'יש מצב כהה?',
      en: 'Is there a dark mode?',
    },
    a: {
      he: 'כן. ב"מראה" בוחרים "כהה" או "לפי המכשיר" — במחשב בתחתית הסרגל, בטלפון בתפריט החשבון. ההזמנה שהאורחים רואים נשארת בעיצוב שלה, ומה שמדפיסים יוצא תמיד בהיר.',
      en: 'Yes. Under “Appearance” choose “Dark” or “Match device” — at the bottom of the sidebar on a computer, in the account menu on a phone. The invitation guests see keeps its own design, and printouts are always light.',
    },
  },
  {
    q: {
      he: 'למה מסך מסוים מסומן כחבילה מתקדמת?',
      en: 'Why is a screen marked as on a higher plan?',
    },
    a: {
      he: 'הוא שייך לתוכנית גבוהה יותר — למשל יום האירוע וסרט הרגעים ב-Business, גלריה חיה וסידור אוטומטי ב-Pro. פותחים אותו כדי לראות מה כלול ואיך לשדרג.',
      en: 'It belongs to a bigger plan — for example the event day and the moments film on Business, the live gallery and auto-seating on Pro. Open it to see what’s included and how to upgrade.',
    },
    more: 'plans-billing',
  },
];
