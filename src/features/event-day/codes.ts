import { QR_PREFIX } from './config';

/**
 * Entrance codes (isomorphic). A guest's code is derived one-way from their personal link's token
 * (server/codes.ts; the database derives the same — checkin_code()); their QR carries it with a prefix,
 * so a station can tell a guest's code from any other QR in the hall (the gallery's, a menu's).
 */

export const CODE_RE = /^[A-Za-z0-9_-]{22}$/;

/** What a guest's QR says. */
export const qrPayload = (code: string): string => `${QR_PREFIX}${code}`;

/** The entrance code in what a camera read, or null when it isn't a guest's code. */
export function codeFromScan(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(QR_PREFIX)) return null;
  const code = t.slice(QR_PREFIX.length);
  return CODE_RE.test(code) ? code : null;
}
