import type { UiLocale } from '@/lib/i18n/app';
import { TEMPLATES, isTemplateKey } from '../templates';
import type { TemplateTask } from './types';
import type { PlanSettings, PlanTask } from './plan';

/**
 * A template's task keeps no text of its own until the host edits it: the template names it, in the
 * language the host is reading now. So a plan made in Hebrew reads in English after the switch, and
 * what the host wrote stays as they wrote it.
 */
function templateTask(settings: Pick<PlanSettings, 'templateKey'> | null, key: string): TemplateTask | null {
  const tpl = settings?.templateKey;
  if (!tpl || !isTemplateKey(tpl)) return null;
  return TEMPLATES[tpl].tasks.find((t) => t.key === key) ?? null;
}

/** The task's own title, else its template's, else null (a system task: the dictionary names it). */
export function taskTitle(
  task: Pick<PlanTask, 'title' | 'tplKey'>,
  settings: Pick<PlanSettings, 'templateKey'> | null,
  locale: UiLocale,
): string | null {
  if (task.title) return task.title;
  if (!task.tplKey) return null;
  return templateTask(settings, task.tplKey)?.title[locale] ?? null;
}

/** The task's own note ('' = none on purpose), else its template's. */
export function taskNotes(
  task: Pick<PlanTask, 'notes' | 'tplKey'>,
  settings: Pick<PlanSettings, 'templateKey'> | null,
  locale: UiLocale,
): string | null {
  if (task.notes !== null) return task.notes || null;
  if (!task.tplKey) return null;
  return templateTask(settings, task.tplKey)?.notes?.[locale] ?? null;
}
