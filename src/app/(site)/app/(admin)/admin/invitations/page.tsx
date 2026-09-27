import { coreDb, INVITATION_SORTS, type InvitationQuery } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { templateNames } from '@/features/admin/server/templates';
import { INVITATION_STATUSES } from '@/features/admin/lists';
import { dayOf, oneOf, pageOf, textOf, type SearchParams } from '@/features/admin/ui/core/params';
import { InvitationsScreen } from '@/features/admin/ui/invitations/InvitationsScreen.client';
import { EVENT_TYPES, LOCALES } from '@/features/invitations/contracts/types';
import { getUiLocale } from '@/lib/i18n/server';

/** The console's invitations: counts, search, filters, sort and pages in the address. */
export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const staff = await requireStaff('invitations.view', '/app/admin/invitations');
  const [sp, locale] = await Promise.all([searchParams, getUiLocale()]);
  const templates = templateNames(locale);
  const template = textOf(sp.template);
  const query: InvitationQuery = {
    q: textOf(sp.q),
    status: oneOf(sp.status, INVITATION_STATUSES),
    eventType: oneOf(sp.eventType, EVENT_TYPES),
    template: template && /^[a-z0-9-]{1,60}$/.test(template) ? template : undefined,
    lang: oneOf(sp.lang, LOCALES),
    from: dayOf(sp.from),
    to: dayOf(sp.to),
    sort: oneOf(sp.sort, INVITATION_SORTS),
    page: pageOf(sp.page),
  };
  const data = await coreDb.invitations(staff.userId, query);
  return <InvitationsScreen data={data} query={query} templates={templates} />;
}
