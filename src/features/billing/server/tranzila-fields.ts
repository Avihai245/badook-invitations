import 'server-only';

/**
 * The fields Tranzila sent: the address's query and the body (a form, or JSON), the body winning.
 * null when the body is too big to be Tranzila's.
 */
export async function requestFields(request: Request): Promise<Record<string, string> | null> {
  const fields: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) fields[k] = v;
  if (request.method !== 'POST') return fields;
  const raw = await request.text();
  if (raw.length > 64 * 1024) return null;
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    try {
      const json = JSON.parse(raw) as unknown;
      if (json && typeof json === 'object')
        for (const [k, v] of Object.entries(json))
          if (typeof v === 'string' || typeof v === 'number') fields[k] = String(v);
    } catch {
      // not JSON after all: what the address carried is all there is
    }
  } else for (const [k, v] of new URLSearchParams(raw)) fields[k] = v;
  return fields;
}
