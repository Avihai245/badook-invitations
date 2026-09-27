import type { ProvisionAction } from '@/features/partner/api';

/**
 * The console's Badook Events area (/app/admin/partners) as the database returns it
 * (admin_partners_overview / _accounts / _user_source, supabase/migrations/*_admin_money_messages.sql):
 * the accounts Badook Events opened, who there opened them, its venues, and its API's health.
 */

/**
 * The Badook Events user who opened an account: the one the opening call named (via 'call'), else
 * the owner of the venue (via 'venue'). Their email is masked for roles without users.pii.
 */
export interface Opener {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  via: 'call' | 'venue';
}

export interface ApiCall {
  at: string;
  method: string;
  endpoint: string;
  status: number;
  code: string | null;
  durationMs: number;
}

export interface PartnersRaw {
  accounts: {
    total: number;
    last30: number;
    active30: number;
    paid: number;
    revenue: number;
    revenueMonth: number;
    unknownOpener: number;
  };
  openers: (Omit<Opener, 'via'> & {
    via: Opener['via'];
    accounts: number;
    paid: number;
    venues: string[];
    lastAt: string;
  })[];
  venues: {
    id: string;
    name: string;
    address: string | null;
    floorPlan: boolean;
    planType: string | null;
    widthMeters: number | null;
    accounts: number;
    owner: { id: string; name: string | null; role: string | null; email: string | null } | null;
    createdAt: string;
    updatedAt: string;
  }[];
  api: {
    days: { day: string; ok: number; refused: number; failed: number }[];
    last24h: { calls: number; refused: number; failed: number; avgMs: number };
    lastCall: ApiCall | null;
    lastError: ApiCall | null;
    endpoints: {
      method: string;
      endpoint: string;
      calls: number;
      refused: number;
      failed: number;
      avgMs: number;
    }[];
  };
}

export interface PartnerAccountRow {
  userId: string;
  name: string | null;
  /** masked for roles without users.pii */
  email: string | null;
  phone: string | null;
  /** the customer's id in Badook Events */
  externalId: string | null;
  openedAt: string;
  opener: Opener | null;
  venue: { id: string; name: string } | null;
  plan: 'free' | 'pro' | 'business';
  planStatus: string;
  paidPlan: boolean;
  active: boolean;
  invitations: number;
  revenue: number;
  lastSignInAt: string | null;
  /** signs in by themselves (a password, Google) */
  userManaged: boolean;
}

export interface PartnerAccountsPage {
  total: number;
  rows: PartnerAccountRow[];
}

/** An account's page in the console: where it came from when Badook Events opened it. */
export interface PartnerSource {
  source: string;
  externalId: string | null;
  openedAt: string;
  opener: Opener | null;
  venue: { id: string; name: string; address: string | null } | null;
  userManaged: boolean;
  /** the calls about it, newest first (the latest 20) */
  provisions: {
    action: ProvisionAction;
    at: string;
    by: { id: string; name: string | null; role: string | null; email: string | null } | null;
    venue: string | null;
  }[];
}

export const ACCOUNTS_PAGE_SIZE = 50;
