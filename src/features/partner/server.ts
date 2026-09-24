import 'server-only';
import { createHash } from 'node:crypto';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
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
};

const view = (a: AccountJson, email: string): PartnerUser => ({
  userId: a.userId,
  email,
  fullName: a.fullName,
  phone: a.phone,
  plan: a.plan,
  activeInvitations: a.activeInvitations,
  createdAt: a.createdAt,
});

/** The partner API's dependencies on Supabase (Auth admin + the service-role functions). */
export function partnerDeps(): PartnerDeps {
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
    site: env.INVITES_PUBLIC_BASE_URL,
    findUserByEmail: (email) => rpc<string | null>('user_id_by_email', { p_email: email }),
    async createUser({ email, fullName, phone }) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, name: fullName, ...(phone ? { phone } : {}) },
      });
      if (data.user) return data.user.id;
      // created in the meantime by another request
      const existing =
        error?.code === 'email_exists'
          ? await rpc<string | null>('user_id_by_email', { p_email: email })
          : null;
      if (existing) return existing;
      throw new Error(`createUser: ${error?.message ?? 'no user'}`);
    },
    async link(userId, { externalId, fullName, phone }, claim) {
      let account: AccountJson | null;
      try {
        account = await rpc<AccountJson | null>('account_link_partner', {
          p_user_id: userId,
          p_source: PARTNER_SOURCE,
          p_external_id: externalId,
          p_full_name: fullName,
          p_phone: phone,
          p_claim: claim,
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
