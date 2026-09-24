import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUi } from '@/lib/i18n/server';
import { loginPath } from '@/lib/supabase/auth-paths';
import { safeNext } from '@/lib/supabase/session';
import { ContinueForm } from '../../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.accountPage.auth.continue.title };
}

/**
 * /auth/continue?token_hash=…&next=… — where a one-time sign-in link from Badook Events lands
 * (docs/partner-api.md). Opening it uses nothing: the "Continue" button signs in.
 */
export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (typeof sp.token_hash !== 'string' || !sp.token_hash)
    redirect(loginPath({ error: 'link_invalid', next }));
  return <ContinueForm tokenHash={sp.token_hash} next={next} />;
}
