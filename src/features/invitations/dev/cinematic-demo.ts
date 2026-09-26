import type {
  InvitationDocument,
  L10n,
  Locale,
  OpeningPreset,
  Palette,
  Section,
  SectionAnimation,
  SectionMedia,
} from '../contracts/types';
import { DEFAULT_SECTION_ANIMATION } from '../contracts/types';
import { contrastRatio, mixHex, relativeLuminance } from '../lib/contrast';
import { demoDocument } from '../templates/demo';
import { requireTemplate } from '../templates/registry';

/**
 * The cinematic showcase (schema v2) for any template: every layout (full bleed, both splits,
 * parallax, video background, a framed stack picture), every scroll effect, the text reveals, a band
 * with its own colors and the five new section types — the kitchen sink's `cinematic` document, the
 * end-to-end tests' and the performance gate's. Its media are the synthetic pictures of
 * tests/fixtures/media (`upload:cine-*`, served by /dev/media in the kitchen sink).
 */

const pick = (value: L10n, locales: readonly Locale[]): L10n =>
  Object.fromEntries(locales.filter((l) => value[l] !== undefined).map((l) => [l, value[l]]));

const picture = (file: string, x = 0.5, y = 0.5, alt: L10n | null = null): SectionMedia => ({
  kind: 'image',
  src: `upload:${file}`,
  poster: null,
  focalPoint: { x, y },
  alt,
});

const motion = (
  preset: SectionAnimation['enter']['preset'],
  more: Partial<Omit<SectionAnimation, 'enter'>> = {},
): SectionAnimation => ({
  ...DEFAULT_SECTION_ANIMATION,
  enter: { ...DEFAULT_SECTION_ANIMATION.enter, preset },
  ...more,
});

/** The accent mixed toward `toward` until it reads on `bg` (4.5:1), or as far as it can go. */
function readableAccent(accent: string, toward: string, bg: string): string {
  let t = 0.2;
  while (t < 0.85 && contrastRatio(mixHex(accent, toward, t), bg) < 4.5) t += 0.05;
  return mixHex(accent, toward, t);
}

/**
 * A band in the template's own hues, the other way round: on a light design a night band (its ink as
 * the background, its paper as the text), on a dark one a day band (its paper light, its ink dark) —
 * the accent lifted or deepened until the titles read.
 */
function bandPalette(p: Palette): Partial<Palette> {
  if (relativeLuminance(p.bg) >= relativeLuminance(p.ink)) {
    const bg = mixHex(p.ink, '#000000', 0.35);
    return {
      bg,
      surface: mixHex(p.ink, '#000000', 0.15),
      ink: mixHex(p.bg, '#FFFFFF', 0.4),
      inkMuted: mixHex(p.bg, p.ink, 0.28),
      line: mixHex(p.ink, '#FFFFFF', 0.28),
      accent: readableAccent(p.accent, '#FFFFFF', bg),
      accentInk: mixHex(p.ink, '#000000', 0.5),
    };
  }
  const bg = mixHex(p.ink, '#FFFFFF', 0.55);
  return {
    bg,
    surface: mixHex(p.ink, '#FFFFFF', 0.8),
    ink: mixHex(p.bg, '#000000', 0.15),
    inkMuted: mixHex(p.bg, p.ink, 0.3),
    line: mixHex(p.bg, p.ink, 0.65),
    accent: readableAccent(p.accent, '#000000', bg),
    accentInk: mixHex(p.ink, '#FFFFFF', 0.85),
  };
}

/** The sections the showcase adds, by id. */
const SHOWCASE_IDS: ReadonlySet<string> = new Set(['quote', 'when', 'parents', 'where', 'dance', 'candles']);

