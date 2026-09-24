import type { helpHe } from './help.he';

/** "What does each button here do?" — the "?" card of each area in the app (AreaHelp), English. */
export const helpEn: typeof helpHe = {
  list: {
    title: 'My invitations: what each button does',
    items: {
      newInvitation: {
        label: 'New invitation',
        text: 'Pick a design from the gallery, fill in names and a date, and get a ready draft with texts.',
      },
      card: { label: 'Clicking an invitation', text: 'Opens its editor. Every change saves by itself.' },
      menu: {
        label: 'The ⋯ menu on each invitation',
        text: 'Edit, guests, share (once published), responses, duplicate and archive.',
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
      followUp: {
        label: 'Create the full invitation',
        text: 'On a save-the-date: creates the full invitation with the same details and links the two once it’s published.',
      },
      status: {
        label: 'Draft / Published',
        text: 'A draft isn’t visible to guests yet. “Published”: the link works. “Unpublished changes”: press Publish again in the editor.',
      },
    },
  },
  gallery: {
    title: 'Choosing a design: what each button does',
    items: {
      filter: { label: 'Event type', text: 'Shows only the designs that suit the event you chose.' },
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
      versions: {
        label: 'Versions',
        text: 'Every publish is kept as a version. You can restore an earlier one.',
      },
      preview: { label: 'Preview', text: 'The invitation full screen, as guests will see it.' },
      publish: {
        label: 'Publish',
        text: 'Checks nothing is missing, you choose an address, and it goes live. After changes press it again; the link stays the same.',
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
        label: 'A red / yellow dot',
        text: 'Red: something required is missing before publishing. Yellow: a warning or a missing translation.',
      },
      menu: {
        label: 'A section’s ⋯ menu',
        text: 'Move up or down, duplicate and delete (right after deleting you can undo).',
      },
      design: {
        label: 'The Design tab',
        text: 'Colors, fonts (including the “More fonts” library), the envelope and opening, and music.',
      },
      settings: {
        label: 'The Settings tab',
        text: 'Event details (names, date and time), languages, and sharing: the address and how the invitation looks when sent.',
      },
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
        text: 'Downloads all replies to a file, with dietary preferences and answers.',
      },
      search: {
        label: 'Search and filter',
        text: 'Find a guest by name, or filter: coming, not coming, with a message.',
      },
      row: {
        label: 'Clicking a row',
        text: 'Opens all the details of the reply. You can also delete it there.',
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
