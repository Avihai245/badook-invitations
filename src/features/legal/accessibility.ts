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
                'Moving content can be stopped: the home page’s background video has a pause button, and animations stop for visitors whose device asks for reduced motion.',
                'An accessibility menu (the round button floating on the left of every page of the site and the app): larger text, high contrast, highlighted links, a readable font, line spacing, stopping animations and a large cursor.',
                'Each area of the app has a “?” button that explains what every button there does.',
                'Invitations: the opening animation can be skipped, music starts only after the guest taps and can be turned off, and the RSVP form is fully keyboard- and screen-reader-accessible.',
              ],
            },
          ],
        },
        {
          id: 'limits',
          heading: '3. Known limitations',
          body: [
            {
              list: [
                'Photos, videos and songs that hosts add to their invitations are their content; we ask hosts to describe important images in text, but cannot guarantee captions or descriptions for everything they upload.',
                'Videos and maps from other companies (YouTube, Vimeo, Google Maps) are shown in their own players, whose accessibility depends on those companies.',
                'Some decorative animations of the invitation designs are not described to screen readers, on purpose, since they carry no information.',
              ],
            },
            'We keep improving. If you find a page or feature that is hard to use, please tell us — it helps.',
          ],
        },
        {
          id: 'contact',
          heading: '4. Accessibility contact',
          body: [
            `${coordinator}. You can also use the contact form. We will reply within 7 business days, and try to fix a reported problem as soon as possible or offer another way to get the service.`,
          ],
        },
        {
          id: 'updated',
          heading: '5. Last review',
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
              'אפשר לעצור תוכן בתנועה: לסרטון הרקע בעמוד הבית יש כפתור עצירה, והאנימציות נעצרות אצל מי שהמכשיר שלו מבקש תנועה מופחתת.',
              'תפריט נגישות (הכפתור העגול שצף בצד שמאל של כל עמוד באתר ובמערכת): הגדלת טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן קריא, ריווח שורות, עצירת אנימציות וסמן גדול.',
              'לכל אזור במערכת יש כפתור ״?״ שמסביר מה כל כפתור בו עושה.',
              'בהזמנות: אפשר לדלג על אנימציית הפתיחה, המוזיקה מתחילה רק אחרי לחיצה של האורח ואפשר לכבות אותה, וטופס אישור ההגעה נגיש במלואו במקלדת ובקורא מסך.',
            ],
          },
        ],
      },
      {
        id: 'limits',
        heading: '3. מגבלות ידועות',
        body: [
          {
            list: [
              'תמונות, סרטונים ושירים שמארחים מוסיפים להזמנות הם התוכן שלהם. אנחנו מבקשים מהמארחים לתאר בטקסט תמונות חשובות, אבל איננו יכולים להבטיח כתוביות או תיאור לכל מה שהם מעלים.',
              'סרטונים ומפות של חברות אחרות (YouTube, Vimeo, מפות Google) מוצגים בנגנים שלהן, והנגישות שלהם תלויה בחברות האלה.',
              'חלק מהאנימציות הדקורטיביות בעיצובי ההזמנות אינן מתוארות לקוראי מסך, בכוונה, כי אין בהן מידע.',
            ],
          },
          'אנחנו ממשיכים לשפר. אם נתקלתם בעמוד או ביכולת שקשה להשתמש בהם, נשמח לשמוע — זה עוזר לנו.',
        ],
      },
      {
        id: 'contact',
        heading: '4. פנייה בנושא נגישות',
        body: [
          `${coordinator}. אפשר גם בטופס יצירת הקשר. נשיב תוך 7 ימי עסקים, וננסה לתקן בעיה שדווחה מהר ככל האפשר או להציע דרך אחרת לקבל את השירות.`,
        ],
      },
      {
        id: 'updated',
        heading: '5. עדכון אחרון',
        body: [`ההצהרה נבדקה ועודכנה לאחרונה ב־${c.updated}.`],
      },
    ],
  };
}
