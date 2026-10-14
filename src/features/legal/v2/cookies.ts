import type { LegalContext, LegalDoc } from '../types';
import { contactLine } from './shared';

/**
 * The cookie policy, version 2: the same inventory as version 1 plus what the audit found missing —
 * the guest gallery's browser storage (device id, name, queue in IndexedDB, notice acknowledgement),
 * the family-review name, the theme and tour flags — and an accurate statement of the cookie notice
 * (external media loads until the visitor chooses "essential only"). Kept in sync with the code:
 * `cookie_consent` (CookieConsent.client.tsx), `ui_lang` (lib/i18n), the Supabase session,
 * `badook:a11y` (a11y.ts), `badook:support`, `rsvp:<slug>`, `badook:guest:<slug>`,
 * `badook-faces:<token>` (faces/ui/FaceSearch.tsx), `badook-film:<id>`, and the gallery's
 * `badook-gallery:*` keys and IndexedDB database (live-gallery/client).
 */
export function cookiesDoc(c: LegalContext): LegalDoc {
  if (c.locale === 'en') {
    return {
      title: 'Cookie policy',
      description: `Which cookies and browser storage ${c.brand} uses, why, and how to change your choice.`,
      intro: [
        'Cookies are small files a website keeps in your browser; browser storage (localStorage, sessionStorage and IndexedDB) does a similar job. We use only what the site needs in order to work or to remember a choice you made, and the site’s own pages show external content (videos and maps from other companies) that you can turn off at any time. We do not use advertising or tracking cookies.',
      ],
      sections: [
        {
          id: 'essential',
          heading: '1. Essential cookies (always on)',
          body: [
            {
              list: [
                '“sb-…-auth-token” (Supabase): keeps you signed in. Deleted when you sign out; renewed while you use the app.',
                '“ui_lang”: the interface language you chose. One year.',
                '“cookie_consent”: your choice in the cookie notice, so we don’t ask again. One year.',
              ],
            },
          ],
        },
        {
          id: 'storage',
          heading: '2. Storage in your browser',
          body: [
            'A few choices and working data are kept in your browser’s storage, not sent to us with every visit:',
            {
              list: [
                '“badook:a11y”: your accessibility-menu settings. “badook:theme”: light or dark appearance, where offered.',
                '“badook:support” (for the visit only): your conversation with the support assistant, so it stays when you move between pages; it is erased when you close the tab.',
                '“rsvp:<invitation>”: on an invitation page, a guest’s own reply, so they can edit it later from the same device.',
                '“badook:guest:<invitation>” (for the visit only): who opened a personal invitation link, to greet them and fill in the form.',
                '“badook:review:name”: on the family review page, the name a person typed for their comments, so they don’t type it again.',
                '“badook:review:key:<link>” and “badook:review:mine:<link>”: on the family review page, the secret key that lets a person delete their own comment and the list of their comments.',
                '“badook:lang:<invitation>” (for the visit only): the language a guest chose on an invitation page.',
                '“badook-station:<invitation>”: at the entrance station, the name the staff gave their station.',
                'A service worker (“/e/table-sw.js”) and the browser’s cache storage: on a guest’s table guide, the page and its scripts, kept on the phone for the evening so that it works without signal.',
                '“badook-film:<invitation>”: in the host’s app, their choices for the highlights film (the shots they pinned, removed and reordered, the length and the shape). Other small flags in the host’s app (for example that a tour was done) are kept the same way.',
                '“badook-faces:<gallery>” (for the visit only, and only where face search is on): the face code of a guest who searched the gallery for their photos, so their album stays while the tab is open; “Forget me” erases it at once (privacy policy, face search section).',
              ],
            },
            'Invitation insights (privacy policy, insights section) use no cookies and keep nothing in the browser.',
          ],
        },
        {
          id: 'gallery',
          heading: '3. The live gallery (guests)',
          body: [
            'When a guest uses an event’s gallery, their browser keeps, on that device only:',
            {
              list: [
                '“badook-gallery:uploader”: a random identifier of the device (in localStorage and IndexedDB). It lets the guest see and delete their own uploads. We keep only a one-way hash of it, different for each event; it is not your name or phone number.',
                '“badook-gallery:name” and “badook-gallery:instagram”: the display name and the optional handle you typed, so you don’t type them again. “badook-gallery:asked”: that you were already asked for a name.',
                '“badook-gallery:ack:<version>:<faces or nofaces>:<gallery>”: that you acknowledged the gallery notice (and whether face search was on in that gallery at the time), so it is not shown again for each upload (where the gallery notice is in force).',
                '“badook-gallery:seen:<gallery>”: which stories this device has already watched, to show them as seen.',
                'An IndexedDB database called “badook-gallery”: the uploads waiting to be sent (the prepared photo and video files included), the gallery’s access code if you typed one, and small settings, so that closing the page or losing the signal doesn’t lose anything. It is cleared as uploads finish; you can delete it in your browser’s settings (uploads that haven’t finished are then lost).',
              ],
            },
            'Deleting the browser’s data on that device removes the identifier, and with it the ability to delete your past uploads from that device — for those, use the report form or the privacy request form.',
          ],
        },
        {
          id: 'external',
          heading: '4. External content',
          body: [
            'On the site’s pages, videos from YouTube (in its privacy-enhanced mode, youtube-nocookie.com) and Vimeo, and maps from Google, load by default until you choose otherwise — the home page’s background video and its live sample invitation among them. You can turn them off at any time: choose “Essential only” in the notice, or switch off external content in its settings; a still image then shows instead. These companies may set cookies of their own under their privacy policies.',
            'Invitations are the hosts’ own pages: a video or map a host added to an invitation loads when a guest opens it, in the same privacy-enhanced modes, without the notice above.',
            'Payment is made in the payment provider’s form, shown inside the billing page; the provider may set cookies of its own when you pay. Signing in with Google takes you to Google’s page.',
          ],
        },
        {
          id: 'choice',
          heading: '5. Changing your choice',
          body: [
            'The “Cookie settings” link at the bottom of the site’s pages reopens the notice. You can also delete or block cookies and storage in your browser’s settings; blocking essential cookies will stop signing in from working, and blocking storage will stop the gallery from remembering your uploads.',
          ],
        },
        {
          id: 'contact',
          heading: '6. Contact',
          body: [contactLine(c)],
        },
      ],
    };
  }
  return {
    title: 'מדיניות עוגיות',
    description: `באילו עוגיות ואחסון דפדפן ${c.brand} משתמשת, לשם מה, ואיך משנים את הבחירה.`,
    intro: [
      'עוגיות (Cookies) הן קבצים קטנים שאתר שומר בדפדפן שלכם; אחסון הדפדפן (localStorage, sessionStorage ו־IndexedDB) ממלא תפקיד דומה. אנחנו משתמשים רק במה שהאתר צריך כדי לעבוד או כדי לזכור בחירה שעשיתם, ובעמודי האתר עצמו מוצג תוכן חיצוני (סרטונים ומפות של חברות אחרות) שאפשר לכבות בכל רגע. אנחנו לא משתמשים בעוגיות פרסום או מעקב.',
    ],
    sections: [
      {
        id: 'essential',
        heading: '1. עוגיות חיוניות (תמיד פעילות)',
        body: [
          {
            list: [
              '״sb-…-auth-token״ (Supabase): שומרת אתכם מחוברים. נמחקת ביציאה, ומתחדשת כל עוד אתם משתמשים במערכת.',
              '״ui_lang״: שפת הממשק שבחרתם. שנה.',
              '״cookie_consent״: הבחירה שלכם בהודעה על העוגיות, כדי שלא נשאל שוב. שנה.',
            ],
          },
        ],
      },
      {
        id: 'storage',
        heading: '2. אחסון בדפדפן',
        body: [
          'כמה בחירות ונתוני עבודה נשמרים באחסון של הדפדפן, ולא נשלחים אלינו בכל ביקור:',
          {
            list: [
              '״badook:a11y״: ההגדרות שבחרתם בתפריט הנגישות. ״badook:theme״: מראה בהיר או כהה, היכן שמוצע.',
              '״badook:support״ (לביקור הנוכחי בלבד): השיחה שלכם עם עוזר התמיכה, כדי שתישאר כשעוברים בין עמודים; היא נמחקת כשסוגרים את הלשונית.',
              '״rsvp:<ההזמנה>״: בעמוד הזמנה, התשובה של האורח עצמו, כדי שיוכל לערוך אותה אחר כך מאותו מכשיר.',
              '״badook:guest:<ההזמנה>״ (לביקור הנוכחי בלבד): מי נכנס מקישור אישי, כדי לברך אותו בשמו ולמלא את הטופס.',
              '״badook:review:name״: בעמוד העיון של המשפחה, השם שאדם הקליד להערות שלו, כדי שלא יקליד אותו שוב.',
              '״badook:review:key:<הקישור>״ ו־״badook:review:mine:<הקישור>״: בעמוד העיון של המשפחה, המפתח הסודי שמאפשר לאדם למחוק את ההערה שלו ורשימת ההערות שלו.',
              '״badook:lang:<ההזמנה>״ (לביקור הנוכחי בלבד): השפה שאורח בחר בעמוד הזמנה.',
              '״badook-station:<ההזמנה>״: בעמדת הכניסה, השם שהצוות נתן לעמדה.',
              'Service Worker (״/e/table-sw.js״) ואחסון המטמון של הדפדפן: במדריך השולחן של האורח, העמוד והסקריפטים שלו נשמרים בטלפון לערב האירוע, כדי שיעבוד גם בלי קליטה.',
              '״badook-film:<ההזמנה>״: במערכת של המארח, הבחירות שלו לסרט הרגעים (הצילומים שנעץ, הוציא ושינה את הסדר שלהם, האורך והצורה). סימונים קטנים אחרים במערכת של המארח (למשל שסיור הושלם) נשמרים כך.',
              '״badook-faces:<הגלריה>״ (לביקור הנוכחי בלבד, ורק היכן שהחיפוש לפי פנים מופעל): קוד הפנים של אורח שחיפש את התמונות שלו בגלריה, כדי שהאלבום שלו יישאר כל עוד הלשונית פתוחה; ״לשכוח אותי״ מוחק אותו מיד (מדיניות הפרטיות, סעיף חיפוש לפי פנים).',
            ],
          },
          'נתוני ההזמנה (מדיניות הפרטיות, סעיף נתוני ההזמנה) לא משתמשים בעוגיות ולא שומרים שום דבר בדפדפן.',
        ],
      },
      {
        id: 'gallery',
        heading: '3. הגלריה החיה (אורחים)',
        body: [
          'כשאורח משתמש בגלריה של אירוע, הדפדפן שלו שומר, במכשיר הזה בלבד:',
          {
            list: [
              '״badook-gallery:uploader״: מזהה אקראי של המכשיר (ב־localStorage וב־IndexedDB). הוא מאפשר לאורח לראות ולמחוק את ההעלאות שלו. אנחנו שומרים רק גיבוב חד־כיווני שלו, שונה לכל אירוע; הוא אינו שמכם או מספר הטלפון שלכם.',
              '״badook-gallery:name״ ו־״badook-gallery:instagram״: שם התצוגה והכינוי האופציונלי שהקלדתם, כדי שלא תקלידו אותם שוב. ״badook-gallery:asked״: שכבר נשאלתם על שם.',
              '״badook-gallery:ack:<גרסה>:<faces או nofaces>:<הגלריה>״: שאישרתם את הודעת הגלריה (ואם חיפוש לפי פנים היה פועל בגלריה באותו זמן), כדי שלא תוצג שוב בכל העלאה (היכן שהודעת הגלריה בתוקף).',
              '״badook-gallery:seen:<הגלריה>״: אילו סטוריז המכשיר הזה כבר צפה בהם, כדי להציג אותם כנצפו.',
              'מסד IndexedDB בשם ״badook-gallery״: ההעלאות שממתינות לשליחה (כולל קבצי התמונות והסרטונים המוכנים), קוד הגישה של הגלריה אם הקלדתם, והגדרות קטנות, כדי שסגירת העמוד או איבוד קליטה לא יאבדו דבר. הוא מתרוקן ככל שההעלאות מסתיימות; אפשר למחוק אותו בהגדרות הדפדפן (העלאות שלא הסתיימו יאבדו).',
            ],
          },
          'מחיקת נתוני הדפדפן במכשיר הזה מסירה את המזהה, ואיתו את היכולת למחוק מאותו מכשיר העלאות קודמות — לכך השתמשו בטופס הדיווח או בטופס בקשות הפרטיות.',
        ],
      },
      {
        id: 'external',
        heading: '4. תוכן חיצוני',
        body: [
          'בעמודי האתר, סרטונים מ־YouTube (במצב הפרטיות המוגברת שלו, youtube-nocookie.com) ומ־Vimeo, ומפות מ־Google, נטענים כברירת מחדל עד שתבחרו אחרת, ביניהם סרטון הרקע של עמוד הבית וההזמנה לדוגמה. אפשר לכבות אותם בכל רגע: לבחור ״רק חיוניות״ בהודעה, או לכבות תוכן חיצוני בהגדרות שלה, ואז מוצגת תמונה במקומם. החברות האלה עשויות לשמור עוגיות משלהן לפי מדיניות הפרטיות שלהן.',
          'ההזמנות הן העמודים של המארחים: סרטון או מפה שמארח הוסיף להזמנה נטענים כשאורח פותח אותה, באותם מצבי פרטיות מוגברת, בלי ההודעה שלמעלה.',
          'התשלום נעשה בטופס של חברת התשלומים, שמוצג בתוך עמוד החיובים; החברה עשויה לשמור עוגיות משלה בזמן התשלום. התחברות עם Google מעבירה אתכם לעמוד של Google.',
        ],
      },
      {
        id: 'choice',
        heading: '5. שינוי הבחירה',
        body: [
          'הקישור ״הגדרות עוגיות״ בתחתית עמודי האתר פותח שוב את ההודעה. אפשר גם למחוק או לחסום עוגיות ואחסון בהגדרות הדפדפן; חסימת העוגיות החיוניות תמנע התחברות למערכת, וחסימת האחסון תמנע מהגלריה לזכור את ההעלאות שלכם.',
        ],
      },
      {
        id: 'contact',
        heading: '6. יצירת קשר',
        body: [contactLine(c)],
      },
    ],
  };
}
