import type { LegalContext, LegalDoc } from './types';

/**
 * The cookie policy: every cookie and browser-storage key the site sets (all essential or remembering a
 * choice the visitor made), and the external content that loads only with consent. Kept in sync with
 * the code: `cookie_consent` (CookieConsent.client.tsx), `ui_lang` (lib/i18n), the Supabase session,
 * `badook:a11y` (a11y.ts), `badook:support` (SupportChat.client.tsx), `rsvp:<slug>` (RsvpForm),
 * `badook:guest:<slug>` (guest.client.tsx), `badook-faces:<token>` (faces/ui/FaceSearch.tsx) and
 * `badook-film:<id>` (film/client/choice.ts).
 */
export function cookiesDoc(c: LegalContext): LegalDoc {
  if (c.locale === 'en') {
    return {
      title: 'Cookie policy',
      description: `Which cookies ${c.brand} uses, why, and how to change your choice.`,
      intro: [
        'Cookies are small files a website keeps in your browser. We use only cookies the site needs in order to work, and the site’s own pages show external content (videos and maps from other companies) that you can turn off at any time. We do not use advertising or tracking cookies.',
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
            'A few choices are kept in your browser’s local storage, not sent to us with every visit:',
            {
              list: [
                '“badook:a11y”: your accessibility-menu settings.',
                '“badook:support” (for the visit only): your conversation with the support assistant, so it stays when you move between pages; it is erased when you close the tab.',
                '“rsvp:<invitation>”: on an invitation page, a guest’s own reply, so they can edit it later from the same device.',
                '“badook:guest:<invitation>” (for the visit only): who opened a personal invitation link, to greet them and fill in the form.',
                '“badook-faces:<gallery>” (for the visit only, and only where face search is on): the face code of a guest who searched the gallery for their photos, so their album stays while the tab is open; “Forget me” erases it at once (privacy policy, section 7C).',
                '“badook-film:<invitation>”: in the host’s app, their choices for the highlights film (the shots they pinned, removed and reordered, the length and the shape).',
              ],
            },
            'Invitation insights (privacy policy, section 7D) use no cookies and keep nothing in the browser.',
          ],
        },
        {
          id: 'external',
          heading: '3. External content',
          body: [
            'On the site’s pages, videos from YouTube (in its privacy-enhanced mode, youtube-nocookie.com) and Vimeo, and maps from Google, load by default — the home page’s background video and its live sample invitation among them. You can turn them off at any time: choose “Essential only” in the notice, or switch off external content in its settings; a still image then shows instead. These companies may set cookies of their own under their privacy policies.',
            'Invitations are the hosts’ own pages: a video or map a host added to an invitation loads when a guest opens it, in the same privacy-enhanced modes.',
          ],
        },
        {
          id: 'choice',
          heading: '4. Changing your choice',
          body: [
            'The “Cookie settings” link at the bottom of the site’s pages reopens the notice. You can also delete or block cookies in your browser’s settings; blocking essential cookies will stop signing in from working.',
          ],
        },
      ],
    };
  }
  return {
    title: 'מדיניות עוגיות',
    description: `באילו עוגיות ${c.brand} משתמשת, לשם מה, ואיך משנים את הבחירה.`,
    intro: [
      'עוגיות (Cookies) הן קבצים קטנים שאתר שומר בדפדפן שלכם. אנחנו משתמשים רק בעוגיות שהאתר צריך כדי לעבוד, ובעמודי האתר עצמו מוצג תוכן חיצוני (סרטונים ומפות של חברות אחרות) שאפשר לכבות בכל רגע. אנחנו לא משתמשים בעוגיות פרסום או מעקב.',
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
          'כמה בחירות נשמרות באחסון המקומי של הדפדפן, ולא נשלחות אלינו בכל ביקור:',
          {
            list: [
              '״badook:a11y״: ההגדרות שבחרתם בתפריט הנגישות.',
              '״badook:support״ (לביקור הנוכחי בלבד): השיחה שלכם עם עוזר התמיכה, כדי שתישאר כשעוברים בין עמודים; היא נמחקת כשסוגרים את הלשונית.',
              '״rsvp:<ההזמנה>״: בעמוד הזמנה, התשובה של האורח עצמו, כדי שיוכל לערוך אותה אחר כך מאותו מכשיר.',
              '״badook:guest:<ההזמנה>״ (לביקור הנוכחי בלבד): מי נכנס מקישור אישי, כדי לברך אותו בשמו ולמלא את הטופס.',
              '״badook-faces:<הגלריה>״ (לביקור הנוכחי בלבד, ורק היכן שהחיפוש לפי פנים מופעל): קוד הפנים של אורח שחיפש את התמונות שלו בגלריה, כדי שהאלבום שלו יישאר כל עוד הלשונית פתוחה; ״לשכוח אותי״ מוחק אותו מיד (מדיניות הפרטיות, סעיף 7ג).',
              '״badook-film:<ההזמנה>״: במערכת של המארח, הבחירות שלו לסרט הרגעים (הצילומים שנעץ, הוציא ושינה את הסדר שלהם, האורך והצורה).',
            ],
          },
          'נתוני ההזמנה (מדיניות הפרטיות, סעיף 7ד) לא משתמשים בעוגיות ולא שומרים שום דבר בדפדפן.',
        ],
      },
      {
        id: 'external',
        heading: '3. תוכן חיצוני',
        body: [
          'בעמודי האתר, סרטונים מ־YouTube (במצב הפרטיות המוגברת שלו, youtube-nocookie.com) ומ־Vimeo, ומפות מ־Google, נטענים כברירת מחדל, ביניהם סרטון הרקע של עמוד הבית וההזמנה לדוגמה. אפשר לכבות אותם בכל רגע: לבחור ״רק חיוניות״ בהודעה, או לכבות תוכן חיצוני בהגדרות שלה, ואז מוצגת תמונה במקומם. החברות האלה עשויות לשמור עוגיות משלהן לפי מדיניות הפרטיות שלהן.',
          'ההזמנות הן העמודים של המארחים: סרטון או מפה שמארח הוסיף להזמנה נטענים כשאורח פותח אותה, באותם מצבי פרטיות מוגברת.',
        ],
      },
      {
        id: 'choice',
        heading: '4. שינוי הבחירה',
        body: [
          'הקישור ״הגדרות עוגיות״ בתחתית עמודי האתר פותח שוב את ההודעה. אפשר גם למחוק או לחסום עוגיות בהגדרות הדפדפן; חסימת העוגיות החיוניות תמנע התחברות למערכת.',
        ],
      },
    ],
  };
}
