import type { Bilingual, PlanTemplate, TemplateCategory, TemplateTask } from '../model/types';

/**
 * Bar mitzvah and bat mitzvah: one road, two templates. The shared tasks and the budget are built once
 * (with the few gendered words in the celebrant's own grammatical gender); what really differs is
 * kept apart — the bar mitzvah has the reading, the tefillin and the aliyah; the bat mitzvah has a
 * ceremony that can be a speech, a project or only a party, and is not assumed to be in a synagogue.
 * No level of religiousness is assumed: every task is about what the family has to do.
 */
type Kind = 'bar' | 'bat';

/** The celebrant in the right gender, per template (Hebrew is gendered, English follows). */
const WHO = {
  bar: {
    he: 'החוגג',
    heTo: 'לחוגג',
    heOf: 'של החוגג',
    heLoves: 'אוהב',
    heWrites: 'כותב',
    en: 'the bar mitzvah boy',
    enPronoun: 'he',
  },
  bat: {
    he: 'החוגגת',
    heTo: 'לחוגגת',
    heOf: 'של החוגגת',
    heLoves: 'אוהבת',
    heWrites: 'כותבת',
    en: 'the bat mitzvah girl',
    enPronoun: 'she',
  },
} as const;

/** Tasks both templates share, from the first decisions to the thank-yous. */
function sharedTasks(kind: Kind): TemplateTask[] {
  const bar = kind === 'bar';
  const w = WHO[kind];
  const pick = (forBar: Bilingual, forBat: Bilingual): Bilingual => (bar ? forBar : forBat);

  return [
    {
      key: 'budget_set',
      title: { he: 'לקבוע תקציב כולל ולהתאים את החלוקה', en: 'Set the overall budget and adjust the split' },
      notes: {
        he: 'כדאי להשאיר כ-10% להוצאות בלתי צפויות, ולהחליט מראש מי במשפחה משתתף בעלויות',
        en: 'Keep about 10% for surprises, and agree up front who in the family is chipping in.',
      },
      offset: -330,
      minDays: 14,
    },
    {
      key: 'date_confirm',
      title: { he: 'לוודא את התאריך מול המשפחה הקרובה', en: 'Check the date with close family' },
      notes: pick(
        {
          he: 'בודקים את התאריך העברי והפרשה, חגים וחופשות, ואת הזמינות של הסבים והסבתות',
          en: 'Check the Hebrew date and Torah portion, holidays and school breaks, and that grandparents can make it.',
        },
        {
          he: 'בודקים את התאריך העברי או תאריך קרוב אליו, חגים וחופשות, ואת הזמינות של הסבים והסבתות',
          en: 'Check the Hebrew birthday or a date near it, holidays and school breaks, and that grandparents can make it.',
        },
      ),
      offset: -325,
      minDays: 45,
      priority: 1,
    },
    {
      key: 'event_format',
      title: { he: 'להחליט על מתכונת החגיגה', en: 'Decide on the format of the celebration' },
      notes: pick(
        {
          he: 'אולם, גן אירועים, ארוחה משפחתית או מסיבה קטנה אחרי העלייה לתורה. כדאי לשמוע מה החוגג רוצה',
          en: 'A hall, a garden venue, a family meal or a small party after the aliyah. Ask what he wants.',
        },
        {
          he: 'מסיבה, ארוחה משפחתית, טיול או אירוע קטן בבית. כל מתכונת מתאימה, וכדאי לשמוע מה החוגגת רוצה',
          en: 'A party, a family meal, a trip or a small gathering at home. Any format works; ask what she wants.',
        },
      ),
      offset: -320,
      minDays: 45,
    },
    {
      key: 'guest_estimate',
      title: {
        he: 'להעריך כמה אורחים יהיו כדי לבחור מקום',
        en: 'Estimate the guest count to choose a venue',
      },
      notes: {
        he: 'מספיק טווח גס בשלב הזה. לא לשכוח חברים מהכיתה, ילדים ובני משפחה מרחוק',
        en: 'A rough range is enough for now. Remember classmates, children and out-of-town family.',
      },
      offset: -315,
      minDays: 45,
    },
    {
      key: 'venue_shortlist',
      title: { he: 'לסייר ולהשוות מקומות לאירוע', en: 'Tour and compare event venues' },
      notes: {
        he: 'אפשר גם בית, גינה או חוף. מבקשים הצעת מחיר בכתב ובודקים מה כלול: כיסאות, הגברה, שעות',
        en: 'A home, garden or beach works too. Ask for a written quote and check what is included: chairs, sound, hours.',
      },
      offset: -300,
      category: 'venue',
      minDays: 60,
    },
    {
      key: 'venue_book',
      title: { he: 'לסגור מקום ולשלם מקדמה', en: 'Book the venue and pay the deposit' },
      notes: {
        he: 'לקרוא את החוזה: ביטול, שעת סיום, כשרות ותוכנית חלופית למזג אוויר',
        en: 'Read the contract: cancellation terms, end time, kashrut and a weather backup.',
      },
      offset: -280,
      category: 'venue',
      minDays: 45,
      priority: 1,
    },
    {
      key: 'catering_quotes',
      title: {
        he: 'לבקש הצעות מחיר מקייטרינג ולקבוע טעימות',
        en: 'Request catering quotes and book tastings',
      },
      notes: {
        he: 'אם הקייטרינג כלול במקום אפשר לדלג. לשאול על תפריט לילדים, צמחוני וטבעוני ועל אלרגיות',
        en: "Skip if catering comes with the venue. Ask about kids', vegetarian and vegan menus, and allergies.",
      },
      offset: -265,
      category: 'catering',
      minDays: 45,
    },
    {
      key: 'catering_book',
      title: { he: 'לסגור קייטרינג ולאשר תפריט ראשוני', en: 'Book the caterer and agree on a draft menu' },
      notes: {
        he: 'לוודא שרמת הכשרות מתאימה למשפחה ולאורחים, ולברר איך מתומחרים ילדים ותוספות',
        en: 'Make sure the kashrut level suits your family and guests, and ask how children and extras are priced.',
      },
      offset: -240,
      category: 'catering',
      minDays: 30,
      priority: 1,
    },
    {
      key: 'photographer_book',
      title: { he: 'לסגור צלם', en: 'Book a photographer' },
      notes: {
        he: 'לראות אלבומים קודמים, לברר מתי מקבלים את התמונות, והאם הצילום כולל גם את הטקס',
        en: 'View past albums, ask when photos are delivered, and whether the ceremony is included.',
      },
      offset: -230,
      category: 'photographer',
      minDays: 21,
      priority: 1,
    },
    {
      key: 'videographer_book',
      title: { he: 'לסגור צלם וידאו', en: 'Book a videographer' },
      notes: {
        he: 'אפשר גם לצלם רק את הטקס או את הרגעים המרכזיים, וזה מוזיל',
        en: 'Filming only the ceremony or the key moments is also an option, and costs less.',
      },
      offset: -220,
      category: 'videographer',
      minDays: 21,
    },
    {
      key: 'dj_book',
      title: { he: "לסגור דיג'יי או להקה", en: 'Book a DJ or band' },
      notes: {
        he: 'לשלוח רשימת שירים אהובים ושירים שלא להשמיע, ולברר על הגברה ועל הנחיית הפעילות',
        en: 'Share favorite songs and ones to avoid, and ask about sound equipment and hosting the activities.',
      },
      offset: -210,
      category: 'dj',
      minDays: 21,
      priority: 1,
    },
    {
      key: 'design_concept',
      title: { he: 'לבחור קונספט ועיצוב לאירוע', en: 'Choose a theme and design for the event' },
      notes: {
        he: `צבעים, שפה גרפית ופינות מיוחדות. אפשר להתחיל מתחביב או נושא ש${w.he} ${w.heLoves}`,
        en: `Colors, graphics and special corners. You can start from a hobby or a topic ${w.enPronoun} loves.`,
      },
      offset: -200,
      category: 'design',
      minDays: 30,
    },
    {
      key: 'entertainment_pick',
      title: {
        he: 'לבחור פעילות או אטרקציה לאורחים הצעירים',
        en: 'Choose an activity or attraction for young guests',
      },
      notes: {
        he: `עמדת צילום, משחק משותף או הופעה קצרה. כדאי לבחור לפי הטעם ${w.heOf}`,
        en: `A photo booth, a group game or a short show. Go with what ${w.enPronoun} likes.`,
      },
      offset: -180,
      category: 'entertainment',
      minDays: 30,
    },
    {
      key: 'travel_lodging',
      title: {
        he: 'לתכנן הגעה ולינה לבני משפחה מרחוק',
        en: 'Plan travel and lodging for out-of-town family',
      },
      notes: {
        he: 'אם התאריך קרוב לחג או לחופשה, מקומות לינה נתפסים מהר. כדאי להתחיל מוקדם',
        en: 'Rooms fill up fast if the date is near a holiday or school break. Start early.',
      },
      offset: -150,
      minDays: 30,
    },
    {
      key: 'bar_service',
      title: { he: 'לתכנן בר ושתייה לאירוע', en: 'Plan the bar and drinks' },
      notes: {
        he: 'לחשב כמויות לפי מספר המבוגרים, לכלול אפשרויות ללא אלכוהול ולברר מי מגיש',
        en: 'Estimate quantities by number of adults, include non-alcoholic options, and check who serves.',
      },
      offset: -100,
      category: 'bar',
      minDays: 21,
    },
    {
      key: 'flowers_decor',
      title: { he: 'לתכנן פרחים ועיצוב שולחנות', en: 'Plan flowers and table decor' },
      notes: {
        he: 'אפשר להשתמש בעיצוב של המקום או להוסיף נגיעות אישיות: תמונות, ספרים או תחביבים',
        en: "Use the venue's decor or add personal touches: photos, books or hobbies.",
      },
      offset: -110,
      category: 'flowers',
      minDays: 21,
    },
    {
      key: 'cake_sweets',
      title: { he: 'להזמין עוגה ועמדת מתוקים', en: 'Order the cake and a sweets table' },
      notes: {
        he: 'לוודא אפשרות ללא גלוטן וטבעונית, ולסכם מתי ואיך מגיעה האספקה',
        en: 'Ask about gluten-free and vegan options, and agree on when and how it is delivered.',
      },
      offset: -95,
      category: 'cakes_sweets',
      minDays: 14,
    },
    {
      key: 'rental_check',
      title: {
        he: 'לבדוק מה צריך להשכיר: שולחנות, כיסאות ותאורה',
        en: 'Check what to rent: tables, chairs and lighting',
      },
      notes: {
        he: 'רלוונטי בעיקר לאירוע מחוץ לאולם. כדאי לבקש גם מסך או הקרנה אם יש סרטון',
        en: 'Mostly relevant outside a hall. Ask about a screen or projector if you are showing a video.',
      },
      offset: -80,
      category: 'venue',
      minDays: 14,
    },
    {
      key: 'attire_celebrant',
      title: {
        he: `לבחור ולהתאים תלבושת ${w.heTo}`,
        en: `Choose and fit an outfit for ${w.en}`,
      },
      notes: {
        he: 'בגיל הזה גדלים מהר, כדאי להשאיר זמן להתאמה אחרונה ולנעליים',
        en: 'Kids grow fast at this age, so leave time for a last fitting and shoes.',
      },
      offset: -75,
      category: 'attire',
      minDays: 21,
    },
    {
      key: 'print_order',
      title: {
        he: 'להזמין הדפסה של הזמנות, שלטים ותפריטים',
        en: 'Order printed invitations, signs and menus',
      },
      notes: {
        he: 'אם בוחרים גם הזמנות מודפסות, כדאי להזמין לפחות חודש וחצי מראש ולבקש הדמיה לפני ההדפסה',
        en: 'If you want printed invitations too, order at least six weeks ahead and ask for a proof first.',
      },
      offset: -75,
      category: 'design',
      minDays: 30,
    },
    {
      key: 'memory_video',
      title: { he: 'להכין סרטון או מצגת תמונות מהילדות', en: 'Make a childhood photo slideshow or video' },
      notes: {
        he: "לאסוף תמונות מהמשפחה ומהסבים, ולהעביר לדיג'יי או לצלם בפורמט שהם מבקשים",
        en: 'Collect photos from family and grandparents, and send them to the DJ in the format they ask for.',
      },
      offset: -45,
      minDays: 14,
    },
    {
      key: 'run_of_show',
      title: {
        he: 'לבנות סדר ערב עם הברכות והנאומים',
        en: 'Build the evening schedule, toasts and speeches',
      },
      notes: {
        he: "מי מברך, באיזה סדר ובאיזה אורך. לשתף את הדיג'יי ואת הצלם כדי שיהיו מוכנים לרגעים החשובים",
        en: 'Who speaks, in what order and for how long. Share it with the DJ and photographer so they are ready.',
      },
      offset: -21,
      minDays: 5,
      priority: 1,
    },
    {
      key: 'photo_list',
      title: { he: 'להעביר לצלם רשימת צילומים משפחתיים', en: 'Give the photographer a family shot list' },
      notes: {
        he: 'כך לא שוכחים את הסבים, הדודים והצילומים הקבוצתיים. כדאי לציין מי יעזור לאסוף את כולם',
        en: 'So no grandparent or group photo is forgotten. Name someone who can help gather everyone.',
      },
      offset: -14,
      category: 'photographer',
      minDays: 3,
    },
    {
      key: 'payment_terms',
      title: {
        he: 'לסכם עם כל ספק מתי ואיך משלמים את היתרה',
        en: 'Agree with each vendor when and how the balance is paid',
      },
      notes: {
        he: 'יש ספקים שמשלמים לפני האירוע ויש אחריו. כדאי להכין מראש מעטפות או העברות',
        en: 'Some vendors are paid before the event, some after. Prepare envelopes or transfers in advance.',
      },
      offset: -14,
      minDays: 3,
    },
    {
      key: 'delegate_roles',
      title: {
        he: 'לחלק תפקידים לקרובים ולחברים ליום האירוע',
        en: 'Assign day-of helpers among family and friends',
      },
      notes: {
        he: 'למשל מי מקבל את הספקים, מי אחראי על המתנות ומי מלווה את הסבים והסבתות',
        en: 'For example, who receives the vendors, who looks after gifts and who helps the grandparents.',
      },
      offset: -14,
      minDays: 3,
    },
    {
      key: 'gift_box',
      title: { he: 'להכין תיבה למעטפות וספר ברכות', en: 'Prepare a gift-envelope box and a guest book' },
      notes: {
        he: 'כדאי למנות אדם קרוב שאחראי על התיבה במהלך הערב',
        en: 'Appoint a trusted person to watch the box during the evening.',
      },
      offset: -12,
      minDays: 3,
    },
    {
      key: 'final_confirm_venue',
      title: {
        he: 'לאשר מול המקום והקייטרינג שעות, תפריט והקמה',
        en: 'Confirm hours, menu and setup with the venue and caterer',
      },
      notes: {
        he: 'לבקש לוח זמנים כתוב להקמה, להגשה ולפירוק, ולשמור את הטלפון של איש הקשר',
        en: "Ask for a written timeline for setup, service and teardown, and save the contact person's number.",
      },
      offset: -10,
      category: 'venue',
      minDays: 3,
      priority: 1,
    },
    {
      key: 'final_confirm_vendors',
      title: {
        he: "לאשר עם הצלם, הדיג'יי ושאר הספקים שעה וכתובת",
        en: 'Confirm time and address with the photographer, DJ and others',
      },
      notes: {
        he: 'לוודא שלכל ספק יש מספר טלפון אחד של אדם זמין ביום האירוע',
        en: 'Make sure every vendor has one phone number to call on the day.',
      },
      offset: -7,
      minDays: 2,
    },
    {
      key: 'day_of_ceremony',
      title: {
        he: 'להגיע מוקדם לטקס ולוודא שהכול מוכן',
        en: 'Arrive early at the ceremony and check everything is ready',
      },
      notes: pick(
        {
          he: 'טלית, תפילין אם מניחים, כיפות וחוברות. לבדוק שהמורה והצלם יודעים מתי מתחילים',
          en: 'Tallit, tefillin if you use them, kippot and booklets. Check the tutor and photographer know the start time.',
        },
        {
          he: "הנאום, התלבושת והציוד לטקס. לבדוק שהצלם, הדיג'יי ומי שמלווה יודעים מתי מתחילים",
          en: 'The speech, the outfit and ceremony items. Check the photographer, DJ and whoever leads know the start time.',
        },
      ),
      offset: 0,
      priority: 1,
    },
    {
      key: 'day_of_vendors',
      title: {
        he: 'לקבל את הספקים ולוודא שההקמה בזמן',
        en: 'Welcome the vendors and check setup is on schedule',
      },
      notes: {
        he: 'אדם אחד מהמשפחה מקבל את הספקים ויודע מה נקבע איתם',
        en: 'One family member receives the vendors and knows what was agreed.',
      },
      offset: 0,
    },
    {
      key: 'day_of_family_photo',
      title: {
        he: 'לקבוע רגע לתמונה משפחתית לפני שהאורחים מגיעים',
        en: 'Set aside a moment for a family photo before guests arrive',
      },
      notes: {
        he: 'זה לרוב הרגע השקט ביותר ביום. כדאי לתאם עם הצלם שעה מדויקת',
        en: 'It is usually the calmest moment of the day. Agree on an exact time with the photographer.',
      },
      offset: 0,
      category: 'photographer',
    },
    {
      key: 'day_of_collect',
      title: {
        he: 'למנות אדם שיאסוף מתנות וציוד בסוף הערב',
        en: 'Assign someone to gather gifts and belongings at the end',
      },
      notes: {
        he: 'התיבה, העוגה שנשארה, התלבושות והעיצוב שחוזרים הביתה',
        en: 'The gift box, leftover cake, outfits and decor that come home.',
      },
      offset: 0,
    },
    {
      key: 'return_rental',
      title: {
        he: 'להחזיר ציוד שהושכר ולאסוף חפצים שנשכחו',
        en: 'Return rented items and collect anything left behind',
      },
      offset: 1,
      category: 'venue',
    },
    {
      key: 'gift_tally',
      title: {
        he: 'לרשום מי הביא מתנה כדי להודות אישית',
        en: 'Note who gave a gift so you can thank them personally',
      },
      notes: {
        he: 'לצלם או לרשום את הכרטיסים והמעטפות לפני שהם הולכים לאיבוד',
        en: 'Photograph or list cards and envelopes before they get lost.',
      },
      offset: 2,
    },
    {
      key: 'thank_you_guests',
      title: { he: 'לשלוח הודעות תודה לאורחים', en: 'Send thank-you messages to guests' },
      notes: {
        he: `הודעה קצרה ואישית עם תמונה מהערב. נעים אם ${w.he} ${w.heWrites} כמה מהן בעצמ${bar ? 'ו' : 'ה'}`,
        en: `A short personal note with a photo from the evening. Nice if ${w.enPronoun} writes a few of them.`,
      },
      offset: 4,
    },
    {
      key: 'pay_balances',
      title: { he: 'לשלם יתרות לספקים ולסגור חשבונות', en: 'Pay vendor balances and close the accounts' },
      notes: {
        he: 'לשמור חשבוניות וקבלות, ולעדכן את התקציב בהוצאות בפועל',
        en: 'Keep invoices and receipts, and update the budget with actual costs.',
      },
      offset: 5,
      priority: 1,
    },
    {
      key: 'photos_collect',
      title: {
        he: 'לאסוף מהצלם את התמונות ולשתף עם המשפחה',
        en: 'Get the photos from the photographer and share with family',
      },
      notes: {
        he: 'אלבום משותף מאפשר לכל המשפחה להוסיף תמונות משלה',
        en: 'A shared album lets everyone add their own photos.',
      },
      offset: 8,
      category: 'photographer',
    },
  ];
}

