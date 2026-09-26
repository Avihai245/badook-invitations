// Local stand-in for the parts of Supabase the app uses, for the end-to-end stack (never deployed):
//   · REST  POST /rest/v1/rpc/<fn> — the API key picks the database role exactly like Supabase maps its
//     keys (publishable → anon, secret → service_role), so grants and RLS are enforced by Postgres;
//   · Auth  /auth/v1 — email + password sign-up (auto-confirmed), password / refresh-token grants,
//     GET/PUT /user, logout, recover; HS256 access tokens; users live in auth.users; "Continue with
//     Google" through a stand-in account chooser (authorize → code → the PKCE grant); /settings;
//     admin: create users, one-time sign-in links (generate_link → POST /verify), get / update / delete;
//   · Storage /storage/v1 — signed upload URLs (service role), uploads, the server's own uploads
//     (service role), public reads; files on disk, bucket size/MIME limits from storage.buckets.
//
//   DATABASE_URL=postgres://… REST_SHIM_PORT=54321 node tests/support/rest-shim.mjs
//   app env: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
//            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-publishable  SUPABASE_SECRET_KEY=local-secret
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const ROLES = { 'local-publishable': 'anon', 'local-secret': 'service_role' };
const FUNCTIONS = new Set([
  'get_published_invitation',
  'submit_rsvp',
  'rsvp_rate_hit',
  'publish_invitation',
  'restore_invitation_version',
  'owner_invitations',
  'owner_invitation',
  'create_invitation',
  'save_invitation_draft',
  'slug_available',
  'set_invitation_slug',
  'owner_invitation_versions',
  'owner_invitation_version',
  'duplicate_invitation',
  'set_invitation_archived',
  'owner_responses',
  'owner_delete_response',
  'set_invitation_notify',
  'rsvp_notification_target',
  'rsvp_digest_due',
  'mark_rsvp_digest_sent',
  'account_get',
  'account_update',
  'billing_apply',
  'account_by_billing',
  'credits_add',
  'checkout_create',
  'checkout_attach',
  'checkout_get',
  'checkout_complete',
  'billing_history',
  'billing_overdue',
  'owner_guests',
  'import_guests',
  'update_guest',
  'delete_guests',
  'mark_guests_sent',
  'guest_open',
  'guest_by_token',
  'whatsapp_queue',
  'whatsapp_claim',
  'whatsapp_result',
  'whatsapp_status',
  'whatsapp_requeue',
  'whatsapp_pending',
  'support_rate_hit',
  'contact_submit',
  'purge_expired',
  'user_id_by_email',
  'account_link_partner',
  'partner_account',
  'account_set_discount',
  'invitation_features',
  'invitation_feature_off',
  'invitation_feature_grant',
  'seating_state',
  'seating_save',
  'partner_venue_put',
  'partner_venue_get',
  'partner_user_venue_set',
  'partner_user_venue',
  'app_meta_get',
  'seed_upsert',
  'billing_pending_checkouts',
  'account_note_limit',
  'app_job_claim',
  'app_job_done',
  'add_guest',
  'invitation_is_demo',
  'whatsapp_opt_out',
  'whatsapp_waiting',
  // the live gallery (supabase/migrations/*_live_gallery.sql)
  'gallery_owner_get',
  'gallery_owner_create',
  'gallery_owner_update',
  'gallery_owner_rotate',
  'gallery_owner_delete',
  'gallery_owner_items',
  'gallery_owner_moderate',
  'gallery_owner_originals',
  'gallery_by_token',
  'gallery_slug_locale',
  'gallery_reserve',
  'gallery_item_for_uploader',
  'gallery_complete',
  'gallery_feed',
  'gallery_changes',
  'gallery_uploader_items',
  'gallery_guest_delete',
  'gallery_rate_hit',
  'gallery_trash_claim',
  'gallery_trash_done',
  'gallery_maintenance',
  // the event day (supabase/migrations/*_event_day.sql)
  'seating_save_tracked',
  'seating_guide',
  'event_day_slug_locale',
  'checkin_station_link',
  'checkin_station_open',
  'checkin_station_find',
  'checkin_station_search',
  'checkin_station_arrive',
  'checkin_station_undo',
  'event_day_owner_get',
  'event_day_owner_setup',
  'event_day_owner_rotate',
  'event_day_live',
  'checkin_owner_arrive',
  'checkin_owner_undo',
  'seating_live_move',
  'seating_live_merge',
  'seating_change_undo',
  'seating_changes_list',
  'seating_notices_state',
  'seating_notice_queue',
  'seating_notice_mark',
  'seating_notice_claim',
  'seating_notice_result',
  'seating_notice_requeue',
  'seating_notice_status',
  'seating_notice_pending',
  'event_day_maintenance',
]);
const IDENT = /^p_[a-z_]+$/;
const JWT_SECRET = process.env.SHIM_JWT_SECRET ?? 'local-shim-jwt-secret-for-tests-only';
const STORAGE_DIR = process.env.SHIM_STORAGE_DIR ?? 'tests/.artifacts/storage';
const TOKEN_TTL = 3600;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-upsert, cache-control, x-supabase-api-version, ' +
    'tus-resumable, upload-length, upload-metadata, upload-offset, x-signature, range',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, HEAD, DELETE, OPTIONS',
  'access-control-expose-headers': 'location, upload-offset, upload-length, tus-resumable, content-range',
};

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', ...CORS });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

