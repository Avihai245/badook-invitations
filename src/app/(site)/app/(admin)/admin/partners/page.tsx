import { pageOf } from '@/features/admin/finance/model';
import { accountsQueryOf, loadPartners } from '@/features/admin/partners/server';
import { PartnersScreen } from '@/features/admin/partners/ui/PartnersScreen.client';
import { requireStaff } from '@/features/admin/server/gate';

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * The console's Badook Events area (partners.view): its accounts, who opened them, its venues and its
 * API's health; the accounts searched in the address (?q=&page=). Rendered again when it refreshes.
 */
export default async function AdminPartnersPage({ searchParams }: { searchParams: Search }) {
  const staff = await requireStaff('partners.view', '/app/admin/partners');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') params.set(k, v);
  const data = await loadPartners(staff, accountsQueryOf(params), pageOf(params));
  return <PartnersScreen data={data} />;
}
