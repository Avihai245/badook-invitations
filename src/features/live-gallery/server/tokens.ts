import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * The gallery's secrets. A link's token is derived from a random nonce with the server's key
 * (INVITES_GALLERY_SECRET, or the Supabase secret key when that isn't set): the database keeps the
 * nonce and the token's SHA-256 hash, never the token — so a copy of the database alone opens no
 * gallery — and the host's screen can still show the link any time. If the key changes, the links
 * already out keep working (they are found by their hash); the host's screen then offers a new one.
 */

export type LinkKind = 'upload' | 'projector';

/** 24 URL-safe characters (144 random bits). */
export const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
/** The browser's random uploader id. */
export const UPLOADER_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

function galleryKey(): Buffer {
  const env = serverEnv();
  const secret = env.INVITES_GALLERY_SECRET || env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('live gallery: no key (INVITES_GALLERY_SECRET or SUPABASE_SECRET_KEY)');
  return createHash('sha256').update(`badook-live-gallery:${secret}`).digest();
}

/** A fresh nonce (also used for channel names and access-code salts). */
export const randomId = (bytes = 18): string => randomBytes(bytes).toString('base64url');

export function deriveToken(kind: LinkKind, invitationId: string, nonce: string, key = galleryKey()): string {
  return createHmac('sha256', key)
    .update(`${kind}:${invitationId}:${nonce}`)
    .digest('base64url')
    .slice(0, 24);
}

/** A new link: its nonce, token and the hash the database keeps. */
export function newLink(
  kind: LinkKind,
  invitationId: string,
): { nonce: string; token: string; hash: string } {
  const nonce = randomId();
  const token = deriveToken(kind, invitationId, nonce);
  return { nonce, token, hash: sha256Hex(token) };
}

/** The link's token again, for the host's screen — null when the server's key changed since. */
export function linkToken(kind: LinkKind, invitationId: string, nonce: string, hash: string): string | null {
  const token = deriveToken(kind, invitationId, nonce);
  return sameHex(sha256Hex(token), hash) ? token : null;
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Access codes: case, spaces and dashes don't matter ("ab 12" = "AB-12"). */
export const normalizeCode = (code: string): string =>
  code
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '');

export function codeHash(code: string, salt: string): string {
  return sha256Hex(`gallery-code:${salt}:${normalizeCode(code)}`);
}

export function codeMatches(code: string, salt: string, hash: string): boolean {
  return sameHex(codeHash(code, salt), hash);
}

/**
 * The device's uploader id as the database keeps it: hashed with the invitation's id, so the same
 * phone can't be followed from one event to another.
 */
export const uploaderHash = (invitationId: string, uploader: string): string =>
  sha256Hex(`gallery-uploader:${invitationId}:${uploader}`);

/** A rate-limit key: never an address or an id as such, only a salted hash. */
export const rateKey = (scope: string, value: string): string =>
  sha256Hex(`${serverEnv().INVITES_IP_HASH_SALT}:gallery:${scope}:${value}`);
