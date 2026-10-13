import type { collectionNotesHe } from './collection-notes.he';

export const collectionNotesEn: typeof collectionNotesHe = {
  more: 'More details',
  newTab: '(opens in a new tab)',
  policy: 'Privacy policy',
  rows: {
    voluntary: 'Whether you have to give them',
    controller: 'Who is responsible for them',
    purpose: 'Why they are needed',
    recipients: 'Who sees them',
    rights: 'Rights',
  },

  guests: {
    title: 'About your guests’ details',
    short:
      'You are entering other people’s details: you decide whom to invite and you are responsible for being allowed to contact them. We process the details on your behalf, and do not use them for marketing.',
    add: {
      voluntary:
        'A name is required to add a guest. Phone, email, party size, group and language are optional. Without a phone number a guest cannot be sent a message on WhatsApp.',
    },
    import: {
      voluntary:
        'The file is read for name, phone, email, party size, group and language. A name is required in each row, and a row without one is not imported. The rest is optional, and without a phone number a guest cannot be sent a message on WhatsApp.',
    },
    controller:
      'You decide which details to enter and whom to invite, and you are responsible for being allowed to keep them and to send these people an invitation. We store and process them on your behalf and on your instructions.',
    purpose:
      'To send the invitation, to manage the replies and to show you the list. They are not used for marketing.',
    recipients:
      'You, and the providers that run the service for us (for example, storage). Sending on WhatsApp happens only after you confirm it, and then the guest’s name and phone number go to Meta’s WhatsApp.',
    rights:
      'A guest who wants to see their details, correct them or delete them can ask you, or ask us with a privacy request.',
    link: 'Who is responsible for what, in the privacy policy',
  },

  planning: {
    vendor:
      'These are business contacts that you enter. We keep them only to show them back to you, and only you can see them.',
    person: 'The name is kept in your event plan, and only you can see it.',
    link: 'Details in the privacy policy',
  },

  contact: {
    title: 'About the details you give',
    short:
      'A name and an email address are needed so that we can reply, and the phone is optional. We use the details only to handle your message, and they are kept with it.',
    voluntary:
      'You are not required by law to give any details; it is up to you. Without a name and an email address we cannot handle your message or reply to it. A phone number is optional.',
    purpose:
      'To reply to your message and handle it. It opens as a support ticket, and is kept with all the messages in it.',
    recipients: 'Our support team. The reply is sent to you by email through an email provider (Resend).',
    rights: 'You can ask to see the details and to have them corrected and, where the law allows, deleted.',
    rightsLink: 'Privacy request',
    link: 'More, including how long we keep them, in the privacy policy',
  },

  support: {
    assistant:
      'Questions are answered by an AI model from an outside provider (Anthropic or OpenAI). Do not type other people’s personal details here.',
    assistantLink: 'Details in the privacy policy',
    handoff: 'The conversation above goes to our support team and is kept in the ticket.',
    ticket: {
      title: 'About the details you give',
      short:
        'Your message is kept in the ticket and read by our support team, to reply to you. Do not write other people’s personal details in it.',
      voluntary:
        'You are not required by law to give any details; it is up to you, but without the subject and the message we cannot handle the ticket.',
      purpose: 'To reply to the ticket and handle it, and to keep a record of how it was handled.',
      recipients:
        'You, in the app, and our support team. The reply is also sent to you by email through an email provider (Resend).',
      rights: 'You can ask to see the details and to have them corrected and, where the law allows, deleted.',
      rightsLink: 'Privacy request',
    },
    link: 'More, including how long we keep them, in the privacy policy',
  },

  ai: {
    text: 'The text is sent to {provider} to be processed.',
    photos: 'Reduced copies of the photos you chose are sent to {provider} to be processed.',
    link: 'Details in the privacy policy',
  },
};
