'use client';

import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { cn, iconSlot } from './utils';

export type ToastVariant = 'default' | 'success' | 'danger';

export type ToastOptions = {
  /** Reuse an id to replace a toast in place (e.g. "Saving…" → "Saved"). */
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** ms before auto-dismiss; `Infinity` = persistent (stays until closed or acted on). */
  duration?: number;
  /** One action button, e.g. "ניסיון חוזר". `altText` tells screen-reader users how else to do it. */
  action?: { label: ReactNode; altText: string; onClick: () => void };
  /** Custom leading icon, or `false` for none. Defaults per variant (success check / danger alert). */
  icon?: ReactNode | false;
};

type ToastItem = ToastOptions & { id: string; open: boolean };

export type ToastApi = {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => string;
  /** Closes one toast (animated), or all of them. */
  dismiss: (id?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Push toasts from anywhere under `<ToastProvider>`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast() must be used inside <ToastProvider>.');
  return api;
}

export type ToastProviderProps = {
  children: ReactNode;
  /** Screen-reader prefix announced with every toast, e.g. "התראה". */
  label: string;
  /** Landmark name of the viewport; `{hotkey}` is replaced (F8), e.g. "התראות ({hotkey})". */
  viewportLabel: string;
  /** aria-label of each toast's close button. */
  closeLabel: string;
  /** Default auto-dismiss in ms (5000). */
  duration?: number;
};

const EXIT_MS = 200;
let seq = 0;

/**
 * Radix Toast provider + viewport + `useToast()` store. Viewport: bottom-center on mobile, bottom
 * inline-end from 640px (a flex column aligned to `end`, so it follows the page direction). Swipe to
 * dismiss goes toward the inline-end edge. Danger toasts are announced assertively.
 */
export function ToastProvider({
  children,
  label,
  viewportLabel,
  closeLabel,
  duration = 5000,
}: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [swipe, setSwipe] = useState<'left' | 'right'>('right');
  const viewportRef = useRef<HTMLOListElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Swipe toward the inline-end edge the viewport sits on: right in LTR, left in RTL. Measured on
  // mount and again whenever a toast is pushed, so a later direction change is picked up.
  const measureSwipe = useCallback(() => {
    const el = viewportRef.current;
    if (el) setSwipe(getComputedStyle(el).direction === 'rtl' ? 'left' : 'right');
  }, []);
  useEffect(measureSwipe, [measureSwipe]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const close = useCallback((id?: string) => {
    setItems((list) => list.map((t) => (id === undefined || t.id === id ? { ...t, open: false } : t)));
    // Unmount once the exit animation is over (Radix keeps a closed toast mounted while it animates out).
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((list) => list.filter((t) => t.open || (id !== undefined && t.id !== id)));
    }, EXIT_MS + 50);
    timers.current.add(timer);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      measureSwipe();
      const id = options.id ?? `toast-${++seq}`;
      setItems((list) => {
        const next: ToastItem = { ...options, id, open: true };
        return list.some((t) => t.id === id) ? list.map((t) => (t.id === id ? next : t)) : [...list, next];
      });
      return id;
    },
    [measureSwipe],
  );

  const api = useMemo<ToastApi>(() => ({ toast, dismiss: close }), [toast, close]);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider label={label} duration={duration} swipeDirection={swipe}>
        {children}
        {items.map((item) => (
          <ToastCard key={item.id} item={item} closeLabel={closeLabel} onClose={() => close(item.id)} />
        ))}
        <RadixToast.Viewport
          ref={viewportRef}
          label={viewportLabel}
          className={cn(
            'pointer-events-none fixed inset-x-0 bottom-0 z-[100] m-0 flex max-h-dvh list-none flex-col items-center gap-2 p-4 outline-none',
            'sm:items-end sm:p-6',
          )}
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

const VARIANT_ICON: Record<ToastVariant, ReactNode> = {
  default: null,
  success: <CircleCheck className="text-success" />,
  danger: <CircleAlert className="text-danger" />,
};

function ToastCard({
  item,
  closeLabel,
  onClose,
}: {
  item: ToastItem;
  closeLabel: string;
  onClose: () => void;
}) {
  const variant = item.variant ?? 'default';
  const icon = item.icon === false ? null : (item.icon ?? VARIANT_ICON[variant]);
  return (
    <RadixToast.Root
      open={item.open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      duration={item.duration}
      type={variant === 'danger' ? 'foreground' : 'background'}
      className={cn(
        'slide-from-end pointer-events-auto relative flex w-full max-w-[400px] items-start gap-3 rounded-card border bg-surface p-3.5 shadow-lg',
        variant === 'danger' ? 'border-[#fecaca]' : 'border-line',
        // Animations only with motion-safe (a data-state selector would out-specify motion-reduce:animate-none);
        // the swipe-follow translate is direct manipulation, so it stays.
        'motion-safe:data-[state=open]:animate-app-toast-in motion-safe:data-[state=closed]:animate-app-toast-out',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=cancel]:translate-x-0 motion-safe:data-[swipe=cancel]:transition-[translate] motion-safe:data-[swipe=cancel]:duration-200',
        'motion-safe:data-[swipe=end]:animate-app-toast-swipe-out',
      )}
    >
      {icon != null && (
        <span aria-hidden className={cn(iconSlot, 'mt-px [&_svg]:size-[18px]')}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <RadixToast.Title className="text-[14px] leading-snug font-semibold">{item.title}</RadixToast.Title>
        {item.description != null && (
          <RadixToast.Description className="mt-0.5 text-[13px] text-muted">
            {item.description}
          </RadixToast.Description>
        )}
        {item.action && (
          <RadixToast.Action altText={item.action.altText} asChild>
            <Button size="sm" variant="secondary" className="mt-2.5" onClick={item.action.onClick}>
              {item.action.label}
            </Button>
          </RadixToast.Action>
        )}
      </div>
      <RadixToast.Close asChild>
        <IconButton label={closeLabel} size="sm" className="-me-1.5 -mt-1.5">
          <X />
        </IconButton>
      </RadixToast.Close>
    </RadixToast.Root>
  );
}
