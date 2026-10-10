import 'server-only';
import type { ImageSize } from '../model';

/**
 * OpenAI's GPT Image model for the AI photos (feature ai_photos), two ways:
 *
 * - **images**: the Images API's edits (`/v1/images/edits`) — the guest's photo and the people's
 *   reference photos as `image[]`, the request as the prompt — one request that waits for the photo
 *   (20–90 seconds, longer at high quality).
 * - **background**: the Responses API in background mode (`/v1/responses`, `background: true`) with the
 *   image_generation tool on the same model and the same photos — started at once, then checked with
 *   short requests (`GET /v1/responses/{id}`) — for hosts that cut long requests (Amplify's 30 s).
 *
 * `auto` starts in the background and falls back to the Images API when the account or the model
 * doesn't take it (remembered per server). What a model doesn't take is learned from its answers and
 * asked again without it (the output format, the reasoning setting) — like the app's other AI clients;
 * a model id OpenAI doesn't know falls back to gpt-image-2. Only the photos and the request are sent:
 * no names of the guest, no account, no ids. Plain functions over `fetch` (tests/unit/ai-photos-openai.test.ts).
 */

export const FALLBACK_IMAGE_MODEL = 'gpt-image-2';

export interface ImageInput {
  bytes: Uint8Array;
  type: string;
  name: string;
}

export interface ImageRequest {
  prompt: string;
  /** the guest's photo first (when there is one), then each person's reference photo */
  images: ImageInput[];
  size: ImageSize;
}

export interface OpenAiImageConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  quality: 'low' | 'medium' | 'high';
  transport: 'auto' | 'images' | 'background';
  /** the text model that runs the image tool in background mode */
  mainline: string;
  timeoutMs: number;
}

export type ImageOutcome =
  | { status: 'done'; image: Uint8Array }
  | { status: 'pending'; externalId: string }
  | { status: 'blocked'; error: string }
  | { status: 'error'; error: string; retryable: boolean };

/** What this server learned the account and its models don't take. */
const learned = {
  backgroundUnsupported: false,
  noOutputFormat: false,
  noReasoning: false,
  /** the configured model wasn't found: gpt-image-2 instead */
  modelMissing: false,
};
export const resetOpenAiImageState = () => {
  learned.backgroundUnsupported = false;
  learned.noOutputFormat = false;
  learned.noReasoning = false;
  learned.modelMissing = false;
};

interface ApiError {
  message?: string;
  type?: string;
  code?: string | null;
  param?: string | null;
}

const BLOCKED = /moderation|safety|content[_ ]?policy|not allowed|disallowed/i;
const errorText = (status: number, e: ApiError | undefined) =>
  `${status} ${e?.code ?? e?.type ?? ''} ${e?.message ?? ''}`.trim().slice(0, 280);
const modelOf = (cfg: OpenAiImageConfig) => (learned.modelMissing ? FALLBACK_IMAGE_MODEL : cfg.model);
const missingModel = (status: number, e: ApiError | undefined) =>
  status === 404 ||
  e?.code === 'model_not_found' ||
  /model.*(does not exist|not found|invalid)/i.test(e?.message ?? '');