export function cinematicDocument(
  templateId: string,
  opening: OpeningPreset | null = null,
  locales: Locale[] = ['he', 'en'],
): InvitationDocument {
  const doc = demoDocument(templateId, undefined, locales);
  const { manifest } = requireTemplate(templateId);
  const t = (value: L10n) => pick(value, locales);
  const venue = doc.sections.find((s) => s.type === 'venues');
  const firstVenue =
    venue?.type === 'venues' && venue.data.items[0]
      ? { ...venue.data.items[0], label: t({ he: 'המקום', en: 'The venue' }) }
      : null;

  const extra: Record<string, Section[]> = {
    // right after the hero: a verse over a sunset, word by word
    hero: [
      {
        id: 'quote',
        type: 'quote',
        enabled: true,
        layout: 'full_bleed',
        media: picture('cine-sunset.jpg', 0.65, 0.62),
        animation: motion('fade', { text: 'words', stagger: 70 }),
        data: {
          text: t({
            he: 'מצאתי את שאהבה נפשי',
            en: 'I have found the one whom my soul loves',
          }),
          attribution: t({ he: 'שיר השירים ג׳, ד׳', en: 'Song of Songs 3:4' }),
        },
      },
    ],
  };
  const sections: Section[] = [];
  for (const s of doc.sections) {
    // a design's own new-type sections (a photographic design seeds a verse and the date) give way to
    // the showcase's
    if (SHOWCASE_IDS.has(s.id)) continue;
    switch (s.type) {
      case 'text':
        // the story beside a golden-hour picture, line by line
        sections.push(
          s.data.kind === 'story'
            ? {
                ...s,
                enabled: true,
                layout: 'split_start',
                media: picture('cine-couple.jpg', 0.52, 0.6, t({ he: 'שניים בשקיעה', en: 'Two at sunset' })),
                animation: motion('slide_start', { text: 'lines', scroll: 'parallax' }),
              }
            : s,
        );
        break;
      case 'countdown':
        // the date, big, in a band of the template's own hues, the other way round (dark on a light design)
        sections.push({
          id: 'when',
          type: 'when',
          enabled: true,
          animation: motion('zoom', { text: 'letters' }),
          themeOverrides: { palette: bandPalette(manifest.tokens.palette) },
          data: {
            title: t({ he: 'מתי', en: 'When' }),
            showWeekday: true,
            showHebrewDate: true,
            showTime: true,
            countdown: true,
            showCalendar: true,
            note: null,
          },
        });
        sections.push({
          id: 'parents',
          type: 'parents',
          enabled: true,
          layout: 'split_end',
          media: picture('cine-bokeh.jpg'),
          animation: motion('rise', { scroll: 'ken_burns' }),
          data: {
            title: t({ he: 'ההורים', en: 'With our parents' }),
            items: [
              {
                id: 'p1',
                label: t({ he: 'הורי הכלה', en: "The bride's parents" }),
                names: t({ he: 'רחל ומשה כהן', en: 'Rachel & Moshe Cohen' }),
              },
              {
                id: 'p2',
                label: t({ he: 'הורי החתן', en: "The groom's parents" }),
                names: t({ he: 'שרה ודוד לוי', en: 'Sarah & David Levi' }),
              },
            ],
            note: null,
          },
        });
        break;
      case 'venues':
        // one place, told big, over its picture drifting slower than the page
        if (firstVenue)
          sections.push({
            id: 'where',
            type: 'where',
            enabled: true,
            layout: 'parallax',
            media: picture('cine-venue.jpg', 0.5, 0.7),
            animation: motion('rise', { scroll: 'parallax' }),
            data: {
              venue: firstVenue,
              note: t({ he: 'חניה חינם במקום', en: 'Free parking on site' }),
            },
          });
        else sections.push(s);
        // and a dance floor of moving light
        sections.push({
          id: 'dance',
          type: 'custom',
          enabled: true,
          layout: 'video_bg',
          media: {
            kind: 'video',
            src: 'upload:cine-loop.webm',
            poster: 'upload:cine-loop-poster.jpg',
            focalPoint: { x: 0.5, y: 0.5 },
            overlay: 0.3,
          },
          animation: motion('zoom_out', { text: 'words' }),
          data: {
            title: t({ he: 'רוקדים עד הבוקר', en: 'Dance till dawn' }),
            subtitle: t({ he: 'מסיבה אחרי החופה', en: 'The party after the ceremony' }),
            body: t({
              he: 'הדי־ג׳יי מחכה, הרחבה מוכנה — רק חסרים אתם.',
              en: 'The DJ is waiting and the floor is ready — all that is missing is you.',
            }),
            cta: null,
          },
        });
        break;
      case 'timeline':
        sections.push({ ...s, animation: motion('tilt', { stagger: 110 }) });
        break;
      case 'rsvp':
        sections.push({ ...s, animation: motion('rise') });
        break;
      case 'footer':
        sections.push({
          id: 'candles',
          type: 'custom',
          enabled: true,
          layout: 'stack',
          media: picture(
            'cine-candles.jpg',
            0.5,
            0.55,
            t({ he: 'נרות על שולחן ארוך', en: 'Candles on a long table' }),
          ),
          animation: motion('rise', { scroll: 'ken_burns' }),
          data: {
            title: t({ he: 'ערב אחד, לכל החיים', en: 'One evening, for a lifetime' }),
            subtitle: null,
            body: {},
            cta: null,
          },
        });
        sections.push({
          ...s,
          layout: 'full_bleed',
          media: picture('cine-sunset.jpg', 0.5, 0.8),
          animation: motion('fade', { scroll: 'ken_burns' }),
        });
        break;
      default:
        sections.push(s);
    }
    sections.push(...(extra[s.type] ?? []));
  }
  return {
    ...doc,
    share: { ...doc.share, slug: `cinematic-${templateId}` },
    cover: { ...doc.cover, opening },
    sections: sections.filter((s) => !(s.type === 'venues' && firstVenue)),
  };
}
