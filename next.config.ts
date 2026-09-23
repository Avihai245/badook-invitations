import type { NextConfig } from 'next';

// the regular face of each family's Hebrew and Latin subsets (~0.9MB) — what og-image.tsx loads
const FONT_FILES = [
  './node_modules/@fontsource/*/files/*-hebrew-400-normal.woff',
  './node_modules/@fontsource/*/files/*-latin-400-normal.woff',
];

/**
 * The app's public address (INVITES_PUBLIC_BASE_URL — .env files are loaded before this one): on a
 * custom domain behind Amplify's CDN, the host the proxy forwards can differ from the browser's
 * Origin, and Server Actions (sign in, sign up, passwords) would be refused as cross-site.
 */
const publicHost = (() => {
  try {
    const url = process.env.INVITES_PUBLIC_BASE_URL;
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev-tools badge would show up in Design QA screenshots.
  devIndicators: false,
  // Lets a second dev server run side by side (e.g. QA scripts) without clobbering `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  ...(publicHost ? { experimental: { serverActions: { allowedOrigins: [publicHost] } } } : {}),
  // Metadata (title, Open Graph) goes into <head> for every user agent instead of being streamed after
  // the shell, so link previews from any messenger (not only Next's bot list) see it.
  htmlLimitedBots: /.*/,
  // The OG image renderer (satori) reads fonts from disk — the .woff next to each @fontsource .woff2 —
  // so they must ship with those routes (the paths are computed at runtime, invisible to tracing).
  outputFileTracingIncludes: {
    '/i/[slug]/opengraph-image': FONT_FILES,
    '/dev/invitations/og/[template]/[lang]/[doc]': FONT_FILES,
  },
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
