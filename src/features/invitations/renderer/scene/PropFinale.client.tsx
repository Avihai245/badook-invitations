'use client';

import { useEffect } from 'react';
import type { SceneProp } from '../../contracts/types';
import { burstFrom } from '../fx/burst';
import { motionAllowed } from '../fx/motion';
import { PROPS } from './props';

/**
 * The prop's arrival (renderer/scene/props.ts): when the guest reaches the very end of the invitation
 * (the scene's end marker, `.sc-end`, comes into view), the prop has arrived at its target — the ball
 * drops through the net, the ball bulges the net, the rocket's engine goes quiet and a flag goes up,
 * the balloon bobs by the moon — and a burst celebrates it (`data-scored` on `.sc-prop`; the CSS plays
 * the rest). Back up the page it resets, so it plays again. With reduced motion there is nothing to
 * play: the prop rests at its target.
 */
export function PropFinale({ kind }: { kind: SceneProp }) {
  useEffect(() => {
    const prop = document.querySelector<HTMLElement>(`.sc-prop[data-prop='${kind}']`);
    const track = prop?.closest<HTMLElement>('.sc-track');
    if (!prop || !track) return;
    const spec = PROPS[kind];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) {
          delete prop.dataset.scored;
          continue;
        }
        if (prop.dataset.scored !== undefined) continue;
        prop.dataset.scored = '';
        if (!motionAllowed()) continue;
        const target = prop.querySelector('.sc-target-front') ?? prop.querySelector('.sc-target-back');
        const b = spec.burst;
        window.setTimeout(() => burstFrom(target, b.kind, b.colors, b.at, b.scale), 260);
      }
    });
    // the end marker comes with the sections (after the page's first paint)
    let watched: Element | null = null;
    const watch = () => {
      const end = track.querySelector(':scope > .sc-end');
      if (!end || end === watched) return;
      if (watched) io.unobserve(watched);
      watched = end;
      io.observe(end);
    };
    const mo = new MutationObserver(watch);
    mo.observe(track, { childList: true });
    watch();
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [kind]);
  return null;
}
