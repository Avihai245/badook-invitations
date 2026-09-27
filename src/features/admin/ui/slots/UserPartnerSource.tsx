import type { Staff } from '@/features/admin/server/gate';
import { getUiLocale } from '@/lib/i18n/server';
import { adminDict } from '../../i18n';
import { partnersDb } from '../../partners/server';
import { PartnerSourceCard } from '../../partners/ui/PartnerSourceCard';
import { can } from '../../permissions';

/**
 * On a user's page in the console: where the account came from when Badook Events opened it — the
 * Badook Events user who opened it, when, and the venue (features/partner). Nothing for other accounts,
 * for roles without partners.view, or when it can't be read (logged). Refreshes with the page.
 */
export async function UserPartnerSource({ staff, userId }: { staff: Staff; userId: string }) {
  if (!can(staff.role, 'partners.view')) return null;
  const source = await partnersDb
    .userSource(staff.userId, userId)
    .catch((err) => (console.error('[admin] partner source', err), null));
  if (!source) return null;
  const locale = await getUiLocale();
  return <PartnerSourceCard source={source} t={adminDict(locale).partners} locale={locale} />;
}
