import type { GalleryNotifyDict } from './gallery-notify.he';

/** "Send guests the gallery link" (the live gallery's tab, feature live_gallery) — English. */
export const galleryNotifyEn: GalleryNotifyDict = {
  button: 'Send guests the link',
  buttonHint:
    'Sends each guest a personal gallery link, so what they upload shows with their name — from the official WhatsApp number or from your own WhatsApp.',
  title: 'Send the gallery link',
  intro:
    'Each guest gets their own gallery link: what they upload shows up for you with their name. Send it from the official number (a credit a message), from your own WhatsApp, or copy a ready message with the link — each guest in their own language.',
  tabs: { all: 'Everyone', unsent: 'Not sent yet', sent: 'Got it' },
  counts: {
    one: '1 guest on the list · {sent} got the link',
    other: '{guests} guests on the list · {sent} got the link',
  },
  row: {
    unsent: 'Not sent yet',
    queued: 'On its way',
    sent: 'Sent on WhatsApp',
    delivered: 'Delivered',
    read: 'Read',
    manual: 'You marked it sent',
    failed: 'Sending failed',
    noPhone: 'No phone on the list',
    landline: 'Landline — no WhatsApp',
    optedOut: 'Asked not to get WhatsApp messages',
  },
  sendAll: { one: 'Send on WhatsApp to 1 guest', other: 'Send on WhatsApp to {n} guests' },
  sendNone: 'Nobody to send to from the official number',
  sendAllHint:
    'Sends a message with the personal gallery link from {brand}’s official number. One credit a message; a message that isn’t delivered gives its credit back.',
  sendOwn: 'Send from my WhatsApp',
  sendOwnHint: 'Opens your WhatsApp with a ready message to this guest, and marks it sent.',
  markSent: 'Mark as sent',
  markSentHint: 'Marks that the guest got the link (for example you sent it yourself).',
  markAll: 'Mark everyone shown as sent',
  markAllHint: 'Marks everyone shown as having the link, without sending a message.',
  copyLink: 'Copy the message with the link',
  copyLinkHint:
    'Copies a ready message in the guest’s language, with their personal gallery link (it opens in their language), to send any way you like.',
  copied: 'Message and link copied',
  notReady:
    'Sending from the official number will be available once the gallery’s message template is approved. Until then: from your own WhatsApp, or copy the message with the link.',
  noGallery: 'Turn the gallery on first — then you can send guests the link.',
  cost: '{n} messages · you have {credits} credits',
  byLanguage: { one: '{language}: 1 message', other: '{language}: {n} messages' },
  fallback: 'There’s no approved gallery message in {language} yet: those guests get it in {fallback}.',
  preview: 'The message',
  previewIn: 'The message in {language}',
  previewHint:
    'Each guest gets the message in their own language once WhatsApp has approved it, otherwise in the invitation’s language. The button opens the gallery in their language.',
  unlimited: 'Admin account: no credits charged',
  sent: { one: 'The link was sent to 1 guest', other: 'The link was sent to {n} guests' },
  marked: { one: '1 guest marked', other: '{n} guests marked' },
  waiting: '{n} more on their way — they go out in the background.',
  skipped: 'Not sent: {reasons}.',
  reasons: {
    noPhone: '{n} without a phone',
    landline: '{n} landlines',
    optedOut: '{n} who asked not to get messages',
    queued: '{n} already on their way',
  },
  errors: {
    credits: 'Credits needed: {needed} · you have: {balance}.',
    nobody: 'Nobody to send to from the official number.',
    no_gallery: 'Turn the gallery on first.',
    failed: 'Something went wrong. Try again.',
  },
  empty: 'No guests on the list yet. You can send the general link from the link card.',
  close: 'Close',
};