// ─── REST (RPC) ─────────────────────────────────────────────────────────────────────────────────

/** A function's parameter names → their types ("uuid[]", "jsonb", …), read once. */
const argTypeCache = new Map();
async function argTypes(client, fn) {
  if (!argTypeCache.has(fn)) {
    const { rows } = await client.query(
      `select a.name, format_type(a.type, null) as type
         from pg_proc p, unnest(p.proargnames, p.proargtypes::oid[]) as a(name, type)
        where p.proname = $1 and p.pronamespace = 'public'::regnamespace`,
      [fn],
    );
    argTypeCache.set(fn, new Map(rows.map((r) => [r.name, r.type])));
  }
  return argTypeCache.get(fn);
}

async function rpc(req, res, fn) {
  if (req.method !== 'POST' || !FUNCTIONS.has(fn)) return send(res, 404, { message: 'not found' });
  const role = ROLES[req.headers.apikey];
  if (!role) return send(res, 401, { message: 'invalid api key' });
  const args = await readBody(req);
  const names = Object.keys(args);
  if (!names.every((n) => IDENT.test(n))) return send(res, 400, { message: 'bad argument name' });
  const client = await pool.connect();
  try {
    // like PostgREST: a JSON array for an array parameter (uuid[]) is a Postgres array; objects and
    // arrays for json/jsonb parameters stay JSON
    const types = await argTypes(client, fn);
    const values = names.map((n) => {
      const v = args[n];
      if (Array.isArray(v) && types.get(n)?.endsWith('[]')) return v;
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role })]);
    await client.query(`set local role ${role}`);
    const { rows } = await client.query(call, values);
    await client.query('commit');
    send(res, 200, rows[0]?.r ?? null);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    send(res, /permission denied/.test(err.message) ? 403 : 400, { code: err.code, message: err.message });
  } finally {
    client.release();
  }
}

// ─── Auth ───────────────────────────────────────────────────────────────────────────────────────

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => createHmac('sha256', JWT_SECRET).update(data).digest('base64url');