/** Starts a photo: done (the Images API), pending (background: check it later), blocked, or an error. */
export async function startImage(
  req: ImageRequest,
  cfg: OpenAiImageConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageOutcome> {
  if (cfg.transport === 'background' || (cfg.transport === 'auto' && !learned.backgroundUnsupported)) {
    const started = await startBackground(req, cfg, fetchImpl);
    if (started.status !== 'unsupported') return started;
    if (cfg.transport === 'background') return { status: 'error', error: started.error, retryable: false };
    learned.backgroundUnsupported = true;
  }
  return editImage(req, cfg, fetchImpl);
}

// ─── the Images API ─────────────────────────────────────────────────────────────────────────────

interface ImagesResponse {
  data?: { b64_json?: string }[];
  error?: ApiError;
}

export async function editImage(
  req: ImageRequest,
  cfg: OpenAiImageConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageOutcome> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const form = new FormData();
    form.append('model', modelOf(cfg));
    form.append('prompt', req.prompt);
    for (const img of req.images)
      form.append('image[]', new Blob([img.bytes as BlobPart], { type: img.type }), img.name);
    form.append('size', req.size);
    form.append('quality', cfg.quality);
    form.append('n', '1');
    if (!learned.noOutputFormat) form.append('output_format', 'jpeg');
    let res: Response;
    try {
      res = await fetchImpl(`${cfg.apiBase}/v1/images/edits`, {
        method: 'POST',
        headers: { authorization: `Bearer ${cfg.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.name || 'request failed' : 'request failed',
        retryable: true,
      };
    }
    const body = (await res.json().catch(() => null)) as ImagesResponse | null;
    if (res.ok) {
      const b64 = body?.data?.[0]?.b64_json;
      return b64
        ? { status: 'done', image: new Uint8Array(Buffer.from(b64, 'base64')) }
        : { status: 'error', error: 'no image in the answer', retryable: true };
    }
    const e = body?.error;
    if (
      res.status === 400 &&
      !learned.noOutputFormat &&
      (e?.param === 'output_format' || /output_format/.test(e?.message ?? ''))
    ) {
      learned.noOutputFormat = true;
      continue;
    }
    if (missingModel(res.status, e) && !learned.modelMissing && cfg.model !== FALLBACK_IMAGE_MODEL) {
      learned.modelMissing = true;
      continue;
    }
    if (BLOCKED.test(`${e?.code ?? ''} ${e?.message ?? ''}`))
      return { status: 'blocked', error: errorText(res.status, e) };
    return {
      status: 'error',
      error: errorText(res.status, e),
      retryable: res.status === 429 || res.status >= 500,
    };
  }
  return { status: 'error', error: 'gave up', retryable: false };
}

// ─── background mode (the Responses API) ────────────────────────────────────────────────────────

interface ResponsesResponse {
  id?: string;
  status?: 'queued' | 'in_progress' | 'completed' | 'failed' | 'incomplete' | 'cancelled';
  output?: { type?: string; status?: string; result?: string | null }[];
  error?: ApiError | null;
  incomplete_details?: { reason?: string } | null;
}

const INSTRUCTIONS =
  'Generate exactly one image with the image_generation tool. Pass the user message on as the image prompt, ' +
  'and use the attached images as the references it describes, in the order given. Do not answer with text ' +
  'and do not ask questions.';

/** What a finished (or failed) background response holds. */
function outcomeOf(r: ResponsesResponse): ImageOutcome | null {
  if (r.status === 'queued' || r.status === 'in_progress') return null;
  if (r.status === 'completed') {
    const call = r.output?.find((o) => o.type === 'image_generation_call' && o.result);
    if (call?.result) return { status: 'done', image: new Uint8Array(Buffer.from(call.result, 'base64')) };
    // the model answered without an image: its rules held it back, or it didn't call the tool
    const refused = r.output?.some((o) => o.type === 'image_generation_call' && o.status === 'failed');
    return refused
      ? { status: 'blocked', error: 'the image was refused' }
      : { status: 'error', error: 'no image in the answer', retryable: true };
  }
  const e = r.error ?? undefined;
  if (BLOCKED.test(`${e?.code ?? ''} ${e?.message ?? ''} ${r.incomplete_details?.reason ?? ''}`))
    return { status: 'blocked', error: errorText(0, e) || 'blocked' };
  return {
    status: 'error',
    error: errorText(0, e) || r.status || 'failed',
    retryable: r.status !== 'cancelled',
  };
}

async function startBackground(
  req: ImageRequest,
  cfg: OpenAiImageConfig,
  fetchImpl: typeof fetch,
): Promise<ImageOutcome | { status: 'unsupported'; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tool: Record<string, unknown> = {
      type: 'image_generation',
      model: modelOf(cfg),
      quality: cfg.quality,
      size: req.size,
    };
    if (!learned.noOutputFormat) tool.output_format = 'jpeg';
    let res: Response;
    try {
      res = await fetchImpl(`${cfg.apiBase}/v1/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.mainline,
          background: true,
          store: true,
          instructions: INSTRUCTIONS,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: req.prompt },
                ...req.images.map((img) => ({
                  type: 'input_image',
                  image_url: `data:${img.type};base64,${Buffer.from(img.bytes).toString('base64')}`,
                })),
              ],
            },
          ],
          tools: [tool],
          tool_choice: { type: 'image_generation' },
          ...(learned.noReasoning ? {} : { reasoning: { effort: 'low' } }),
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.name || 'request failed' : 'request failed',
        retryable: true,
      };
    }
    const body = (await res.json().catch(() => null)) as (ResponsesResponse & { error?: ApiError }) | null;
    if (res.ok && body?.id) {
      const done = outcomeOf(body);
      return done ?? { status: 'pending', externalId: body.id };
    }
    const e = body?.error ?? undefined;
    const text = `${e?.param ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`;
    if (res.status === 400) {
      if (!learned.noReasoning && /reasoning/i.test(text)) {
        learned.noReasoning = true;
        continue;
      }
      if (!learned.noOutputFormat && /output_format/.test(text)) {
        learned.noOutputFormat = true;
        continue;
      }
      if (BLOCKED.test(text)) return { status: 'blocked', error: errorText(res.status, e) };
      // the account, the text model or the tool doesn't take this: the Images API instead
      if (/background|image_generation|tool|input_image|model|store/i.test(text))
        return { status: 'unsupported', error: errorText(res.status, e) };
    }
    if (missingModel(res.status, e)) return { status: 'unsupported', error: errorText(res.status, e) };
    return {
      status: 'error',
      error: errorText(res.status, e),
      retryable: res.status === 429 || res.status >= 500,
    };
  }
  return { status: 'error', error: 'gave up', retryable: false };
}

/** How a background photo is doing: done, still pending, blocked, or an error. */
export async function checkImage(
  externalId: string,
  cfg: Pick<OpenAiImageConfig, 'apiKey' | 'apiBase'>,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(`${cfg.apiBase}/v1/responses/${encodeURIComponent(externalId)}`, {
      headers: { authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { status: 'pending', externalId };
  }
  const body = (await res.json().catch(() => null)) as ResponsesResponse | null;
  if (!res.ok || !body) {
    if (res.status === 404) return { status: 'error', error: 'the response is gone', retryable: true };
    return res.status === 429 || res.status >= 500
      ? { status: 'pending', externalId }
      : {
          status: 'error',
          error: errorText(res.status, (body as { error?: ApiError } | null)?.error),
          retryable: false,
        };
  }
  return outcomeOf(body) ?? { status: 'pending', externalId };
}
