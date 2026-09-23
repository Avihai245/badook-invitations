import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { dirOf, type FontPair, type InvitationDocument, type Locale } from '../contracts/types';
import { displayEmPerChar, fontFaceFiles, fontFor } from '../fonts';
import { visualLine } from '../lib/bidi';
import { formatDate } from '../lib/dates';
import type { RenderContext } from '../renderer/context';
import { resolveFontPair } from '../renderer/theme';

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Short hash of a published document, put in the image URL: link previews (WhatsApp, Facebook…)
 * cache images by URL, so each publish that changes the invitation gets a fresh one (§4 publish →
 * "(re)generates the OG image").
 */
export function ogVersion(doc: InvitationDocument): string {
  return createHash('sha1').update(JSON.stringify(doc)).digest('hex').slice(0, 10);
}

// ─── fonts ────────────────────────────────────────────────────────────────────────────────────────
// satori reads TTF/OTF/WOFF, not WOFF2: the @fontsource package's .woff of the face browsers get as
// .woff2 (node_modules/@fontsource/<id>/files — traced into the server bundle, see next.config).

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400;
  style: 'normal';
}

const fileCache = new Map<string, Promise<ArrayBuffer | null>>();

function readWoff(url: string): Promise<ArrayBuffer | null> {
  let pending = fileCache.get(url);
  if (!pending) {
    // '/fonts/<id>/<version>/<file>.woff2'
    const [, , id = '', , file = ''] = url.split('/');
    const woff = path.join(
      process.cwd(),
      'node_modules',
      '@fontsource',
      id,
      'files',
      file.replace(/\.woff2$/, '.woff'),
    );
    pending = readFile(woff).then(
      (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      (err: unknown) => {
        console.error(`OG image: font file ${woff} is missing`, err);
        return null;
      },
    );
    fileCache.set(url, pending);
  }
  return pending;
}

/**
 * The fonts of a role (display, ui) for the locale, as a satori font-family list: the locale's family
 * then the other script's (like the browser's stack), each subset registered under its own name —
 * satori keeps one font per name, and takes a missing glyph (digits, "&") from the next in the list.
 */
async function loadFonts(pair: FontPair, locale: Locale) {
  const other: Locale = locale === 'he' ? 'en' : 'he';
  const subsets = locale === 'he' ? ['hebrew', 'latin'] : ['latin', 'hebrew'];
  const fonts: OgFont[] = [];
  const stack = async (role: 'display' | 'ui') => {
    const names: string[] = [];
    for (const family of new Set([fontFor(pair, role, locale), fontFor(pair, role, other)])) {
      for (const subset of subsets) {
        const faces = fontFaceFiles(family).filter((f) => f.subset === subset && f.style === 'normal');
        const face = [...faces].sort((a, b) => Math.abs(a.weight - 400) - Math.abs(b.weight - 400))[0];
        const data = face ? await readWoff(face.url) : null;
        if (!data) continue;
        const name = `${family} ${subset}`;
        if (!fonts.some((f) => f.name === name)) fonts.push({ name, data, weight: 400, style: 'normal' });
        names.push(`"${name}"`);
      }
    }
    return names.join(', ');
  };
  const display = await stack('display');
  const ui = await stack('ui');
  return { fonts, display, ui };
}

// ─── background ───────────────────────────────────────────────────────────────────────────────────

/** The hero photo as a data URL (satori decodes JPEG/PNG only); null → the template's gradient. */
async function heroPhoto(url: string | null): Promise<string | null> {
  if (!url || !/\.(jpe?g|png)(\?|$)/i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(jpeg|png)\b/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength <= 6_000_000 ? `data:${type};base64,${buf.toString('base64')}` : null;
  } catch {
    return null;
  }
}

/** The last linear-gradient of the placeholder sky (satori draws one gradient reliably). */
function skyGradient(sky: string): string {
  const at = sky.lastIndexOf('linear-gradient(');
  return at >= 0 ? sky.slice(at) : sky;
}

// ─── image ────────────────────────────────────────────────────────────────────────────────────────

/**
 * 1200×630 link-preview image (§4 `GET /i/[slug]/opengraph-image`): the hero's photo — or the
 * template's sky gradient while there is none — with the names in the display font and
 * "<eyebrow> · <date>" under them, like the share screen's preview card. satori has no bidi support:
 * every line is laid out in visual order first (lib/bidi), and never wraps.
 */
export async function invitationOgImage(ctx: RenderContext, headers?: HeadersInit): Promise<ImageResponse> {
  const { doc, template, locale } = ctx;
  const dir = dirOf(locale);
  const pair = resolveFontPair(template, doc);
  const { fonts, display, ui } = await loadFonts(pair, locale);

  const hero = doc.sections.find((s) => s.type === 'hero');
  const data = hero?.type === 'hero' ? hero.data : null;
  const photo = data
    ? await heroPhoto(ctx.asset(data.media.kind === 'image' ? data.media.src : data.media.poster))
    : null;
  const overlay = data?.overlayOpacity ?? template.hero.defaultOverlay;

  const custom = data?.title.mode === 'custom' ? ctx.text(data.title.text) : '';
  const primary = ctx.text(doc.hosts.primary);
  const secondary = ctx.text(doc.hosts.secondary);
  const joiner = ctx.text(doc.hosts.joiner) || '&';
  const names = custom || [primary, secondary ? joiner : '', secondary].filter(Boolean).join(' ');
  const date = formatDate(doc.event.date, locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const sub = [data?.eyebrow ? ctx.text(data.eyebrow) : '', date].filter(Boolean).join(' · ');

  // Font size from the display font's measured average advance (no wrapping, so it has to fit).
  const em = displayEmPerChar(pair, locale);
  const fit = (text: string, max: number) =>
    Math.max(40, Math.min(max, Math.floor(1040 / (Math.max(1, [...text].length) * em))));
  const single = fit(names, 132);
  const lines =
    custom || !secondary || single >= 88
      ? [{ text: names, size: single }]
      : [
          { text: primary, size: fit(primary, 116) },
          { text: joiner, size: Math.round(fit(primary, 116) * 0.55) },
          { text: secondary, size: fit(secondary, 116) },
        ];

  // the eyebrow line in the UI font (≈0.52em per character): shrink a long one rather than cut it
  const subSize = Math.max(22, Math.min(38, Math.floor(1080 / (Math.max(1, [...sub].length) * 0.52))));

  const color = template.hero.textColor;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: photo ? undefined : skyGradient(ctx.art.sky),
        backgroundColor: template.hero.overlayColor,
      }}
    >
      {photo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- satori: decorative background
        <img
          src={photo}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: template.hero.overlayColor,
          opacity: photo ? overlay : overlay * 0.5,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color,
          textShadow: '0 2px 24px rgba(0,0,0,.28)',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              fontFamily: display,
              fontSize: line.size,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            }}
          >
            {visualLine(line.text, dir)}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            width: 180,
            height: 2,
            marginTop: 26,
            marginBottom: 22,
            flexShrink: 0,
            backgroundColor: color,
            opacity: 0.55,
          }}
        />
        <div
          style={{ display: 'flex', fontFamily: ui, fontSize: subSize, whiteSpace: 'nowrap', opacity: 0.95 }}
        >
          {visualLine(sub, dir)}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts, headers },
  );
}
