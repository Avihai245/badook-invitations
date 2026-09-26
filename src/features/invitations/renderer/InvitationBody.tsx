import { Suspense } from 'react';
import type { Locale } from '../contracts/types';
import type { DictKey } from '../i18n/dictionary';
import type { RenderContext } from './context-core';
import { CoverOverlay } from './cover/CoverOverlay.client';
import { resolveOpening, type Opening } from './cover/opening';
import { FitNames } from './FitNames.client';
import { FloatingControls, type MusicProps } from './FloatingControls.client';
import { fxTheme } from './fx/theme';
import { imageSet } from './images';
import { InvitationSections } from './InvitationSections';
import { GuestLink } from './guest.client';
import { LiveLocale } from './live/LiveLocale.client';
import type { LivePayload } from './live/payload';
import { ScrollEngine } from './motion/ScrollEngine.client';
import { Scene } from './scenes';
import { resolvePalette } from './theme';

/**
 * A tap on the cover before React has taken over (its scripts still loading on a slow connection)
 * would be lost — and the music with it. This starts the music inside that very gesture (iOS allows
 * audio only there, with a 1.5s fade): the track, or the hero video's sound (`data-sound`; <html
 * data-video-sound="on"> says so — never an attribute on the video, which React is about to hydrate).
 * It leaves `data-pending-open` on <html> for CoverOverlay, which opens the cover once it is hydrated,
 * and stands down as soon as the cover is (`data-cover-ready`).
 */
const EARLY_TAP =
  '(function(){var r=document.documentElement;' +
  "function off(){document.removeEventListener('click',on,true)}" +
  'function on(e){if(r.dataset.coverReady)return off();var t=e.target;if(!t||!t.closest)return;' +
  "var s=t.closest('.cover-skip');if(!s&&!t.closest('.cover-tap'))return;" +
  "r.dataset.pendingOpen=s?'skip':'tap';off();" +
  "var m=document.querySelector('audio.inv-music')||document.querySelector('.hero-media video[data-sound]');" +
  "if(!m||(m.localName==='audio'?!m.paused:!m.muted&&!m.paused))return;" +
  "try{var v=Number(m.dataset.volume);if(!(v>=0&&v<=1))v=1;if(m.localName==='video'){m.muted=false;r.dataset.videoSound='on'}" +
  'var p=m.play();if(p&&p.catch)p.catch(function(){});' +
  'm.volume=0;var t0=Date.now(),i=setInterval(function(){var k=Math.min(1,(Date.now()-t0)/1500);' +
  'm.volume=v*k;if(k>=1)clearInterval(i)},50)}catch(_){}}' +
  "document.addEventListener('click',on,true)})()";
const LOCK = "document.body.classList.add('locked');" + EARLY_TAP;
const SKIP_OR_LOCK =
  "if(new URLSearchParams(location.search).get('open')==='1'){var d=document.documentElement.dataset;d.opened='1';d.coverSkipped='1'}else{" +
  LOCK +
  '}';

/**
 * A cinematic opening's own call to action — when the host wrote none (the template's seeded hint
 * speaks of its own cover: "tap to open the envelope").
 */
const OPENING_HINT = {
  gate: 'cover.hint.gate',
  curtain: 'cover.hint.curtain',
  fireworks: 'cover.hint.fireworks',
  gold_dust: 'cover.hint.gold_dust',
} as const satisfies Record<Opening['preset'], DictKey>;

/**
 * A photo-led opening's picture: the hero's still (its photo, or its video's poster) in the hero's
 * own image set — one download for both — at its focal point. null without one.
 */
function heroBackdrop(ctx: RenderContext) {
  const hero = ctx.doc.sections.find((s) => s.type === 'hero' && s.enabled);
  if (hero?.type !== 'hero') return null;
  const m = hero.data.media;
  const url = m.kind === 'image' ? ctx.asset(m.src) : ctx.asset(m.poster);
  if (!url) return null;
  return {
    ...imageSet(url, '100vw'),
    position: `${m.focalPoint.x * 100}% ${m.focalPoint.y * 100}%`,
  };
}

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
  const opening = coverOn
    ? resolveOpening(template, doc, resolvePalette(template, doc), ctx.cinematic)
    : null;
  const fx = fxTheme(template, doc);
  const nextLocale = doc.locales[(doc.locales.indexOf(ctx.locale) + 1) % doc.locales.length] as Locale;
  // the host's "video sound" option: the hero video's own sound instead of the track (HeroMedia)
  const hero = doc.sections.find((s) => s.type === 'hero');
  const videoSound =
    doc.music.enabled && doc.music.videoSound && hero?.type === 'hero' && hero.data.media.kind === 'video';
  const music: MusicProps | null =
    ctx.mode === 'live' && (videoSound || ctx.musicUrl)
      ? {
          src: videoSound ? null : ctx.musicUrl,
          volume: doc.music.volume,
          startAtSec: doc.music.startAtSec,
          playLabel: ctx.t('music.play'),
          pauseLabel: ctx.t('music.pause'),
        }
      : null;

  // Suspense boundaries contain any suspension while hydrating (a client chunk still loading on a
  // slow first visit): without them React replays the root with a stale hydration cursor and
  // regenerates the whole document (React #418), losing the pre-hydration state on <html>/<body>. The
  // server renders everything (nothing suspends there). Two of them, the cover first: React streams a
  // boundary that would make the page's first bytes too long (the shell and the boundaries before it
  // over ~12.8 KB) separately, and reveals it only a moment after the first paint (≥ 300 ms, React
  // 19.2) — moving it into place, which restarts its CSS animations. So the cover, small for most
  // designs, comes with the shell and paints at once; the sections under it follow.
  return (
    <div className="inv" data-mode={ctx.mode}>
      {coverOn ? (
        <script dangerouslySetInnerHTML={{ __html: skipCoverFromUrl ? SKIP_OR_LOCK : LOCK }} />
      ) : (
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.opened='1'" }} />
      )}
      {coverOn ? (
        <Suspense fallback={null}>
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
            hint={ctx.text(doc.cover.hint) || ctx.t(opening ? OPENING_HINT[opening.preset] : 'cover.hint')}
            skipLabel={ctx.t('cover.skip')}
            skipFromUrl={skipCoverFromUrl}
            card={
              // a drawn design's scene (a large drawing) streams after the cover: it is on the card inside
              // the closed envelope, and the cover itself stays small enough to come with the first bytes.
              // A cinematic opening draws no card.
              ctx.art.scene && !opening ? (
                <Suspense fallback={null}>
                  <Scene id={ctx.art.scene} place="card" date={doc.event.date} />
                </Suspense>
              ) : undefined
            }
            fx={{ burst: fx.burst, colors: fx.burstColors }}
            opening={opening}
            scrollLabel={ctx.t('cover.scroll')}
            backdrop={opening?.backdrop ? heroBackdrop(ctx) : null}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
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
        <ScrollEngine />
        <FitNames />
        {ctx.mode === 'live' ? <GuestLink slug={doc.share.slug} /> : null}
      </Suspense>
    </div>
  );
}
