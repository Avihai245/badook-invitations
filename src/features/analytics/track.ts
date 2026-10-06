import { privacySignal } from '@/features/insights/client/beacon';
import type { HostEventName } from './model';

/**
 * Sends one step of the host's path (features/analytics) — fire and forget: sendBeacon when the page
 * may be leaving (a link's click), else a keepalive fetch. Nothing under Global Privacy Control or Do
 * Not Track, nothing in automated browsers (the tests), and a failure is never the host's problem.
 */
export function track(
  name: HostEventName,
  opts: { invitationId?: string; props?: Record<string, string | number | boolean> } = {},
): void {
  try {
    if (typeof window === 'undefined' || privacySignal() || navigator.webdriver) return;
    const body = JSON.stringify({ name, ...opts });
    const blob = new Blob([body], { type: 'application/json' });
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/track', blob)) return;
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // measuring never breaks the page
  }
}
