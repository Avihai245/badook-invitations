/** Result of a gallery API call: status 0 when the network failed (offline, dropped, timed out). */
export interface GalleryResponse<T> {
  status: number;
  ok: boolean;
  body: T | null;
}

/**
 * POST JSON to a gallery API route (the guests' and the screen's: /api/gallery/*). Never throws for
 * network failures — they come back as status 0 so the queue can wait and retry.
 */
export async function galleryApi<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  { signal, timeoutMs = 30_000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<GalleryResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(path, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, ok: res.ok, body: parsed };
  } catch {
    return { status: 0, ok: false, body: null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
