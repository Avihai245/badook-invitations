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
                'A do-not-send list: phone numbers that asked our WhatsApp number to stop (a “STOP” reply, or turning off marketing messages from us in WhatsApp), with the date. We keep it so that no host sends to them again from that number.',
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
                'Anthropic — answering questions in the support assistant (the text of the question only), and, when the host’s plan includes it, the automatic check of photos uploaded to an event’s live gallery (a small thumbnail of the photo only);',
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
                'Payment and invoice records: kept by our payment provider (PayPlus) for seven years, as tax law requires; the copies in our own system are erased with the account.',
                'Hashed IP addresses used against abuse: up to 30 days.',
                'Messages sent through the contact form: up to two years.',
                'The do-not-send list: as long as our WhatsApp number sends invitations, so the request keeps being honoured. Its owner can ask to be removed from it through the contact form.',
              ],
            },
          ],
        },
        {
          id: 'gallery',
          heading: '7A. The live gallery: photos and videos guests upload',
          body: [
            'A host whose plan includes it can open a live gallery for an event: guests open a link or scan a QR code the host shares and upload photos and videos from their phone, without an account. The host may add an access code and a time window for uploads. The uploads are collected for the host, like a guest list (section 1).',
            {
              list: [
                'What is kept: the photos and videos themselves (the original file, plus a smaller copy and a thumbnail the guest’s phone makes), their size, dimensions, length, and the time they were taken as the file records it. Location (GPS) details are removed from JPEG photos before they are uploaded; other files (such as HEIC photos and videos) are kept as the phone made them and may include the location it recorded. A name the guest chooses to add is shown with their uploads. So that guests can see and delete their own uploads, their device keeps a random identifier, which we keep only as a one-way hash, separate for each event.',
                'Automatic checks: the guest’s phone checks each photo for blur, darkness and duplicates. When the host’s plan includes the automatic content check, the photo’s small thumbnail only (no names or other details) is sent to Anthropic, which returns scores for inappropriate content and for quality. A suspicious upload waits for the host’s approval.',
                'Who sees them: anyone with the gallery’s link (and its access code, if set) sees the published photos and videos, and so does the event’s screen at the venue if the host uses one. The host sees everything, including uploads waiting for approval or rejected and the checks’ results, and can download all the files. The host decides what is published and is responsible for how they share and use the photos.',
                'Storage: private storage (Supabase, European Union). Pages receive links to the files that expire after a few hours.',
                'Deleting: a guest can delete their own upload from the same device at any time; the host can delete any photo or video, or the whole gallery. The files are then removed from storage, usually within minutes.',
                'How long: until the host deletes them, the gallery, the invitation or the account (then as in section 7). Uploads that were never finished are erased after two days, and the records of deleted items after 30 days.',
                'The gallery does not use face recognition.',
              ],
            },
            'A guest who wants a photo of them removed can ask the host, or contact us (section 8).',
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
            'We use essential cookies to run the site. External content on the site’s own pages (videos from YouTube in its privacy-enhanced mode, Vimeo, Google Maps) loads by default, and you can turn it off at any time. The cookie policy has the details, and the “Cookie settings” link at the bottom of the site’s pages changes your choice.',
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
              'רשימת ״לא לשלוח״: מספרי טלפון שביקשו מהמספר שלנו בוואטסאפ להפסיק (תשובת ״הסר״ או STOP, או כיבוי הודעות שיווק מאיתנו בוואטסאפ), עם התאריך. אנחנו שומרים אותה כדי שאף מארח לא ישלח אליהם שוב מהמספר הזה.',
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
              'Anthropic: מענה לשאלות בעוזר התמיכה (רק טקסט השאלה), וכשהחבילה של המארח כוללת את זה, הבדיקה האוטומטית של תמונות שמועלות לגלריה החיה של אירוע (רק תמונה ממוזערת של התמונה);',
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
              'רישומי תשלומים וחשבוניות: נשמרים אצל ספק התשלומים שלנו (PayPlus) שבע שנים, כפי שדיני המס מחייבים; העותקים במערכת שלנו נמחקים עם החשבון.',
              'גיבובי כתובות IP לחסימת שימוש לרעה: עד 30 יום.',
              'הודעות מטופס יצירת הקשר: עד שנתיים.',
              'רשימת ״לא לשלוח״: כל עוד המספר שלנו בוואטסאפ שולח הזמנות, כדי שהבקשה תמשיך להיות מכובדת. בעל המספר יכול לבקש להסיר אותו מהרשימה בטופס יצירת הקשר.',
            ],
          },
        ],
      },
      {
        id: 'gallery',
        heading: '7א. הגלריה החיה: תמונות וסרטונים שאורחים מעלים',
        body: [
          'מארח שהחבילה שלו כוללת את זה יכול לפתוח לאירוע גלריה חיה: האורחים פותחים קישור או סורקים קוד QR שהמארח משתף, ומעלים מהטלפון תמונות וסרטונים, בלי להירשם. המארח יכול להוסיף קוד גישה ולקבוע חלון זמן להעלאות. ההעלאות נאספות עבור המארח, כמו רשימת המוזמנים (סעיף 1).',
          {
            list: [
              'מה נשמר: התמונות והסרטונים עצמם (הקובץ המקורי, ועותק מוקטן ותמונה ממוזערת שהטלפון של האורח מכין), הגודל, המידות, האורך ומועד הצילום כפי שהקובץ רושם אותו. מתמונות JPEG מוסרים פרטי המיקום (GPS) עוד לפני ההעלאה; קבצים אחרים (למשל תמונות HEIC וסרטונים) נשמרים כפי שהטלפון יצר אותם, ועשויים לכלול את המיקום שהוא רשם. שם שהאורח בוחר להוסיף מוצג ליד מה שהעלה. כדי שאורחים יוכלו לראות ולמחוק את מה שהעלו, נשמר במכשיר שלהם מזהה אקראי, ואצלנו הוא נשמר רק כגיבוב חד־כיווני, נפרד לכל אירוע.',
              'בדיקות אוטומטיות: הטלפון של האורח בודק כל תמונה (חדות, חושך וכפילויות). כשהחבילה של המארח כוללת בדיקת תוכן אוטומטית, רק התמונה הממוזערת (בלי שמות ובלי פרטים אחרים) נשלחת ל־Anthropic, שמחזירה ציון לתוכן לא הולם ולאיכות. העלאה חשודה ממתינה לאישור המארח.',
              'מי רואה: כל מי שיש לו את הקישור לגלריה (ואת קוד הגישה, אם נקבע) רואה את התמונות והסרטונים שפורסמו, וכך גם מסך האירוע באולם, אם המארח משתמש בו. המארח רואה הכל, גם העלאות שממתינות לאישור או שנדחו ואת תוצאות הבדיקות, ויכול להוריד את כל הקבצים. המארח מחליט מה מתפרסם, והוא אחראי לאופן שבו הוא משתף את התמונות ומשתמש בהן.',
              'אחסון: באחסון פרטי (Supabase, באיחוד האירופי). העמודים מקבלים קישורים לקבצים שתוקפם פג אחרי כמה שעות.',
              'מחיקה: אורח יכול למחוק בכל רגע, מאותו מכשיר, את מה שהעלה; המארח יכול למחוק כל תמונה או סרטון, או את הגלריה כולה. הקבצים נמחקים אז מהאחסון, בדרך כלל תוך דקות.',
              'כמה זמן: עד שהמארח מוחק אותם, את הגלריה, את ההזמנה או את החשבון (ואז כמו בסעיף 7). העלאות שלא הושלמו נמחקות אחרי יומיים, והרישומים של פריטים שנמחקו אחרי 30 יום.',
              'הגלריה לא משתמשת בזיהוי פנים.',
            ],
          },
          'אורח שרוצה שתמונה שלו תוסר יכול לבקש זאת מהמארח, או לפנות אלינו (סעיף 8).',
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
          'אנחנו משתמשים בעוגיות חיוניות להפעלת האתר. תוכן חיצוני בעמודי האתר עצמו (סרטונים מ־YouTube במצב הפרטיות המוגברת שלו, Vimeo ומפות Google) נטען כברירת מחדל, ואפשר לכבות אותו בכל רגע. כל הפרטים במדיניות העוגיות, ובקישור ״הגדרות עוגיות״ בתחתית עמודי האתר אפשר לשנות את הבחירה.',
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
