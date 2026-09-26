import 'server-only';
import {
  deriveLinkToken,
  linkKey,
  linkTokenAgain,
  newLinkToken,
  rateKey as linkRateKey,
  sameHex,
  sha256Hex,
} from '@/lib/links/tokens';

/**
 * The gallery's secrets. Its links are derived from a random nonce with the server's key
 * (src/lib/links/tokens.ts — INVITES_GALLERY_SECRET, or the Supabase secret key when that isn't set):
 * the database keeps the nonce and the token's SHA-256 hash, never the token — so a copy of the
 * database alone opens no gallery — and the host's screen can still show the link any time. If the key
 * changes, the links already out keep working (they are found by their hash); the host's screen then
 * offers a new one.
 */

export type LinkKind = 'upload' | 'projector';

/** 24 URL-safe characters (144 random bits). */
export const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
/** The browser's random uploader id. */
export const UPLOADER_RE = /^[A-Za-z0-9_-]{16,64}$/;

export { randomId, sha256Hex } from '@/lib/links/tokens';

const galleryKey = () => linkKey('live-gallery');

export function deriveToken(kind: LinkKind, invitationId: string, nonce: string, key = galleryKey()): string {
  return deriveLinkToken(key, kind, invitationId, nonce);
}

/** A new link: its nonce, token and the hash the database keeps. */
export function newLink(
  kind: LinkKind,
  invitationId: string,
): { nonce: string; token: string; hash: string } {
  return newLinkToken(galleryKey(), kind, invitationId);
}

/** The link's token again, for the host's screen — null when the server's key changed since. */
export function linkToken(kind: LinkKind, invitationId: string, nonce: string, hash: string): string | null {
  return linkTokenAgain(galleryKey(), kind, invitationId, nonce, hash);
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
export const rateKey = (scope: string, value: string): string => linkRateKey('gallery', scope, value);
