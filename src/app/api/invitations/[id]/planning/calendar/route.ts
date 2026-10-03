import { loadPlanView } from '@/features/planning/server/api';
import { planningDeps } from '@/features/planning/server/deps';
import { gate, isRefusal } from '@/features/planning/server/types';
import { tasksIcs } from '@/features/planning/model/calendar';
import { systemText } from '@/features/planning/model/system-text';
import { taskNotes, taskTitle } from '@/features/planning/model/task-text';
import { isOpen } from '@/features/planning/model/week';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/invitations/:id/planning/calendar — the plan's open tasks that have a date, as a calendar file
 * (all-day events, in the UI language) to import into Google, Apple or Outlook calendar.
 */
export async function GET(_request: Request, { params }: Params) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const { id } = await params;
  const g = await gate(user.id, id, planningDeps);
  if (isRefusal(g))
    return new Response('Not found', { status: g.status === 403 ? 403 : 404, headers: NO_STORE });
  const [loaded, { t, locale }, item] = await Promise.all([
    loadPlanView(user.id, id, planningDeps, g.input),
    getUi(),
    ownerInvitation(user.id, id),
  ]);
  if (!loaded || !item) return new Response('Not found', { status: 404, headers: NO_STORE });
  const { view } = loaded;
  const confirmed = { adults: view.headcount.confirmedAdults, children: view.headcount.confirmedChildren };
  const events = view.tasks
    .filter((task) => isOpen(task) && task.dueDate !== null)
    .map((task) => {
      const sys = task.systemKey ? systemText(t, task.systemKey, confirmed) : null;
      return {
        id: task.id,
        title: taskTitle(task, view.settings, locale) ?? sys?.title ?? '',
        notes: taskNotes(task, view.settings, locale) ?? sys?.body ?? null,
        dueDate: task.dueDate!,
      };
    })
    .filter((e) => e.title);
  const body = tasksIcs(events, `${t.planning.title} · ${item.slug}`);
  return new Response(body, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="planning-${item.slug}.ics"`,
    },
  });
}