function jwt(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${sign(`${head}.${body}`)}`;
}

function verifyJwt(token) {
  const [head, body, sig] = String(token ?? '').split('.');
  if (!head || !body || !sig) return null;
  const expected = sign(`${head}.${body}`);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
    return null;
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  return claims.exp * 1000 > Date.now() ? claims : null;
}

const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
};
const checkPassword = (password, stored) => {
  const [kind, salt, hash] = String(stored ?? '').split(':');
  if (kind !== 'scrypt') return false;
  const got = scryptSync(password, salt, 32);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
};

function userJson(row) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: row.created_at,
    confirmed_at: row.created_at,
    phone: '',
    app_metadata: row.raw_app_meta_data ?? { provider: 'email', providers: ['email'] },
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_anonymous: false,
  };
}

const refreshTokens = new Map(); // refresh token → user id (sessions reset when the shim restarts)

function session(row) {
  const now = Math.floor(Date.now() / 1000);
  const user = userJson(row);
  const refresh = randomBytes(24).toString('base64url');
  refreshTokens.set(refresh, row.id);
  return {
    access_token: jwt({
      aud: 'authenticated',
      exp: now + TOKEN_TTL,
      iat: now,
      sub: row.id,
      email: row.email,
      role: 'authenticated',
      aal: 'aal1',
      session_id: randomUUID(),
      is_anonymous: false,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    }),
    token_type: 'bearer',
    expires_in: TOKEN_TTL,
    expires_at: now + TOKEN_TTL,
    refresh_token: refresh,
    user,
  };
}

const authError = (res, status, code, msg) =>
  send(res, status, { code, error_code: code, msg, message: msg });

async function userById(id) {
  return (await pool.query('select * from auth.users where id = $1', [id])).rows[0];
}

// ── "Continue with Google": the browser comes to /authorize, picks an account on a stand-in page,
// and goes back to the app with a one-time code, which the app trades for a session (PKCE). ──
const oauthCodes = new Map(); // code → { userId, challenge }
const signInTokens = new Map(); // hashed token → { userId, type, expires }
const html = (res, body) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function redirectBack(res, target, params) {
  const url = new URL(target);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  res.writeHead(303, { location: url.toString() });
  res.end();
}

async function oauth(req, res, path, query) {
  const target = query.get('redirect_to') ?? '';
  if (!/^https?:\/\//.test(target)) return authError(res, 400, 'validation_failed', 'redirect_to');
  if (path === 'authorize') {
    if (query.get('provider') !== 'google') return authError(res, 400, 'validation_failed', 'provider');
    const keep = ['redirect_to', 'code_challenge', 'code_challenge_method']
      .map((k) => `<input type="hidden" name="${k}" value="${escapeHtml(query.get(k) ?? '')}">`)
      .join('');
    return html(
      res,
      `<!doctype html><html lang="en"><head><title>Google (test)</title></head><body>
<h1>Sign in with Google (test)</h1>
<form action="/auth/v1/authorize/google_account" method="get">${keep}
<label>Email <input name="email" type="email" required></label>
<label>Name <input name="name"></label>
<button type="submit">Continue</button>
<button type="submit" name="cancel" value="1" formnovalidate>Cancel</button>
</form></body></html>`,
    );
  }
  // the account was chosen (or the visitor canceled)
  if (query.get('cancel'))
    return redirectBack(res, target, { error: 'access_denied', error_description: 'The user canceled' });
  const email = String(query.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authError(res, 400, 'validation_failed', 'email');
  const name = String(query.get('name') ?? '').trim() || email.split('@')[0];
  let row = (await pool.query('select * from auth.users where email = $1', [email])).rows[0];
  if (row) {
    // Supabase links a verified Google identity to the account with the same email
    const providers = [...new Set([...(row.raw_app_meta_data?.providers ?? ['email']), 'google'])];
    row = (
      await pool.query(
        `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || $2, updated_at = now()
         where id = $1 returning *`,
        [row.id, { providers }],
      )
    ).rows[0];
  } else {
    row = (
      await pool.query(
        `insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values ($1, 'authenticated', 'authenticated', $2, null, $3, $4, now(), now()) returning *`,
        [
          randomUUID(),
          email,
          { provider: 'google', providers: ['google'] },
          { full_name: name, name, email, email_verified: true },
        ],
      )
    ).rows[0];
  }
  const code = randomUUID();
  oauthCodes.set(code, {
    userId: row.id,
    challenge: query.get('code_challenge') ?? '',
    method: query.get('code_challenge_method') ?? 'plain',
  });
  return redirectBack(res, target, { code });
}

async function auth(req, res, path, query) {
  if (req.method === 'GET' && (path === 'authorize' || path === 'authorize/google_account'))
    return oauth(req, res, path, query);
  if (!ROLES[req.headers.apikey]) return authError(res, 401, 'no_api_key', 'Invalid API key');
  if (req.method === 'GET' && path === 'settings')
    return send(res, 200, {
      external: { email: true, google: process.env.SHIM_GOOGLE !== 'off' },
      disable_signup: false,
      mailer_autoconfirm: true,
    });
  if (req.method === 'POST' && path === 'signup') {
    const { email, password, data } = await readBody(req);
    const address = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address))
      return authError(res, 400, 'validation_failed', 'Invalid email');
    if (String(password ?? '').length < 6)
      return authError(res, 422, 'weak_password', 'Password should be at least 6 characters');
    const exists = (await pool.query('select 1 from auth.users where email = $1', [address])).rowCount;
    if (exists) return authError(res, 422, 'user_already_exists', 'User already registered');
    const row = (
      await pool.query(
        `insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values ($1, 'authenticated', 'authenticated', $2, $3, $4, $5, now(), now()) returning *`,
        [
          randomUUID(),
          address,
          hashPassword(password),
          { provider: 'email', providers: ['email'] },
          data ?? {},
        ],
      )
    ).rows[0];
    return send(res, 200, session(row));
  }
  if (req.method === 'POST' && path === 'token') {
    const body = await readBody(req);
    if (query.get('grant_type') === 'password') {
      const address = String(body.email ?? '')
        .trim()
        .toLowerCase();
      const row = (await pool.query('select * from auth.users where email = $1', [address])).rows[0];
      if (!row || !checkPassword(String(body.password ?? ''), row.encrypted_password))
        return send(res, 400, {
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          code: 'invalid_credentials',
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        });
      return send(res, 200, session(row));
    }
    if (query.get('grant_type') === 'refresh_token') {
      const id = refreshTokens.get(body.refresh_token);
      if (!id)
        return authError(
          res,
          400,
          'refresh_token_not_found',
          'Invalid Refresh Token: Refresh Token Not Found',
        );
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, session(await userById(id)));
    }
    if (query.get('grant_type') === 'pkce') {
      const entry = oauthCodes.get(body.auth_code);
      oauthCodes.delete(body.auth_code);
      const verifier = String(body.code_verifier ?? '');
      const expected =
        entry?.method?.toLowerCase() === 's256'
          ? createHash('sha256').update(verifier).digest('base64url')
          : verifier;
      if (!entry || !verifier || expected !== entry.challenge)
        return authError(res, 400, 'flow_state_not_found', 'invalid flow state, no valid flow state found');
      return send(res, 200, session(await userById(entry.userId)));
    }
    return authError(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
  }
  const claims = verifyJwt((req.headers.authorization ?? '').replace(/^Bearer /, ''));
  if (path === 'user' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!claims) return authError(res, 403, 'bad_jwt', 'invalid JWT');
    if (req.method === 'PUT') {
      const { password, data } = await readBody(req);
      if (password !== undefined && String(password).length < 6)
        return authError(res, 422, 'weak_password', 'Password should be at least 6 characters');
      await pool.query(
        `update auth.users set encrypted_password = coalesce($2, encrypted_password),
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || coalesce($3::jsonb, '{}'), updated_at = now() where id = $1`,
        [claims.sub, password === undefined ? null : hashPassword(password), data ?? null],
      );
    }
    const row = await userById(claims.sub);
    return row ? send(res, 200, userJson(row)) : authError(res, 403, 'user_not_found', 'User not found');
  }
  // one-time sign-in links (admin generate_link → the hashed token → POST /verify)
  if (req.method === 'POST' && path === 'verify') {
    const { type, token_hash } = await readBody(req);
    const entry = signInTokens.get(token_hash);
    signInTokens.delete(token_hash);
    if (!entry || entry.type !== type || entry.expires < Date.now())
      return authError(res, 403, 'otp_expired', 'Email link is invalid or has expired');
    const row = await userById(entry.userId);
    return row ? send(res, 200, session(row)) : authError(res, 404, 'user_not_found', 'User not found');
  }
  // ── admin (service role): what the server does with auth.admin.* ──
  if (req.method === 'POST' && (path === 'admin/users' || path === 'admin/generate_link')) {
    if (ROLES[req.headers.apikey] !== 'service_role')
      return authError(res, 403, 'not_admin', 'User not allowed');
    const body = await readBody(req);
    const address = String(body.email ?? '')
      .trim()
      .toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address))
      return authError(res, 400, 'validation_failed', 'Invalid email');
    const existing = (await pool.query('select * from auth.users where email = $1', [address])).rows[0];
    if (path === 'admin/users') {
      if (existing)
        return authError(
          res,
          422,
          'email_exists',
          'A user with this email address has already been registered',
        );
      const row = (
        await pool.query(
          `insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
           values ($1, 'authenticated', 'authenticated', $2, $3, $4, $5, now(), now()) returning *`,
          [
            randomUUID(),
            address,
            body.password ? hashPassword(body.password) : null,
            { provider: 'email', providers: ['email'], ...(body.app_metadata ?? {}) },
            body.user_metadata ?? {},
          ],
        )
      ).rows[0];
      return send(res, 200, userJson(row));
    }
    if (!existing || !['magiclink', 'recovery'].includes(body.type))
      return authError(res, 422, 'validation_failed', 'Unsupported link');
    const token = randomBytes(24).toString('hex');
    signInTokens.set(token, { userId: existing.id, type: body.type, expires: Date.now() + 3600_000 });
    return send(res, 200, {
      ...userJson(existing),
      action_link: `http://127.0.0.1/auth/v1/verify?token=${token}&type=${body.type}`,
      email_otp: '000000',
      hashed_token: token,
      redirect_to: '',
      verification_type: body.type,
    });
  }
  const admin = /^admin\/users\/([0-9a-f-]{36})$/.exec(path);
  if (admin) {
    if (ROLES[req.headers.apikey] !== 'service_role')
      return authError(res, 403, 'not_admin', 'User not allowed');
    if (req.method === 'DELETE') {
      const deleted = await pool.query('delete from auth.users where id = $1', [admin[1]]);
      return deleted.rowCount ? send(res, 200, {}) : authError(res, 404, 'user_not_found', 'User not found');
    }
    if (req.method === 'GET') {
      const row = await userById(admin[1]);
      return row ? send(res, 200, userJson(row)) : authError(res, 404, 'user_not_found', 'User not found');
    }
    // updateUserById: a new email (confirmed at once, like email_confirm: true) and metadata
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const row = await userById(admin[1]);
      if (!row) return authError(res, 404, 'user_not_found', 'User not found');
      const email = body.email === undefined ? row.email : String(body.email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return authError(res, 400, 'validation_failed', 'Invalid email');
      if (
        email !== row.email &&
        (await pool.query('select 1 from auth.users where email = $1', [email])).rowCount
      )
        return authError(
          res,
          422,
          'email_exists',
          'A user with this email address has already been registered',
        );
      const updated = (
        await pool.query(
          `update auth.users set email = $2, raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || $3,
             raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || $4, updated_at = now()
           where id = $1 returning *`,
          [row.id, email, body.app_metadata ?? {}, body.user_metadata ?? {}],
        )
      ).rows[0];
      return send(res, 200, userJson(updated));
    }
  }
  if (req.method === 'POST' && path === 'logout') return send(res, 204);
  if (req.method === 'POST' && path === 'recover') return send(res, 200, {});
  return authError(res, 404, 'not_found', 'not found');
}

