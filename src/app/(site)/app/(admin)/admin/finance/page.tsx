import { FinanceScreen } from '@/features/admin/finance/ui/FinanceScreen.client';
import { pageOf, parsePaymentFilters } from '@/features/admin/finance/model';
import { loadFinance } from '@/features/admin/finance/server';
import { requireStaff } from '@/features/admin/server/gate';

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * The console's cash flow (finance.view): the numbers, and the payments the address filters
 * (?kind=&status=&product=&provider=&from=&to=&q=&page=). Rendered again when the page refreshes.
 */
export default async function AdminFinancePage({ searchParams }: { searchParams: Search }) {
  const staff = await requireStaff('finance.view', '/app/admin/finance');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') params.set(k, v);
  const data = await loadFinance(staff, parsePaymentFilters(params), pageOf(params));
  return <FinanceScreen data={data} />;
}
