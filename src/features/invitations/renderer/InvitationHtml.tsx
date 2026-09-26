import type { CSSProperties, ReactNode } from 'react';
import { dirOf, type InvitationDocument, type Locale, type TemplateManifest } from '../contracts/types';
import { displayFontPreloads, fontFaceCss, templateFontFamilies } from '../fonts';
import { FrameScrollCue } from './FrameScrollCue.client';
import { FRAMED_BOOT } from './framed';
import { IMAGE_FALLBACK } from './images';
import { resolveFontPair, themeMode, themeVars } from './theme';

/**
 * The invitation document root (<html>/<head>/<body>) — used by every invitation root layout
 * (public page, preview frame, kitchen sink). Tokens, lang and dir are set server-side on <html>,
 * so the first paint is already correct; only the fonts this template can use are declared.
 */
export function InvitationHtml({
  doc,
  template,
  locale,
  children,
}: {
  doc: InvitationDocument;
  template: TemplateManifest;
  locale: Locale;
  children: ReactNode;
}) {
  const pair = resolveFontPair(template, doc);
  const fontCss = fontFaceCss(templateFontFamilies(template, pair.id));
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-theme={themeMode(template, doc)}
      data-template={template.id}
      className="no-js"
      style={themeVars(template, doc, locale) as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        {displayFontPreloads(pair, locale).map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: fontCss }} />
        {/* Reveal animations only when JS runs — without it everything stays visible. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.remove('no-js')" }} />
        {/* an optimized image that fails falls back to its original address (renderer/images.ts) */}
        <script dangerouslySetInnerHTML={{ __html: IMAGE_FALLBACK }} />
        {/* inside another page's frame: no scrollbar, a floating arrow instead (FrameScrollCue) */}
        <script dangerouslySetInnerHTML={{ __html: FRAMED_BOOT }} />
      </head>
      {/* the cover locks scroll before hydration (body.locked) — expected attribute difference */}
      <body suppressHydrationWarning>
        {children}
        <FrameScrollCue />
      </body>
    </html>
  );
}
