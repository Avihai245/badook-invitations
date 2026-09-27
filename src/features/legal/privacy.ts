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
                'What hosts create: event details, texts (and their translations into the invitation’s other languages), photos, videos, songs and links they add to an invitation, and their settings.',
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
                'Anthropic — answering questions in the support assistant (the text of the question only); when the host’s plan includes it, the automatic check of photos uploaded to an event’s live gallery (a small thumbnail of the photo only) and design suggestions from the host’s chosen photos (small copies, section 7C); and, when a host asks for automatic translation, the invitation’s texts in the language they are written in, which Anthropic returns translated (names in the texts may be part of them and are kept as they are, like the words on the invitation’s list of words never translated; nothing about guests is sent);',
                'Microsoft (Azure AI Speech, European Union) — when the host’s plan includes it, reading the invitation’s own texts aloud (section 7C);',
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
          id: 'team',
          heading: '6A. What the Badook team can see and do',
          body: [
            'A small team runs the Service from an internal console. Each member has a role that decides what they can see and do there, and nothing beyond it:',
            {
              list: [
                'Owners and admins run the Service and manage the team. Support answers support requests and can see customers’ contact details to do so. Finance handles payments and can see customers’ contact details for that. Other roles see the numbers only: emails and phone numbers are hidden from them.',
                'What the team sees: hosts’ accounts (name, where the account came from, plan, credits, payments — and the email and phone only in the roles that need them) and, for each invitation, its details and its numbers: how many guests, replies, messages and visits. Not the guests’ own details or replies.',
                'What the team can change, and only with a reason: add or remove message credits, give a plan for a limited time or a discount, turn on a feature for one invitation beyond its plan, and suspend or restore an account’s sign-in. A suspended account can’t sign in; its invitations already published keep working for its guests.',
                'Every action of the team is recorded — who did it, what, when and why — and the record is kept for two years, then deleted.',
              ],
            },
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
                'Automatic translations: the translated texts, and whether the host approved them, are kept with the invitation until the host deletes it or the account; the record of each translation run (kept for the daily limit) is erased after two days.',
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
                'Sending guests the gallery’s link: when the host sends it from our WhatsApp number, we keep for each family when it was sent and the message’s delivery status, as with invitations.',
                'The highlights film: a host can make a short film of the gallery. It is made in the host’s own browser — the photos are read there, not by our servers — and a song the host picks for it stays on their computer. If the host adds the film to the gallery, it is kept like any other upload (and shown to guests only if the host chooses).',
                'The gallery itself does not recognize faces. Face recognition is used only by face search (section 7C), when the host turns it on and each guest who searches agrees.',
              ],
            },
            'A guest who wants a photo of them removed can ask the host, or contact us (section 8).',
          ],
        },
        {
          id: 'faces',
          heading: '7C. “The photos I’m in”: face search in the gallery (only where it is on)',
          body: [
            {
              note: c.faceSearch
                ? 'This section applies only to events whose host turned face search on. Where it is off, no face is processed.'
                : 'This section applies only to events whose host turned face search on. Face search is not offered on the site at this time, so no face is processed.',
            },
            'When a host turns it on, each guest can find the gallery’s photos they appear in, from a selfie. Faces are biometric information, so this happens only with the explicit consent of each guest who searches — a separate checkbox, unticked, before anything else — and it is off unless the host turns it on.',
            {
              list: [
                'The selfie: taken or chosen on the guest’s phone and processed there only; it is never sent to us and never kept. The phone turns the face into a “face code” — a series of 128 numbers — with an open-source face recognition model that runs in the browser (downloaded from our own site the first time). Only the face code is sent, once for each search, to be compared with the gallery’s face codes in our database; we don’t store it or write it in any log. On the phone it stays in that browser tab until the tab is closed or the guest chooses “Forget me”.',
                'The gallery’s photos: the faces in them are found on devices — the phone that uploaded a photo, or the host’s computer — and for each face only where it is in the photo and its face code are kept. No face is cut out of a photo, no name is attached, and nothing links a face to a guest’s identity.',
                'What the guest gets: an album of the published photos they appear in, which they can download.',
                'Leaving out: a guest can ask not to appear in other guests’ searches. The faces that match them are removed from search at once, and their face code (not a photo) is kept only so that photos added later leave them out too.',
                '“Forget me”: removes the faces that match the guest from search at once, deletes any request of theirs to be left out, and clears the face code from their phone.',
                'The host sees only numbers — how many photos are ready for search, how many faces, how many guests asked to be left out — never face codes or who is in which photo.',
                'How long: all of an event’s face data is erased 30 days after the event, at once when the host turns face search off or deletes the gallery, and with the account.',
                'Where: in our own systems only (Supabase, European Union). No face data is sent to anyone else.',
              ],
            },
          ],
        },
        {
          id: 'insights',
          heading: '7D. Invitation insights: how guests use an invitation',
          body: [
            'A host whose plan includes it sees how guests use an invitation — totals only, never who did what.',
            {
              list: [
                'What an invitation page counts: that it was opened, in which language, on what kind of device (phone, tablet or computer — worked out from the browser, whose details aren’t kept), and how the guest got there (a personal link, the shared link, the QR code, or another way); whether the cover was opened, how far down the page was read, how long the page was on screen (up to 30 minutes), and whether the guest started or sent an RSVP, added the event to a calendar, opened the map or navigation, opened the gallery, or switched language.',
                'No cookies, and nothing is kept on the guest’s device: each time the page is opened it picks a random number, kept only in the page’s memory, so that its updates count once. Nothing at all is measured when the browser asks sites not to track (Global Privacy Control or Do Not Track).',
                'We don’t keep IP addresses or browser details for this: an IP address is used only as a one-way hash, to limit abuse (section 7). Automated visitors are not counted.',
                'How long: each page load’s own record is erased after 7 days; the daily totals the host sees stay with the invitation until it, or the account, is deleted.',
              ],
            },
          ],
        },
        {
          id: 'event-day',
          heading: '7B. The event day: table numbers and check-in at the entrance',
          body: [
            'A host whose plan includes it can tell each guest their table with a map to it, and check guests in at the entrance of the event. This information is collected for the host, like a guest list (section 1).',
            {
              list: [
                'The table guide: a guest’s personal link opens their own table and the hall’s map, never other guests’ names. The page is kept on the guest’s phone for the evening, so it works without signal. Turning the map with the phone uses the phone’s compass on the phone only: nothing about where the phone points or where it is reaches us.',
                'Telling guests their table: when the host sends table numbers from our WhatsApp number, we keep for each family the number it was sent, when, and the message’s delivery status, as with invitations; a number the host marks as told themselves is kept the same way. This stays with the guest list until the host deletes it, the invitation or the account.',
                'Check-in: when a family arrives, the entrance station records which family arrived, how many people, the time, and the name the staff gave their station. The staff open the station from a link the host shares, without an account; there they can find the event’s guests by name or phone and see each family’s table. The entrance code on a guest’s guide (and on printed table cards) is derived from their personal link and identifies the family only to that event’s station.',
                'Re-seating: families moved between tables (from where to where, when, and the reason the host wrote) are kept in the seating’s history, with the seating.',
                'How long: check-ins are erased 30 days after the event’s date, and a check-in that was undone after a day.',
              ],
            },
          ],
        },
        {
          id: 'studio',
          heading: '7C. Family review, design suggestions, versions, read aloud',
          body: [
            {
              list: [
                'Family review: a host can send a private link to the draft of an invitation for family members to comment on, without an account. We keep the comments, the name each person types, when they were written and the host’s replies; the name is also kept in that person’s browser so they don’t type it again, with a random key that lets them delete their own comment (we keep only a one-way hash of it). The link itself is kept only as a one-way hash; the host can set it to expire, replace it or revoke it at any time. The page sends no RSVP and counts nobody. The comments are erased 90 days after the event’s date (the host can delete them earlier), and deleted comments after 30 days.',
                'Design suggestions (“design it for me”): the photos a host chooses are made smaller on the host’s device and, when the plan includes it, sent to Anthropic with the event type, the languages and the mood the host typed — no names or other details — to suggest three designs. Nothing is kept by us from that request, and the photos are never written to our logs. A design the host chooses uploads the photos it uses to the invitation, like any photo the host adds.',
                'Versions: besides each published version, we keep copies of an invitation’s draft as the host edits (at most one every 10 minutes, and before a restore or a new design) so that any of them can be restored. They are kept 90 days, 60 per invitation at most; published versions are kept with the invitation.',
                'Read aloud: when the plan includes it, the invitation’s own texts (the names, date, places and the host’s texts — never guests’ details) are sent to Microsoft (Azure AI Speech, European Union) once per language when the host publishes, and the audio it returns is stored with the invitation’s files until the texts change or the invitation or account is deleted. When a guest listens without that audio, their own device reads the text. Listening is not recorded anywhere.',
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
            'We use essential cookies to run the site. External content on the site’s own pages (videos from YouTube in its privacy-enhanced mode, Vimeo, Google Maps) loads by default, and you can turn it off at any time. The cookie policy has the details, and the “Cookie settings” link at the bottom of the site’s pages changes your choice.',
            'Invitation insights (section 7D) use no cookies and keep nothing on the guest’s device.',
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
              'מה שמארחים יוצרים: פרטי האירוע, טקסטים (והתרגומים שלהם לשפות האחרות של ההזמנה), תמונות, סרטונים, שירים וקישורים שמוסיפים להזמנה, וההגדרות שלה.',
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
              'Anthropic: מענה לשאלות בעוזר התמיכה (רק טקסט השאלה); כשהחבילה של המארח כוללת את זה, הבדיקה האוטומטית של תמונות שמועלות לגלריה החיה של אירוע (רק תמונה ממוזערת של התמונה) והצעות עיצוב מהתמונות שהמארח בחר (עותקים מוקטנים, סעיף 7ג); וכשמארח מבקש תרגום אוטומטי, הטקסטים של ההזמנה בשפה שבה נכתבו, ו־Anthropic מחזירה אותם מתורגמים (שמות שבטקסטים יכולים להיות חלק מהם, והם נשארים כמו שהם, כמו המילים ברשימת ״מילים שלא מתרגמים״ של ההזמנה; שום דבר על המוזמנים לא נשלח);',
              'Microsoft (Azure AI Speech, באיחוד האירופי): כשהחבילה של המארח כוללת את זה, הקראת הטקסטים של ההזמנה עצמה (סעיף 7ג);',
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
        id: 'team',
        heading: '6א. מה צוות Badook רואה ויכול לעשות',
        body: [
          'צוות קטן מפעיל את השירות ממערכת ניהול פנימית. לכל חבר צוות יש תפקיד שקובע מה הוא רואה ומה הוא יכול לעשות בה, ולא יותר מזה:',
          {
            list: [
              'בעלים ואדמינים מפעילים את השירות ומנהלים את הצוות. צוות התמיכה עונה לפניות, ובשביל זה רואה את פרטי הקשר של הלקוחות. צוות הכספים מטפל בתשלומים, ובשביל זה רואה את פרטי הקשר של הלקוחות. תפקידים אחרים רואים רק מספרים: המיילים ומספרי הטלפון מוסתרים מהם.',
              'מה הצוות רואה: את חשבונות המארחים (שם, מאיפה החשבון הגיע, החבילה, הקרדיטים והתשלומים — ואת המייל והטלפון רק בתפקידים שצריכים אותם), ולכל הזמנה את הפרטים שלה ואת המספרים שלה: כמה מוזמנים, תשובות, הודעות וכניסות. לא את הפרטים של האורחים עצמם ולא את התשובות שלהם.',
              'מה הצוות יכול לשנות, ורק עם סיבה: להוסיף או להוריד קרדיטים להודעות, לתת חבילה לזמן מוגבל או הנחה, לפתוח יכולת להזמנה אחת מעבר לחבילה, ולהשעות או להחזיר את הכניסה לחשבון. לחשבון מושעה אי אפשר להיכנס; ההזמנות שלו שכבר פורסמו ממשיכות לעבוד לאורחים.',
              'כל פעולה של הצוות נרשמת — מי עשה אותה, מה, מתי ולמה — והרישום נשמר שנתיים, ואז נמחק.',
            ],
          },
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
              'תרגומים אוטומטיים: הטקסטים המתורגמים, והאם המארח אישר אותם, נשמרים עם ההזמנה עד שהמארח מוחק אותה או את החשבון; הרישום של כל הפעלת תרגום (בשביל המגבלה היומית) נמחק אחרי יומיים.',
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
              'שליחת הקישור לגלריה לאורחים: כשהמארח שולח אותו מהמספר שלנו בוואטסאפ, נשמרים לכל משפחה מתי נשלח ומצב המסירה של ההודעה, כמו בהזמנות.',
              'סרט הרגעים: מארח יכול ליצור סרט קצר מהגלריה. הסרט נוצר בדפדפן של המארח עצמו — התמונות נקראות שם, לא בשרתים שלנו — ושיר שהמארח בוחר בשבילו נשאר במחשב שלו. אם המארח מוסיף את הסרט לגלריה, הוא נשמר כמו כל העלאה אחרת (ומוצג לאורחים רק אם המארח בוחר בכך).',
              'הגלריה עצמה לא מזהה פנים. זיהוי פנים משמש רק בחיפוש לפי פנים (סעיף 7ג), כשהמארח מפעיל אותו וכל אורח שמחפש מסכים.',
            ],
          },
          'אורח שרוצה שתמונה שלו תוסר יכול לבקש זאת מהמארח, או לפנות אלינו (סעיף 8).',
        ],
      },
      {
        id: 'faces',
        heading: '7ג. ״התמונות שאני בהן״: חיפוש לפי פנים בגלריה (רק היכן שהוא מופעל)',
        body: [
          {
            note: c.faceSearch
              ? 'הסעיף הזה חל רק על אירועים שהמארח שלהם הפעיל חיפוש לפי פנים. כשהחיפוש כבוי, שום פנים לא מעובדים.'
              : 'הסעיף הזה חל רק על אירועים שהמארח שלהם הפעיל חיפוש לפי פנים. החיפוש לפי פנים לא מוצע באתר כרגע, ולכן שום פנים לא מעובדים.',
          },
          'כשהמארח מפעיל אותו, כל אורח יכול למצוא את התמונות בגלריה שהוא מופיע בהן, לפי סלפי. פנים הם מידע ביומטרי, ולכן זה קורה רק בהסכמה מפורשת של כל אורח שמחפש — בתיבת סימון נפרדת, לא מסומנת מראש, לפני כל דבר אחר — והחיפוש כבוי אלא אם המארח מפעיל אותו.',
          {
            list: [
              'הסלפי: מצולם או נבחר בטלפון של האורח ומעובד רק שם; הוא אף פעם לא נשלח אלינו ולא נשמר. הטלפון הופך את הפנים ל״קוד פנים״ — סדרה של 128 מספרים — בעזרת מודל קוד פתוח לזיהוי פנים שרץ בדפדפן (ונטען מהאתר שלנו בפעם הראשונה). רק קוד הפנים נשלח, פעם אחת לכל חיפוש, כדי להשוות אותו לקודי הפנים של הגלריה במסד הנתונים שלנו; אנחנו לא שומרים אותו ולא רושמים אותו באף יומן. בטלפון הוא נשאר בלשונית הדפדפן עד שסוגרים אותה או בוחרים ״לשכוח אותי״.',
              'התמונות בגלריה: הפנים שבהן נמצאים במכשירים — בטלפון שהעלה את התמונה, או במחשב של המארח — ולכל פנים נשמרים רק המיקום שלהם בתמונה וקוד הפנים. שום פנים לא נגזרים מתמונה, שום שם לא מוצמד, ושום דבר לא מקשר בין פנים לזהות של אורח.',
              'מה האורח מקבל: אלבום של התמונות שפורסמו ושהוא מופיע בהן, שאפשר להוריד.',
              'השמטה: אורח יכול לבקש לא להופיע בחיפושים של אורחים אחרים. הפנים שתואמים לו מוסרים מהחיפוש מיד, וקוד הפנים שלו (לא תמונה) נשמר רק כדי שגם תמונות שיתווספו אחר כך ישמיטו אותו.',
              '״לשכוח אותי״: מסיר מיד מהחיפוש את הפנים שתואמים לאורח, מוחק בקשת השמטה שלו אם הייתה, ומוחק את קוד הפנים מהטלפון שלו.',
              'המארח רואה רק מספרים — כמה תמונות מוכנות לחיפוש, כמה פנים, כמה אורחים ביקשו להישמט — אף פעם לא קודי פנים ולא מי מופיע באיזו תמונה.',
              'כמה זמן: כל נתוני הפנים של אירוע נמחקים 30 יום אחרי האירוע, מיד כשהמארח מכבה את החיפוש או מוחק את הגלריה, ועם מחיקת החשבון.',
              'איפה: רק במערכות שלנו (Supabase, באיחוד האירופי). שום נתון פנים לא נשלח לאף גורם אחר.',
            ],
          },
        ],
      },
      {
        id: 'insights',
        heading: '7ד. נתוני ההזמנה: איך אורחים משתמשים בהזמנה',
        body: [
          'מארח שהחבילה שלו כוללת את זה רואה איך אורחים משתמשים בהזמנה — רק סיכומים, אף פעם לא מי עשה מה.',
          {
            list: [
              'מה עמוד ההזמנה סופר: שהוא נפתח, באיזו שפה, באיזה סוג מכשיר (טלפון, טאבלט או מחשב — לפי הדפדפן, שפרטיו לא נשמרים), ואיך האורח הגיע (קישור אישי, הקישור המשותף, קוד ה־QR או דרך אחרת); אם המעטפה נפתחה, עד כמה נקרא העמוד, כמה זמן הוא היה על המסך (עד 30 דקות), ואם האורח התחיל או שלח אישור הגעה, הוסיף את האירוע ליומן, פתח את המפה או הניווט, פתח את הגלריה או החליף שפה.',
              'בלי עוגיות, ושום דבר לא נשמר במכשיר של האורח: בכל פתיחה העמוד בוחר מספר אקראי שנשמר רק בזיכרון של העמוד, כדי שהעדכונים שלו ייספרו פעם אחת. כשהדפדפן מבקש מאתרים לא לעקוב (Global Privacy Control או Do Not Track) — לא נמדד כלום.',
              'אנחנו לא שומרים לשם כך כתובות IP או פרטי דפדפן: כתובת IP משמשת רק כגיבוב חד־כיווני, להגבלת שימוש לרעה (סעיף 7). מבקרים אוטומטיים לא נספרים.',
              'כמה זמן: הרישום של כל פתיחה נמחק אחרי 7 ימים; הסיכומים היומיים שהמארח רואה נשמרים עם ההזמנה עד שהיא, או החשבון, נמחקים.',
            ],
          },
        ],
      },
      {
        id: 'event-day',
        heading: '7ב. יום האירוע: מספרי שולחנות ורישום בכניסה',
        body: [
          'מארח שהחבילה שלו כוללת את זה יכול לשלוח לכל אורח את השולחן שלו עם מפה אליו, ולרשום את האורחים בכניסה לאירוע. המידע הזה נאסף עבור המארח, כמו רשימת המוזמנים (סעיף 1).',
          {
            list: [
              'מדריך השולחן: הקישור האישי של אורח פותח את השולחן שלו ואת מפת האולם, אף פעם לא שמות של אורחים אחרים. העמוד נשמר בטלפון של האורח לערב האירוע, כדי שיעבוד גם בלי קליטה. סיבוב המפה עם הטלפון משתמש במצפן של הטלפון בטלפון בלבד: שום דבר על הכיוון או המיקום של הטלפון לא מגיע אלינו.',
              'שליחת מספר השולחן: כשהמארח שולח מספרי שולחנות מהמספר שלנו בוואטסאפ, נשמרים לכל משפחה המספר שנשלח, מתי, ומצב המסירה של ההודעה, כמו בהזמנות; מספר שהמארח מסמן שמסר בעצמו נשמר באותו אופן. המידע נשמר עם רשימת המוזמנים, עד שהמארח מוחק אותה, את ההזמנה או את החשבון.',
              'רישום בכניסה: כשמשפחה מגיעה, עמדת הכניסה רושמת איזו משפחה הגיעה, כמה אנשים, מתי, ואת השם שנתנו לעמדה. הצוות פותח את העמדה מקישור שהמארח משתף, בלי חשבון; בעמדה אפשר למצוא את אורחי האירוע לפי שם או טלפון ולראות את השולחן של כל משפחה. קוד הכניסה שבמדריך של האורח (ועל כרטיסי שולחן מודפסים) נגזר מהקישור האישי שלו, ומזהה את המשפחה רק בעמדה של אותו אירוע.',
              'הושבה מחדש: העברות של משפחות בין שולחנות (מאיפה לאן, מתי, והסיבה שהמארח כתב) נשמרות בהיסטוריה של סידור השולחנות, יחד עם הסידור.',
              'כמה זמן: רישומי הכניסה נמחקים 30 יום אחרי תאריך האירוע, ורישום שבוטל נמחק אחרי יום.',
            ],
          },
        ],
      },
      {
        id: 'studio',
        heading: '7ג. עיון המשפחה, הצעות עיצוב, גרסאות והקראה',
        body: [
          {
            list: [
              'עיון המשפחה: מארח יכול לשלוח לבני המשפחה קישור פרטי לטיוטה של ההזמנה, כדי שיעירו עליה בלי חשבון. נשמרים ההערות, השם שכל אחד מקליד, מתי נכתבו, והתשובות של המארח; השם נשמר גם בדפדפן של אותו אדם כדי שלא יצטרך להקליד אותו שוב, עם מפתח אקראי שמאפשר לו למחוק את ההערה שלו (אנחנו שומרים רק גיבוב חד־כיווני שלו). הקישור עצמו נשמר רק כגיבוב חד־כיווני; המארח יכול לקבוע לו תפוגה, להחליף אותו או לבטל אותו בכל רגע. העמוד לא שולח אישורי הגעה ולא סופר אף אחד. ההערות נמחקות 90 יום אחרי תאריך האירוע (המארח יכול למחוק אותן קודם), והערות שנמחקו אחרי 30 יום.',
              'הצעות עיצוב ("עצבו לי"): התמונות שהמארח בוחר מוקטנות במכשיר שלו, וכשהחבילה כוללת את זה נשלחות ל־Anthropic יחד עם סוג האירוע, השפות ומצב הרוח שהמארח הקליד (בלי שמות ובלי פרטים אחרים), כדי להציע שלושה עיצובים. אנחנו לא שומרים דבר מהבקשה הזו, והתמונות לא נכתבות ליומנים שלנו. עיצוב שהמארח בוחר מעלה להזמנה את התמונות שהוא משתמש בהן, כמו כל תמונה שהמארח מוסיף.',
              'גרסאות: מלבד כל גרסה שפורסמה, אנחנו שומרים עותקים של טיוטת ההזמנה בזמן העריכה (לכל היותר פעם ב־10 דקות, ולפני שחזור או עיצוב חדש), כדי שאפשר יהיה לשחזר כל אחד מהם. הם נשמרים 90 יום, עד 60 להזמנה; גרסאות שפורסמו נשמרות עם ההזמנה.',
              'הקראת ההזמנה: כשהחבילה כוללת את זה, הטקסטים של ההזמנה עצמה (השמות, התאריך, המקומות והטקסטים של המארח — לעולם לא פרטים של אורחים) נשלחים ל־Microsoft (Azure AI Speech, באיחוד האירופי) פעם אחת לכל שפה כשהמארח מפרסם, וההקראה שמתקבלת נשמרת עם הקבצים של ההזמנה עד שהטקסטים משתנים או שההזמנה או החשבון נמחקים. אורח שמאזין כשאין הקראה כזו, המכשיר שלו עצמו מקריא את הטקסט. ההאזנה לא נרשמת בשום מקום.',
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
          'אנחנו משתמשים בעוגיות חיוניות להפעלת האתר. תוכן חיצוני בעמודי האתר עצמו (סרטונים מ־YouTube במצב הפרטיות המוגברת שלו, Vimeo ומפות Google) נטען כברירת מחדל, ואפשר לכבות אותו בכל רגע. כל הפרטים במדיניות העוגיות, ובקישור ״הגדרות עוגיות״ בתחתית עמודי האתר אפשר לשנות את הבחירה.',
          'נתוני ההזמנה (סעיף 7ד) לא משתמשים בעוגיות ולא שומרים שום דבר במכשיר של האורח.',
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
