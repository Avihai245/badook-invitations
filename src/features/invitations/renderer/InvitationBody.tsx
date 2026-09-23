import { Suspense } from 'react';
import type { Locale } from '../contracts/types';
import type { RenderContext } from './context-core';
import { CoverOverlay } from './cover/CoverOverlay.client';
import { FitNames } from './FitNames.client';
import { FloatingControls, type MusicProps } from './FloatingControls.client';
import { InvitationSections } from './InvitationSections';
import { LiveLocale } from './live/LiveLocale.client';
import type { LivePayload } from './live/payload';
import { RevealObserver } from './RevealObserver.client';

const LOCK = "document.body.classList.add('locked')";
const SKIP_OR_LOCK =
  "if(new URLSearchParams(location.search).get('open')==='1'){var d=document.documentElement.dataset;d.opened='1';d.coverSkipped='1'}else{" +
  LOCK +
  '}';

/**
 * The single renderer body used by the public page, the preview link, the editor preview frame and
 * the kitchen sink (§5 — the same renderer everywhere). Section order = document order.
 */
export function InvitationBody({
  ctx,
  showCover,
  skipCoverFromUrl = false,
  langSwitchHref,
  live = null,
}: {
  ctx: RenderContext;
  /** false with `?open=1`, in the editor/preview frame and for OG screenshots */
  showCover: boolean;
  /**
   * Cached pages (/i/[slug]) can't read the query on the server: render the cover, and let an inline
   * script skip it before the first paint when the URL has `?open=1`.
   */
  skipCoverFromUrl?: boolean;
  /** URL of the same invitation in the next locale (null when there is only one locale) */
  langSwitchHref: string | null;
  /**
   * Bilingual public page: the language pill switches in place (LiveLocale) instead of following
   * `langSwitchHref`.
   */
  live?: LivePayload | null;
}) {
  const { doc, template } = ctx;
  const coverOn = showCover && doc.cover.enabled && ctx.mode === 'live';
  const nextLocale = doc.locales[(doc.locales.indexOf(ctx.locale) + 1) % doc.locales.length] as Locale;
  const music: MusicProps | null =
    ctx.mode === 'live' && ctx.musicUrl
      ? {
          src: ctx.musicUrl,
          volume: doc.music.volume,
          startAtSec: doc.music.startAtSec,
          playLabel: ctx.t('music.play'),
          pauseLabel: ctx.t('music.pause'),
        }
      : null;

  // The Suspense boundary contains any suspension while hydrating (a client chunk still loading on a
  // slow first visit): without it React replays the root with a stale hydration cursor and regenerates
  // the whole document (React #418), losing the pre-hydration state on <html>/<body>. The server
  // renders everything (nothing suspends there), so the HTML is unchanged.
  return (
    <Suspense fallback={null}>
      <div className="inv" data-mode={ctx.mode}>
        {coverOn ? (
          <>
            <script dangerouslySetInnerHTML={{ __html: skipCoverFromUrl ? SKIP_OR_LOCK : LOCK }} />
            <CoverOverlay
              locale={ctx.locale}
              style={template.cover.style}
              overlay={{
                kind: template.cover.overlay.kind,
                exit: template.cover.overlay.exit,
                recolor: template.cover.overlay.recolor,
                size: template.cover.overlay.size,
                offset: template.cover.overlay.offset,
                text: template.cover.overlay.text,
              }}
              sealColor={
                template.cover.overlay.recolor
                  ? (doc.cover.sealColor ?? template.cover.sealColors[0] ?? null)
                  : null
              }
              media={ctx.coverMedia}
              monogram={ctx.text(doc.cover.monogram)}
              hint={ctx.text(doc.cover.hint) || ctx.t('cover.hint')}
              skipLabel={ctx.t('cover.skip')}
              skipFromUrl={skipCoverFromUrl}
            />
          </>
        ) : (
          <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.opened='1'" }} />
        )}
        {live && doc.locales.length > 1 ? (
          <LiveLocale initial={ctx.locale} payload={live} music={music}>
            <InvitationSections ctx={ctx} />
          </LiveLocale>
        ) : (
          <>
            <FloatingControls
              langSwitch={
                doc.locales.length > 1 && langSwitchHref
                  ? { href: langSwitchHref, label: ctx.t('locale.switch'), targetLocale: nextLocale }
                  : null
              }
              music={music}
            />
            <InvitationSections ctx={ctx} />
          </>
        )}
        <RevealObserver />
        <FitNames />
      </div>
    </Suspense>
  );
}
