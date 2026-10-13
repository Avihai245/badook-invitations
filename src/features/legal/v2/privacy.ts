import type { LegalContext, LegalDoc } from '../types';
import { contactLine, operatorLine } from './shared';

/**
 * The privacy policy, version 2 — the Protection of Privacy Law, 5741-1981 (as amended, incl. Amendment 13),
 * the Privacy Protection (Data Security) Regulations, 5777-2017 and the regulations on transferring
 * data abroad. Compared with version 1 it: renumbers the sections in one sequence (version 1 had two
 * "7C"); keeps the section ids (the app links to #faces, #gallery); separates the purposes; describes
 * face search as the two processing activities it is; states the gallery's metadata handling, who sees
 * what and what is kept as the code actually does (compliance audit, docs/legal/); names the payment
 * providers in use; covers the report and request flows and the acceptance records; and does not
 * promise provider-side deletion, a backup period or a database registration that nobody verified.
 * Open legal questions are in docs/legal/decision-records.md, not in this text.
 */
export function privacyDoc(c: LegalContext): LegalDoc {
  const o = c.operator;
  const who = operatorLine(c);
  const mail = c.privacyEmail;
  if (c.locale === 'en') {
    const reach = [
      mail ? `email ${mail}` : null,
      o.phone ? `phone ${o.phone}` : null,
      o.address ? `mail to ${o.address}` : null,
    ].filter(Boolean);
    return {
      title: 'Privacy policy',
      description: `How ${c.brand} collects, uses and protects personal information — of hosts, of their guests and of people who appear in photographs.`,
      intro: [
        `${c.brand} (the “Service”, at ${c.site}) lets hosts create digital invitations, send them, collect RSVPs and, where the plan includes it, run a live photo gallery for the event. It is run by ${who} (“we”). This policy explains what information we collect, why, who receives it and what your rights are. It applies to the website, the hosts’ app, the invitation pages and the gallery pages guests open. Short notices at the places where information is asked for (sign-up, the RSVP form, the gallery, the report and request forms) summarise the relevant parts and link here.`,
        {
          note: 'In short: we use information only to run the Service, we never sell it, we do not use guest lists for marketing, and hosts can delete their guest lists, replies and galleries at any time. People who appear in photographs can ask for them to be removed, with or without an account.',
        },
      ],
      sections: [
        {
          id: 'roles',
          heading: '1. Who is responsible for the information',
          body: [
            'For hosts’ accounts (name, email, phone, payments, sign-up records) we are the database owner and decide how that information is used.',
            'Guest details a host enters or uploads (a guest list), the replies guests send and the answers to the host’s own questions are collected for the host: the host decides whom to invite and what to ask, and we store and process that information on the host’s behalf. Hosts are responsible for having the right to upload their guests’ details and to send them the invitation, and for telling their guests what they collect and why.',
            'Photographs and videos in an event’s gallery are uploaded by guests and held for the host. The host decides who gets the gallery link and what is published; we run the gallery, the checks, the reporting and removal process, and the features (such as face search) that process the media on our systems, and for these we are responsible too.',
            reach.length
              ? `Privacy matters are handled by: ${reach.join(', ')}, or the privacy request form (section 18).`
              : 'Privacy matters are handled through the privacy request form (section 18).',
          ],
        },
        {
          id: 'collect',
          heading: '2. What we collect',
          body: [
            {
              list: [
                'Account details: name, email address, phone number (optional) and a password, stored only as a secure hash. Signing in with Google gives us your name, email and profile picture from Google. An account opened for you by Badook Events (our events system) comes with the name, email and phone you gave it; Badook Events also tells us which of its users opened the account for you (their name, their ID there, email and role), and we keep that with the account. We keep a record of the calls its system makes to ours (the kind of call, when, the result and the account it concerned — not the details sent) for 90 days.',
                'Records of what you accepted: when you open an account, or buy a plan or credits, we record which version of the terms, the privacy policy and (for purchases) the refund policy you accepted, and when. We do not create such records for acceptances that happened before this record existed.',
                'What hosts create: event details, texts (and their translations into the invitation’s other languages), photos, videos, songs and links they add to an invitation, and their settings.',
                'Guest lists: names, phone numbers and optionally email addresses, party size, group and language, uploaded from a file or typed in; plus each guest’s personal-link status (sent, delivered, read, opened).',
                'A do-not-send list: phone numbers that asked our WhatsApp number to stop (a “STOP” reply, or turning off messages from us in WhatsApp), with the date. We keep it so that no host sends to them again from that number.',
                'RSVPs: the name, phone and email a guest enters, whether they are coming and with how many people, dietary preferences, answers to the host’s questions (which can include anything the host chooses to ask) and a message.',
                'Gallery uploads and what goes with them (section 10), reports about media and privacy requests (section 11).',
                'Payments: the plan, amounts, dates and the payment provider’s transaction and subscription numbers. Card details are entered on the payment provider’s page or form and never reach us; for monthly charges the provider gives us a token that lets us charge the card, together with the card’s last four digits and expiry date.',
                'Support: messages sent through the contact form, the support assistant and tickets.',
                'Technical information: IP address (kept only as a one-way hash, to stop spam and abuse), browser type, times of access, and error logs.',
              ],
            },
          ],
        },
        {
          id: 'use',
          heading: '3. Why we use it',
          body: [
            'We use information for the purpose for which it was given, and keep these purposes apart:',
            {
              list: [
                'Event administration and invitation delivery: creating and publishing invitations, personal links, sending invitations on WhatsApp when a host asks (and the reminders, table numbers and gallery or album links they choose to send), collecting and showing RSVPs, seating and check-in.',
                'The event gallery: showing guests’ photos and videos to the people the gallery’s controls allow, letting hosts review and download them, and checking uploads for quality and improper content.',
                'AI services: only the features a host turns on, each described below (design suggestions, translation, AI photos, read-aloud, planning drafts, the support assistant).',
                'Biometric matching: only face search, only where it is on (section 12), and only for finding the photos a guest appears in.',
                'Accounts, plans, payments and invoices; service messages to hosts (sign-in and password emails, RSVP notifications and summaries they chose).',
                'Support and security: answering requests, reports and complaints; preventing spam, fraud and abuse; investigating failures; keeping records the law requires (for example accounting records).',
                'Improving the Service, using aggregated information that does not identify anyone.',
              ],
            },
            'We do not sell personal information, do not use guests’ details or photographs for our own marketing, do not show advertising and do not send promotional messages to the phone numbers and emails of guests. A guest’s reply to an invitation is not a consent to marketing, to biometric processing or to any use of their photographs beyond the event.',
          ],
        },
        {
          id: 'duty',
          heading: '4. Do you have to give it',
          body: [
            'There is no legal obligation to give us any information, and providing it is voluntary. Some of it is needed to provide the Service: without an email address an account cannot be opened, without a guest’s phone number an invitation cannot be sent to them on WhatsApp, and without contact details we cannot send you the outcome of a report or a request (copyright reports and privacy requests need an email). A guest can use the gallery and reply to an invitation without giving a name where the host’s form does not require one; photographs people upload are their choice. Declining to give optional details has no other consequence than the one just described.',
          ],
        },
        {
          id: 'share',
          heading: '5. Who receives information',
          body: [
            'We share information only as needed to run the Service, with providers bound to keep it confidential and secure and to use it only for us:',
            {
              list: [
                'Supabase — database, sign-in and file storage (servers in the European Union, Frankfurt);',
                'Amazon Web Services (AWS Amplify) — hosting the website;',
                'Meta (WhatsApp Business Platform) — when a host sends messages on WhatsApp: the guest’s phone number, name and the message’s link;',
                'Tranzila and PayPlus — payment providers: processing payments (Tranzila for current purchases; PayPlus for subscriptions that began with it) and issuing receipts and invoices;',
                'Resend — sending emails;',
                'Anthropic — answering questions in the support assistant (the text of the question only); when the host’s plan includes it, the automatic check of photos uploaded to an event’s gallery (a small thumbnail of the photo only) and design suggestions from the host’s chosen photos (small copies, section 15); and, when a host asks for automatic translation or planning drafts, the texts concerned (nothing about guests is sent);',
                'OpenAI — when the host’s plan includes AI photos with the people of honor: the photos of the people of honor the host uploaded, a guest’s photo and their request, with the names, roles and description the host typed for the people of honor and the event type, to create the picture (section 10); and, where the site uses it instead of Anthropic, answering in the support assistant and in the quick questionnaire for a new invitation (the text only);',
                'Microsoft (Azure AI Speech) — when the host’s plan includes it, reading the invitation’s own texts aloud (section 15);',
                'Google (Maps and sign-in), YouTube and Vimeo — maps, videos and sign-in shown in invitations and on the site.',
              ],
            },
            'A host sees the replies of the guests they invited, the guest list, and everything uploaded to their gallery. The gallery’s other guests see what is published. Our staff see information only as section 8 describes. We may also disclose information when the law or a court order requires it, or to protect the rights and safety of users, children and the Service. If the Service is sold or merged, the information will pass to the new owner under this policy.',
          ],
        },
        {
          id: 'transfers',
          heading: '6. Storage and transfers outside Israel',
          body: [
            'Our database and files are stored in the European Union (Supabase, Frankfurt). Other providers above process information in other places: for some of them — Meta, OpenAI, Anthropic, Resend, Microsoft, Google, AWS, Vimeo and YouTube — the processing may be outside Israel and outside the European Union, including in the United States, and we have not fixed a region for every one of them. The payment providers operate in Israel.',
            'Transfers of information outside Israel are made under the Privacy Protection (Transfer of Data to Databases Abroad) Regulations, 5761-2001, which allow them, among other grounds, to countries with an adequate level of protection or against the recipient’s undertaking to protect the information. Being hosted in the European Union does not by itself settle every obligation, and we limit what we send: for example, AI providers receive only the text or the images a feature needs, not guest lists. Where information reaches us from the European Economic Area, additional rules apply to it.',
          ],
        },
        {
          id: 'security',
          heading: '7. How we protect it',
          body: [
            'We follow the Privacy Protection (Data Security) Regulations: encrypted connections (HTTPS), passwords stored as hashes, every account’s data separated at the database level, no direct access to the database tables from browsers (the system uses limited server functions), media in private storage opened only through links that expire, access limited to what each part of the system and each member of our team needs, a record of what our team does, and periodic review. No system is fully immune; if a serious incident happens we will act as the law requires, including notifying those affected and the Privacy Protection Authority where needed.',
          ],
        },
        {
          id: 'team',
          heading: '8. What the Badook team can see and do',
          body: [
            'A small team runs the Service from an internal console. Each member has a role that decides what they can see and do there, and nothing beyond it:',
            {
              list: [
                'Owners and admins run the Service and manage the team. Support answers support requests, media reports and privacy requests, and can see contact details to do so. Finance handles payments and can see customers’ contact details for that. Other roles see the numbers only: emails and phone numbers are hidden from them.',
                'What the team sees: hosts’ accounts (name, where the account came from, plan, credits, payments — and the email and phone only in the roles that need them) and, for each invitation, its details and its numbers: how many guests, replies, messages and visits. Not the guests’ own details or replies. For a media report, the team sees the report and the status of the item reported (and can see the item itself to decide); it does not browse galleries otherwise.',
                'What the team can change, and only with a reason: add or remove message credits, give a plan for a limited time or a discount, turn on a feature for one invitation beyond its plan, suspend or restore an account’s sign-in, and decide on reports (hide, restore, or — owners and admins only — remove an item). A suspended account can’t sign in; its invitations already published keep working for its guests.',
                'Every action of the team is recorded — who did it, what, when and why — and the record is kept for two years, then deleted.',
              ],
            },
          ],
        },
        {
          id: 'retention',
          heading: '9. How long we keep it',
          body: [
            {
              list: [
                'Account information: as long as the account is open. Records of what the account accepted: with the account.',
                'Invitations, guest lists and RSVPs: until the host deletes them, or deletes the account. Hosts can delete a guest, a reply or a whole invitation at any time.',
                'After an account is deleted its information is erased within 30 days. Copies in our database provider’s backups expire by themselves in the ordinary course according to the provider’s backup schedule, so deleted information can remain in a backup until then; it is not restored into the live system except to recover from a failure.',
                'Payment and invoice records: kept as tax law requires (seven years), by the payment provider that issued them; the copies in our own system are erased with the account.',
                'Automatic translations: the translated texts, and whether the host approved them, are kept with the invitation until the host deletes it or the account; the record of each translation run (kept for the daily limit) is erased after two days.',
                'Hashed IP addresses used against abuse: up to 30 days (on a report or request, we remove the hash from the record after 30 days).',
                'Messages sent through the contact form: up to two years.',
                'Media reports and privacy requests: two years after they are resolved, then erased (a record to answer a complaint or a regulator with).',
                'The do-not-send list: as long as our WhatsApp number sends invitations, so the request keeps being honoured. Its owner can ask to be removed from it through the contact form.',
              ],
            },
          ],
        },
        {
          id: 'gallery',
          heading: '10. The live gallery: photos and videos guests upload',
          body: [
            'A host whose plan includes it can open a live gallery for an event: guests open a link or scan a QR code the host shares and upload photos and videos from their phone, without an account. The host may add an access code and a time window for uploads. The uploads are collected for the host, like a guest list (section 1). The Event gallery rules describe how the gallery works for guests and hosts.',
            {
              list: [
                'What is kept: the photos and videos themselves (the original file, plus a smaller display copy and a thumbnail the guest’s phone makes), their size, dimensions, length, and the time they were taken as the file records it. A display name the guest chooses to add and an optional Instagram handle (for tagging) are shown with their uploads to other guests and to the host. If the guest came through their personal invitation link, the host also sees which guest from the guest list uploaded it. So that guests can see and delete their own uploads, their device keeps a random identifier, which we keep only as a one-way hash, separate for each event; likes are kept per event as a one-way hash, too.',
                'Location and other data inside files: before an upload your browser removes location (GPS) data from the original file where it can — see the next point. The display copy and the thumbnail are re-created from the image and carry no metadata. Other information in the original, such as the camera’s make and model or the time, may remain. Because this happens in the guest’s browser, a modified or unsupported client can upload a file unchanged, and some formats are not covered; hosts download the originals as uploaded.',
                'What the browser removes: the location (GPS) data in the original file of JPEG, HEIC, HEIF, AVIF, PNG and WebP photos (including location written in the XMP part of the metadata), and the location tags in the header of MP4, MOV and 3GP videos. It does not cover GIF and WebM files, location stored in other places (for example a place name written in a photograph’s IPTC details, or a GPS track in a special video track), or other details in the file, such as the camera’s make and model, serial number and capture time, which remain. A damaged or unusual file is uploaded unchanged. Files uploaded before this was introduced were not changed.',
                'Automatic checks: the guest’s phone checks each photo for blur, darkness and duplicates. When the host’s plan includes the automatic content check, the photo’s small thumbnail only (no names or other details) is sent to Anthropic, which returns scores for inappropriate content and for quality and a short reason, which we keep with the item. A suspicious upload waits for the host’s approval. The checks help; a person reviews what they hold back and anything reported.',
                'Who sees them: anyone with the gallery’s link (and its access code, if set) sees the published photos and videos, can upload, and may be able to reach the original file of a published video; so does the event’s screen at the venue if the host uses one. The host sees everything, including uploads waiting for approval or rejected and the checks’ results, and can download all the original files. The host decides what is published and is responsible for how they share and use the photos. The album page, which the host may share after the event, shows the published items to anyone who has its link.',
                'Notice before the first upload: before a device’s first upload to a gallery, the guest is shown a short notice with links to the gallery rules and this policy, and acknowledges it once. We record that the device acknowledged this version of the rules — the device’s per-event hash, the version and the time. That acknowledgement is not the consent of the people who appear in the photographs.',
                'Storage: private storage (Supabase, European Union). Pages receive links to the files that expire after a few hours.',
                'Deleting: a guest can delete their own upload from the same device and browser at any time; the host can delete any photo or video, or the whole gallery; staff can remove an item after a report (section 11). The original, the display copy and the thumbnail are then removed from storage, usually within minutes. Deleting does not remove copies that people downloaded or that were already shared outside the Service.',
                'How long: a gallery does not expire after the event: items stay until the host deletes them, or the gallery, the invitation or the account is deleted (then as in section 9). Uploads that were never finished are erased after two days, and the records of deleted items after 30 days. Rejected and hidden items are kept like any other until they are deleted.',
                'Sending guests the gallery’s link: when the host sends it from our WhatsApp number, we keep for each family when it was sent and the message’s delivery status, as with invitations.',
                'The highlights film: a host can make a short film of the gallery. It is made in the host’s own browser — the photos are read there, not by our servers — and a song the host picks for it stays on their computer. If the host adds the film to the gallery, it is kept like any other upload (and shown to guests only if the host chooses). The photos in it belong to the guests who took them, and the song may belong to someone else; the film is for the event’s guests, and other uses need permission.',
                'The album: the morning after the event, the gallery’s published photos and videos are also shown as an album, on a page of its own whose link the host shares (and may send to their guests from our WhatsApp number). The album keeps nothing of its own: it shows what the gallery has, without what the host leaves out of it, and goes with the gallery.',
                'AI photos with the people of honor (only where the host’s plan includes it and the host turned it on): the host uploads a photo of each person the event celebrates, with their name, role and a short description, and confirms that those people agreed that guests may create AI pictures with them (this is a single confirmation by the host; we do not obtain each person’s consent, and it is not a guardian’s consent for a child). A guest who asks for an AI photo with them sends a photo they took (made smaller and re-encoded on their phone, without location or camera details) and their request; these, with the people’s photos and the descriptions, are sent to OpenAI, which returns the new picture. We keep them, the result and the guest’s name if they gave one, in private storage (Supabase, European Union), for the guest and the host; the guest can delete their pictures, and the host can delete any of them. Everything is erased 30 days after the event (a picture the guest added to the gallery stays there, like any upload, marked as made by AI in the feed and the album). OpenAI may keep the requests and results for a period set by its own policy to prevent abuse and for its service; we do not control it and do not promise that it deletes anything on our request. Guests are told this before they send. Do not send photos of children or of anyone who has not agreed.',
              ],
            },
            'A person who appears in a photo and wants it removed can ask the host, or report it to us — with or without an account (section 11).',
          ],
        },
        {
          id: 'reports',
          heading: '11. Reports about media, privacy requests and acceptance records',
          body: [
            {
              list: [
                'Media reports (“Report content”): anyone can report a photo or video — the uploader, a person in it, a parent or guardian, a copyright owner — without an account. We store the category, who the reporter is in relation to the item, the description, the item or link they pointed at, and the name, email and phone if they chose to give them (a copyright report needs name and email), and a one-way hash of the IP address. The report points at the item without showing anyone else’s details. A person reviews it; for a child or an intimate image the item is hidden at once, reversibly, until a decision. The gallery’s host is told that a report was made, without who made it. If the reporter gave an email we send the outcome. Every step is recorded. A copy of the item is not made.',
                'Privacy requests: the form asks the kind of request, the relation of the requester to the information, their name and email (needed to answer), optional phone, and the details. It is used to handle the request, to verify the requester before releasing or deleting anything, and to answer; staff and, where a request concerns a gallery, the host as needed see it.',
                'Both are kept for two years after they are resolved, and the IP hash is removed after 30 days.',
                'Acceptance records: the version of the terms and policies a host accepted when opening an account or buying (section 2).',
              ],
            },
          ],
        },
        {
          id: 'faces',
          heading: '12. “The photos I’m in”: face search in the gallery (only where it is on)',
          body: [
            {
              note: c.faceSearch
                ? 'This section applies only to events whose host turned face search on. Where it is off, no face is processed. Face search is a biometric feature and is off unless a host turns it on for an event.'
                : 'This section applies only to events whose host turns face search on. Face search is not offered on the Service at this time, so no face is processed. If it is offered later, this policy will be updated before it is switched on.',
            },
            'Face search involves two different processing activities, and they are described separately because the consent of the guest who searches does not cover the other.',
            {
              list: [
                'A. The searching guest’s own face. Faces are biometric information, so a guest’s selfie is used only with that guest’s explicit consent — a separate checkbox, unticked, on its own screen, not combined with the RSVP, gallery access or uploading. The selfie is taken or chosen on the guest’s phone and processed there only; it is never sent to us and never kept. The phone turns the face into a “face code” — a series of 128 numbers — with an open-source face recognition model that runs in the browser (served from our own site). Only the face code is sent, once for each search, to be compared with the gallery’s face codes in our database; we don’t store it or write it in any log of ours. It stays in that browser tab until the tab is closed or the guest chooses “Forget me”. A guest can search with any photo, so the service cannot tell whether the selfie is of the guest.',
                'B. The faces of the people in the gallery’s photographs. When the host turns face search on, faces in photographs are detected on the device that uploaded the photograph (the guest’s phone) and, if the host asks, on the host’s computer — before and regardless of whether any guest ever searches. For each face, the position in the photo and its face code are sent to us and stored with the photo. This includes photographs waiting for approval, hidden or rejected. The people photographed — who may never use face search, may be children and have not been asked — are not the ones who consented to anything: the searching guest’s consent does not extend to them. We tell uploaders in the gallery notice that this happens; we tell the people photographed through this policy and the gallery rules; and they can ask not to be included (below). No face is cut out of a photograph, no name is attached, and the face codes are not matched to any account or guest identity. Each photograph is linked to its uploader’s display name and per-event hash, so a face code can be traced to a photograph and through it to who uploaded it.',
                'What the searching guest gets: an album of the published photos they appear in, which they can download. Matching can be wrong: it can miss a person, or match another person with a similar face.',
                'Leaving out: a person can ask not to appear in other guests’ searches, from the gallery (“Leave out”) with a selfie, or through the privacy request form (kind “biometric exclusion”). The faces that match are removed from search at once, and their face code (not a photo) is kept only so that photos added later leave them out too.',
                '“Forget me”: removes the faces that match the guest from search at once, deletes any request of theirs to be left out, and clears the face code from their phone.',
                'The host sees only numbers — how many photos are ready for search, how many faces, how many guests asked to be left out — and, in the highlights film, where faces are in a photo; never face codes or whose face is whose.',
                'How long: all of an event’s face data is erased 30 days after the event, at once when the host turns face search off or deletes the gallery or the photograph, and with the account.',
                'Where, and who: in our own systems only (Supabase, European Union). No face data is sent to any other recipient. Photographs containing faces are separately sent to Anthropic for the content check, and to OpenAI for AI photos, where those features are on (section 10).',
                'No minimum age or exclusion for minors is applied: if children are photographed, their faces are processed like anyone’s. We recommend that hosts do not turn on face search for events at which children attend, and parents can ask for exclusion and removal (section 18).',
                'We do not use face search to identify or follow anyone, and hosts may not.',
              ],
            },
          ],
        },
        {
          id: 'insights',
          heading: '13. Invitation insights: how guests use an invitation',
          body: [
            'A host whose plan includes it sees how guests use an invitation — totals only, never who did what.',
            {
              list: [
                'What an invitation page counts: that it was opened, in which language, on what kind of device (phone, tablet or computer — worked out from the browser, whose details aren’t kept), and how the guest got there (a personal link, the shared link, the QR code, or another way); whether the cover was opened, how far down the page was read, how long the page was on screen (up to 30 minutes), and whether the guest started or sent an RSVP, added the event to a calendar, opened the map or navigation, opened the gallery, or switched language.',
                'No cookies, and nothing is kept on the guest’s device: each time the page is opened it picks a random number, kept only in the page’s memory, so that its updates count once. Nothing at all is measured when the browser asks sites not to track (Global Privacy Control or Do Not Track).',
                'We don’t keep IP addresses or browser details for this: an IP address is used only as a one-way hash, to limit abuse (section 9). Automated visitors are not counted.',
                'How long: each page load’s own record is erased after 7 days; the daily totals the host sees stay with the invitation until it, or the account, is deleted.',
              ],
            },
          ],
        },
        {
          id: 'event-day',
          heading: '14. The event day: table numbers and check-in at the entrance',
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
          heading: '15. Family review, design suggestions, versions, read aloud',
          body: [
            {
              list: [
                'Family review: a host can send a private link to the draft of an invitation for family members to comment on, without an account. We keep the comments, the name each person types, when they were written and the host’s replies; the name is also kept in that person’s browser so they don’t type it again, with a random key that lets them delete their own comment (we keep only a one-way hash of it). The link itself is kept only as a one-way hash; the host can set it to expire, replace it or revoke it at any time. The page sends no RSVP and counts nobody. The comments are erased 90 days after the event’s date (the host can delete them earlier), and deleted comments after 30 days.',
                'Design suggestions (“design it for me”): the photos a host chooses are made smaller on the host’s device and, when the plan includes it, sent to Anthropic with the event type, the languages and the mood the host typed — no names or other details — to suggest three designs. Nothing is kept by us from that request, and the photos are never written to our logs. A design the host chooses uploads the photos it uses to the invitation, like any photo the host adds.',
                'Versions: besides each published version, we keep copies of an invitation’s draft as the host edits (at most one every 10 minutes, and before a restore or a new design) so that any of them can be restored. They are kept 90 days, 60 per invitation at most; published versions are kept with the invitation.',
                'Read aloud: when the plan includes it, the invitation’s own texts (the names, date, places and the host’s texts — never guests’ details) are sent to Microsoft (Azure AI Speech) once per language when the host publishes, and the audio it returns is stored with the invitation’s files until the texts change or the invitation or account is deleted. When a guest listens without that audio, their own device reads the text. Listening is not recorded anywhere.',
              ],
            },
          ],
        },
        {
          id: 'support',
          heading: '16. Support tickets: writing to our team',
          body: [
            'A customer can write to our team from the app (“Support”), from the support assistant (“Talk to a person”) or through the site’s contact form, which opens a ticket too.',
            {
              list: [
                'What is kept: the ticket — its subject, its type, the invitation it is about when the customer chose one — and every message in it; the name, email address and phone number given in the contact form; and, for a ticket opened from the support assistant, the conversation with the assistant that the customer saw and chose to attach.',
                'Who sees it: the customer, in the app (a visitor without an account gets the team’s answers by email); and the members of our team whose role includes support, in our admin console, together with the customer’s account details (the plan, message credits, the number of invitations). The team’s internal notes on a ticket are not shown to the customer. What the team does on a ticket is recorded (who, what and when).',
                'Emails: the team’s answer is sent to the customer’s email address (through Resend, section 5); our team is told of a new ticket, or of a customer’s answer, by email with the ticket’s subject only, not the conversation.',
                'The support assistant: the question is answered by an AI model (Anthropic, or OpenAI where the site uses it) from the text typed; please do not type passwords, card numbers or codes. The conversation stays in your browser tab unless you choose to send it to a person.',
                'How long: an answered ticket the customer doesn’t come back to closes by itself after 14 days (writing in it opens it again); a closed ticket and all its messages are erased two years after it was closed; a ticket our team deletes as spam is erased within 30 days.',
              ],
            },
          ],
        },
        {
          id: 'planning',
          heading: '17. Event planning: tasks, budget, vendors and ideas',
          body: [
            'A host can plan an event in the app: a task list, a budget, a list of vendors and a board of notes and ideas. This information is collected for the host, like a guest list (section 1), and only the host sees it.',
            {
              list: [
                'What is kept: the tasks (their names, notes, dates and who is on them), the budget (the total, categories, amounts, payment dates and who pays), the vendors the host adds (the business’s name, and the phone number, email address, website, notes, rating and quote the host types about it), the cards on the ideas board (text, links, pictures, checklists), files the host attaches to a vendor or a cost (quotes, contracts, receipts) or to a card, and the host’s own templates. The vendors are the host’s business contacts, entered by the host; we use them only to show them back to the host.',
                'Files are kept in private storage and opened only through links that expire after an hour. A link the host adds to the ideas board is read once by our server — the page’s title, description and picture — so that the card can show a preview; nothing from the host’s device or account is sent to that page.',
                'Weekly email: unless the host turns it off, once a week we email the host’s own address (through Resend, section 5) the tasks and payments of the coming week. It stops when the event is over.',
                'AI drafts (only where the plan includes it): the description of an event the host types, or the text of one card the host asks to summarize, is sent to Anthropic to draft a plan or suggest steps — together with the event’s date and nothing else about the host, the guests or the invitation. We keep nothing from that request except a count, to apply the daily limit.',
                'How long: with the invitation, until the host deletes it or the account; deleting an account also erases its files and templates. A guest’s details are not part of it: the plan reads the guest list and replies only to show the host numbers (how many are coming), never names, and a vendor or a task is never shown to guests.',
              ],
            },
          ],
        },
        {
          id: 'rights',
          heading: '18. Your rights, and how to use them',
          body: [
            'Under the Privacy Protection Law you may ask to see the information held about you (section 13 of the Law), and to have it corrected, or — where the law allows — deleted, if it is wrong, incomplete, unclear or out of date (section 14). You may also ask us to stop a particular use, to take down a photograph in which you appear, to leave you out of face search, or to remove a photograph of your child. These are not unconditional rights to delete every record: we may need to keep information that the law, a contract, an unresolved complaint or accounting rules require us to keep, and we tell you what we kept and why. Hosts can see, correct and delete most of their information in the app themselves.',
            'Who answers: the information in a guest list, an RSVP and the host’s questions was collected for the host who invited you, who decides about it — so ask them first; you may also ask us, and we will pass the request on or handle it. Media in a gallery, accounts, payments, and face data on our systems are ours to handle too, and the host decides what to publish or delete in their own gallery.',
            'How to ask: use the privacy request form on the site (no account needed; choose the kind of request), or write to us. For one photograph, “Report content” on the photo is the fastest way (section 11). We may need to verify who you are before we release or delete anything, and will not release information about someone else.',
            reach.length
              ? `To make a request: the privacy request form, or ${reach.join(', ')}. We reply within 30 days of receiving your request, and tell you if we need more time or cannot meet the request and why.`
              : 'To make a request: the privacy request form. We reply within 30 days of receiving your request, and tell you if we need more time or cannot meet the request and why.',
            'You may also complain to the Privacy Protection Authority (gov.il) or go to court. For information that reached us from the European Economic Area, further rights and rules may apply.',
          ],
        },
        {
          id: 'cookies',
          heading: '19. Cookies',
          body: [
            'We use essential cookies and browser storage to run the site and the gallery. External content on the site’s own pages (videos from YouTube in its privacy-enhanced mode, Vimeo, Google Maps) loads by default until you choose otherwise, and you can turn it off at any time. The cookie policy has the details, and the “Cookie settings” link at the bottom of the site’s pages changes your choice.',
            'Invitation insights (section 13) use no cookies and keep nothing on the guest’s device.',
          ],
        },
        {
          id: 'children',
          heading: '20. Minors and photographs of children',
          body: [
            'Accounts are for people aged 18 and over. Guests of any age may reply to an invitation through the host who invited them.',
            'Photographs and details of children are a heightened privacy risk. The Privacy Protection Authority recommends not publishing identifiable photographs of other people’s children without their parents’ consent, and the gallery rules ask guests to follow that. A guest cannot give the consent of another person’s child or of that child’s parent. A parent or guardian can ask for a photograph of their child to be hidden or removed, at any time, without an account (section 11 and section 18), and reports about children are handled first. The Service does not detect the age of people in photographs; face search (section 12) and AI photos (section 10) do not exclude children, and we recommend not using them where children attend. A host who gives names and photographs of children as people of honor (for example at a bar mitzvah, a brit or a birthday) confirms they are entitled to.',
          ],
        },
        {
          id: 'changes',
          heading: '21. Changes, and earlier versions',
          body: [
            'We may update this policy. Each version has a number and the date it took effect, shown at the top; significant changes will be announced on the site or by email to hosts. A new version applies from its effective date, and earlier versions are kept unchanged and can be opened from the bottom of this page.',
          ],
        },
        {
          id: 'contact',
          heading: '22. Contact',
          body: [contactLine(c, mail)],
        },
      ],
    };
  }

  const reach = [
    mail ? `במייל ${mail}` : null,
    o.phone ? `בטלפון ${o.phone}` : null,
    o.address ? `בדואר ל${o.address}` : null,
  ].filter(Boolean);
  return {
    title: 'מדיניות פרטיות',
    description: `איך ${c.brand} אוספת, משתמשת ושומרת על מידע אישי של מארחים, של האורחים שלהם ושל אנשים שמופיעים בתצלומים.`,
    intro: [
      `${c.brand} (״השירות״, בכתובת ${c.site}) מאפשרת למארחים ליצור הזמנות דיגיטליות, לשלוח אותן, לקבל אישורי הגעה ובחבילות שכוללות זאת גם להפעיל גלריית תמונות חיה לאירוע. את השירות מפעילה ${who} (״אנחנו״). המדיניות מסבירה איזה מידע אנחנו אוספים, לשם מה, למי הוא מועבר ומה הזכויות שלכם. היא חלה על האתר, על מערכת הניהול של המארחים, על עמודי ההזמנות ועל עמודי הגלריה שהאורחים פותחים. הודעות קצרות במקומות שבהם מבקשים מידע (הרשמה, טופס אישור הגעה, הגלריה, טפסי הדיווח והבקשות) מסכמות את החלקים הרלוונטיים ומפנות לכאן.`,
      {
        note: 'בקצרה: אנחנו משתמשים במידע רק כדי להפעיל את השירות, לא מוכרים אותו, לא משתמשים ברשימות מוזמנים לשיווק, ומארחים יכולים למחוק את רשימות המוזמנים, התשובות והגלריות בכל רגע. מי שמופיע בתצלום יכול לבקש להסיר אותו, עם חשבון או בלעדיו.',
      },
    ],
    sections: [
      {
        id: 'roles',
        heading: '1. מי אחראי על המידע',
        body: [
          'על המידע של חשבונות המארחים (שם, מייל, טלפון, תשלומים ורישומי הרשמה) אנחנו ״בעלי המאגר״, ואנחנו מחליטים איך משתמשים בו.',
          'פרטי מוזמנים שמארח מקליד או מעלה (רשימת מוזמנים), התשובות שהאורחים שולחים והתשובות לשאלות של המארח נאספים עבור המארח: הוא מחליט את מי להזמין ומה לשאול, ואנחנו שומרים ומעבדים את המידע בשמו. המארח אחראי לכך שמותר לו להעלות את פרטי המוזמנים ולשלוח להם את ההזמנה, ולהסביר למוזמנים מה הוא אוסף ולמה.',
          'תצלומים וסרטונים בגלריה של אירוע מועלים בידי אורחים ונשמרים עבור המארח. המארח מחליט למי לתת את קישור הגלריה ומה מתפרסם; אנחנו מפעילים את הגלריה, את הבדיקות, את תהליך הדיווח וההסרה ואת היכולות (כמו חיפוש לפי פנים) שמעבדות את המדיה במערכות שלנו, ובהן אנחנו אחראים גם כן.',
          reach.length
            ? `ענייני פרטיות מטופלים ב: ${reach.join(', ')}, או בטופס בקשות הפרטיות (סעיף 18).`
            : 'ענייני פרטיות מטופלים בטופס בקשות הפרטיות (סעיף 18).',
        ],
      },
      {
        id: 'collect',
        heading: '2. איזה מידע אנחנו אוספים',
        body: [
          {
            list: [
              'פרטי חשבון: שם, כתובת מייל, מספר טלפון (לא חובה) וסיסמה, שנשמרת רק בצורה מוצפנת חד־כיוונית (hash). בכניסה עם Google אנחנו מקבלים מ־Google את השם, המייל ותמונת הפרופיל. חשבון שנפתח עבורכם דרך Badook Events (מערכת האירועים שלנו) מגיע עם השם, המייל והטלפון שמסרתם שם; Badook Events גם מוסרת לנו מי מהמשתמשים שלה פתח עבורכם את החשבון (השם, המזהה שלו שם, המייל והתפקיד), ואנחנו שומרים את זה עם החשבון. את רישום הקריאות שהמערכת שלה שולחת אלינו (סוג הקריאה, מתי, התוצאה והחשבון שהיא נגעה בו, בלי הפרטים שנשלחו) אנחנו שומרים 90 יום.',
              'רישומי אישור: כשאתם פותחים חשבון, או קונים חבילה או קרדיטים, אנחנו רושמים איזו גרסה של התנאים, מדיניות הפרטיות ו(ברכישה) מדיניות ההחזרים אישרתם, ומתי. איננו יוצרים רישומים כאלה לאישורים שנעשו לפני שהרישום הזה התחיל להתקיים.',
              'מה שמארחים יוצרים: פרטי האירוע, טקסטים (והתרגומים שלהם לשפות האחרות של ההזמנה), תמונות, סרטונים, שירים וקישורים שמוסיפים להזמנה, וההגדרות שלה.',
              'רשימות מוזמנים: שמות, מספרי טלפון ולפעמים מיילים, כמות מוזמנים, קבוצה ושפה, מקובץ או בהקלדה; וגם הסטטוס של הקישור האישי של כל מוזמן (נשלח, נמסר, נקרא, נפתח).',
              'רשימת ״לא לשלוח״: מספרי טלפון שביקשו מהמספר שלנו בוואטסאפ להפסיק (תשובת ״הסר״ או STOP, או כיבוי הודעות מאיתנו בוואטסאפ), עם התאריך. אנחנו שומרים אותה כדי שאף מארח לא ישלח אליהם שוב מהמספר הזה.',
              'אישורי הגעה: השם, הטלפון והמייל שהאורח מקליד, אם הוא מגיע ועם כמה, העדפות תזונה, תשובות לשאלות של המארח (שיכולות לכלול כל דבר שהמארח בוחר לשאול) וברכה.',
              'העלאות לגלריה והמידע שמתלווה אליהן (סעיף 10), דיווחים על מדיה ובקשות פרטיות (סעיף 11).',
              'תשלומים: החבילה, הסכומים, התאריכים ומספרי העסקה והמנוי אצל חברת התשלומים. פרטי כרטיס האשראי מוקלדים בעמוד או בטופס של חברת התשלומים ולא מגיעים אלינו; לחיובים חודשיים החברה מוסרת לנו אסימון (token) שמאפשר לחייב את הכרטיס, יחד עם ארבע הספרות האחרונות ותוקף הכרטיס.',
              'תמיכה: הודעות שנשלחות בטופס יצירת הקשר, בעוזר התמיכה ובפניות.',
              'מידע טכני: כתובת IP (נשמרת רק כגיבוב חד־כיווני, לחסימת ספאם ושימוש לרעה), סוג הדפדפן, זמני גישה ויומני תקלות.',
            ],
          },
        ],
      },
      {
        id: 'use',
        heading: '3. לשם מה אנחנו משתמשים במידע',
        body: [
          'אנחנו משתמשים במידע למטרה שלשמה נמסר, ומפרידים בין המטרות:',
          {
            list: [
              'ניהול האירוע ומסירת ההזמנות: יצירה ופרסום של הזמנות, קישורים אישיים, שליחת הזמנות בוואטסאפ כשהמארח מבקש (ותזכורות, מספרי שולחנות וקישורים לגלריה או לאלבום שהוא בוחר לשלוח), קבלה והצגה של אישורי הגעה, סידורי הושבה ורישום בכניסה.',
              'גלריית האירוע: הצגת תמונות וסרטונים של אורחים למי שהגדרות הגלריה מאפשרות לו, מתן אפשרות למארחים לעיין בהם ולהוריד אותם, ובדיקת העלאות לאיכות ולתוכן לא הולם.',
              'שירותי AI: רק יכולות שמארח מפעיל, וכל אחת מתוארת בהמשך (הצעות עיצוב, תרגום, תמונות AI, הקראה, טיוטות תכנון, עוזר התמיכה).',
              'התאמה ביומטרית: רק חיפוש לפי פנים, רק היכן שהוא מופעל (סעיף 12), ורק כדי למצוא את התמונות שאורח מופיע בהן.',
              'חשבונות, חבילות, תשלומים וחשבוניות; הודעות שירות למארחים (מיילים של כניסה וסיסמה, והתראות וסיכומים על אישורי הגעה שבחרו לקבל).',
              'תמיכה ואבטחה: מענה לפניות, דיווחים ותלונות; מניעת ספאם, הונאות ושימוש לרעה; בדיקת תקלות; ושמירת רישומים שהחוק מחייב (למשל רישומים חשבונאיים).',
              'שיפור השירות, על סמך מידע מצטבר שאינו מזהה איש.',
            ],
          },
          'אנחנו לא מוכרים מידע אישי, לא משתמשים בפרטי המוזמנים או בתצלומים לשיווק שלנו, לא מציגים פרסומות ולא שולחים הודעות פרסום למספרי הטלפון ולמיילים של אורחים. תשובה של אורח להזמנה אינה הסכמה לשיווק, לעיבוד ביומטרי או לכל שימוש בתצלומיו מעבר לאירוע.',
        ],
      },
      {
        id: 'duty',
        heading: '4. האם חובה למסור את המידע',
        body: [
          'אין חובה חוקית למסור לנו מידע, ומסירתו היא מרצון. חלק מהמידע נחוץ כדי לתת את השירות: בלי כתובת מייל אי אפשר לפתוח חשבון, בלי מספר הטלפון של מוזמן אי אפשר לשלוח לו את ההזמנה בוואטסאפ, ובלי פרטי קשר אי אפשר לשלוח לכם את תוצאת הדיווח או הבקשה (בדיווח על זכויות יוצרים ובבקשות פרטיות נדרש מייל). אורח יכול להשתמש בגלריה ולהשיב להזמנה בלי למסור שם, כשהטופס של המארח אינו דורש אותו; תצלומים שאנשים מעלים הם בחירתם. לסירוב למסור פרטים לא חובה אין השלכה מעבר לזו שתוארה.',
        ],
      },
      {
        id: 'share',
        heading: '5. למי המידע מועבר',
        body: [
          'אנחנו מעבירים מידע רק כשזה נחוץ להפעלת השירות, לספקים שמחויבים לשמור עליו בסודיות ובאבטחה ולהשתמש בו רק עבורנו:',
          {
            list: [
              'Supabase: מסד הנתונים, ההתחברות ואחסון הקבצים (שרתים באיחוד האירופי, פרנקפורט);',
              'Amazon Web Services (AWS Amplify): אירוח האתר;',
              'Meta (WhatsApp Business Platform): כשמארח שולח הודעות בוואטסאפ, מועברים מספר הטלפון של המוזמן, השם שלו והקישור שבהודעה;',
              'Tranzila ו־PayPlus — חברות תשלומים: סליקת תשלומים (Tranzila ברכישות הנוכחיות; PayPlus במנויים שהתחילו אצלה) והפקת קבלות וחשבוניות;',
              'Resend: שליחת מיילים;',
              'Anthropic: מענה לשאלות בעוזר התמיכה (רק טקסט השאלה); כשהחבילה של המארח כוללת את זה, הבדיקה האוטומטית של תמונות שמועלות לגלריה החיה של אירוע (רק תמונה ממוזערת של התמונה) והצעות עיצוב מהתמונות שהמארח בחר (עותקים מוקטנים, סעיף 15); וכשמארח מבקש תרגום אוטומטי או טיוטות תכנון, הטקסטים הנוגעים לכך (שום דבר על המוזמנים לא נשלח);',
              'OpenAI: כשהחבילה של המארח כוללת צילומי AI עם בעלי השמחה — התמונות של בעלי השמחה שהמארח העלה, תמונה של אורח והבקשה שלו, יחד עם השמות, התפקידים והתיאור שהמארח הקליד על בעלי השמחה וסוג האירוע, כדי ליצור את התמונה (סעיף 10); וכשהאתר משתמש בה במקום Anthropic — מענה בעוזר התמיכה ובשאלון הקצר להזמנה חדשה (רק הטקסט);',
              'Microsoft (Azure AI Speech): כשהחבילה של המארח כוללת את זה, הקראת הטקסטים של ההזמנה עצמה (סעיף 15);',
              'Google (מפות והתחברות), YouTube ו־Vimeo: מפות, סרטונים והתחברות שמוצגים בהזמנות ובאתר.',
            ],
          },
          'מארח רואה את התשובות של האורחים שהזמין, את רשימת המוזמנים ואת כל מה שהועלה לגלריה שלו. שאר אורחי הגלריה רואים את מה שפורסם. אנשי הצוות שלנו רואים מידע רק כפי שסעיף 8 מתאר. נמסור מידע גם כשהחוק או צו של בית משפט מחייבים, או כדי להגן על הזכויות והביטחון של משתמשים, ילדים והשירות. אם השירות יימכר או יתמזג, המידע יעבור לבעלים החדשים לפי המדיניות הזו.',
        ],
      },
      {
        id: 'transfers',
        heading: '6. אחסון והעברות מחוץ לישראל',
        body: [
          'מסד הנתונים והקבצים שלנו נשמרים באיחוד האירופי (Supabase, פרנקפורט). ספקים אחרים שלמעלה מעבדים מידע במקומות אחרים: אצל חלקם — Meta, OpenAI, Anthropic, Resend, Microsoft, Google, AWS, Vimeo ו־YouTube — העיבוד עשוי להיות מחוץ לישראל ומחוץ לאיחוד האירופי, כולל בארצות הברית, ולא קבענו אזור לכל אחד מהם. חברות התשלומים פועלות בישראל.',
          'העברת מידע אל מחוץ לישראל נעשית לפי תקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה), התשס״א־2001, שמתירות אותה, בין היתר, למדינות עם רמת הגנה מתאימה או כנגד התחייבות המקבל להגן על המידע. אחסון באיחוד האירופי לא פותר כשלעצמו כל חובה, ואנחנו מגבילים את מה שאנחנו שולחים: למשל ספקי AI מקבלים רק את הטקסט או התמונות שיכולת צריכה, לא רשימות מוזמנים. כשמידע מגיע אלינו מהאזור הכלכלי האירופי, חלים עליו כללים נוספים.',
        ],
      },
      {
        id: 'security',
        heading: '7. אבטחת המידע',
        body: [
          'אנחנו פועלים לפי תקנות הגנת הפרטיות (אבטחת מידע), התשע״ז־2017: חיבור מוצפן (HTTPS), סיסמאות מוצפנות, הפרדה בין המידע של כל חשבון ברמת מסד הנתונים, ללא גישה ישירה של דפדפנים לטבלאות מסד הנתונים (המערכת משתמשת בפונקציות שרת מוגבלות), מדיה באחסון פרטי שנפתח רק בקישורים שפגים, הרשאות גישה מצומצמות למה שכל רכיב במערכת וכל איש צוות צריכים, רישום של מה שהצוות עושה, ובדיקה תקופתית. אין מערכת חסינה לחלוטין; אם יקרה אירוע אבטחה חמור, נפעל כפי שהדין מחייב, כולל הודעה למי שנפגע ולרשות להגנת הפרטיות כשצריך.',
        ],
      },
      {
        id: 'team',
        heading: '8. מה צוות Badook רואה ויכול לעשות',
        body: [
          'צוות קטן מפעיל את השירות ממערכת ניהול פנימית. לכל חבר צוות יש תפקיד שקובע מה הוא רואה ומה הוא יכול לעשות בה, ולא יותר מזה:',
          {
            list: [
              'בעלים ואדמינים מפעילים את השירות ומנהלים את הצוות. צוות התמיכה עונה לפניות, לדיווחים על מדיה ולבקשות פרטיות, ובשביל זה רואה פרטי קשר. צוות הכספים מטפל בתשלומים, ובשביל זה רואה את פרטי הקשר של הלקוחות. תפקידים אחרים רואים רק מספרים: המיילים ומספרי הטלפון מוסתרים מהם.',
              'מה הצוות רואה: את חשבונות המארחים (שם, מאיפה החשבון הגיע, החבילה, הקרדיטים והתשלומים — ואת המייל והטלפון רק בתפקידים שצריכים אותם), ולכל הזמנה את הפרטים שלה ואת המספרים שלה: כמה מוזמנים, תשובות, הודעות וכניסות. לא את הפרטים של האורחים עצמם ולא את התשובות שלהם. בדיווח על מדיה, הצוות רואה את הדיווח ואת מצב הפריט המדווח (ויכול לראות את הפריט עצמו כדי להחליט); הוא לא מעיין בגלריות מעבר לכך.',
              'מה הצוות יכול לשנות, ורק עם סיבה: להוסיף או להוריד קרדיטים להודעות, לתת חבילה לזמן מוגבל או הנחה, לפתוח יכולת להזמנה אחת מעבר לחבילה, להשעות או להחזיר את הכניסה לחשבון, ולהחליט בדיווחים (להסתיר, להחזיר, או — בעלים ואדמינים בלבד — להסיר פריט). לחשבון מושעה אי אפשר להיכנס; ההזמנות שלו שכבר פורסמו ממשיכות לעבוד לאורחים.',
              'כל פעולה של הצוות נרשמת — מי עשה אותה, מה, מתי ולמה — והרישום נשמר שנתיים, ואז נמחק.',
            ],
          },
        ],
      },
      {
        id: 'retention',
        heading: '9. כמה זמן נשמר המידע',
        body: [
          {
            list: [
              'פרטי החשבון: כל עוד החשבון פתוח. רישומי מה שהחשבון אישר: עם החשבון.',
              'הזמנות, רשימות מוזמנים ואישורי הגעה: עד שהמארח מוחק אותם או את החשבון. אפשר למחוק מוזמן, תשובה או הזמנה שלמה בכל רגע.',
              'אחרי מחיקת חשבון, המידע שלו נמחק תוך 30 יום. עותקים בגיבויים של ספק מסד הנתונים שלנו פוקעים מעצמם במהלך הרגיל לפי לוח הגיבויים של הספק, ולכן מידע שנמחק יכול להישאר בגיבוי עד אז; הוא אינו משוחזר למערכת החיה אלא כדי להתאושש מתקלה.',
              'רישומי תשלומים וחשבוניות: נשמרים כפי שדיני המס מחייבים (שבע שנים), אצל חברת התשלומים שהפיקה אותם; העותקים במערכת שלנו נמחקים עם החשבון.',
              'תרגומים אוטומטיים: הטקסטים המתורגמים, והאם המארח אישר אותם, נשמרים עם ההזמנה עד שהמארח מוחק אותה או את החשבון; הרישום של כל הפעלת תרגום (בשביל המגבלה היומית) נמחק אחרי יומיים.',
              'גיבובי כתובות IP לחסימת שימוש לרעה: עד 30 יום (בדיווח או בבקשה, אנחנו מסירים את הגיבוב מהרישום אחרי 30 יום).',
              'הודעות מטופס יצירת הקשר: עד שנתיים.',
              'דיווחים על מדיה ובקשות פרטיות: שנתיים אחרי שטופלו, ואז נמחקים (רישום שאפשר להשיב איתו לתלונה או לרגולטור).',
              'רשימת ״לא לשלוח״: כל עוד המספר שלנו בוואטסאפ שולח הזמנות, כדי שהבקשה תמשיך להיות מכובדת. בעל המספר יכול לבקש להסיר אותו מהרשימה בטופס יצירת הקשר.',
            ],
          },
        ],
      },
      {
        id: 'gallery',
        heading: '10. הגלריה החיה: תמונות וסרטונים שאורחים מעלים',
        body: [
          'מארח שהחבילה שלו כוללת את זה יכול לפתוח לאירוע גלריה חיה: האורחים פותחים קישור או סורקים קוד QR שהמארח משתף, ומעלים מהטלפון תמונות וסרטונים, בלי להירשם. המארח יכול להוסיף קוד גישה ולקבוע חלון זמן להעלאות. ההעלאות נאספות עבור המארח, כמו רשימת המוזמנים (סעיף 1). תקנון גלריית האירוע מתאר איך הגלריה עובדת לאורחים ולמארחים.',
          {
            list: [
              'מה נשמר: התמונות והסרטונים עצמם (הקובץ המקורי, ועותק תצוגה קטן יותר ותמונה ממוזערת שהטלפון של האורח מכין), הגודל, המידות, האורך ומועד הצילום כפי שהקובץ רושם אותו. שם תצוגה שהאורח בוחר להוסיף וכינוי אופציונלי באינסטגרם (לתיוג) מוצגים ליד מה שהעלה לאורחים האחרים ולמארח. אם האורח הגיע מהקישור האישי של ההזמנה, המארח רואה גם איזה אורח מרשימת המוזמנים העלה. כדי שאורחים יוכלו לראות ולמחוק את מה שהעלו, נשמר במכשיר שלהם מזהה אקראי, ואצלנו הוא נשמר רק כגיבוב חד־כיווני, נפרד לכל אירוע; גם לייקים נשמרים לכל אירוע כגיבוב חד־כיווני.',
              'מיקום ונתונים אחרים בתוך הקבצים: לפני ההעלאה הדפדפן מסיר מהקובץ המקורי נתוני מיקום (GPS) היכן שהוא יכול — ראו הנקודה הבאה. עותק התצוגה והתמונה הממוזערת נוצרים מחדש מהתמונה ואינם נושאים נתונים כאלה. מידע אחר בקובץ המקורי, כמו יצרן ודגם המצלמה או השעה, עשוי להישאר. מכיוון שזה קורה בדפדפן של האורח, לקוח ששונה או שאינו נתמך יכול להעלות קובץ כמו שהוא, וחלק מהפורמטים אינם מכוסים; מארחים מורידים את המקורות כפי שהועלו.',
              'מה הדפדפן מסיר: את נתוני המיקום (GPS) בקובץ המקורי של תמונות JPEG, HEIC, HEIF, AVIF, PNG ו־WebP (כולל מיקום שנכתב בחלק ה־XMP של המטא־נתונים), ואת תגיות המיקום בכותרת של סרטוני MP4, MOV ו־3GP. זה לא מכסה קובצי GIF ו־WebM, מיקום שנשמר במקומות אחרים (למשל שם מקום שנכתב בפרטי ה־IPTC של תצלום, או מסלול GPS בערוץ וידאו מיוחד), או פרטים אחרים בקובץ, כמו יצרן ודגם המצלמה, מספר סידורי ושעת הצילום, שנשארים. קובץ פגום או חריג מועלה כמו שהוא. קבצים שהועלו לפני שזה הוכנס לא שונו.',
              'בדיקות אוטומטיות: הטלפון של האורח בודק כל תמונה (חדות, חושך וכפילויות). כשהחבילה של המארח כוללת בדיקת תוכן אוטומטית, רק התמונה הממוזערת (בלי שמות ובלי פרטים אחרים) נשלחת ל־Anthropic, שמחזירה ציון לתוכן לא הולם ולאיכות וסיבה קצרה, שאנחנו שומרים עם הפריט. העלאה חשודה ממתינה לאישור המארח. הבדיקות עוזרות; אדם בודק את מה שהן עוצרות ואת מה שדווח.',
              'מי רואה: כל מי שיש לו את הקישור לגלריה (ואת קוד הגישה, אם נקבע) רואה את התמונות והסרטונים שפורסמו, יכול להעלות, ועשוי להגיע לקובץ המקורי של סרטון שפורסם; וכך גם מסך האירוע באולם, אם המארח משתמש בו. המארח רואה הכל, גם העלאות שממתינות לאישור או שנדחו ואת תוצאות הבדיקות, ויכול להוריד את כל הקבצים המקוריים. המארח מחליט מה מתפרסם, והוא אחראי לאופן שבו הוא משתף את התמונות ומשתמש בהן. עמוד האלבום, שהמארח יכול לשתף אחרי האירוע, מציג את הפריטים שפורסמו לכל מי שיש לו את הקישור שלו.',
              'הודעה לפני ההעלאה הראשונה: לפני ההעלאה הראשונה ממכשיר לגלריה מוצגת לאורח הודעה קצרה עם קישורים לתקנון הגלריה ולמדיניות הזו, והוא מאשר אותה פעם אחת. אנחנו רושמים שהמכשיר אישר את הגרסה הזו של התקנון — הגיבוב של המכשיר לאותו אירוע, הגרסה והשעה. האישור הזה אינו הסכמה של האנשים שמופיעים בתצלומים.',
              'אחסון: באחסון פרטי (Supabase, באיחוד האירופי). העמודים מקבלים קישורים לקבצים שתוקפם פג אחרי כמה שעות.',
              'מחיקה: אורח יכול למחוק בכל רגע, מאותו מכשיר ואותו דפדפן, את מה שהעלה; המארח יכול למחוק כל תמונה או סרטון, או את הגלריה כולה; ואנשי הצוות יכולים להסיר פריט אחרי דיווח (סעיף 11). הקובץ המקורי, עותק התצוגה והתמונה הממוזערת מוסרים אז מהאחסון, בדרך כלל תוך דקות. מחיקה אינה מסירה עותקים שאנשים הורידו או ששותפו כבר מחוץ לשירות.',
              'כמה זמן: גלריה לא פגה אחרי האירוע: הפריטים נשארים עד שהמארח מוחק אותם, או שהגלריה, ההזמנה או החשבון נמחקים (ואז כמו בסעיף 9). העלאות שלא הושלמו נמחקות אחרי יומיים, והרישומים של פריטים שנמחקו אחרי 30 יום. פריטים שנדחו או הוסתרו נשמרים כמו כל פריט אחר עד שנמחקים.',
              'שליחת הקישור לגלריה לאורחים: כשהמארח שולח אותו מהמספר שלנו בוואטסאפ, נשמרים לכל משפחה מתי נשלח ומצב המסירה של ההודעה, כמו בהזמנות.',
              'סרט הרגעים: מארח יכול ליצור סרט קצר מהגלריה. הסרט נוצר בדפדפן של המארח עצמו — התמונות נקראות שם, לא בשרתים שלנו — ושיר שהמארח בוחר בשבילו נשאר במחשב שלו. אם המארח מוסיף את הסרט לגלריה, הוא נשמר כמו כל העלאה אחרת (ומוצג לאורחים רק אם המארח בוחר בכך). התמונות בו שייכות לאורחים שצילמו אותן, והשיר עשוי להיות של מישהו אחר; הסרט מיועד לאורחי האירוע, ושימושים אחרים דורשים רשות.',
              'האלבום: בבוקר שאחרי האירוע התמונות והסרטונים שפורסמו בגלריה מוצגים גם כאלבום, בעמוד משלו שהמארח משתף את הקישור אליו (ויכול לשלוח אותו לאורחים מהמספר שלנו בוואטסאפ). האלבום לא שומר דבר משלו: הוא מציג את מה שיש בגלריה, בלי מה שהמארח הוציא ממנו, ונמחק עם הגלריה.',
              'צילומי AI עם בעלי השמחה (רק היכן שהחבילה של המארח כוללת את זה והמארח הפעיל): המארח מעלה תמונה של כל אחד מבעלי השמחה, עם שמו, תפקידו ותיאור קצר, ומאשר שהם הסכימו שאורחים ייצרו איתם תמונות AI (זה אישור אחד של המארח; איננו מקבלים הסכמה מכל אדם, והוא אינו הסכמה של אפוטרופוס בשם ילד). אורח שמבקש תמונת AI איתם שולח תמונה שצילם (מוקטנת ומקודדת מחדש בטלפון שלו, בלי פרטי מיקום או מצלמה) ואת הבקשה שלו; אלה, יחד עם התמונות של בעלי השמחה והתיאורים, נשלחים ל־OpenAI, שמחזירה את התמונה החדשה. אנחנו שומרים אותם, את התוצאה ואת השם של האורח אם נתן, באחסון פרטי (Supabase, באיחוד האירופי), בשביל האורח והמארח; האורח יכול למחוק את התמונות שלו, והמארח כל אחת מהן. הכל נמחק 30 יום אחרי האירוע (תמונה שהאורח הוסיף לגלריה נשארת בה כמו כל העלאה, מסומנת כתמונת AI בפיד ובאלבום). OpenAI עשויה לשמור בקשות ותוצאות לתקופה שנקבעת במדיניות שלה, למניעת שימוש לרעה ולשירות שלה; איננו שולטים בכך ואיננו מבטיחים שהיא מוחקת משהו לבקשתנו. אורחים מקבלים הודעה על כך לפני ששולחים. אל תשלחו תמונות של ילדים או של מי שלא הסכים.',
            ],
          },
          'מי שמופיע בתמונה ורוצה שתוסר יכול לבקש מהמארח, או לדווח לנו — עם חשבון או בלעדיו (סעיף 11).',
        ],
      },
      {
        id: 'reports',
        heading: '11. דיווחים על מדיה, בקשות פרטיות ורישומי אישור',
        body: [
          {
            list: [
              'דיווחים על מדיה (״דיווח על תוכן״): כל אחד יכול לדווח על תמונה או סרטון — המעלה, מי שמופיע בהם, הורה או אפוטרופוס, בעל זכויות יוצרים — בלי חשבון. אנחנו שומרים את הקטגוריה, הקשר של המדווח לפריט, התיאור, הפריט או הקישור שאליו הצביע, ואת השם, המייל והטלפון אם בחר למסור (בדיווח על זכויות יוצרים נדרשים שם ומייל), וגיבוב חד־כיווני של כתובת ה־IP. הדיווח מצביע על הפריט בלי להציג פרטים של אחרים. אדם בודק אותו; בדיווח על ילד או על תמונה אינטימית הפריט מוסתר מיד, באופן הפיך, עד להחלטה. מארח הגלריה מקבל הודעה שהוגש דיווח, בלי מי הגיש. אם המדווח מסר מייל, אנחנו שולחים לו את התוצאה. כל שלב נרשם. עותק של הפריט לא נעשה.',
              'בקשות פרטיות: הטופס שואל את סוג הבקשה, הקשר של המבקש למידע, שם ומייל (נחוצים כדי לענות), טלפון אופציונלי ופרטים. הוא משמש לטיפול בבקשה, לאימות המבקש לפני שמשחררים או מוחקים משהו, ולמענה; אנשי צוות ו, כשהבקשה נוגעת לגלריה, המארח לפי הצורך, רואים אותו.',
              'שניהם נשמרים שנתיים אחרי שטופלו, וגיבוב ה־IP מוסר אחרי 30 יום.',
              'רישומי אישור: הגרסה של התנאים והמדיניות שמארח אישר כשפתח חשבון או קנה (סעיף 2).',
            ],
          },
        ],
      },
      {
        id: 'faces',
        heading: '12. ״התמונות שאני בהן״: חיפוש לפי פנים בגלריה (רק היכן שהוא מופעל)',
        body: [
          {
            note: c.faceSearch
              ? 'הסעיף הזה חל רק על אירועים שהמארח שלהם הפעיל חיפוש לפי פנים. כשהחיפוש כבוי, שום פנים לא מעובדים. חיפוש לפי פנים הוא יכולת ביומטרית והוא כבוי אלא אם מארח מפעיל אותו לאירוע.'
              : 'הסעיף הזה חל רק על אירועים שהמארח שלהם מפעיל חיפוש לפי פנים. החיפוש לפי פנים לא מוצע בשירות כרגע, ולכן שום פנים לא מעובדים. אם הוא יוצע בהמשך, המדיניות תעודכן לפני שיופעל.',
          },
          'חיפוש לפי פנים כולל שתי פעולות עיבוד שונות, והן מתוארות בנפרד כי הסכמת האורח שמחפש אינה מכסה את האחרת.',
          {
            list: [
              'א. הפנים של האורח שמחפש. פנים הם מידע ביומטרי, ולכן הסלפי של אורח משמש רק בהסכמה מפורשת שלו — תיבת סימון נפרדת, לא מסומנת מראש, במסך משלה, שאינה משולבת באישור ההגעה, בגישה לגלריה או בהעלאה. הסלפי מצולם או נבחר בטלפון של האורח ומעובד רק שם; הוא אף פעם לא נשלח אלינו ולא נשמר. הטלפון הופך את הפנים ל״קוד פנים״ — סדרה של 128 מספרים — בעזרת מודל קוד פתוח לזיהוי פנים שרץ בדפדפן (ונטען מהאתר שלנו). רק קוד הפנים נשלח, פעם אחת לכל חיפוש, כדי להשוות אותו לקודי הפנים של הגלריה במסד הנתונים שלנו; אנחנו לא שומרים אותו ולא רושמים אותו באף יומן שלנו. הוא נשאר בלשונית הדפדפן עד שסוגרים אותה או בוחרים ״לשכוח אותי״. אפשר לחפש עם כל תמונה, ולכן השירות אינו יכול לדעת אם הסלפי הוא של האורח.',
              'ב. הפנים של האנשים בתצלומי הגלריה. כשהמארח מפעיל חיפוש לפי פנים, פנים בתצלומים מזוהים במכשיר שהעלה את התצלום (הטלפון של האורח) ואם המארח מבקש, גם במחשב של המארח — לפני ובלי קשר לשאלה אם אורח כלשהו יחפש אי פעם. לכל פנים, המיקום בתמונה וקוד הפנים נשלחים אלינו ונשמרים עם התמונה. זה כולל תצלומים שממתינים לאישור, מוסתרים או נדחו. האנשים המצולמים — שאולי לא ישתמשו לעולם בחיפוש, אולי הם ילדים, ולא נשאלו — אינם מי שהסכים לדבר: הסכמת האורח שמחפש אינה מתרחבת אליהם. אנחנו מודיעים למעלים בהודעת הגלריה שזה קורה; מודיעים לאנשים המצולמים במדיניות הזו ובתקנון הגלריה; והם יכולים לבקש שלא ייכללו (להלן). שום פנים לא נגזרים מתמונה, שום שם לא מוצמד, וקודי הפנים אינם מותאמים לשום חשבון או זהות של אורח. כל תצלום מקושר לשם התצוגה של המעלה ולגיבוב שלו לאירוע, ולכן אפשר לעקוב מקוד פנים אל תצלום ודרכו אל מי שהעלה אותו.',
              'מה האורח שמחפש מקבל: אלבום של התמונות שפורסמו ושהוא מופיע בהן, שאפשר להוריד. ההתאמה יכולה לטעות: היא יכולה לפספס אדם, או להתאים אדם אחר עם פנים דומים.',
              'השמטה: אדם יכול לבקש לא להופיע בחיפושים של אורחים אחרים, מתוך הגלריה (״להשמיט אותי״) עם סלפי, או בטופס בקשות הפרטיות (סוג ״החרגה מזיהוי פנים״). הפנים שתואמים מוסרים מהחיפוש מיד, וקוד הפנים שלו (לא תמונה) נשמר רק כדי שגם תמונות שיתווספו אחר כך ישמיטו אותו.',
              '״לשכוח אותי״: מסיר מיד מהחיפוש את הפנים שתואמים לאורח, מוחק בקשת השמטה שלו אם הייתה, ומוחק את קוד הפנים מהטלפון שלו.',
              'המארח רואה רק מספרים — כמה תמונות מוכנות לחיפוש, כמה פנים, כמה אורחים ביקשו להישמט — ובסרט הרגעים, איפה פנים נמצאים בתמונה; אף פעם לא קודי פנים ולא של מי כל פנים.',
              'כמה זמן: כל נתוני הפנים של אירוע נמחקים 30 יום אחרי האירוע, מיד כשהמארח מכבה את החיפוש או מוחק את הגלריה או את התצלום, ועם מחיקת החשבון.',
              'איפה, ולמי: רק במערכות שלנו (Supabase, באיחוד האירופי). שום נתון פנים לא נשלח לנמען אחר. תצלומים שמכילים פנים נשלחים בנפרד ל־Anthropic לבדיקת התוכן, ול־OpenAI לצילומי AI, היכן שהיכולות האלה פועלות (סעיף 10).',
              'לא מוחל גיל מינימום ולא החרגה של קטינים: אם מצלמים ילדים, הפנים שלהם מעובדים כמו של כל אחד. אנו ממליצים שמארחים לא יפעילו חיפוש לפי פנים באירועים שבהם ילדים, וההורים יכולים לבקש החרגה והסרה (סעיף 18).',
              'איננו משתמשים בחיפוש לפי פנים כדי לזהות או לעקוב אחר מישהו, ומארחים אינם רשאים.',
            ],
          },
        ],
      },
      {
        id: 'insights',
        heading: '13. נתוני ההזמנה: איך אורחים משתמשים בהזמנה',
        body: [
          'מארח שהחבילה שלו כוללת את זה רואה איך אורחים משתמשים בהזמנה — רק סיכומים, אף פעם לא מי עשה מה.',
          {
            list: [
              'מה עמוד ההזמנה סופר: שהוא נפתח, באיזו שפה, באיזה סוג מכשיר (טלפון, טאבלט או מחשב — לפי הדפדפן, שפרטיו לא נשמרים), ואיך האורח הגיע (קישור אישי, הקישור המשותף, קוד ה־QR או דרך אחרת); אם המעטפה נפתחה, עד כמה נקרא העמוד, כמה זמן הוא היה על המסך (עד 30 דקות), ואם האורח התחיל או שלח אישור הגעה, הוסיף את האירוע ליומן, פתח את המפה או הניווט, פתח את הגלריה או החליף שפה.',
              'בלי עוגיות, ושום דבר לא נשמר במכשיר של האורח: בכל פתיחה העמוד בוחר מספר אקראי שנשמר רק בזיכרון של העמוד, כדי שהעדכונים שלו ייספרו פעם אחת. כשהדפדפן מבקש מאתרים לא לעקוב (Global Privacy Control או Do Not Track) — לא נמדד כלום.',
              'אנחנו לא שומרים לשם כך כתובות IP או פרטי דפדפן: כתובת IP משמשת רק כגיבוב חד־כיווני, להגבלת שימוש לרעה (סעיף 9). מבקרים אוטומטיים לא נספרים.',
              'כמה זמן: הרישום של כל פתיחה נמחק אחרי 7 ימים; הסיכומים היומיים שהמארח רואה נשמרים עם ההזמנה עד שהיא, או החשבון, נמחקים.',
            ],
          },
        ],
      },
      {
        id: 'event-day',
        heading: '14. יום האירוע: מספרי שולחנות ורישום בכניסה',
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
        heading: '15. עיון המשפחה, הצעות עיצוב, גרסאות והקראה',
        body: [
          {
            list: [
              'עיון המשפחה: מארח יכול לשלוח לבני המשפחה קישור פרטי לטיוטה של ההזמנה, כדי שיעירו עליה בלי חשבון. נשמרים ההערות, השם שכל אחד מקליד, מתי נכתבו, והתשובות של המארח; השם נשמר גם בדפדפן של אותו אדם כדי שלא יצטרך להקליד אותו שוב, עם מפתח אקראי שמאפשר לו למחוק את ההערה שלו (אנחנו שומרים רק גיבוב חד־כיווני שלו). הקישור עצמו נשמר רק כגיבוב חד־כיווני; המארח יכול לקבוע לו תפוגה, להחליף אותו או לבטל אותו בכל רגע. העמוד לא שולח אישורי הגעה ולא סופר אף אחד. ההערות נמחקות 90 יום אחרי תאריך האירוע (המארח יכול למחוק אותן קודם), והערות שנמחקו אחרי 30 יום.',
              'הצעות עיצוב ("עצבו לי"): התמונות שהמארח בוחר מוקטנות במכשיר שלו, וכשהחבילה כוללת את זה נשלחות ל־Anthropic יחד עם סוג האירוע, השפות ומצב הרוח שהמארח הקליד (בלי שמות ובלי פרטים אחרים), כדי להציע שלושה עיצובים. אנחנו לא שומרים דבר מהבקשה הזו, והתמונות לא נכתבות ליומנים שלנו. עיצוב שהמארח בוחר מעלה להזמנה את התמונות שהוא משתמש בהן, כמו כל תמונה שהמארח מוסיף.',
              'גרסאות: מלבד כל גרסה שפורסמה, אנחנו שומרים עותקים של טיוטת ההזמנה בזמן העריכה (לכל היותר פעם ב־10 דקות, ולפני שחזור או עיצוב חדש), כדי שאפשר יהיה לשחזר כל אחד מהם. הם נשמרים 90 יום, עד 60 להזמנה; גרסאות שפורסמו נשמרות עם ההזמנה.',
              'הקראת ההזמנה: כשהחבילה כוללת את זה, הטקסטים של ההזמנה עצמה (השמות, התאריך, המקומות והטקסטים של המארח — לעולם לא פרטים של אורחים) נשלחים ל־Microsoft (Azure AI Speech) פעם אחת לכל שפה כשהמארח מפרסם, וההקראה שמתקבלת נשמרת עם הקבצים של ההזמנה עד שהטקסטים משתנים או שההזמנה או החשבון נמחקים. אורח שמאזין כשאין הקראה כזו, המכשיר שלו עצמו מקריא את הטקסט. ההאזנה לא נרשמת בשום מקום.',
            ],
          },
        ],
      },
      {
        id: 'support',
        heading: '16. פניות לצוות: כשכותבים לנו',
        body: [
          'אפשר לכתוב לצוות שלנו מהאפליקציה (״תמיכה״), מעוזר התמיכה (״לדבר עם נציג״), או בטופס יצירת הקשר באתר, שגם הוא פותח פנייה.',
          {
            list: [
              'מה נשמר: הפנייה — הנושא שלה, הסוג, וההזמנה שהיא עוסקת בה כשהלקוח בחר אחת — וכל ההודעות שבה; השם, כתובת המייל ומספר הטלפון שנמסרו בטופס יצירת הקשר; ובפנייה שנפתחה מעוזר התמיכה, השיחה עם העוזר שהלקוח ראה ובחר לצרף.',
              'מי רואה אותה: הלקוח, באפליקציה (מבקר בלי חשבון מקבל את תשובות הצוות במייל); וחברי הצוות שלנו שהתפקיד שלהם כולל תמיכה, במערכת הניהול שלנו, יחד עם פרטי החשבון של הלקוח (החבילה, קרדיטים להודעות, מספר ההזמנות). הערות פנימיות של הצוות על פנייה לא מוצגות ללקוח. מה שהצוות עושה בפנייה נרשם (מי, מה ומתי).',
              'מיילים: תשובת הצוות נשלחת לכתובת המייל של הלקוח (דרך Resend, סעיף 5); הצוות שלנו מקבל על פנייה חדשה, או על תשובה של לקוח, מייל עם נושא הפנייה בלבד, בלי השיחה.',
              'עוזר התמיכה: השאלה נענית בידי מודל AI (Anthropic, או OpenAI היכן שהאתר משתמש בה) מהטקסט שהוקלד; נא לא להקליד סיסמאות, מספרי כרטיס או קודים. השיחה נשארת בלשונית הדפדפן אלא אם בחרתם לשלוח אותה לאדם.',
              'כמה זמן: פנייה שנענתה והלקוח לא חזר אליה נסגרת מעצמה אחרי 14 יום (כתיבה בה פותחת אותה מחדש); פנייה סגורה וכל ההודעות שבה נמחקות שנתיים אחרי שנסגרה; פנייה שהצוות מוחק כספאם נמחקת תוך 30 יום.',
            ],
          },
        ],
      },
      {
        id: 'planning',
        heading: '17. תכנון האירוע: משימות, תקציב, ספקים ורעיונות',
        body: [
          'מארח יכול לתכנן אירוע במערכת: רשימת משימות, תקציב, רשימת ספקים ולוח של פתקים ורעיונות. המידע הזה נאסף עבור המארח, כמו רשימת המוזמנים (סעיף 1), ורק המארח רואה אותו.',
          {
            list: [
              'מה נשמר: המשימות (שמותיהן, הערות, תאריכים ומי אחראי), התקציב (הסכום הכולל, קטגוריות, סכומים, מועדי תשלום ומי משלם), הספקים שהמארח מוסיף (שם העסק, ומספר הטלפון, כתובת המייל, האתר, ההערות, הדירוג וההצעה שהמארח מקליד עליו), הכרטיסים בלוח הרעיונות (טקסט, קישורים, תמונות, רשימות), קבצים שהמארח מצרף לספק, להוצאה או לכרטיס (הצעות מחיר, חוזים, קבלות), והתבניות של המארח עצמו. הספקים הם אנשי קשר עסקיים של המארח, שהוא מזין; אנחנו משתמשים בהם רק כדי להציג אותם בחזרה למארח.',
              'הקבצים נשמרים באחסון פרטי ונפתחים רק בקישורים שפגים אחרי שעה. קישור שהמארח מוסיף ללוח הרעיונות נקרא פעם אחת בשרת שלנו — הכותרת, התיאור והתמונה של העמוד — כדי שהכרטיס יציג תצוגה מקדימה; שום דבר מהמכשיר או מהחשבון של המארח לא נשלח לעמוד הזה.',
              'מייל שבועי: אלא אם המארח כיבה אותו, פעם בשבוע נשלחים לכתובת המייל של המארח עצמו (דרך Resend, סעיף 5) המשימות והתשלומים של השבוע הקרוב. הוא נפסק כשהאירוע עבר.',
              'טיוטות AI (רק היכן שהחבילה כוללת את זה): תיאור האירוע שהמארח מקליד, או הטקסט של כרטיס אחד שהמארח מבקש לסכם, נשלחים ל־Anthropic כדי לנסח תוכנית או להציע צעדים — יחד עם תאריך האירוע ושום דבר אחר על המארח, על האורחים או על ההזמנה. אנחנו לא שומרים דבר מהבקשה, חוץ ממונה שמאפשר להחיל את המגבלה היומית.',
              'כמה זמן: עם ההזמנה, עד שהמארח מוחק אותה או את החשבון; מחיקת חשבון מוחקת גם את הקבצים והתבניות שלו. פרטי האורחים אינם חלק מזה: התכנון קורא את רשימת המוזמנים והתשובות רק כדי להציג למארח מספרים (כמה מגיעים), אף פעם לא שמות, ואורחים אף פעם לא רואים ספק או משימה.',
            ],
          },
        ],
      },
      {
        id: 'rights',
        heading: '18. הזכויות שלכם, ואיך לממש אותן',
        body: [
          'לפי חוק הגנת הפרטיות אתם רשאים לבקש לעיין במידע שנשמר עליכם (סעיף 13 לחוק), ולתקן אותו, או — כשהחוק מתיר — למחוק אותו, אם הוא לא נכון, לא שלם, לא ברור או לא מעודכן (סעיף 14). אפשר גם לבקש שנפסיק שימוש מסוים, שנוריד תצלום שאתם מופיעים בו, שלא נכלול אתכם בחיפוש לפי פנים, או שנסיר תצלום של ילדכם. אלה אינן זכויות בלתי מותנות למחוק כל רישום: ייתכן שנצטרך לשמור מידע שהחוק, חוזה, תלונה שלא הוכרעה או כללי חשבונאות מחייבים אותנו לשמור, ונגיד לכם מה שמרנו ולמה. מארחים יכולים לראות, לתקן ולמחוק את רוב המידע שלהם בעצמם במערכת.',
          'מי עונה: המידע ברשימת מוזמנים, באישור הגעה ובשאלות המארח נאסף עבור המארח שהזמין אתכם, והוא מחליט בו — ולכן כדאי לפנות אליו קודם; אפשר לפנות גם אלינו, ואנחנו נעביר את הבקשה או נטפל בה. מדיה בגלריה, חשבונות, תשלומים ונתוני פנים במערכות שלנו הם גם באחריותנו, והמארח מחליט מה לפרסם או למחוק בגלריה שלו.',
          'איך פונים: בטופס בקשות הפרטיות באתר (בלי חשבון; בוחרים את סוג הבקשה), או בכתב אלינו. לתצלום אחד, ״דיווח על תוכן״ בתצלום הוא הדרך המהירה ביותר (סעיף 11). ייתכן שנצטרך לאמת מי אתם לפני שנמסור או נמחק משהו, ולא נמסור מידע על אדם אחר.',
          reach.length
            ? `לבקשות: בטופס בקשות הפרטיות, או ${reach.join(', ')}. נשיב תוך 30 יום מקבלת הבקשה, ונודיע אם נזדקק לעוד זמן או שלא נוכל להיענות ומדוע.`
            : 'לבקשות: בטופס בקשות הפרטיות. נשיב תוך 30 יום מקבלת הבקשה, ונודיע אם נזדקק לעוד זמן או שלא נוכל להיענות ומדוע.',
          'אפשר גם להגיש תלונה לרשות להגנת הפרטיות (gov.il) או לפנות לבית המשפט. על מידע שהגיע אלינו מהאזור הכלכלי האירופי עשויות לחול זכויות וכללים נוספים.',
        ],
      },
      {
        id: 'cookies',
        heading: '19. עוגיות',
        body: [
          'אנחנו משתמשים בעוגיות ובאחסון דפדפן חיוניים להפעלת האתר והגלריה. תוכן חיצוני בעמודי האתר עצמו (סרטונים מ־YouTube במצב הפרטיות המוגברת שלו, Vimeo ומפות Google) נטען כברירת מחדל עד שתבחרו אחרת, ואפשר לכבות אותו בכל רגע. כל הפרטים במדיניות העוגיות, ובקישור ״הגדרות עוגיות״ בתחתית עמודי האתר אפשר לשנות את הבחירה.',
          'נתוני ההזמנה (סעיף 13) לא משתמשים בעוגיות ולא שומרים שום דבר במכשיר של האורח.',
        ],
      },
      {
        id: 'children',
        heading: '20. קטינים ותצלומי ילדים',
        body: [
          'פתיחת חשבון מיועדת לבני 18 ומעלה. אורחים בכל גיל יכולים להשיב להזמנה דרך המארח שהזמין אותם.',
          'תצלומים ופרטים של ילדים הם סיכון מוגבר לפרטיות. הרשות להגנת הפרטיות ממליצה שלא לפרסם תצלומים מזוהים של ילדים של אחרים בלי הסכמת הוריהם, ותקנון הגלריה מבקש מאורחים לפעול כך. אורח אינו יכול לתת את הסכמתו של ילד של אדם אחר או של הורהו. הורה או אפוטרופוס יכולים לבקש להסתיר או להסיר תצלום של ילדם בכל עת, בלי חשבון (סעיפים 11 ו־18), ודיווחים על ילדים מטופלים ראשונים. השירות אינו מזהה את גיל האנשים שבתצלומים; חיפוש לפי פנים (סעיף 12) ותמונות AI (סעיף 10) אינם מחריגים ילדים, ואנו ממליצים לא להשתמש בהם היכן שיש ילדים. מארח שמוסר שמות ותצלומים של ילדים כבעלי שמחה (למשל בבר מצווה, בברית או ביום הולדת) מאשר שהוא רשאי לעשות זאת.',
        ],
      },
      {
        id: 'changes',
        heading: '21. שינויים וגרסאות קודמות',
        body: [
          'אנחנו עשויים לעדכן את המדיניות. לכל גרסה יש מספר ותאריך כניסה לתוקף, שמופיעים בראש העמוד, ועל שינויים מהותיים נודיע באתר או במייל למארחים. גרסה חדשה חלה מתאריך כניסתה לתוקף, וגרסאות קודמות נשמרות ללא שינוי ואפשר לפתוח אותן בתחתית העמוד.',
        ],
      },
      {
        id: 'contact',
        heading: '22. יצירת קשר',
        body: [contactLine(c, mail)],
      },
    ],
  };
}