/** What is only for the bar mitzvah: the reading, the tefillin and the aliyah. */
const barTasks: TemplateTask[] = [
  {
    key: 'bar_ceremony_place',
    title: {
      he: 'לתאם מקום ומועד לעלייה לתורה: בית כנסת, כותל או אחר',
      en: "Arrange the aliyah's place and time: synagogue, Kotel or elsewhere",
    },
    notes: {
      he: 'בכותל ובבתי כנסת רבים נרשמים מראש ויש הנחיות, כדאי לברר לפני שסוגרים אולם',
      en: 'The Kotel and many synagogues need advance booking and have guidelines. Check before locking in a hall.',
    },
    offset: -300,
    minDays: 60,
    priority: 1,
  },
  {
    key: 'bar_portion',
    title: {
      he: 'לברר את הפרשה, ההפטרה ומנהג הקריאה של המשפחה',
      en: "Find out the portion, haftarah and your family's reading custom",
    },
    notes: {
      he: 'הפרשה נקבעת לפי התאריך. המורה או הרב יעזרו לדעת כמה קוראים ובאיזה נוסח',
      en: 'The portion follows the date. A tutor or rabbi can tell you how much is read and in which tradition.',
    },
    offset: -285,
    minDays: 60,
  },
  {
    key: 'bar_tutor',
    title: { he: 'לסגור מורה לקריאה בתורה ולהפטרה', en: 'Book a tutor for the Torah and haftarah reading' },
    notes: {
      he: 'מתחילים בדרך כלל 8 עד 9 חודשים מראש, בשיעור שבועי. כדאי להתאים את הנוסח למשפחה',
      en: "Lessons usually start 8 to 9 months ahead, weekly. Match the reading tradition to your family's.",
    },
    offset: -270,
    category: 'officiant',
    minDays: 45,
    priority: 1,
  },
  {
    key: 'bar_tefillin',
    title: {
      he: 'לרכוש תפילין ולתאם לימוד הנחתן',
      en: 'Buy tefillin and arrange a lesson on putting them on',
    },
    notes: {
      he: 'אם זה מתאים לכם: לקנות אצל סופר סת״ם מוכר כחודשיים–שלושה מראש, כדי שיהיה זמן להתאמן',
      en: 'If it fits your family: buy from a reputable scribe two to three months ahead, so there is time to practice.',
    },
    offset: -120,
    category: 'other',
    minDays: 21,
  },
  {
    key: 'bar_tallit_kippah',
    title: { he: 'לבחור טלית וכיפה', en: 'Choose a tallit and kippah' },
    notes: {
      he: 'אפשר להעביר טלית משפחתית או לקנות חדשה. נוח לבחור יחד עם התלבושת',
      en: 'Pass down a family tallit or buy a new one. Easy to pick together with the outfit.',
    },
    offset: -70,
    category: 'attire',
    minDays: 14,
  },
  {
    key: 'bar_kiddush',
    title: {
      he: 'לתכנן קידוש או כיבוד קל אחרי העלייה לתורה',
      en: 'Plan a kiddush or light refreshments after the aliyah',
    },
    notes: {
      he: 'לברר במקום הטקס מי אחראי על הקידוש, מה מותר להכניס ומה הנחיות הכשרות',
      en: 'Ask at the ceremony location who handles the kiddush, what you may bring in, and the kashrut rules.',
    },
    offset: -45,
    category: 'catering',
    minDays: 14,
  },
  {
    key: 'bar_dvar_torah',
    title: {
      he: 'להכין דבר תורה או נאום של החוגג',
      en: "Prepare the bar mitzvah boy's dvar Torah or speech",
    },
    notes: {
      he: 'דבר תורה על הפרשה הוא המסורת, אבל גם נאום אישי על המשפחה או על נושא קרוב ללב מתאים',
      en: 'A dvar Torah on the portion is traditional, but a personal speech about family or a cause he cares about works too.',
    },
    offset: -40,
    minDays: 14,
    priority: 1,
  },
  {
    key: 'bar_roles',
    title: { he: 'לחלק כיבודים ועליות בין בני המשפחה', en: 'Assign Torah honors and aliyot among family' },
    notes: {
      he: 'כדאי לתאם עם הגבאי. פתיחת הארון, הגבהה וגלילה מתאימות גם לסבים ולחברים קרובים',
      en: 'Coordinate with the gabbai. Opening the ark, lifting and rolling the Torah also suit grandparents and close friends.',
    },
    offset: -30,
    minDays: 7,
  },
  {
    key: 'bar_ceremony_supplies',
    title: {
      he: 'להכין כיפות, חוברות ברכות וממתקים לטקס',
      en: 'Prepare kippot, blessing booklets and candy for the ceremony',
    },
    notes: {
      he: 'לברר במקום הטקס מה נהוג, למשל אם זורקים ממתקים ואילו נוסחים להדפיס',
      en: 'Check local custom at the ceremony location, such as candy throwing and which texts to print.',
    },
    offset: -14,
    category: 'other',
    minDays: 5,
  },
  {
    key: 'bar_rehearsal',
    title: { he: 'לעשות חזרה על הקריאה במקום הטקס', en: 'Rehearse the reading at the ceremony location' },
    notes: {
      he: 'קריאה עם המיקרופון ובמקום עצמו נותנת ביטחון. כדאי לתאם עם הגבאי או עם המורה',
      en: 'Reading at the actual spot, with the microphone, builds confidence. Coordinate with the gabbai or tutor.',
    },
    offset: -10,
    minDays: 3,
    priority: 1,
  },
];

