'use client';

import { useEffect } from 'react';
import { motionAllowed } from '../fx/motion';
import type { SceneProp } from '../../contracts/types';
import { FADE_FROM, FADE_TO, SCENE_DRIFT, SCENE_ZOOM } from './model';
import { PROPS, lenPx, poseAt } from './props';
import {
  inPlayMargins,
  layerRanges,
  layerShown,
  layerState,
  type LayerGeometry,
  type LayerRanges,
} from './timeline';

interface Layer extends LayerGeometry {
  el: HTMLElement;
  pic: HTMLElement | null;
  img: HTMLImageElement | null;
  loaded: boolean;
  /** what was last written (nothing is written twice) */
  opacity: string;
  transform: string;
  visible: boolean;
  fading: boolean;
  /** the scroll ranges given to the browser (scroll-driven), as last written */
  ranges: string;
}

/** Load a picture this many screens before its cross-fade begins. */
const LOAD_AHEAD = 2.2;
/** Where the browser plays the backdrop: a picture stays in play this many screens either side of where it is seen. */
const IN_PLAY = 0.5;
const OPTIONS = { from: FADE_FROM, to: FADE_TO, zoom: SCENE_ZOOM, drift: SCENE_DRIFT };
const share = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The scroll scene's driver (renderer/scene): the backdrop follows the guest's scroll.
 *
 * Where the browser has scroll-driven animations (`animation-timeline`), the scroll itself plays the
 * backdrop, off the main thread: the driver measures — when the page's size changes (fonts, pictures,
 * the RSVP card opening), never while it scrolls — where each picture's cross-fade and passage start
 * and end, and hands those scroll positions to the CSS (`--sc-fa`…`--sc-y1` on each `.sc-layer`,
 * `data-scene-css` on the frame); the compositor then fades, zooms and drifts every picture in step
 * with the scroll however busy the page is. Which pictures are in play (shown) and which to load
 * follows from the sections in front of them (IntersectionObservers), so nothing at all runs while the
 * page scrolls. Elsewhere the driver plays the same timeline itself: one passive scroll listener asks
 * for one frame; the frame reads the scroll position and writes each picture's opacity (the
 * cross-fade) and its transform (the Ken Burns zoom, a drift), only where they changed, `will-change`
 * only while a picture is on screen or fading.
 *
 * Either way only transform and opacity move, and a picture covered by the one above it (or not
 * reached yet) is hidden (visibility), so at most two or three are ever composited. The pictures after
 * the first load only as the guest nears them (LOAD_AHEAD screens before their cross-fade), decoded
 * off the main thread before they fade in. With reduced motion (or the host's motion at 0) the
 * pictures only cross-fade — no zoom, no drift.
 *
 * On a phone the page scrolls; in the desktop's phone frame the frame scrolls (`.sc-scroll` is then a
 * scroll container) — the driver follows whichever does, and a wheel over the page around the frame
 * scrolls the frame. The texts' reveal (ScrollEngine: `.reveal` → `.in`) gets its `will-change` just
 * before it plays, and loses it once it has played.
 */
