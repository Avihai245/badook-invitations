import { Suspense, type CSSProperties } from 'react';
import type { Locale } from '../contracts/types';
import { t as translate, type DictKey } from '../i18n/dictionary';
import type { RenderContext } from './context-core';
import { CoverOverlay } from './cover/CoverOverlay.client';
import { variantsOf } from './cover/localized';
import { resolveOpening, type Opening } from './cover/opening';
import { FitNames } from './FitNames.client';
import type { ListenProps, ListenTrack } from '@/features/voice/ui/Listen.client';
import { FloatingControls, type MusicProps } from './FloatingControls.client';
import { nativeName } from '../lib/locales';
import type { MotionLabels } from './MotionPause.client';
import { fxTheme } from './fx/theme';
import { imageAt, imageSet } from './images';
import { InvitationSections } from './InvitationSections';
import { GuestLink } from './guest.client';
import { Insights } from './Insights.client';
import { LiveLocale } from './live/LiveLocale.client';
import type { LivePayload } from './live/payload';
import { ScrollEngine } from './motion/ScrollEngine.client';
import { SceneBackdrop } from './scene/SceneBackdrop';
import { SceneCta } from './scene/SceneCta.client';
import { SceneDriver } from './scene/SceneDriver.client';
import { PROPS } from './scene/props';
import { Scene } from './scenes';
import { resolvePalette } from './theme';
import { endOfDayUtc } from '../lib/dates';

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
  gatefold: 'cover.hint.gatefold',
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
 * The scroll scene's tones on the invitation (renderer/scene): the gradient's dark, the texts' light,
 * the titles' tracking — and, around the desktop's phone frame, its first picture blurred.
 */
function sceneVars(ctx: RenderContext): CSSProperties | undefined {
  const scene = ctx.scene;
  if (!scene) return undefined;
  const first = scene.layers[0]?.picture;
  return {
    '--sc-shade': scene.shade,
    '--sc-text': scene.text,
    '--sc-track': `${scene.tracking}em`,
    ...(first ? { '--sc-desk': `url("${imageAt(first.fallback ?? first.src, 640)}")` } : {}),
  } as CSSProperties;
}

/** The scene's "RSVP" button: while the event takes replies (none after the deadline, none in the editor). */
function sceneRsvp(ctx: RenderContext): boolean {
  if (!ctx.scene || ctx.mode === 'editor') return false;
  if (!ctx.doc.sections.some((s) => s.type === 'rsvp' && s.enabled)) return false;
  const deadline = ctx.doc.event.rsvpDeadline;
  return !deadline || ctx.now <= endOfDayUtc(deadline, ctx.doc.timezone).getTime();
}

/**
 * The single renderer body used by the public page, the preview link, the editor preview frame and
 * the kitchen sink (§5 — the same renderer everywhere). Section order = document order. As a scroll
 * scene (renderer/scene) the sections scroll over a pinned backdrop: `.sc-frame` (the phone frame on
 * a computer) › `.sc-scroll` (the frame's scroll container there; a plain box on a phone, where the
 * page scrolls) › `.sc-track` (the backdrop, sticky, and the sections over it).
 */
