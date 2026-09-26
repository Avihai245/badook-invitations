'use client';

import { useEffect } from 'react';
import type { TextReveal } from '../../contracts/types';
import { motionAllowed, saveData } from '../fx/motion';
import { TEXT_REVEAL_TARGETS, revealGranularity } from './engine';

/** What reveals on scroll: sections' blocks, dividers and decorations, and the cinematic sections. */
export const REVEALED = '.reveal:not(.in), .divider:not(.in), .deco:not(.in), .cine:not(.in)';

const graphemes =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? (text: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment)
    : (text: string) => [...text];

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;
const LTR_CHAR = /\p{L}/u;
/** A word's direction by its first strong letter (null: digits and punctuation only). */
function strongDir(word: string): 'rtl' | 'ltr' | null {
  for (const ch of word) {
    if (RTL_CHAR.test(ch)) return 'rtl';
    if (LTR_CHAR.test(ch)) return 'ltr';
  }
  return null;
}

/**
 * The pieces of a text reveal, aria-hidden (the text itself stays in the element, read once). Each
 * piece is an inline-block, and an inline-block counts as a neutral character for the bidirectional
 * algorithm — so the words of the other script (Latin names in a Hebrew text, and the reverse) are
 * kept together in an isolate of their own direction, or they would come out in reverse order.
 */
function buildPieces(text: string, mode: Exclude<TextReveal, 'none'>, base: 'rtl' | 'ltr') {
  const fx = document.createElement('span');
  fx.className = `tr-fx tr-${mode}`;
  fx.setAttribute('aria-hidden', 'true');
  let into: HTMLElement = fx;
  let k = 0;
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      into.appendChild(document.createTextNode(token));
      continue;
    }
    const dir = strongDir(token);
    if (dir && dir !== base) {
      if (into === fx || into.dir !== dir) {
        into = document.createElement('span');
        into.dir = dir;
        into.style.unicodeBidi = 'isolate';
        fx.appendChild(into);
      }
    } else if (dir === base && into !== fx) {
      into = fx;
    }
    const word = document.createElement('span');
    word.className = 'tr-w';
    if (mode === 'letters') {
      if (dir) word.dir = dir;
      for (const g of graphemes(token)) {
        const piece = document.createElement('span');
        piece.className = 'tr-p';
        piece.textContent = g;
        piece.style.setProperty('--k', String(k++));
        word.appendChild(piece);
      }
    } else {
      word.classList.add('tr-p');
      word.textContent = token;
      word.style.setProperty('--k', String(mode === 'words' ? k++ : 0));
    }
    into.appendChild(word);
  }
  return fx;
}

interface TextRun {
  el: HTMLElement;
  fx: HTMLElement;
  pieces: number;
  step: number;
}

/**
 * The Scroll Timeline Engine, browser half (the declarative half: ./engine.ts + invitation.css). One
 * component per invitation page, one IntersectionObserver for everything that reveals:
 *
 * - the template's reveal (§9A.6), as before: every `.reveal`, divider and decoration gets `.in` once
 *   20% of it is in view (a divider as soon as it is), and so does each cinematic section `.cine` —
 *   the fallback's trigger where the browser has no scroll-driven animations (there the CSS drives
 *   the enter presets, the parallax and the Ken Burns zoom from the scroll by itself);
 * - text reveals: a section's titles and texts are split into letters / words / lines as they come
 *   near, played once in view, and the copy is removed once it has played;
 * - background videos: their file is attached only near the screen (never with Save-Data, reduced
 *   data or reduced motion — the still stays), played muted and inline, paused away from the screen
 *   and in a hidden tab;
 * - the parallax where scroll-driven animations are missing: the layer's transform written once per
 *   frame while its section is on screen, from geometry measured outside the scroll handler.
 *
 * With reduced motion or <html data-motion="none"> nothing moves: the CSS shows every final state and
 * the engine only reveals, never splits text, plays video or moves layers. New nodes (a language
 * switch, an RSVP card) are picked up by a MutationObserver.
 */
