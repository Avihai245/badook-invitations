'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';

/** Less than this left to scroll: the end of the invitation, no arrow. */
const END_PX = 48;

/**
 * The invitation inside a phone frame (the site's sample, the gallery's preview, the editor — <html
 * data-framed>, set by FRAMED_BOOT in ./framed.ts): a phone shows no scrollbar (invitation.css hides
 * it), so this floating arrow says there is more below — and scrolls about a screen down. It stays
 * away while the cover is closed and while the hero's own arrow is on screen, and goes once the end
 * is reached.
 */
export function FrameScrollCue() {
  const [framed, setFramed] = useState(false);
  const [shown, setShown] = useState(false);
  const [he, setHe] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (!('framed' in root.dataset)) return;
    setFramed(true);
    let heroCueSeen = false;
    const update = () => {
      const locked =
        document.body.classList.contains('locked') || document.body.classList.contains('lb-open');
      const left = root.scrollHeight - window.innerHeight - window.scrollY;
      setShown(!locked && !heroCueSeen && left > END_PX);
      setHe(root.lang !== 'en');
    };
    const cue = document.querySelector('.hero .cue');
    const seen = new IntersectionObserver(([entry]) => {
      heroCueSeen = !!entry?.isIntersecting;
      update();
    });
    if (cue) seen.observe(cue);
    const resized = new ResizeObserver(update);
    resized.observe(document.body);
    // the cover opening (body.locked goes), the language switching (lang on <html>)
    const changed = new MutationObserver(update);
    changed.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    changed.observe(root, { attributes: true, attributeFilter: ['lang'] });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      seen.disconnect();
      resized.disconnect();
      changed.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!framed) return null;
  return (
    <button
      type="button"
      className="frame-cue"
      data-shown={shown ? '' : undefined}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      aria-label={he ? 'גללו למטה' : 'Scroll down'}
      onClick={() => window.scrollBy({ top: Math.round(window.innerHeight * 0.8), behavior: 'smooth' })}
    >
      <Icon name="chevron-down" size={22} />
    </button>
  );
}
