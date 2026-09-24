import { notFound } from 'next/navigation';
import { checkoutDb, billingMode } from '@/features/billing/server/billing';
import { TestCheckout } from '@/features/billing/TestCheckout.client';
import { requireUser } from '@/lib/supabase/session';

/** /app/billing/test-checkout?id= — the stand-in payment page of INVITES_BILLING_TEST_MODE. */
export default async function TestCheckoutPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await requireUser(`/app/billing/test-checkout?id=${id ?? ''}`);
  if (billingMode() !== 'test' || !id || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const checkout = await checkoutDb.get(id, user.id);
  if (!checkout || checkout.status !== 'pending') notFound();
  return <TestCheckout id={checkout.id} product={checkout.product} amount={Number(checkout.amount)} />;
}
