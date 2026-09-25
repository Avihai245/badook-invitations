import type { LegalContext, LegalDoc } from './types';

/**
 * The terms of use: the service, accounts, what hosts may send and to whom, their content, the plans
 * and cancellation (Consumer Protection Law, 5741-1981: a continuing transaction — s. 13D — and a
 * distance sale — s. 14C), liability, and the law that applies.
 */
export function termsDoc(c: LegalContext): LegalDoc {
  const o = c.operator;
  const money = (v: number) => `₪${v}`;
  if (c.locale === 'en') {
    const who = o.name ? `${o.name}${o.id ? ` (company no. ${o.id})` : ''}` : `the operator of ${c.brand}`;
    return {
      title: 'Terms of use',
      description: `The terms for using ${c.brand}: accounts, invitations, messages to guests, plans, payments and cancellation.`,
      intro: [
        `These terms govern the use of ${c.brand} (the “Service”, at ${c.site}), run by ${who} (“we”). By opening an account or using the Service you agree to them. If you do not agree, please do not use the Service. The privacy policy and the cookie policy are part of these terms.`,
      ],
      sections: [
        {
          id: 'service',
          heading: '1. The Service',
          body: [
            'The Service lets hosts create digital invitations from ready-made designs, publish them at a link, manage a guest list, send the invitation (including on WhatsApp from the Service’s official number), and collect and follow RSVPs. We may improve, change or add features from time to time.',
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
                'Upload or type in only details of people you are inviting, and only if you are allowed to (for example, they gave them to you for that purpose).',
                'Send invitations only to people who know you and expect to hear from you about the event. Before sending on WhatsApp you confirm this; every message lets the recipient block or stop receiving messages.',
                'Do not use the Service for advertising, spam or any message that is not an invitation to your event, and follow WhatsApp’s policies.',
                'You are responsible for what you ask your guests and for how you use their replies.',
              ],
            },
          ],
        },
        {
          id: 'content',
          heading: '4. Your content',
          body: [
            'Texts, photos, videos, songs and links you add remain yours. You give us a limited licence to store, process and display them as needed to provide the Service (for example, to show the invitation to your guests), for as long as they are in the Service.',
            'You confirm you have the rights to everything you upload or link to — including music and videos — and that it does not infringe anyone’s rights or the law, and is not offensive, discriminatory, violent or misleading. We may remove content or suspend an account that breaks these terms or the law, and will usually tell you first.',
          ],
        },
        {
          id: 'ours',
          heading: '5. Our designs and software',
          body: [
            'The designs, illustrations, animations, music supplied with the designs, texts, software and brand of the Service belong to us or to our licensors. You may use them only in your invitations within the Service; you may not copy them, sell them or use them outside the Service.',
          ],
        },
        {
          id: 'plans',
          heading: '6. Plans and prices',
          body: [
            `The Service has a free plan and paid monthly plans: Pro at ${money(c.prices.pro)} and Business at ${money(c.prices.business)} a month, VAT included. What each plan includes is described on the pricing page. WhatsApp messages from the official number use credits: plans include a monthly number of credits, and more can be bought in packs. A credit is used when a message is sent; a message that fails returns its credit. Credits do not expire.`,
            'A paid plan renews automatically every month and is charged to the payment method you gave, until you cancel. We will tell you in advance, by email, of any change in price; it will apply from the next billing period.',
            'An account opened through a partner (Badook Events) may get a discount on the plans from that partner. The discount is shown on the billing page, and a plan bought with it keeps renewing every month at the same price until you cancel or replace it. It does not apply to WhatsApp credits.',
          ],
        },
        {
          id: 'cancel',
          heading: '7. Cancelling and refunds',
          body: [
            {
              list: [
                'You may cancel a subscription at any time from the billing page (or by contacting us). The cancellation takes effect within three business days and no further charges are made; the plan stays active until the end of the period already paid for, and then your account moves to the free plan.',
                'Under the Consumer Protection Law you may also cancel a purchase within 14 days of making it (or of receiving these terms, if later) and get a refund of what you paid, less a cancellation fee of 5% of the price or ₪100, whichever is lower, and less the value of what was already used — for example, WhatsApp messages already sent.',
                'Unused purchased credits can be refunded within 14 days of the purchase on the same terms. Used credits are not refundable, since the messages were already delivered through WhatsApp.',
                'Refunds are made to the payment method used, within 14 days of the cancellation.',
              ],
            },
          ],
        },
        {
          id: 'availability',
          heading: '8. Availability',
          body: [
            'We work to keep the Service available and your information safe, but the Service is provided “as is”: we cannot promise it will always be uninterrupted or error-free, or that messages sent through third parties (such as WhatsApp or email) will always be delivered. Keep your own copy of important information (the guest list and the replies can be exported to Excel at any time).',
          ],
        },
        {
          id: 'liability',
          heading: '9. Limitation of liability',
          body: [
            'To the extent the law allows, we are not liable for indirect or consequential damage, and our total liability for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits a right you have as a consumer that cannot be limited by law.',
            'You will compensate us for damage caused by a breach of these terms or of the law through your use of the Service, including content you uploaded or messages you sent.',
          ],
        },
        {
          id: 'termination',
          heading: '10. Ending the use',
          body: [
            'You may stop using the Service and close your account at any time. We may suspend or close an account that breaks these terms or the law, or to protect guests, users or the Service, and will explain why where we can. When an account is closed its information is deleted as described in the privacy policy.',
          ],
        },
        {
          id: 'changes',
          heading: '11. Changes to the terms',
          body: [
            'We may update these terms. The date of the last update appears at the top; significant changes will be sent to hosts by email at least 14 days before they apply. Continuing to use the Service after that means you accept them.',
          ],
        },
        {
          id: 'law',
          heading: '12. Law and jurisdiction',
          body: [
            'These terms are governed by the laws of the State of Israel, and the competent courts in Israel have jurisdiction, subject to any law giving a consumer the right to sue elsewhere.',
          ],
        },
        {
          id: 'contact',
          heading: '13. Contact',
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
  return {
    title: 'תנאי שימוש',
    description: `התנאים לשימוש ב־${c.brand}: חשבון, הזמנות, הודעות למוזמנים, חבילות, תשלומים וביטול.`,
    intro: [
      `התנאים האלה חלים על השימוש ב־${c.brand} (״השירות״, בכתובת ${c.site}), שמפעילה ${who} (״אנחנו״). פתיחת חשבון או שימוש בשירות מהווים הסכמה לתנאים. אם אינכם מסכימים להם, אנא אל תשתמשו בשירות. מדיניות הפרטיות ומדיניות העוגיות הן חלק מהתנאים. התנאים כתובים בלשון רבים ופונים לכל המגדרים.`,
    ],
    sections: [
      {
        id: 'service',
        heading: '1. השירות',
        body: [
          'השירות מאפשר למארחים ליצור הזמנות דיגיטליות מעיצובים מוכנים, לפרסם אותן בקישור, לנהל רשימת מוזמנים, לשלוח את ההזמנה (כולל בוואטסאפ מהמספר הרשמי של השירות), ולקבל ולעקוב אחרי אישורי הגעה. אנחנו עשויים לשפר, לשנות ולהוסיף יכולות מעת לעת.',
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
              'העלו או הקלידו רק פרטים של אנשים שאתם מזמינים, ורק אם מותר לכם (למשל, הם מסרו לכם אותם לשם כך).',
              'שלחו הזמנות רק למי שמכיר אתכם ומצפה לשמוע מכם על האירוע. לפני שליחה בוואטסאפ תתבקשו לאשר זאת, ובכל הודעה יש למקבל אפשרות לחסום או להפסיק לקבל הודעות.',
              'אין להשתמש בשירות לפרסום, לספאם או לכל הודעה שאינה הזמנה לאירוע שלכם, ויש לפעול לפי המדיניות של וואטסאפ.',
              'אתם אחראים למה שאתם שואלים את האורחים ולשימוש שאתם עושים בתשובות שלהם.',
            ],
          },
        ],
      },
      {
        id: 'content',
        heading: '4. התוכן שלכם',
        body: [
          'טקסטים, תמונות, סרטונים, שירים וקישורים שאתם מוסיפים נשארים שלכם. אתם נותנים לנו רישיון מוגבל לשמור, לעבד ולהציג אותם כפי שנחוץ כדי לתת את השירות (למשל, כדי להציג את ההזמנה לאורחים), כל עוד הם בשירות.',
          'אתם מאשרים שיש לכם את הזכויות בכל מה שאתם מעלים או מקשרים אליו, כולל מוזיקה וסרטונים, שהוא אינו פוגע בזכויות של אחרים או בחוק, ואינו פוגעני, מפלה, אלים או מטעה. אנחנו רשאים להסיר תוכן או להשעות חשבון שמפר את התנאים או את החוק, ובדרך כלל נודיע לכם קודם.',
        ],
      },
      {
        id: 'ours',
        heading: '5. העיצובים והתוכנה שלנו',
        body: [
          'העיצובים, האיורים, האנימציות, המוזיקה שמגיעה עם העיצובים, הטקסטים, התוכנה והמותג של השירות שייכים לנו או למי שהעניק לנו רישיון. מותר להשתמש בהם רק בהזמנות שלכם בתוך השירות; אסור להעתיק, למכור או להשתמש בהם מחוץ לשירות.',
        ],
      },
      {
        id: 'plans',
        heading: '6. חבילות ומחירים',
        body: [
          `לשירות חבילה חינמית וחבילות בתשלום חודשי: Pro ב־${money(c.prices.pro)} ו־Business ב־${money(c.prices.business)} לחודש, כולל מע״מ. מה כלול בכל חבילה מפורט בעמוד המחירים. הודעות וואטסאפ מהמספר הרשמי משתמשות בקרדיטים: בחבילות יש מספר קרדיטים חודשי, ואפשר לקנות עוד בחבילות הודעות. קרדיט נוצל כשההודעה נשלחת, והודעה שנכשלה מחזירה את הקרדיט. קרדיטים לא פגים.`,
          'חבילה בתשלום מתחדשת אוטומטית בכל חודש ומחויבת באמצעי התשלום שמסרתם, עד שתבטלו. על שינוי מחיר נודיע מראש במייל, והוא יחול מתקופת החיוב הבאה.',
          'חשבון שנפתח דרך שותף (Badook Events) יכול לקבל מהשותף הנחה על החבילות. ההנחה מופיעה בעמוד החיובים, וחבילה שנקנתה בה ממשיכה להתחדש כל חודש באותו מחיר, עד שתבטלו או תחליפו אותה. ההנחה לא חלה על קרדיטים לוואטסאפ.',
        ],
      },
      {
        id: 'cancel',
        heading: '7. ביטול והחזרים',
        body: [
          {
            list: [
              'אפשר לבטל מנוי בכל עת בעמוד החיובים (או בפנייה אלינו). הביטול נכנס לתוקף תוך שלושה ימי עסקים ולא יבוצעו חיובים נוספים; החבילה נשארת פעילה עד סוף התקופה ששולמה, ואז החשבון עובר לחבילה החינמית.',
              'לפי חוק הגנת הצרכן אפשר גם לבטל רכישה תוך 14 יום ממועד ביצועה (או ממועד קבלת התנאים, אם הוא מאוחר יותר) ולקבל החזר של מה ששולם, בניכוי דמי ביטול של 5% מהמחיר או 100 ₪, הנמוך מביניהם, ובניכוי שווי מה שכבר נוצל, למשל הודעות וואטסאפ שכבר נשלחו.',
              'קרדיטים שנקנו ולא נוצלו אפשר להחזיר תוך 14 יום מהרכישה באותם תנאים. קרדיטים שנוצלו אינם ניתנים להחזר, כי ההודעות כבר נמסרו דרך וואטסאפ.',
              'ההחזר ייעשה לאמצעי התשלום שבו שילמתם, תוך 14 יום מהביטול.',
            ],
          },
        ],
      },
      {
        id: 'availability',
        heading: '8. זמינות השירות',
        body: [
          'אנחנו עושים מאמץ שהשירות יהיה זמין והמידע שלכם בטוח, אבל השירות ניתן ״כמות שהוא״ (AS IS): איננו מתחייבים שיפעל תמיד בלי הפסקות או תקלות, או שהודעות שנשלחות דרך צדדים שלישיים (כמו וואטסאפ או מייל) יימסרו תמיד. שמרו עותק משלכם של מידע חשוב (את רשימת המוזמנים והתשובות אפשר לייצא לאקסל בכל רגע).',
        ],
      },
      {
        id: 'liability',
        heading: '9. הגבלת אחריות',
        body: [
          'ככל שהדין מתיר, איננו אחראים לנזק עקיף או תוצאתי, והאחריות הכוללת שלנו לכל טענה מוגבלת לסכום ששילמתם לנו ב־12 החודשים שלפני הטענה. דבר בתנאים לא מגביל זכות שיש לכם כצרכנים ושהחוק אינו מתיר להגביל.',
          'תשפו אותנו על נזק שנגרם בגלל הפרת התנאים או החוק בשימוש שלכם בשירות, כולל תוכן שהעליתם או הודעות ששלחתם.',
        ],
      },
      {
        id: 'termination',
        heading: '10. סיום השימוש',
        body: [
          'אפשר להפסיק להשתמש בשירות ולסגור את החשבון בכל עת. אנחנו רשאים להשעות או לסגור חשבון שמפר את התנאים או את החוק, או כדי להגן על אורחים, משתמשים או על השירות, ונסביר את הסיבה כשאפשר. כשחשבון נסגר, המידע שלו נמחק כמתואר במדיניות הפרטיות.',
        ],
      },
      {
        id: 'changes',
        heading: '11. שינויים בתנאים',
        body: [
          'אנחנו עשויים לעדכן את התנאים. תאריך העדכון האחרון מופיע בראש העמוד, ועל שינויים מהותיים נודיע למארחים במייל לפחות 14 יום לפני שייכנסו לתוקף. המשך השימוש אחרי כן מהווה הסכמה להם.',
        ],
      },
      {
        id: 'law',
        heading: '12. הדין וסמכות השיפוט',
        body: [
          'על התנאים חלים דיני מדינת ישראל, ולבתי המשפט המוסמכים בישראל הסמכות לדון בכל עניין הנוגע להם, בכפוף לכל דין שמקנה לצרכן זכות לתבוע במקום אחר.',
        ],
      },
      {
        id: 'contact',
        heading: '13. יצירת קשר',
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
