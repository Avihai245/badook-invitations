import 'server-only';
import { createHash } from 'node:crypto';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { discountActive, type PlanDiscount } from '../billing/plans';
import { ExternalIdTaken, PARTNER_SOURCE, type PartnerDeps, type PartnerUser } from './api';

/** Requests an hour from the partner (a leaked key can't flood the system). */
const PARTNER_LIMIT = { count: 600, windowSeconds: 3600 };

type AccountJson = {
  userId: string;
  fullName: string | null;
  phone: string | null;
  plan: string;
  activeInvitations: number;
  createdAt: string;
  email?: string;
  userManaged?: boolean;
  discount?: PlanDiscount | null;
};

const view = (a: AccountJson, email: string): PartnerUser => ({
  userId: a.userId,
  email,
  fullName: a.fullName,
  phone: a.phone,
  plan: a.plan,
  activeInvitations: a.activeInvitations,
  createdAt: a.createdAt,
  userManaged: a.userManaged === true,
  // while a purchase gets it
  discount: discountActive(a.discount, Date.now())
    ? { percent: a.discount.percent, until: a.discount.until, note: a.discount.note }
    : null,
});

/**
 * The partner API's dependencies on Supabase (Auth admin + the service-role functions). `site`: the
 * public address the links point to (requestBaseUrl — INVITES_PUBLIC_BASE_URL unless that is unset
 * or still Amplify's default address).
 */
export function partnerDeps(site: string): PartnerDeps {
  const db = serviceDb();
  const env = serverEnv();
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
    return data as T;
  };
  const emailOf = async (userId: string) => {
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw new Error(`getUserById: ${error?.message ?? 'no email'}`);
    return data.user.email;
  };
  return {
    site,
    findUserByEmail: (email) => rpc<string | null>('user_id_by_email', { p_email: email }),
    async createUser({ email, fullName, phone }) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
        // the partner may claim only users it created (account_link_partner)
        app_metadata: { provisioned_by: PARTNER_SOURCE },
        user_metadata: { full_name: fullName, name: fullName, ...(phone ? { phone } : {}) },
      });
      if (data.user) return { id: data.user.id, created: true };
      // created in the meantime — by another request of the partner, or by its owner signing up
      const existing =
        error?.code === 'email_exists'
          ? await rpc<string | null>('user_id_by_email', { p_email: email })
          : null;
      if (existing) return { id: existing, created: false };
      throw new Error(`createUser: ${error?.message ?? 'no user'}`);
    },
    async deleteUser(userId) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
    },
    async link(userId, { externalId, fullName, phone }) {
      let account: AccountJson | null;
      try {
        account = await rpc<AccountJson | null>('account_link_partner', {
          p_user_id: userId,
          p_source: PARTNER_SOURCE,
          p_external_id: externalId,
          p_full_name: fullName,
          p_phone: phone,
          p_claim: true,
        });
      } catch (err) {
        // accounts_partner_external: this partner id already belongs to another user
        if ((err as { code?: string }).code === '23505') throw new ExternalIdTaken();
        throw err;
      }
      return account ? view(account, await emailOf(userId)) : null;
    },
    async find({ userId, externalId }) {
      const account = await rpc<AccountJson | null>('partner_account', {
        p_source: PARTNER_SOURCE,
        p_user_id: userId ?? null,
        p_external_id: externalId ?? null,
      });
      return account ? view(account, account.email ?? (await emailOf(account.userId))) : null;
    },
    async setDiscount({ userId, externalId }, discount) {
      const account = await rpc<AccountJson | null>('account_set_discount', {
        p_source: PARTNER_SOURCE,
        p_user_id: userId ?? null,
        p_external_id: externalId ?? null,
        p_percent: discount?.percent ?? null,
        p_until: discount?.until ?? null,
        p_note: discount?.note ?? null,
      });
      return account ? view(account, account.email ?? (await emailOf(account.userId))) : null;
    },
    async updateEmail(userId, email) {
      const { error } = await db.auth.admin.updateUserById(userId, { email, email_confirm: true });
      if (!error) return true;
      if (error.code === 'email_exists') return false;
      throw new Error(`updateUserById: ${error.message}`);
    },
    async loginToken(email) {
      const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
      if (error || !data.properties?.hashed_token)
        throw new Error(`generateLink: ${error?.message ?? 'no token'}`);
      return data.properties.hashed_token;
    },
    rateHit: () =>
      rpc<boolean>('support_rate_hit', {
        p_key_hash: createHash('sha256').update(`${env.INVITES_IP_HASH_SALT}:partner`).digest('hex'),
        p_limit: PARTNER_LIMIT.count,
        p_window_seconds: PARTNER_LIMIT.windowSeconds,
      }),
  };
}
