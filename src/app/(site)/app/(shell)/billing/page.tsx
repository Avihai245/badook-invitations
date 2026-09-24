import type { Metadata } from 'next';
import { BillingScreen } from '@/features/billing/BillingScreen.client';
import { loadBillingPage } from '@/features/billing/server/billing';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.billing.metaTitle };
}

type Search = Promise<{ status?: string; checkout?: string }>;

/** /app/billing — the plan, message credits and payments. */
export default async function BillingPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser('/app/billing');
  const { status, checkout } = await searchParams;
  const data = await loadBillingPage(user, checkout ?? null);
  return <BillingScreen data={data} status={typeof status === 'string' ? status : null} />;
}
