import { accountHe } from './account.he';
import { siteHe } from './site.he';

/**
 * Host-app UI strings (§8: zero hard-coded UI strings in components), Hebrew — the default UI language.
 * The invitation's own strings live in features/invitations/i18n; the editor language is independent of
 * the invitation's languages (§7.9). `{name}` placeholders go through fmt(); plural entries through plural().
 */
export const heCore = {
  brand: 'Badook',
  site: siteHe,
  accountPage: accountHe,
  common: {
    close: 'סגירה',
    cancel: 'ביטול',
    save: 'שמירה',
    delete: 'מחיקה',
    back: 'חזרה',
    next: 'המשך',
    retry: 'ניסיון חוזר',
    loading: 'טוען…',
    copy: 'העתקה',
    copied: 'הועתק',
    open: 'פתיחה',
    more: 'אפשרויות נוספות',
    optional: 'רשות',
    required: 'שדה חובה',
    error: 'משהו השתבש. נסו שוב בעוד רגע.',
    hebrew: 'עברית',
    english: 'English',
    both: 'שתיהן',
    toastLabel: 'התראה',
    /** "3 מבוגרים" / "ילד אחד" (KPI, emails) */
    adults: { one: 'מבוגר אחד', other: '{n} מבוגרים' },
    children: { one: 'ילד אחד', other: '{n} ילדים' },
    toastViewport: 'התראות ({hotkey})',
    /** the "?" next to an area's title: what each of its buttons does */
    helpLabel: 'הסבר על הכפתורים באזור הזה',
    helpTitle: 'מה כל כפתור עושה',
    people: { one: 'איש אחד', other: '{n} אנשים' },
  },
  /** the site's own "not found" and "something went wrong" pages */
  errorPages: {
    notFound: {
      metaTitle: 'העמוד לא נמצא',
      code: 'שגיאה 404',
      title: 'לא מצאנו את העמוד הזה',
      body: 'אולי הקישור לא מדויק, או שההזמנה נמחקה או שייכת לחשבון אחר.',
      toInvitations: 'לכל ההזמנות שלי',
      newInvitation: 'הזמנה חדשה',
      home: 'לדף הבית',
      login: 'כניסה לחשבון',
    },
    error: {
      title: 'משהו השתבש',
      body: 'זו תקלה אצלנו, לא אצלכם. נסו שוב בעוד רגע — ואם זה חוזר, העוזר שלנו או צוות התמיכה ישמחו לעזור.',
      retry: 'ניסיון חוזר',
      toInvitations: 'לכל ההזמנות שלי',
      contact: 'יצירת קשר',
      code: 'קוד התקלה: {code}',
    },
  },
  shell: {
    nav: {
      label: 'ניווט ראשי',
      invitations: 'האירועים שלי',
      newInvitation: 'אירוע חדש',
      billing: 'חבילה וחיובים',
      account: 'החשבון שלי',
      assistant: 'שאלו את העוזר',
      contact: 'יצירת קשר',
      /** the sidebar's help entry: opens the assistant */
      help: 'מדריך ועזרה',
      /** the admin console (staff only) */
      admin: 'ניהול המערכת',
      /** Badook Events, where hosts find a venue (opens in a new tab) */
      venues: 'מחפשים מקום לאירוע?',
      venuesHelp: 'אולמות, גנים ומקומות לאירועים ב־Badook Events. נפתח בלשונית חדשה.',
      newTab: '(נפתח בלשונית חדשה)',
    },
    /** the phones' bottom bar (short labels) */
    tabs: {
      label: 'ניווט',
      invitations: 'אירועים',
      newInvitation: 'חדש',
      billing: 'חבילה',
      help: 'עזרה',
    },
    /** the sidebar's small print: the legal pages */
    legal: 'מידע ומדיניות',
    signedInAs: 'מחוברים בתור',
    userMenu: 'תפריט החשבון',
    uiLanguage: 'שפת הממשק',
    /** the system's look (light / dark / as the device is set) */
    theme: { label: 'מראה', light: 'בהיר', dark: 'כהה', system: 'לפי המכשיר' },
    supportUnread: 'יש תשובה חדשה מהצוות',
    account: 'החשבון שלי',
    signOut: 'יציאה',
    skipToContent: 'דילוג לתוכן',
    invitationNav: {
      label: 'ניווט בהזמנה',
      edit: 'עריכה',
      guests: 'מוזמנים',
      responses: 'אישורי הגעה',
      share: 'שיתוף',
      back: 'כל ההזמנות',
    },
  },
  demoVideo: {
    label: 'Badook בארבעים וחמש שניות',
    watch: 'צפו עם קול',
    /** the full narrated tour (video/: TourLandscape) */
    tour: {
      title: 'סיור מלא במערכת',
      body: 'כל היכולות של Badook, צעד אחר צעד — מהאירוע החדש ועד הסרט שאחרי.',
      length: 'כ־{n} דקות',
      play: 'צפייה בסיור',
      captions: 'עברית',
    },
  },
  auth: {
    panelTitle: 'הזמנות שמרגשות את האורחים',
    panelBody: 'עיצוב, מוזיקה ואישורי הגעה — הכל במקום אחד, בעברית ובאנגלית.',
    loginTitle: 'כניסה',
    loginSubtitle: 'ברוכים השבים! היכנסו כדי לערוך ולשתף את ההזמנות שלכם.',
    signupTitle: 'יצירת חשבון',
    signupSubtitle: 'כמה שניות, ואפשר להתחיל לעצב הזמנה.',
    name: 'שם',
    email: 'אימייל',
    password: 'סיסמה',
    newPassword: 'סיסמה חדשה',
    passwordHint: 'לפחות 8 תווים',
    login: 'כניסה',
    signup: 'יצירת חשבון',
    noAccount: 'עוד אין לכם חשבון?',
    haveAccount: 'כבר יש לכם חשבון?',
    toSignup: 'להרשמה',
    toLogin: 'לכניסה',
    forgot: 'שכחתם סיסמה?',
    forgotTitle: 'איפוס סיסמה',
    forgotSubtitle: 'הזינו את האימייל של החשבון ונשלח קישור לבחירת סיסמה חדשה.',
    sendLink: 'שליחת קישור',
    linkSent: 'אם יש חשבון עם הכתובת הזו, שלחנו אליה קישור לאיפוס הסיסמה.',
    updateTitle: 'בחירת סיסמה חדשה',
    updateSubtitle: 'הזינו סיסמה חדשה לחשבון.',
    updatePassword: 'שמירת הסיסמה',
    checkEmailTitle: 'בדקו את תיבת המייל',
    checkEmail: 'שלחנו קישור לאישור החשבון אל {email}. לחצו עליו כדי להתחיל.',
    google: 'המשך עם Google',
    orEmail: 'או עם אימייל',
    errors: {
      invalid_credentials: 'האימייל או הסיסמה לא נכונים.',
      email_not_confirmed: 'עוד לא אישרתם את האימייל — חפשו את הקישור ששלחנו.',
      user_already_exists: 'כבר יש חשבון עם האימייל הזה. נסו להיכנס.',
      weak_password: 'הסיסמה קצרה מדי — לפחות 8 תווים.',
      invalid_email: 'כתובת האימייל לא תקינה.',
      rate_limited: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
      link_invalid: 'הקישור לא תקף או שפג תוקפו. בקשו קישור חדש.',
      oauth_failed: 'הכניסה עם Google לא הושלמה. נסו שוב, או היכנסו עם מייל וסיסמה.',
      session_missing: 'כדי לבחור סיסמה חדשה פתחו את הקישור מהמייל.',
      generic: 'משהו השתבש. נסו שוב בעוד רגע.',
      suspended: 'הכניסה לחשבון הזה הושעתה על ידי צוות Badook. לפרטים כתבו לנו דרך דף יצירת הקשר.',
    },
  },
  home: {
    soon: 'בקרוב: הזמנות דיגיטליות עם אישורי הגעה — בעברית ובאנגלית.',
    badge: 'הזמנות דיגיטליות בעברית ובאנגלית',
    title: 'הזמנות דיגיטליות',
    titleAccent: 'שמרגשות את האורחים',
    subtitle: 'בוחרים עיצוב, ממלאים פרטים ושולחים בוואטסאפ — עם פתיחה מונפשת, מוזיקה ואישורי הגעה במקום אחד.',
    start: 'יצירת הזמנה',
    login: 'כניסה',
    sample: 'לצפייה בהזמנה לדוגמה',
    trust: ['פתיחה מונפשת ומוזיקה', 'אישורי הגעה במקום אחד', 'שליחה בוואטסאפ'],
    how: {
      title: 'איך זה עובד',
      steps: [
        {
          title: 'בוחרים עיצוב',
          body: 'חתונה, בר/בת מצווה, ברית, יום הולדת — ועוד. לכל עיצוב טקסטים מוכנים.',
        },
        {
          title: 'ממלאים את הפרטים',
          body: 'שמות, תאריך, מקום, שיר או סרטון משלכם — ורואים את ההזמנה משתנה בזמן אמת.',
        },
        {
          title: 'שולחים ומקבלים תשובות',
          body: 'קישור לוואטסאפ עם תצוגה מקדימה יפה, והאישורים מגיעים ישר אליכם.',
        },
      ],
    },
    designs: {
      title: 'עיצובים לכל אירוע',
      subtitle: 'כל עיצוב עם פתיחה מונפשת, מוזיקה וטקסטים מוכנים — והכל ניתן לעריכה.',
      cta: 'לכל העיצובים',
    },
    features: {
      title: 'כל מה שהזמנה צריכה',
      opening: {
        title: 'פתיחה מונפשת ומוזיקה',
        body: 'מעטפה שנפתחת בלחיצה, שיר ברקע ומעבר חי בין עברית לאנגלית.',
      },
      rsvp: {
        title: 'אישורי הגעה במקום אחד',
        body: 'מי מגיע, כמה ילדים, העדפות תזונה — וייצוא לאקסל בלחיצה.',
      },
      share: { title: 'שליחה בוואטסאפ', body: 'קישור עם תצוגה מקדימה יפה, הודעה מוכנה וקוד QR.' },
      video: { title: 'תמונה או וידאו ברקע', body: 'העלו צילום או סרטון משלכם, או הדביקו קישור מיוטיוב.' },
      languages: { title: 'עברית ואנגלית', body: 'הזמנה אחת בשתי שפות — האורחים עוברים ביניהן בלחיצה.' },
      saveTheDate: { title: 'שמרו את התאריך', body: 'שלחו קודם Save the Date, ואחר כך את ההזמנה המלאה.' },
    },
    final: {
      title: 'מוכנים להזמין את האורחים?',
      body: 'ההזמנה הראשונה שלכם מוכנה תוך כמה דקות.',
    },
    footer: 'Badook · הזמנות דיגיטליות',
  },
};
