import type { HHmm, ISODate } from './time';

/** What a host can schedule: the gallery link to the guests, the album's thank-you. */
export const SEND_KINDS = ['gallery_link', 'album_thanks'] as const;
export type SendKind = (typeof SEND_KINDS)[number];

/** To whom: the guests who haven't got it yet (or whose message failed), or everyone it reaches. */
export type Audience = 'unsent' | 'all';

export type SendStatus = 'scheduled' | 'running' | 'done' | 'failed' | 'canceled';

/** A scheduled send as the database keeps it (scheduled_send_json). */
export interface ScheduledSend {
  id: string;
  invitationId: string;
  ownerId: string;
  kind: SendKind;
  /** the date and the time on the clock the host picked, in their time zone */
  date: ISODate;
  time: HHmm;
  timeZone: string;
  /** the moment that means (worked out by the database) */
  runAt: string;
  audience: Audience;
  status: SendStatus;
  attempts: number;
  /** what happened: how many were queued, sent, failed, skipped (and why) */
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** The host's view: the invitation's time zone, and its sends (newest first). */
export interface ScheduleView {
  timeZone: string;
  sends: ScheduledSend[];
}
