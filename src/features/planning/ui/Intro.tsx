'use client';

import { Lightbulb, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/app';

/**
 * A planning screen's "how it works", for a host who opens it for the first time: a title, a few
 * numbered steps in plain words (each may carry its own button), and an X — closed, it stays closed for
 * this screen of this event (in this browser). Shown until the browser says otherwise, so the first
 * paint already has it.
 */
export function Intro({
  storageKey,
  title,
  steps,
  closeLabel,
  testId,
}: {
  storageKey: string;
  title: string;
  steps: { text: ReactNode; action?: ReactNode }[];
  closeLabel: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '0') setOpen(false);
    } catch {
      /* shown */
    }
  }, [storageKey]);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, '0');
    } catch {
      /* closed for this visit */
    }
  };
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className="relative rounded-[18px] border border-brand-line bg-brand-soft/40 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-surface text-brand-deep shadow-xs"
        >
          <Lightbulb className="size-[18px]" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15.5px] font-bold">{title}</h2>
          <ol className="mt-2 grid gap-2 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-ink/85">
                <span
                  aria-hidden
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white dark:text-[#1c1917]"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  {s.text}
                  {s.action ? <span className="mt-1.5 block">{s.action}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <IconButton label={closeLabel} size="sm" onClick={close} className="-me-1 -mt-1 shrink-0">
          <X />
        </IconButton>
      </div>
    </section>
  );
}
