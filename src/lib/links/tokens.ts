import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Links that open something without an account — the live gallery's upload and screen links, the
 * entrance stations' link — as tokens derived from a random nonce with the server's key
 * (INVITES_GALLERY_SECRET, or the Supabase secret key when that isn't set), one key per purpose. The
 * database keeps the nonce and the token's SHA-256 hash, never the token: a copy of the database alone
 * opens nothing, and the host's screen can still show the link any time. If the key changes, links
 * already out keep working (they are found by their hash); the host's screen then offers a new one.
 */

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/** A fresh nonce (also used for channel names and salts): 24 URL-safe characters by default. */
export const randomId = (bytes = 18): string => randomBytes(bytes).toString('base64url');

/** The server's key for one purpose's links ('live-gallery', 'event-day'). */
export function linkKey(purpose: string): Buffer {
  const env = serverEnv();
  const secret = env.INVITES_GALLERY_SECRET || env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error(`${purpose}: no link key (INVITES_GALLERY_SECRET or SUPABASE_SECRET_KEY)`);
  return createHash('sha256').update(`badook-${purpose}:${secret}`).digest();
}

/** A link's token: 24 URL-safe characters (144 bits) of the key's HMAC of kind, event and nonce. */
export function deriveLinkToken(key: Buffer, kind: string, invitationId: string, nonce: string): string {
  return createHmac('sha256', key)
    .update(`${kind}:${invitationId}:${nonce}`)
    .digest('base64url')
    .slice(0, 24);
}

/** Two hex digests, compared in constant time. */
export function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** A new link: its nonce, token and the hash the database keeps. */
export function newLinkToken(
  key: Buffer,
  kind: string,
  invitationId: string,
): { nonce: string; token: string; hash: string } {
  const nonce = randomId();
  const token = deriveLinkToken(key, kind, invitationId, nonce);
  return { nonce, token, hash: sha256Hex(token) };
}

/** The link's token again, for the host's screen — null when the server's key changed since. */
export function linkTokenAgain(
  key: Buffer,
  kind: string,
  invitationId: string,
  nonce: string,
  hash: string,
): string | null {
  const token = deriveLinkToken(key, kind, invitationId, nonce);
  return sameHex(sha256Hex(token), hash) ? token : null;
}

/** A rate-limit key: never an address or an id as such, only a salted hash (one namespace per feature). */
export const rateKey = (namespace: string, scope: string, value: string): string =>
  sha256Hex(`${serverEnv().INVITES_IP_HASH_SALT}:${namespace}:${scope}:${value}`);
