import type { Metadata } from 'next';
import { AccountScreen } from '@/features/billing/AccountScreen.client';
import { loadAccount } from '@/features/billing/server/account';
import { displayPhone } from '@/features/invitations/lib/guest-status';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.accountPage.metaTitle };
}

/** /app/account — profile, sign-in method, plan and deleting the account. */
export default async function AccountPage() {
  const user = await requireUser('/app/account');
  const { t } = await getUi();
  const account = await loadAccount(user);
  const provider = account.source.startsWith('partner:')
    ? 'partner'
    : user.app_metadata?.provider === 'google'
      ? 'google'
      : 'email';
  return (
    <AccountScreen
      data={{
        email: user.email ?? '',
        fullName: account.fullName ?? '',
        phone: displayPhone(account.phone),
        provider,
        plan: t.site.plans.names[account.effective],
      }}
    />
  );
}
