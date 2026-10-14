/** The account screen (/app/account) — Hebrew. */
export const accountHe = {
  metaTitle: 'החשבון שלי',
  title: 'החשבון שלי',
  subtitle: 'הפרטים שלכם, איך אתם נכנסים, והחבילה.',
  profile: 'פרטים אישיים',
  fullName: 'שם מלא',
  phone: 'טלפון',
  phoneHint:
    'לא חובה. ישמש רק ליצירת קשר איתכם בנושא החשבון — וגם להתראה בוואטסאפ אם שליחה מתוזמנת לאורחים לא יצאה.',
  email: 'מייל',
  signIn: 'כניסה',
  providers: { email: 'מייל וסיסמה', google: 'Google', partner: 'Badook Events' },
  save: 'שמירה',
  saved: 'הפרטים נשמרו',
  badPhone: 'מספר הטלפון לא תקין',
  plan: 'החבילה',
  planLink: 'לחבילה ולחיובים',
  password: 'שינוי סיסמה',
  passwordLink: 'לשינוי הסיסמה',
  danger: 'מחיקת החשבון',
  dangerBody:
    'מחיקת החשבון מוחקת לצמיתות את כל ההזמנות, רשימות המוזמנים, אישורי ההגעה והקבצים שהעליתם, ומפסיקה את המנוי. הזמנות שפורסמו יפסיקו לעבוד מיד. אי אפשר לבטל את זה.',
  delete: 'מחיקת החשבון',
  confirmTitle: 'למחוק את החשבון לצמיתות?',
  confirmCheck: 'הבנתי שכל ההזמנות, המוזמנים והתשובות יימחקו ולא יהיה אפשר לשחזר אותם.',
  confirm: 'מחיקה לצמיתות',
  keep: 'ביטול',
  deleting: 'מוחק…',
  error: 'משהו השתבש. נסו שוב בעוד רגע.',
  help: {
    save: 'שומר את השם והטלפון בחשבון.',
    delete: 'מוחק לצמיתות את החשבון וכל מה שבו.',
  },
  /** The sign-in and sign-up pages: messages and lines beyond app.he.ts's `auth`. */
  auth: {
    errors: {
      link_expired: 'הקישור פג תוקף או שכבר השתמשו בו. היכנסו לחשבון, או בקשו קישור חדש ב"שכחתם סיסמה?".',
      other_browser: 'את הקישור צריך לפתוח באותו דפדפן שבו ביקשתם אותו. אפשר לבקש כאן קישור חדש.',
      terms_required: 'כדי להירשם צריך לאשר את תנאי השימוש ואת מדיניות הפרטיות.',
    },
    notices: {
      email_confirmed: 'כתובת המייל אושרה. היכנסו כדי להמשיך.',
      deleted: 'החשבון נמחק, יחד עם כל ההזמנות והמידע שבו.',
      deleted_charge:
        'החשבון נמחק. את החיוב החודשי לא הצלחנו לעצור אוטומטית: הצוות שלנו קיבל התראה ויעצור אותו ידנית. אם תחויבו בכל זאת, כתבו לנו.',
    },
    contact: 'יצירת קשר',
    terms: 'בהרשמה אתם מסכימים ל{terms} ול{privacy}.',
    termsLink: 'תנאי השימוש',
    privacyLink: 'מדיניות הפרטיות',
    /** version 2 of the legal documents: an unticked box instead of the line above */
    accept: 'קראתי ואני מאשר/ת את {terms} ואת {privacy}.',
    acceptTerms: 'תנאי השימוש',
    acceptPrivacy: 'מדיניות הפרטיות',
    newTab: '(נפתח בלשונית חדשה)',
    continue: {
      title: 'כניסה ל־Badook',
      subtitle: 'הקישור שלכם מ־Badook Events מוכן. לחצו כדי להיכנס להזמנות שלכם.',
      button: 'המשך ל־Badook',
      note: 'הקישור עובד פעם אחת בלבד.',
    },
  },
};
