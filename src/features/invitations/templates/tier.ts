/**
 * A premium design (the gallery marks them): anyone can edit one, publishing it needs a paid plan.
 * Isomorphic — the server's publish check and the editor's notice use the same rule.
 */
export const isPremiumTemplate = (manifest: object) => (manifest as { tier?: unknown }).tier === 'premium';
