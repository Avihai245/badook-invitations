import type { NextConfig } from 'next';

// the regular face of each family's Hebrew and Latin subsets (~1.7MB) — what og-image.tsx loads
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

/**
 * Where invitation images may be optimized from (next/image: AVIF / WebP in a srcset of widths): the
 * Supabase Storage buckets — the project's public objects (uploads, template media) and a separate
 * template-media address when one is set. Local paths are always allowed. The same list reaches the
 * renderer as INVITES_IMAGE_SOURCES (renderer/images.ts), so it never asks for an image the optimizer
 * would refuse; INVITES_IMAGE_OPTIMIZATION=off serves every image as it is.
 */
const imageSources = (() => {
  if (process.env.INVITES_IMAGE_OPTIMIZATION === 'off') return null;
  const list: { protocol: 'http' | 'https'; hostname: string; port: string; pathname: string }[] = [];
  const add = (base: string | undefined, pathname: (u: URL) => string) => {
    try {
      if (!base) return;
      const u = new URL(base);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
      list.push({
        protocol: u.protocol === 'https:' ? 'https' : 'http',
        hostname: u.hostname,
        port: u.port,
        pathname: pathname(u),
      });
    } catch {
      // not a URL: nothing to allow
    }
  };
  add(process.env.NEXT_PUBLIC_SUPABASE_URL, () => '/storage/v1/object/public/**');
  add(process.env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL, (u) => `${u.pathname.replace(/\/+$/, '')}/**`);
  return list;
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: imageSources
    ? {
        formats: ['image/avif', 'image/webp'],
        // phones to wide screens (a full-bleed photo); no 3840 — a 2048px photo is plenty behind text
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
        imageSizes: [96, 256, 384],
        qualities: [70, 75],
        // uploads have unique paths and template media a content hash in its URL: safe to keep a month
        minimumCacheTTL: 2_592_000,
        remotePatterns: imageSources,
      }
    : { unoptimized: true },
  env: { INVITES_IMAGE_SOURCES: imageSources ? JSON.stringify(imageSources) : 'off' },
  // The dev-tools badge would show up in Design QA screenshots.
  devIndicators: false,
  // Lets a second dev server run side by side (e.g. QA scripts) without clobbering `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // an address that matches no page at all gets the site's own 404 (app/global-not-found.tsx), not
    // Next's plain English one — the app has several root layouts, so there is no single not-found
    globalNotFound: true,
    ...(publicHost ? { serverActions: { allowedOrigins: [publicHost] } } : {}),
  },
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
