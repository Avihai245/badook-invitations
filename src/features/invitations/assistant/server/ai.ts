import 'server-only';
import { z } from 'zod';
import type { TemplateManifest } from '../../contracts/types';
import { ASSISTANT, FIELDS, RawDraftSchema, type AssistantMessage, type Draft } from '../model';
import { answerSchema, stateNote, systemPrompt } from '../prompt';

/**
 * The AI questionnaire's model: one call per turn to the configured AI model (the Anthropic Messages
 * API, like the support assistant and the design studio). Structured JSON output when the model takes
 * it, a strict parse either way. Only the chat itself is sent — no account, no ids.
 */

export interface AiConfig {
  apiKey: string;
  model: string;
  apiBase: string;
  brand: string;
}

export const AnswerSchema = z.object({
  draft: RawDraftSchema,
  skip: z.array(z.string()).default([]),
  ask: z.string(),
  reply: z.string().trim().min(1),
});
export type Answer = z.infer<typeof AnswerSchema>;

export type AskResult = { status: 'ok'; answer: Answer } | { status: 'error'; error: string };

export interface AskInput {
  manifest: TemplateManifest;
  locale: 'he' | 'en';
  uiLocale: 'he' | 'en';
  today: string;
  draft: Draft;
  skipped: readonly string[];
  messages: readonly AssistantMessage[];
}

/**
 * Models that don't take the structured-output parameter, or the effort setting, are asked without it
 * (remembered per server).
 */
let structuredUnsupported = false;
let effortUnsupported = false;
export const resetAssistantAiState = () => {
  structuredUnsupported = false;
  effortUnsupported = false;
};

export function parseAnswer(text: string): Answer | null {
  const candidates = [text.trim()];
  const brace = /\{[\s\S]*\}/.exec(text);
  if (brace) candidates.push(brace[0]);
  for (const c of candidates) {
    try {
      const parsed = AnswerSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      // not JSON: the next
    }
  }
  return null;
}

