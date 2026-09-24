import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of a presented secret (header value) with the expected one. */
export function sameSecret(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
