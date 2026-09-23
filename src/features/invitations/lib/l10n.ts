import type { L10n, Locale } from '../contracts/types';

export const TEXT_TOKENS = ['primary', 'secondary', 'date', 'hebrewDate', 'deadline'] as const;
export type TextToken = (typeof TEXT_TOKENS)[number];
export type TokenValues = Partial<Record<TextToken, string>>;

const TOKEN_RE = /\{(primary|secondary|date|hebrewDate|deadline)\}/g;

/** Replaces the live text tokens; unknown tokens (and tokens without a value) render verbatim. */
export function interpolate(text: string, values: TokenValues): string {
  return text.replace(TOKEN_RE, (match, key: TextToken) => values[key] ?? match);
}

/** Length of a user string for caps: each token counts as 12 characters (§3 live text tokens). */
export function cappedLength(text: string): number {
  return text.replace(TOKEN_RE, 'x'.repeat(12)).length;
}

export function localize(value: L10n | null | undefined, locale: Locale): string {
  return value?.[locale] ?? '';
}
