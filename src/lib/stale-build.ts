/**
 * A tab left open across a deployment still runs the previous build: its next lazy chunk or server
 * action no longer exists on the server, and the page looks frozen until a refresh. These are the
 * errors that mean exactly that (and nothing else), so the page can reload itself once.
 */
const STALE = [
  /ChunkLoadError/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Failed to find Server Action/i,
];

export function isStaleBuildError(error: unknown): boolean {
  if (!error) return false;
  const text =
    typeof error === 'string'
      ? error
      : `${(error as { name?: unknown }).name ?? ''} ${(error as { message?: unknown }).message ?? ''}`;
  return STALE.some((re) => re.test(text));
}

const KEY = 'badook:stale-reload';
/** One automatic reload per minute at most: a real outage never turns into a reload loop. */
export const STALE_RELOAD_GAP_MS = 60_000;

/** Reloads the page for a stale build, unless it just did. Returns whether it reloaded. */
export function reloadForNewBuild(now = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (now - last < STALE_RELOAD_GAP_MS) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    // no storage (private mode): still reload, the browser's own cache can't loop us
  }
  window.location.reload();
  return true;
}
