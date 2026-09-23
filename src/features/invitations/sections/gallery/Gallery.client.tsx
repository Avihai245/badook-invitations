'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

export interface GalleryLabels {
  label: string;
  /** "Enlarge photo {n} of {total}" */
  open: string;
  close: string;
  prev: string;
  next: string;
  /** "{n} of {total}" */
  counter: string;
}

const fill = (s: string, n: number, total: number) =>
  s.replace('{n}', String(n)).replace('{total}', String(total));
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isRtl = (el: Element | null) => !!el && getComputedStyle(el).direction === 'rtl';

/**
 * Gallery (§2.2 sections 8): a swipeable carousel (scroll-snap, dots, arrows from 640px) or a grid;
 * a photo opens in a lightbox (swipe / arrow keys / Esc, focus kept inside, back to the photo after).
 */
export function Gallery({
  images,
  layout,
  labels,
}: {
  images: GalleryImage[];
  layout: 'carousel' | 'grid';
  labels: GalleryLabels;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const total = images.length;
  const items = images.map((img, i) => (
    <button
      key={img.id}
      type="button"
      className="g-item"
      onClick={() => setOpen(i)}
      aria-label={
        img.alt ? `${img.alt} — ${fill(labels.open, i + 1, total)}` : fill(labels.open, i + 1, total)
      }
    >
      <img src={img.url} alt="" loading="lazy" decoding="async" draggable={false} />
    </button>
  ));
  return (
    <>
      {layout === 'carousel' ? (
        <Carousel count={total} labels={labels}>
          {items}
        </Carousel>
      ) : (
        <div className="g-grid">{items}</div>
      )}
      {open !== null ? (
        <Lightbox
          images={images}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          labels={labels}
        />
      ) : null}
    </>
  );
}

function Carousel({
  count,
  labels,
  children,
}: {
  count: number;
  labels: GalleryLabels;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // the slide nearest the middle is the current one (works in both directions)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const middle = box.left + box.width / 2;
        let best = 0;
        let distance = Infinity;
        Array.from(el.children).forEach((kid, i) => {
          const r = kid.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - middle);
          if (d < distance) {
            distance = d;
            best = i;
          }
        });
        setIndex(best);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = (i: number) => {
    const el = track.current;
    const kid = el?.children[Math.max(0, Math.min(count - 1, i))] as HTMLElement | undefined;
    if (!el || !kid) return;
    // scroll the track only (scrollIntoView could move the page too)
    const delta =
      kid.getBoundingClientRect().left +
      kid.offsetWidth / 2 -
      (el.getBoundingClientRect().left + el.clientWidth / 2);
    el.scrollBy({ left: delta, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className="g-carousel">
      <div className="g-track" ref={track}>
        {children}
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            className="g-arrow g-prev"
            onClick={() => go(index - 1)}
            aria-label={labels.prev}
            disabled={index === 0}
          >
            <Icon name="chevron-left" size={22} />
          </button>
          <button
            type="button"
            className="g-arrow g-next"
            onClick={() => go(index + 1)}
            aria-label={labels.next}
            disabled={index === count - 1}
          >
            <Icon name="chevron-right" size={22} />
          </button>
          <div className="g-dots">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                className="g-dot"
                aria-label={fill(labels.counter, i + 1, count)}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  labels,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  labels: GalleryLabels;
}) {
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const swipe = useRef<number | null>(null);
  const total = images.length;
  const img = images[index]!;
  const step = useCallback(
    (delta: number) => onIndex((index + delta + total) % total),
    [index, total, onIndex],
  );

  // the neighbours load ahead, so stepping through is instant
  useEffect(() => {
    if (total < 2) return;
    for (const d of [1, -1]) new Image().src = images[(index + d + total) % total]!.url;
  }, [images, index, total]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    document.body.classList.add('lb-open');
    return () => {
      document.body.classList.remove('lb-open');
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = isRtl(box.current);
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowRight') step(rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') step(rtl ? 1 : -1);
    else if (e.key === 'Tab') {
      // focus stays in the lightbox
      const focusable = Array.from(box.current?.querySelectorAll<HTMLElement>('button') ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
      return;
    } else return;
    e.preventDefault();
  };
  const onPointerDown = (e: PointerEvent) => {
    swipe.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) < 50) return;
    // the finger moving toward the line's start (leftward in LTR) brings the next photo in
    const towardEnd = isRtl(box.current) ? dx > 0 : dx < 0;
    step(towardEnd ? 1 : -1);
  };

  return createPortal(
    <div
      ref={box}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={labels.label}
      dir={document.documentElement.dir}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <img key={img.id} src={img.url} alt={img.alt} className="lb-img" draggable={false} />
      <button
        ref={closeButton}
        type="button"
        className="lb-btn lb-close"
        onClick={onClose}
        aria-label={labels.close}
      >
        <Icon name="x" size={24} />
      </button>
      {total > 1 ? (
        <>
          <button type="button" className="lb-btn lb-prev" onClick={() => step(-1)} aria-label={labels.prev}>
            <Icon name="chevron-left" size={28} />
          </button>
          <button type="button" className="lb-btn lb-next" onClick={() => step(1)} aria-label={labels.next}>
            <Icon name="chevron-right" size={28} />
          </button>
          <p className="lb-count" aria-live="polite">
            {fill(labels.counter, index + 1, total)}
          </p>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
