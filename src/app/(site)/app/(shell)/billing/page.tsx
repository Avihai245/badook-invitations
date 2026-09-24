import type { Metadata } from 'next';
import { BillingScreen } from '@/features/billing/BillingScreen.client';
import { loadBillingPage } from '@/features/billing/server/billing';
import { getUi } from '@/lib/i18n/server';
import { paidPlanParam } from '@/lib/supabase/auth-paths';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.billing.metaTitle };
}

type Search = Promise<{ status?: string; checkout?: string; plan?: string }>;

/**
 * /app/billing — the plan, message credits and payments. ?plan=pro|business (a new account from the
 * home page's pricing) goes straight on to paying for that plan.
 */
export default async function BillingPage({ searchParams }: { searchParams: Search }) {
  const { status, checkout, plan } = await searchParams;
  const start = paidPlanParam(plan);
  const user = await requireUser(start ? `/app/billing?plan=${start}` : '/app/billing');
  const data = await loadBillingPage(user, checkout ?? null, typeof status === 'string' ? status : null);
  return <BillingScreen data={data} status={typeof status === 'string' ? status : null} start={start} />;
}
