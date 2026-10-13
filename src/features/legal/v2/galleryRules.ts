import type { LegalContext, LegalDoc } from '../types';
import { contactLine, operatorLine } from './shared';

/**
 * The event gallery and user-generated content rules (new in version 2): a separate, mandatory document
 * linked from the terms and from every guest gallery page. It describes the gallery as it actually works
 * (verified in the compliance audit): link-based access with an optional code; the host's approval
 * mode; the host sees pending and rejected uploads; guests see thumbnails and display copies, and a
 * video's original file; hosts download originals; no comments (posts, stories and likes only); a
 * guest deletes from the device that uploaded; the host deletes anything; nothing expires by itself
 * after the event; face search and AI photos are separate, opt-in features. Statements about the law
 * are limited to what the Privacy Protection Law, the Copyright Law and the Prevention of Sexual
 * Harassment Law say in general terms; counsel confirms them (docs/legal/decision-records.md).
 */
export function galleryRulesDoc(c: LegalContext): LegalDoc {
  const who = operatorLine(c);
  const faces = c.faceSearch;
  if (c.locale === 'en') {
    return {
      title: 'Event gallery and user-generated content rules',
      description: `The rules of the live event gallery on ${c.brand}: who may upload, who sees the photos, people who appear in them, children, rights, reporting, removal and deletion.`,
      intro: [
        `A live gallery is a shared album for one event. The host (the person who created the event on ${c.brand}) opens it and shares a link or QR code; guests add photos and videos from their phones, without an account. ${c.brand} is run by ${who} (“we”). These rules bind the hosts who open galleries and the guests who use them, and are part of the terms of use.`,
        {
          note: 'In plain words: share photos you took or may share; remember that everyone with the link and the host can see them; do not post other people’s children, or anything that humiliates or exposes someone; anyone who appears in a photo can ask for it to be removed, and we will look into it.',
        },
      ],
      sections: [
        {
          id: 'what',
          heading: '1. What the gallery is',
          body: [
            'The gallery is a private social space for the guests of one event, not a public website. It is not listed or searchable. It works through a link (and, if the host set one, an access code), so anyone who has the link and the code can open it — see section 9.',
            'In the gallery guests upload photos and videos, watch a live feed, can post to the feed or add a “story”, can like items, and can find and download photos (and, if the host turned it on, search for the photos they appear in — section 14). There are no free-text comments. The host can also show the gallery on a screen at the venue and share an album page after the event.',
          ],
        },
        {
          id: 'who',
          heading: '2. Who may upload',
          body: [
            {
              list: [
                'Anyone who holds the link (and the access code, if the host set one) and who is within the upload window the host set may upload. Guests do not need an account.',
                'Uploading is for people who attend or are invited to the event, or whom the host invited to contribute. If you received the link by mistake, please do not upload.',
                'The host decides who receives the link, whether uploads are approved before they appear, whether uploads are paused, and when the gallery is open. The host is responsible for choosing guests and for telling them how the gallery works.',
              ],
            },
          ],
        },
        {
          id: 'uploads',
          heading: '3. What happens to an upload',
          body: [
            {
              list: [
                'Before the first upload from a device you are shown a short notice with the main points of these rules, and asked to acknowledge it. The acknowledgement is recorded against a random device identifier for that event (not your name) together with the version of the rules.',
                'Your phone checks each photo for blur, darkness and duplicates. If the host’s plan includes it, a small thumbnail of the photo — without any name — is also sent to an automatic content check run by an AI provider (Anthropic). The checks only help sort uploads: an item the checks flag waits for the host, and a person can always review it. They are not a guarantee that nothing improper gets through.',
                'The upload then appears in the feed immediately, or waits for the host’s approval if the host chose approval mode or a check held it. The host sees everything, including items that are waiting or were rejected or hidden, and can publish, hide, reject or delete any of them.',
                'The uploader sees their own items from the same device, with their status.',
              ],
            },
          ],
        },
        {
          id: 'posts',
          heading: '4. Posts, stories, names and likes',
          body: [
            'Photos and videos can be shown in the feed as posts and as stories. You may add a display name (it is shown with your items to other guests and to the host) and, optionally, an Instagram handle so that you can be tagged. Both are optional and you can leave them out. Guests can like an item; a like is kept as an anonymous one-way hash for that event. If you came through your personal invitation link, the host can see which guest from the guest list the upload came from.',
          ],
        },
        {
          id: 'prohibited',
          heading: '5. What must not be uploaded',
          body: [
            {
              list: [
                'Anything you do not have the right to share, including other people’s photographs, videos and music.',
                'Nudity or sexual content, and any intimate image of a person who has not clearly agreed to it being shared. Sharing such an image without consent can be a criminal offence and a serious invasion of privacy.',
                'Photos or videos that humiliate, degrade, expose or harass a person, or that are likely to, including in circumstances where a person is private (for example changing, in a bathroom, asleep or unwell).',
                'Photographs of children who are not yours, or whose parents or guardians have not agreed, in which the child can be identified — see section 7.',
                'Violence, hate, threats, illegal activity or content that endangers anyone.',
                'Advertising, spam or content unrelated to the event.',
                'Content that impersonates another person, or that is uploaded in another person’s name.',
                'Files that contain malware, or that are not photos or videos.',
              ],
            },
            'This does not make ordinary event photography a problem: pictures of people having a good time at a celebration are what the gallery is for. The rules are about the exceptions.',
          ],
        },
        {
          id: 'people',
          heading: '6. People who appear in photos',
          body: [
            'The person who uploads a photo and the people who appear in it are different people with different rights. The uploader’s acknowledgement of these rules is not the consent of anyone else; attending an event is not blanket consent to every use of a photograph; and a host who opens a gallery does not obtain the consent of the guests photographed. The Privacy Protection Law protects people against, among other things, publication of their photograph in a way likely to humiliate or degrade them, photographing a person in a private place, disclosure of private information, and the use of a person’s name or picture for profit without permission.',
            {
              list: [
                'If you appear in a photo and want it removed, you do not need an account and you do not need the original uploader’s device: use “Report content” (section 11) from the photo, or the report form with a link to the gallery. You can also ask the host.',
                'We look into every such request. We decide each case on its merits — the context of the photo, who can see it, whether it humiliates or exposes you, and whether you are a child — and we remove or hide items when removal is warranted; we do not remove ordinary pictures of people who simply attended the event only because they would rather not be seen, unless the host agrees or the law requires it. You can always ask the host, who may remove it.',
                'If someone uploads items in your name, or pretends to be you, report it in the same way.',
              ],
            },
          ],
        },
        {
          id: 'children',
          heading: '7. Children',
          body: [
            'Photographs and details of children are a heightened privacy risk. The Privacy Protection Authority recommends not publishing identifiable photographs of other people’s children without the consent of their parents. Please follow that recommendation in the gallery: upload photos of your own children, or of children whose parents agreed; do not upload photos of other people’s children in which they can be identified, and never anything that could embarrass a child or show a child undressed. A guest cannot authorise the use of another person’s child’s image.',
            {
              list: [
                'A parent or guardian can ask for a photo of their child to be hidden or removed. Use “Report content” and choose “A child”; a report about a child is handled first, and the item is hidden for review at once — you do not need to explain why or to prove anything at this stage.',
                'Hosts of events at which many children attend (a bar or bat mitzvah, a brit, a birthday) should tell guests before the event that the gallery exists and should consider approval mode. We recommend that hosts do not turn on face search for such events (section 14). These are protective recommendations, not conditions imposed by law.',
                'Photos that contain a child’s identifying details (a school, a home address) or that show their location should not be uploaded. We try to remove location data from files (section 12) but cannot promise to for every kind of file.',
              ],
            },
          ],
        },
        {
          id: 'harm',
          heading: '8. Intimate and other seriously harmful images',
          body: [
            'If an intimate or sexual image, or an image of a child that is sexual or abusive, appears in a gallery, report it straight away with “Report content” and choose “Harmful content”, ticking that it is an intimate image shared without consent, or “A child”. These reports are urgent: the item is hidden at once and reviewed by a person first. We do not rely only on automatic checks. If a child is in danger, or a crime is being committed, also contact the police; reports to us do not replace reports to the authorities.',
          ],
        },
        {
          id: 'visibility',
          heading: '9. Who can see what, and sharing',
          body: [
            {
              list: [
                'Anyone who has the gallery link (and the access code, if there is one) can open the gallery and see everything that is published, and can upload. Whoever receives the link from a guest has the same access. Do not forward the link to people you would not want to see the photos. The invitation page may itself contain the link, if the host put the gallery on it.',
                'The access code protects the gallery’s feed and uploads. It is optional and the host may change or remove it. Links to the venue screen and to the album page are separate links; the host decides who gets them.',
                'The host sees all items, including those pending, hidden or rejected, who they came from where that is known, and downloads the original files.',
                'The people at the venue see what the host shows on the venue screen.',
                'Guests see thumbnails and display copies of published items. For videos, guests and the album page may also reach the original video file. Guests may download items from the album page.',
                'You may share a photo you downloaded from the gallery outside the platform, but only in the way you would have been permitted to share the original: see section 10. Once a copy is downloaded or screenshotted it is outside the platform and we cannot recall it. Deleting an item here removes our copies; it does not remove copies others have made.',
              ],
            },
          ],
        },
        {
          id: 'rights',
          heading: '10. Copyright and licence',
          body: [
            {
              list: [
                'Copyright in a photograph or video belongs to its creator — usually the person who took it — and stays with them, together with their moral rights, such as the right to be credited. Uploading does not transfer ownership to the host, to other guests or to us.',
                'By uploading you give us a limited, non-exclusive licence to store, copy (including thumbnails and display copies), process, display and deliver the item to the people the gallery’s controls allow to see it, and to run the checks in section 3, for as long as it is in the gallery and only in order to operate the Service. We do not use uploaded items for our own advertising, do not sell them and do not license them to anyone else.',
                'You give the host the right to see, download and keep your upload for the event: to view it, keep it in the event’s album, show it on the venue screen, put it in a highlights film for the event’s guests, and share the album with the event’s guests. Any other use — and in particular use in advertising, on a business’s website or social media, or any sale — needs the separate permission of the uploader and of the people who appear in it, and is not covered by these rules.',
                'Music: do not upload videos or music you do not have the right to share. A highlights film uses the invitation’s song or a song the host picks, which may be someone else’s protected work: the host is responsible for having the right to use it where they share the film. The platform does not license music for sharing outside the event.',
                'If you believe that something in a gallery infringes your copyright, use “Report content”, choose “Copyright”, and give your name and email and say what is yours and where. We will review it, may hide the item while we do, and tell you the outcome. A person whose item was removed can contact us to dispute it.',
              ],
            },
          ],
        },
        {
          id: 'moderation',
          heading: '11. Reporting and removal',
          body: [
            'Anyone — the uploader, a person in a photo, a parent or guardian, a copyright owner, or anyone else — can report an item, with or without an account:',
            {
              list: [
                'Use “Report content” on the item, or the link in the gallery’s footer, or the report form with a link to the gallery. Choose a category (privacy, copyright, a child, harmful content, other) and say who you are in relation to the item (the uploader, a person who appears in it, a parent or guardian, a copyright owner, someone else). You describe the problem in a few lines. A name, email and phone number are optional (an email is needed to receive an answer; copyright reports need your name and email). The report points to the item without showing other guests’ details.',
                'Your report is stored and a person reviews it. Reports about a child or an intimate image are urgent: the item is hidden at once, reversibly, until a decision. We tell the gallery’s host that a report was made, without saying who made it.',
                'We then decide: leave the item, hide it, or remove it. Nothing is deleted automatically only because it was reported: reports can be mistaken or abusive, and false or abusive reports may be disregarded. If you gave an email, we tell you the outcome.',
                'You can also use the privacy request form (section 16) for requests about personal information, and you can contact the Privacy Protection Authority or the courts at any time.',
                'The host can hide or delete any item at any time. Hosts must act on complaints they receive, and must not retaliate against a guest who reports.',
              ],
            },
            'We do not guarantee a time to decide; we aim to deal with urgent reports first. If we cannot send you the answer because you gave no contact details, the outcome is recorded and you can ask for it with the report number.',
          ],
        },
        {
          id: 'metadata',
          heading: '12. Location and other hidden data in files',
          body: [
            'Photos and videos can contain hidden data such as the place where they were taken. Before an upload, your browser tries to remove the location from the original file. The details of what is removed, and for which file types, are in the privacy policy; it is a best effort, which works only when your browser runs our code, and it may not work for every file or format. Smaller copies and thumbnails are re-created from the image and do not carry that data. If a location matters, remove it before you upload.',
          ],
        },
        {
          id: 'retention',
          heading: '13. Deleting, and how long things stay',
          body: [
            {
              list: [
                'Guests: you can delete your own uploads, from the same device and browser that uploaded them. If you no longer have that device, use “Report content” or the privacy request form, and tell us which item.',
                'Hosts: a host can delete any item, or the whole gallery.',
                'When an item is deleted its original file, its display copy and its thumbnail are removed from storage, usually within minutes. A record that it existed (without the file) is kept for up to 30 days and then erased. Uploads that never finished are erased after two days. Likes stay with the gallery until the gallery is deleted.',
                'A gallery does not expire by itself after the event. Items stay until the host deletes them, or the gallery, the invitation or the account is deleted. Hosts should delete a gallery when they no longer need it.',
                'Backup copies are kept by our infrastructure provider and expire in the ordinary course; the privacy policy has the details. Copies that others have downloaded are outside our control.',
              ],
            },
          ],
        },
        {
          id: 'ai-faces',
          heading: '14. AI photos and face search',
          body: [
            {
              list: [
                'AI photos with the people of honor (only where the host’s plan includes it and the host turned it on): a guest can ask for a picture of themselves with the event’s people of honor. The guest’s photo and request, with the people of honor’s photos the host uploaded, are sent to an outside AI provider (OpenAI) to create the picture. The result is AI-generated and is labelled so when shared into the gallery. Do not use photos of anyone who has not agreed, and especially not of other people’s children. The files are erased 30 days after the event; what the provider keeps is governed by its own policy, and we do not promise that it deletes anything. A picture generated of a person’s likeness is subject to the same rules as any other picture.',
                faces
                  ? 'Face search (“the photos I’m in”) is a biometric feature. It is off unless the host turns it on for the event. When it is on, the phones of guests who upload photos detect the faces in them and send a face code (a series of numbers, not a picture) which we store with the photo so that a guest who searches can find the photos they appear in. This happens without any search by the people in the photos. A guest who searches gives a separate, unticked consent for their own selfie, which stays on their phone — only its face code is sent, once per search, and is not stored. A guest can choose “Forget me” and ask not to appear in other guests’ searches. Face codes are erased 30 days after the event, when the host turns the feature off, and when the photo is deleted. We recommend not turning it on where children attend. See the privacy policy for the full description, and the privacy request form (kind “biometric exclusion”) to ask to be left out.'
                  : 'Face search (“the photos I’m in”) is a biometric feature. It is not offered on the Service at this time; no face is processed. If it is offered in the future, this section and the privacy policy will be updated before it is switched on, and it will remain off unless the host turns it on for an event.',
              ],
            },
          ],
        },
        {
          id: 'host',
          heading: '15. Hosts’ responsibilities',
          body: [
            {
              list: [
                'Tell your guests the gallery exists and what the main rules are before you send the link; use approval mode where you think it is wise.',
                'You decide how photos from the gallery are used. Using them for the event and sharing them with its guests is what the gallery is for. Using guests’ photographs in advertising, on a business’s pages, in a paid product, or in any way that identifies people for a purpose beyond the event needs separate permission, and is your responsibility.',
                'Respond to guests who ask you to remove a photo, and act on reports we forward to you.',
                'Do not use face search, AI photos or any other feature to identify, follow or profile any person.',
              ],
            },
          ],
        },
        {
          id: 'privacy-requests',
          heading: '16. Privacy requests',
          body: [
            'To ask to see, correct or delete personal information about you, to ask for a photo of your child to be removed, or to ask to be left out of face search, use the privacy request form. It does not need an account. Who is responsible for what is described in the privacy policy: the host decides about the content they collected for their event; we handle the accounts, the media on our platform and the biometric data on it.',
          ],
        },
        {
          id: 'changes',
          heading: '17. Changes, and earlier versions',
          body: [
            'We may update these rules. Each version has a number and the date it took effect, shown at the top. A new version applies from its effective date; the acknowledgement you gave records the version you saw. Earlier versions are kept unchanged and can be opened from the bottom of this page.',
          ],
        },
        {
          id: 'contact',
          heading: '18. Contact',
          body: [contactLine(c, c.privacyEmail)],
        },
      ],
    };
  }
  return {
    title: 'תקנון גלריית האירוע ותוכן גולשים',
    description: `כללי הגלריה החיה של האירוע ב־${c.brand}: מי מעלה, מי רואה את התמונות, אנשים שמופיעים בהן, ילדים, זכויות, דיווח, הסרה ומחיקה.`,
    intro: [
      `גלריה חיה היא אלבום משותף לאירוע אחד. המארח (מי שיצר את האירוע ב־${c.brand}) פותח אותה ומשתף קישור או קוד QR; האורחים מוסיפים תמונות וסרטונים מהטלפון, בלי חשבון. ${c.brand} מופעלת בידי ${who} (״אנחנו״). התקנון מחייב את המארחים שפותחים גלריות ואת האורחים שמשתמשים בהן, והוא חלק מתנאי השימוש.`,
      {
        note: 'במילים פשוטות: שתפו תמונות שצילמתם או שמותר לכם לשתף; זכרו שכל מי שיש לו את הקישור והמארח יכולים לראות אותן; אל תפרסמו ילדים של אחרים, או משהו שמשפיל או חושף מישהו; מי שמופיע בתמונה יכול לבקש להסיר אותה, ואנחנו נבדוק.',
      },
    ],
    sections: [
      {
        id: 'what',
        heading: '1. מהי הגלריה',
        body: [
          'הגלריה היא מרחב חברתי פרטי של אורחי אירוע אחד, ולא אתר ציבורי. היא אינה מופיעה ברשימות ואינה ניתנת לחיפוש. היא פועלת בקישור (ובקוד גישה, אם המארח הגדיר), ולכן כל מי שיש לו את הקישור ואת הקוד יכול לפתוח אותה — ראו סעיף 9.',
          'בגלריה אורחים מעלים תמונות וסרטונים, צופים בפיד חי, יכולים לפרסם בפיד או להוסיף ״סטורי״, לסמן לייק, למצוא ולהוריד תמונות (ואם המארח הפעיל — לחפש את התמונות שהם מופיעים בהן, סעיף 14). אין תגובות בטקסט חופשי. המארח יכול גם להציג את הגלריה על מסך באולם ולשתף עמוד אלבום אחרי האירוע.',
        ],
      },
      {
        id: 'who',
        heading: '2. מי רשאי להעלות',
        body: [
          {
            list: [
              'כל מי שיש לו את הקישור (ואת קוד הגישה, אם המארח הגדיר) ונמצא בחלון ההעלאה שהמארח קבע רשאי להעלות. אורחים לא צריכים חשבון.',
              'ההעלאה מיועדת למי שמשתתף באירוע או הוזמן אליו, או שהמארח הזמין לתרום. אם קיבלתם את הקישור בטעות, נא לא להעלות.',
              'המארח מחליט מי מקבל את הקישור, אם ההעלאות מאושרות לפני שהן מופיעות, אם ההעלאות מושהות, ומתי הגלריה פתוחה. המארח אחראי לבחור את האורחים ולהסביר להם איך הגלריה עובדת.',
            ],
          },
        ],
      },
      {
        id: 'uploads',
        heading: '3. מה קורה להעלאה',
        body: [
          {
            list: [
              'לפני ההעלאה הראשונה ממכשיר מוצגת הודעה קצרה עם עיקרי התקנון, ומתבקש אישור שקראתם. האישור נרשם מול מזהה אקראי של המכשיר לאותו אירוע (לא מול שמכם), יחד עם גרסת התקנון.',
              'הטלפון שלכם בודק כל תמונה לטשטוש, חשכה וכפילויות. אם החבילה של המארח כוללת זאת, תמונה ממוזערת קטנה של התמונה — בלי שום שם — נשלחת גם לבדיקת תוכן אוטומטית שמריץ ספק AI (Anthropic). הבדיקות רק עוזרות למיין העלאות: פריט שהבדיקות סימנו ממתין למארח, ואדם יכול תמיד לעיין בו. הן אינן הבטחה שדבר לא הולם לא יעבור.',
              'ההעלאה מופיעה אחר כך בפיד מיד, או ממתינה לאישור המארח אם המארח בחר במצב אישור או שבדיקה עצרה אותה. המארח רואה הכול, כולל פריטים שממתינים או שנדחו או הוסתרו, ויכול לפרסם, להסתיר, לדחות או למחוק כל אחד מהם.',
              'המעלה רואה את הפריטים שלו מאותו מכשיר, עם הסטטוס שלהם.',
            ],
          },
        ],
      },
      {
        id: 'posts',
        heading: '4. פוסטים, סטוריז, שמות ולייקים',
        body: [
          'תמונות וסרטונים יכולים להופיע בפיד כפוסטים וכסטוריז. אפשר להוסיף שם תצוגה (הוא מוצג עם הפריטים שלכם לאורחים האחרים ולמארח) ואפשר להוסיף כינוי באינסטגרם כדי שיוכלו לתייג אתכם. שניהם אופציונליים ואפשר להשאיר אותם ריקים. אורחים יכולים לסמן לייק לפריט; לייק נשמר כגיבוב חד־כיווני אנונימי לאותו אירוע. אם הגעתם דרך הקישור האישי מההזמנה, המארח יכול לראות איזה אורח מרשימת המוזמנים העלה.',
        ],
      },
      {
        id: 'prohibited',
        heading: '5. מה אסור להעלות',
        body: [
          {
            list: [
              'כל דבר שאין לכם זכות לשתף, כולל תצלומים, סרטונים ומוזיקה של אחרים.',
              'עירום או תוכן מיני, וכל תמונה אינטימית של אדם שלא הסכים בבירור לשיתופה. שיתוף תמונה כזו בלי הסכמה עלול להיות עבירה פלילית ופגיעה חמורה בפרטיות.',
              'תמונות או סרטונים שמשפילים, מבזים, חושפים או מטרידים אדם, או שעלולים לעשות זאת, כולל בנסיבות שבהן אדם נמצא במקום פרטי (למשל מתלבש, בשירותים, ישן או חולה).',
              'תצלומים של ילדים שאינם שלכם, או שהוריהם או אפוטרופוסיהם לא הסכימו, שבהם הילד ניתן לזיהוי — ראו סעיף 7.',
              'אלימות, שנאה, איומים, פעילות בלתי חוקית או תוכן שמסכן מישהו.',
              'פרסומות, ספאם או תוכן שאינו קשור לאירוע.',
              'תוכן שמתחזה לאדם אחר, או שהועלה בשם אדם אחר.',
              'קבצים שמכילים תוכנה זדונית, או שאינם תמונות או סרטונים.',
            ],
          },
          'זה לא הופך צילום רגיל באירוע לבעיה: תמונות של אנשים שנהנים בחגיגה הן מה שהגלריה נועדה לו. התקנון עוסק בחריגים.',
        ],
      },
      {
        id: 'people',
        heading: '6. אנשים שמופיעים בתמונות',
        body: [
          'מי שמעלה תמונה ומי שמופיע בה הם אנשים שונים עם זכויות שונות. האישור של המעלה לתקנון אינו הסכמה של אף אחד אחר; השתתפות באירוע אינה הסכמה כוללת לכל שימוש בתצלום; ומארח שפותח גלריה לא קיבל את הסכמת האורחים שצולמו. חוק הגנת הפרטיות מגן על אנשים, בין היתר, מפני פרסום תצלומם באופן שעלול להשפילם או לבזותם, צילום אדם ברשות היחיד, גילוי עניין פרטי, ושימוש בשם או בתמונה של אדם לשם רווח בלי רשות.',
          {
            list: [
              'אם אתם מופיעים בתמונה ורוצים שתוסר, אין צורך בחשבון ואין צורך במכשיר של המעלה המקורי: השתמשו ב״דיווח על תוכן״ (סעיף 11) מתוך התמונה, או בטופס הדיווח עם קישור לגלריה. אפשר גם לפנות למארח.',
              'אנחנו בודקים כל בקשה כזו. אנחנו מחליטים בכל מקרה לגופו — ההקשר של התמונה, מי יכול לראות אותה, אם היא משפילה או חושפת אתכם, ואם מדובר בילד — ומסירים או מסתירים פריטים כשההסרה מוצדקת; איננו מסירים תמונות רגילות של אנשים שהשתתפו באירוע רק מפני שהיו מעדיפים לא להיראות, אלא אם המארח מסכים או שהחוק מחייב. אפשר תמיד לבקש מהמארח, שיכול להסיר.',
              'אם מישהו מעלה פריטים בשמכם, או מתחזה אליכם, דווחו באותה דרך.',
            ],
          },
        ],
      },
      {
        id: 'children',
        heading: '7. ילדים',
        body: [
          'תצלומים ופרטים של ילדים הם סיכון מוגבר לפרטיות. הרשות להגנת הפרטיות ממליצה שלא לפרסם תצלומים מזוהים של ילדים של אחרים בלי הסכמת הוריהם. נא לפעול כך בגלריה: העלו תמונות של הילדים שלכם, או של ילדים שהוריהם הסכימו; אל תעלו תמונות של ילדים של אחרים שבהן הם ניתנים לזיהוי, ואף פעם לא משהו שעלול לביים ילד או להראות ילד חשוף. אורח אינו יכול לאשר שימוש בתמונת ילד של אדם אחר.',
          {
            list: [
              'הורה או אפוטרופוס יכולים לבקש להסתיר או להסיר תמונה של ילדם. השתמשו ב״דיווח על תוכן״ ובחרו ״ילד״; דיווח על ילד מטופל ראשון, והפריט מוסתר לבדיקה מיד — אין צורך להסביר מדוע או להוכיח משהו בשלב זה.',
              'מארחים של אירועים שבהם הרבה ילדים (בר או בת מצווה, ברית, יום הולדת) צריכים להודיע לאורחים לפני האירוע שהגלריה קיימת ולשקול מצב אישור. אנו ממליצים שמארחים לא יפעילו חיפוש לפי פנים באירועים כאלה (סעיף 14). אלה המלצות הגנה ולא תנאים שהחוק קובע.',
              'אין להעלות תמונות שיש בהן פרטים מזהים של ילד (בית ספר, כתובת מגורים) או שמראות את מיקומו. אנחנו מנסים להסיר נתוני מיקום מקבצים (סעיף 12), אבל לא מבטיחים זאת לכל סוג קובץ.',
            ],
          },
        ],
      },
      {
        id: 'harm',
        heading: '8. תמונות אינטימיות ופוגעניות קשות',
        body: [
          'אם תמונה אינטימית או מינית, או תמונה של ילד שהיא מינית או פוגענית, מופיעה בגלריה, דווחו מיד ב״דיווח על תוכן״ ובחרו ״תוכן פוגעני״ וסמנו שזו תמונה אינטימית ששותפה בלי הסכמה, או ״ילד״. דיווחים כאלה דחופים: הפריט מוסתר מיד ואדם בודק אותו ראשון. איננו נסמכים רק על בדיקות אוטומטיות. אם ילד בסכנה, או שמתבצעת עבירה, פנו גם למשטרה; דיווח אלינו אינו מחליף דיווח לרשויות.',
        ],
      },
      {
        id: 'visibility',
        heading: '9. מי רואה מה, ושיתוף',
        body: [
          {
            list: [
              'כל מי שיש לו את קישור הגלריה (ואת קוד הגישה, אם יש) יכול לפתוח אותה ולראות כל מה שפורסם, ולהעלות. מי שמקבל את הקישור מאורח מקבל אותה גישה. אל תעבירו את הקישור לאנשים שלא הייתם רוצים שיראו את התמונות. ייתכן שדף ההזמנה עצמו מכיל את הקישור, אם המארח הוסיף אליו את הגלריה.',
              'קוד הגישה מגן על הפיד ועל ההעלאות של הגלריה. הוא אופציונלי והמארח יכול להחליף או להסיר אותו. הקישורים למסך האולם ולעמוד האלבום הם קישורים נפרדים; המארח מחליט מי מקבל אותם.',
              'המארח רואה את כל הפריטים, גם אלה שממתינים, מוסתרים או נדחו, ממי הם הגיעו כשזה ידוע, ומוריד את הקבצים המקוריים.',
              'המשתתפים באולם רואים את מה שהמארח מציג על מסך האולם.',
              'אורחים רואים תמונות ממוזערות וגרסאות תצוגה של פריטים שפורסמו. בסרטונים, אורחים ועמוד האלבום עשויים לקבל גם את קובץ הווידאו המקורי. אורחים יכולים להוריד פריטים מעמוד האלבום.',
              'מותר לשתף מחוץ לפלטפורמה תמונה שהורדתם מהגלריה, אבל רק באופן שהיה מותר לכם לשתף את המקור: ראו סעיף 10. עותק שהורד או צולם מהמסך נמצא מחוץ לפלטפורמה ואיננו יכולים להחזיר אותו. מחיקת פריט כאן מסירה את העותקים שלנו; היא אינה מסירה עותקים שאחרים יצרו.',
            ],
          },
        ],
      },
      {
        id: 'rights',
        heading: '10. זכויות יוצרים ורישיון',
        body: [
          {
            list: [
              'זכויות היוצרים בתצלום או בסרטון שייכות ליוצר שלו — בדרך כלל מי שצילם — ונשארות אצלו, יחד עם זכויותיו המוסריות, כמו הזכות לקבל קרדיט. ההעלאה אינה מעבירה בעלות למארח, לאורחים אחרים או לנו.',
              'בהעלאה אתם נותנים לנו רישיון מוגבל ולא בלעדי לשמור, להעתיק (כולל תמונות ממוזערות וגרסאות תצוגה), לעבד, להציג ולהעביר את הפריט למי שהגדרות הגלריה מאפשרות לו לראות אותו, ולבצע את הבדיקות שבסעיף 3, כל עוד הוא בגלריה ורק כדי להפעיל את השירות. איננו משתמשים בפריטים שהועלו לפרסום שלנו, לא מוכרים אותם ולא נותנים עליהם רישיון לאחרים.',
              'אתם נותנים למארח זכות לראות, להוריד ולשמור את ההעלאה שלכם לצורך האירוע: לצפות בה, לשמור אותה באלבום האירוע, להציג אותה במסך האולם, לכלול אותה בסרט רגעים לאורחי האירוע ולשתף את האלבום עם אורחי האירוע. כל שימוש אחר — ובמיוחד בפרסום, באתר או ברשתות של עסק, או כל מכירה — דורש רשות נפרדת של המעלה ושל מי שמופיע בתמונה, ואינו מכוסה בתקנון.',
              'מוזיקה: אל תעלו סרטונים או מוזיקה שאין לכם זכות לשתף. סרט רגעים משתמש בשיר של ההזמנה או בשיר שהמארח בוחר, שעשוי להיות יצירה מוגנת של מישהו אחר: המארח אחראי שתהיה לו הזכות להשתמש בו היכן שהוא משתף את הסרט. הפלטפורמה אינה נותנת רישיון למוזיקה לשיתוף מחוץ לאירוע.',
              'אם אתם סבורים שמשהו בגלריה מפר את זכויות היוצרים שלכם, השתמשו ב״דיווח על תוכן״, בחרו ״זכויות יוצרים״, ומסרו שם ומייל וכתבו מה שלכם והיכן. נבדוק, נסתיר את הפריט בזמן הבדיקה אם נראה לנכון, ונודיע לכם את התוצאה. מי שהפריט שלו הוסר יכול לפנות אלינו כדי לערער.',
            ],
          },
        ],
      },
      {
        id: 'moderation',
        heading: '11. דיווח והסרה',
        body: [
          'כל אחד — המעלה, מי שמופיע בתמונה, הורה או אפוטרופוס, בעל זכויות יוצרים או כל אדם אחר — יכול לדווח על פריט, עם חשבון או בלעדיו:',
          {
            list: [
              'השתמשו ב״דיווח על תוכן״ בפריט, או בקישור בתחתית הגלריה, או בטופס הדיווח עם קישור לגלריה. בחרו קטגוריה (פרטיות, זכויות יוצרים, ילד, תוכן פוגעני, אחר) וציינו מה הקשר שלכם לפריט (המעלה, מי שמופיע בו, הורה או אפוטרופוס, בעל זכויות יוצרים, אחר). תארו את הבעיה בכמה שורות. שם, מייל וטלפון אופציונליים (מייל נחוץ כדי לקבל תשובה; בדיווח על זכויות יוצרים נדרשים שם ומייל). הדיווח מצביע על הפריט בלי להציג פרטים של אורחים אחרים.',
              'הדיווח נשמר ואדם בודק אותו. דיווחים על ילד או על תמונה אינטימית דחופים: הפריט מוסתר מיד, באופן הפיך, עד להחלטה. אנחנו מודיעים למארח הגלריה שהוגש דיווח, בלי לומר מי הגיש.',
              'אחר כך אנחנו מחליטים: להשאיר את הפריט, להסתיר אותו או להסיר אותו. שום דבר לא נמחק אוטומטית רק כי דווח עליו: דיווחים עלולים להיות שגויים או פוגעניים, ואפשר להתעלם מדיווחי שווא או פוגעניים. אם מסרתם מייל, נודיע לכם את התוצאה.',
              'אפשר גם להשתמש בטופס בקשות הפרטיות (סעיף 16) לבקשות על מידע אישי, ואפשר לפנות לרשות להגנת הפרטיות או לבתי המשפט בכל עת.',
              'המארח יכול להסתיר או למחוק כל פריט בכל עת. מארחים חייבים לטפל בתלונות שהם מקבלים, ואסור להם לנקום באורח שמדווח.',
            ],
          },
          'איננו מתחייבים לזמן החלטה; אנחנו מטפלים בדיווחים דחופים קודם. אם אי אפשר לשלוח לכם תשובה כי לא מסרתם פרטי קשר, התוצאה נרשמת ואפשר לבקש אותה לפי מספר הדיווח.',
        ],
      },
      {
        id: 'metadata',
        heading: '12. מיקום ונתונים נסתרים אחרים בקבצים',
        body: [
          'בתמונות ובסרטונים יכולים להיות נתונים נסתרים, כמו המקום שבו צולמו. לפני ההעלאה הדפדפן שלכם מנסה להסיר את המיקום מהקובץ המקורי. הפירוט מה מוסר, ובאילו סוגי קבצים, נמצא במדיניות הפרטיות; זה מאמץ סביר, שעובד רק כשהדפדפן מריץ את הקוד שלנו, וייתכן שלא יעבוד לכל קובץ או פורמט. עותקים קטנים ותמונות ממוזערות נוצרים מחדש מהתמונה ואינם נושאים את הנתונים האלה. אם המיקום חשוב לכם, הסירו אותו לפני ההעלאה.',
        ],
      },
      {
        id: 'retention',
        heading: '13. מחיקה וכמה זמן דברים נשארים',
        body: [
          {
            list: [
              'אורחים: אפשר למחוק את ההעלאות שלכם, מאותו מכשיר ואותו דפדפן שהעלו אותן. אם אין לכם יותר את המכשיר, השתמשו ב״דיווח על תוכן״ או בטופס בקשות הפרטיות, וציינו איזה פריט.',
              'מארחים: מארח יכול למחוק כל פריט, או את כל הגלריה.',
              'כשפריט נמחק, הקובץ המקורי, גרסת התצוגה והתמונה הממוזערת שלו מוסרים מהאחסון, בדרך כלל תוך דקות. רישום שהוא היה קיים (בלי הקובץ) נשמר עד 30 יום ואז נמחק. העלאות שלא הושלמו נמחקות אחרי יומיים. לייקים נשארים עם הגלריה עד שהיא נמחקת.',
              'גלריה לא פגה מעצמה אחרי האירוע. הפריטים נשארים עד שהמארח מוחק אותם, או שהגלריה, ההזמנה או החשבון נמחקים. מארחים צריכים למחוק גלריה כשהם כבר לא צריכים אותה.',
              'עותקי גיבוי נשמרים אצל ספק התשתית שלנו ופוקעים במהלך הרגיל; הפירוט במדיניות הפרטיות. עותקים שאחרים הורידו אינם בשליטתנו.',
            ],
          },
        ],
      },
      {
        id: 'ai-faces',
        heading: '14. תמונות AI וחיפוש לפי פנים',
        body: [
          {
            list: [
              'תמונות AI עם בעלי השמחה (רק כשהחבילה של המארח כוללת זאת והמארח הפעיל): אורח יכול לבקש תמונה שלו עם בעלי השמחה. התמונה והבקשה של האורח, יחד עם תמונות בעלי השמחה שהמארח העלה, נשלחות לספק AI חיצוני (OpenAI) כדי ליצור את התמונה. התוצאה נוצרה בבינה מלאכותית ומסומנת כך כשהיא משותפת בגלריה. אל תשתמשו בתמונות של מי שלא הסכים, ובמיוחד לא של ילדים של אחרים. הקבצים נמחקים 30 יום אחרי האירוע; מה שהספק שומר כפוף למדיניות שלו, ואיננו מבטיחים שהוא מוחק משהו. תמונה שנוצרה של דמותו של אדם כפופה לאותם כללים כמו כל תמונה אחרת.',
              faces
                ? 'חיפוש לפי פנים (״התמונות שאני בהן״) הוא יכולת ביומטרית. הוא כבוי אלא אם המארח הפעיל אותו לאירוע. כשהוא פועל, הטלפונים של אורחים שמעלים תמונות מזהים בהן פנים ושולחים קוד פנים (סדרת מספרים, לא תמונה) שאנחנו שומרים עם התמונה, כדי שאורח שמחפש יוכל למצוא את התמונות שהוא מופיע בהן. זה קורה בלי שמי שבתמונות חיפש משהו. אורח שמחפש נותן הסכמה נפרדת, לא מסומנת מראש, לסלפי שלו, שנשאר בטלפון שלו — רק קוד הפנים שלו נשלח, פעם אחת לכל חיפוש, ואינו נשמר. אורח יכול לבחור ״לשכוח אותי״ ולבקש לא להופיע בחיפושים של אורחים אחרים. קודי הפנים נמחקים 30 יום אחרי האירוע, כשהמארח מכבה את היכולת, וכשהתמונה נמחקת. אנו ממליצים לא להפעיל אותו היכן שיש ילדים. הפירוט המלא במדיניות הפרטיות, ובטופס בקשות הפרטיות (סוג ״החרגה מזיהוי פנים״) אפשר לבקש שלא נכלול אתכם.'
                : 'חיפוש לפי פנים (״התמונות שאני בהן״) הוא יכולת ביומטרית. הוא אינו מוצע בשירות כרגע; שום פנים לא מעובדות. אם הוא יוצע בעתיד, הסעיף הזה ומדיניות הפרטיות יעודכנו לפני שיופעל, והוא יישאר כבוי אלא אם המארח מפעיל אותו לאירוע.',
            ],
          },
        ],
      },
      {
        id: 'host',
        heading: '15. אחריות המארחים',
        body: [
          {
            list: [
              'הודיעו לאורחים שהגלריה קיימת ומה עיקרי הכללים לפני ששולחים את הקישור; השתמשו במצב אישור כשאתם סבורים שזה נבון.',
              'אתם מחליטים איך משתמשים בתמונות מהגלריה. שימוש לצורך האירוע ושיתוף עם אורחיו הוא מה שהגלריה נועדה לו. שימוש בתצלומי אורחים בפרסום, בעמודים של עסק, במוצר בתשלום, או בכל דרך שמזהה אנשים למטרה שמעבר לאירוע דורש רשות נפרדת, והוא באחריותכם.',
              'הגיבו לאורחים שמבקשים להסיר תמונה, ופעלו לפי דיווחים שאנחנו מעבירים אליכם.',
              'אל תשתמשו בחיפוש לפי פנים, בתמונות AI או בכל יכולת אחרת כדי לזהות, לעקוב אחר או לבנות פרופיל של אדם.',
            ],
          },
        ],
      },
      {
        id: 'privacy-requests',
        heading: '16. בקשות פרטיות',
        body: [
          'כדי לבקש לעיין במידע אישי עליכם, לתקן אותו או למחוק אותו, לבקש להסיר תמונה של ילדכם, או לבקש שלא נכלול אתכם בחיפוש לפי פנים, השתמשו בטופס בקשות הפרטיות. אין צורך בחשבון. מי אחראי על מה מתואר במדיניות הפרטיות: המארח מחליט על התוכן שאסף לאירוע שלו; אנחנו מטפלים בחשבונות, במדיה בפלטפורמה ובנתונים הביומטריים שבה.',
        ],
      },
      {
        id: 'changes',
        heading: '17. שינויים וגרסאות קודמות',
        body: [
          'אנחנו עשויים לעדכן את התקנון. לכל גרסה יש מספר ותאריך כניסה לתוקף, שמופיעים בראש העמוד. גרסה חדשה חלה מתאריך כניסתה לתוקף; האישור שנתתם רושם את הגרסה שראיתם. גרסאות קודמות נשמרות ללא שינוי ואפשר לפתוח אותן בתחתית העמוד.',
        ],
      },
      {
        id: 'contact',
        heading: '18. יצירת קשר',
        body: [contactLine(c, c.privacyEmail)],
      },
    ],
  };
}