interface MessagesResponse {
  content?: { type?: string; text?: string }[];
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

/**
 * The conversation as the model gets it: opening with the host (the device's own first question goes
 * into the note), turns alternating (the device's own questions and a tapped answer may follow one
 * another), the details so far in the last message. null: no message of the host's to answer.
 */
function chatOf(input: AskInput): ChatTurn[] | null {
  const messages: ChatTurn[] = [];
  for (const m of input.messages) {
    const prev = messages[messages.length - 1];
    if (prev?.role === m.role) prev.content += `\n${m.content}`;
    else if (messages.length || m.role === 'user') messages.push({ role: m.role, content: m.content });
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') return null;
  messages[messages.length - 1] = {
    role: 'user',
    content: `${stateNote(input.today, input.draft, input.skipped)}\n\nThe host's message:\n${last.content}`,
  };
  return messages;
}

const answerOf = (text: string): Answer | null => {
  const answer = parseAnswer(text);
  return answer
    ? { ...answer, skip: answer.skip.filter((f) => (FIELDS as readonly string[]).includes(f)) }
    : null;
};

export async function askAssistant(
  input: AskInput,
  config: AiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AskResult> {
  const messages = chatOf(input);
  if (!messages) return { status: 'error', error: 'no message' };
  const deadline = Date.now() + ASSISTANT.timeoutMs;
  let lastError = 'no answer';
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 3_000) break;
    const structured = !structuredUnsupported;
    // current models always think, and the thinking counts against max_tokens: a short form-filling
    // turn needs little of it (low effort keeps it quick; max_tokens leaves room for both)
    const effort = !effortUnsupported;
    const outputConfig = {
      ...(effort ? { effort: 'low' } : {}),
      ...(structured ? { format: { type: 'json_schema', schema: answerSchema(input.manifest) } } : {}),
    };
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
          max_tokens: ASSISTANT.maxTokens,
          system: [
            {
              type: 'text',
              text: systemPrompt(config.brand, input.manifest, input.locale, input.uiLocale),
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
          ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
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
      // an older model without the effort setting: ask again without it (before the format check —
      // its error names output_config too)
      if (res.status === 400 && effort && /effort/i.test(message)) {
        effortUnsupported = true;
        attempt--;
        continue;
      }
      if (res.status === 400 && structured && /output_config|format|json_schema|structured/i.test(message)) {
        structuredUnsupported = true;
        attempt--;
        continue;
      }
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }
      break;
    }
    if (body?.stop_reason === 'refusal') return { status: 'error', error: 'refused' };
    const text = (body?.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('');
    const answer = answerOf(text);
    if (answer) return { status: 'ok', answer };
    lastError = body?.stop_reason === 'max_tokens' ? 'cut short' : 'not the expected JSON';
  }
  return { status: 'error', error: lastError };
}

// ─── OpenAI (Chat Completions) ────────────────────────────────────────────────────────────────────

interface CompletionResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  error?: { message?: string; type?: string; param?: string | null };
}

/**
 * What a model doesn't take, learned from its answers (remembered per server): the token limit's other
 * name (the reasoning and GPT-5 families take `max_completion_tokens`, gpt-4* and gpt-3.5* `max_tokens`),
 * the reasoning effort (reasoning models only) and the strict JSON format.
 */
const openAiState = { legacyTokens: null as boolean | null, noEffort: false, noSchema: false };
export const resetAssistantOpenAiState = () => {
  openAiState.legacyTokens = null;
  openAiState.noEffort = false;
  openAiState.noSchema = false;
};

/** The same turn through OpenAI's Chat Completions API — when the site has an OpenAI key and no Anthropic one. */
export async function askAssistantOpenAi(
  input: AskInput,
  config: AiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AskResult> {
  const messages = chatOf(input);
  if (!messages) return { status: 'error', error: 'no message' };
  const deadline = Date.now() + ASSISTANT.timeoutMs;
  let lastError = 'no answer';
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 3_000) break;
    const legacy = openAiState.legacyTokens ?? /^(gpt-4|gpt-3\.5)/i.test(config.model);
    const tokens = legacy ? 'max_tokens' : 'max_completion_tokens';
    const effort = !legacy && !openAiState.noEffort;
    const schema = !openAiState.noSchema;
    let res: Response;
    try {
      res = await fetchImpl(`${config.apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          [tokens]: ASSISTANT.maxTokens,
          // a short form-filling turn: little reasoning, a quick answer
          ...(effort ? { reasoning_effort: 'low' } : {}),
          response_format: schema
            ? {
                type: 'json_schema',
                json_schema: { name: 'assistant_turn', strict: true, schema: answerSchema(input.manifest) },
              }
            : { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: systemPrompt(config.brand, input.manifest, input.locale, input.uiLocale),
            },
            ...messages,
          ],
        }),
        signal: AbortSignal.timeout(left),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.name || 'request failed' : 'request failed';
      continue;
    }
    const body = (await res.json().catch(() => null)) as CompletionResponse | null;
    if (!res.ok) {
      const message = `${body?.error?.param ?? ''} ${body?.error?.message ?? ''}`;
      lastError = `${res.status} ${body?.error?.type ?? ''}`.trim();
      if (res.status === 400) {
        // what this model doesn't take, from its own answer: asked again without it
        if (/max_completion_tokens|max_tokens/.test(message) && openAiState.legacyTokens === null) {
          openAiState.legacyTokens = !legacy;
          attempt--;
          continue;
        }
        if (effort && /reasoning_effort/.test(message)) {
          openAiState.noEffort = true;
          attempt--;
          continue;
        }
        if (schema && /response_format|json_schema/.test(message)) {
          openAiState.noSchema = true;
          attempt--;
          continue;
        }
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }
      break;
    }
    const choice = body?.choices?.[0];
    if (choice?.message?.refusal) return { status: 'error', error: 'refused' };
    const answer = answerOf(choice?.message?.content ?? '');
    if (answer) return { status: 'ok', answer };
    lastError = choice?.finish_reason === 'length' ? 'cut short' : 'not the expected JSON';
  }
  return { status: 'error', error: lastError };
}