export function InvitationBody({
  ctx,
  showCover,
  skipCoverFromUrl = false,
  langHrefs,
  live = null,
  voice = null,
}: {
  ctx: RenderContext;
  /** false with `?open=1`, in the editor/preview frame and for OG screenshots */
  showCover: boolean;
  /**
   * Cached pages (/i/[slug]) can't read the query on the server: render the cover, and let an inline
   * script skip it before the first paint when the URL has `?open=1`.
   */
  skipCoverFromUrl?: boolean;
  /**
   * The invitation's address in each locale — the language control's plain links (null: no control,
   * e.g. the editor's preview)
   */
  langHrefs: Partial<Record<Locale, string>> | null;
  /**
   * The public page in several languages: the language control switches in place (LiveLocale)
   * instead of following `langHrefs`.
   */
  live?: LivePayload | null;
  /**
   * The invitation read aloud (features/voice): each language's audio or words — the page's "listen".
   * null: the event doesn't have it.
   */
  voice?: Partial<Record<Locale, ListenTrack>> | null;
}) {
  const { doc, template } = ctx;
  const coverOn = showCover && doc.cover.enabled && ctx.mode === 'live';
  const opening = coverOn
    ? resolveOpening(template, doc, resolvePalette(template, doc), ctx.cinematic)
    : null;
  const fx = fxTheme(template, doc);
  // the public page in several languages may change its language before React takes over (the
  // guest's browser speaks another one — LiveLocale): its cover carries its texts in each of them
  const coverLocales: readonly Locale[] = live && doc.locales.length > 1 ? doc.locales : [ctx.locale];
  const perLocale = (text: (l: Locale) => string) => variantsOf(coverLocales, text);
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

  // "pause the animations" (WCAG 2.2.2) on the guest's page; the review page has it in its toolbar
  const motionIn = (l: Locale): MotionLabels | null =>
    ctx.mode === 'live' && !ctx.review
      ? { pause: translate(l, 'motion.pause'), play: translate(l, 'motion.play') }
      : null;
  const listenIn = (l: Locale): ListenProps | null => {
    const track = ctx.mode === 'live' && !ctx.review ? voice?.[l] : undefined;
    return track
      ? { track, listenLabel: translate(l, 'voice.listen'), stopLabel: translate(l, 'voice.stop') }
      : null;
  };

  // Suspense boundaries contain any suspension while hydrating (a client chunk still loading on a
  // slow first visit): without them React replays the root with a stale hydration cursor and
  // regenerates the whole document (React #418), losing the pre-hydration state on <html>/<body>. The
  // server renders everything (nothing suspends there). Two of them, the cover first: React streams a
  // boundary that would make the page's first bytes too long (the shell and the boundaries before it
  // over ~12.8 KB) separately, and reveals it only a moment after the first paint (≥ 300 ms, React
  // 19.2) — moving it into place, which restarts its CSS animations. So the cover, small for most
  // designs, comes with the shell and paints at once; the sections under it follow.
  const scene = ctx.scene;
  const page = (
    <>
      {live && doc.locales.length > 1 ? (
        <LiveLocale
          initial={ctx.locale}
          payload={live}
          music={music}
          listen={Object.fromEntries(doc.locales.map((l) => [l, listenIn(l)]))}
          motion={Object.fromEntries(doc.locales.map((l) => [l, motionIn(l)]))}
        >
          <InvitationSections ctx={ctx} />
        </LiveLocale>
      ) : (
        <>
          <FloatingControls
            language={
              doc.locales.length > 1 && langHrefs
                ? {
                    current: ctx.locale,
                    menuLabel: ctx.t('locale.menu'),
                    options: doc.locales.map((l) => ({
                      locale: l,
                      label: nativeName(l),
                      href: langHrefs[l] ?? '',
                    })),
                  }
                : null
            }
            music={music}
            listen={listenIn(ctx.locale)}
            motion={motionIn(ctx.locale)}
          />
          <InvitationSections ctx={ctx} />
        </>
      )}
      <ScrollEngine />
      <FitNames />
      {/* a guest's personal link — never on the review link's draft (nobody is identified there) */}
      {ctx.mode === 'live' && !ctx.review ? <GuestLink slug={doc.share.slug} /> : null}
      {/* how guests use the invitation (feature analytics): fetched once the page is interactive —
          never on the review link's draft (nobody is counted there) */}
      {ctx.mode === 'live' && ctx.insights && !ctx.review ? <Insights slug={doc.share.slug} /> : null}
    </>
  );
  return (
    <div className="inv" data-mode={ctx.mode} data-film={scene ? '' : undefined} style={sceneVars(ctx)}>
      {coverOn ? (
        <script dangerouslySetInnerHTML={{ __html: skipCoverFromUrl ? SKIP_OR_LOCK : LOCK }} />
      ) : (
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.opened='1'" }} />
      )}
      {coverOn ? (
        <Suspense fallback={null}>
          <CoverOverlay
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
            monogram={perLocale((l) => ctx.textIn(doc.cover.monogram, l))}
            hint={perLocale(
              (l) =>
                ctx.textIn(doc.cover.hint, l) ||
                translate(l, opening ? OPENING_HINT[opening.preset] : 'cover.hint'),
            )}
            skipLabel={perLocale((l) => translate(l, 'cover.skip'))}
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
            scrollLabel={perLocale((l) => translate(l, 'cover.scroll'))}
            backdrop={opening?.backdrop ? heroBackdrop(ctx) : null}
          />
        </Suspense>
      ) : null}
      {scene ? (
        <div className="sc-frame">
          {/* the frame's own scroll container on a computer (focusable: the keyboard scrolls it) */}
          <div className="sc-scroll" tabIndex={-1}>
            <div className="sc-track">
              {/* the backdrop comes with the shell: its first picture paints with the first frame, the
                  sections come in over it */}
              <SceneBackdrop ctx={ctx} scene={scene} />
              <Suspense fallback={null}>
                {page}
                {sceneRsvp(ctx) ? <SceneCta label={perLocale((l) => translate(l, 'scene.rsvp'))} /> : null}
                {/* the finale's own stage (the tefillin coming to rest on the boy's head): nothing over it */}
                {scene.prop && PROPS[scene.prop].stage ? (
                  <div
                    className="sc-stage"
                    aria-hidden="true"
                    style={{ '--sc-stage': PROPS[scene.prop].stage } as CSSProperties}
                  />
                ) : null}
                {/* the very end of the film: where a prop arrives at its target (PropFinale) */}
                {scene.prop ? <div className="sc-end" aria-hidden="true" /> : null}
                <SceneDriver />
              </Suspense>
            </div>
          </div>
        </div>
      ) : (
        <Suspense fallback={null}>{page}</Suspense>
      )}
    </div>
  );
}
