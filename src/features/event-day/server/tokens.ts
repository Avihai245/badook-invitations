import 'server-only';
import { createHash } from 'node:crypto';
import { linkKey, linkTokenAgain, newLinkToken, rateKey as linkRateKey } from '@/lib/links/tokens';

/**
 * The event day's secrets. The entrance stations' link is derived like the gallery's links
 * (src/lib/links/tokens.ts, its own key): only its hash is stored, a new one retires the old. A guest's
 * entrance code is derived one-way from their personal link's token — the database derives the same
 * (checkin_code() in supabase/migrations/*_event_day.sql).
 */

/** The station link's token: 24 URL-safe characters. */
export const STATION_TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

const key = () => linkKey('event-day');

export const newStationLink = (invitationId: string) => newLinkToken(key(), 'station', invitationId);

/** The station link's token again, for the host's screen — null when the server's key changed since. */
export const stationToken = (invitationId: string, nonce: string, hash: string): string | null =>
  linkTokenAgain(key(), 'station', invitationId, nonce, hash);

/** A guest's entrance code (their QR), from their personal link's token. */
export const checkinCode = (guestToken: string): string =>
  createHash('sha256').update(`badook-checkin:${guestToken}`).digest('base64url').slice(0, 22);

/** A rate-limit key (a salted hash of an address). */
export const rateKey = (scope: string, value: string): string => linkRateKey('event-day', scope, value);

export { randomId, sha256Hex } from '@/lib/links/tokens';