// ─── Storage ────────────────────────────────────────────────────────────────────────────────────

const uploadTokens = new Map(); // token → `${bucket}/${path}`

function storagePath(bucket, path) {
  const safe = normalize(join(bucket, path));
  if (safe.startsWith('..') || safe.includes('\0')) throw new Error('bad path');
  return join(STORAGE_DIR, safe);
}

async function storage(req, res, rest, query) {
  if (await privateStorage(req, res, rest, query)) return;
  let m = /^object\/upload\/sign\/([a-z0-9-]+)\/(.+)$/.exec(rest);
  if (m && req.method === 'POST') {
    if (ROLES[req.headers.apikey] !== 'service_role') return send(res, 403, { error: 'Unauthorized' });
    const token = randomBytes(24).toString('base64url');
    uploadTokens.set(token, `${m[1]}/${m[2]}`);
    return send(res, 200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=${token}` });
  }
  if (m && req.method === 'PUT') {
    const key = `${m[1]}/${m[2]}`;
    if (uploadTokens.get(query.get('token')) !== key) return send(res, 400, { error: 'InvalidSignature' });
    const bucket = (await pool.query('select * from storage.buckets where id = $1', [m[1]])).rows[0];
    const request = new Request('http://shim/', {
      method: 'PUT',
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: 'half',
    });
    const type = String(req.headers['content-type'] ?? '');
    let file;
    let contentType;
    if (type.startsWith('multipart/form-data')) {
      const form = await request.formData();
      file = [...form.values()].find((v) => typeof v !== 'string');
      contentType = file?.type;
      file = file ? Buffer.from(await file.arrayBuffer()) : null;
    } else {
      file = Buffer.from(await request.arrayBuffer());
      contentType = type;
    }
    if (!file) return send(res, 400, { error: 'No file' });
    if (bucket?.file_size_limit && file.length > Number(bucket.file_size_limit))
      return send(res, 413, { statusCode: '413', error: 'Payload too large' });
    if (bucket?.allowed_mime_types?.length && !bucket.allowed_mime_types.includes(contentType))
      return send(res, 415, {
        statusCode: '415',
        error: 'invalid_mime_type',
        message: `mime type ${contentType} is not supported`,
      });
    const target = storagePath(m[1], m[2]);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file);
    writeFileSync(`${target}.type`, contentType ?? 'application/octet-stream');
    uploadTokens.delete(query.get('token'));
    return send(res, 200, { Key: key, Id: randomUUID() });
  }
  m = /^object\/list\/([a-z0-9-]+)$/.exec(rest);
  if (m && req.method === 'POST') {
    if (ROLES[req.headers.apikey] !== 'service_role') return send(res, 403, { error: 'Unauthorized' });
    const { prefix = '' } = await readBody(req);
    let names = [];
    try {
      names = readdirSync(storagePath(m[1], prefix), { withFileTypes: true }).filter(
        (d) => !d.name.endsWith('.type'),
      );
    } catch {
      names = [];
    }
    // like Supabase: folders come back with id null
    return send(
      res,
      200,
      names.map((d) => ({
        name: d.name,
        id: d.isDirectory() ? null : randomUUID(),
        metadata: d.isDirectory() ? null : fileMetadata(m[1], prefix, d.name),
      })),
    );
  }
  // the server stores a file itself (service role): storage.from(bucket).upload(path, bytes, options)
  m = /^object\/(?!upload\/|list\/|public\/|sign\/)([a-z0-9-]+)\/(.+)$/.exec(rest);
  if (m && req.method === 'POST') {
    if (ROLES[req.headers.apikey] !== 'service_role') return send(res, 403, { error: 'Unauthorized' });
    const bucket = (await pool.query('select * from storage.buckets where id = $1', [m[1]])).rows[0];
    if (!bucket) return send(res, 404, { statusCode: '404', error: 'Bucket not found' });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const file = Buffer.concat(chunks);
    const contentType = String(req.headers['content-type'] ?? 'application/octet-stream');
    if (bucket.file_size_limit && file.length > Number(bucket.file_size_limit))
      return send(res, 413, { statusCode: '413', error: 'Payload too large' });
    if (bucket.allowed_mime_types?.length && !bucket.allowed_mime_types.includes(contentType))
      return send(res, 415, { statusCode: '415', error: 'invalid_mime_type' });
    const target = storagePath(m[1], m[2]);
    let exists = true;
    try {
      statSync(target);
    } catch {
      exists = false;
    }
    if (exists && req.headers['x-upsert'] !== 'true')
      return send(res, 400, {
        statusCode: '409',
        error: 'Duplicate',
        message: 'The resource already exists',
      });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file);
    writeFileSync(`${target}.type`, contentType);
    return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: randomUUID() });
  }
  m = /^object\/([a-z0-9-]+)$/.exec(rest);
  if (m && req.method === 'DELETE') {
    if (ROLES[req.headers.apikey] !== 'service_role') return send(res, 403, { error: 'Unauthorized' });
    const { prefixes = [] } = await readBody(req);
    const removed = [];
    for (const path of prefixes) {
      try {
        const target = storagePath(m[1], path);
        rmSync(target, { force: true });
        rmSync(`${target}.type`, { force: true });
        removed.push({ name: path });
      } catch {
        // not there
      }
    }
    return send(res, 200, removed);
  }
  m = /^object\/public\/([a-z0-9-]+)\/(.+)$/.exec(rest);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const target = storagePath(m[1], decodeURIComponent(m[2]));
      const { size } = statSync(target);
      const headers = {
        'content-type': readFileSync(`${target}.type`, 'utf8'),
        'cache-control': 'public, max-age=3600',
        'accept-ranges': 'bytes',
        ...CORS,
      };
      // byte ranges, like Supabase Storage (audio/video seek with them)
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          res.writeHead(416, { 'content-range': `bytes */${size}`, ...CORS });
          return res.end();
        }
        res.writeHead(206, {
          ...headers,
          'content-range': `bytes ${start}-${end}/${size}`,
          'content-length': end - start + 1,
        });
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(target).subarray(start, end + 1));
      }
      res.writeHead(200, { ...headers, 'content-length': size });
      return res.end(req.method === 'HEAD' ? undefined : readFileSync(target));
    } catch {
      return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    }
  }
  return send(res, 404, { error: 'not found' });
}

// ─── Storage: private buckets, signed reads, resumable uploads (the live gallery) ──────────────
// Like Supabase Storage: a private bucket's files are never public; the service role signs read URLs
// (one or a batch; tokens that expire) and downloads files itself; a gallery file is never
// overwritten without x-upsert; large files arrive through the tus protocol at /upload/resumable/sign
// with the signed upload token in x-signature (created, then PATCHed in pieces; HEAD says the offset).

const tusUploads = new Map(); // id → { bucket, path, length, offset, type, key, temp }

async function bucketRow(id) {
  return (await pool.query('select * from storage.buckets where id = $1', [id])).rows[0] ?? null;
}

function fileMetadata(bucket, prefix, name) {
  try {
    const target = storagePath(bucket, prefix ? `${prefix}/${name}` : name);
    const { size, mtime } = statSync(target);
    let mimetype = 'application/octet-stream';
    try {
      mimetype = readFileSync(`${target}.type`, 'utf8');
    } catch {
      // no type recorded
    }
    return { size, mimetype, lastModified: mtime.toISOString(), contentLength: size, httpStatusCode: 200 };
  } catch {
    return {};
  }
}

function exists(bucket, path) {
  try {
    return statSync(storagePath(bucket, path)).isFile();
  } catch {
    return false;
  }
}

function readToken(bucket, path, expiresIn) {
  const now = Math.floor(Date.now() / 1000);
  return jwt({ url: `${bucket}/${path}`, iat: now, exp: now + Math.max(1, Number(expiresIn) || 60) });
}

function serveFile(req, res, target, extraHeaders = {}) {
  const { size } = statSync(target);
  const headers = {
    'content-type': readFileSync(`${target}.type`, 'utf8'),
    'cache-control': 'private, max-age=3600',
    'accept-ranges': 'bytes',
    ...CORS,
    ...extraHeaders,
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}`, ...CORS });
      return res.end();
    }
    res.writeHead(206, {
      ...headers,
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': end - start + 1,
    });
    return res.end(req.method === 'HEAD' ? undefined : readFileSync(target).subarray(start, end + 1));
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  return res.end(req.method === 'HEAD' ? undefined : readFileSync(target));
}

