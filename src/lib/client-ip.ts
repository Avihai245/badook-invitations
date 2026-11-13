/**
 * The visitor's IP for rate limits (never stored as is — only hashed): CloudFront-Viewer-Address
 * ("ip:port") when present; otherwise an X-Forwarded-For hop.
 *
 * Which hop: every proxy in front of the app appends the address it got the request from, so the
 * entries the client didn't write are the last ones — the client can put anything before them.
 * INVITES_TRUSTED_PROXY_HOPS is how many proxies the deployment has in front of the app (CloudFront → 1;
 * CloudFront and a load balancer → 2): the visitor is that many entries from the right, and nothing the
 * client sends can change it. Unset (0), the first hop is used, as before — it can be set by the client,
 * which only lets an attacker dodge a limit, whereas a wrong count could put everyone into one bucket.
 * Set it once the deployment's chain is known (log X-Forwarded-For on a request whose address you know).
 */
export function clientIp(request: Request): string | null {
  return ipFromHeaders(request.headers);
}

/** The same from a request's headers (a server page's `headers()`). */
export function ipFromHeaders(
  headers: Pick<Headers, 'get'>,
  trustedHops = Number(process.env.INVITES_TRUSTED_PROXY_HOPS) || 0,
): string | null {
  const viewer = headers.get('cloudfront-viewer-address');
  if (viewer) return viewer.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const forwarded =
    trustedHops > 0 ? (hops[Math.max(0, hops.length - Math.floor(trustedHops))] ?? null) : (hops[0] ?? null);
  return forwarded || headers.get('x-real-ip') || null;
}
