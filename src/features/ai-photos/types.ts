import type { PlanId } from '@/features/billing/plans';
import type { Package } from '@/features/flags/features';
import type { EventType, L10n, Locale } from '@/features/invitations/contracts/types';
import type { Role } from './model';

/** What the AI photos' pages and API exchange (isomorphic). */

export type PhotoState = 'queued' | 'running' | 'done' | 'failed' | 'blocked';

export interface GuestAiPerson {
  id: string;
  role: Role;
  name: L10n;
}

/** One of the guest's own photos: where it stands, and the result's links when done. */
export interface GuestAiPhoto {
  id: string;
  status: PhotoState;
  prompt: string;
  thumb: string | null;
  result: string | null;
  width: number | null;
  height: number | null;
  /** it is in the event's gallery now */
  shared: boolean;
  createdAt: string;
}

/** What the gallery's guest page needs to offer the AI photos (null on the page when it can't). */
export interface GuestAiState {
  people: GuestAiPerson[];
  perGuest: number;
  /** photos this device may still make */
  left: number;
  /** the event as a whole has no photos left */
  eventFull: boolean;
  /** guests may add their photos to the gallery */
  toGallery: boolean;
  mine: GuestAiPhoto[];
}

export interface AiFeatureState {
  on: boolean;
  why: 'unavailable' | 'switched_off' | 'plan' | null;
  package: Package;
  plan: PlanId;
}

export interface HostAiPerson {
  id: string;
  role: Role;
  name: L10n;
  description: string | null;
  /** the photo (a short-lived link), null before one was added */
  photo: string | null;
}

export interface HostAiView {
  id: string;
  slug: string;
  feature: AiFeatureState;
  settings: {
    enabled: boolean;
    perGuest: number;
    perEvent: number;
    toGallery: boolean;
    consentAt: string | null;
  };
  people: HostAiPerson[];
  counts: { done: number; used: number; blocked: number };
  /** the event's gallery is on (where guests make the photos) */
  gallery: boolean;
  event: {
    eventType: EventType;
    locales: Locale[];
    defaultLocale: Locale;
  };
  /** the roles the host may give for this kind of event, its own first */
  roles: Role[];
  /** who the event celebrates, as the invitation names them (to start from) */
  suggested: { role: Role; name: L10n }[];
}

export interface HostAiPhoto {
  id: string;
  status: PhotoState;
  error: string | null;
  prompt: string;
  guestName: string | null;
  people: string[];
  thumb: string | null;
  result: string | null;
  source: string | null;
  shared: boolean;
  createdAt: string;
}
