'use client';

import { useEffect, useState } from 'react';
import { motionAllowed } from './motion';

/**
 * A gold-foil glint that sweeps once across a name of the hero as its entrance lands: a copy of the
 * name seen through a soft slanted window — the window slides one way while the copy inside slides the
 * other, so the copy stays exactly over the name (transform only, never a repaint of the text). The
 * copy exists in the browser only (the server's HTML and the accessibility tree have the name once),
 * inside a clipping box the size of the name's line, so FitNames' measurement is untouched.
 */
export function NameShine({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!motionAllowed()) return;
    const root = document.documentElement.dataset;
    // the entrance has played already (the live language switch), or long before this ran
    if (root.localeSwitched || (root.opened && performance.now() > 6000)) return;
    setOn(true);
  }, []);
  if (!on || !text) return null;
  return (
    <span className="n-shine" aria-hidden="true">
      <span className="n-shine-band">
        <span className="n-shine-text">
          <bdi>{text}</bdi>
        </span>
      </span>
    </span>
  );
}
