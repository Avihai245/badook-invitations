import {
  PALETTE_KEYS,
  TYPE_ROLES,
  type FontPair,
  type InvitationDocument,
  type Locale,
  type Palette,
  type TemplateManifest,
  type ThemeOverrides,
} from '../contracts/types';
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

/** The color variables of a palette (and those derived from it: headings, accent text, fields…). */
function paletteVars(palette: Palette, sealFallback: string): Record<string, string> {
  const dark = isDarkPalette(palette);
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
    '--inv-seal': sealFallback,
    '--inv-field': dark ? palette.bg : '#FFFFFF',
    '--inv-popover': dark ? palette.surface : '#FFFFFF',
  };
}

/**
 * Tokens v2 → CSS variables: the type scale (`--ty-<role>` size ×, `--lh-<role>` line height ×,
 * `--ls-<role>` Latin tracking added), the spacing (`--sp-section|gutter|block` ×), the media radius,
 * the scrim over section media and the motion intensity. invitation.css multiplies the design's own
 * values by them — at their defaults (1 / 1 / 0) every template looks exactly as before.
 */
function tokenVars(
  typography: TemplateManifest['tokens']['typography'],
  spacing: TemplateManifest['tokens']['spacing'],
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const role of TYPE_ROLES) {
    const r = typography[role];
    vars[`--ty-${role}`] = String(r.size);
    vars[`--lh-${role}`] = String(r.lineHeight);
    vars[`--ls-${role}`] = `${r.letterSpacing}em`;
  }
  vars['--sp-section'] = String(spacing.section);
  vars['--sp-gutter'] = String(spacing.gutter);
  vars['--sp-block'] = String(spacing.block);
  return vars;
}

/** The scrim over section media that text sits on (tokens.overlay; else the hero's overlay color). */
export function scrimOf(template: TemplateManifest): { color: string; opacity: number } {
  return {
    color: template.tokens.overlay.color ?? template.hero.overlayColor,
    opacity: template.tokens.overlay.opacity ?? 0.42,
  };
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
  const art = placeholderArt(template.id);
  const calm = template.motion.preset === 'none';
  const scrim = scrimOf(template);
  return {
    ...paletteVars(palette, doc.cover.sealColor ?? template.cover.sealColors[0] ?? palette.accent),
    '--hero-overlay': template.hero.overlayColor,
    '--r-card': `${template.tokens.radius.card}px`,
    '--r-btn': `${template.tokens.radius.button}px`,
    '--r-media': `${template.tokens.radius.media ?? template.tokens.radius.card}px`,
    '--f-display': fontStack(pair, 'display', locale),
    '--f-heading': fontStack(pair, 'heading', locale),
    '--f-body': fontStack(pair, 'body', locale),
    '--f-ui': fontStack(pair, 'ui', locale),
    '--f-monogram': monogramStack(template, locale),
    '--name-em': String(displayEmPerChar(pair, locale)),
    '--reveal-distance': `${calm ? 0 : Math.round(template.motion.revealDistance * template.motion.intensity)}px`,
    '--reveal-blur': template.motion.revealBlur && !calm ? '6px' : '0px',
    '--reveal-stagger': `${Math.round(template.motion.stagger * 1000)}ms`,
    '--motion-intensity': String(calm ? 0 : template.motion.intensity),
    ...tokenVars(template.tokens.typography, template.tokens.spacing),
    '--scrim': scrim.color,
    '--scrim-a': String(scrim.opacity),
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

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * A section's own tokens (v2 `themeOverrides`) as CSS variables on its wrapper — only what it changes;
 * the rest is inherited from <html>. A palette override brings its derived colors along (heading,
 * accent text, fields…) and a theme of its own (`dark`: null when the palette is unchanged).
 */
export function sectionThemeVars(
  template: TemplateManifest,
  doc: Pick<InvitationDocument, 'theme' | 'cover'>,
  overrides: ThemeOverrides,
): { vars: Record<string, string>; dark: boolean | null } {
  const vars: Record<string, string> = {};
  let dark: boolean | null = null;
  const own: Partial<Palette> = {};
  for (const key of PALETTE_KEYS) {
    const value = overrides.palette?.[key];
    if (value && HEX.test(value)) own[key] = value;
  }
  if (Object.keys(own).length) {
    const palette = { ...resolvePalette(template, doc), ...own };
    dark = isDarkPalette(palette);
    const { '--inv-seal': _seal, ...colors } = paletteVars(palette, palette.accent);
    Object.assign(vars, colors);
  }
  const r = overrides.radius;
  if (r?.card !== undefined) vars['--r-card'] = `${r.card}px`;
  if (r?.button !== undefined) vars['--r-btn'] = `${r.button}px`;
  if (r?.media !== undefined) vars['--r-media'] = `${r.media}px`;
  // the same meaning as the template's tokens (× the design's base), replacing them in this section
  for (const role of TYPE_ROLES) {
    const t = overrides.typography?.[role];
    if (t?.size !== undefined) vars[`--ty-${role}`] = String(t.size);
    if (t?.lineHeight !== undefined) vars[`--lh-${role}`] = String(t.lineHeight);
    if (t?.letterSpacing !== undefined) vars[`--ls-${role}`] = `${t.letterSpacing}em`;
  }
  const s = overrides.spacing;
  if (s?.section !== undefined) vars['--sp-section'] = String(s.section);
  if (s?.gutter !== undefined) vars['--sp-gutter'] = String(s.gutter);
  if (s?.block !== undefined) vars['--sp-block'] = String(s.block);
  return { vars, dark };
}
