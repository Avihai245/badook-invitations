'use client';

import { useEffect, useRef, useState } from 'react';
import type { SceneParticles as Kind } from '../../contracts/types';
import { motionAllowed, particleBudget, saveData } from '../fx/motion';
import { STILL_EVENT } from '../MotionPause.client';
import { COUNT, particleFlight, type FlightOptions } from './particles';

/**
 * The scroll scene's particles (renderer/scene): 8–15 butterflies, petals or motes of gold drifting
 * over the backdrop on one canvas — slowly, at random, for ever — so the picture behind the texts
 * never looks like a still (the flight itself: particles.ts). Where the browser can, the canvas is
 * handed to a worker (particles.worker.ts) that draws every frame off the page's thread; elsewhere the
 * page draws it. Decorative (aria-hidden, click-through). Starts once the invitation opens; stops while
 * the tab is hidden and while the guest has paused the animations; never runs with reduced motion, the
 * host's motion at 0, Save-Data, or in the editor.
 */
export function SceneParticles({ kind, colors, seed }: { kind: Kind; colors: string[]; seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  // the worker failed: the page draws (on a new canvas — the first one belongs to the worker)
  const [onPage, setOnPage] = useState(false);
  const tone = colors.join(',');

  useEffect(() => {
    if (kind === 'none' || !motionAllowed() || saveData()) return;
    if (document.querySelector('.inv')?.getAttribute('data-mode') === 'editor') return;
    let timer = 0;
    const start = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setOn(true), ms);
    };
    if (document.documentElement.dataset.opened) start(300);
    const onOpen = () => start(700);
    window.addEventListener('invitation:open', onOpen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('invitation:open', onOpen);
    };
  }, [kind]);

  useEffect(() => {
    const canvas = ref.current;
    if (!on || !canvas || kind === 'none') return;
    const box = () => {
      const r = canvas.getBoundingClientRect();
      return { width: r.width, height: r.height, dpr: Math.min(2, window.devicePixelRatio || 1) };
    };
    const [phone, desktop] = COUNT[kind];
    const options: FlightOptions = {
      kind,
      colors: tone ? tone.split(',') : ['#FFFFFF'],
      seed,
      count: Math.min(15, particleBudget(phone, desktop)),
      ...box(),
    };

    // the painter: a worker with the canvas, or the page itself
    let worker: Worker | null = null;
    if (!onPage && typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
      try {
        worker = new Worker(new URL('./particles.worker.ts', import.meta.url));
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', canvas: offscreen, options }, [offscreen]);
        worker.onerror = () => {
          worker?.terminate();
          setOnPage(true);
        };
      } catch {
        worker?.terminate();
        worker = null;
      }
    }
    let raf = 0;
    const g = worker ? null : canvas.getContext('2d');
    if (!worker && !g) return;
    const flight = worker ? null : particleFlight(options);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (g && flight) flight.step(g, now);
    };
    const size = () => {
      const b = box();
      if (worker) return worker.postMessage({ type: 'size', ...b });
      canvas.width = Math.round(b.width * b.dpr);
      canvas.height = Math.round(b.height * b.dpr);
      flight?.resize(b.width, b.height, b.dpr);
    };
    if (!worker) size();

    // the guest paused the animations (MotionPause, WCAG 2.2.2): they stop where they are
    const still = () => document.documentElement.dataset.still !== undefined;
    let running = false;
    const run = () => {
      if (running || document.hidden || still()) return;
      running = true;
      if (worker) return worker.postMessage({ type: 'run' });
      flight?.restart();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      if (worker) return worker.postMessage({ type: 'stop' });
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : run());
    document.addEventListener('visibilitychange', onVisibility);
    const onStill = (e: Event) => ((e as CustomEvent<boolean>).detail ? stop() : run());
    window.addEventListener(STILL_EVENT, onStill);
    const sized = new ResizeObserver(size);
    sized.observe(canvas);
    // reduced motion turned on meanwhile: the particles go
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onReduce = () => {
      if (motionAllowed()) return;
      stop();
      if (worker) worker.postMessage({ type: 'clear' });
      else g?.clearRect(0, 0, canvas.width, canvas.height);
      setOn(false);
    };
    reduce?.addEventListener?.('change', onReduce);
    run();
    return () => {
      stop();
      worker?.terminate();
      sized.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(STILL_EVENT, onStill);
      reduce?.removeEventListener?.('change', onReduce);
    };
  }, [on, onPage, kind, tone, seed]);

  if (!on || kind === 'none') return null;
  // a canvas handed to a worker is the worker's for good: another flight gets a new one
  return (
    <canvas key={`${kind}|${tone}|${seed}|${onPage}`} ref={ref} className="sc-dust" aria-hidden="true" />
  );
}
