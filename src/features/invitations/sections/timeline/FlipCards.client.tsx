'use client';

import { useState, type CSSProperties } from 'react';
import { Icon, type IconName } from '../../ui/Icon';

export interface FlipItem {
  id: string;
  time: string;
  icon: IconName;
  label: string;
}

/** §9A.4 flip-cards: 2-column grid, front = time pill + icon, back = label, rotateY 600ms on tap. */
export function FlipCards({ items, hint }: { items: FlipItem[]; hint: string }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <>
      <div className="flips">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            className={open.has(it.id) ? 'flip on reveal' : 'flip reveal'}
            style={{ '--i': i + 2 } as CSSProperties}
            aria-pressed={open.has(it.id)}
            onClick={() => toggle(it.id)}
          >
            <span className="flip-inner">
              <span className="flip-face" aria-hidden={open.has(it.id)}>
                <span className="pill ltr">{it.time}</span>
                <Icon name={it.icon} size={24} />
              </span>
              <span className="flip-face flip-back" aria-hidden={!open.has(it.id)}>
                {it.label}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="flip-hint reveal">{hint}</p>
    </>
  );
}
