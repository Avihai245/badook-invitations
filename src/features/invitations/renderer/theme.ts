import type { FontPair, InvitationDocument, Locale, Palette, TemplateManifest } from '../contracts/types';
import { headingColor, isDarkPalette, readableAccent } from '../lib/contrast';
import { displayEmPerChar, fontStack, monogramStack } from '../fonts';
import { findFontPair } from '../fonts/library';
import { placeholderArt, placeholderScrim } from './placeholders';

/** Template palette + the host's overrides, restricted to template.editablePaletteKeys. */
export function resolvePalette(template: TemplateManifest, doc: Pick<InvitationDocument, 'theme'>): Palette {
  const palette = { ...template.tokens.palette };
  const editable = new Set(template.tokens.editablePaletteKeys);
  for (const [key, value] of Object.entries(doc.theme.palette ?? {})) {
    if (value && editable.has(key as keyof Palette)) palette[key as keyof Palette] = value;
  }
  return palette;
}

/** The document's font pair — one of the template's own or one from the font library — else the default. */
export function resolveFontPair(
  template: TemplateManifest,
  doc: Pick<InvitationDocument, 'theme'>,
): FontPair {
  return findFontPair(template, doc.theme.fontPairId) ?? template.fontPairs[0]!;
}

/**
 * palette → CSS variables (§5 Theming). Components only use these variables — no hard-coded colors.
 * Applied as the style of <html> by the invitation root layout.
 */
export function themeVars(
  template: TemplateManifest,
  doc: Pick<InvitationDocument, 'theme' | 'cover'>,
  locale: Locale,
): Record<string, string> {
  const palette = resolvePalette(template, doc);
  const pair = resolveFontPair(template, doc);
  const dark = isDarkPalette(palette);
  const art = placeholderArt(template.id);
  return {
    '--inv-bg': palette.bg,
    '--inv-surface': palette.surface,
    '--inv-ink': palette.ink,
    '--inv-ink-muted': palette.inkMuted,
    '--inv-accent': palette.accent,
    '--inv-accent-ink': palette.accentInk,
    '--inv-line': palette.line,
    '--inv-hero-text': palette.heroText,
    '--inv-heading': headingColor(palette),
    '--inv-accent-text': readableAccent(palette),
    '--inv-danger': dark ? '#FF8A80' : '#B3261E',
    '--inv-seal': doc.cover.sealColor ?? template.cover.sealColors[0] ?? palette.accent,
    '--inv-field': dark ? palette.bg : '#FFFFFF',
    '--inv-popover': dark ? palette.surface : '#FFFFFF',
    '--hero-overlay': template.hero.overlayColor,
    '--r-card': `${template.tokens.radius.card}px`,
    '--r-btn': `${template.tokens.radius.button}px`,
    '--f-display': fontStack(pair, 'display', locale),
    '--f-heading': fontStack(pair, 'heading', locale),
    '--f-body': fontStack(pair, 'body', locale),
    '--f-ui': fontStack(pair, 'ui', locale),
    '--f-monogram': monogramStack(template, locale),
    '--name-em': String(displayEmPerChar(pair, locale)),
    '--reveal-distance': `${template.motion.preset === 'none' ? 0 : template.motion.revealDistance}px`,
    '--reveal-blur': template.motion.revealBlur && template.motion.preset !== 'none' ? '6px' : '0px',
    '--reveal-stagger': `${Math.round(template.motion.stagger * 1000)}ms`,
    // placeholder art (only visible while media is missing)
    '--hero-sky': art.sky,
    '--hero-scrim': placeholderScrim(art),
    '--cloud': art.cloud,
    '--cv-1': art.cover.bg[0],
    '--cv-2': art.cover.bg[1],
    '--cv-3': art.cover.bg[2],
    '--env-1': art.cover.envelope[0],
    '--env-2': art.cover.envelope[1],
    '--pocket-1': art.cover.pocket[0],
    '--pocket-2': art.cover.pocket[1],
    '--flap-1': art.cover.flap[0],
    '--flap-2': art.cover.flap[1],
    '--env-card': art.cover.card,
    '--cover-hint': art.cover.hint,
    ...(art.cover.ticket
      ? { '--ticket-paper': art.cover.ticket.paper, '--ticket-edge': art.cover.ticket.edge }
      : null),
  };
}

export function themeMode(
  template: TemplateManifest,
  doc: Pick<InvitationDocument, 'theme'>,
): 'light' | 'dark' {
  return isDarkPalette(resolvePalette(template, doc)) ? 'dark' : 'light';
}
