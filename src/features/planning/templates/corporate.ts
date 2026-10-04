import type { PlanTemplate } from '../model/types';

/** A company event: a team day, a holiday party or a launch — planned over about four months. */
export const corporate: PlanTemplate = {
  key: 'corporate',
  eventTypes: ['corporate'],
  size: 'light',
  tasks: [
    {
      key: 'define_goals',
      title: { he: 'להגדיר מטרות, קהל ומתכונת', en: 'Define goals, audience and format' },
      notes: {
        he: 'מה האירוע צריך להשיג, כמה משתתפים, והאם מוזמנים גם בני משפחה או אורחים.',
        en: 'What the event should achieve, how many attend and whether partners or guests are invited.',
      },
      offset: -120,
      priority: 1,
    },
    {
      key: 'budget_approval',
      title: { he: 'לקבל אישור תקציב', en: 'Get budget approval' },
      notes: {
        he: 'להציג הערכה לפי קטגוריות למי שמאשר, ולהשאיר רזרבה להוצאות בלתי צפויות.',
        en: 'Present a category estimate to the approver and keep a reserve for surprises.',
      },
      offset: -115,
      category: 'other',
      priority: 1,
    },
    {
      key: 'appoint_team',
      title: { he: 'למנות צוות הפקה ובעלי תפקידים', en: 'Appoint a production team and owners' },
      notes: {
        he: 'אחראי לכל תחום: ספקים, לוגיסטיקה, תקציב ותקשורת עם המשתתפים.',
        en: 'One owner per area: vendors, logistics, budget and attendee communication.',
      },
      offset: -105,
    },
    {
      key: 'book_venue',
      title: { he: 'לסגור מקום', en: 'Book the venue' },
      notes: {
        he: 'בדקו קיבולת, נגישות, חניה, שעות הקמה ופירוק, ואישורי בטיחות.',
        en: 'Check capacity, accessibility, parking, setup and teardown hours, and safety permits.',
      },
      offset: -100,
      category: 'venue',
      minDays: 60,
      priority: 1,
    },
    {
      key: 'book_catering',
      title: { he: 'לסגור קייטרינג ותפריט', en: 'Book catering and the menu' },
      notes: {
        he: 'התחשבו בכשרות, צמחונות, טבעונות ואלרגיות, ושאלו על העדפות מזון בטופס האישור.',
        en: 'Account for kosher, vegetarian, vegan and allergy needs, and ask about food preferences in the RSVP.',
      },
      offset: -85,
      category: 'catering',
      minDays: 45,
      priority: 1,
    },
    {
      key: 'draft_program',
      title: { he: 'לגבש תוכנית וסדר אירוע', en: 'Draft the program and run of show' },
      notes: {
        he: 'קבלת פנים, חלק רשמי, אוכל, פעילות וסיום, עם משך מוערך לכל חלק.',
        en: 'Welcome, formal part, food, activity and close, with an estimated length for each.',
      },
      offset: -80,
    },
    {
      key: 'book_host_speakers',
      title: { he: 'לסגור מנחה ודוברים', en: 'Book a host and speakers' },
      notes: {
        he: 'אשרו מוקדם תאריכים, והסכימו על נושא ומשך לכל דובר.',
        en: 'Confirm dates early and agree the topic and length with each speaker.',
      },
      offset: -75,
      category: 'host',
      minDays: 30,
    },
    {
      key: 'book_av_production',
      title: {
        he: 'לסגור הגברה, תאורה, מסכים ותפעול טכני',
        en: 'Book sound, lighting, screens and tech crew',
      },
      notes: {
        he: 'בקשו מהמקום את המפרט הטכני, ובדקו מה כבר כלול לפני שמזמינים ציוד.',
        en: 'Ask the venue for its tech spec and check what is included before renting equipment.',
      },
      offset: -70,
      category: 'production',
      minDays: 30,
    },
    {
      key: 'plan_activity',
      title: { he: 'לתכנן פעילות או בידור', en: 'Plan an activity or entertainment' },
      notes: {
        he: 'יום גיבוש, הפעלה, מוזיקה או הופעה: כדאי שיתאים לכל הגילאים והיכולות.',
        en: 'Team activity, music or a performance: make sure it suits all ages and abilities.',
      },
      offset: -65,
      category: 'entertainment',
      minDays: 30,
    },
    {
      key: 'arrange_transport',
      title: { he: 'לארגן הסעות וחניה', en: 'Arrange shuttles and parking' },
      notes: {
        he: 'בדקו נקודות איסוף, שעות חזרה, נגישות ואישורי חניה.',
        en: 'Check pickup points, return times, accessibility and parking permits.',
      },
      offset: -55,
      category: 'transport',
      minDays: 21,
    },
    {
      key: 'check_insurance_safety',
      title: { he: 'לוודא ביטוח, אישורים ובטיחות', en: 'Check insurance, permits and safety' },
      notes: {
        he: 'ביטוח אירוע, אישורי מקום, עזרה ראשונה ואבטחה, לפי גודל האירוע.',
        en: 'Event insurance, venue permits, first aid and security, depending on size.',
      },
      offset: -45,
      category: 'other',
      minDays: 21,
    },
    {
      key: 'order_branding',
      title: { he: 'להזמין שילוט, מיתוג ופריטי עיצוב', en: 'Order signage, branding and decor items' },
      notes: {
        he: 'שלט כניסה, תגי שם ומתנות לעובדים: כדאי לאשר הדפסות מוקדם.',
        en: 'Entrance signage, name badges and gifts: approve print proofs early.',
      },
      offset: -40,
      category: 'design',
      minDays: 21,
    },
    {
      key: 'send_logistics_message',
      title: { he: 'להכין הודעת לוגיסטיקה למשתתפים', en: 'Prepare a logistics message for attendees' },
      notes: {
        he: 'כתובת, שעות, הסעות, קוד לבוש וחניה בהודעה אחת ברורה.',
        en: 'Address, times, shuttles, dress code and parking in one clear message.',
      },
      offset: -10,
    },
    {
      key: 'tech_rehearsal',
      title: { he: 'לקיים חזרה טכנית ולאסוף מצגות', en: 'Hold a tech rehearsal and collect slides' },
      notes: {
        he: 'בדקו מיקרופונים, מסכים וסדר עלייה לבמה, ואספו את המצגות מראש.',
        en: 'Test microphones and screens, confirm speaking order and collect slides in advance.',
      },
      offset: -7,
      category: 'production',
    },
    {
      key: 'confirm_vendors',
      title: { he: 'לאשר עם הספקים לוח זמנים סופי', en: 'Confirm the final schedule with vendors' },
      notes: {
        he: 'שעות הקמה, איש קשר ביום האירוע, כתובת וגישה לרכבים.',
        en: 'Setup times, a day-of contact, address and vehicle access.',
      },
      offset: -5,
      priority: 1,
    },
    {
      key: 'send_thanks',
      title: { he: 'לשלוח תודה למשתתפים ולצוות', en: 'Send thanks to attendees and the team' },
      notes: {
        he: 'הודעה קצרה עם תמונות, וקישור לגלריה או למצגת סיכום.',
        en: 'A short message with photos and a link to a gallery or recap.',
      },
      offset: 1,
    },
    {
      key: 'send_feedback_survey',
      title: { he: 'לשלוח שאלון משוב קצר', en: 'Send a short feedback survey' },
      notes: {
        he: 'שלוש עד חמש שאלות מספיקות: מה עבד, מה לשפר ומה לחזור עליו.',
        en: 'Three to five questions are enough: what worked, what to improve and what to repeat.',
      },
      offset: 4,
    },
    {
      key: 'wrap_up_costs',
      title: {
        he: 'לסכם עלויות מול התקציב ולתעד לקחים',
        en: 'Reconcile costs with the budget and note lessons',
      },
      notes: {
        he: 'לסגור חשבוניות, להשוות להערכה ולשמור המלצות לאירוע הבא.',
        en: 'Close invoices, compare with the estimate and keep notes for the next event.',
      },
      offset: 10,
      category: 'other',
    },
  ],
  categories: [
    { key: 'venue', pct: 24, basis: 'fixed' },
    { key: 'catering', pct: 28, basis: 'per_guest' },
    { key: 'production', pct: 14, basis: 'fixed' },
    { key: 'host', pct: 8, basis: 'fixed' },
    { key: 'entertainment', pct: 6, basis: 'fixed' },
    { key: 'transport', pct: 8, basis: 'fixed' },
    { key: 'design', pct: 6, basis: 'fixed' },
    { key: 'other', pct: 6, basis: 'fixed' },
  ],
  requiredVendors: ['venue', 'catering'],
};
