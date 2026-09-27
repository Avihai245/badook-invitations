import 'server-only';
import { PARTNER_SOURCE } from '@/features/partner/api';
import { adminRpc } from '../server/db';
import type { Staff } from '../server/gate';
import { ACCOUNTS_PAGE_SIZE, type PartnerAccountsPage, type PartnerSource, type PartnersRaw } from './model';

/**
 * The Badook Events area's database functions (supabase/migrations/*_admin_money_messages.sql): each
 * takes the acting staff member and checks their role itself (partners.view); contact details come
 * masked for roles without users.pii.
 */

export interface PartnerActivityRaw {
  id: number;
  at: string;
  userId: string;
  /** the account's name */
  name: string | null;
  action: 'created' | 'linked';
  /** who in Badook Events opened it (the call's creator, else the venue's owner) */
  byName: string | null;
  byRole: string | null;
  venue: string | null;
}

export const partnersDb = {
  overview: (actor: string) =>
    adminRpc<PartnersRaw>('admin_partners_overview', { p_actor: actor, p_source: PARTNER_SOURCE }),
  accounts: (actor: string, query: string | null, limit: number, offset: number) =>
    adminRpc<PartnerAccountsPage>('admin_partners_accounts', {
      p_actor: actor,
      p_source: PARTNER_SOURCE,
      p_query: query,
      p_limit: limit,
      p_offset: offset,
    }),
  userSource: (actor: string, userId: string) =>
    adminRpc<PartnerSource | null>('admin_partners_user_source', {
      p_actor: actor,
      p_source: PARTNER_SOURCE,
      p_user_id: userId,
    }),
  activity: (actor: string, limit: number) =>
    adminRpc<PartnerActivityRaw[]>('admin_partners_activity', {
      p_actor: actor,
      p_source: PARTNER_SOURCE,
      p_limit: limit,
    }),
};

export interface PartnersPageData {
  overview: PartnersRaw;
  accounts: PartnerAccountsPage & { page: number; pageSize: number; query: string };
}

/** The search as the address has it (a name, an id…: 100 characters at most). */
export const accountsQueryOf = (params: URLSearchParams): string =>
  (params.get('q') ?? '').trim().slice(0, 100);

export async function loadPartners(staff: Staff, query: string, page: number): Promise<PartnersPageData> {
  const [overview, accounts] = await Promise.all([
    partnersDb.overview(staff.userId),
    partnersDb.accounts(staff.userId, query || null, ACCOUNTS_PAGE_SIZE, (page - 1) * ACCOUNTS_PAGE_SIZE),
  ]);
  return { overview, accounts: { ...accounts, page, pageSize: ACCOUNTS_PAGE_SIZE, query } };
}
