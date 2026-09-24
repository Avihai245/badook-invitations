import type { Metadata } from 'next';
import { loadAccount } from '@/features/billing/server/account';
import { InvitationsList } from '@/features/invitations/app/list/InvitationsList';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { hostDb } from '@/features/invitations/server/host-db';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.list.title };
}

/** /app/invitations — the host's invitations (§9B.3-A). */
export default async function InvitationsPage() {
  const user = await requireUser('/app/invitations');
  const [items, account] = await Promise.all([hostDb.list(user.id), loadAccount(user)]);
  // the greeting: the first name from the account, else from sign-up / Google
  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const full =
    account.fullName ??
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null);
  const name = full?.trim().split(/\s+/)[0] || null;
  return (
    <>
      {/* the cards' posters write the names in their designs' fonts */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <InvitationsList items={items} name={name} />
    </>
  );
}
