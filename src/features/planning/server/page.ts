import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';
import type { PlanView } from '../model/plan';
import { loadPlanView } from './api';
import { planningDeps } from './deps';
import { isUuid } from './types';

export type PlanPageData = { off: true } | { off: false; view: PlanView };

/**
 * What a planning page needs: the signed-in host's plan (a 404 for anything that isn't theirs, a
 * save-the-date, or a deployment without planning), or "switched off" with a way to turn it back on.
 */
export async function planPageData(id: string, path: string): Promise<PlanPageData> {
  const user = await requireUser(`/app/invitations/${id}/plan${path}`);
  if (!isUuid(id)) notFound();
  const input = await featureInput(id);
  if (!input || input.ownerId !== user.id) notFound();
  const why = whyOff('planning', input);
  if (why === 'unavailable' || why === 'plan') notFound();
  if (why) return { off: true };
  const loaded = await loadPlanView(user.id, id, planningDeps, input);
  if (!loaded) notFound();
  return { off: false, view: loaded.view };
}

type Params = Promise<{ id: string }>;

/** The tab's title for a planning page, like the other screens': "<tool> · <names>". */
export async function planMetadata(
  params: Params,
  title: (t: Awaited<ReturnType<typeof getUi>>['t']) => string,
): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.errorPages.notFound.metaTitle };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return { title: fmt(title(t), { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }) };
}
