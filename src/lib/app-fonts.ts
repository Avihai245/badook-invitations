import fonts from '@/styles/app-fonts.generated.json';

/**
 * A file of the host app's variable text fonts — "Heebo Variable" (Hebrew UI) and "Inter Variable"
 * (English) — by script subset ('hebrew', 'latin', …): its woff2 under /fonts, for the layout's preloads
 * (scripts/build-fonts.mjs writes the list). null when the build has no such face.
 */
export function appFaceUrl(family: 'Heebo Variable' | 'Inter Variable', subset: string): string | null {
  return (fonts.variable as Record<string, Record<string, string>>)[family]?.[subset] ?? null;
}

/**
 * A display face with Hebrew and the ASCII letters and digits in one file ("Frank Ruhl Libre" at a weight the
 * app uses): its woff2 under /fonts, for the layout's preload. null when the build has none.
 */
export function appStaticFaceUrl(family: 'Frank Ruhl Libre', weight: number): string | null {
  return (fonts.static as Record<string, Record<string, string>>)[family]?.[String(weight)] ?? null;
}
