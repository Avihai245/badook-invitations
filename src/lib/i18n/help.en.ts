import type { helpHe } from './help.he';

/** "What does each button here do?" — the "?" card of each area in the app (AreaHelp), English. */
export const helpEn: typeof helpHe = {
  list: {
    title: 'My events: what each button does',
    items: {
      newInvitation: {
        label: 'New event',
        text: 'Three short questions — the kind of event, what you need (an invitation, planning, seating, the event day — only what’s relevant) and details.',
      },
      card: {
        label: 'Clicking an event',
        text: 'Anywhere on the card opens the event home: your path, with the step for now one button away.',
      },
      enter: {
        label: 'Open the event',
        text: 'The big button at the bottom of the card. Everything is there: guests, sending, RSVPs and the design. With one event you go straight in.',
      },
      nextStep: {
        label: 'The next step',
        text: 'The colored line on the card: what to do now for the event — publish, add guests, send or set a budget. One tap takes you there.',
      },
      countdown: {
        label: 'Countdown',
        text: 'On the invitation: how many days are left. On the day itself it says “Today!”, and afterwards “The event has passed”.',
      },
      menu: {
        label: 'The ⋯ menu on each event',
        text: 'Open the event, edit the design, guests, share (once published), responses, duplicate and archive.',
      },
      guests: {
        label: 'Guests',
        text: 'The guest list: import from Excel, a personal link for each guest and sending on WhatsApp.',
      },
      responses: {
        label: 'Responses',
        text: 'Who is coming and with how many, dietary preferences, Excel export and email alerts.',
      },
      duplicate: {
        label: 'Duplicate',
        text: 'A copy of the invitation as a new draft, for another event in the same style.',
      },
      archive: {
        label: 'Archive',
        text: 'Takes an invitation off the list (it stops counting toward your plan) without deleting it. You can bring it back any time.',
      },
      archiveView: {
        label: 'The “Archive (number)” button',
        text: 'At the top, next to “New invitation”: shows your archived invitations. “Back to invitations” returns to the usual list.',
      },
      followUp: {
        label: 'Create the full invitation',
        text: 'On a save-the-date: creates the full invitation with the same details and links the two once it’s published.',
      },
      status: {
        label: 'Not published yet / Published',
        text: '“Not published yet”: guests can’t see the invitation yet. “Published”: the link works. “Unpublished changes”: press Publish again in the editor.',
      },
    },
  },
  overview: {
    title: 'The event home: what each thing does',
    items: {
      countdown: {
        label: 'The event',
        text: 'Its name, date and how many days are left. Once published: copy the link and open the invitation.',
      },
      next: {
        label: 'Your path',
        text: 'The steps your event needs by the tools you chose. The highlighted one is what to do now — one button. ✓ — done; “Later” — waits for something before it.',
      },
      howTo: {
        label: 'How do I do this?',
        text: 'On the highlighted step: opens the guide right on it, in short steps.',
      },
      rsvp: {
        label: 'RSVPs',
        text: 'After sending: coming, not coming and not answered — the same numbers as the guest list, general-link replies included.',
      },
      budget: {
        label: 'The budget gauge',
        text: 'Once you set a budget: how much of it you’re committed to — green to 85%, amber to 100%, red — over.',
      },
      tasks: {
        label: 'This week’s tasks',
        text: 'When planning: only what’s worth closing this week, and what’s next — not the whole plan.',
      },
      tools: {
        label: 'Need something else?',
        text: 'The tools you haven’t chosen yet — planning, seating, the event day. “Change tools” adds or removes; nothing is deleted.',
      },
    },
  },
  gallery: {
    title: 'Choosing a design: what each button does',
    items: {
      filter: {
        label: 'Event type',
        text: 'Shows only the designs that suit the event you chose. The number next to each type: how many designs it has.',
      },
      language: { label: 'Hebrew / English', text: 'Which language the design previews are shown in.' },
      preview: {
        label: 'Clicking a design',
        text: 'A live preview on a phone, with colors and fonts to choose from (including “More fonts”).',
      },
      premium: {
        label: 'Premium',
        text: 'Special designs. You can edit them on any plan and publish them on Pro and Business.',
      },
      demo: {
        label: 'Live demo',
        text: 'Opens a sample invitation in a new tab, exactly as guests will see it.',
      },
      use: {
        label: 'Use this design',
        text: 'A short wizard: event type, names and date, and language. Then the editor opens with everything ready.',
      },
    },
  },
  preview: {
    title: 'Preview: what each button does',
    items: {
      phone: {
        label: 'The phone',
        text: 'The sample invitation, live: scroll and tap it exactly like a guest.',
      },
      language: { label: 'Hebrew / English', text: 'Which language the sample invitation is shown in.' },
      palettes: {
        label: 'Colors',
        text: 'Ready color sets for this design. Your choice carries over to your invitation, and you can change it later.',
      },
      fonts: {
        label: 'Fonts',
        text: 'Font pairs for the names and the text, in Hebrew and English. “More fonts” opens a library of extra pairs.',
      },
      demo: {
        label: 'Live demo in a new tab',
        text: 'The sample invitation full screen, with the envelope, the music and the animations.',
      },
      use: {
        label: 'Use this design',
        text: 'Continues to the short wizard, with the colors and fonts you picked here.',
      },
    },
  },
  wizard: {
    title: 'New invitation: what each step does',
    items: {
      eventType: {
        label: 'Event type',
        text: 'Decides which names we ask for and which ready texts go into the invitation. You can change it later in “Event details”.',
      },
      names: {
        label: 'The names',
        text: 'What appears at the top of the invitation: two names for a wedding or an engagement; for a bar or bat mitzvah, the celebrant and (optionally) the parents.',
      },
      date: {
        label: 'Date and time',
        text: 'When the event starts. The countdown, the Hebrew date and the calendar reminder are built from them.',
      },
      timezone: {
        label: 'Time zone',
        text: 'For an event abroad: guests see the time of the place where it happens.',
      },
      languages: {
        label: 'Language',
        text: 'Hebrew, English or both. With both, guests switch between them with one tap, and you fill in the names in each.',
      },
      steps: {
        label: 'Continue / Back',
        text: 'Three short steps. Going back keeps everything you filled in.',
      },
      create: {
        label: 'Create the invitation',
        text: 'Creates a draft with the design’s texts and opens the editor. Nothing is sent to guests until you publish.',
      },
    },
  },
  editor: {
    title: 'The editor: what each button does',
    items: {
      back: { label: 'Back', text: 'To your invitations. No need to save: everything is already saved.' },
      save: {
        label: 'Autosave',
        text: 'Every change saves by itself. The line under the name shows whether it’s saved.',
      },
      undo: { label: 'Undo / Redo', text: 'Undoes the last change (Ctrl+Z) or brings it back.' },
      device: {
        label: 'Phone / Desktop',
        text: 'Switches the preview between a phone screen and a desktop screen.',
      },
      language: {
        label: 'Preview language',
        text: 'In a two-language invitation: which language the preview shows. Fill in every field in both.',
      },
      replay: {
        label: 'Replay opening',
        text: 'Under the preview: plays the envelope opening and the animations again.',
      },
      openTab: {
        label: 'Open in a new tab',
        text: 'Under the preview: the saved draft full screen, to check it as a guest would.',
      },
      versions: {
        label: 'Versions',
        text: 'Every publish is kept, and the draft is saved as you work. See what changed and restore any of them.',
      },
      comments: {
        label: 'Comments',
        text: 'A link to the draft your family can comment on without an account, and their comments: here, on the preview and next to the sections.',
      },
      preview: { label: 'Preview', text: 'The invitation full screen, as guests will see it.' },
      publish: {
        label: 'Publish',
        text: 'Checks nothing is missing, you choose an address, and it goes live. After changes press it again; the link stays the same.',
      },
      premium: {
        label: 'The “Premium” tag',
        text: 'Shows when the design belongs to the Pro and Business plans: edit as usual, and publish after upgrading.',
      },
      mobileTabs: {
        label: 'The bottom bar (on phones)',
        text: 'Edit: the sections and their forms. Preview: the live invitation. Design: colors, fonts, envelope and music. Publish: the publish window.',
      },
      assistant: {
        label: 'The assistant',
        text: 'A question about the editor? The assistant answers right away, any time.',
      },
    },
  },
  rail: {
    title: 'Sections and design: what each thing does',
    items: {
      select: {
        label: 'Choosing a section',
        text: 'Clicking a section opens its form and shows it in the preview.',
      },
      drag: { label: 'Dragging', text: 'Drag a section up or down to change the order in the invitation.' },
      toggle: {
        label: 'The hide switch',
        text: 'Hides or shows a section. A hidden section isn’t shown to guests, and its settings aren’t checked when publishing.',
      },
      add: {
        label: 'Add a section',
        text: 'Gallery, gifts, transport, accommodation, FAQ, free text and more.',
      },
      issues: {
        label: 'A yellow / red dot',
        text: 'Yellow: something in the section to check, like an empty field or a missing translation. Red (after trying to publish): something that must be fixed before publishing.',
      },
      comments: {
        label: 'A red number',
        text: 'How many open comments your family left on the section on the review link. “Comments” at the top opens them.',
      },
      menu: {
        label: 'A section’s ⋯ menu',
        text: 'Above the form: move up or down, duplicate and delete (right after deleting you can undo).',
      },
      design: {
        label: 'The Design tab',
        text: 'Colors, fonts (including the “More fonts” library), the envelope and opening, and music. Each has its own “?”.',
      },
      settings: {
        label: 'The Settings tab',
        text: 'Event details (names, date and time), languages, and sharing: the address and how the invitation looks when sent.',
      },
    },
  },
  designPalette: {
    title: 'Colors: what each thing does',
    items: {
      presets: {
        label: 'Color sets',
        text: 'Colors that go together, made for this design. One tap replaces them all at once.',
      },
      swatch: {
        label: 'The color square',
        text: 'Opens a color picker for one color: the background, the text, the accent and more.',
      },
      hex: { label: 'Color code', text: 'Have an exact color (e.g. #A0703F)? Type it here.' },
      contrast: {
        label: 'AA ✓ / Low ⚠',
        text: 'Whether the text is readable on its background. “Low” means a darker or lighter color would be better.',
      },
      reset: { label: 'Back to the design’s colors', text: 'Undoes every color change.' },
      fromPhoto: {
        label: 'Colors from a photo',
        text: 'Pick a photo (from this device or the invitation) and get three color suggestions that suit it — light, evening and tinted. A tap applies one; ↶ undoes it. The photo isn’t uploaded anywhere.',
      },
    },
  },
  designFonts: {
    title: 'Fonts: what each thing does',
    items: {
      suggested: {
        label: 'Suggested for your invitation',
        text: 'Three font pairs that suit the kind of event and the colors, written with your names in every language of the invitation. A tap picks one.',
      },
      pairs: {
        label: 'A font pair',
        text: 'A font for the names and headings and one for the text, in Hebrew and English. The sample is written with your names.',
      },
      more: { label: 'More fonts', text: 'A library of extra font pairs that suit any design.' },
      live: {
        label: 'In the preview',
        text: 'Your choice shows in the preview right away. ↶ brings back the previous one.',
      },
    },
  },
  designStyle: {
    title: 'Style & motion: what each thing does',
    items: {
      typeScale: {
        label: 'Text size',
        text: 'Makes every text of the invitation larger or smaller together — names, titles and text — keeping the design’s proportions.',
      },
      spacing: {
        label: 'Spacing',
        text: 'How much air there is between and inside the sections: compact — a shorter invitation; airy — a calmer one.',
      },
      motion: {
        label: 'Motion intensity',
        text: 'How much things move as guests scroll: the entrances, the parallax and the zoom. “Still” — nothing moves.',
      },
      reset: { label: 'Back to the design', text: 'Sets all three back to what the design set.' },
    },
  },
  sectionMedia: {
    title: 'A section’s picture or video: what each thing does',
    items: {
      upload: {
        label: 'Upload a photo or video',
        text: 'Your own photo (JPG, PNG, WebP) or MP4 video. A video gets its still automatically.',
      },
      library: {
        label: 'From this invitation',
        text: 'Pick a picture that’s already in the invitation — no need to upload it again.',
      },
      focal: {
        label: 'Tapping the picture',
        text: 'Sets what matters in it: that part stays in frame on every screen size.',
      },
      overlay: {
        label: 'Darken the picture',
        text: 'A dark layer under the text when it sits on the picture. A bright photo you add gets enough of it by itself to read; “Automatic” — as the design sets it.',
      },
      alt: {
        label: 'Picture description',
        text: 'For guests using a screen reader, when the picture is framed or beside the text. A background needs none.',
      },
      remove: {
        label: 'Remove',
        text: 'Takes the picture off the section. The layout goes back to classic.',
      },
    },
  },
  sectionLayout: {
    title: 'Layout: what each thing does',
    items: {
      stack: {
        label: 'Classic',
        text: 'The picture framed above the text, like the rest of the invitation.',
      },
      full: {
        label: 'Full bleed',
        text: 'The picture behind the text, edge to edge, darkened so the text always reads.',
      },
      split: {
        label: 'Picture beside',
        text: 'On a computer the picture sits beside the text (in Hebrew “beside” is the right); on a phone above or below it.',
      },
      parallax: { label: 'Parallax', text: 'Full bleed, moving slower than the scroll — a sense of depth.' },
      video: {
        label: 'Video background',
        text: 'A silent looping video behind the text. Needs an uploaded video.',
      },
      disabled: {
        label: 'A greyed-out layout',
        text: 'It needs a picture or a video — add one in the “Picture or video” card.',
      },
    },
  },
  sectionMotion: {
    title: 'Motion: what each thing does',
    items: {
      entrance: {
        label: 'Entrance',
        text: 'How the section comes in as guests scroll to it: fade, rise, zoom and more. “The design’s” — its usual motion; “None” — no motion.',
      },
      play: { label: 'Play', text: 'Plays the motion in the preview, as guests will see it.' },
      scroll: {
        label: 'While scrolling',
        text: 'What the section’s picture does as guests scroll: parallax (it moves slower) or a slow zoom.',
      },
      text: {
        label: 'Text reveal',
        text: 'Titles and text appear letter by letter, word by word or line by line.',
      },
      intensity: {
        label: 'Intensity',
        text: 'How far and how strongly things move — from subtle to lively.',
      },
      fineTune: {
        label: 'Fine-tune',
        text: 'Duration, delay, distance and feel, for those who want it exact.',
      },
      reset: { label: 'Back to the design’s motion', text: 'Undoes every motion change in the section.' },
    },
  },
  sectionColors: {
    title: 'Section colors: what each thing does',
    items: {
      bands: {
        label: 'Ready bands',
        text: 'Dark, soft or in the accent color — a section in colors of its own, from the invitation’s colors and always readable.',
      },
      custom: {
        label: 'Custom',
        text: 'Background, text and accent — from the invitation’s colors or any other.',
      },
      contrast: {
        label: 'Contrast warning',
        text: 'When the text may be hard to read on its background. “Fix automatically” darkens or lightens it just enough.',
      },
      fromPhoto: {
        label: 'Colors from the picture',
        text: 'Three color suggestions from the section’s picture; the darkening follows how bright the picture is.',
      },
      size: {
        label: 'Size and spacing',
        text: 'A larger or smaller title, the spacing and the picture’s corners — in this section only.',
      },
      reset: {
        label: 'Back to the invitation’s colors',
        text: 'The section goes back to the invitation’s colors.',
      },
    },
  },
  designTemplate: {
    title: 'Another design: what each thing does',
    items: {
      choose: {
        label: 'Choosing a design',
        text: 'Every design for this kind of event, with your names and date. The current one is marked.',
      },
      keeps: {
        label: 'What stays',
        text: 'Names, date, place, texts and RSVP stay. The colors, fonts, the design’s pictures and the music change.',
      },
      undo: {
        label: 'Undo',
        text: 'Undo brings the previous design back, and the invitation as it was is also kept in the version history.',
      },
    },
  },
  designCover: {
    title: 'Envelope and opening: what each thing does',
    items: {
      enabled: {
        label: 'Opening envelope',
        text: 'The first screen: guests tap and the envelope opens. Off — the invitation opens straight away.',
      },
      monogram: {
        label: 'Monogram',
        text: 'Short letters on the seal or the card, e.g. N&I. The number of characters depends on the design.',
      },
      seal: { label: 'Seal color', text: 'The color of the wax seal, from the colors that suit the design.' },
      hint: { label: 'Hint text', text: 'The line that invites a tap, e.g. “Tap to open”.' },
      replay: { label: 'Replay opening', text: 'Plays the envelope opening again in the preview.' },
      opening: {
        label: 'Opening',
        text: 'How the invitation opens: the design’s envelope, a gate, a theatre curtain, fireworks or gold dust. Picking one plays it in the preview right away.',
      },
    },
  },
  designMusic: {
    title: 'Music: what each thing does',
    items: {
      enabled: {
        label: 'Background music',
        text: 'Starts when a guest opens the invitation. Guests always have a mute button.',
      },
      tracks: {
        label: 'The tracks',
        text: 'The design’s own music. ▶ plays 10 seconds here, without changing anything.',
      },
      custom: {
        label: 'Your own song',
        text: 'An MP3 up to 10MB. Tick that you have the rights to it, then you can upload.',
      },
      videoSound: {
        label: 'The background video’s sound',
        text: 'When the main screen’s background is a video: play its own sound instead of a song.',
      },
      volume: { label: 'Volume', text: 'How loud the music plays for your guests.' },
      startAt: {
        label: 'Start at second',
        text: 'Skip a long intro: the song starts from the second you choose.',
      },
    },
  },
  settingsEvent: {
    title: 'Event details: what each field does',
    items: {
      type: {
        label: 'Event type',
        text: 'Decides which names show (e.g. two names for a wedding). The options are the ones the design suits.',
      },
      names: {
        label: 'Names',
        text: 'They update everywhere in the invitation: the main screen, the ending and the link you send.',
      },
      joiner: { label: 'Between the names', text: 'What goes between the two names, e.g. & or “and”.' },
      parents: {
        label: 'Parents’ names',
        text: 'Optional. They show at the end of the invitation when turned on in the “Ending” section.',
      },
      date: {
        label: 'Date and times',
        text: 'An end time earlier than the start time is on the next day (an event that ends after midnight).',
      },
      timezone: {
        label: 'Time zone',
        text: 'For an event abroad. It affects the countdown and the calendar reminder.',
      },
      hebrewDate: {
        label: 'Hebrew date',
        text: 'By the day, “the eve of…” for an event that starts in the evening, or no Hebrew date.',
      },
      timeFormat: {
        label: 'Time format',
        text: '24-hour (19:30) or 12-hour (7:30 PM). “By language” picks for you.',
      },
      deadline: {
        label: 'RSVP deadline',
        text: 'After this date the form closes, and guests see a message that the deadline has passed.',
      },
    },
  },
  settingsLanguages: {
    title: 'Languages: what each button does',
    items: {
      add: {
        label: 'Add a language',
        text: 'Adds another language to the invitation (up to seven). The design’s texts are already written in it; you complete the names and the other details — yourself, or with “Translate into…” when the plan includes automatic translation.',
      },
      remove: {
        label: 'Remove a language',
        text: 'Deletes every text in that language from the draft. You can undo with ↶.',
      },
      default: {
        label: 'The language that opens first',
        text: 'The language the invitation opens in when the guest’s phone speaks none of its languages (a personal link opens in the guest’s language). Guests switch languages from the language menu.',
      },
      tabs: {
        label: 'The language tabs next to each field',
        text: 'Switch languages in any field. An orange dot on a language: its translation is missing.',
      },
    },
  },
  settingsShare: {
    title: 'Link and sharing: what each thing does',
    items: {
      address: {
        label: 'Invitation address',
        text: 'The link you’ll send. Copy copies it; it starts working once you publish. You change it in the publish window.',
      },
      publishNow: { label: 'Publish now', text: 'Opens the publish window.' },
      card: {
        label: 'Share title and description',
        text: 'What shows in the link preview on WhatsApp. Empty = the names, the date and the venue.',
      },
      image: {
        label: 'Share image',
        text: 'The picture in the link preview. Empty = an image made from the invitation for you.',
      },
      noindex: {
        label: 'Hide from search engines',
        text: 'Best left on: only people who got the link will reach the invitation.',
      },
    },
  },
  publish: {
    title: 'Publishing: what each thing does',
    items: {
      slug: {
        label: 'Invitation address',
        text: 'The link you’ll send: English letters, numbers and hyphens. Once you’ve sent it, better not change it — the old link stops working.',
      },
      errors: {
        label: 'To fix (red)',
        text: 'Things that block publishing, like an empty required field or a missing translation. Click a row to go straight to the field.',
      },
      warnings: {
        label: 'Worth checking (yellow)',
        text: 'Warnings that don’t block, e.g. a date that has passed or an empty section. You can publish with them.',
      },
      card: {
        label: 'How the link looks on WhatsApp',
        text: 'The title, description and picture shown in the chat. Change them in Settings → “Link and sharing”.',
      },
      publish: {
        label: 'The “Publish” button',
        text: 'The invitation goes live at this address. Each publish is kept as a version, and later changes are published at the same link.',
      },
      after: {
        label: 'After publishing',
        text: 'Copy the link, open the invitation, send it on WhatsApp, and the share screen with a QR code and a ready message.',
      },
    },
  },
  versions: {
    title: 'Versions: what each button does',
    items: {
      version: { label: 'Version', text: 'Every publish is kept as a version, with its date and time.' },
      live: { label: 'Live', text: 'The version guests see right now.' },
      view: { label: 'View', text: 'Opens that version in a new tab, without changing anything.' },
      restore: {
        label: 'Restore to draft',
        text: 'Replaces the draft with this version. Guests won’t see it until you publish again.',
      },
      undo: { label: 'Changed your mind?', text: 'After restoring you can undo with ↶ in the top bar.' },
    },
  },
  responses: {
    title: 'RSVPs: what each button does',
    items: {
      kpis: {
        label: 'The numbers at the top',
        text: 'How many are coming (adults and children), how many replied, how many can’t come, and the time to the deadline.',
      },
      notify: {
        label: 'Email alerts',
        text: 'For every reply, one daily summary, or no emails. Sent to your account’s email.',
      },
      export: {
        label: 'Export to Excel',
        text: 'Downloads all replies to a file, with dietary preferences and answers. Works from the first reply.',
      },
      search: {
        label: 'Search and filter',
        text: 'Find a guest by name, or filter: coming, not coming, with a message.',
      },
      chips: {
        label: 'Active filters',
        text: 'Each filter from the “Filter” menu shows as a tag under the search. ✕ removes it, and “Clear filters” removes them all.',
      },
      row: {
        label: 'Clicking a reply',
        text: 'Opens all its details (on a phone: tap the card). You can also delete it there.',
      },
      charts: {
        label: 'The charts',
        text: 'A summary of dietary preferences and of the answers to your questions.',
      },
    },
  },
  share: {
    title: 'Sharing: what each button does',
    items: {
      open: { label: 'Open the invitation', text: 'Opens the published invitation in a new tab.' },
      copyLink: { label: 'Copy the link', text: 'Copies the invitation’s general link.' },
      message: {
        label: 'The message',
        text: 'A ready message with the link. You can edit it here; a two-language invitation has one per language.',
      },
      whatsapp: {
        label: 'Send on WhatsApp',
        text: 'Opens your WhatsApp with the message, and you choose whom to send it to.',
      },
      copyMessage: {
        label: 'Copy the message',
        text: 'Copies the whole message with the link, to paste in a text, an email or any app.',
      },
      guests: {
        label: 'A personal link for each guest',
        text: 'On the guests screen: a link with each guest’s name, and sending from the system’s official number.',
      },
      qr: {
        label: 'QR code',
        text: 'For a printed invitation or a sign. PNG as an image, SVG to print at any size.',
      },
      preview: {
        label: 'How it looks on WhatsApp',
        text: 'The link’s preview in a chat. WhatsApp keeps it, so a new picture shows in a new share.',
      },
    },
  },
  account: {
    title: 'Your account: what each button does',
    items: {
      save: { label: 'Save', text: 'Saves your name and phone on the account.' },
      password: {
        label: 'Change password',
        text: 'Choose a new password (for an email-and-password account).',
      },
      plan: { label: 'Plan & billing', text: 'Your plan, WhatsApp credits, upgrading and canceling.' },
      delete: {
        label: 'Delete the account',
        text: 'Permanently deletes all invitations, guests, replies and files, and stops the subscription.',
      },
    },
  },
};
