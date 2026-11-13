import { describe, expect, it } from 'vitest';
import { readCappedJson, readCappedText } from '@/lib/read-body';

/** Request bodies are read with a cap: never buffered whole when they are bigger than a route takes. */

const streamed = (parts: Uint8Array[], headers: Record<string, string> = {}) => {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled < parts.length) controller.enqueue(parts[pulled++]);
        else controller.close();
      },
      // nothing is pulled until the reader asks
    },
    { highWaterMark: 0 },
  );
  const request = new Request('https://x.test/api', {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  } as RequestInit);
  return { request, pulled: () => pulled };
};

describe('readCappedText', () => {
  it('reads a body within the cap, multi-byte characters split across chunks included', async () => {
    const bytes = new TextEncoder().encode('{"name":"דנה"}');
    const { request } = streamed([bytes.subarray(0, 10), bytes.subarray(10)]);
    expect(await readCappedText(request, 1024)).toBe('{"name":"דנה"}');
  });

  it('refuses a declared Content-Length over the cap before reading anything', async () => {
    const { request, pulled } = streamed([new Uint8Array(10)], { 'content-length': '5000' });
    expect(await readCappedText(request, 1024)).toBeNull();
    expect(pulled()).toBe(0);
  });

  it('stops reading a chunked body as soon as it passes the cap', async () => {
    const chunk = new Uint8Array(400);
    const { request, pulled } = streamed(Array.from({ length: 100 }, () => chunk));
    expect(await readCappedText(request, 1000)).toBeNull();
    expect(pulled()).toBeLessThan(10);
  });

  it('an empty body is empty text', async () => {
    const request = new Request('https://x.test/api', { method: 'POST' });
    expect(await readCappedText(request, 10)).toBe('');
  });
});

describe('readCappedJson', () => {
  it('parses JSON; null for too large or not JSON', async () => {
    const json = (text: string) =>
      new Request('https://x.test/api', {
        method: 'POST',
        body: text,
        headers: { 'content-type': 'application/json' },
      });
    expect(await readCappedJson(json('{"a":1}'), 100)).toEqual({ a: 1 });
    expect(await readCappedJson(json('{"a":'), 100)).toBeNull();
    expect(await readCappedJson(json(`{"a":"${'x'.repeat(200)}"}`), 100)).toBeNull();
  });
});