export function SceneDriver() {
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>('.sc-frame');
    const scroller = frame?.querySelector<HTMLElement>('.sc-scroll');
    const track = frame?.querySelector<HTMLElement>('.sc-track');
    if (!frame || !scroller || !track) return;
    const cleanups: (() => void)[] = [];
    let layers: Layer[] = [];
    let ranges: LayerRanges[] = [];
    let inner = false;
    let trackTop = 0;
    let height = window.innerHeight;
    let raf = 0;
    let moving = motionAllowed();
    // the browser plays the backdrop from the scroll (the CSS reads the ranges measured below)
    const css = typeof CSS !== 'undefined' && !!CSS.supports?.('animation-timeline: scroll()');

    // a scroll container (the desktop's frame: auto — hidden while the cover is closed), or a plain
    // box (a phone: the page scrolls)
    const isInner = () => {
      const o = getComputedStyle(scroller).overflowY;
      return o !== 'visible' && o !== 'clip';
    };
    const position = () => (inner ? scroller.scrollTop : window.scrollY - trackTop);

    const load = (l: Layer) => {
      if (l.loaded || !l.img) return;
      l.loaded = true;
      const img = l.img;
      const { src, srcset } = img.dataset;
      if (srcset) img.srcset = srcset;
      if (src) img.src = src;
      // decoded before it fades in (a large picture decoded on the main thread would cost a frame)
      img.decode?.().catch(() => undefined);
    };

    const show = (l: Layer, visible: boolean) => {
      if (visible === l.visible) return;
      l.visible = visible;
      l.el.style.visibility = visible ? '' : 'hidden';
      if (!css && l.pic) l.pic.style.willChange = visible && moving ? 'transform' : '';
    };

    const scan = () => {
      const els = Array.from(frame.querySelectorAll<HTMLElement>('.sc-back > .sc-layer'));
      const prev = new Map(layers.map((l) => [l.el, l]));
      layers = els.map((el, i) => {
        const known = prev.get(el);
        if (known) return known;
        const img = el.querySelector<HTMLImageElement>('img.sc-pic');
        const pic = el.querySelector<HTMLElement>('.sc-pic');
        return {
          el,
          pic,
          img,
          loaded: i === 0 || !img?.dataset.src,
          start: 0,
          end: 0,
          zoom: (el.dataset.zoom as LayerGeometry['zoom']) ?? 'in',
          drift: (el.dataset.drift as LayerGeometry['drift']) ?? null,
          // what the element carries already (a driver before this one may have written it); the first
          // frame decides the rest (the pictures not in play are hidden then)
          opacity: el.style.opacity,
          transform: pic?.style.transform ?? '',
          visible: el.style.visibility !== 'hidden',
          fading: el.style.willChange === 'opacity',
          ranges: '',
        };
      });
    };

    /** The scroll-driven backdrop's ranges: px of the scroller's own scroll (the page's includes what is above the track). */
    const hand = () => {
      const at = (n: number) => `${(n + trackTop).toFixed(1)}px`;
      layers.forEach((l, k) => {
        const r = ranges[k]!;
        const values: [string, string][] = [
          ['--sc-fa', r.fade ? at(r.fade[0]) : ''],
          ['--sc-fb', r.fade ? at(r.fade[1]) : ''],
          ['--sc-ma', at(r.move[0])],
          ['--sc-mb', at(r.move[1])],
          ['--sc-s0', r.scale[0].toFixed(4)],
          ['--sc-s1', r.scale[1].toFixed(4)],
          ['--sc-y0', `${r.shift[0].toFixed(1)}px`],
          ['--sc-y1', `${r.shift[1].toFixed(1)}px`],
        ];
        const key = values.map((v) => v[1]).join(' ');
        if (key === l.ranges) return;
        l.ranges = key;
        for (const [name, value] of values)
          if (value) l.el.style.setProperty(name, value);
          else l.el.style.removeProperty(name);
      });
    };

    // ── where the browser plays the pictures: which of them are in play, and which to load, from the
    // sections in front of them (a picture's stretch of the page) crossing bands around the screen ──
    let playing: IntersectionObserver | null = null;
    let nearing: IntersectionObserver | null = null;
    let playRoot: Element | null | undefined;
    /** the sections in the band now, and the picture behind each */
    const inBand = new Map<Element, number>();
    const watchPlay = (renew: boolean) => {
      const root = inner ? scroller : null;
      if (!playing || !nearing || root !== playRoot) {
        playing?.disconnect();
        nearing?.disconnect();
        playRoot = root;
        const m = inPlayMargins(OPTIONS, IN_PLAY);
        playing = new IntersectionObserver(
          (entries) => {
            for (const e of entries)
              if (e.isIntersecting) inBand.set(e.target, Number((e.target as HTMLElement).dataset.layer));
              else inBand.delete(e.target);
            const on = new Set(inBand.values());
            layers.forEach((l, k) => {
              if (on.has(k)) load(l);
              show(l, on.has(k));
            });
          },
          { root, rootMargin: `${share(m.top)} 0px ${share(m.bottom)} 0px` },
        );
        nearing = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              nearing?.unobserve(e.target);
              const l = layers[Number((e.target as HTMLElement).dataset.layer)];
              if (l) load(l);
            }
          },
          { root, rootMargin: `0px 0px ${share(LOAD_AHEAD + FADE_FROM - 1)} 0px` },
        );
      } else if (!renew) return;
      else {
        playing.disconnect();
        nearing.disconnect();
      }
      inBand.clear();
      const firsts = new Set<number>();
      track.querySelectorAll<HTMLElement>('.sc-sec[data-layer]').forEach((sec) => {
        playing!.observe(sec);
        const k = Number(sec.dataset.layer);
        if (firsts.has(k)) return;
        firsts.add(k);
        nearing!.observe(sec);
      });
    };
    cleanups.push(() => {
      playing?.disconnect();
      nearing?.disconnect();
    });

    /** Each picture's stretch: from its first section's top to the next picture's (track coordinates). */
    const measure = () => {
      inner = isInner();
      height = inner ? scroller.clientHeight : window.innerHeight;
      const base = track.getBoundingClientRect().top;
      trackTop = inner ? 0 : base + window.scrollY;
      const starts = new Map<number, number>();
      track.querySelectorAll<HTMLElement>('.sc-sec[data-layer]').forEach((sec) => {
        const k = Number(sec.dataset.layer);
        if (!starts.has(k)) starts.set(k, sec.getBoundingClientRect().top - base);
      });
      const total = track.scrollHeight;
      layers.forEach((l, k) => {
        l.start = k === 0 ? 0 : (starts.get(k) ?? total);
      });
      layers.forEach((l, k) => {
        l.end = layers[k + 1]?.start ?? total;
      });
      ranges = layers.map((l, k) => layerRanges(l, k, height, OPTIONS));
      if (css) {
        hand();
        watchPlay(false);
      }
    };

    // the design's prop (SceneProp): where the browser can't play its flight, the driver does
    const back = frame.querySelector<HTMLElement>('.sc-back');
    const propEl = frame.querySelector<HTMLElement>('.sc-prop');
    const propKind = propEl?.dataset.prop as SceneProp | undefined;
    const prop = propEl && propKind && PROPS[propKind] ? { spec: PROPS[propKind], el: propEl } : null;
    const paintProp = () => {
      if (!prop || !back) return;
      const max = inner
        ? scroller.scrollHeight - scroller.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const t = max > 0 ? Math.min(1, Math.max(0, (inner ? scroller.scrollTop : window.scrollY) / max)) : 0;
      const [w, h] = [back.clientWidth, back.clientHeight];
      const pose = poseAt(prop.spec, t);
      const mover = prop.el.querySelector<HTMLElement>('.sc-mover');
      if (mover) {
        mover.style.translate = `calc(${lenPx(pose.x, w, h).toFixed(1)}px - 50%) calc(${lenPx(pose.y, w, h).toFixed(1)}px - 50%)`;
        mover.style.rotate = `${pose.rotate.toFixed(1)}deg`;
        mover.style.scale = pose.scale.toFixed(3);
      }
      const [ta, tb] = prop.spec.target.reveal;
      const k = Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
      prop.el.querySelectorAll<HTMLElement>('.sc-target').forEach((el) => {
        el.style.opacity = k.toFixed(3);
        el.style.scale = (0.9 + 0.1 * k).toFixed(3);
      });
    };

    /**
     * The backdrop at the scroll position: which pictures are in play and loaded — and, where the
     * browser doesn't play them, each one's cross-fade and motion, and the prop's flight.
     */
    const paint = () => {
      raf = 0;
      if (!css) paintProp();
      if (!layers.length) return;
      const y = position();
      layers.forEach((l, k) => {
        // the pictures ahead load a little before they are needed
        if (!l.loaded && y + height * LOAD_AHEAD > l.start - height * FADE_FROM) load(l);
        // in play from its cross-fade's start until the next one has covered it
        show(l, layerShown(ranges, k, y, css ? height * IN_PLAY : 0));
        if (css) return;
        const s = layerState(l, k, y, height, OPTIONS);
        const fading = s.opacity > 0 && s.opacity < 1;
        if (fading !== l.fading) {
          l.fading = fading;
          l.el.style.willChange = fading ? 'opacity' : '';
        }
        const opacity = k === 0 ? '' : s.opacity.toFixed(3);
        if (opacity !== l.opacity) {
          l.opacity = opacity;
          l.el.style.opacity = opacity;
        }
        if (!l.visible || !l.pic) return;
        const transform = moving
          ? `translate3d(0,${s.shift.toFixed(1)}px,0) scale(${s.scale.toFixed(4)})`
          : '';
        if (transform !== l.transform) {
          l.transform = transform;
          l.pic.style.transform = transform;
        }
      });
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    scan();
    measure();
    paint();
    // the ranges are in place: from here the browser plays them
    if (css) frame.dataset.sceneCss = '';
    frame.dataset.sceneReady = '';

    // the scroll, where the driver plays the backdrop itself: the page's or the frame's (listening to
    // both costs nothing — one of them never fires)
    if (!css) {
      window.addEventListener('scroll', request, { passive: true });
      scroller.addEventListener('scroll', request, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('scroll', request);
        scroller.removeEventListener('scroll', request);
      });
    }
    cleanups.push(() => {
      if (raf) cancelAnimationFrame(raf);
    });

    // anything that moves the sections, or the screen changing size (the frame appears or goes)
    let settle = 0;
    const remeasure = () => {
      if (settle) return;
      settle = requestAnimationFrame(() => {
        settle = 0;
        measure();
        paint();
      });
    };
    const sizes = new ResizeObserver(remeasure);
    sizes.observe(track);
    sizes.observe(scroller);
    window.addEventListener('resize', remeasure, { passive: true });
    void document.fonts?.ready.then(remeasure);
    window.addEventListener('invitation:locale', remeasure);
    // the texts' reveal (ScrollEngine adds .in): will-change just before it plays…
    const near = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          near.unobserve(e.target);
          if (moving && !e.target.classList.contains('in'))
            (e.target as HTMLElement).style.willChange = 'transform, opacity, filter';
        }
      },
      { rootMargin: '0px 0px 30% 0px' },
    );
    const watch = () =>
      track.querySelectorAll<HTMLElement>('.sc-sec .reveal:not(.in)').forEach((el) => near.observe(el));
    watch();

    // a new backdrop (the editor's preview renders it again) or new sections (the language switch) —
    // the structure only: what changes inside a section (the countdown's every second) is not this
    const structure = () => {
      mo.disconnect();
      mo.observe(track, { childList: true });
      track
        .querySelectorAll(':scope > .sc-back, :scope > main')
        .forEach((el) => mo.observe(el, { childList: true }));
    };
    const mo = new MutationObserver(() => {
      structure();
      scan();
      if (css) watchPlay(true);
      remeasure();
      watch();
    });
    structure();
    cleanups.push(() => {
      sizes.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('invitation:locale', remeasure);
      if (settle) cancelAnimationFrame(settle);
    });

    // reduced motion turned on (or off) while the page is open
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      moving = motionAllowed();
      // (where the browser plays the pictures, its own media query stops their zoom)
      if (!css)
        layers.forEach((l) => {
          l.transform = '\u0000';
          if (l.pic) l.pic.style.willChange = l.visible && moving ? 'transform' : '';
        });
      paint();
    };
    reduce?.addEventListener?.('change', onMotion);
    cleanups.push(() => reduce?.removeEventListener?.('change', onMotion));

    // after the page has loaded, the next picture loads too (the guest will scroll to it)
    const ahead = () => {
      const next = layers.find((l) => !l.loaded);
      if (next) load(next);
    };
    const idle = () => {
      if (typeof window.requestIdleCallback === 'function')
        window.requestIdleCallback(ahead, { timeout: 4000 });
      else setTimeout(ahead, 1500);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
    cleanups.push(() => window.removeEventListener('load', idle));

    // the desktop's phone frame: a wheel over the page around it scrolls it, and the keyboard reaches it
    const inv = frame.closest<HTMLElement>('.inv');
    const onWheel = (e: WheelEvent) => {
      // (never while the cover is closed: the invitation doesn't move under it)
      if (!inner || frame.contains(e.target as Node) || document.body.classList.contains('locked')) return;
      scroller.scrollBy({ top: e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY, behavior: 'instant' });
    };
    inv?.addEventListener('wheel', onWheel, { passive: true });
    const focusFrame = () => {
      if (isInner() && !scroller.contains(document.activeElement)) scroller.focus({ preventScroll: true });
    };
    const root = document.documentElement.dataset;
    if (root.opened) focusFrame();
    // once the cover has gone (the invitation is inert under it until then)
    let focusTimer = 0;
    const onOpen = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(focusFrame, 1600);
    };
    window.addEventListener('invitation:open', onOpen);
    cleanups.push(() => {
      inv?.removeEventListener('wheel', onWheel);
      window.removeEventListener('invitation:open', onOpen);
      window.clearTimeout(focusTimer);
    });

    // …and gone once it has played
    const onEnd = (e: TransitionEvent) => {
      const el = e.target as HTMLElement;
      if (e.propertyName === 'opacity' && el.classList.contains('in') && el.style.willChange)
        el.style.willChange = '';
    };
    track.addEventListener('transitionend', onEnd);
    cleanups.push(() => {
      near.disconnect();
      track.removeEventListener('transitionend', onEnd);
    });

    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
