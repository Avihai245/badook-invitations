'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';

export interface CalendarLinks {
  google: string;
  outlook: string;
  /** Apple / .ics download (route in P1+, data URL fallback in the kitchen sink) */
  ics: string;
  icsFileName: string;
}

/** "Add to Calendar" dropdown: Google / Apple (.ics) / Outlook (§2.2.5, §9A.4 calendar dropdown). */
export function CalendarMenu({
  label,
  links,
  labels,
}: {
  label: string;
  links: CalendarLinks;
  labels: { google: string; apple: string; outlook: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={open ? 'dd open' : 'dd'} ref={ref}>
      <button
        className="btn btn-outline"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar-plus" size={18} />
        {label}
      </button>
      <div className="dd-menu" role="menu" id={menuId}>
        <a href={links.google} target="_blank" rel="noopener noreferrer" role="menuitem">
          <Icon name="calendar-plus" size={18} />
          {labels.google}
        </a>
        <a href={links.ics} download={links.icsFileName} role="menuitem">
          <Icon name="calendar-plus" size={18} />
          {labels.apple}
        </a>
        <a href={links.outlook} target="_blank" rel="noopener noreferrer" role="menuitem">
          <Icon name="calendar-plus" size={18} />
          {labels.outlook}
        </a>
      </div>
    </div>
  );
}
