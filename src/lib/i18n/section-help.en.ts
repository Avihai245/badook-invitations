import type { SectionHelpDict } from './section-help.he';

/** The editor's "?" for each section (editor/SectionHelp) — English. */
export const sectionHelpEn: SectionHelpDict = {
  labels: { what: 'What it is', guests: 'What guests see', tip: 'Tip', title: '{name}: what it does' },
  types: {
    cover: {
      what: 'The envelope that opens before the invitation — with a seal and initials. Choose how it opens: envelope, gate, curtain, fireworks and more.',
      guests: 'The first thing they see: a tap, and the envelope opens. They can also skip it.',
      tip: 'Want the invitation to open straight away? Turn the envelope off in the same card.',
    },
    hero: {
      what: 'The first screen after the opening: the names, the date and an opening line, over a photo, a video or the design’s art.',
      guests:
        'Your names, big, on the background you chose. Guests from their personal link can see a greeting with their name.',
      tip: 'Uploaded a photo? Mark its important part so it stays in frame on every screen.',
    },
    countdown: {
      what: 'A clock counting days, hours and minutes to the event (or another moment you choose).',
      guests: 'How long is left — updated on every visit.',
      tip: 'After the event the countdown turns into the line you wrote.',
    },
    story: {
      what: 'A few words about you or the event — how you met, why you celebrate.',
      guests: 'A short, warm paragraph in the middle of the invitation.',
      tip: 'Three or four lines are enough; long text is read less on a phone.',
    },
    venues: {
      what: 'Up to 4 places (ceremony, reception…) — each with an address, map, Waze and a calendar reminder.',
      guests: 'Buttons to navigate with Waze and Google Maps and to add it to their calendar.',
      tip: 'Write the full address with the city — the map and navigation will be exact.',
    },
    timeline: {
      what: 'The event’s schedule: a time and a description for each part (reception, ceremony, dancing).',
      guests: 'A short list of times, so they know when to come and what’s ahead.',
      tip: '3–5 main parts are enough.',
    },
    transport: {
      what: 'Shuttles, parking and how to get there.',
      guests: 'Where and when the shuttles leave, and where to park.',
      tip: 'A shuttle? Give an exact pick-up point and time — it’s the most asked question.',
    },
    accommodation: {
      what: 'Hotels and guesthouses nearby, for guests coming from far.',
      guests: 'A name, a link and details for each place.',
      tip: 'Got a discount for your guests? Write the code.',
    },
    dress_code: {
      what: 'What to wear — festive, white, comfortable for outdoors…',
      guests: 'A line or two that helps them dress right.',
      tip: 'Outdoors? Mention comfortable shoes or something warm for the evening.',
    },
    menu: {
      what: 'What will be served.',
      guests: 'The dishes, and vegetarian, vegan or gluten-free marks if any.',
      tip: 'Guests’ dietary preferences are collected in the RSVP form.',
    },
    activities: {
      what: 'What awaits the guests — a workshop, a show, a kids’ corner.',
      guests: 'A short list of what will happen.',
      tip: 'Great for bar/bat mitzvahs and birthdays.',
    },
    custom: {
      what: 'A title and text of your own, for anything without a section of its own.',
      guests: 'A block of text with a title — and, if you like, a button with a link.',
      tip: 'Add as many as you need and drag each into place.',
    },
    custom_media: {
      what: 'A title and text over a picture or beside it — or a picture alone.',
      guests: 'A visual moment inside the invitation, with the picture you chose.',
      tip: 'In the “Layout” card, choose the picture as the background, beside the text or alone.',
    },
    faq: {
      what: 'Questions and answers — parking, kids, when it ends.',
      guests: 'Questions that open on a tap to show the answer.',
      tip: 'Think of what people ask you on the phone — and answer it here.',
    },
    gallery: {
      what: 'Your photos inside the invitation.',
      guests: 'A gallery they can swipe through and enlarge.',
      tip: 'This isn’t the event’s live gallery — that one has the “Guests’ gallery” section.',
    },
    gifts: {
      what: 'Ways to give a gift: Bit, PayBox, a bank transfer or a link.',
      guests: 'Buttons and details they copy with a tap.',
      tip: 'Not sure? Hide the section with its switch and it won’t show.',
    },
    reveal: {
      what: 'A little game that reveals the date: scratch, tap or spin.',
      guests: 'They scratch or tap — and the date appears.',
      tip: 'Especially good for a save-the-date.',
    },
    rsvp: {
      what: 'The RSVP form: what to ask (name, phone, how many are coming, dietary preferences, your own questions) and until when.',
      guests:
        'A short form to fill in and send. Guests from their personal link get it filled in with their name.',
      tip: 'The RSVP deadline is set in “Settings” → Event details.',
    },
    footer: {
      what: 'The end of the invitation: the names, the date and a closing line.',
      guests: 'A beautiful close to the invitation.',
      tip: 'Write a personal line, like “Can’t wait to see you”.',
    },
    parents: {
      what: 'The parents’ names — each side’s, or one line.',
      guests: 'Who is inviting: the parents, by name.',
      tip: 'Grandparents or “the families” work too.',
    },
    when: {
      what: 'The date, big: the Hebrew date, the time, a countdown and a calendar reminder.',
      guests: 'Exactly when — and a button to add it to their calendar.',
      tip: 'Change the date and time in “Settings” → Event details; they update everywhere.',
    },
    where: {
      what: 'One place, big: name, address, map, Waze and calendar.',
      guests: 'Where the event is, with navigation buttons.',
      tip: 'Several places? Use the “Venue” section.',
    },
    quote: {
      what: 'A verse, a song or a line you love — big.',
      guests: 'A moving line on a screen of its own.',
      tip: 'A short line works best.',
    },
    live_gallery: {
      what: 'A button and QR code inviting guests to upload photos to the event’s live gallery.',
      guests: 'On the day — shoot and upload; after the event — straight to the album.',
      tip: 'The gallery itself (and the hall screen) is managed in “Celebrate” → Gallery.',
    },
  },
};
