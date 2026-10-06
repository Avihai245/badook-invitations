import { z } from 'zod';
import { TOOLS, cleanTools, readTools, type ToolKey } from '../lib/tools';

/**
 * PUT /api/invitations/:id/tools { tools } — the host says what they need for the event (lib/tools).
 * A plain function over injected dependencies: tests/unit/tools.test.ts.
 */

export type ToolsResult = { status: number; body: Record<string, unknown> };

export interface ToolsDeps {
  /** stores the event's tools; the event's stored features (null: not the host's event) */
  set(invitationId: string, ownerId: string, tools: ToolKey[]): Promise<unknown>;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const notFound: ToolsResult = { status: 404, body: { ok: false, code: 'not_found' } };
const Schema = z.strictObject({ tools: z.array(z.enum(TOOLS)).max(TOOLS.length) });

export async function setEventTools(
  userId: string,
  invitationId: string,
  raw: unknown,
  deps: ToolsDeps,
): Promise<ToolsResult> {
  if (!isUuid(invitationId)) return notFound;
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { ok: false, code: 'invalid' } };
  const stored = await deps.set(invitationId, userId, cleanTools(parsed.data.tools));
  if (!stored || typeof stored !== 'object') return notFound;
  return { status: 200, body: { ok: true, tools: readTools((stored as Record<string, unknown>).tools) } };
}
