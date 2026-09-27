import { notFound } from 'next/navigation';
import { coreDb } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { templateNames } from '@/features/admin/server/templates';
import { uuidOf } from '@/features/admin/ui/core/params';
import { InvitationScreen, type FeatureItem } from '@/features/admin/ui/invitations/InvitationScreen.client';
import { describe } from '@/features/flags/api';
import { featureInput } from '@/features/flags/server';
import { getUiLocale } from '@/lib/i18n/server';

type Params = Promise<{ id: string }>;

/**
 * One invitation in the console (read only: it's the customer's): its details, owner, numbers, and
 * its features — what is in force and why (features/flags), with the team's grants beyond the plan.
 */
export default async function AdminInvitationPage({ params }: { params: Params }) {
  const { id: raw } = await params;
  const staff = await requireStaff('invitations.view', `/app/admin/invitations/${encodeURIComponent(raw)}`);
  const id = uuidOf(raw);
  if (!id) notFound();
  const [invitation, input, locale] = await Promise.all([
    coreDb.invitation(staff.userId, id),
    featureInput(id).catch((err) => (console.error('[admin] invitation features', err), null)),
    getUiLocale(),
  ]);
  if (!invitation) notFound();
  const features: FeatureItem[] | null = input
    ? describe(input).items.map((item) => ({
        ...item,
        granted: input.overrides.grant.includes(item.feature),
      }))
    : null;
  const templateName = templateNames(locale)[invitation.templateId] ?? invitation.templateId;
  return <InvitationScreen invitation={invitation} features={features} templateName={templateName} />;
}
