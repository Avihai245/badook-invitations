import { INSIGHTS } from '../config';
import {
  INSIGHT_EVENTS,
  deviceOf,
  milestoneOf,
  sourceOf,
  withEvent,
  type BeaconState,
  type InsightEvent,
} from '../model';

/**
 * The invitation page's beacon (feature `analytics`), loaded only after the page is interactive: it
 * keeps this page load's state in memory — a random id, the language, the kind of device, where the
 * guest came from, whether the cover was opened, how far down they read, how long the page was on
 * screen (capped), and what they did (RSVP, calendar, map, gallery, language) — and sends all of it now
 * and then with navigator.sendBeacon. No cookie, nothing in storage: a reload is a new page load.
 * Clicks are read from `data-insight` attributes (map, calendar, gallery, lang), the RSVP form's first
 * touch from `data-insight-area="rsvp"`, its success from a `badook:insight` event, and the cover from
 * <html data-opened>.
 */

const ENDPOINT = '/api/insights';

/** Global Privacy Control or Do Not Track: nothing is measured at all. */
export function privacySignal(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === '1' ||
    nav.doNotTrack === 'yes' ||
    nav.msDoNotTrack === '1' ||
    win.doNotTrack === '1'
  );
}

function randomVisitId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const isEvent = (v: unknown): v is InsightEvent => INSIGHT_EVENTS.includes(v as InsightEvent);

/** Starts measuring this page load; returns what stops it (the last state goes out first). */
export function startBeacon({ slug }: { slug: string }): () => void {
  const root = document.documentElement;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  let state: BeaconState = {
    slug,
    visit: randomVisitId(),
    lang: (root.lang || 'he').slice(0, 2).toLowerCase(),
    device: deviceOf({
      ua: nav.userAgent,
      mobile: nav.userAgentData?.mobile ?? null,
      touchPoints: nav.maxTouchPoints,
    }),
    source: sourceOf(location.search, document.referrer, location.hostname),
    opened: !!root.dataset.opened,
    depth: 0,
    visibleMs: 0,
    rsvpStarted: false,
    rsvpSent: false,
    calendar: false,
    map: false,
    gallery: false,
    langSwitch: false,
  };

  // ── the time on screen ──
  let visibleTotal = 0;
  let visibleSince: number | null = document.visibilityState === 'visible' ? performance.now() : null;
  const visibleMs = () =>
    Math.min(
      INSIGHTS.beacon.maxVisibleMs,
      Math.round(visibleTotal + (visibleSince !== null ? performance.now() - visibleSince : 0)),
    );

  // ── sending ──
  let sent = '';
  let started = false;
  const send = () => {
    // a page that was never on screen (prerendered, a background tab) isn't a visit yet
    if (!started) {
      if (document.visibilityState !== 'visible') return;
      started = true;
    }
    state = { ...state, visibleMs: visibleMs() };
    const json = JSON.stringify(state);
    if (json === sent) return;
    sent = json;
    try {
      const ok = navigator.sendBeacon?.(ENDPOINT, new Blob([json], { type: 'application/json' }));
      if (!ok)
        void fetch(ENDPOINT, {
          method: 'POST',
          body: json,
          headers: { 'content-type': 'application/json' },
          keepalive: true,
          credentials: 'omit',
        }).catch(() => undefined);
    } catch {
      // nothing to do: the next beacon carries the whole state again
    }
  };
  let soon: number | null = null;
  const sendSoon = (ms = 800) => {
    if (soon !== null) return;
    soon = window.setTimeout(() => {
      soon = null;
      send();
    }, ms);
  };
  const flush = () => {
    if (soon !== null) {
      window.clearTimeout(soon);
      soon = null;
    }
    send();
  };
  const record = (event: InsightEvent) => {
    const next = withEvent(state, event);
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    sendSoon(300);
  };

  // ── what the guest does ──
  const onScroll = () => {
    if (!state.opened) return;
    const doc = document.scrollingElement ?? root;
    const depth = milestoneOf(window.scrollY + window.innerHeight, doc.scrollHeight);
    if (depth > state.depth) {
      state = { ...state, depth };
      sendSoon();
    }
  };
  let scrollQueued = false;
  const onScrollEvent = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      onScroll();
    });
  };
  const onClick = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.('[data-insight]') as HTMLElement | null;
    const name = el?.dataset.insight;
    if (isEvent(name)) record(name);
  };
  const onTouchForm = (e: Event) => {
    if (state.rsvpStarted) return;
    if ((e.target as Element | null)?.closest?.('[data-insight-area="rsvp"]')) record('rsvp_start');
  };
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail;
    if (isEvent(detail)) record(detail);
  };
  const opened = new MutationObserver(() => {
    if (root.dataset.opened && !state.opened) {
      state = { ...state, opened: true };
      sendSoon(300);
      onScroll();
    }
  });
  opened.observe(root, { attributes: true, attributeFilter: ['data-opened'] });

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (visibleSince === null) visibleSince = performance.now();
      sendSoon(300);
    } else {
      if (visibleSince !== null) visibleTotal += performance.now() - visibleSince;
      visibleSince = null;
      flush();
    }
  };
  const heartbeat = window.setInterval(() => {
    if (document.visibilityState === 'visible') send();
  }, INSIGHTS.beacon.heartbeatMs);

  window.addEventListener('scroll', onScrollEvent, { passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onTouchForm, true);
  document.addEventListener('input', onTouchForm, true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flush);
  window.addEventListener('badook:insight', onCustom);
  onScroll();
  send();

  return () => {
    flush();
    opened.disconnect();
    window.clearInterval(heartbeat);
    window.removeEventListener('scroll', onScrollEvent);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('focusin', onTouchForm, true);
    document.removeEventListener('input', onTouchForm, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('badook:insight', onCustom);
  };
}
