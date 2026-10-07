import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { dirOf, type FontPair, type InvitationDocument, type Locale } from '../contracts/types';
import { displayEmPerChar, fontFaceFiles, fontFor } from '../fonts';
import { shapeArabic } from '../lib/arabic-shape';
import { visualLine } from '../lib/bidi';
import { formatDate } from '../lib/dates';
import { LOCALE_INFO, type Script } from '../lib/locales';
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

/** The subsets of a script's text, first to last (digits and "&" come from the Latin one). */
const OG_SUBSETS: Record<Script, readonly string[]> = {
  hebrew: ['hebrew', 'latin'],
  latin: ['latin', 'hebrew'],
  cyrillic: ['cyrillic', 'latin'],
  arabic: ['arabic', 'latin'],
  ethiopic: ['ethiopic', 'latin'],
};

/**
 * The image draws Arabic in its presentation forms (lib/arabic-shape): a design whose Arabic face
 * lacks them is drawn in the face of its style that has them.
 */
const OG_ARABIC: Record<string, string> = { 'Aref Ruqaa': 'Amiri', Cairo: 'Noto Kufi Arabic' };

/**
 * The fonts of a role (display, ui) for the locale, as a satori font-family list: the locale's family
 * then the other script's (like the browser's stack), each subset registered under its own name —
 * satori keeps one font per name, and takes a missing glyph (digits, "&") from the next in the list.
 */
async function loadFonts(pair: FontPair, locale: Locale) {
  const script = LOCALE_INFO[locale].script;
  // Hebrew text next to Latin, any other script next to the pair's Latin face (digits, "&")
  const other: Locale = locale === 'en' ? 'he' : 'en';
  const subsets = OG_SUBSETS[script];
  const fonts: OgFont[] = [];
  const own = (role: 'display' | 'ui') => {
    const family = fontFor(pair, role, locale);
    return script === 'arabic' ? (OG_ARABIC[family] ?? family) : family;
  };
  const stack = async (role: 'display' | 'ui') => {
    const names: string[] = [];
    for (const family of new Set([own(role), fontFor(pair, role, other)])) {
      for (const subset of subsets) {
        // the regular face (the one next.config traces into the server bundle)
        const face = fontFaceFiles(family).find(
          (f) => f.subset === subset && f.style === 'normal' && f.weight === 400,
        );
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

/**
 * A photo as a JPEG/PNG data URL (satori decodes those only); null → the template's gradient. Uploads
 * are stored as WebP (editor/fields/prepare-image.ts) and template media may be WebP/AVIF too: those
 * are re-encoded with sharp (at most 1600px wide — the card is 1200).
 */
async function photoData(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\//.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 12_000_000) return null;
    if (/^image\/(jpeg|png)\b/.test(type) && buf.byteLength <= 6_000_000)
      return `data:${type};base64,${buf.toString('base64')}`;
    const jpeg = await toJpeg(buf);
    return jpeg ? `data:image/jpeg;base64,${jpeg.toString('base64')}` : null;
  } catch {
    return null;
  }
}

/** Any image sharp reads (WebP, AVIF, a large JPEG/PNG…) as an upright JPEG ≤ 1600px wide; null without sharp. */
async function toJpeg(buf: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (err) {
    console.error('OG image: could not convert a photo', err);
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
  // the host's own share image (editor: "share image"): shown as it is, without text over it
  const own = doc.share.ogImage ? await photoData(ctx.asset(doc.share.ogImage)) : null;
  if (own) return ownImage(own, headers);
  const dir = dirOf(locale);
  // satori neither shapes Arabic nor lays out right to left: joined forms first, then visual order
  const line = (text: string) => visualLine(locale === 'ar' ? shapeArabic(text) : text, dir);
  const pair = resolveFontPair(template, doc);
  const { fonts, display, ui } = await loadFonts(pair, locale);

  const hero = doc.sections.find((s) => s.type === 'hero');
  const data = hero?.type === 'hero' ? hero.data : null;
  const photo = data
    ? await photoData(ctx.asset(data.media.kind === 'image' ? data.media.src : data.media.poster))
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
        // satori fails on an undefined style value: the gradient only without a photo
        ...(photo ? {} : { backgroundImage: skyGradient(ctx.art.sky) }),
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
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              fontFamily: display,
              fontSize: l.size,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            }}
          >
            {line(l.text)}
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
          {line(sub)}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts, headers },
  );
}

/** The host's uploaded share image, cropped to fill the card. */
function ownImage(photo: string, headers?: HeadersInit): ImageResponse {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#000' }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- satori: the whole card is the picture */}
      <img
        src={photo}
        width={OG_SIZE.width}
        height={OG_SIZE.height}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>,
    { ...OG_SIZE, headers },
  );
}
