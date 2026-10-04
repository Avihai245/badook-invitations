import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';
import {
  IMAGE_DEVICE_SIZES,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
} from './src/features/invitations/renderer/image-config';

// the regular face of each family's Hebrew and Latin subsets (~1.7MB) — what og-image.tsx loads
// + the Cyrillic, Arabic and Ethiopic subsets of the families that have them (the other languages)
const FONT_FILES = [
  './node_modules/@fontsource/*/files/*-hebrew-400-normal.woff',
  './node_modules/@fontsource/*/files/*-latin-400-normal.woff',
  './node_modules/@fontsource/*/files/*-cyrillic-400-normal.woff',
  './node_modules/@fontsource/*/files/*-arabic-400-normal.woff',
  './node_modules/@fontsource/*/files/*-ethiopic-400-normal.woff',
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

/**
 * The build's commit, for the admin console's system page: Amplify's (AWS_COMMIT_ID, set in its
 * builds), else git's, else "local". A public value — it names a commit, nothing more.
 */
const buildCommit = (() => {
  const amplify = process.env.AWS_COMMIT_ID?.trim();
  if (amplify) return amplify.slice(0, 12);
  try {
    return (
      execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
        .toString()
        .trim() || 'local'
    );
  } catch {
    return 'local';
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Amplify builds: Next's own version-skew protection (a tab on an older deployment loads pages in
  // full instead of mixing builds) — features/site/StaleBuildGuard.client.tsx covers the rest
  ...(process.env.AWS_COMMIT_ID?.trim()
    ? { deploymentId: process.env.AWS_COMMIT_ID.trim().slice(0, 32) }
    : {}),
  images: imageSources
    ? {
        formats: ['image/avif', 'image/webp'],
        // the renderer writes the optimizer's addresses from the same lists (renderer/images.ts)
        deviceSizes: IMAGE_DEVICE_SIZES,
        imageSizes: IMAGE_SIZES,
        qualities: IMAGE_QUALITIES,
        // uploads have unique paths and template media a content hash in its URL: safe to keep a month
        minimumCacheTTL: 2_592_000,
        remotePatterns: imageSources,
      }
    : { unoptimized: true },
  env: {
    INVITES_IMAGE_SOURCES: imageSources ? JSON.stringify(imageSources) : 'off',
    // the running build (the admin console's system page)
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // The host app's two dictionaries (lib/i18n/*.he.ts, *.en.ts — the guests' own dictionaries aside)
  // each in a chunk of its own: a page loads its UI language's (lib/i18n/provider.tsx) instead of one
  // shared chunk with both, which was most of every page's JavaScript.
  webpack(config, { isServer }) {
    const split = config.optimization?.splitChunks;
    if (!isServer && split && typeof split === 'object') {
      const dictionary = (lang: 'he' | 'en') => ({
        test: (module: { resource?: string }) =>
          new RegExp(`[\\\\/]src[\\\\/]lib[\\\\/]i18n[\\\\/][^\\\\/]+\\.${lang}\\.ts$`).test(
            module.resource ?? '',
          ) && !/(event-day-guest|event-day-guide|gallery-guest|review-guest)/.test(module.resource ?? ''),
        name: `ui-${lang}`,
        chunks: 'all' as const,
        enforce: true,
        priority: 60,
      });
      split.cacheGroups = { ...(split.cacheGroups || {}), uiHe: dictionary('he'), uiEn: dictionary('en') };
    }
    return config;
  },
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
          // the invitation languages (contracts/types.ts LOCALES)
          has: [{ type: 'query', key: 'lang', value: '(?<lang>he|en|ru|ar|fr|es|am)' }],
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
      {
        // The draft review page (a private link): never indexed, and its address (the key) is never
        // sent to the sites its links lead to (maps, calendars).
        source: '/review/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        // The face search's model (scripts/copy-face-models.mjs), versioned by path the same way: a
        // phone downloads it once, when someone first uses "the photos I'm in".
        source: '/face-models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
