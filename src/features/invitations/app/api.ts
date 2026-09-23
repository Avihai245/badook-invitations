'use client';

/** Result of a host API call: the HTTP status and the parsed JSON body (null when there is none). */
export interface ApiResponse<T> {
  status: number;
  ok: boolean;
  body: T | null;
}

/**
 * fetch() for the host API routes: JSON in and out (the routes reject anything else — CSRF guard),
 * never cached, and network failures reported as status 0 instead of throwing.
 */
export async function hostApi<T = Record<string, unknown>>(
  url: string,
  {
    method = 'GET',
    body,
    signal,
  }: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      method,
      cache: 'no-store',
      signal,
      headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
    const parsed = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, ok: res.ok, body: parsed };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { status: 0, ok: false, body: null };
  }
}

/** Where a 401 from the API sends the host: sign in again, then back to this page. */
export function loginUrl(): string {
  return `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}
