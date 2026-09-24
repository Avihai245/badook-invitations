/**
 * The partner API (Badook Events → this app, server to server): opens users remotely — name, email
 * and phone — and hands out one-time sign-in links for them. Plain functions over injected
 * dependencies; the route files (app/api/partner/v1/…) wire Supabase in. Tested in
 * tests/unit/partner.test.ts; the contract for the partner is docs/partner-api.md.
 *
 * Safety: the partner can create users and manage the ones it created (tagged in Supabase Auth when it
 * creates them), never an account that was opened some other way (sign-up, Google) — so a leaked key
 * can't be used to take over those. Once a user signs in by themselves (a password, Google) the
 * partner gets no more sign-in links for them.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { normalizeGuestPhone } from '../invitations/lib/guest-import';

export const PARTNER_SOURCE = 'partner:badook-events';
/** Supabase's default one-time link lifetime (Auth → Email OTP expiration). */
export const LOGIN_LINK_SECONDS = 3600;
/** A shorter INVITES_PARTNER_API_KEY keeps the API off (openssl rand -hex 32 gives 64). */
export const MIN_KEY_LENGTH = 32;

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>, status = 200): ApiResult => ({
  status,
  body: { ok: true, ...body },
});
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

/** What the partner sees of one of its users. */
export interface PartnerUser {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  plan: string;
  activeInvitations: number;
  createdAt: string;
  /** signs in by themselves (set a password, or connected Google): no more sign-in links */
  userManaged: boolean;
}

export interface PartnerDeps {
  /** the site's public origin, for the sign-in link */
  site: string;
  findUserByEmail(email: string): Promise<string | null>;
  /**
   * A confirmed user without a password (they come in through the link, Google or "forgot password"),
   * tagged as the partner's. `created: false` — the email was taken in the meantime (not ours to undo).
   */
  createUser(user: { email: string; fullName: string; phone: string | null }): Promise<{
    id: string;
    created: boolean;
  }>;
  /** undoes createUser when the user couldn't be linked */
  deleteUser(userId: string): Promise<void>;
  /** null: not the partner's to link (someone else's account); throws ExternalIdTaken */
  link(
    userId: string,
    user: { externalId: string | null; fullName: string; phone: string | null },
  ): Promise<PartnerUser | null>;
  /** one of the partner's users, by our id or theirs */
  find(by: { userId?: string; externalId?: string }): Promise<PartnerUser | null>;
  /** false: another account has that email */
  updateEmail(userId: string, email: string): Promise<boolean>;
  /** the hashed token of a one-time sign-in link for this email */
  loginToken(email: string): Promise<string>;
  /** false once the partner is over its hourly limit */
  rateHit(): Promise<boolean>;
}

export class ExternalIdTaken extends Error {}

/** A key long enough to be a real secret (shorter ones leave the API off). */
export const partnerKeyUsable = (key: string) => key.length >= MIN_KEY_LENGTH;

/** `Authorization: Bearer <INVITES_PARTNER_API_KEY>`, compared in constant time. */
export function partnerAuthorized(header: string | null, key: string): boolean {
  if (!key || !header?.startsWith('Bearer ')) return false;
  const digest = (v: string) => createHash('sha256').update(v).digest();
  return timingSafeEqual(digest(header.slice(7).trim()), digest(key));
}

/** An in-app path to land on after signing in (never another site). */
const safePath = (next: unknown) =>
  typeof next === 'string' && /^\/(?![/\\])[^\s]*$/.test(next) ? next : '/app/invitations';

/**
 * The one-time link opens a page with a "Continue" button, and the token is used on the click — so a
 * mail scanner or a chat app's link preview opening it doesn't use it up.
 */
function loginUrl(site: string, token: string, next: unknown): string {
  const q = new URLSearchParams({ token_hash: token, next: safePath(next) });
  return `${site}/auth/continue?${q}`;
}

/** For a user who signs in by themselves: the sign-in page, then `next`. */
function signInUrl(site: string, next: unknown): string {
  return `${site}/login?${new URLSearchParams({ next: safePath(next) })}`;
}

const userManaged = (site: string, next: unknown) =>
  fail(409, 'user_managed', { signInUrl: signInUrl(site, next) });

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const ExternalId = z.string().trim().min(1).max(200);
const Next = z.string().max(300);

export const ProvisionSchema = z.strictObject({
  email: Email,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullish(),
  /** the user's id in Badook Events (for looking them up later) */
  externalId: ExternalId.nullish(),
  /** where the sign-in link lands (an in-app path, default /app/invitations) */
  next: Next.optional(),
});

const oneOf = (v: { userId?: string; externalId?: string }) => !!v.userId !== !!v.externalId;
const ONE_OF = { message: 'userId or externalId, one of them' };

export const LoginLinkSchema = z
  .strictObject({ userId: z.uuid().optional(), externalId: ExternalId.optional(), next: Next.optional() })
  .refine(oneOf, ONE_OF);

