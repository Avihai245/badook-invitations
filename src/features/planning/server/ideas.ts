import type { PlanIdea } from '../model/plan';
import { IdeaConvert, IdeaEdit, type IdeaOpInput } from '../model/schemas-ideas';
import { fail, gate, isRefusal, notFound, ok, type ApiResult, type PlanningDeps } from './types';

/**
 * The notes & ideas board's API (POST /api/invitations/:id/planning/ideas) as plain functions over the
 * injected dependencies — the route file wires Supabase in. Tested in tests/unit/planning-ideas.test.ts.
 */

const invalid = (error: { issues: { path: PropertyKey[] }[] }) =>
  fail(400, 'invalid', {
    fields: [...new Set(error.issues.map((i) => i.path.slice(0, 3).join('.')))].slice(0, 10),
  });

/** A refusal the database gave (or null: not the host's), as the answer to send. */
function refusal(answer: unknown): ApiResult | null {
  if (answer === null || answer === undefined) return notFound;
  const a = answer as { ok?: boolean; code?: string };
  if (a.ok === false)
    return fail(a.code === 'too_many' || a.code === 'too_large' ? 422 : 400, a.code ?? 'invalid');
  return null;
}

/** What a convert answers with: the card (now linked) and the id of what was made from it. */
export interface Converted {
  idea: PlanIdea;
  created: { taskId?: string; vendorId?: string; itemId?: string };
}

/**
 * POST …/planning/ideas { op: 'save' | 'delete' | 'convert', … }
 * - save: `{ idea: { id?, type?, title?, body?, url?, ogPreview?, imagePath?, color?, tags?, pinned?,
 *   items?, sort? } }` → `{ ok, idea }` — a new id is the client's to choose (undoing a delete puts the
 *   same card back); only the keys present change; `imagePath` must be one of this event's own files
 * - delete: `{ ids }` → `{ ok, deleted }`
 * - convert: `{ id, kind: 'task' | 'vendor' | 'item', data }` → `{ ok, idea, created }`, the new row and
 *   the card's link to it made together
 */
export async function ideaOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const op = (body as { op?: unknown } | null)?.op;
  const parsed = (op === 'convert' ? IdeaConvert : IdeaEdit).safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data as IdeaOpInput;
  switch (input.op) {
    case 'save': {
      // a picture is one of this event's own files (the database checks it again)
      const path = input.idea.imagePath;
      if (typeof path === 'string' && !path.startsWith(`${userId}/${id}/`))
        return fail(400, 'invalid', { fields: ['idea.imagePath'] });
      const idea = await deps.rpc<PlanIdea | { ok: false; code: string } | null>('planning_idea_save', {
        p_id: id,
        p_owner: userId,
        p_idea: input.idea,
      });
      return refusal(idea) ?? ok({ idea });
    }
    case 'delete': {
      const deleted = await deps.rpc<number | null>('planning_idea_delete', {
        p_id: id,
        p_owner: userId,
        p_ids: input.ids,
      });
      return refusal(deleted) ?? ok({ deleted });
    }
    case 'convert': {
      const made = await deps.rpc<Converted | { ok: false; code: string } | null>('planning_idea_convert', {
        p_id: id,
        p_owner: userId,
        p_idea: input.id,
        p_kind: input.kind,
        p_data: input.data,
      });
      const refused = refusal(made);
      if (refused) return refused;
      const { idea, created } = made as Converted;
      return ok({ idea, created });
    }
  }
}
