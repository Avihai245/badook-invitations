/**
 * A request's body as text, at most `maxBytes` of it — null when it is bigger. A declared Content-Length
 * over the cap is refused before anything is read, and the body is read as a stream that stops as soon as
 * it passes the cap (a chunked body, or one that lies about its length, is never buffered whole).
 */
export async function readCappedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** The body parsed as JSON — null when it is bigger than `maxBytes` or isn't JSON (like `.json().catch`). */
export async function readCappedJson(request: Request, maxBytes: number): Promise<unknown> {
  const text = await readCappedText(request, maxBytes);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