export const EmailChangeSchema = z
  .strictObject({ userId: z.uuid().optional(), externalId: ExternalId.optional(), email: Email })
  .refine(oneOf, ONE_OF);

const invalid = (error: z.ZodError) =>
  fail(400, 'invalid', { fields: [...new Set(error.issues.map((i) => i.path.join('.') || '(body)'))] });

/** POST /api/partner/v1/users — opens a user (or updates the partner's own) and returns a sign-in link. */
export async function provisionUser(raw: unknown, deps: PartnerDeps): Promise<ApiResult> {
  if (!(await deps.rateHit())) return fail(429, 'rate_limited');
  const parsed = ProvisionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { email, fullName, next } = parsed.data;
  const externalId = parsed.data.externalId ?? null;
  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizeGuestPhone(parsed.data.phone);
    if (!phone) return fail(400, 'invalid', { fields: ['phone'] });
  }

  const existing = await deps.findUserByEmail(email);
  // one of the partner's users who signs in by themselves now: nothing to change or hand out
  if (existing && (await deps.find({ userId: existing }))?.userManaged) return userManaged(deps.site, next);
  const { id: userId, created } = existing
    ? { id: existing, created: false }
    : await deps.createUser({ email, fullName, phone });
  // a user created here that can't be linked is deleted again: a retry starts over (no orphan
  // blocking it with account_exists)
  const undo = async () => {
    if (created) await deps.deleteUser(userId).catch((err) => console.error('[partner api] undo', err));
  };
  let user: PartnerUser | null;
  try {
    user = await deps.link(userId, { externalId, fullName, phone });
  } catch (err) {
    await undo();
    if (err instanceof ExternalIdTaken) return fail(409, 'external_id_taken');
    throw err;
  }
  // the email belongs to an account its owner opened: they sign in to it themselves
  if (!user) {
    await undo();
    return fail(409, 'account_exists');
  }
  if (user.userManaged) return userManaged(deps.site, next);
  return ok(
    {
      created,
      user,
      loginUrl: loginUrl(deps.site, await deps.loginToken(user.email), next),
      loginUrlExpiresIn: LOGIN_LINK_SECONDS,
    },
    created ? 201 : 200,
  );
}

/** POST /api/partner/v1/login-links — a fresh one-time sign-in link for one of the partner's users. */
export async function createLoginLink(raw: unknown, deps: PartnerDeps): Promise<ApiResult> {
  if (!(await deps.rateHit())) return fail(429, 'rate_limited');
  const parsed = LoginLinkSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const user = await deps.find({ userId: parsed.data.userId, externalId: parsed.data.externalId });
  if (!user) return fail(404, 'not_found');
  if (user.userManaged) return userManaged(deps.site, parsed.data.next);
  return ok({
    userId: user.userId,
    loginUrl: loginUrl(deps.site, await deps.loginToken(user.email), parsed.data.next),
    loginUrlExpiresIn: LOGIN_LINK_SECONDS,
  });
}

/**
 * PATCH /api/partner/v1/users — a new email for one of the partner's users (it changed in Badook
 * Events). Not for a user who signs in by themselves: their email is theirs to change.
 */
export async function changeEmail(raw: unknown, deps: PartnerDeps): Promise<ApiResult> {
  if (!(await deps.rateHit())) return fail(429, 'rate_limited');
  const parsed = EmailChangeSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const user = await deps.find({ userId: parsed.data.userId, externalId: parsed.data.externalId });
  if (!user) return fail(404, 'not_found');
  const { email } = parsed.data;
  if (user.email.toLowerCase() === email) return ok({ user });
  if (user.userManaged) return fail(409, 'user_managed');
  if (!(await deps.updateEmail(user.userId, email))) return fail(409, 'email_taken');
  return ok({ user: { ...user, email } });
}

/** GET /api/partner/v1/users?externalId=… | ?userId=… | ?email=… — one of the partner's users. */
export async function lookupUser(params: URLSearchParams, deps: PartnerDeps): Promise<ApiResult> {
  if (!(await deps.rateHit())) return fail(429, 'rate_limited');
  const userId = params.get('userId');
  const externalId = params.get('externalId');
  const email = params.get('email');
  if ([userId, externalId, email].filter(Boolean).length !== 1)
    return fail(400, 'invalid', { fields: ['userId | externalId | email'] });
  let id: string | undefined;
  if (userId) {
    if (!z.uuid().safeParse(userId).success) return fail(400, 'invalid', { fields: ['userId'] });
    id = userId;
  } else if (email) {
    const address = Email.safeParse(email);
    if (!address.success) return fail(400, 'invalid', { fields: ['email'] });
    id = (await deps.findUserByEmail(address.data)) ?? undefined;
    if (!id) return fail(404, 'not_found');
  }
  const user = await deps.find(id ? { userId: id } : { externalId: externalId ?? undefined });
  return user ? ok({ user }) : fail(404, 'not_found');
}
