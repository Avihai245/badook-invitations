'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Pin } from '../model';

/**
 * The review's comment pins drawn over the invitation — on the family's review page and in the
 * editor's preview (the same renderer, sections marked with their paths: `sections.<n>`). A pin sits at
 * its spot of its section (x from the reading side, so it follows a mirrored layout), numbered; it is
 * a button (keyboard, screen readers) that opens its comment. Positions are measured from the page
 * and measured again whenever it moves: resizes, fonts, pictures, entrances ending.
 */

export interface PinPlace {
  pin: Pin;
  left: number;
  top: number;
}

/** Where a spot of a section is on the page (null: the section isn't shown). */
export function placeOf(index: number, x: number, y: number): { left: number; top: number } | null {
  const el = document.querySelector<HTMLElement>(`[data-edit-path="sections.${index}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const rtl = getComputedStyle(el).direction === 'rtl';
  const fx = rtl ? 1 - x : x;
  return { left: r.left + window.scrollX + fx * r.width, top: r.top + window.scrollY + y * r.height };
}

/** The spot a tap at (clientX, clientY) is on: its section's index and x (from the reading side), y. */
export function spotAt(
  target: Element,
  clientX: number,
  clientY: number,
): { index: number; x: number; y: number } | null {
  const el = target.closest<HTMLElement>('[data-edit-path^="sections."]');
  if (!el) return null;
  // the section itself (its root carries exactly "sections.<n>")
  let root: HTMLElement | null = el;
  while (root && !/^sections\.\d+$/.test(root.dataset.editPath ?? '')) {
    root = root.parentElement?.closest<HTMLElement>('[data-edit-path^="sections."]') ?? null;
  }
  if (!root) return null;
  const index = Number(root.dataset.editPath!.slice(9));
  const r = root.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const rtl = getComputedStyle(root).direction === 'rtl';
  const px = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { index, x: round(rtl ? 1 - px : px), y: round(y) };
}

/** The pins' places on the page, kept current. */
export function usePinPlaces(pins: readonly Pin[], indexOf: (sectionId: string) => number): PinPlace[] {
  const [places, setPlaces] = useState<PinPlace[]>([]);
  const measure = useCallback(() => {
    const next: PinPlace[] = [];
    for (const pin of pins) {
      const index = indexOf(pin.sectionId);
      if (index < 0) continue;
      const at = placeOf(index, pin.x, pin.y);
      if (at) next.push({ pin, ...at });
    }
    setPlaces((prev) =>
      prev.length === next.length &&
      prev.every(
        (p, i) =>
          p.pin === next[i]!.pin &&
          Math.abs(p.left - next[i]!.left) < 0.5 &&
          Math.abs(p.top - next[i]!.top) < 0.5,
      )
        ? prev
        : next,
    );
  }, [pins, indexOf]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    let frame = 0;
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(soon);
    observer.observe(document.body);
    window.addEventListener('resize', soon);
    document.addEventListener('transitionend', soon, true);
    document.addEventListener('animationend', soon, true);
    document.addEventListener('load', soon, true);
    void document.fonts?.ready.then(soon);
    // entrances and pictures still arriving in the first moments
    const timer = window.setInterval(soon, 700);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8_000);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', soon);
      document.removeEventListener('transitionend', soon, true);
      document.removeEventListener('animationend', soon, true);
      document.removeEventListener('load', soon, true);
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [measure]);
  return places;
}

export function PinLayer({
  pins,
  indexOf,
  onPin,
  label,
  pinLabel,
}: {
  pins: readonly Pin[];
  /** a section's index in the document (-1: gone) */
  indexOf: (sectionId: string) => number;
  onPin: (id: string) => void;
  /** the layer's name for screen readers */
  label: string;
  pinLabel: (pin: Pin) => string;
}) {
  const places = usePinPlaces(pins, indexOf);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    // under the invitation's cover while it is up (CoverOverlay makes these inert meanwhile)
    <div
      className="review-pins"
      role="group"
      aria-label={label}
      data-testid="review-pins"
      data-under-cover=""
    >
      {places.map(({ pin, left, top }) => (
        <button
          key={pin.id}
          type="button"
          className="review-pin"
          data-status={pin.status}
          data-active={pin.active ? '' : undefined}
          data-pin={pin.number}
          aria-label={pinLabel(pin)}
          aria-pressed={pin.active ? true : undefined}
          style={{ left, top }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPin(pin.id);
          }}
        >
          <span aria-hidden>{pin.number}</span>
        </button>
      ))}
    </div>,
    host,
  );
}

/** The pins' look (inlined where the layer is used: the review page, the editor's preview). */
export const PIN_CSS = `
.review-pins{position:absolute;top:0;left:0;width:0;height:0;z-index:40;pointer-events:none}
.review-pin{position:absolute;transform:translate(0,-100%);pointer-events:auto;display:grid;place-items:center;min-width:32px;height:32px;padding:0 6px;border:2px solid #fff;border-radius:16px 16px 16px 4px;background:#b42318;color:#fff;font:700 14px/1 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer}
[dir=rtl] .review-pin{transform:translate(-100%,-100%);border-radius:16px 16px 4px 16px}
.review-pin[data-status=handled]{background:#57534e;opacity:.85}
.review-pin[data-active]{outline:3px solid #fff;box-shadow:0 0 0 6px #b42318,0 2px 10px rgba(0,0,0,.4);z-index:1}
.review-pin:focus-visible{outline:3px solid #1d4ed8;outline-offset:2px}
@media (forced-colors:active){.review-pin{border-color:CanvasText;background:Highlight;color:HighlightText}}
`;