const notFoundObject = (res) =>
  send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
const duplicate = (res) =>
  send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
const badSignature = (res) =>
  send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'invalid signature' });

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** The private-bucket and resumable routes; false for the routes of storage() below. */
async function privateStorage(req, res, rest, query) {
  const service = ROLES[req.headers.apikey] === 'service_role';
  const read = req.method === 'GET' || req.method === 'HEAD';

  // signed read URLs, a batch at a time (service role)
  let m = /^object\/sign\/([a-z0-9-]+)$/.exec(rest);
  if (m && req.method === 'POST') {
    if (!service) return (send(res, 403, { error: 'Unauthorized' }), true);
    const { expiresIn, paths = [] } = await readBody(req);
    const signed = paths.map((path) =>
      exists(m[1], path)
        ? {
            error: null,
            path,
            signedURL: `/object/sign/${m[1]}/${path}?token=${readToken(m[1], path, expiresIn)}`,
          }
        : {
            error: 'Either the object does not exist or you do not have access to it',
            path,
            signedURL: null,
          },
    );
    return (send(res, 200, signed), true);
  }
  // one signed URL, and reading through one
  m = /^object\/sign\/([a-z0-9-]+)\/(.+)$/.exec(rest);
  if (m && req.method === 'POST') {
    if (!service) return (send(res, 403, { error: 'Unauthorized' }), true);
    const { expiresIn } = await readBody(req);
    if (!exists(m[1], m[2])) return (notFoundObject(res), true);
    return (
      send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${readToken(m[1], m[2], expiresIn)}` }),
      true
    );
  }
  if (m && read) {
    const path = decodeURIComponent(m[2]);
    const claims = verifyJwt(query.get('token'));
    if (!claims || claims.url !== `${m[1]}/${path}`)
      return (send(res, 400, { statusCode: '400', error: 'InvalidJWT', message: 'jwt expired' }), true);
    if (!exists(m[1], path)) return (notFoundObject(res), true);
    const download = query.get('download');
    const disposition =
      download !== null
        ? { 'content-disposition': `attachment; filename="${download || path.split('/').pop()}"` }
        : {};
    return (serveFile(req, res, storagePath(m[1], path), disposition), true);
  }
  // a private bucket's files are never public
  m = /^object\/public\/([a-z0-9-]+)\/(.+)$/.exec(rest);
  if (m && read) {
    const bucket = await bucketRow(m[1]);
    if (bucket && !bucket.public) return (notFoundObject(res), true);
    return false;
  }
  // the service role downloads a file (supabase-js download())
  m = /^object\/(?:authenticated\/)?([a-z0-9-]+)\/(.+)$/.exec(rest);
  if (m && read && !/^object\/(public|sign|info|list|upload)\//.test(rest)) {
    const path = decodeURIComponent(m[2]);
    if (!service || !exists(m[1], path)) return (notFoundObject(res), true);
    return (serveFile(req, res, storagePath(m[1], path)), true);
  }
  // gallery files are written once: signing or uploading over one needs x-upsert
  m = /^object\/upload\/sign\/(gallery-[a-z0-9-]+)\/(.+)$/.exec(rest);
  if (
    m &&
    (req.method === 'POST' || req.method === 'PUT') &&
    req.headers['x-upsert'] !== 'true' &&
    exists(m[1], m[2])
  )
    return (duplicate(res), true);

  // resumable uploads (tus 1.0.0) with a signed upload token
  if (rest === 'upload/resumable/sign' && req.method === 'POST') {
    const meta = Object.fromEntries(
      String(req.headers['upload-metadata'] ?? '')
        .split(',')
        .map((pair) => pair.trim().split(' '))
        .filter(([k]) => k)
        .map(([k, v]) => [k, v ? Buffer.from(v, 'base64').toString() : '']),
    );
    const key = `${meta.bucketName}/${meta.objectName}`;
    if (
      !meta.bucketName ||
      !meta.objectName ||
      uploadTokens.get(String(req.headers['x-signature'] ?? '')) !== key
    )
      return (badSignature(res), true);
    const bucket = await bucketRow(meta.bucketName);
    const length = Number(req.headers['upload-length']);
    if (!Number.isFinite(length) || length < 0) return (send(res, 400, { message: 'Upload-Length' }), true);
    if (bucket?.file_size_limit && length > Number(bucket.file_size_limit))
      return (send(res, 413, { statusCode: '413', error: 'Payload too large' }), true);
    if (bucket?.allowed_mime_types?.length && !bucket.allowed_mime_types.includes(meta.contentType))
      return (send(res, 415, { statusCode: '415', error: 'invalid_mime_type' }), true);
    if (req.headers['x-upsert'] !== 'true' && exists(meta.bucketName, meta.objectName))
      return (duplicate(res), true);
    const id = randomBytes(18).toString('base64url');
    const temp = join(STORAGE_DIR, '.tus', id);
    mkdirSync(dirname(temp), { recursive: true });
    writeFileSync(temp, Buffer.alloc(0));
    tusUploads.set(id, {
      bucket: meta.bucketName,
      path: meta.objectName,
      length,
      offset: 0,
      type: meta.contentType,
      key,
      temp,
    });
    res.writeHead(201, {
      ...CORS,
      location: `http://${req.headers.host}/storage/v1/upload/resumable/sign/${id}`,
      'tus-resumable': '1.0.0',
    });
    res.end();
    return true;
  }
  m = /^upload\/resumable\/sign\/([A-Za-z0-9_-]+)$/.exec(rest);
  if (m && (req.method === 'HEAD' || req.method === 'PATCH')) {
    const upload = tusUploads.get(m[1]);
    if (!upload) return (send(res, 404, { message: 'Upload not found' }), true);
    // every request carries a signed token for this file (a fresh one after the old expired is fine)
    if (uploadTokens.get(String(req.headers['x-signature'] ?? '')) !== upload.key)
      return (badSignature(res), true);
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        ...CORS,
        'upload-offset': String(upload.offset),
        'upload-length': String(upload.length),
        'tus-resumable': '1.0.0',
        'cache-control': 'no-store',
      });
      res.end();
      return true;
    }
    const chunk = await readRaw(req);
    if (Number(req.headers['upload-offset']) !== upload.offset)
      return (send(res, 409, { message: 'Offset mismatch' }), true);
    if (upload.offset + chunk.length > upload.length) return (send(res, 413, { message: 'Too long' }), true);
    writeFileSync(upload.temp, chunk, { flag: 'a' });
    upload.offset += chunk.length;
    if (upload.offset === upload.length) {
      const target = storagePath(upload.bucket, upload.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(upload.temp));
      writeFileSync(`${target}.type`, upload.type ?? 'application/octet-stream');
      rmSync(upload.temp, { force: true });
    }
    res.writeHead(204, { ...CORS, 'upload-offset': String(upload.offset), 'tus-resumable': '1.0.0' });
    res.end();
    return true;
  }
  return false;
}

