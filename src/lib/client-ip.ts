/**
 * The visitor's IP for rate limits (never stored as is — only hashed): CloudFront-Viewer-Address
 * ("ip:port") when present; otherwise the first X-Forwarded-For hop. That one can be set by the client,
 * which only lets an attacker dodge the limit, whereas trusting a proxy hop could put everyone into
 * one bucket.
 */
export function clientIp(request: Request): string | null {
  return ipFromHeaders(request.headers);
}

/** The same from a request's headers (a server page's `headers()`). */
export function ipFromHeaders(headers: Pick<Headers, 'get'>): string | null {
  const viewer = headers.get('cloudfront-viewer-address');
  if (viewer) return viewer.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || null;
}
