import { z } from 'zod';
import { EVENT_TYPES, type EventType, type TemplateManifest } from '../contracts/types';
import { HHmmSchema, ISODateSchema } from '../contracts/schemas';
import { CAPS } from '../contracts/validate';
import { getTemplate, type TemplateEntry } from '../templates/registry';
import { COUPLE_EVENTS } from '../templates/seed-copy';
import { resolveEventDefaults } from '../templates/seed-document';

/**
 * The AI questionnaire ("build it for me with a few questions"): the host picks a design, then a short
 * chat asks only what matters (names, date, time, place, style, a personal line) and the invitation is
 * made on that design from the answers — no menus. Isomorphic: the chat on the device and the API read
 * the same fields, order and limits. Without the AI (not set up, past a limit, or failing) the device
 * asks the same questions one by one itself, with an input made for each.
 */

export const ASSISTANT = {
  /** the conversation the AI gets back each turn */
  maxMessages: 30,
  messageMax: 600,
  /** the place's name and address */
  venueMax: 80,
  /** the personal line, in the invitation's language */
  storyMax: 300,
  /** the AI's answer: how long we wait, how long it may be */
  timeoutMs: 25_000,
  maxTokens: 1200,
  /** turns a host may have a day / an hour */
  perDay: 120,
  perHour: 60,
} as const;

/** What the chat asks, in this order (each only when it applies to the design and the event). */
export const FIELDS = [
  'eventType',
  'primary',
  'secondary',
  'parents',
  'age',
  'date',
  'startTime',
  'venue',
  'style',
  'story',
] as const;
export type AssistantField = (typeof FIELDS)[number];

/** Without these the invitation can't be made; the rest may be skipped. */
const REQUIRED: readonly AssistantField[] = ['eventType', 'primary', 'secondary', 'date', 'startTime'];
export const isRequired = (f: AssistantField) => REQUIRED.includes(f);

/** The parents' line keeps up to 40 characters (as in the wizard). */
export const PARENTS_MAX = 40;

/** The answers so far (each null / absent while unknown). Names are in the invitation's language. */
export interface Draft {
  eventType?: EventType | null;
  primary?: string | null;
  secondary?: string | null;
  parents?: string | null;
  age?: number | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  paletteId?: string | null;
  story?: string | null;
}

/** As it arrives from the device or the AI: anything, held to the shape by sanitizeDraft(). */
export const RawDraftSchema = z
  .object({
    eventType: z.unknown(),
    primary: z.unknown(),
    secondary: z.unknown(),
    parents: z.unknown(),
    age: z.unknown(),
    date: z.unknown(),
    startTime: z.unknown(),
    endTime: z.unknown(),
    venueName: z.unknown(),
    venueAddress: z.unknown(),
    paletteId: z.unknown(),
    story: z.unknown(),
  })
  .partial();

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? [...s].slice(0, max).join('').trim() : null;
};
/** The story keeps its line breaks (at most one empty line between paragraphs). */
const paragraph = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s ? [...s].slice(0, max).join('').trim() : null;
};
const one = <T>(v: unknown, schema: z.ZodType<T>): T | null => {
  const r = schema.safeParse(typeof v === 'string' ? v.trim() : v);
  return r.success ? r.data : null;
};

/** Every answer held to what the design and the product take; anything else is dropped (unknown). */
export function sanitizeDraft(raw: unknown, manifest: TemplateManifest): Draft {
  const r = RawDraftSchema.safeParse(raw);
  const d = r.success ? r.data : {};
  const eventType =
    typeof d.eventType === 'string' &&
    (EVENT_TYPES as readonly string[]).includes(d.eventType) &&
    manifest.categories.includes(d.eventType as EventType)
      ? (d.eventType as EventType)
      : manifest.categories.length === 1
        ? manifest.categories[0]!
        : null;
  const age = typeof d.age === 'number' ? d.age : typeof d.age === 'string' ? Number(d.age) : NaN;
  return {
    eventType,
    primary: text(d.primary, CAPS.hostName),
    secondary: eventType && COUPLE_EVENTS.includes(eventType) ? text(d.secondary, CAPS.hostName) : null,
    parents: eventType === 'bar_mitzvah' || eventType === 'bat_mitzvah' ? text(d.parents, PARENTS_MAX) : null,
    age: eventType === 'birthday' && Number.isInteger(age) && age >= 1 && age <= 120 ? age : null,
    date: one(d.date, ISODateSchema),
    startTime: one(d.startTime, HHmmSchema),
    endTime: one(d.endTime, HHmmSchema),
    venueName: text(d.venueName, ASSISTANT.venueMax),
    venueAddress: text(d.venueAddress, ASSISTANT.venueMax),
    paletteId:
      typeof d.paletteId === 'string' && manifest.palettePresets.some((p) => p.id === d.paletteId)
        ? d.paletteId
        : null,
    story: paragraph(d.story, ASSISTANT.storyMax),
  };
}

