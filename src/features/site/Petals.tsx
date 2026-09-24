import type { CSSProperties } from 'react';

/** Petals and sparkles drifting down over the first screen (site.css `.site-petal`); decorative. */
const PETALS = Array.from({ length: 16 }, (_, i) => {
  // deterministic spread (same markup on the server and in the browser)
  const r = (k: number) => ((i * 9301 + k * 49297) % 233280) / 233280;
  return {
    left: `${Math.round(r(1) * 96)}%`,
    size: `${8 + Math.round(r(2) * 12)}px`,
    dur: `${13 + Math.round(r(3) * 12)}s`,
    delay: `${-Math.round(r(4) * 20)}s`,
    drift: `${Math.round((r(5) - 0.5) * 220)}px`,
    spark: i % 4 === 0,
    petal: ['rgba(255,223,206,.85)', 'rgba(246,205,178,.8)', 'rgba(255,240,228,.9)'][i % 3],
  };
});

export function Petals() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className={p.spark ? 'site-petal spark' : 'site-petal'}
          style={
            {
              left: p.left,
              '--size': p.spark ? '5px' : p.size,
              '--dur': p.dur,
              '--delay': p.delay,
              '--drift': p.drift,
              '--petal': p.petal,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
