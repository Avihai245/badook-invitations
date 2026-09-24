/** Amplify's default address for a branch (`main.<app id>.amplifyapp.com`). */
const AMPLIFY_DEFAULT = /\.amplifyapp\.com$/i;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i;
const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/;

/**
 * The address to show and send people to, given the configured one (INVITES_PUBLIC_BASE_URL) and the
 * host a request came in on: the configured address — unless it is still a placeholder (unset →
 * localhost) or Amplify's default `*.amplifyapp.com` while the site is being used on its own domain;
 * then the domain the request came in on. Only an https host that looks like a hostname qualifies.
 */
export function preferredBaseUrl(configured: string, host: string | null, proto: string | null): string {
  let current: URL;
  try {
    current = new URL(configured);
  } catch {
    return configured;
  }
  const seen = (host ?? '').split(',')[0]!.trim().toLowerCase();
  const scheme = (proto ?? 'https').split(',')[0]!.trim().toLowerCase();
  if (!seen || seen === current.host || !HOST.test(seen) || scheme !== 'https') return configured;
  const seenName = seen.replace(/:\d+$/, '');
  if (LOCAL.test(seenName)) return configured;
  // unset (the localhost default): any real https address beats it
  if (LOCAL.test(current.hostname)) return `https://${seen}`;
  // Amplify's default address, while the request came in on the site's own domain
  if (AMPLIFY_DEFAULT.test(current.hostname) && !AMPLIFY_DEFAULT.test(seenName)) return `https://${seen}`;
  return configured;
}
