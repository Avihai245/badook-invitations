import type { LegalContext, LegalDoc } from '../types';

/**
 * The accessibility statement, version 2 (Equal Rights for Persons with Disabilities Law, 5758-1998, and
 * the Service Accessibility Regulations, 5773-2013, reg. 35; IS 5568). Compared with version 1 it
 * claims only what the repository can show: an automated audit (axe-core) that covers the guest side
 * and is run by developers (it is not part of any automated pipeline), Lighthouse accessibility
 * checks in CI for the home page and the sample invitations, and unit tests of the new dialogs and
 * forms. A manual review (keyboard, screen reader, 320 px / 200%) is mentioned only when the
 * deployment supplies its date (INVITES_ACCESSIBILITY_REVIEW_DATE) — version 1's description of a
 * manual pass was not re-verified. No exemption is claimed and no conformance is claimed.
 */
export function accessibilityDoc(c: LegalContext): LegalDoc {
  const a = c.a11y;
  const email = a.email || c.operator.email;
  if (c.locale === 'en') {
    const coordinator = [
      a.name ? `Accessibility coordinator: ${a.name}` : 'Accessibility coordinator',
      a.phone ? `phone ${a.phone}` : null,
      email ? `email ${email}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      title: 'Accessibility statement',
      description: `How ${c.brand} is made accessible, what has and has not been checked, known limitations, and how to reach our accessibility coordinator.`,
      intro: [
        `We believe everyone should be able to create, send and open an invitation and to take part in an event’s gallery. ${c.brand} is built to be accessible to people with disabilities, following the Equal Rights for Persons with Disabilities Law and its Service Accessibility Regulations (2013). This statement says what we did, what we have checked and how, and what we know is not yet right. It is not a certificate of conformance.`,
      ],
      sections: [
        {
          id: 'standard',
          heading: '1. The standard',
          body: [
            'We aim to meet Israeli Standard IS 5568 (based on the W3C’s WCAG 2.0 guidelines) at level AA, and the WCAG 2.1 AA guidelines wherever possible. We have not had the Service audited by an external accessibility expert, and we do not claim that it fully conforms. The website and the hosts’ app are in Hebrew (right to left) and English; the guest gallery and some guest pages are also in other languages.',
          ],
        },
        {
          id: 'done',
          heading: '2. What we have done',
          body: [
            {
              list: [
                'The Service is designed to be used with a keyboard alone, with a visible focus indicator; the site’s pages and the app’s main screens open with a “skip to content” link.',
                'Semantic structure (headings, lists, landmarks, tables) and accessible names for buttons and fields, to work with screen readers.',
                'Contrast between text and background is designed to meet level AA; information is not given by colour alone.',
                'Text can be enlarged up to 200% without losing content; pages adapt to phones and tablets.',
                'Form fields have labels, errors are described in words, linked to their fields and announced, and the first error receives the focus. This includes the guest gallery’s first-upload notice, the report form and the privacy request form, which open and close with managed focus.',
                'Moving content can be stopped: the home page’s background video has a pause button, invitations have a “pause the animations” button, and animations stop for visitors whose device asks for reduced motion.',
                'An accessibility menu (the round button floating on every page of the site and the app): larger text, high contrast, highlighted links, a readable font, line spacing, stopping animations and a large cursor.',
                'Each area of the app has a “?” button that explains what every button there does.',
                'Invitations: the opening animation can be skipped; music starts only after the guest taps and can be turned off; the RSVP form works with a keyboard and a screen reader; the invitation can be read aloud where the host’s package includes it; videos that hosts upload can have captions in each language.',
                'The page families use to comment on a draft works with a keyboard: a comment can be placed on a part chosen from a list.',
              ],
            },
          ],
        },
        {
          id: 'checked',
          heading: '3. What has been checked, and how',
          body: [
            {
              list: [
                'Automated: an axe-core audit (the WCAG 2.0 and 2.1 A and AA rules) is part of our test suite. It covers the guest side only: several invitation designs, the RSVP form with its errors, a save-the-date, a guest’s table guide, the entrance station, the live gallery’s upload page and the family review page, in Hebrew and English and, for some pages, Arabic and Russian. Developers run it; it does not run automatically before a release. A Lighthouse accessibility check runs in our continuous integration on the home page and the sample invitations.',
                'Automated tests also cover the behaviour of the new dialogs and forms (focus, labels, errors). Automated tools find only part of the problems and cannot show that a page is usable with a screen reader.',
                a.manualReview
                  ? `Manual: a manual review of the guest pages (keyboard only, a screen reader, 320 pixels width, zoom to 200% and reduced motion) was last carried out on ${a.manualReview}.`
                  : 'Manual: we are not reporting a manual review with assistive technology in this statement, because none has been recorded for this version. We will add its date here when one is carried out.',
                'Not covered by the automated audit: the home page, the policy pages, sign-in and registration, the hosts’ app and the staff console. They are built with the same components and practices, but have not been scanned.',
              ],
            },
          ],
        },
        {
          id: 'limits',
          heading: '4. Known limitations',
          body: [
            {
              list: [
                'Photos, videos and songs that hosts and guests add to invitations and galleries are their content; we ask hosts to describe important images in text and let them add captions to their videos, but cannot guarantee captions or descriptions for everything uploaded, and guests’ gallery photos have no descriptions.',
                'Videos and maps from other companies (YouTube, Vimeo, Google Maps) and the payment form are shown in their own players or forms, whose accessibility depends on those companies.',
                'Some decorative animations of the invitation designs are not described to screen readers, on purpose, since they carry no information.',
                'The gallery’s photo viewer, stories and the live screen at a venue are visual by nature.',
                'We have not determined whether any exemption in the accessibility regulations applies to the Service, and we do not rely on one.',
              ],
            },
            'We keep improving. If you find a page or feature that is hard to use, please tell us — it helps.',
          ],
        },
        {
          id: 'contact',
          heading: '5. Accessibility contact',
          body: [
            `${coordinator}. You can also use the contact form, which is an accessible form. We aim to reply within 7 business days, and to fix a reported problem as soon as possible or offer another way to get the service (for example, by email or phone).`,
          ],
        },
        {
          id: 'updated',
          heading: '6. This statement',
          body: [
            `This statement describes version ${c.version} of our documents and took effect on ${c.updated}. Earlier versions are kept and can be opened from the bottom of this page.`,
          ],
        },
      ],
    };
  }
  const coordinator = [
    a.name ? `רכז/ת הנגישות: ${a.name}` : 'רכז/ת הנגישות',
    a.phone ? `טלפון ${a.phone}` : null,
    email ? `מייל ${email}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    title: 'הצהרת נגישות',
    description: `איך הונגשה ${c.brand}, מה נבדק ומה לא, מגבלות ידועות, ואיך פונים לרכז/ת הנגישות.`,
    intro: [
      `אנחנו מאמינים שכל אחד צריך להיות מסוגל ליצור, לשלוח ולפתוח הזמנה ולקחת חלק בגלריה של אירוע. ${c.brand} בנויה כך שתהיה נגישה לאנשים עם מוגבלות, לפי חוק שוויון זכויות לאנשים עם מוגבלות ותקנות הנגישות לשירות (התשע״ג־2013). ההצהרה אומרת מה עשינו, מה בדקנו ואיך, ומה אנחנו יודעים שעדיין לא תקין. היא אינה תעודת התאמה.`,
    ],
    sections: [
      {
        id: 'standard',
        heading: '1. התקן',
        body: [
          'אנחנו שואפים לעמוד בתקן הישראלי ת״י 5568 (המבוסס על הנחיות WCAG 2.0 של ארגון W3C) ברמה AA, ובהנחיות WCAG 2.1 ברמה AA ככל האפשר. השירות לא עבר ביקורת של מומחה נגישות חיצוני, ואיננו טוענים שהוא עומד בתקן במלואו. האתר ומערכת הניהול של המארחים זמינים בעברית (מימין לשמאל) ובאנגלית; הגלריה לאורחים וחלק מעמודי האורחים זמינים גם בשפות נוספות.',
        ],
      },
      {
        id: 'done',
        heading: '2. מה עשינו',
        body: [
          {
            list: [
              'השירות מתוכנן לשימוש עם מקלדת בלבד, עם סימון פוקוס בולט; עמודי האתר והמסכים הראשיים במערכת נפתחים בקישור ״דילוג לתוכן״.',
              'מבנה סמנטי (כותרות, רשימות, אזורים וטבלאות) ושמות נגישים לכפתורים ולשדות, כדי שיעבדו עם קוראי מסך.',
              'הניגודיות בין הטקסט לרקע מתוכננת לעמוד ברמה AA, ומידע אינו מועבר רק באמצעות צבע.',
              'אפשר להגדיל את הטקסט עד 200% בלי לאבד תוכן, והעמודים מתאימים את עצמם לטלפונים ולטאבלטים.',
              'לשדות בטפסים יש תוויות, שגיאות מתוארות במילים, מקושרות לשדות שלהן ומוקראות, והפוקוס עובר לשגיאה הראשונה. זה כולל את הודעת העלאה ראשונה בגלריה, את טופס הדיווח ואת טופס בקשות הפרטיות, שנפתחים ונסגרים עם ניהול פוקוס.',
              'אפשר לעצור תוכן בתנועה: לסרטון הרקע בעמוד הבית יש כפתור עצירה, בהזמנות יש כפתור ״עצירת האנימציות״, והאנימציות נעצרות אצל מי שהמכשיר שלו מבקש תנועה מופחתת.',
              'תפריט נגישות (הכפתור העגול שצף בכל עמוד באתר ובמערכת): הגדלת טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן קריא, ריווח שורות, עצירת אנימציות וסמן גדול.',
              'לכל אזור במערכת יש כפתור ״?״ שמסביר מה כל כפתור בו עושה.',
              'בהזמנות: אפשר לדלג על אנימציית הפתיחה; המוזיקה מתחילה רק אחרי לחיצה של האורח ואפשר לכבות אותה; טופס אישור ההגעה עובד עם מקלדת וקורא מסך; אפשר להאזין להזמנה כשהחבילה של המארח כוללת זאת; ולסרטונים שמארחים מעלים אפשר להוסיף כתוביות בכל שפה.',
              'העמוד שבו בני המשפחה מעירים על טיוטה עובד במקלדת: אפשר למקם הערה על חלק שבוחרים מרשימה.',
            ],
          },
        ],
      },
      {
        id: 'checked',
        heading: '3. מה נבדק, ואיך',
        body: [
          {
            list: [
              'אוטומטית: בדיקת axe-core (כללי WCAG 2.0 ו־2.1 ברמות A ו־AA) היא חלק מסדרת הבדיקות שלנו. היא מכסה את צד האורחים בלבד: כמה עיצובים של הזמנות, טופס אישור ההגעה עם השגיאות, Save the Date, מדריך השולחן של האורח, עמדת הכניסה, עמוד ההעלאה של הגלריה החיה ועמוד העיון של המשפחה, בעברית ובאנגלית ובחלק מהעמודים גם בערבית וברוסית. מפתחים מריצים אותה; היא אינה רצה אוטומטית לפני פרסום גרסה. בדיקת נגישות של Lighthouse רצה באינטגרציה הרציפה שלנו על עמוד הבית ועל ההזמנות לדוגמה.',
              'בדיקות אוטומטיות מכסות גם את ההתנהגות של החלונות והטפסים החדשים (פוקוס, תוויות, שגיאות). כלים אוטומטיים מוצאים רק חלק מהבעיות ואינם יכולים להראות שעמוד שמיש עם קורא מסך.',
              a.manualReview
                ? `ידנית: בדיקה ידנית של עמודי האורחים (מקלדת בלבד, קורא מסך, רוחב 320 פיקסלים, הגדלה ל־200% ותנועה מופחתת) נערכה לאחרונה ב־${a.manualReview}.`
                : 'ידנית: בהצהרה הזו איננו מדווחים על בדיקה ידנית עם טכנולוגיה מסייעת, כי לא תועדה כזו לגרסה זו. נוסיף כאן את תאריכה כשתיערך.',
              'לא מכוסים בבדיקה האוטומטית: עמוד הבית, עמודי המדיניות, ההתחברות וההרשמה, מערכת המארחים וקונסולת הצוות. הם בנויים מאותם רכיבים ובאותם עקרונות, אבל לא נסרקו.',
            ],
          },
        ],
      },
      {
        id: 'limits',
        heading: '4. מגבלות ידועות',
        body: [
          {
            list: [
              'תמונות, סרטונים ושירים שמארחים ואורחים מוסיפים להזמנות ולגלריות הם התוכן שלהם. אנחנו מבקשים מהמארחים לתאר בטקסט תמונות חשובות ומאפשרים להם להוסיף כתוביות לסרטונים, אבל איננו יכולים להבטיח כתוביות או תיאור לכל מה שמועלה, ולתמונות שאורחים מעלים לגלריה אין תיאורים.',
              'סרטונים ומפות של חברות אחרות (YouTube, Vimeo, מפות Google) וטופס התשלום מוצגים בנגנים או בטפסים שלהם, והנגישות שלהם תלויה בחברות האלה.',
              'חלק מהאנימציות הדקורטיביות בעיצובי ההזמנות אינן מתוארות לקוראי מסך, בכוונה, כי אין בהן מידע.',
              'מציג התמונות של הגלריה, הסטוריז והמסך החי באולם הם חזותיים מטבעם.',
              'לא בדקנו אם חל על השירות פטור כלשהו מתקנות הנגישות, ואיננו נסמכים על פטור.',
            ],
          },
          'אנחנו ממשיכים לשפר. אם נתקלתם בעמוד או ביכולת שקשה להשתמש בהם, נשמח לשמוע — זה עוזר לנו.',
        ],
      },
      {
        id: 'contact',
        heading: '5. פנייה בנושא נגישות',
        body: [
          `${coordinator}. אפשר גם בטופס יצירת הקשר, שהוא טופס נגיש. אנחנו שואפים להשיב תוך 7 ימי עסקים, ולתקן בעיה שדווחה מהר ככל האפשר או להציע דרך אחרת לקבל את השירות (למשל במייל או בטלפון).`,
        ],
      },
      {
        id: 'updated',
        heading: '6. ההצהרה הזו',
        body: [
          `ההצהרה מתארת את גרסה ${c.version} של המסמכים שלנו ונכנסה לתוקף ב־${c.updated}. גרסאות קודמות נשמרות ואפשר לפתוח אותן בתחתית העמוד.`,
        ],
      },
    ],
  };
}
