import 'server-only';
import { after } from 'next/server';
import { adminNudge, type AdminNudgeKind } from './live';

/**
 * Tells the admin console's open pages that something changed — after the answer (next/server
 * `after`), so it never slows the request down or fails it. Outside a request (a route's unit test)
 * there is nothing to wait for, and nothing is sent.
 */
export function nudgeAfter(kind: AdminNudgeKind): void {
  try {
    after(() => adminNudge(kind));
  } catch {
    // not in a request
  }
}

/** A route's answer, and the console told when it succeeded. */
export function nudgeIfOk<R extends { ok: boolean }>(res: R, kind: AdminNudgeKind): R {
  if (res.ok) nudgeAfter(kind);
  return res;
}
