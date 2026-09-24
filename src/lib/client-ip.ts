/**
 * The visitor's IP for rate limits (never stored as is — only hashed): CloudFront-Viewer-Address
 * ("ip:port") when present; otherwise the first X-Forwarded-For hop. That one can be set by the client,
 * which only lets an attacker dodge the limit, whereas trusting a proxy hop could put everyone into
 * one bucket.
 */
export function clientIp(request: Request): string | null {
  const viewer = request.headers.get('cloudfront-viewer-address');
  if (viewer) return viewer.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}
