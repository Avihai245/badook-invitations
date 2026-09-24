import type { LegalContext, LegalDoc } from './types';

/**
 * The privacy policy — under the Protection of Privacy Law, 5741-1981 (as amended, incl. Amendment 13),
 * the Privacy Protection (Data Security) Regulations, 5777-2017 and the regulations on transferring data
 * abroad. It says who holds the data, what is collected and why, whether it must be given, who receives
 * it, how long it is kept and how to use the rights to see, correct and delete it.
 */
export function privacyDoc(c: LegalContext): LegalDoc {
  const o = c.operator;
  if (c.locale === 'en') {
    const who = o.name ? `${o.name}${o.id ? ` (company no. ${o.id})` : ''}` : `the operator of ${c.brand}`;
    const reach = [
      o.email ? `email ${o.email}` : null,
      o.phone ? `phone ${o.phone}` : null,
      o.address ? `mail to ${o.address}` : null,
    ].filter(Boolean);
    return {
      title: 'Privacy policy',
      description: `How ${c.brand} collects, uses and protects personal information — of hosts and of their guests.`,
      intro: [
        `${c.brand} (the “Service”, at ${c.site}) lets hosts create digital invitations, send them and collect RSVPs. It is run by ${who} (“we”). This policy explains what information we collect, why, who receives it and what your rights are. It applies to the website, the hosts’ app and the invitation pages guests open.`,
        {
          note: 'In short: we use information only to run the Service, we never sell it, and hosts can delete their guest lists and replies at any time.',
        },
      ],
      sections: [
        {
          id: 'roles',
          heading: '1. Who is responsible for the information',
          body: [
            'For hosts’ accounts (name, email, phone, payments) we are the database owner and decide how that information is used.',
            'Guest details a host enters or uploads (a guest list) and the replies guests send are collected for the host: the host decides whom to invite and what to ask, and we store and process that information on the host’s behalf. Hosts are responsible for having the right to upload their guests’ details and to send them the invitation.',
          ],
        },
        {
          id: 'collect',
          heading: '2. What we collect',
          body: [
            {
              list: [
                'Account details: name, email address, phone number (optional) and a password, stored only as a secure hash. Signing in with Google gives us your name, email and profile picture from Google. An account opened for you by Badook Events (our events system) comes with the name, email and phone you gave it.',
                'What hosts create: event details, texts, photos, videos, songs and links they add to an invitation, and their settings.',
                'Guest lists: names, phone numbers and optionally email addresses, party size and group, uploaded from a file or typed in; plus each guest’s personal-link status (sent, delivered, read, opened).',
                'RSVPs: the name, phone and email a guest enters, whether they are coming and with how many people, dietary preferences, answers to the host’s questions and a message.',
                'Payments: the plan, amounts, dates and the payment provider’s transaction and subscription numbers. Card details are entered on the payment provider’s page and never reach us.',
                'Support: messages sent through the contact form, and questions asked in the support assistant.',
                'Technical information: IP address (kept only as a one-way hash, to stop spam and abuse), browser type, times of access, and error logs.',
              ],
            },
          ],
        },
        {
          id: 'use',
          heading: '3. Why we use it',
          body: [
            {
              list: [
                'to provide the Service: creating and publishing invitations, personal links, collecting and showing RSVPs, and sending invitations on WhatsApp when a host asks;',
                'to manage accounts, plans, payments and invoices;',
                'to send hosts service messages: sign-in and password emails, RSVP notifications and summaries they chose;',
                'to answer support requests;',
                'to keep the Service secure: preventing spam, fraud and abuse, and investigating failures;',
                'to meet legal obligations (for example, keeping accounting records);',
                'to improve the Service, using aggregated information that does not identify anyone.',
              ],
            },
            'We do not sell personal information, do not use guests’ details for our own marketing and do not show advertising.',
          ],
        },
        {
          id: 'duty',
          heading: '4. Do you have to give it',
          body: [
            'There is no legal obligation to give us any information. Some of it is needed to provide the Service: without an email address an account cannot be opened, and without a guest’s phone number an invitation cannot be sent to them on WhatsApp.',
          ],
        },
        {
          id: 'share',
          heading: '5. Who receives information',
          body: [
            'We share information only as needed to run the Service, with providers bound to keep it confidential and secure:',
            {
              list: [
                'Supabase — database, sign-in and file storage (servers in the European Union, Frankfurt);',
                'Amazon Web Services (AWS Amplify) — hosting the website;',
                'Meta (WhatsApp Business Platform) — when a host sends invitations on WhatsApp: the guest’s phone number, name and the invitation’s link;',
                'PayPlus — processing payments and issuing invoices;',
                'Resend — sending emails;',
                'Anthropic — answering questions in the support assistant (the text of the question only);',
                'Google (Maps), YouTube and Vimeo — maps and videos shown in invitations and on the site.',
              ],
            },
            'A host sees the replies of the guests they invited. We may also disclose information when the law or a court order requires it, or to protect the rights and safety of users and of the Service. If the Service is sold or merged, the information will pass to the new owner under this policy.',
            'Our storage and some providers are outside Israel (mainly in the European Union, whose data protection law is recognised as adequate). Transfers abroad follow the Privacy Protection (Transfer of Data to Databases Abroad) Regulations, 5761-2001.',
          ],
        },
        {
          id: 'security',
          heading: '6. How we protect it',
          body: [
            'We follow the Privacy Protection (Data Security) Regulations: encrypted connections (HTTPS), passwords stored as hashes, every account’s data separated at the database level, access limited to what each part of the system needs, and monitoring. No system is fully immune; if a serious incident happens we will act as the law requires, including notifying those affected where needed.',
          ],
        },
        {
          id: 'retention',
          heading: '7. How long we keep it',
          body: [
            {
              list: [
                'Account information: as long as the account is open.',
                'Invitations, guest lists and RSVPs: until the host deletes them, or deletes the account. Hosts can delete a guest, a reply or a whole invitation at any time.',
                'After an account is deleted its information is erased within 30 days, and from backups within 90 days.',
                'Payment and invoice records: seven years, as tax law requires.',
                'Hashed IP addresses used against abuse: up to 30 days.',
                'Messages sent through the contact form: up to two years.',
              ],
            },
          ],
        },
        {
          id: 'rights',
          heading: '8. Your rights',
          body: [
            'You may ask to see the information held about you, to have it corrected if it is wrong, incomplete or out of date, or to have it deleted (sections 13–14 of the Privacy Protection Law). Hosts can see, correct and delete most of their information in the app themselves.',
            'Guests: the information you gave in an RSVP was collected for the host who invited you, so it is best to ask them first; you may also contact us and we will pass the request on or handle it.',
            reach.length
              ? `To make a request, use the contact form, or: ${reach.join(', ')}. We will answer within 30 days.`
              : 'To make a request, use the contact form. We will answer within 30 days.',
          ],
        },
        {
          id: 'cookies',
          heading: '9. Cookies',
          body: [
            'We use essential cookies to run the site, and load external content (YouTube, Vimeo, Google Maps) on the site’s own pages only with your consent. The cookie policy has the details, and the “Cookie settings” link at the bottom of every page changes your choice.',
          ],
        },
        {
          id: 'children',
          heading: '10. Minors',
          body: [
            'Accounts are for people aged 18 and over. Guests of any age may reply to an invitation through the host who invited them.',
          ],
        },
        {
          id: 'changes',
          heading: '11. Changes',
          body: [
            'We may update this policy. The date of the last update appears at the top; significant changes will be announced on the site or by email to hosts.',
          ],
        },
        {
          id: 'contact',
          heading: '12. Contact',
          body: [
            [
              `${o.name || c.brand}`,
              o.address ? `address: ${o.address}` : null,
              o.email ? `email: ${o.email}` : null,
              o.phone ? `phone: ${o.phone}` : null,
            ]
              .filter(Boolean)
              .join(' · ') + '. Or through the contact form.',
          ],
        },
      ],
    };
  }

  const who = o.name ? `${o.name}${o.id ? ` (ח״פ ${o.id})` : ''}` : `מפעילת השירות ${c.brand}`;
  const reach = [
    o.email ? `במייל ${o.email}` : null,
    o.phone ? `בטלפון ${o.phone}` : null,
    o.address ? `בדואר ל${o.address}` : null,
  ].filter(Boolean);
  return {
    title: 'מדיניות פרטיות',
    description: `איך ${c.brand} אוספת, משתמשת ושומרת על מידע אישי של מארחים ושל האורחים שלהם.`,
    intro: [
      `${c.brand} (״השירות״, בכתובת ${c.site}) מאפשרת למארחים ליצור הזמנות דיגיטליות, לשלוח אותן ולקבל אישורי הגעה. את השירות מפעילה ${who} (״אנחנו״). המדיניות מסבירה איזה מידע אנחנו אוספים, לשם מה, למי הוא מועבר ומה הזכויות שלכם. היא חלה על האתר, על מערכת הניהול של המארחים ועל עמודי ההזמנות שהאורחים פותחים.`,
      {
        note: 'בקצרה: אנחנו משתמשים במידע רק כדי להפעיל את השירות, לא מוכרים אותו לאף אחד, ומארחים יכולים למחוק את רשימות המוזמנים והתשובות בכל רגע.',
      },
    ],
    sections: [
      {
        id: 'roles',
        heading: '1. מי אחראי על המידע',
        body: [
          'על המידע של חשבונות המארחים (שם, מייל, טלפון ותשלומים) אנחנו ״בעלי המאגר״, ואנחנו מחליטים איך משתמשים בו.',
          'פרטי מוזמנים שמארח מקליד או מעלה (רשימת מוזמנים), והתשובות שהאורחים שולחים, נאספים עבור המארח: הוא מחליט את מי להזמין ומה לשאול, ואנחנו שומרים ומעבדים את המידע בשמו. המארח אחראי לכך שמותר לו להעלות את פרטי המוזמנים ולשלוח להם את ההזמנה.',
        ],
      },
      {
        id: 'collect',
        heading: '2. איזה מידע אנחנו אוספים',
        body: [
          {
            list: [
              'פרטי חשבון: שם, כתובת מייל, מספר טלפון (לא חובה) וסיסמה, שנשמרת רק בצורה מוצפנת חד־כיוונית (hash). בכניסה עם Google אנחנו מקבלים מ־Google את השם, המייל ותמונת הפרופיל. חשבון שנפתח עבורכם דרך Badook Events (מערכת האירועים שלנו) מגיע עם השם, המייל והטלפון שמסרתם שם.',
              'מה שמארחים יוצרים: פרטי האירוע, טקסטים, תמונות, סרטונים, שירים וקישורים שמוסיפים להזמנה, וההגדרות שלה.',
              'רשימות מוזמנים: שמות, מספרי טלפון ולפעמים מיילים, כמות מוזמנים וקבוצה, מקובץ או בהקלדה; וגם הסטטוס של הקישור האישי של כל מוזמן (נשלח, נמסר, נקרא, נפתח).',
              'אישורי הגעה: השם, הטלפון והמייל שהאורח מקליד, אם הוא מגיע ועם כמה, העדפות תזונה, תשובות לשאלות של המארח וברכה.',
              'תשלומים: החבילה, הסכומים, התאריכים ומספרי העסקה והמנוי אצל חברת הסליקה. פרטי כרטיס האשראי מוקלדים בעמוד של חברת הסליקה ולא מגיעים אלינו.',
              'תמיכה: הודעות שנשלחות בטופס יצירת הקשר, ושאלות שנשאלות בעוזר התמיכה.',
              'מידע טכני: כתובת IP (נשמרת רק כגיבוב חד־כיווני, לחסימת ספאם ושימוש לרעה), סוג הדפדפן, זמני גישה ויומני תקלות.',
            ],
          },
        ],
      },
      {
        id: 'use',
        heading: '3. לשם מה אנחנו משתמשים במידע',
        body: [
          {
            list: [
              'להפעלת השירות: יצירה ופרסום של הזמנות, קישורים אישיים, קבלה והצגה של אישורי הגעה, ושליחת ההזמנה בוואטסאפ כשהמארח מבקש;',
              'לניהול החשבון, החבילות, התשלומים והחשבוניות;',
              'לשליחת הודעות שירות למארחים: מיילים של כניסה וסיסמה, והתראות וסיכומים על אישורי הגעה שבחרו לקבל;',
              'למענה לפניות תמיכה;',
              'לאבטחת השירות: מניעת ספאם, הונאות ושימוש לרעה, ובדיקת תקלות;',
              'לעמידה בחובות לפי דין (למשל שמירת רישומים חשבונאיים);',
              'לשיפור השירות, על סמך מידע מצטבר שאינו מזהה איש.',
            ],
          },
          'אנחנו לא מוכרים מידע אישי, לא משתמשים בפרטי המוזמנים לשיווק שלנו ולא מציגים פרסומות.',
        ],
      },
      {
        id: 'duty',
        heading: '4. האם חובה למסור את המידע',
        body: [
          'אין חובה חוקית למסור לנו מידע. חלק מהמידע נחוץ כדי לתת את השירות: בלי כתובת מייל אי אפשר לפתוח חשבון, ובלי מספר הטלפון של מוזמן אי אפשר לשלוח לו את ההזמנה בוואטסאפ.',
        ],
      },
      {
        id: 'share',
        heading: '5. למי המידע מועבר',
        body: [
          'אנחנו מעבירים מידע רק כשזה נחוץ להפעלת השירות, לספקים שמחויבים לשמור עליו בסודיות ובאבטחה:',
          {
            list: [
              'Supabase: מסד הנתונים, ההתחברות ואחסון הקבצים (שרתים באיחוד האירופי, פרנקפורט);',
              'Amazon Web Services (AWS Amplify): אירוח האתר;',
              'Meta (WhatsApp Business Platform): כשמארח שולח הזמנות בוואטסאפ, מועברים מספר הטלפון של המוזמן, השם שלו והקישור להזמנה;',
              'PayPlus: סליקת תשלומים והפקת חשבוניות;',
              'Resend: שליחת מיילים;',
              'Anthropic: מענה לשאלות בעוזר התמיכה (רק טקסט השאלה);',
              'Google (מפות), YouTube ו־Vimeo: מפות וסרטונים שמוצגים בהזמנות ובאתר.',
            ],
          },
          'מארח רואה את התשובות של האורחים שהזמין. נמסור מידע גם כשהחוק או צו של בית משפט מחייבים, או כדי להגן על הזכויות והביטחון של המשתמשים ושל השירות. אם השירות יימכר או יתמזג, המידע יעבור לבעלים החדשים לפי המדיניות הזו.',
          'האחסון שלנו וחלק מהספקים נמצאים מחוץ לישראל (בעיקר באיחוד האירופי, שדיני הגנת המידע בו מוכרים כראויים). העברת מידע לחו״ל נעשית לפי תקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה), התשס״א־2001.',
        ],
      },
      {
        id: 'security',
        heading: '6. אבטחת המידע',
        body: [
          'אנחנו פועלים לפי תקנות הגנת הפרטיות (אבטחת מידע), התשע״ז־2017: חיבור מוצפן (HTTPS), סיסמאות מוצפנות, הפרדה בין המידע של כל חשבון ברמת מסד הנתונים, הרשאות גישה מצומצמות לכל רכיב במערכת, וניטור. אין מערכת חסינה לחלוטין; אם יקרה אירוע אבטחה חמור, נפעל כפי שהדין מחייב, כולל הודעה למי שנפגע כשצריך.',
        ],
      },
      {
        id: 'retention',
        heading: '7. כמה זמן נשמר המידע',
        body: [
          {
            list: [
              'פרטי החשבון: כל עוד החשבון פתוח.',
              'הזמנות, רשימות מוזמנים ואישורי הגעה: עד שהמארח מוחק אותם או את החשבון. אפשר למחוק מוזמן, תשובה או הזמנה שלמה בכל רגע.',
              'אחרי מחיקת חשבון, המידע שלו נמחק תוך 30 יום, ומהגיבויים תוך 90 יום.',
              'רישומי תשלומים וחשבוניות: שבע שנים, כפי שדיני המס מחייבים.',
              'גיבובי כתובות IP לחסימת שימוש לרעה: עד 30 יום.',
              'הודעות מטופס יצירת הקשר: עד שנתיים.',
            ],
          },
        ],
      },
      {
        id: 'rights',
        heading: '8. הזכויות שלכם',
        body: [
          'אתם רשאים לבקש לעיין במידע שנשמר עליכם, לתקן אותו אם הוא לא נכון, לא שלם או לא מעודכן, או למחוק אותו (סעיפים 13–14 לחוק הגנת הפרטיות). את רוב המידע מארחים יכולים לראות, לתקן ולמחוק בעצמם במערכת.',
          'אורחים: המידע שמסרתם באישור הגעה נאסף עבור המארח שהזמין אתכם, ולכן כדאי לפנות אליו קודם. אפשר לפנות גם אלינו, ואנחנו נעביר את הבקשה או נטפל בה.',
          reach.length
            ? `לבקשות: בטופס יצירת הקשר, או ${reach.join(', ')}. נשיב תוך 30 יום.`
            : 'לבקשות: בטופס יצירת הקשר. נשיב תוך 30 יום.',
        ],
      },
      {
        id: 'cookies',
        heading: '9. עוגיות',
        body: [
          'אנחנו משתמשים בעוגיות חיוניות להפעלת האתר, ובעמודי האתר עצמו טוענים תוכן חיצוני (YouTube, Vimeo ומפות Google) רק בהסכמתכם. כל הפרטים במדיניות העוגיות, ובקישור ״הגדרות עוגיות״ בתחתית כל עמוד אפשר לשנות את הבחירה.',
        ],
      },
      {
        id: 'children',
        heading: '10. קטינים',
        body: ['פתיחת חשבון מיועדת לבני 18 ומעלה. אורחים בכל גיל יכולים להשיב להזמנה דרך המארח שהזמין אותם.'],
      },
      {
        id: 'changes',
        heading: '11. שינויים במדיניות',
        body: [
          'אנחנו עשויים לעדכן את המדיניות. תאריך העדכון האחרון מופיע בראש העמוד, ועל שינויים מהותיים נודיע באתר או במייל למארחים.',
        ],
      },
      {
        id: 'contact',
        heading: '12. יצירת קשר',
        body: [
          [
            `${o.name || c.brand}`,
            o.address ? `כתובת: ${o.address}` : null,
            o.email ? `מייל: ${o.email}` : null,
            o.phone ? `טלפון: ${o.phone}` : null,
          ]
            .filter(Boolean)
            .join(' · ') + '. או בטופס יצירת הקשר.',
        ],
      },
    ],
  };
}
