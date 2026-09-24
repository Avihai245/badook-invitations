'use client';

import { Accessibility, Minus, Plus, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn, Switch } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import {
  A11Y_EMPTY as EMPTY,
  A11Y_KEY as KEY,
  A11Y_TOGGLES as TOGGLES,
  a11yAttr,
  type A11yPrefs as Prefs,
} from './a11y';

function apply(p: Prefs) {
  const d = document.documentElement;
  if (p.text) d.dataset.a11yText = String(p.text);
  else delete d.dataset.a11yText;
  for (const k of TOGGLES) {
    if (p[k]) d.dataset[a11yAttr(k)] = '';
    else delete d.dataset[a11yAttr(k)];
  }
  window.dispatchEvent(new CustomEvent('a11y:change', { detail: p }));
}

function load(): Prefs {
  try {
    return { ...EMPTY, ...(JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return EMPTY;
  }
}

/**
 * The accessibility menu (site and app): text size, high contrast, highlighted links, a readable
 * font, line spacing, no animations and a large cursor. Each is a `data-a11y-*` attribute on <html>
 * (site.css styles them), kept in localStorage and applied before the first paint by A11Y_BOOT.
 */
export function AccessibilityMenu() {
  const { t } = useUi();
  const a = t.site.a11y;
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(EMPTY);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setPrefs(load()), []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button, [href]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const update = (next: Prefs) => {
    setPrefs(next);
    apply(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // private mode: the settings hold for this page view
    }
  };
  const active = prefs.text > 0 || TOGGLES.some((k) => prefs[k]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="a11y-menu"
        aria-label={a.open}
        title={a.open}
        data-testid="a11y-button"
        className={cn(
          // phones: a round button in the bottom corner; wide screens: a tab on the side
          'fixed start-3 bottom-3 z-[55] grid size-11 place-items-center rounded-full text-white shadow-md transition-colors print:hidden',
          'lg:start-0 lg:top-1/2 lg:bottom-auto lg:h-11 lg:w-10 lg:-translate-y-1/2 lg:rounded-none lg:rounded-e-[12px]',
          'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]',
          active ? 'bg-[#1d4ed8]' : 'bg-[#1e3a8a] hover:bg-[#1d4ed8]',
        )}
      >
        <Accessibility aria-hidden className="size-6" />
      </button>
      {open ? (
        <div
          ref={panel}
          id="a11y-menu"
          role="dialog"
          aria-labelledby="a11y-title"
          className="site-swap fixed start-3 bottom-16 z-[56] w-[min(300px,calc(100vw-24px))] rounded-[16px] border border-line bg-surface p-4 text-ink shadow-[0_24px_60px_-12px_rgba(28,25,23,0.35)] lg:start-12 lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="a11y-title" className="text-[16px] font-bold">
              {a.title}
            </h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              aria-label={a.close}
              className="grid size-8 place-items-center rounded-btn text-muted hover:bg-subtle hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-card bg-canvas px-3 py-2">
            <span className="text-[14px] font-medium">{a.text}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={a.smaller}
                disabled={prefs.text === 0}
                onClick={() => update({ ...prefs, text: Math.max(0, prefs.text - 1) as Prefs['text'] })}
                className="grid size-8 place-items-center rounded-btn border border-line bg-surface disabled:opacity-40"
              >
                <Minus aria-hidden className="size-4" />
              </button>
              <span className="w-10 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">
                {100 + prefs.text * 15}%
              </span>
              <button
                type="button"
                aria-label={a.larger}
                disabled={prefs.text === 3}
                onClick={() => update({ ...prefs, text: Math.min(3, prefs.text + 1) as Prefs['text'] })}
                className="grid size-8 place-items-center rounded-btn border border-line bg-surface disabled:opacity-40"
              >
                <Plus aria-hidden className="size-4" />
              </button>
            </div>
          </div>
          <ul className="mt-2 flex flex-col">
            {TOGGLES.map((k) => (
              <li key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                <span id={`a11y-${k}`} className="text-[14px]">
                  {a[k]}
                </span>
                <Switch
                  checked={prefs[k]}
                  onCheckedChange={(on) => update({ ...prefs, [k]: on })}
                  label={a[k]}
                  aria-labelledby={`a11y-${k}`}
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => update(EMPTY)}
              className="inline-flex items-center gap-1.5 rounded-btn px-2 py-1.5 text-[13px] font-semibold text-muted hover:bg-subtle hover:text-ink"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              {a.reset}
            </button>
            <Link
              href="/accessibility"
              onClick={() => setOpen(false)}
              className="rounded-btn px-2 py-1.5 text-[13px] font-semibold text-brand-deep underline underline-offset-2"
            >
              {a.statement}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
