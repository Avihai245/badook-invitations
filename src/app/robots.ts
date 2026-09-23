import type { MetadataRoute } from 'next';

/**
 * /robots.txt. The pages stay open to crawlers on purpose: a search engine only learns that a page
 * is `noindex` (hidden invitations, the host app) by fetching it — a URL closed here could still be
 * listed from links elsewhere, just without its content. Only the API and the dev pages are closed.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dev/'] } };
}
