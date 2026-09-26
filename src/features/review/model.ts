/**
 * The draft review's shapes (isomorphic): a comment pinned to a spot of a section of the draft, its
 * replies (the host's and the family's), and what the host's screen and the review page get.
 */
import type { InvitationDocument, TemplateManifest } from '../invitations/contracts/types';
import type { RealtimeInfo } from '@/lib/live/types';

export interface ReviewReply {
  id: string;
  by: 'host' | 'reviewer';
  /** the family member's name (null: the host) */
  name: string | null;
  body: string;
  at: string;
}

export interface ReviewComment {
  id: string;
  /** the pin's number (1, 2, 3… per invitation; never reused) */
  number: number;
  sectionId: string;
  /** where on the section: fractions of its box */
  x: number;
  y: number;
  name: string;
  body: string;
  status: 'open' | 'handled';
  replies: ReviewReply[];
  /** the draft's updatedAt when it was written */
  draftUpdatedAt: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotifyMode = 'each' | 'daily' | 'off';
export type LinkState = 'ok' | 'expired' | 'revoked';

/** The link as the host's screen shows it. */
export interface ReviewLinkView {
  /** the address to send (null when the server's key changed since: the host makes a new link) */
  url: string | null;
  state: LinkState;
  expiresAt: string | null;
  notify: NotifyMode;
  createdAt: string;
}

/** GET /api/invitations/:id/review */
export interface HostReview {
  link: ReviewLinkView | null;
  comments: ReviewComment[];
  /** the draft's updatedAt now (a comment written before it was about an earlier draft) */
  updatedAt: string;
  realtime: RealtimeInfo | null;
}

/** What the review page shows (POST /api/review/open). */
export interface ReviewState {
  draft: InvitationDocument;
  templateId: string;
  /** the draft's design (the page renders it without shipping every design to the family's phones) */
  template: TemplateManifest;
  updatedAt: string;
  expiresAt: string | null;
  comments: ReviewComment[];
  realtime: RealtimeInfo | null;
  /** the event has `cinematic`: the draft shows as its guests would see it */
  cinematic: boolean;
}

/** A pin as the renderer's layer draws it. */
export interface Pin {
  id: string;
  number: number;
  sectionId: string;
  x: number;
  y: number;
  status: 'open' | 'handled';
  /** the one the host or the family member is looking at */
  active?: boolean;
}

/** A pin with its name for screen readers (what the editor posts to its preview frame). */
export interface LabeledPin extends Pin {
  label: string;
}

export const pinsOf = (comments: readonly ReviewComment[], active: string | null = null): Pin[] =>
  comments.map((c) => ({
    id: c.id,
    number: c.number,
    sectionId: c.sectionId,
    x: c.x,
    y: c.y,
    status: c.status,
    active: c.id === active,
  }));
