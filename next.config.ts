import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev-tools badge would show up in Design QA screenshots.
  devIndicators: false,
  // Lets a second dev server run side by side (e.g. QA scripts) without clobbering `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Metadata (title, Open Graph) goes into <head> for every user agent instead of being streamed after
  // the shell, so link previews from any messenger (not only Next's bot list) see it.
  htmlLimitedBots: /.*/,
  // /i/<slug>?lang=en → /i/<slug>/en (no ?lang → /i/<slug>/default): the public invitation is a
  // cacheable path (ISR + CDN) instead of depending on the query. Done here rather than in middleware —
  // responses to middleware rewrites are sent as `private, no-store`, which disables ISR and the CDN.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/i/:slug',
          has: [{ type: 'query', key: 'lang', value: '(?<lang>he|en)' }],
          destination: '/i/:slug/:lang',
        },
        { source: '/i/:slug', destination: '/i/:slug/default' },
      ],
    };
  },
  async headers() {
    return [
      {
        // Font files are versioned by path (/fonts/<family>/<version>/…) — safe to cache forever.
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
