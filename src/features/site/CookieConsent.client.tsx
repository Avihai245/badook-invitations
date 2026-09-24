'use client';

import { Cookie } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, cn, Switch } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/**
 * Cookie consent (opt-in): essential cookies are always on; external content (YouTube, Vimeo,
 * Google Maps on the site's own pages) loads only once the visitor allows it. The choice is kept for a
 * year in a first-party cookie, so the server could read it too; changing it later: the footer's
 * "cookie settings" (the `cookies:open` event).
 */
export interface Consent {
  v: 1;
  media: boolean;
  /** ISO date of the choice */
  at: string;
}

const COOKIE = 'cookie_consent';
const CHANGED = 'cookies:change';
const OPEN = 'cookies:open';
const YEAR = 60 * 60 * 24 * 365;

function readCookie(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    return value.v === 1 && typeof value.media === 'boolean'
      ? { v: 1, media: value.media, at: String(value.at ?? '') }
      : null;
  } catch {
    return null;
  }
}

let cached: Consent | null | undefined;
const snapshot = () => (cached === undefined ? (cached = readCookie()) : cached);

export function saveConsent(media: boolean) {
  const value: Consent = { v: 1, media, at: new Date().toISOString() };
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`;
  cached = value;
  window.dispatchEvent(new Event(CHANGED));
}

/** The visitor's choice (null: not made yet, or during server rendering). */
export function useConsent(): Consent | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGED, onChange);
      return () => window.removeEventListener(CHANGED, onChange);
    },
    snapshot,
    () => null,
  );
}

/** The footer's "cookie settings": opens the banner on its settings. */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN))}>
      {label}
    </button>
  );
}

/** The banner: shown until the visitor chooses; "settings" lists the categories with switches. */
export function CookieConsent() {
  const { t } = useUi();
  const c = t.site.cookies;
  const consent = useConsent();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [media, setMedia] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onOpen = () => {
      setMedia(readCookie()?.media ?? false);
      setDetail(true);
      setOpen(true);
    };
    window.addEventListener(OPEN, onOpen);
    return () => window.removeEventListener(OPEN, onOpen);
  }, []);

  if (!mounted || (consent && !open)) return null;
  const choose = (allowMedia: boolean) => {
    saveConsent(allowMedia);
    setOpen(false);
    setDetail(false);
  };

  return (
    <section
      role="region"
      aria-label={c.label}
      data-testid="cookie-banner"
      className="site-swap fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[680px] rounded-[18px] border border-line bg-surface p-5 shadow-[0_24px_60px_-12px_rgba(28,25,23,0.35)] sm:inset-x-6 sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
        >
          <Cookie className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold">{c.title}</h2>
          {detail ? (
            <ul className="mt-3 flex flex-col gap-3">
              <li className="flex items-start justify-between gap-4 rounded-card bg-canvas p-3">
                <div>
                  <p className="text-[14px] font-semibold">{c.categories.necessary.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{c.categories.necessary.body}</p>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-success">
                  {c.categories.necessary.always}
                </span>
              </li>
              <li className="flex items-start justify-between gap-4 rounded-card bg-canvas p-3">
                <div>
                  <p id="cookie-media" className="text-[14px] font-semibold">
                    {c.categories.media.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">{c.categories.media.body}</p>
                </div>
                <Switch
                  checked={media}
                  onCheckedChange={setMedia}
                  label={c.categories.media.title}
                  aria-labelledby="cookie-media"
                  className="mt-1 shrink-0"
                />
              </li>
            </ul>
          ) : (
            <p className="mt-1 text-[14px] text-pretty text-muted">
              {c.body}{' '}
              <Link href="/cookies" className="font-semibold text-brand-deep underline underline-offset-2">
                {c.policy}
              </Link>
            </p>
          )}
          <div className={cn('mt-4 flex flex-wrap gap-2', detail && 'justify-end')}>
            {detail ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (consent ? setOpen(false) : setDetail(false))}
                >
                  {c.back}
                </Button>
                <Button size="sm" onClick={() => choose(media)}>
                  {c.save}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => choose(true)}>
                  {c.acceptAll}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => choose(false)}>
                  {c.necessaryOnly}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDetail(true)}>
                  {c.settings}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
