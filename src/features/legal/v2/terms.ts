import type { LegalContext, LegalDoc } from '../types';
import { contactLine, money, operatorLine } from './shared';

/**
 * The terms of use, version 2: the service, accounts, what hosts may send and to whom, the content
 * and its rights, the event gallery (the Gallery Rules are a separate mandatory document), plans, the
 * refund policy (its own document), reports of infringement, liability and the governing law. The
 * section ids `plans` and `cancel` stay as in version 1 — the billing page links to them.
 */
export function termsDoc(c: LegalContext): LegalDoc {
  const who = operatorLine(c);
  if (c.locale === 'en') {
    return {
      title: 'Terms of use',
      description: `The terms for using ${c.brand}: accounts, invitations, guests’ details, the event gallery, plans, payments and cancellation.`,
      intro: [
        `These terms govern the use of ${c.brand} (the “Service”, at ${c.site}), run by ${who} (“we”). By opening an account or using the Service you agree to them. If you do not agree, please do not use the Service. The privacy policy, the cookie policy, the refund and cancellation policy and the event gallery rules are part of these terms.`,
        'Guests who open an invitation or a gallery link do not open an account; for them the event gallery rules and the privacy policy are the relevant documents.',
      ],
      sections: [
        {
          id: 'service',
          heading: '1. The Service',
          body: [
            'The Service lets hosts create digital invitations from ready-made designs, publish them at a link, manage a guest list, send the invitation (including on WhatsApp from the Service’s official number), collect and follow RSVPs, plan the event, and — in plans that include it — open a live gallery where guests share photos and videos from the event. We may improve, change or add features from time to time.',
          ],
        },
        {
          id: 'account',
          heading: '2. Your account',
          body: [
            {
              list: [
                'You must be 18 or older and give true details.',
                'Keep your password to yourself; you are responsible for what is done in your account. Tell us at once if you suspect someone else is using it.',
                'When you open an account you confirm that you accept these terms and the privacy policy. We keep a record of the version you accepted and when.',
                'You may close your account at any time from the account settings.',
              ],
            },
          ],
        },
        {
          id: 'guests',
          heading: '3. Guests, their details and messages',
          body: [
            {
              list: [
                'Upload or type in only details of people you are inviting, and only if you are allowed to (for example, they gave them to you for that purpose). For these details you decide whom to invite and what to ask, and we process them for you.',
                'Send invitations only to people who know you and expect to hear from you about the event. When you send invitations or reminders on WhatsApp you confirm this; every message lets the recipient block or stop receiving messages.',
                'The Service is for genuine invitations and the messages that go with an event: reminders, table numbers, links to the gallery and album. Do not use it for advertising, promotion, spam or any message that is not about your event, do not use guests’ details for a different purpose, and follow WhatsApp’s policies. We do not use guest lists for our own marketing.',
                'You are responsible for what you ask your guests and for how you use their replies. Tell your guests what you ask for and why where the law requires it.',
              ],
            },
          ],
        },
        {
          id: 'content',
          heading: '4. Your content and rights in it',
          body: [
            'Texts, photos, videos, songs and links you add remain yours; the Service does not take ownership of anything. You give us only the limited, non-exclusive licence needed to run the Service for you — to store, copy (including smaller versions and thumbnails), process, display and deliver them to the people you chose to see them — for as long as they are in the Service. The licence ends when the content is deleted, except for backup copies that expire in the ordinary course (see the privacy policy). We do not use your content for advertising or for our own promotion, and we do not sell it.',
            'You confirm that you have the rights to everything you upload or link to — including music, videos and other people’s photographs — and that it does not infringe anyone’s rights or the law, and is not offensive, discriminatory, violent, sexual or misleading. Copyright and moral rights stay with their owners; having a copy of a work does not make you its owner.',
            'A highlights film you make from a gallery is made of photos and videos that belong to the guests who took them, and its music — the invitation’s song or one you pick — may carry rights of its own. Share the film only where you may; a film for the event’s guests is different from a film for advertising or for sale, which needs the permission of everyone whose rights it uses.',
            'We may remove content or suspend an account that breaks these terms or the law, and will usually tell you first. For content that is reported to us we act as described in section 9.',
          ],
        },
        {
          id: 'gallery',
          heading: '5. The event gallery',
          body: [
            'A host whose plan includes it can open a live gallery. Guests join with a link or QR code, without an account. The gallery works under the Event gallery and user-generated content rules, which are a separate document and bind hosts and guests who use the gallery. In short:',
            {
              list: [
                'The host decides who gets the link, whether uploads are approved first, whether there is an access code, and what is published, hidden or deleted. The host is responsible for how they share and use the photos, and for telling their guests that the gallery exists.',
                'Anyone who has the gallery link (and the code, if there is one) may see what is published and may upload. Do not share the link with people you do not want to see the photos.',
                'Photos of other people’s children, and photos that humiliate or expose anyone, must not be uploaded or published. A person who appears in a photo, or a parent, can ask for it to be removed — see section 9.',
                'Face search (“the photos I’m in”) and AI photos are separate features with their own notices; the host turns them on and must not use them to identify or follow anyone. Face search is a biometric feature and is off unless it is turned on for the event and on the deployment.',
              ],
            },
          ],
        },
        {
          id: 'ours',
          heading: '6. Our designs and software',
          body: [
            'The designs, illustrations, animations, music supplied with the designs, texts, software and brand of the Service belong to us or to our licensors. You may use them only in your invitations within the Service; you may not copy them, sell them or use them outside the Service.',
          ],
        },
        {
          id: 'plans',
          heading: '7. Plans and prices',
          body: [
            `The Service has a free plan and paid monthly plans: Pro at ${money(c.prices.pro)} and Business at ${money(c.prices.business)} a month, VAT included. What each plan includes is described on the pricing page. WhatsApp messages from the official number use credits: plans include a monthly number of credits, and more can be bought in packs. A credit is used when a message is sent; a message that fails returns its credit. Credits do not expire.`,
            'A paid plan renews automatically every month, on the date it started, and is charged to the payment method you gave, until you cancel. Before you pay, the billing page shows the price with VAT, that the plan renews every month until you cancel, and where to cancel. We will tell you in advance, by email, of any change in price; it will apply from the next billing period.',
            'An account opened through a partner (Badook Events) may get a discount on the plans from that partner. The discount is shown on the billing page, and a plan bought with it keeps renewing every month at the same price until you cancel or replace it. It does not apply to WhatsApp credits.',
            'Payments are made through a payment provider; card details are entered on the provider’s page and never reach us.',
          ],
        },
        {
          id: 'cancel',
          heading: '8. Cancelling and refunds',
          body: [
            'You can cancel a paid plan yourself at any time from the billing page; it takes effect at once, no further charge is made, and the plan stays active until the end of the period you paid for. The rights you have under the Consumer Protection Law, including the right to cancel a distance purchase within the period the law gives, and the rules for refunds and for WhatsApp credits, are set out in the refund and cancellation policy, which is part of these terms. Nothing in these terms limits a right the law gives you as a consumer.',
          ],
        },
        {
          id: 'reports',
          heading: '9. Reports of infringement and requests to remove content',
          body: [
            'Anyone can ask us to review a photo, video or other item in a gallery or on an invitation — the uploader, a person who appears in it, a parent or guardian, a copyright owner, or anyone else — without an account, using the report form (“Report content”, linked from every gallery page and from the gallery rules). The report is reviewed by a person. We may hide the item while we look into it (immediately, where it involves a child, an intimate image, or is made by a parent or guardian), then decide whether to restore it, remove it or leave it, and we tell the reporter the outcome where they gave a way to reach them. We do not automatically delete everything that is reported, because reports can be mistaken or abusive, and false or abusive reports may be disregarded.',
            'Reports about a child, an intimate image shared without consent, or other serious harm are handled first. You can also contact the authorities, and nothing here replaces that.',
            'A person who uploaded an item can delete it from the device they used; the host can delete any item in their gallery.',
          ],
        },
        {
          id: 'availability',
          heading: '10. Availability',
          body: [
            'We work to keep the Service available and your information safe, but the Service is provided “as is”: we cannot promise it will always be uninterrupted or error-free, or that messages sent through third parties (such as WhatsApp or email) will always be delivered. Keep your own copy of important information (the guest list and the replies can be exported to Excel at any time, and the gallery’s originals can be downloaded).',
          ],
        },
        {
          id: 'liability',
          heading: '11. Limitation of liability',
          body: [
            'To the extent the law allows, we are not liable for indirect or consequential damage, and our total liability for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits a right you have as a consumer that cannot be limited by law, or our liability for damage caused intentionally or by gross negligence.',
            'To the extent the law allows, you will compensate us for damage caused by a breach of these terms or of the law through your use of the Service, including content you uploaded or messages you sent.',
          ],
        },
        {
          id: 'termination',
          heading: '12. Ending the use',
          body: [
            'You may stop using the Service and close your account at any time. We may suspend or close an account that breaks these terms or the law, or to protect guests, users or the Service, and will explain why where we can. When an account is closed its information is deleted as described in the privacy policy.',
            'While an account is suspended it can’t be signed in to; its information is kept, and invitations it already published keep working for their guests unless the suspension is about them. You can ask us about a suspension through the contact page.',
          ],
        },
        {
          id: 'changes',
          heading: '13. Changes to the terms, and earlier versions',
          body: [
            'We may update these terms. Each version has a number and the date it took effect, shown at the top; significant changes will be sent to hosts by email at least 14 days before they apply. A new version applies from its effective date to use after that date — it does not change what was agreed before, and it is not treated as accepted by anyone who has not accepted it. Continuing to use the Service after that date means you accept it. Earlier versions are kept unchanged and can be opened from the bottom of this page.',
          ],
        },
        {
          id: 'law',
          heading: '14. Law and jurisdiction',
          body: [
            'These terms are governed by the laws of the State of Israel, and the competent courts in Israel have jurisdiction, subject to any law giving a consumer the right to sue elsewhere. These terms are published in Hebrew and in English; if they differ, the Hebrew text prevails, except where the law gives you a better right.',
          ],
        },
        {
          id: 'contact',
          heading: '15. Contact',
          body: [contactLine(c)],
        },
      ],
    };
  }
  return {
    title: 'תנאי שימוש',
    description: `התנאים לשימוש ב־${c.brand}: חשבון, הזמנות, פרטי מוזמנים, גלריית האירוע, חבילות, תשלומים וביטול.`,
    intro: [
      `התנאים האלה חלים על השימוש ב־${c.brand} (״השירות״, בכתובת ${c.site}), שמפעילה ${who} (״אנחנו״). פתיחת חשבון או שימוש בשירות מהווים הסכמה לתנאים. אם אינכם מסכימים להם, אנא אל תשתמשו בשירות. מדיניות הפרטיות, מדיניות העוגיות, מדיניות הביטולים וההחזרים ותקנון גלריית האירוע הם חלק מהתנאים. התנאים כתובים בלשון רבים ופונים לכל המגדרים.`,
      'אורחים שפותחים הזמנה או קישור לגלריה אינם פותחים חשבון; לגביהם המסמכים הרלוונטיים הם תקנון גלריית האירוע ומדיניות הפרטיות.',
    ],
    sections: [
      {
        id: 'service',
        heading: '1. השירות',
        body: [
          'השירות מאפשר למארחים ליצור הזמנות דיגיטליות מעיצובים מוכנים, לפרסם אותן בקישור, לנהל רשימת מוזמנים, לשלוח את ההזמנה (כולל בוואטסאפ מהמספר הרשמי של השירות), לקבל ולעקוב אחרי אישורי הגעה, לתכנן את האירוע, ובחבילות שכוללות זאת — לפתוח גלריה חיה שבה אורחים משתפים תמונות וסרטונים מהאירוע. אנחנו עשויים לשפר, לשנות ולהוסיף יכולות מעת לעת.',
        ],
      },
      {
        id: 'account',
        heading: '2. החשבון שלכם',
        body: [
          {
            list: [
              'צריך להיות בני 18 ומעלה ולמסור פרטים נכונים.',
              'שמרו את הסיסמה לעצמכם. אתם אחראים למה שנעשה בחשבון, ואם אתם חושדים שמישהו אחר משתמש בו, עדכנו אותנו מיד.',
              'כשאתם פותחים חשבון אתם מאשרים שאתם מקבלים את התנאים האלה ואת מדיניות הפרטיות. אנחנו שומרים תיעוד של הגרסה שאישרתם ושל מועד האישור.',
              'אפשר לסגור את החשבון בכל עת בהגדרות החשבון.',
            ],
          },
        ],
      },
      {
        id: 'guests',
        heading: '3. מוזמנים, הפרטים שלהם והודעות',
        body: [
          {
            list: [
              'העלו או הקלידו רק פרטים של אנשים שאתם מזמינים, ורק אם מותר לכם (למשל, הם מסרו לכם אותם לשם כך). לגבי פרטים אלה אתם מחליטים את מי להזמין ומה לשאול, ואנחנו מעבדים אותם עבורכם.',
              'שלחו הזמנות רק למי שמכיר אתכם ומצפה לשמוע מכם על האירוע. לפני שליחה בוואטסאפ תתבקשו לאשר זאת, ובכל הודעה יש למקבל אפשרות לחסום או להפסיק לקבל הודעות.',
              'השירות מיועד להזמנות אמיתיות ולהודעות שמלוות אירוע: תזכורות, מספרי שולחנות, קישורים לגלריה ולאלבום. אין להשתמש בו לפרסום, לקידום מכירות, לספאם או לכל הודעה שאינה על האירוע שלכם, אין להשתמש בפרטי המוזמנים למטרה אחרת, ויש לפעול לפי המדיניות של וואטסאפ. אנחנו לא משתמשים ברשימות מוזמנים לשיווק משלנו.',
              'אתם אחראים למה שאתם שואלים את האורחים ולשימוש שאתם עושים בתשובות שלהם. הסבירו לאורחים מה אתם מבקשים ולמה, במקום שהחוק מחייב זאת.',
            ],
          },
        ],
      },
      {
        id: 'content',
        heading: '4. התוכן שלכם והזכויות בו',
        body: [
          'טקסטים, תמונות, סרטונים, שירים וקישורים שאתם מוסיפים נשארים שלכם; השירות אינו מקבל בעלות על דבר. אתם נותנים לנו רק רישיון מוגבל ולא בלעדי, שנחוץ כדי להפעיל עבורכם את השירות — לשמור, להעתיק (כולל גרסאות קטנות ותמונות ממוזערות), לעבד, להציג ולהעביר אותם למי שבחרתם שיראה אותם — כל עוד הם בשירות. הרישיון מסתיים כשהתוכן נמחק, מלבד עותקי גיבוי שפוקעים במהלך הרגיל (ראו מדיניות הפרטיות). אנחנו לא משתמשים בתוכן שלכם לפרסום או לקידום עצמי, ולא מוכרים אותו.',
          'אתם מאשרים שיש לכם את הזכויות בכל מה שאתם מעלים או מקשרים אליו — כולל מוזיקה, סרטונים ותצלומים של אנשים אחרים — שהוא אינו פוגע בזכויות של אחרים או בחוק, ואינו פוגעני, מפלה, אלים, מיני או מטעה. זכויות יוצרים וזכויות מוסריות נשארות אצל בעליהן; להחזיק עותק של יצירה לא הופך אתכם לבעליה.',
          'סרט רגעים שאתם יוצרים מגלריה עשוי מתמונות וסרטונים ששייכים לאורחים שצילמו אותם, ולמוזיקה שלו — השיר של ההזמנה או שיר שבחרתם — עשויות להיות זכויות משלה. שתפו את הסרט רק היכן שמותר לכם; סרט לאורחי האירוע שונה מסרט לפרסום או למכירה, שדורש רשות מכל מי שהזכויות שלו בשימוש.',
          'אנחנו רשאים להסיר תוכן או להשעות חשבון שמפר את התנאים או את החוק, ובדרך כלל נודיע לכם קודם. תוכן שדווח לנו מטופל כמתואר בסעיף 9.',
        ],
      },
      {
        id: 'gallery',
        heading: '5. גלריית האירוע',
        body: [
          'מארח שהחבילה שלו כוללת זאת יכול לפתוח גלריה חיה. אורחים מצטרפים בקישור או בקוד QR, בלי חשבון. הגלריה פועלת לפי תקנון גלריית האירוע ותוכן גולשים, שהוא מסמך נפרד וחל על מארחים ועל אורחים שמשתמשים בגלריה. בקצרה:',
          {
            list: [
              'המארח מחליט למי לתת את הקישור, אם צריך אישור לפני פרסום, אם יש קוד גישה, ומה מתפרסם, מוסתר או נמחק. המארח אחראי לאופן שבו הוא משתף ומשתמש בתמונות, ולהודיע לאורחיו שהגלריה קיימת.',
              'מי שיש לו את קישור הגלריה (ואת הקוד, אם יש) יכול לראות את מה שפורסם וגם להעלות. אל תשתפו את הקישור עם מי שאינכם רוצים שיראה את התמונות.',
              'אסור להעלות או לפרסם תמונות של ילדים של אחרים, או תמונות שמשפילות או חושפות מישהו. מי שמופיע בתמונה, או הורה, יכול לבקש להסיר אותה — ראו סעיף 9.',
              'חיפוש לפי פנים (״התמונות שאני בהן״) ותמונות AI הם יכולות נפרדות עם הודעות משלהן; המארח מפעיל אותן ואסור לו להשתמש בהן כדי לזהות מישהו או לעקוב אחריו. חיפוש לפי פנים הוא יכולת ביומטרית והוא כבוי אלא אם הופעל לאירוע ובפריסה.',
            ],
          },
        ],
      },
      {
        id: 'ours',
        heading: '6. העיצובים והתוכנה שלנו',
        body: [
          'העיצובים, האיורים, האנימציות, המוזיקה שמגיעה עם העיצובים, הטקסטים, התוכנה והמותג של השירות שייכים לנו או למי שהעניק לנו רישיון. מותר להשתמש בהם רק בהזמנות שלכם בתוך השירות; אסור להעתיק, למכור או להשתמש בהם מחוץ לשירות.',
        ],
      },
      {
        id: 'plans',
        heading: '7. חבילות ומחירים',
        body: [
          `לשירות חבילה חינמית וחבילות בתשלום חודשי: Pro ב־${money(c.prices.pro)} ו־Business ב־${money(c.prices.business)} לחודש, כולל מע״מ. מה כלול בכל חבילה מפורט בעמוד המחירים. הודעות וואטסאפ מהמספר הרשמי משתמשות בקרדיטים: בחבילות יש מספר קרדיטים חודשי, ואפשר לקנות עוד בחבילות הודעות. קרדיט נוצל כשההודעה נשלחת, והודעה שנכשלה מחזירה את הקרדיט. קרדיטים לא פגים.`,
          'חבילה בתשלום מתחדשת אוטומטית בכל חודש, באותו תאריך שבו התחילה, ומחויבת באמצעי התשלום שמסרתם, עד שתבטלו. לפני התשלום עמוד החיובים מציג את המחיר כולל מע״מ, את העובדה שהחבילה מתחדשת בכל חודש עד שתבטלו, ואת המקום שבו מבטלים. על שינוי מחיר נודיע מראש במייל, והוא יחול מתקופת החיוב הבאה.',
          'חשבון שנפתח דרך שותף (Badook Events) יכול לקבל מהשותף הנחה על החבילות. ההנחה מופיעה בעמוד החיובים, וחבילה שנקנתה בה ממשיכה להתחדש כל חודש באותו מחיר, עד שתבטלו או תחליפו אותה. ההנחה לא חלה על קרדיטים לוואטסאפ.',
          'התשלום נעשה דרך חברת תשלומים; פרטי הכרטיס מוקלדים בעמוד של החברה ואינם מגיעים אלינו.',
        ],
      },
      {
        id: 'cancel',
        heading: '8. ביטול והחזרים',
        body: [
          'אפשר לבטל חבילה בתשלום בעצמכם בכל עת בעמוד החיובים; הביטול נכנס לתוקף מיד, לא יבוצעו חיובים נוספים, והחבילה נשארת פעילה עד סוף התקופה ששולמה. הזכויות שיש לכם לפי חוק הגנת הצרכן, כולל הזכות לבטל רכישה מרחוק בתוך התקופה שהחוק נותן, והכללים להחזרים ולקרדיטים לוואטסאפ, מפורטים במדיניות הביטולים וההחזרים, שהיא חלק מהתנאים. דבר בתנאים אינו מגביל זכות שהחוק נותן לכם כצרכנים.',
        ],
      },
      {
        id: 'reports',
        heading: '9. דיווח על הפרה ובקשות להסיר תוכן',
        body: [
          'כל אחד יכול לבקש מאיתנו לבדוק תמונה, סרטון או פריט אחר בגלריה או בהזמנה — מי שהעלה אותו, מי שמופיע בו, הורה או אפוטרופוס, בעל זכויות יוצרים או כל אחד אחר — בלי חשבון, בטופס הדיווח (״דיווח על תוכן״, שמקושר מכל עמוד של הגלריה ומהתקנון שלה). אדם בודק את הדיווח. אנחנו רשאים להסתיר את הפריט בזמן הבדיקה (מיד, כשמדובר בילד, בתמונה אינטימית או בדיווח של הורה או אפוטרופוס), ואז להחליט אם להחזיר אותו, להסיר אותו או להשאיר אותו, ואנחנו מודיעים למדווח על התוצאה כשהוא מסר דרך ליצור קשר. איננו מוחקים אוטומטית כל מה שמדווחים עליו, כי דיווחים עלולים להיות שגויים או פוגעניים, ואפשר להתעלם מדיווחי שווא או פוגעניים.',
          'דיווחים על ילד, על תמונה אינטימית שפורסמה בלי הסכמה או על פגיעה חמורה אחרת מטופלים ראשונים. אפשר גם לפנות לרשויות, ודבר מכאן אינו מחליף זאת.',
          'מי שהעלה פריט יכול למחוק אותו מהמכשיר שבו השתמש; המארח יכול למחוק כל פריט בגלריה שלו.',
        ],
      },
      {
        id: 'availability',
        heading: '10. זמינות השירות',
        body: [
          'אנחנו עושים מאמץ שהשירות יהיה זמין והמידע שלכם בטוח, אבל השירות ניתן ״כמות שהוא״ (AS IS): איננו מתחייבים שיפעל תמיד בלי הפסקות או תקלות, או שהודעות שנשלחות דרך צדדים שלישיים (כמו וואטסאפ או מייל) יימסרו תמיד. שמרו עותק משלכם של מידע חשוב (את רשימת המוזמנים והתשובות אפשר לייצא לאקסל בכל רגע, ואת הקבצים המקוריים של הגלריה אפשר להוריד).',
        ],
      },
      {
        id: 'liability',
        heading: '11. הגבלת אחריות',
        body: [
          'ככל שהדין מתיר, איננו אחראים לנזק עקיף או תוצאתי, והאחריות הכוללת שלנו לכל טענה מוגבלת לסכום ששילמתם לנו ב־12 החודשים שלפני הטענה. דבר בתנאים לא מגביל זכות שיש לכם כצרכנים ושהחוק אינו מתיר להגביל, או את אחריותנו לנזק שנגרם במזיד או ברשלנות רבתי.',
          'ככל שהדין מתיר, תשפו אותנו על נזק שנגרם בגלל הפרת התנאים או החוק בשימוש שלכם בשירות, כולל תוכן שהעליתם או הודעות ששלחתם.',
        ],
      },
      {
        id: 'termination',
        heading: '12. סיום השימוש',
        body: [
          'אפשר להפסיק להשתמש בשירות ולסגור את החשבון בכל עת. אנחנו רשאים להשעות או לסגור חשבון שמפר את התנאים או את החוק, או כדי להגן על אורחים, משתמשים או על השירות, ונסביר את הסיבה כשאפשר. כשחשבון נסגר, המידע שלו נמחק כמתואר במדיניות הפרטיות.',
          'כל עוד חשבון מושעה אי אפשר להיכנס אליו; המידע שלו נשמר, וההזמנות שכבר פורסמו בו ממשיכות לעבוד לאורחים, אלא אם ההשעיה נוגעת להן. אפשר לפנות אלינו לגבי השעיה דרך דף יצירת הקשר.',
        ],
      },
      {
        id: 'changes',
        heading: '13. שינויים בתנאים וגרסאות קודמות',
        body: [
          'אנחנו עשויים לעדכן את התנאים. לכל גרסה יש מספר ותאריך כניסה לתוקף, שמופיעים בראש העמוד, ועל שינויים מהותיים נודיע למארחים במייל לפחות 14 יום לפני שייכנסו לתוקף. גרסה חדשה חלה מתאריך כניסתה לתוקף על שימוש מאותו תאריך — היא אינה משנה את מה שהוסכם קודם, ואינה נחשבת כמי שאושרה על ידי מי שלא אישר אותה. המשך השימוש בשירות אחרי אותו תאריך מהווה הסכמה לה. גרסאות קודמות נשמרות ללא שינוי ואפשר לפתוח אותן בתחתית העמוד.',
        ],
      },
      {
        id: 'law',
        heading: '14. הדין וסמכות השיפוט',
        body: [
          'על התנאים חלים דיני מדינת ישראל, ולבתי המשפט המוסמכים בישראל הסמכות לדון בכל עניין הנוגע להם, בכפוף לכל דין שמקנה לצרכן זכות לתבוע במקום אחר. התנאים מתפרסמים בעברית ובאנגלית; אם יש הבדל ביניהם, הנוסח העברי גובר, אלא אם החוק מקנה לכם זכות טובה יותר.',
        ],
      },
      {
        id: 'contact',
        heading: '15. יצירת קשר',
        body: [contactLine(c)],
      },
    ],
  };
}
