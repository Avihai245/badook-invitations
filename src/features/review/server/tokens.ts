import 'server-only';
import { linkKey, linkTokenAgain, newLinkToken, rateKey as linkRateKey, sha256Hex } from '@/lib/links/tokens';

/**
 * The draft review link's secrets, derived like the gallery's and the entrance stations' links
 * (src/lib/links/tokens.ts, a key of its own): only the token's hash is stored, a new link retires the
 * old one. A family member's browser key is kept hashed too (it lets them remove their own comment).
 */

const key = () => linkKey('draft-review');

export const newReviewLink = (invitationId: string) => newLinkToken(key(), 'review', invitationId);

/** The review link's token again, for the host's screen — null when the server's key changed since. */
export const reviewToken = (invitationId: string, nonce: string, hash: string): string | null =>
  linkTokenAgain(key(), 'review', invitationId, nonce, hash);

/** A rate-limit key (a salted hash of an address). */
export const rateKey = (scope: string, value: string): string => linkRateKey('draft-review', scope, value);

/** What the database keeps of a family member's browser key. */
export const authorKeyHash = (authorKey: string): string => sha256Hex(`badook-review-author:${authorKey}`);

export { randomId, sha256Hex } from '@/lib/links/tokens';
