'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

/**
 * The full-screen story view of the gallery (guests' feed and the host's tab): one photo or video at a
 * time, swipe sideways for the next (towards the page's reading direction: in Hebrew the next one comes
 * from the left), swipe down or Esc to close, the arrow keys, Home / End. The thumbnail shows at once
 * and the display version fades in over it; the neighbours are fetched ahead. Videos play with their
 * controls (never on their own, never with sound unasked).
 */

export interface ViewerItem {
  id: string;
  kind: 'image' | 'video';
  display: string | null;
  thumb: string | null;
  video: string | null;
  width: number | null;
  height: number | null;
}

export interface MediaViewerProps<T extends ViewerItem> {
  items: readonly T[];
  index: number;
  onIndex(index: number): void;
  onClose(): void;
  dir: 'rtl' | 'ltr';
  labels: { label: string; close: string; next: string; previous: string; position: string };
  /** under the photo: who took it, the host's actions… */
  footer?: (item: T) => ReactNode;
  /** close to the end of what is loaded: fetch more */
  onNearEnd?(): void;
}

const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export function MediaViewer<T extends ViewerItem>({
  items,
  index,
  onIndex,
  onClose,
  dir,
  labels,
  footer,
  onNearEnd,
}: MediaViewerProps<T>) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= items.length) return;
      onIndex(next);
    },
    [index, items.length, onIndex],
  );

  // the page underneath doesn't scroll; focus comes back to what opened the viewer
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === 'Escape') onClose();
      else if (e.key === forward) go(1);
      else if (e.key === back) go(-1);
      else if (e.key === 'Home') onIndex(0);
      else if (e.key === 'End') onIndex(items.length - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, go, onClose, onIndex, items.length]);

  // fetch the neighbours ahead; ask for more near the end
  useEffect(() => {
    for (const n of [items[index + 1], items[index - 1]])
      if (n?.kind === 'image' && n.display) new Image().src = n.display;
    if (index >= items.length - 3) onNearEnd?.();
  }, [index, items, onNearEnd]);

  if (!item) return null;
  const src = item.display ?? item.thumb;

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, video, [data-no-swipe]')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setDrag({ x: 0, y: 0 });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  };
  const onPointerEnd = (e: PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    setDrag(null);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      // the next one comes from the reading direction's end
      const forward = dir === 'rtl' ? dx > 0 : dx < 0;
      go(forward ? 1 : -1);
    } else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
  };

  const PrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const button =
    'grid size-11 place-items-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/22 focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-0';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.label}
      dir={dir}
      data-testid="media-viewer"
      className="fixed inset-0 z-[90] flex touch-none flex-col bg-black text-white select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <p className="text-[13px] font-medium text-white/80 tabular-nums" aria-live="polite">
          {fill(labels.position, { i: index + 1, n: items.length })}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={labels.close} className={button}>
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 grid place-items-center px-2 transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={
            drag
              ? {
                  transform: `translate(${drag.x}px, ${Math.max(0, drag.y) * 0.6}px)`,
                  transition: 'none',
                  opacity: 1 - Math.min(0.5, Math.max(0, drag.y) / 400),
                }
              : undefined
          }
        >
          {item.kind === 'video' && item.video ? (
            <video
              key={item.id}
              src={item.video}
              poster={item.display ?? item.thumb ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="max-h-full max-w-full rounded-[6px] bg-black"
            />
          ) : src ? (
            <div key={item.id} className="relative grid max-h-full max-w-full place-items-center">
              {item.thumb && loaded !== item.id ? (
                <img
                  src={item.thumb}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 m-auto max-h-full max-w-full scale-100 object-contain blur-[2px]"
                />
              ) : null}
              <img
                src={src}
                alt=""
                draggable={false}
                onLoad={() => setLoaded(item.id)}
                className="relative max-h-[calc(100svh-150px)] max-w-full object-contain transition-opacity duration-300 motion-reduce:transition-none"
                style={{ opacity: loaded === item.id || !item.thumb ? 1 : 0 }}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label={labels.previous}
          className={`${button} absolute start-3 top-1/2 -translate-y-1/2 max-sm:hidden`}
        >
          <PrevIcon aria-hidden className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index >= items.length - 1}
          aria-label={labels.next}
          className={`${button} absolute end-3 top-1/2 -translate-y-1/2 max-sm:hidden`}
        >
          <NextIcon aria-hidden className="size-6" />
        </button>
      </div>
      <div className="min-h-[56px] px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]" data-no-swipe>
        {footer?.(item)}
      </div>
    </div>
  );
}