export function ScrollEngine() {
  useEffect(() => {
    const root = document.documentElement;
    // the page is interactive from here on (tests wait for it before clicking controls)
    root.dataset.hydrated = '1';
    const inv = document.querySelector<HTMLElement>('.inv');
    const editor = inv?.dataset.mode === 'editor';
    const scrollDriven = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');
    let vh = window.innerHeight;
    const cleanups: (() => void)[] = [];

    if (typeof IntersectionObserver === 'undefined') {
      // no observer (very old browsers): everything in its final state
      document.querySelectorAll(REVEALED).forEach((el) => el.classList.add('in'));
      return;
    }

    // ── the reveal ──
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // a 1px divider is either in or out: any intersection counts
          if (
            e.intersectionRatio >= 0.2 ||
            e.intersectionRect.height >= window.innerHeight * 0.2 ||
            e.target.classList.contains('divider')
          ) {
            e.target.classList.add('in');
            reveal.unobserve(e.target);
          }
        }
      },
      { threshold: [0, 0.2, 0.5] },
    );
    cleanups.push(() => reveal.disconnect());

    const moving = () => !editor && motionAllowed();

    // ── text reveals ──
    const runs = new Map<Element, TextRun>();
    const timers = new Set<number>();
    const finish = (run: TextRun) => {
      run.fx.remove();
      run.el.classList.remove('tr-on');
      runs.delete(run.el);
    };
    const play = (run: TextRun) => {
      // the pieces' first state is on screen: now they move
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          run.fx.classList.add('tr-play');
          const t = window.setTimeout(
            () => {
              timers.delete(t);
              finish(run);
            },
            run.pieces * run.step + 1300,
          );
          timers.add(t);
        }),
      );
    };
    const textIn = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const run = runs.get(e.target);
          if (!run || !e.isIntersecting) continue;
          if (e.intersectionRatio >= 0.35 || e.intersectionRect.height >= window.innerHeight * 0.2) {
            textIn.unobserve(e.target);
            play(run);
          }
        }
      },
      { threshold: [0, 0.35, 0.7] },
    );
    const prepare = (el: HTMLElement) => {
      if (el.dataset.trDone !== undefined || runs.has(el)) return;
      el.dataset.trDone = '';
      const section = el.closest<HTMLElement>('.cine[data-tr]');
      const text = el.textContent ?? '';
      const mode = revealGranularity((section?.dataset.tr ?? 'none') as TextReveal, text);
      if (mode === 'none' || !text.trim() || !moving()) return;
      const style = getComputedStyle(el);
      const fx = buildPieces(text, mode, style.direction === 'rtl' ? 'rtl' : 'ltr');
      el.classList.add('tr-on');
      el.appendChild(fx);
      let pieces = fx.querySelectorAll('.tr-p').length;
      if (mode === 'lines') {
        // one line = the words at the same height (measured once, here — never while scrolling)
        const tops: number[] = [];
        fx.querySelectorAll<HTMLElement>('.tr-w').forEach((w) => {
          const top = Math.round(w.offsetTop);
          let line = tops.findIndex((t) => Math.abs(t - top) < 4);
          if (line < 0) line = tops.push(top) - 1;
          w.style.setProperty('--k', String(line));
        });
        pieces = tops.length;
      }
      const step = Number.parseFloat(section ? getComputedStyle(section).getPropertyValue('--tr-step') : '') || 60;
      const run = { el, fx, pieces, step: mode === 'lines' ? step * 2.5 : step };
      runs.set(el, run);
      textIn.observe(el);
    };
    const textNear = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          textNear.unobserve(e.target);
          prepare(e.target as HTMLElement);
        }
      },
      { rootMargin: '0px 0px 35% 0px' },
    );
    cleanups.push(() => {
      textIn.disconnect();
      textNear.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      runs.forEach(finish);
    });

    // ── background videos ──
    const reducedData = () => {
      try {
        return window.matchMedia('(prefers-reduced-data: reduce)').matches;
      } catch {
        return false;
      }
    };
    const videos = new Set<HTMLVideoElement>();
    const onScreen = new Set<HTMLVideoElement>();
    const start = (v: HTMLVideoElement) => {
      if (!v.getAttribute('src')) {
        v.muted = true;
        v.defaultMuted = true;
        v.setAttribute('muted', '');
        v.playsInline = true;
        v.addEventListener('playing', () => (v.dataset.playing = ''), { once: true });
        v.preload = 'auto';
        v.src = v.dataset.src ?? '';
      }
      if (!document.hidden) v.play()?.catch(() => undefined);
    };
    const videoIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            onScreen.add(v);
            start(v);
          } else {
            onScreen.delete(v);
            if (v.getAttribute('src')) v.pause();
          }
        }
      },
      { rootMargin: '30% 0px' },
    );
    const onVisibility = () => {
      for (const v of onScreen) {
        if (document.hidden) v.pause();
        else if (v.getAttribute('src')) v.play()?.catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => {
      videoIo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      videos.forEach((v) => v.pause());
    });

    // ── parallax without scroll-driven animations ──
    interface Layer {
      section: HTMLElement;
      layer: HTMLElement;
      /** the box the travel is a share of (the section, or the picture's frame) */
      frame: HTMLElement;
      top: number;
      height: number;
      depth: number;
    }
    const layers = new Map<HTMLElement, Layer>();
    const visible = new Set<Layer>();
    let frame = 0;
    const measure = (l: Layer) => {
      const r = l.frame.getBoundingClientRect();
      l.top = r.top + window.scrollY;
      l.height = r.height;
    };
    const paint = () => {
      frame = 0;
      const y = window.scrollY;
      for (const l of visible) {
        const progress = Math.min(1, Math.max(0, (y + vh - l.top) / (vh + l.height)));
        const travel = ((progress * 2 - 1) * l.depth * l.height) / 100;
        l.layer.style.transform = `translate3d(0, ${travel.toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!frame && visible.size) frame = requestAnimationFrame(paint);
    };
    const parallaxIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const l = layers.get(e.target as HTMLElement);
          if (!l) continue;
          if (e.isIntersecting) {
            measure(l);
            visible.add(l);
          } else visible.delete(l);
        }
        onScroll();
      },
      { rootMargin: '15% 0px' },
    );
    // anything that moves the sections (fonts, pictures, an RSVP card opening) → measure again
    const remeasure = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        vh = window.innerHeight;
        layers.forEach(measure);
        paint();
      });
    });
    const onResize = () => {
      vh = window.innerHeight;
    };
    if (!scrollDriven) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      const main = document.querySelector('.inv > main');
      if (main) remeasure.observe(main);
    }
    cleanups.push(() => {
      parallaxIo.disconnect();
      remeasure.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    });

    // ── (re)scan: every node the page adds ──
    const scan = () => {
      document.querySelectorAll(REVEALED).forEach((el) => reveal.observe(el));
      const instant = inv?.dataset.instant !== undefined;
      document
        .querySelectorAll<HTMLElement>(`.cine[data-tr] :is(${TEXT_REVEAL_TARGETS})`)
        .forEach((el) => {
          if (el.dataset.trDone !== undefined || runs.has(el)) return;
          // the language switch shows what is on screen as it is — no reveal again
          if (instant && el.getBoundingClientRect().top < window.innerHeight) {
            el.dataset.trDone = '';
            return;
          }
          textNear.observe(el);
        });
      const play = moving() && !saveData() && !reducedData();
      document.querySelectorAll<HTMLVideoElement>('video.cine-video[data-src]').forEach((v) => {
        if (videos.has(v) || !play) return;
        videos.add(v);
        videoIo.observe(v);
      });
      for (const v of videos) if (!v.isConnected) (videos.delete(v), onScreen.delete(v));
      if (!scrollDriven && moving()) {
        document.querySelectorAll<HTMLElement>('.cine[data-scroll~="parallax"]').forEach((section) => {
          const layer =
            section.querySelector<HTMLElement>(':scope > .cine-bg > .cine-layer') ??
            section.querySelector<HTMLElement>(':scope > .cine-figure > :is(.cine-img, .cine-video)');
          if (!layer || layers.has(section)) return;
          const frameEl = layer.classList.contains('cine-layer') ? section : layer.parentElement!;
          const depth = Number.parseFloat(section.style.getPropertyValue('--px-depth')) || 9;
          layers.set(section, { section, layer, frame: frameEl, top: 0, height: 0, depth });
          parallaxIo.observe(section);
        });
        for (const [section, l] of layers)
          if (!section.isConnected) (layers.delete(section), visible.delete(l), parallaxIo.unobserve(section));
      }
    };
    scan();
    let pending = 0;
    const mo = new MutationObserver(() => {
      if (!pending) pending = requestAnimationFrame(() => ((pending = 0), scan()));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    cleanups.push(() => {
      mo.disconnect();
      if (pending) cancelAnimationFrame(pending);
    });
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
