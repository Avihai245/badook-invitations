import type { CSSProperties, ReactNode } from 'react';
import { dirOf, type InvitationDocument, type Locale, type TemplateManifest } from '../contracts/types';
import { displayFontPreloads, fontFaceCss, pageFontFaces } from '../fonts';
import { scriptsOf } from '../lib/locales';
import { FrameScrollCue } from './FrameScrollCue.client';
import { FRAMED_BOOT } from './framed';
import { IMAGE_FALLBACK } from './images';
import { bootLocaleScript, type BootConfig } from './live/detect';
import { resolveFontPair, themeMode, themeVars } from './theme';

/**
 * The invitation document root (<html>/<head>/<body>) — used by every invitation root layout
 * (public page, preview frame, kitchen sink). Tokens, lang and dir are set server-side on <html>,
 * so the first paint is already correct; only the fonts this template can use are declared — in the
 * scripts of the invitation's languages (a Russian, Arabic or Amharic invitation adds its script's
 * faces; the browser downloads a face only for text that needs it).
 */
export function InvitationHtml({
  doc,
  template,
  locale,
  boot = null,
  children,
}: {
  doc: InvitationDocument;
  template: TemplateManifest;
  locale: Locale;
  /**
   * The public page in several languages: the guest's language is picked in the browser before the
   * first paint (live/detect.ts) — the cached page itself is always the default language's.
   */
  boot?: BootConfig | null;
  children: ReactNode;
}) {
  const pair = resolveFontPair(template, doc);
  const fontCss = fontFaceCss(pageFontFaces(template, pair.id, doc.locales));
  const scripts = scriptsOf(doc.locales).sort().join('-');
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
        {boot ? <script dangerouslySetInnerHTML={{ __html: bootLocaleScript(boot) }} /> : null}
        {displayFontPreloads(pair, locale).map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
        {/* A style resource (href + precedence): React writes it into the head by itself, outside the
            page's shell — which stays small enough for the cover to arrive with the first bytes
            (InvitationBody: a shell over ~12.8 KB streams every boundary separately, revealed later). */}
        <style
          href={`invitation-fonts-${template.id}-${pair.id}-${scripts}`}
          precedence="invitation-fonts"
          dangerouslySetInnerHTML={{ __html: fontCss }}
        />
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
