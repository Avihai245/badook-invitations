import type { Locale } from '@/features/invitations/contracts/types';
import {
  ALBUM_TEMPLATE_TEXT,
  EVENT_TEMPLATE_TEXT,
  fillTemplate,
  REMINDER_TEMPLATE_TEXT,
  TEMPLATE_TEXT,
  THANKS_TEMPLATE_TEXT,
  type TemplateText,
} from './template-text';

/**
 * The messages the system's WhatsApp number can send to an event's guests — each one a fixed,
 * Meta-approved template (docs/whatsapp-setup.md), so a host picks a message and its recipients, never
 * free text: WhatsApp only lets a business start a conversation with an approved template. The send
 * screen, the scheduled stages and their previews all read this table. Isomorphic.
 */

export const MESSAGE_KINDS = ['invitation', 'reminder', 'event_reminder', 'thanks', 'album'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export const isMessageKind = (v: unknown): v is MessageKind => MESSAGE_KINDS.includes(v as MessageKind);

/** What a message is for: how the template picker groups them. */
export type MessageCategory = 'invitations' | 'followups' | 'reminders' | 'thanks' | 'album';
export const MESSAGE_CATEGORY: Record<MessageKind, MessageCategory> = {
  invitation: 'invitations',
  reminder: 'followups',
  event_reminder: 'reminders',
  thanks: 'thanks',
  album: 'album',
};

/** Each template in each language, as WhatsApp shows it (template-text.ts). */
export const MESSAGE_TEXT: Record<MessageKind, Record<Locale, TemplateText>> = {
  invitation: TEMPLATE_TEXT,
  reminder: REMINDER_TEMPLATE_TEXT,
  event_reminder: EVENT_TEMPLATE_TEXT,
  thanks: THANKS_TEMPLATE_TEXT,
  album: ALBUM_TEMPLATE_TEXT,
};

/** Where a message's button leads: the guest's personal invitation, the album, or nowhere (no button). */
export const MESSAGE_LINK: Record<MessageKind, 'invitation' | 'album' | null> = {
  invitation: 'invitation',
  reminder: 'invitation',
  event_reminder: 'invitation',
  thanks: null,
  album: 'album',
};

/**
 * An event's values for its messages in one language: the hosts, the event with its preposition
 * ("לחתונה"), the date, when and where ("יום שלישי, 17 בנובמבר · 19:30 · גן האירועים"), and where the
 * guests celebrated ("בחתונה שלנו").
 */
export interface EventValues {
  hosts: string;
  event: string;
  date: string;
  when: string;
  phrase: string;
}

/** A template's positional values ({{1}}, {{2}}…) for one guest. */
export function messageParams(kind: MessageKind, guest: string, v: EventValues): string[] {
  switch (kind) {
    case 'invitation':
    case 'reminder':
      return [guest, v.hosts, v.event, v.date];
    case 'event_reminder':
      return [guest, v.hosts, v.event, v.when];
    case 'thanks':
    case 'album':
      return [guest, v.phrase, v.hosts];
  }
}

/** A message as the guest will see it: its text filled in, its footer and its button. */
export interface RenderedMessage {
  body: string;
  footer: string;
  button: string | null;
  link: 'invitation' | 'album' | null;
}

export function renderMessage(
  kind: MessageKind,
  locale: Locale,
  guest: string,
  v: EventValues,
): RenderedMessage {
  const t = MESSAGE_TEXT[kind][locale];
  return {
    body: fillTemplate(t.body, messageParams(kind, guest, v)),
    footer: t.footer,
    button: t.button,
    link: MESSAGE_LINK[kind],
  };
}