/** What is only for the bat mitzvah: how the day is marked is the family's choice. */
const batTasks: TemplateTask[] = [
  {
    key: 'bat_how_to_mark',
    title: { he: 'לבחור עם החוגגת איך מציינים את היום', en: 'Decide with her how the day will be marked' },
    notes: {
      he: 'דבר תורה, פרויקט אישי, קריאה בתורה, טיול או מסיבה בלבד. אין דרך אחת נכונה, וחשוב מה מרגיש לה נכון',
      en: 'A dvar Torah, a personal project, a Torah reading, a trip or just a party. There is no single right way; what matters is what feels right to her.',
    },
    offset: -305,
    minDays: 30,
    priority: 1,
  },
  {
    key: 'bat_ceremony_place',
    title: {
      he: 'לברר אפשרויות לטקס ולתאם מקום ומועד',
      en: 'Explore ceremony options and arrange a place and time',
    },
    notes: {
      he: 'יש בתי כנסת, קהילות ותנועות שמקיימים טקסי בת מצווה. אפשר גם טקס פרטי בבית, בגן או בחוף',
      en: 'Some synagogues, communities and youth movements hold bat mitzvah ceremonies. A private one at home, in a garden or on the beach works too.',
    },
    offset: -280,
    minDays: 45,
  },
  {
    key: 'bat_mentor',
    title: {
      he: 'לסגור מורה או מנחה ללימוד לקראת היום',
      en: 'Book a teacher or mentor for the learning ahead of the day',
    },
    notes: {
      he: 'קריאה בתורה, לימוד פרשה או נושא לדבר תורה, לפי מה שהחוגגת בחרה',
      en: 'Torah reading, studying a portion, or a topic for a dvar Torah, depending on what she chose.',
    },
    offset: -250,
    category: 'other',
    minDays: 45,
    priority: 1,
  },
  {
    key: 'bat_project',
    title: {
      he: 'לתכנן פרויקט בת מצווה: התנדבות, יצירה או שורשים משפחתיים',
      en: 'Plan a bat mitzvah project: volunteering, art or family history',
    },
    notes: {
      he: 'בית הספר, התנועה או הקהילה מציעים לא פעם תוכנית מוכנה. אפשר גם לבחור פרויקט עצמאי',
      en: 'Schools, youth movements and communities often offer a program. She can also choose a project of her own.',
    },
    offset: -230,
    category: 'other',
    minDays: 60,
  },
  {
    key: 'bat_ceremony_leader',
    title: { he: 'לתאם מי ילווה או ינחה את הטקס', en: 'Arrange who will accompany or lead the ceremony' },
    notes: {
      he: 'רב, רבה, מורה או בן משפחה. אם הטקס בבית כנסת או בקהילה, מתאמים עם איש הקשר שם',
      en: 'A rabbi, a teacher or a family member. If it is in a synagogue or community, coordinate with its contact person.',
    },
    offset: -100,
    minDays: 21,
  },
  {
    key: 'bat_dvar_torah',
    title: {
      he: 'להכין דבר תורה, נאום או מצגת של החוגגת',
      en: 'Prepare her dvar Torah, speech or presentation',
    },
    notes: {
      he: 'כל פורמט מתאים: דבר תורה, סיפור אישי, מצגת, שיר או סרטון. לתרגל כמה פעמים מול המשפחה',
      en: 'Any format works: a dvar Torah, a personal story, slides, a song or a video. Practice a few times in front of family.',
    },
    offset: -40,
    minDays: 14,
    priority: 1,
  },
  {
    key: 'bat_makeup_hair',
    title: { he: 'לתאם איפור ותסרוקת ליום האירוע', en: 'Book hair and makeup for the day' },
    notes: {
      he: 'כדאי לעשות ניסיון קודם. לא כל חוגגת רוצה איפור, ולכן שווה לשאול אותה',
      en: 'A trial run helps. Not everyone wants makeup, so ask her first.',
    },
    offset: -30,
    category: 'makeup_hair',
    minDays: 10,
  },
  {
    key: 'bat_rehearsal',
    title: {
      he: 'לעשות חזרה על הטקס או על הנאום במקום עצמו',
      en: 'Rehearse the ceremony or speech at the actual location',
    },
    notes: {
      he: 'לעמוד על הבמה, לבדוק מיקרופון ולוודא שכולם יודעים מה התפקיד שלהם',
      en: 'Stand on the stage, test the microphone, and make sure everyone knows their part.',
    },
    offset: -10,
    minDays: 3,
  },
];

