import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { NextConfig } from 'next';
import { posterArtVersion } from './src/features/invitations/app/poster-art-version';
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
  // YouTube's stills (the home page's background, a hero's YouTube link): resized and AVIF / WebP
  add('https://i.ytimg.com', () => '/vi/**');
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
    // the pre-rendered poster scenery's folder (scripts/build-poster-art.tsx, app/poster-art.ts)
    INVITES_POSTER_ART_VERSION: posterArtVersion(),
  },
  // The host app's two dictionaries (lib/i18n/*.he.ts, *.en.ts — the guests' own dictionaries aside)
  // each in a chunk of its own: a page loads its UI language's (lib/i18n/provider.tsx) instead of one
  // shared chunk with both, which was most of every page's JavaScript.
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // Next's polyfills (Array.prototype.at / flat / flatMap, Object.fromEntries, Object.hasOwn…):
      // every browser in package.json's browserslist has them all — the module is left out
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]next[\\/]dist[\\/]build[\\/]polyfills[\\/]polyfill-module(\.js)?$/,
          join(process.cwd(), 'src/lib/empty-module.js'),
        ),
      );
    }
    const split = config.optimization?.splitChunks;
    if (!isServer && split && typeof split === 'object') {
      // the public pages' part of a dictionary (app-core.<lang>.ts and what it imports) — its own chunk,
      // so the home page doesn't download the app's screens' strings
      const SITE = /[\\/](app-core|site|account|tickets)\.(he|en)\.ts$/;
      const dictionary = (lang: 'he' | 'en', part: 'site' | 'app') => ({
        test: (module: { resource?: string }) => {
          const file = module.resource ?? '';
          return (
            new RegExp(`[\\\\/]src[\\\\/]lib[\\\\/]i18n[\\\\/][^\\\\/]+\\.${lang}\\.ts$`).test(file) &&
            !/(event-day-guest|event-day-guide|gallery-guest|review-guest)/.test(file) &&
            SITE.test(file) === (part === 'site')
          );
        },
        name: part === 'site' ? `ui-site-${lang}` : `ui-${lang}`,
        chunks: 'all' as const,
        enforce: true,
        priority: 60,
      });
      split.cacheGroups = {
        ...(split.cacheGroups || {}),
        uiHe: dictionary('he', 'app'),
        uiEn: dictionary('en', 'app'),
        uiSiteHe: dictionary('he', 'site'),
        uiSiteEn: dictionary('en', 'site'),
      };
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
      // Files versioned by name or folder — safe to cache forever (Amplify's CDN reads the same rules
      // from customHttp.yml; these serve `next start` and any other host):
      //   /fonts/<family>/<version>/…   /video/<name>.<hash>.<ext>   /brand/<name>-<w>.<hash>.<ext>
      //   /poster-art/<hash>/…
      ...['/fonts/:path*', '/video/:path*', '/brand/:path*', '/poster-art/:path*'].map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      })),
      {
        // the templates' own pictures (not versioned by name): a day, then refreshed in the background
        source: '/templates/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=2592000' }],
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
