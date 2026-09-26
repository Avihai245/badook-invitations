import 'server-only';
import { ART_DIRECTION } from '../config';
import { parseAnswer, type Answer, type ConceptInput } from '../model';
import { answerSchema, briefText, systemPrompt } from '../prompt';

/**
 * The art director (feature `art_direction`): one batched call to the configured AI model (the
 * Anthropic Messages API, like the support assistant and the gallery check) with the host's photos as
 * small JPEGs made on their device, the catalog of what the product has and what the device read from
 * each photo; the answer is JSON (structured output when the model takes it, a strict parse either
 * way). Nothing about the host is sent — no names, no ids — and the photos are never logged or kept.
 */

export interface AiConfig {
  apiKey: string;
  model: string;
  apiBase: string;
  brand: string;
}

export type AskResult = { status: 'ok'; answer: Answer } | { status: 'error'; error: string };

/** Models that don't take the structured-output parameter are asked without it (remembered per server). */
let structuredUnsupported = false;
export const resetArtAiState = () => {
  structuredUnsupported = false;
};

interface MessagesResponse {
  content?: { type?: string; text?: string }[];
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

export async function askArtDirector(
  input: ConceptInput,
  jpegs: readonly string[],
  config: AiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AskResult> {
  const content: unknown[] = [{ type: 'text', text: briefText(input) }];
  jpegs.forEach((data, i) => {
    content.push({ type: 'text', text: `Photo ${i}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
  });
  content.push({
    type: 'text',
    text: `Design the three concepts for this ${input.eventType} invitation.`,
  });
  const deadline = Date.now() + ART_DIRECTION.timeoutMs;
  let lastError = 'no answer';
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    const structured = !structuredUnsupported;
    let res: Response;
    try {
      res = await fetchImpl(`${config.apiBase}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: ART_DIRECTION.maxTokens,
          system: systemPrompt(config.brand),
          messages: [{ role: 'user', content }],
          ...(structured
            ? { output_config: { format: { type: 'json_schema', schema: answerSchema(input) } } }
            : {}),
        }),
        signal: AbortSignal.timeout(left),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.name || 'request failed' : 'request failed';
      continue;
    }
    const body = (await res.json().catch(() => null)) as MessagesResponse | null;
    if (!res.ok) {
      const message = body?.error?.message ?? '';
      lastError = `${res.status} ${body?.error?.type ?? ''}`.trim();
      if (res.status === 400 && structured && /output_config|format|json_schema|structured/i.test(message)) {
        structuredUnsupported = true;
        attempt--;
        continue;
      }
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1_500));
        continue;
      }
      break;
    }
    if (body?.stop_reason === 'refusal') return { status: 'error', error: 'refused' };
    const text = (body?.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('');
    const answer = parseAnswer(text);
    if (answer) return { status: 'ok', answer };
    lastError = body?.stop_reason === 'max_tokens' ? 'cut short' : 'not the expected JSON';
  }
  return { status: 'error', error: lastError };
}
