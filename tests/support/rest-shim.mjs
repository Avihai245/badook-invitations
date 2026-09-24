// Local stand-in for the parts of Supabase the app uses, for the end-to-end stack (never deployed):
//   · REST  POST /rest/v1/rpc/<fn> — the API key picks the database role exactly like Supabase maps its
//     keys (publishable → anon, secret → service_role), so grants and RLS are enforced by Postgres;
//   · Auth  /auth/v1 — email + password sign-up (auto-confirmed), password / refresh-token grants,
//     GET/PUT /user, logout, recover; HS256 access tokens; users live in auth.users;
//   · Storage /storage/v1 — signed upload URLs (service role), uploads, public reads; files on disk,
//     bucket size/MIME limits from storage.buckets.
//
//   DATABASE_URL=postgres://… REST_SHIM_PORT=54321 node tests/support/rest-shim.mjs
//   app env: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
//            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-publishable  SUPABASE_SECRET_KEY=local-secret
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
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
]);
const IDENT = /^p_[a-z_]+$/;
const JWT_SECRET = process.env.SHIM_JWT_SECRET ?? 'local-shim-jwt-secret-for-tests-only';
const STORAGE_DIR = process.env.SHIM_STORAGE_DIR ?? 'tests/.artifacts/storage';
const TOKEN_TTL = 3600;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-upsert, cache-control, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

async function auth(req, res, path, query) {
  if (!ROLES[req.headers.apikey]) return authError(res, 401, 'no_api_key', 'Invalid API key');
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
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || coalesce($3, '{}'), updated_at = now() where id = $1`,
        [claims.sub, password === undefined ? null : hashPassword(password), data ?? null],
      );
    }
    const row = await userById(claims.sub);
    return row ? send(res, 200, userJson(row)) : authError(res, 403, 'user_not_found', 'User not found');
  }
  // ── admin (service role): what the server does with auth.admin.* ──
  const admin = /^admin\/users\/([0-9a-f-]{36})$/.exec(path);
  if (admin) {
    if (ROLES[req.headers.apikey] !== 'service_role') return authError(res, 403, 'not_admin', 'User not allowed');
    if (req.method === 'DELETE') {
      const deleted = await pool.query('delete from auth.users where id = $1', [admin[1]]);
      return deleted.rowCount ? send(res, 200, {}) : authError(res, 404, 'user_not_found', 'User not found');
    }
    if (req.method === 'GET') {
      const row = await userById(admin[1]);
      return row ? send(res, 200, userJson(row)) : authError(res, 404, 'user_not_found', 'User not found');
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
      names = readdirSync(storagePath(m[1], prefix), { withFileTypes: true }).filter((d) => !d.name.endsWith('.type'));
    } catch {
      names = [];
    }
    // like Supabase: folders come back with id null
    return send(
      res,
      200,
      names.map((d) => ({ name: d.name, id: d.isDirectory() ? null : randomUUID(), metadata: d.isDirectory() ? null : {} })),
    );
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
    send(res, 404, { message: 'not found' });
  } catch (err) {
    send(res, 500, { message: String(err?.message ?? err) });
  }
}).listen(Number(process.env.REST_SHIM_PORT ?? 54321), '127.0.0.1', () => {
  console.log(`rest shim on :${process.env.REST_SHIM_PORT ?? 54321}`);
});