// ─── Realtime: broadcast (REST in, WebSocket out — Phoenix protocol, vsn 1.0.0) ─────────────────
// Enough of Supabase Realtime for the live gallery: pages join `realtime:<channel>`, heartbeats are
// answered, and POST /realtime/v1/api/broadcast (the service role) sends each message to everyone
// on its topic. GET /realtime/v1/api/broadcast says who listens (tests).

const sockets = new Set(); // { socket, topics: Set<string> }

function wsSend(conn, message) {
  const data = Buffer.from(JSON.stringify(message));
  let head;
  if (data.length < 126) head = Buffer.from([0x81, data.length]);
  else if (data.length < 65536) head = Buffer.from([0x81, 126, data.length >> 8, data.length & 0xff]);
  else {
    head = Buffer.alloc(10);
    head[0] = 0x81;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(data.length), 2);
  }
  try {
    conn.socket.write(Buffer.concat([head, data]));
  } catch {
    // gone
  }
}

function onSocketMessage(conn, text) {
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return;
  }
  const reply = (topic, extra = {}) =>
    wsSend(conn, {
      topic,
      event: 'phx_reply',
      payload: { status: 'ok', response: {} },
      ref: m.ref,
      ...extra,
    });
  if (m.event === 'heartbeat') return reply('phoenix');
  if (m.event === 'phx_join') {
    conn.topics.add(m.topic);
    return wsSend(conn, {
      topic: m.topic,
      event: 'phx_reply',
      payload: { status: 'ok', response: { postgres_changes: [] } },
      ref: m.ref,
      join_ref: m.join_ref ?? m.ref,
    });
  }
  if (m.event === 'phx_leave') {
    conn.topics.delete(m.topic);
    return reply(m.topic);
  }
}

