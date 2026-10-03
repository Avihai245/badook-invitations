import 'server-only';
import { whyOff } from '@/features/flags/features';
import { deploymentFeatures, featureInput } from '@/features/flags/server';
import { hostLanguageOf } from '@/features/invitations/lib/locales';
import { hostsLine } from '@/features/invitations/lib/text';
import { sendEmail } from '@/features/invitations/server/email';
import { hostDb } from '@/features/invitations/server/host-db';
import { serverEnv } from '@/lib/env';
import { dictFor } from '@/lib/i18n/dict';
import { serviceDb } from '@/lib/supabase/server';
import { planReminderEmail, type ReminderPayment, type ReminderTask } from '../model/reminder-email';
import { systemText } from '../model/system-text';
import { daysBetween } from '../model/schedule';
import { taskTitle } from '../model/task-text';
import { dueWithin } from '../model/week';
import { planningOverview } from './badge';
import type { Locale } from '@/features/invitations/contracts/types';
import type { InvitationDocument } from '@/features/invitations/contracts/types';

interface Due {
  id: string;
  ownerId: string;
  email: string;
  locales: Locale[] | null;
  defaultLocale: Locale | null;
  hosts: InvitationDocument['hosts'] | null;
}

/**
 * The weekly planning email (part of the daily run): to each host who chose it, the tasks and payments
 * of the coming week and what is overdue — nothing is sent when nothing is due, and an event that is
 * over gets no more. The database holds the dedupe (a plan is looked at once in six days), so the cron
 * route and the app's own clock can both run it. Never throws for one plan: the rest still go.
 */
export async function sendPlanReminders(
  now: Date,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!deploymentFeatures().has('planning')) return out;
  const db = serviceDb();
  const { data, error } = await db.rpc('planning_reminders_due', { p_now: now.toISOString() });
  if (error) throw new Error(`planning_reminders_due: ${error.message}`);
  const lists = new Map<string, Awaited<ReturnType<typeof hostDb.list>>>();
  const mark = async (id: string) => {
    const r = await db.rpc('planning_reminder_sent', { p_id: id, p_at: now.toISOString() });
    if (r.error) throw new Error(`planning_reminder_sent: ${r.error.message}`);
  };
  for (const due of (data ?? []) as Due[]) {
    try {
      const input = await featureInput(due.id);
      if (!input || whyOff('planning', input) !== null) {
        await mark(due.id);
        out.skipped++;
        continue;
      }
      let list = lists.get(due.ownerId);
      if (!list) lists.set(due.ownerId, (list = await hostDb.list(due.ownerId)));
      const item = list.find((i) => i.id === due.id);
      if (!item) {
        out.skipped++;
        continue;
      }
      const o = await planningOverview(
        due.ownerId,
        due.id,
        {
          eventType: item.eventType,
          status: item.status,
          unpublishedChanges: item.unpublishedChanges,
          guests: item.guests,
          sent: item.sent,
          responses: item.responses,
        },
        now.getTime(),
      );
      const date = o?.raw.invitation.date;
      // no reminders for an event that is over
      if (!o || !o.raw.settings || !date || daysBetween(o.today, date) < 0) {
        await mark(due.id);
        out.skipped++;
        continue;
      }
      const locale = hostLanguageOf({
        locales: due.locales ?? ['he'],
        defaultLocale: due.defaultLocale ?? 'he',
      });
      const t = dictFor(locale);
      const confirmed = {
        adults: o.raw.headcount?.confirmedAdults ?? 0,
        children: o.raw.headcount?.confirmedChildren ?? 0,
      };
      const tasks: ReminderTask[] = dueWithin(o.tasks, o.today, 7)
        .slice(0, 10)
        .map((task) => ({
          title:
            taskTitle(task, o.raw.settings, locale) ??
            (task.systemKey ? systemText(t, task.systemKey, confirmed).title : ''),
          due: task.dueDate!,
          overdue: daysBetween(o.today, task.dueDate!) < 0,
        }))
        .filter((task) => task.title);
      const payments: ReminderPayment[] = (o.raw.payments ?? [])
        .filter((p) => p.dueDate && daysBetween(o.today, p.dueDate) <= 7)
        .slice(0, 8)
        .map((p) => ({
          label: p.label,
          item: p.itemTitle,
          amount: p.amount,
          due: p.dueDate!,
          overdue: daysBetween(o.today, p.dueDate!) < 0,
        }));
      if (tasks.length === 0 && payments.length === 0) {
        await mark(due.id);
        out.skipped++;
        continue;
      }
      const env = serverEnv();
      const ok = await sendEmail({
        to: due.email,
        kind: 'plan_reminder',
        ...planReminderEmail({
          locale,
          title: due.hosts ? hostsLine(due.hosts, due.defaultLocale ?? 'he') : t.eventTypes[item.eventType],
          tasks,
          payments,
          url: `${env.INVITES_PUBLIC_BASE_URL}/app/invitations/${due.id}/plan`,
          brand: env.INVITES_BRAND_NAME,
        }),
      });
      if (!ok) {
        out.failed++;
        continue;
      }
      await mark(due.id);
      out.sent++;
    } catch (err) {
      console.error('[plan reminders]', due.id, err);
      out.failed++;
    }
  }
  return out;
}
