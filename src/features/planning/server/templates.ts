import { z } from 'zod';
import { planToTemplateItems } from '../model/template-items';
import { taskNotes, taskTitle } from '../model/task-text';
import { Uuid } from '../model/schemas';
import { fail, gate, isRefusal, notFound, ok, rawState, type ApiResult, type PlanningDeps } from './types';

const TemplateOp = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('save'),
    name: z.string().trim().min(1).max(80),
    locale: z.enum(['he', 'en']).default('he'),
  }),
  z.strictObject({ op: z.literal('list') }),
  z.strictObject({ op: z.literal('delete'), templateId: Uuid }),
]);

export interface TemplateSummary {
  id: string;
  name: string;
  eventType: string | null;
  updatedAt: string;
  tasks: number;
}

/**
 * POST …/planning/templates — the host's own templates (the Business plan's `planning_templates`):
 * `{ op:'save', name }` keeps this plan as a template to start the next events from; `{ op:'list' }`
 * answers theirs; `{ op:'delete', templateId }` removes one. A template belongs to its owner alone.
 */
export async function templateOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps, 'planning_templates');
  if (isRefusal(g)) return g;
  const parsed = TemplateOp.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid');
  const input = parsed.data;

  if (input.op === 'list') {
    const templates = await deps.rpc<TemplateSummary[]>('planning_templates_list', { p_owner: userId });
    return ok({ templates });
  }
  if (input.op === 'delete') {
    const done = await deps.rpc<boolean>('planning_template_delete', {
      p_owner: userId,
      p_id: input.templateId,
    });
    return done ? ok({}) : notFound;
  }

  const raw = await rawState(deps, id, userId);
  if (!raw?.settings) return notFound;
  const items = planToTemplateItems(
    raw,
    (task) => taskTitle(task, raw.settings, input.locale),
    (task) => taskNotes(task, raw.settings, input.locale),
  );
  if (items.tasks.length === 0 && items.categories.length === 0) return fail(422, 'empty');
  const saved = await deps.rpc<TemplateSummary | { ok: false; code: string } | null>(
    'planning_template_save',
    {
      p_owner: userId,
      p_name: input.name,
      p_event_type: raw.invitation.eventType,
      p_items: items,
    },
  );
  if (!saved) return notFound;
  if ('ok' in saved) return fail(422, saved.code);
  return ok({ template: saved }, 201);
}
