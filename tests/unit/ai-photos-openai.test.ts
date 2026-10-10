import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OpenAI's image model for the AI photos (features/ai-photos/server/openai.ts) over a fake `fetch`:
 * the Images API's edits (every photo as `image[]`, the model, size, quality, JPEG; the photo decoded),
 * what a model doesn't take asked again without it, a model OpenAI doesn't know → gpt-image-2, the
 * content rules ('blocked'), temporary failures; background mode (started → pending, checked → done,
 * refused, failed), and `auto` falling back to the Images API when background mode isn't taken.
 */

vi.mock('server-only', () => ({}));
const ai = await import('@/features/ai-photos/server/openai');

const cfg = {
  apiKey: 'sk-test',
  apiBase: 'https://openai.test',
  model: 'gpt-image-2.5-preview',
  quality: 'medium' as const,
  transport: 'images' as const,
  mainline: 'gpt-5',
  timeoutMs: 5_000,
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const req = {
  prompt: 'Image 1 … the request',
  images: [
    { bytes: JPEG, type: 'image/jpeg', name: 'photo.jpg' },
    { bytes: JPEG, type: 'image/jpeg', name: 'person-1.jpg' },
    { bytes: JPEG, type: 'image/jpeg', name: 'person-2.jpg' },
  ],
  size: '1024x1536' as const,
};
const b64 = Buffer.from('made-by-the-model').toString('base64');

type Call = { url: string; init: RequestInit };
function fakeFetch(answers: ((call: Call) => Response)[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    const next = answers.shift();
    if (!next) throw new Error('no more answers');
    return next(call);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => ai.resetOpenAiImageState());

describe('the Images API (edits)', () => {
  it('sends every photo as image[], with the model, size, quality and JPEG — and decodes the photo', async () => {
    const f = fakeFetch([() => json(200, { data: [{ b64_json: b64 }] })]);
    const out = await ai.startImage(req, cfg, f.fn);
    expect(out).toEqual({ status: 'done', image: new Uint8Array(Buffer.from('made-by-the-model')) });
    expect(f.calls[0]!.url).toBe('https://openai.test/v1/images/edits');
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    const form = f.calls[0]!.init.body as FormData;
    expect(form.getAll('image[]')).toHaveLength(3);
    expect(form.get('model')).toBe('gpt-image-2.5-preview');
    expect(form.get('size')).toBe('1024x1536');
    expect(form.get('quality')).toBe('medium');
    expect(form.get('output_format')).toBe('jpeg');
    expect(form.get('n')).toBe('1');
    expect(form.get('prompt')).toBe(req.prompt);
    // gpt-image-2 always reads its inputs at high fidelity: the setting isn't sent
    expect(form.get('input_fidelity')).toBeNull();
  });

  it('a model that doesn’t take the output format: asked again without it (and remembered)', async () => {
    const f = fakeFetch([
      () => json(400, { error: { message: 'Unknown parameter: output_format', param: 'output_format' } }),
      () => json(200, { data: [{ b64_json: b64 }] }),
      () => json(200, { data: [{ b64_json: b64 }] }),
    ]);
    expect((await ai.startImage(req, cfg, f.fn)).status).toBe('done');
    expect((f.calls[1]!.init.body as FormData).get('output_format')).toBeNull();
    await ai.startImage(req, cfg, f.fn);
    expect((f.calls[2]!.init.body as FormData).get('output_format')).toBeNull();
  });

  it('a model OpenAI doesn’t know: gpt-image-2 instead', async () => {
    const f = fakeFetch([
      () =>
        json(404, {
          error: { message: 'The model `gpt-image-2.5-preview` does not exist', code: 'model_not_found' },
        }),
      () => json(200, { data: [{ b64_json: b64 }] }),
    ]);
    expect((await ai.startImage(req, cfg, f.fn)).status).toBe('done');
    expect((f.calls[1]!.init.body as FormData).get('model')).toBe('gpt-image-2');
  });

  it('the content rules refuse: blocked (not retried)', async () => {
    const f = fakeFetch([
      () =>
        json(400, {
          error: { message: 'Your request was rejected by the safety system.', code: 'moderation_blocked' },
        }),
    ]);
    const out = await ai.startImage(req, cfg, f.fn);
    expect(out.status).toBe('blocked');
    expect(f.calls).toHaveLength(1);
  });

  it('busy or down: a temporary error; a wrong key: not', async () => {
    const busy = fakeFetch([() => json(429, { error: { message: 'Rate limit' } })]);
    expect(await ai.startImage(req, cfg, busy.fn)).toMatchObject({ status: 'error', retryable: true });
    const down = fakeFetch([() => json(503, {})]);
    expect(await ai.startImage(req, cfg, down.fn)).toMatchObject({ status: 'error', retryable: true });
    const key = fakeFetch([() => json(401, { error: { message: 'Incorrect API key' } })]);
    expect(await ai.startImage(req, cfg, key.fn)).toMatchObject({ status: 'error', retryable: false });
    const lost = {
      fn: (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
    };
    expect(await ai.startImage(req, cfg, lost.fn)).toMatchObject({ status: 'error', retryable: true });
  });
});

describe('background mode (the Responses API)', () => {
  const bg = { ...cfg, transport: 'background' as const, model: 'gpt-image-2' };

  it('starts at once: the image tool on the model, the photos as input images → pending', async () => {
    const f = fakeFetch([() => json(200, { id: 'resp_1', status: 'queued' })]);
    expect(await ai.startImage(req, bg, f.fn)).toEqual({ status: 'pending', externalId: 'resp_1' });
    expect(f.calls[0]!.url).toBe('https://openai.test/v1/responses');
    const body = JSON.parse(String(f.calls[0]!.init.body));
    expect(body.background).toBe(true);
    expect(body.model).toBe('gpt-5');
    expect(body.tools).toEqual([
      {
        type: 'image_generation',
        model: 'gpt-image-2',
        quality: 'medium',
        size: '1024x1536',
        output_format: 'jpeg',
      },
    ]);
    expect(body.tool_choice).toEqual({ type: 'image_generation' });
    const content = body.input[0].content;
    expect(content[0]).toEqual({ type: 'input_text', text: req.prompt });
    expect(content.slice(1).map((c: { type: string }) => c.type)).toEqual([
      'input_image',
      'input_image',
      'input_image',
    ]);
    expect(content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('checked: still working, done, refused, failed', async () => {
    const working = fakeFetch([() => json(200, { id: 'resp_1', status: 'in_progress' })]);
    expect(await ai.checkImage('resp_1', bg, working.fn)).toEqual({
      status: 'pending',
      externalId: 'resp_1',
    });
    expect(working.calls[0]!.url).toBe('https://openai.test/v1/responses/resp_1');
    const done = fakeFetch([
      () =>
        json(200, {
          id: 'resp_1',
          status: 'completed',
          output: [{ type: 'image_generation_call', status: 'completed', result: b64 }],
        }),
    ]);
    expect(await ai.checkImage('resp_1', bg, done.fn)).toEqual({
      status: 'done',
      image: new Uint8Array(Buffer.from('made-by-the-model')),
    });
    const refused = fakeFetch([
      () =>
        json(200, {
          id: 'resp_1',
          status: 'completed',
          output: [{ type: 'image_generation_call', status: 'failed', result: null }],
        }),
    ]);
    expect((await ai.checkImage('resp_1', bg, refused.fn)).status).toBe('blocked');
    const policy = fakeFetch([
      () =>
        json(200, {
          id: 'resp_1',
          status: 'failed',
          error: { code: 'content_policy_violation', message: 'no' },
        }),
    ]);
    expect((await ai.checkImage('resp_1', bg, policy.fn)).status).toBe('blocked');
    const failed = fakeFetch([
      () => json(200, { id: 'resp_1', status: 'failed', error: { code: 'server_error', message: 'oops' } }),
    ]);
    expect(await ai.checkImage('resp_1', bg, failed.fn)).toMatchObject({ status: 'error', retryable: true });
    // OpenAI busy while checking: ask again later
    const busy = fakeFetch([() => json(503, {})]);
    expect(await ai.checkImage('resp_1', bg, busy.fn)).toEqual({ status: 'pending', externalId: 'resp_1' });
  });

  it('a text model without the reasoning setting: asked again without it', async () => {
    const f = fakeFetch([
      () =>
        json(400, {
          error: { message: 'Unsupported parameter: reasoning.effort', param: 'reasoning.effort' },
        }),
      () => json(200, { id: 'resp_2', status: 'queued' }),
    ]);
    expect(await ai.startImage(req, bg, f.fn)).toEqual({ status: 'pending', externalId: 'resp_2' });
    expect(JSON.parse(String(f.calls[1]!.init.body)).reasoning).toBeUndefined();
  });

  it('auto: background first; when the account doesn’t take it, the Images API (and remembered)', async () => {
    const auto = { ...cfg, transport: 'auto' as const };
    const f = fakeFetch([
      () =>
        json(400, {
          error: { message: "Tool 'image_generation' is not supported with this model.", param: 'tools' },
        }),
      () => json(200, { data: [{ b64_json: b64 }] }),
      () => json(200, { data: [{ b64_json: b64 }] }),
    ]);
    expect((await ai.startImage(req, auto, f.fn)).status).toBe('done');
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://openai.test/v1/responses',
      'https://openai.test/v1/images/edits',
    ]);
    await ai.startImage(req, auto, f.fn);
    expect(f.calls[2]!.url).toBe('https://openai.test/v1/images/edits');
  });

  it('background only, and it isn’t taken: an error that won’t go away by itself', async () => {
    const f = fakeFetch([
      () => json(400, { error: { message: 'background mode is not available', param: 'background' } }),
    ]);
    expect(await ai.startImage(req, bg, f.fn)).toMatchObject({ status: 'error', retryable: false });
  });
});