function realtimeSocket(req, socket) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/realtime/v1/websocket' || !ROLES[url.searchParams.get('apikey')]) {
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }
  const accept = createHash('sha1')
    .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const conn = { socket, topics: new Set() };
  sockets.add(conn);
  let buffer = Buffer.alloc(0);
  let fragments = [];
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      let length = buffer[1] & 0x7f;
      let at = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        at = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        at = 10;
      }
      const masked = (buffer[1] & 0x80) !== 0;
      const mask = masked ? buffer.subarray(at, at + 4) : null;
      if (masked) at += 4;
      if (buffer.length < at + length) return;
      const payload = Buffer.from(buffer.subarray(at, at + length));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buffer = buffer.subarray(at + length);
      if (opcode === 0x8) {
        socket.end(Buffer.from([0x88, 0]));
        return;
      }
      if (opcode === 0x9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
      if (opcode === 0x1 || opcode === 0x0) {
        fragments.push(payload);
        if (fin) {
          onSocketMessage(conn, Buffer.concat(fragments).toString());
          fragments = [];
        }
      }
    }
  });
  const drop = () => sockets.delete(conn);
  socket.on('close', drop);
  socket.on('error', drop);
}

async function broadcast(req, res) {
  if (req.method === 'GET') {
    const topics = {};
    for (const conn of sockets) for (const topic of conn.topics) topics[topic] = (topics[topic] ?? 0) + 1;
    return send(res, 200, topics);
  }
  if (req.method !== 'POST' || ROLES[req.headers.apikey] !== 'service_role')
    return send(res, 403, { error: 'Unauthorized' });
  const { messages = [] } = await readBody(req);
  for (const message of messages) {
    const topic = `realtime:${message.topic}`;
    for (const conn of sockets)
      if (conn.topics.has(topic))
        wsSend(conn, {
          topic,
          event: 'broadcast',
          payload: { type: 'broadcast', event: message.event, payload: message.payload ?? {} },
          ref: null,
        });
  }
  res.writeHead(202, CORS);
  return res.end();
}

// ─── server ─────────────────────────────────────────────────────────────────────────────────────

createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    const url = new URL(req.url, 'http://x');
    let m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
    if (m) return await rpc(req, res, m[1]);
    m = /^\/auth\/v1\/([a-z_]+(?:\/[A-Za-z0-9_-]+)*)$/.exec(url.pathname);
    if (m) return await auth(req, res, m[1], url.searchParams);
    m = /^\/storage\/v1\/(.+)$/.exec(url.pathname);
    if (m) return await storage(req, res, m[1], url.searchParams);
    if (url.pathname === '/realtime/v1/api/broadcast') return await broadcast(req, res);
    send(res, 404, { message: 'not found' });
  } catch (err) {
    send(res, 500, { message: String(err?.message ?? err) });
  }
})
  .on('upgrade', realtimeSocket)
  .listen(Number(process.env.REST_SHIM_PORT ?? 54321), '127.0.0.1', () => {
    console.log(`rest shim on :${process.env.REST_SHIM_PORT ?? 54321}`);
  });