/** The budget, in percent. The two shares that differ are the ceremony (bar) and hair & makeup (bat). */
function categoriesFor(kind: Kind): TemplateCategory[] {
  return [
    { key: 'venue', pct: 22, basis: 'fixed' },
    { key: 'catering', pct: 26, basis: 'per_adult' },
    { key: 'bar', pct: 4, basis: 'per_guest' },
    { key: 'dj', pct: 11, basis: 'fixed' },
    { key: 'entertainment', pct: 3, basis: 'fixed' },
    { key: 'photographer', pct: 7, basis: 'fixed' },
    { key: 'videographer', pct: 3, basis: 'fixed' },
    { key: 'cakes_sweets', pct: 3, basis: 'fixed' },
    { key: 'design', pct: 4, basis: 'fixed' },
    { key: 'attire', pct: 6, basis: 'fixed' },
    { key: 'flowers', pct: 3, basis: 'fixed' },
    kind === 'bar'
      ? { key: 'officiant', pct: 3, basis: 'fixed' }
      : { key: 'makeup_hair', pct: 3, basis: 'fixed' },
    { key: 'other', pct: 5, basis: 'fixed' },
  ];
}

function build(kind: Kind): PlanTemplate {
  const key = kind === 'bar' ? 'bar_mitzvah' : 'bat_mitzvah';
  // stable sort: the road reads in the order of time
  const tasks = [...sharedTasks(kind), ...(kind === 'bar' ? barTasks : batTasks)].sort(
    (a, b) => a.offset - b.offset,
  );
  return {
    key,
    eventTypes: [key],
    size: 'full',
    tasks,
    categories: categoriesFor(kind),
    requiredVendors: ['venue', 'catering', 'photographer', 'dj'],
  };
}

export const barMitzvah: PlanTemplate = build('bar');
export const batMitzvah: PlanTemplate = build('bat');
