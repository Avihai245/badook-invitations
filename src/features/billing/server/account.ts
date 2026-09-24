import 'server-only';
import type { User } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { PLAN_LIMITS, effectivePlan, type PlanId, type PlanLimits } from '../plans';

/** accounts row as account_json returns it (supabase/migrations/*_guests_accounts_messaging.sql). */
export interface AccountRecord {
  userId: string;
  fullName: string | null;
  phone: string | null;
  plan: PlanId;
  planStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  planRenewsAt: string | null;
  billingProvider: string | null;
  hasSubscription: boolean;
  credits: number;
  source: string;
  createdAt: string;
  activeInvitations: number;
}

/** The account with what it may do right now. */
export interface AccountView extends AccountRecord {
  email: string | null;
  /** the plan in force (a canceled plan until its period ends; admins: the top plan) */
  effective: PlanId;
  limits: PlanLimits;
  admin: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export interface BillingPatch {
  plan?: PlanId;
  planStatus?: AccountRecord['planStatus'];
  planRenewsAt?: string | null;
  billingProvider?: string;
  billingCustomerId?: string;
  billingSubscriptionId?: string | null;
}

export const accountDb = {
  get: (userId: string) => rpc<AccountRecord | null>('account_get', { p_user_id: userId }),
  update: (userId: string, fullName: string, phone: string | null) =>
    rpc<AccountRecord | null>('account_update', { p_user_id: userId, p_full_name: fullName, p_phone: phone }),
  /** applies a payment event once; false = seen before */
  billingApply: (event: {
    id: string;
    provider: string;
    type: string;
    userId: string | null;
    patch: BillingPatch;
    credits: number;
    payload: unknown;
  }) =>
    rpc<boolean>('billing_apply', {
      p_event_id: event.id,
      p_provider: event.provider,
      p_type: event.type,
      p_user_id: event.userId,
      p_patch: event.patch,
      p_credits: event.credits,
      p_payload: event.payload ?? {},
    }),
  byBilling: (provider: string, subscriptionId: string | null, customerId: string | null) =>
    rpc<string | null>('account_by_billing', {
      p_provider: provider,
      p_subscription_id: subscriptionId,
      p_customer_id: customerId,
    }),
  creditsAdd: (userId: string, count: number, reason: 'admin' | 'plan_grant', ref: string) =>
    rpc<number | null>('credits_add', { p_user_id: userId, p_count: count, p_reason: reason, p_ref: ref }),
  byEmail: (email: string) => rpc<string | null>('user_id_by_email', { p_email: email }),
  linkPartner: (
    userId: string,
    source: string,
    externalId: string | null,
    fullName: string,
    phone: string | null,
  ) =>
    rpc<AccountRecord>('account_link_partner', {
      p_user_id: userId,
      p_source: source,
      p_external_id: externalId,
      p_full_name: fullName,
      p_phone: phone,
    }),
};

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && serverEnv().INVITES_ADMIN_EMAILS.includes(email.toLowerCase());
}

/** The signed-in user's account with its plan in force and limits (created on first use). */
export async function loadAccount(user: Pick<User, 'id' | 'email'>): Promise<AccountView> {
  const record = await accountDb.get(user.id);
  if (!record) throw new Error('account_get: no such user');
  const admin = isAdminEmail(user.email);
  const effective = effectivePlan(record, Date.now(), admin);
  return { ...record, email: user.email ?? null, effective, limits: PLAN_LIMITS[effective], admin };
}

/** Monthly plan prices (shekels incl. VAT) from the configuration. */
export function planPrices(): Record<PlanId, number> {
  const env = serverEnv();
  return { free: 0, pro: env.INVITES_PRICE_PRO, business: env.INVITES_PRICE_BUSINESS };
}
