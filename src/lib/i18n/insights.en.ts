import type { InsightsDict } from './insights.he';

/** How guests use the invitation — the invitation's "Insights" tab (feature analytics) — English. */
export const insightsEn: InsightsDict = {
  tab: 'Insights',
  metaTitle: 'Insights · {name}',
  title: 'Insights',
  subtitle:
    'How guests use the invitation: how many opened it, read to the end and replied — without cookies and without identifying anyone.',
  range: {
    label: 'Time range',
    '7': '7 days',
    '30': '30 days',
    '0': 'Since publishing',
  },
  kpi: {
    label: 'The main numbers',
    visits: 'Visits',
    visitsSub: 'Every time the page is opened',
    opened: 'Opened it',
    replied: 'Replied on it',
    median: 'Time on page',
    medianSub: 'The median visit',
    none: '—',
    ofVisits: '{p} of visits',
  },
  duration: {
    seconds: '{s} sec',
    minutes: '{m} min',
    minutesSeconds: '{m} min {s} sec',
  },
  funnel: {
    title: 'From opening to replying',
    caption: 'Each step out of all visits, and in brackets — out of the step before it.',
    steps: {
      opened: 'Opened the invitation',
      readEnd: 'Read to the end',
      rsvpStarted: 'Started the RSVP',
      rsvpSent: 'Replied',
    },
    ofPrevious: '({p} of the step before)',
    table: 'The steps as a table',
    stage: 'Step',
    count: 'Visits',
    share: 'Of visits',
  },
  daily: {
    title: 'By day',
    visits: 'Visits per day',
    replies: 'Replies per day (through the page)',
    caption: 'Days in the event’s time zone.',
    bar: '{date}: {n}',
    table: 'The numbers by day',
    day: 'Day',
    showTable: 'Show as a table',
    showChart: 'Show as a chart',
    personal: 'Personal links opened',
  },
  breakdown: {
    lang: 'By language',
    source: 'Where they came from',
    device: 'On what device',
    replies: { one: '1 reply', other: '{n} replies' },
    langs: {
      he: 'Hebrew',
      en: 'English',
      ar: 'Arabic',
      ru: 'Russian',
      fr: 'French',
      es: 'Spanish',
      am: 'Amharic',
    } as Record<string, string>,
    sources: {
      personal: 'Personal link',
      shared: 'Shared link',
      qr: 'QR code',
      other: 'Another website',
    } as Record<string, string>,
    devices: { phone: 'Phone', tablet: 'Tablet', desktop: 'Computer' } as Record<string, string>,
    empty: 'No data yet',
  },
  actions: {
    title: 'What guests did',
    calendar: 'Added to a calendar',
    map: 'Opened directions or a map',
    gallery: 'Went to the gallery',
    langSwitch: 'Switched language',
    depth: 'Scrolled at least {m}% of the page',
  },
  personal: {
    title: 'Personal links',
    body: 'Guests who opened their personal link (from the guest list).',
    opened: '{opened} of {guests} opened',
    opens: '{n} opens in total',
    none: 'No guests on the list yet.',
    cta: 'To the guest list',
  },
  gallery: {
    title: 'The live gallery',
    photos: 'Photos',
    videos: 'Videos',
    uploaders: 'Phones that uploaded',
    cta: 'To the gallery',
    none: 'The gallery isn’t on yet.',
  },
  replies: {
    title: 'All RSVPs',
    body: '{total} replies, {attending} coming — including replies that didn’t come through the page (for example ones you typed in).',
    cta: 'To the RSVPs',
  },
  empty: {
    draftTitle: 'The invitation isn’t published yet',
    draftBody:
      'Once it is published and guests open it, you’ll see here how many opened it, read it and replied.',
    draftCta: 'Publish the invitation',
    noneTitle: 'No visits in this range yet',
    noneBody:
      'When guests open the invitation — from their personal link, a link you shared or a QR code — the numbers show up here, usually within a minute.',
  },
  privacy:
    'Measured without cookies and without keeping anything on guests’ devices. Guests whose browser asks not to be tracked (Do Not Track or Global Privacy Control) aren’t counted. Each visit’s details are deleted after 7 days; only the daily numbers stay.',
  off: {
    title: 'Measuring is off for this invitation',
    body: 'Turn it on to see how guests use the invitation. Nothing is measured while it is off.',
    cta: 'Turn measuring on',
    switchOff: 'Turn measuring off',
    switchedOff: 'Measuring is off',
    switchedOn: 'Measuring is on',
  },
  unavailable: {
    title: 'Insights aren’t available right now',
    body: 'This capability isn’t active on the site at the moment.',
  },
  hints: {
    range: 'Chooses which days the numbers and charts on this page cover.',
    table: 'Switches between the chart and a table of the same numbers.',
    personal: 'Opens the guest list, with each guest’s personal-link status.',
    gallery: 'Opens the invitation’s live gallery tab.',
    replies: 'Opens all of the invitation’s RSVPs.',
    publish: 'Opens the editor with its publish window.',
    switchOff: 'Stops measuring this invitation from now on. The numbers already collected stay.',
    switchOn: 'Starts measuring how guests use the invitation again.',
  },
  help: {
    title: 'Insights — what you see here',
    items: {
      range: {
        label: 'Time range',
        text: '7 days, 30 days or since publishing. Every number on the page covers those days, in the event’s time zone.',
      },
      visits: {
        label: 'Visits',
        text: 'Every opening of the invitation page counts once (a reload is a new visit). Bots and link previews aren’t counted.',
      },
      funnel: {
        label: 'From opening to replying',
        text: 'How many visits opened the envelope, scrolled to the end of the invitation, started the RSVP form and sent it. A low share at one step shows where guests stop.',
      },
      median: {
        label: 'Median time',
        text: 'Half the visits were shorter and half longer — only the time the page was on screen, up to 30 minutes a visit.',
      },
      sources: {
        label: 'Where they came from',
        text: 'A personal link (from the guest list), a shared link (WhatsApp, email or social media), a QR code (from the Share tab) or another website.',
      },
      personal: {
        label: 'Personal links',
        text: 'From the guest list: how many opened their personal link. This is kept with the list, even without measuring.',
      },
      privacy: {
        label: 'Privacy',
        text: 'No cookies and no identifiers on the device. No IP addresses or browser details are kept. Guests who ask not to be tracked aren’t counted. Details in the privacy policy.',
      },
    },
  },
};
