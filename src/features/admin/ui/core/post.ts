/** What a console action answered: ok, or the reason it was refused ('network' when nothing came back). */
export type ActionAnswer<T = Record<string, unknown>> =
  { ok: true; body: T } | { ok: false; status: number; code: string; body: Record<string, unknown> | null };

/** A JSON call to one of the console's actions (/api/admin/*). Never throws. */
export async function adminCall<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<ActionAnswer<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, status: 0, code: 'network', body: null };
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return { ok: true, body: (json ?? {}) as T };
  const code = typeof json?.code === 'string' ? json.code : res.status >= 500 ? 'server_error' : 'conflict';
  return { ok: false, status: res.status, code, body: json };
}