/** The design's own story section (a "text" kind story in its order): the personal line goes there. */
export function storyAvailable(entry: TemplateEntry, eventType: EventType): boolean {
  if (eventType === 'save_the_date') return false;
  return (
    !!resolveEventDefaults(entry.defaults, eventType).defaults.story &&
    entry.manifest.sectionDefaults.order.includes('text')
  );
}

/** The questions that apply to this design and event, in order. */
export function fieldsFor(templateId: string, draft: Draft): AssistantField[] {
  const entry = getTemplate(templateId);
  if (!entry) return [];
  const { manifest } = entry;
  const type = draft.eventType ?? null;
  return FIELDS.filter((f) => {
    switch (f) {
      case 'eventType':
        return manifest.categories.length > 1;
      case 'secondary':
        return !!type && COUPLE_EVENTS.includes(type);
      case 'parents':
        return type === 'bar_mitzvah' || type === 'bat_mitzvah';
      case 'age':
        return type === 'birthday';
      case 'style':
        return manifest.palettePresets.length > 1;
      case 'story':
        return !!type && storyAvailable(entry, type);
      default:
        return true;
    }
  });
}

export function isAnswered(field: AssistantField, d: Draft): boolean {
  switch (field) {
    case 'venue':
      return !!(d.venueName || d.venueAddress);
    case 'style':
      return !!d.paletteId;
    default:
      return d[field] !== null && d[field] !== undefined && d[field] !== '';
  }
}

/** The next question: the first that applies, unanswered and not skipped (a required one never is). */
export function nextField(
  templateId: string,
  draft: Draft,
  skipped: readonly AssistantField[] = [],
): AssistantField | null {
  return (
    fieldsFor(templateId, draft).find(
      (f) => !isAnswered(f, draft) && (isRequired(f) || !skipped.includes(f)),
    ) ?? null
  );
}

/** Everything the invitation needs is there (the optional rest may still be asked). */
export const readyToCreate = (templateId: string, draft: Draft) =>
  fieldsFor(templateId, draft).every((f) => !isRequired(f) || isAnswered(f, draft));

export const MessageSchema = z.strictObject({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1)
    .max(ASSISTANT.messageMax * 2),
});
export type AssistantMessage = z.infer<typeof MessageSchema>;

export const TurnRequestSchema = z.strictObject({
  templateId: z.string().min(1).max(80),
  uiLocale: z.enum(['he', 'en']),
  /** the invitation's language (the names and the personal line are in it) */
  locale: z.enum(['he', 'en']),
  /** the host's today, for "next Friday" */
  today: ISODateSchema,
  draft: RawDraftSchema,
  skipped: z.array(z.enum(FIELDS)).max(FIELDS.length).default([]),
  messages: z.array(MessageSchema).min(1).max(ASSISTANT.maxMessages),
});
export type TurnRequest = z.infer<typeof TurnRequestSchema>;

/** The turn's answer: the answers as they are now, the next question and what to say. */
export interface TurnResult {
  draft: Draft;
  skipped: AssistantField[];
  next: AssistantField | null;
  /** null: the device asks the next question itself (no AI) */
  reply: string | null;
  source: 'ai' | 'script';
  reason: 'no_ai' | 'limit' | 'error' | null;
}
