'use client';

import { useEffect, useState } from 'react';
import { Localized, type Variant } from '../cover/localized';

/**
 * The scroll scene's call to action (renderer/scene): "RSVP" pinned to the bottom of the screen — of
 * the phone frame on a computer — once the guest has scrolled past the first screen, and out of the way
 * while the RSVP form itself is on screen, and on the finale's own stage (`.sc-stage`: the last shot,
 * with nothing over it). A plain link to it (#rsvp): the page scrolls there smoothly (the scene's
 * scroll-behavior), or at once with reduced motion. Hidden, it is out of the tab order.
 */
export function SceneCta({ label }: { label: readonly Variant[] }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const first = document.querySelector('.sc-track .sc-sec');
    const rsvp = document.getElementById('rsvp');
    if (!first || !rsvp || typeof IntersectionObserver === 'undefined') return;
    let past = false;
    let atForm = false;
    let onStage = false;
    const apply = () => setShown(past && !atForm && !onStage);
    const passed = new IntersectionObserver(([e]) => {
      // gone above the screen (not merely below it)
      past = !!e && !e.isIntersecting && e.boundingClientRect.top < 0;
      apply();
    });
    const form = new IntersectionObserver(
      ([e]) => {
        atForm = !!e?.isIntersecting;
        apply();
      },
      { threshold: 0.12 },
    );
    const stage = document.querySelector('.sc-track > .sc-stage');
    const staged = new IntersectionObserver(
      ([e]) => {
        onStage = !!e && e.intersectionRatio >= 0.25;
        apply();
      },
      { threshold: [0, 0.25] },
    );
    passed.observe(first);
    form.observe(rsvp);
    if (stage) staged.observe(stage);
    return () => {
      passed.disconnect();
      form.disconnect();
      staged.disconnect();
    };
  }, []);

  return (
    <a
      className="sc-cta"
      href="#rsvp"
      data-shown={shown ? '' : undefined}
      aria-hidden={shown ? undefined : true}
      tabIndex={shown ? undefined : -1}
    >
      <Localized variants={label} />
    </a>
  );
}
