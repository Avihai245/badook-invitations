import type { supportHe } from './support.he';

/** The support assistant (the chat in the signed-in app) — English. */
export const supportEn: typeof supportHe = {
  open: 'Help: ask the assistant',
  launcher: 'Need help?',
  title: '{brand} assistant',
  subtitle: 'Answers about the app, any time',
  greeting:
    'Hi! I’m the {brand} assistant. Ask me anything about the app: creating and designing an invitation, the guest list, sending on WhatsApp, RSVPs and plans. How can I help?',
  suggestionsTitle: 'Start here',
  suggestions: {
    general: [
      'How do I create my first invitation?',
      'How do I upload a guest list from Excel?',
      'How much does sending on WhatsApp cost?',
      'What’s the difference between the plans?',
    ],
    editor: [
      'How do I use a YouTube video as the background?',
      'How do I change the fonts and colors?',
      'How do I publish the invitation?',
      'How do I hide a section I don’t need?',
    ],
    guests: [
      'How do I upload a guest list from Excel?',
      'How does the guest’s name appear on the invitation?',
      'How do I send to everyone on WhatsApp?',
      'What does each status mean?',
    ],
    responses: [
      'How do I download the RSVPs to Excel?',
      'How do I get an email for every RSVP?',
      'Can I delete a reply?',
      'How do I see who hasn’t answered yet?',
    ],
    billing: [
      'What’s the difference between the plans?',
      'How do I buy WhatsApp messages?',
      'How do I cancel my subscription?',
      'What happens after I cancel?',
    ],
  },
  placeholder: 'Type a question…',
  send: 'Send',
  stop: 'Stop',
  newChat: 'New conversation',
  close: 'Close the chat',
  you: 'You',
  assistant: 'Assistant',
  thinking: 'The assistant is typing…',
  stopped: 'The answer was stopped.',
  disclaimer:
    'Answers are written automatically and may contain mistakes. Never share passwords, card details or codes here.',
  human: 'Contact the team',
  errors: {
    rate: 'You’ve asked a lot of questions in the last hour. Try again later, or write to us through the contact form.',
    tooLong: 'This conversation got too long. Start a new one and we’ll continue from there.',
    offline: 'You’re offline. Check your connection and try again.',
    generic: 'I couldn’t answer right now. Please try again in a moment.',
  },
  askTitle: 'Still not sure?',
  ask: 'Ask the assistant',
};
