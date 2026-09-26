import type { LegalContext, LegalDoc } from './types';

/**
 * The accessibility statement, as the Equal Rights for Persons with Disabilities (Service
 * Accessibility Adjustments) Regulations, 5773-2013 (reg. 35) require: the standard (IS 5568, based on
 * WCAG 2.0 AA; we aim at WCAG 2.1 AA), what was made accessible, known limitations, the accessibility
 * coordinator's details and the date of the last review.
 */
export function accessibilityDoc(c: LegalContext): LegalDoc {
  const a = c.a11y;
  if (c.locale === 'en') {
    const coordinator = [
      a.name ? `Accessibility coordinator: ${a.name}` : 'Accessibility coordinator',
      a.phone ? `phone ${a.phone}` : null,
      a.email ? `email ${a.email}` : c.operator.email ? `email ${c.operator.email}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      title: 'Accessibility statement',
      description: `How ${c.brand} is made accessible, known limitations, and how to reach our accessibility coordinator.`,
      intro: [
        `We believe everyone should be able to create, send and open an invitation. ${c.brand} is built to be accessible to people with disabilities, following the Equal Rights for Persons with Disabilities Law and its Service Accessibility Regulations (2013).`,
      ],
      sections: [
        {
          id: 'standard',
          heading: '1. The standard',
          body: [
            'The site aims to meet Israeli Standard IS 5568 (based on the W3C’s WCAG 2.0 guidelines) at level AA, and the WCAG 2.1 AA guidelines wherever possible. The website and the hosts’ app are in Hebrew (right to left) and English.',
          ],
        },
        {
          id: 'done',
          heading: '2. What we have done',
          body: [
            {
              list: [
                'Every part can be used with a keyboard alone, with a visible focus indicator; the site’s pages and the app’s main screens open with a “skip to content” link.',
                'Semantic structure (headings, lists, landmarks, tables) and accessible names for buttons and fields, for screen readers such as NVDA, JAWS and VoiceOver.',
                'Contrast between text and background meets level AA; information is never given by colour alone.',
                'Text can be enlarged up to 200% without losing content; pages adapt to phones and tablets.',
                'Form fields have labels, errors are described in words and announced, and the first error receives the focus.',
                'Moving content can be stopped: the home page’s background video has a pause button, invitations have a “pause the animations” button (their background video, particles and drawn loops stop where they are), and animations stop for visitors whose device asks for reduced motion.',
                'An accessibility menu (the round button floating on the left of every page of the site and the app): larger text, high contrast, highlighted links, a readable font, line spacing, stopping animations and a large cursor.',
                'Each area of the app has a “?” button that explains what every button there does.',
                'Invitations: the opening animation can be skipped, and while the envelope is closed the keyboard stays on it; music starts only after the guest taps and can be turned off; and the RSVP form is fully keyboard- and screen-reader-accessible.',
                'Invitations can be read aloud (“Listen”, when the host’s package includes it) in the language shown — a recorded voice, or the device’s own — and the music stops meanwhile.',
                'Videos that hosts upload can have captions in each language of the invitation (uploaded or typed); the editor reminds hosts when a video with speech has none.',
                'The page families use to comment on a draft works with a keyboard and a screen reader: a comment can be placed on a part chosen from a list, and every pin is a named button.',
              ],
            },
          ],
        },
        {
          id: 'checked',
          heading: '3. How we checked',
          body: [
            `On ${c.updated} the guest’s side was checked against WCAG 2.1 AA. An automated audit (axe-core, the WCAG 2.0 and 2.1 A and AA rules) covered the opening screen and every section of several invitation designs (a classic, a photographic, two drawn and a dark one), the RSVP form with its errors and its confirmation, a save-the-date, a guest’s table guide, the entrance station, the live gallery’s upload page and the family’s review page — on a phone and on a computer, in Hebrew and in English. What it found — small text below 4.5:1 contrast: the “made with” line and the accessibility and privacy links at the foot of the invitations (drawn at reduced opacity), and the “made with” line of the table guide and of the gallery’s upload page — was fixed where it comes from, and the audit now runs with every change to the site and fails on anything new.`,
            'A manual pass followed: the keyboard alone (focus order, a visible focus, no traps, the dialogs), what a screen reader announces (names, errors, live updates), reflow at 320 pixels and zoom to 200%, text spacing, and reduced motion. It found, and we fixed: the page under an invitation’s closed envelope could take the keyboard’s focus while hidden (now only the envelope can, until it opens); decorative loops (a background video, particles, a drawing’s sway) could not be paused (invitations now have a “pause the animations” button); the RSVP form’s plus and minus buttons were not named by their question; the countdown was read digit by digit; and closing the comment form on the family’s review page lost the focus (it now returns to “add a comment”).',
          ],
        },
        {
          id: 'limits',
          heading: '4. Known limitations',
          body: [
            {
              list: [
                'Photos, videos and songs that hosts add to their invitations are their content; we ask hosts to describe important images in text and let them add captions to their videos, but cannot guarantee captions or descriptions for everything they upload.',
                'Videos and maps from other companies (YouTube, Vimeo, Google Maps) are shown in their own players, whose accessibility depends on those companies.',
                'Some decorative animations of the invitation designs are not described to screen readers, on purpose, since they carry no information.',
              ],
            },
            'We keep improving. If you find a page or feature that is hard to use, please tell us — it helps.',
          ],
        },
        {
          id: 'contact',
          heading: '5. Accessibility contact',
          body: [
            `${coordinator}. You can also use the contact form. We will reply within 7 business days, and try to fix a reported problem as soon as possible or offer another way to get the service.`,
          ],
        },
        {
          id: 'updated',
          heading: '6. Last review',
          body: [`This statement was last reviewed and updated on ${c.updated}.`],
        },
      ],
    };
  }
  const coordinator = [
    a.name ? `רכז/ת הנגישות: ${a.name}` : 'רכז/ת הנגישות',
    a.phone ? `טלפון ${a.phone}` : null,
    a.email ? `מייל ${a.email}` : c.operator.email ? `מייל ${c.operator.email}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    title: 'הצהרת נגישות',
    description: `איך הונגשה ${c.brand}, מגבלות ידועות, ואיך פונים לרכז/ת הנגישות.`,
    intro: [
      `אנחנו מאמינים שכל אחד צריך להיות מסוגל ליצור, לשלוח ולפתוח הזמנה. ${c.brand} בנויה כך שתהיה נגישה לאנשים עם מוגבלות, לפי חוק שוויון זכויות לאנשים עם מוגבלות ותקנות הנגישות לשירות (התשע״ג־2013).`,
    ],
    sections: [
      {
        id: 'standard',
        heading: '1. התקן',
        body: [
          'האתר מכוון לעמוד בתקן הישראלי ת״י 5568 (המבוסס על הנחיות WCAG 2.0 של ארגון W3C) ברמה AA, ובהנחיות WCAG 2.1 ברמה AA ככל האפשר. האתר ומערכת הניהול של המארחים זמינים בעברית (מימין לשמאל) ובאנגלית.',
        ],
      },
      {
        id: 'done',
        heading: '2. מה עשינו',
        body: [
          {
            list: [
              'כל חלק באתר אפשר להפעיל עם מקלדת בלבד, עם סימון פוקוס בולט; עמודי האתר והמסכים הראשיים במערכת נפתחים בקישור ״דילוג לתוכן״.',
              'מבנה סמנטי (כותרות, רשימות, אזורים וטבלאות) ושמות נגישים לכפתורים ולשדות, לתוכנות קוראות מסך כמו NVDA, JAWS ו־VoiceOver.',
              'הניגודיות בין הטקסט לרקע עומדת ברמה AA, ומידע אף פעם לא מועבר רק באמצעות צבע.',
              'אפשר להגדיל את הטקסט עד 200% בלי לאבד תוכן, והעמודים מתאימים את עצמם לטלפונים ולטאבלטים.',
              'לשדות בטפסים יש תוויות, שגיאות מתוארות במילים ומוקראות, והפוקוס עובר לשגיאה הראשונה.',
              'אפשר לעצור תוכן בתנועה: לסרטון הרקע בעמוד הבית יש כפתור עצירה, בהזמנות יש כפתור ״עצירת האנימציות״ (סרטון הרקע, החלקיקים והלולאות של האיורים נעצרים במקומם), והאנימציות נעצרות אצל מי שהמכשיר שלו מבקש תנועה מופחתת.',
              'תפריט נגישות (הכפתור העגול שצף בצד שמאל של כל עמוד באתר ובמערכת): הגדלת טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן קריא, ריווח שורות, עצירת אנימציות וסמן גדול.',
              'לכל אזור במערכת יש כפתור ״?״ שמסביר מה כל כפתור בו עושה.',
              'בהזמנות: אפשר לדלג על אנימציית הפתיחה, וכל עוד המעטפה סגורה המקלדת נשארת עליה; המוזיקה מתחילה רק אחרי לחיצה של האורח ואפשר לכבות אותה; וטופס אישור ההגעה נגיש במלואו במקלדת ובקורא מסך.',
              'אפשר להאזין להזמנה (״האזנה״, כשהחבילה של המארח כוללת את זה) בשפה שמוצגת — בקול מוקלט או בקול של המכשיר — והמוזיקה נעצרת בינתיים.',
              'לסרטונים שמארחים מעלים אפשר להוסיף כתוביות בכל שפה של ההזמנה (בקובץ או בהקלדה); העורך מזכיר למארח כשבסרטון שמדברים בו אין כתוביות.',
              'העמוד שבו בני המשפחה מעירים על טיוטה נגיש במקלדת ובקורא מסך: אפשר למקם הערה על חלק שבוחרים מרשימה, וכל סימון הוא כפתור עם שם.',
            ],
          },
        ],
      },
      {
        id: 'checked',
        heading: '3. איך בדקנו',
        body: [
          `ב־${c.updated} נבדק צד האורחים מול הנחיות WCAG 2.1 ברמה AA. בדיקה אוטומטית (axe-core, כללי WCAG 2.0 ו־2.1 ברמות A ו־AA) עברה על מסך הפתיחה ועל כל הסקשנים בכמה עיצובים של הזמנות (קלאסי, צילומי, שניים מאוירים ואחד כהה), על טופס אישור ההגעה עם השגיאות ועם האישור, על Save the Date, על מדריך השולחן של האורח, על עמדת הכניסה, על עמוד ההעלאה של הגלריה החיה ועל עמוד העיון של המשפחה — בטלפון ובמחשב, בעברית ובאנגלית. מה שנמצא — טקסט קטן בניגודיות נמוכה מ־4.5:1: שורת ״נוצר באהבה״ והקישורים להצהרת הנגישות ולפרטיות בתחתית ההזמנות (שהוצגו בשקיפות), ושורת ״נוצר באהבה״ במדריך השולחן ובעמוד ההעלאה של הגלריה — תוקן במקור, והבדיקה רצה עכשיו עם כל שינוי באתר ונכשלת על כל בעיה חדשה.`,
          'אחריה עברנו ידנית: מקלדת בלבד (סדר הפוקוס, פוקוס גלוי, בלי מלכודות, החלונות), מה שקורא מסך מקריא (שמות, שגיאות, עדכונים חיים), התאמה לרוחב 320 פיקסלים והגדלה ל־200%, ריווח טקסט, ותנועה מופחתת. מצאנו ותיקנו: העמוד שמתחת למעטפה הסגורה של הזמנה יכול היה לקבל את הפוקוס של המקלדת בזמן שהוא מוסתר (עכשיו רק המעטפה, עד שהיא נפתחת); לולאות קישוט (סרטון רקע, חלקיקים, תנועה של איור) לא היה אפשר לעצור (עכשיו יש בהזמנות כפתור ״עצירת האנימציות״); לכפתורי הפלוס והמינוס בטופס אישור ההגעה לא היה שם של השאלה שלהם; הספירה לאחור הוקראה ספרה אחר ספרה; וסגירת טופס ההערה בעמוד העיון של המשפחה איבדה את הפוקוס (עכשיו הוא חוזר ל״הוספת הערה״).',
        ],
      },
      {
        id: 'limits',
        heading: '4. מגבלות ידועות',
        body: [
          {
            list: [
              'תמונות, סרטונים ושירים שמארחים מוסיפים להזמנות הם התוכן שלהם. אנחנו מבקשים מהמארחים לתאר בטקסט תמונות חשובות ומאפשרים להם להוסיף כתוביות לסרטונים, אבל איננו יכולים להבטיח כתוביות או תיאור לכל מה שהם מעלים.',
              'סרטונים ומפות של חברות אחרות (YouTube, Vimeo, מפות Google) מוצגים בנגנים שלהן, והנגישות שלהם תלויה בחברות האלה.',
              'חלק מהאנימציות הדקורטיביות בעיצובי ההזמנות אינן מתוארות לקוראי מסך, בכוונה, כי אין בהן מידע.',
            ],
          },
          'אנחנו ממשיכים לשפר. אם נתקלתם בעמוד או ביכולת שקשה להשתמש בהם, נשמח לשמוע — זה עוזר לנו.',
        ],
      },
      {
        id: 'contact',
        heading: '5. פנייה בנושא נגישות',
        body: [
          `${coordinator}. אפשר גם בטופס יצירת הקשר. נשיב תוך 7 ימי עסקים, וננסה לתקן בעיה שדווחה מהר ככל האפשר או להציע דרך אחרת לקבל את השירות.`,
        ],
      },
      {
        id: 'updated',
        heading: '6. עדכון אחרון',
        body: [`ההצהרה נבדקה ועודכנה לאחרונה ב־${c.updated}.`],
      },
    ],
  };
}
