import type { LegalContext, LegalDoc } from '../types';
import { contactLine, money, operatorLine } from './shared';

/**
 * The refund and cancellation policy (new in version 2; before it the terms' section 7 carried these
 * provisions). It matches what the billing code actually does (verified in the compliance audit,
 * docs/legal/): a subscription is cancelled online from the billing page and stops at once; the plan
 * stays until the end of the period paid; there is no automated refund — refunds are made by hand
 * through the payment provider; credits do not expire. The statutory cancellation right is stated as
 * "where the Consumer Protection Law, 5741-1981 applies" (ss. 13D, 14C) — it is not applied to every
 * purchase; the voluntary commitments are marked as such. Counsel must confirm the application of
 * s. 14C to each product (docs/legal/decision-records.md, DR-04).
 */
export function refundsDoc(c: LegalContext): LegalDoc {
  const who = operatorLine(c);
  if (c.locale === 'en') {
    return {
      title: 'Refund and cancellation policy',
      description: `How to cancel a ${c.brand} subscription, when a refund is due, and what happens to WhatsApp credits.`,
      intro: [
        `This policy explains how to cancel a paid plan of ${c.brand} (run by ${who}), when you can get a refund, and what happens to purchased WhatsApp message credits. It is part of the terms of use and does not limit any right that the law gives you as a consumer.`,
        {
          note: 'In short: you can cancel a plan yourself at any time from the billing page, and no further charge is made. The plan stays until the end of the period you paid for. Cancelling inside the period the law gives consumers entitles you to a refund as described in section 4.',
        },
      ],
      sections: [
        {
          id: 'what',
          heading: '1. What you can buy',
          body: [
            {
              list: [
                `A monthly plan — Pro at ${money(c.prices.pro)} or Business at ${money(c.prices.business)} a month, VAT included. It renews every month, on the date it started, until you cancel.`,
                'A credit pack — a one-time purchase of credits for sending invitations from the Service’s official WhatsApp number. A credit is used when a message is sent, a message that fails returns its credit, and credits do not expire.',
              ],
            },
            'The price you see before paying, with VAT, is the price you are charged. A partner discount (for example from Badook Events) is shown on the billing page; a plan bought with it renews at the same price until you cancel or replace it.',
          ],
        },
        {
          id: 'cancel',
          heading: '2. Cancelling a plan',
          body: [
            {
              list: [
                'Where: sign in and open the billing page (“Billing”), then choose “Cancel subscription” (or “Move to Free”). You will be asked to confirm. You do not need to contact us, and cancelling does not depend on a reason.',
                'When it takes effect: immediately. The cancellation is recorded as soon as you confirm, and no further monthly charge is attempted. We do not need three business days, and no one has to approve it.',
                'What stays: the plan, and everything it includes, remains active until the end of the period already paid for, and then the account moves to the free plan. Your invitations stay and published invitations keep working, within the free plan’s limits. Unused credits stay in your account.',
                'Confirmation: the billing page shows that the plan is cancelled and until when it is active.',
                'If you cannot sign in, write to us (section 7) and we will cancel it for you after verifying that you are the account holder.',
              ],
            },
            'Cancelling stops future charges only. It does not by itself refund a charge that was already made — see sections 3 and 4.',
          ],
        },
        {
          id: 'no-refund-period',
          heading: '3. The paid period that has begun',
          body: [
            'A monthly plan is a service supplied over time. Unless section 4 applies or a law says otherwise, a charge for a month that has begun is not refunded when you cancel, because the plan stays available to you until that month ends. You keep using it until then.',
            'If a charge was made by mistake, twice, after you cancelled, or for a plan you did not choose, tell us (section 7): we will check it and refund what should not have been charged.',
          ],
        },
        {
          id: 'statutory',
          heading: '4. Cancelling a purchase within the period the law gives consumers',
          body: [
            'Where the Consumer Protection Law, 5741-1981 applies to your purchase — you are a consumer and the purchase was made at a distance, such as over the internet — it gives you the right to cancel the transaction within 14 days of the day it was made, or of the day you received the written details of the transaction if that is later. The law has exceptions, and it does not apply to every purchase; if it does not apply to yours we will tell you why in our reply.',
            {
              list: [
                'How: write to us (section 7) with the email of your account and the purchase you are cancelling. State that you are cancelling under the law.',
                'What you receive: a refund of what you paid, less (a) a cancellation fee that the law allows, which is not more than the lower of 5% of the price or ₪100 — we charge it only where the law permits it and not where the cancellation is because of our fault or a defect in the service — and (b) where the law allows, the value of what you already used, for example WhatsApp messages that were already sent from the purchase.',
                'Refunded in: the refund is made to the payment method you used, within 14 days of your notice, by the payment provider. When it appears on your statement depends on your card issuer.',
                'After a refund the paid plan ends and the account moves to the free plan.',
              ],
            },
          ],
        },
        {
          id: 'credits',
          heading: '5. WhatsApp credits',
          body: [
            {
              list: [
                'Credits that were used to send a message are not refunded, because the message was already delivered through WhatsApp, which charges for it.',
                'Credits that were not used can be refunded within 14 days of the purchase, less the cancellation fee allowed under section 4. This is a commitment we make in addition to the law, and it applies whether or not the law applies to your purchase.',
                'A message that failed to send returns its credit to your balance automatically; that is not a refund of money.',
                'Credits that come with a plan each month are part of the plan and are not refundable in money. They stay in your balance after you cancel.',
                'Credits do not expire. We do not reduce or remove credits that you bought, except to refund them under this section or when we close an account for breaking the terms.',
              ],
            },
          ],
        },
        {
          id: 'failed',
          heading: '6. A charge that fails',
          body: [
            'If the monthly charge is declined, we try again a few times over the following days and the account stays on its plan meanwhile. If it does not go through within 14 days of the due date, the account moves to the free plan. You can pay again at any time from the billing page, with another card if you like.',
            'After you cancel, our system makes no further monthly charge. If a charge nevertheless reaches you — for example because the payment provider processed it before the cancellation reached it — tell us and we will refund it.',
          ],
        },
        {
          id: 'process',
          heading: '7. How to ask us, and how we answer',
          body: [
            `${contactLine(c)} Mention the email of your account, the date and the amount.`,
            'We handle refund requests by hand: a person checks the account and the payment, and we reply to say whether a refund is due and why. If a refund is due, we make it through the payment provider. We answer as soon as we can, and a refund that the law requires is made within the period the law sets.',
            'These payments are processed by the payment provider chosen for the Service, whose own records show the transaction. We keep the invoice and payment records as tax law requires (see the privacy policy).',
          ],
        },
        {
          id: 'changes',
          heading: '8. Changes',
          body: [
            'We may update this policy. A change applies to purchases and renewals made after it takes effect, not to a purchase you already made. Earlier versions are kept and can be opened from the bottom of this page. Price changes are announced by email in advance and apply from the next billing period.',
          ],
        },
        {
          id: 'contact',
          heading: '9. Contact',
          body: [contactLine(c)],
        },
      ],
    };
  }
  return {
    title: 'מדיניות ביטולים והחזרים',
    description: `איך מבטלים מנוי ב־${c.brand}, מתי מגיע החזר כספי, ומה קורה לקרדיטים של וואטסאפ.`,
    intro: [
      `המדיניות מסבירה איך מבטלים חבילה בתשלום ב־${c.brand} (שמפעילה ${who}), מתי אפשר לקבל החזר כספי, ומה קורה לקרדיטים לשליחת הודעות וואטסאפ שנרכשו. היא חלק מתנאי השימוש, ואינה מגבילה זכות שהחוק נותן לכם כצרכנים.`,
      {
        note: 'בקצרה: אפשר לבטל חבילה בעצמכם בכל עת בעמוד החיובים, ולא יבוצעו חיובים נוספים. החבילה נשארת עד סוף התקופה ששולמה. ביטול בתוך התקופה שהחוק נותן לצרכנים מזכה בהחזר כמתואר בסעיף 4.',
      },
    ],
    sections: [
      {
        id: 'what',
        heading: '1. מה אפשר לרכוש',
        body: [
          {
            list: [
              `חבילה חודשית — Pro ב־${money(c.prices.pro)} או Business ב־${money(c.prices.business)} לחודש, כולל מע״מ. היא מתחדשת בכל חודש, באותו תאריך שבו התחילה, עד שתבטלו.`,
              'חבילת קרדיטים — רכישה חד־פעמית של קרדיטים לשליחת הזמנות מהמספר הרשמי של השירות בוואטסאפ. קרדיט נוצל כשהודעה נשלחת, הודעה שנכשלה מחזירה את הקרדיט, וקרדיטים לא פגים.',
            ],
          },
          'המחיר שמוצג לפני התשלום, כולל מע״מ, הוא המחיר שמחויבים בו. הנחת שותף (למשל מ־Badook Events) מופיעה בעמוד החיובים, וחבילה שנקנתה בה מתחדשת באותו מחיר עד שתבטלו או תחליפו אותה.',
        ],
      },
      {
        id: 'cancel',
        heading: '2. ביטול חבילה',
        body: [
          {
            list: [
              'איפה: נכנסים לחשבון ופותחים את עמוד החיובים (״חיובים״), ובוחרים ״ביטול מנוי״ (או ״מעבר לחינמית״). תתבקשו לאשר. אין צורך לפנות אלינו, והביטול לא תלוי בסיבה.',
              'מתי זה נכנס לתוקף: מיד. הביטול נרשם ברגע שאישרתם, ולא ייעשה ניסיון חיוב חודשי נוסף. איננו צריכים שלושה ימי עסקים, ואיש לא צריך לאשר אותו.',
              'מה נשאר: החבילה, וכל מה שהיא כוללת, נשארת פעילה עד סוף התקופה ששולמה, ואז החשבון עובר לחבילה החינמית. ההזמנות שלכם נשארות, והזמנות שפורסמו ממשיכות לעבוד, במגבלות החבילה החינמית. קרדיטים שלא נוצלו נשארים בחשבון.',
              'אישור: עמוד החיובים מראה שהחבילה בוטלה ועד מתי היא פעילה.',
              'אם אי אפשר להיכנס לחשבון, כתבו לנו (סעיף 7) ונבטל עבורכם, אחרי שנוודא שאתם בעלי החשבון.',
            ],
          },
          'ביטול עוצר חיובים עתידיים בלבד. הוא לא מחזיר כשלעצמו חיוב שכבר בוצע — ראו סעיפים 3 ו־4.',
        ],
      },
      {
        id: 'no-refund-period',
        heading: '3. תקופה ששולמה והתחילה',
        body: [
          'חבילה חודשית היא שירות שניתן לאורך זמן. אלא אם חל סעיף 4 או דין אחר קובע אחרת, חיוב על חודש שהתחיל לא מוחזר כשמבטלים, כי החבילה נשארת זמינה לכם עד סוף אותו חודש, ואתם ממשיכים להשתמש בה עד אז.',
          'אם חיוב בוצע בטעות, פעמיים, אחרי שביטלתם, או על חבילה שלא בחרתם, ספרו לנו (סעיף 7): נבדוק ונחזיר מה שלא היה צריך להיגבות.',
        ],
      },
      {
        id: 'statutory',
        heading: '4. ביטול רכישה בתוך התקופה שהחוק נותן לצרכנים',
        body: [
          'כשחוק הגנת הצרכן, התשמ״א־1981, חל על הרכישה שלכם — אתם צרכנים והרכישה נעשתה מרחוק, למשל באינטרנט — הוא נותן לכם זכות לבטל את העסקה תוך 14 יום מהיום שבו נעשתה, או מהיום שבו קיבלתם את פרטי העסקה בכתב אם הוא מאוחר יותר. בחוק יש חריגים, והוא לא חל על כל רכישה; אם הוא לא חל על הרכישה שלכם נסביר בתשובתנו מדוע.',
          {
            list: [
              'איך: כתבו לנו (סעיף 7) עם המייל של החשבון והרכישה שמבטלים, וציינו שאתם מבטלים לפי החוק.',
              'מה מקבלים: החזר של מה ששולם, בניכוי (א) דמי ביטול שהחוק מתיר, שאינם עולים על הנמוך מבין 5% מהמחיר או 100 ₪ — אנחנו גובים אותם רק כשהחוק מתיר, ולא כשהביטול נובע מאשמתנו או מפגם בשירות, וכן (ב) כשהחוק מתיר, שווי מה שכבר נוצל, למשל הודעות וואטסאפ שכבר נשלחו מהרכישה.',
              'מועד ההחזר: ההחזר ייעשה לאמצעי התשלום שבו שילמתם, תוך 14 יום מההודעה שלכם, בידי חברת התשלומים. מתי הוא יופיע בדף החשבון תלוי בחברת האשראי.',
              'אחרי החזר החבילה בתשלום מסתיימת והחשבון עובר לחבילה החינמית.',
            ],
          },
        ],
      },
      {
        id: 'credits',
        heading: '5. קרדיטים לוואטסאפ',
        body: [
          {
            list: [
              'קרדיטים ששימשו לשליחת הודעה אינם מוחזרים בכסף, כי ההודעה כבר נמסרה דרך וואטסאפ, שגובה על כך תשלום.',
              'קרדיטים שלא נוצלו אפשר להחזיר תוך 14 יום מהרכישה, בניכוי דמי הביטול המותרים לפי סעיף 4. זו התחייבות שלנו בנוסף לחוק, והיא חלה גם אם החוק לא חל על הרכישה שלכם.',
              'הודעה שנכשלה בשליחה מחזירה את הקרדיט שלה ליתרה שלכם אוטומטית; זה לא החזר כספי.',
              'קרדיטים שמגיעים עם החבילה בכל חודש הם חלק מהחבילה ואינם ניתנים להחזר בכסף. הם נשארים ביתרה שלכם אחרי הביטול.',
              'קרדיטים לא פגים. איננו מקטינים או מסירים קרדיטים שרכשתם, אלא כדי להחזיר אותם לפי סעיף זה או כשאנחנו סוגרים חשבון בשל הפרת התנאים.',
            ],
          },
        ],
      },
      {
        id: 'failed',
        heading: '6. חיוב שנכשל',
        body: [
          'אם החיוב החודשי נדחה, ננסה שוב כמה פעמים בימים שאחרי, והחשבון נשאר בחבילתו בינתיים. אם החיוב לא עבר תוך 14 יום ממועד החיוב, החשבון עובר לחבילה החינמית. אפשר לשלם שוב בכל עת בעמוד החיובים, גם בכרטיס אחר.',
          'אחרי שביטלתם, המערכת שלנו לא מבצעת חיוב חודשי נוסף. אם בכל זאת הגיע אליכם חיוב — למשל כי חברת התשלומים עיבדה אותו לפני שהביטול הגיע אליה — ספרו לנו ונחזיר.',
        ],
      },
      {
        id: 'process',
        heading: '7. איך פונים אלינו ואיך עונים',
        body: [
          `${contactLine(c)} ציינו את המייל של החשבון, את התאריך ואת הסכום.`,
          'אנחנו מטפלים בבקשות החזר ידנית: אדם בודק את החשבון ואת התשלום, ואנחנו משיבים אם מגיע החזר ומדוע. אם מגיע החזר, אנחנו מבצעים אותו דרך חברת התשלומים. אנחנו עונים מהר ככל האפשר, והחזר שהחוק מחייב ייעשה בתוך התקופה שהחוק קובע.',
          'התשלומים מעובדים בידי חברת התשלומים שנבחרה לשירות, ובתיעוד שלה מופיעה העסקה. אנחנו שומרים חשבוניות ורישומי תשלום כפי שדיני המס מחייבים (ראו מדיניות הפרטיות).',
        ],
      },
      {
        id: 'changes',
        heading: '8. שינויים',
        body: [
          'אנחנו עשויים לעדכן את המדיניות. שינוי חל על רכישות וחידושים שנעשים אחרי כניסתו לתוקף, לא על רכישה שכבר ביצעתם. גרסאות קודמות נשמרות ואפשר לפתוח אותן בתחתית העמוד. שינויי מחיר מוכרזים מראש במייל וחלים מתקופת החיוב הבאה.',
        ],
      },
      {
        id: 'contact',
        heading: '9. יצירת קשר',
        body: [contactLine(c)],
      },
    ],
  };
}
