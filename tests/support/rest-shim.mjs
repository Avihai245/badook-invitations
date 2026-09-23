// Local stand-in for Supabase's REST API (PostgREST) — only what the app uses: POST /rest/v1/rpc/<fn>.
// The API key picks the database role exactly like Supabase maps its keys (publishable → anon,
// secret → service_role), so RPC grants and RLS are enforced by Postgres, not by this shim.
//
//   DATABASE_URL=postgres://… REST_SHIM_PORT=54321 node tests/support/rest-shim.mjs
//   app env: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
//            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-publishable  SUPABASE_SECRET_KEY=local-secret
import { createServer } from 'node:http';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const ROLES = { 'local-publishable': 'anon', 'local-secret': 'service_role' };
const FUNCTIONS = new Set([
  'get_published_invitation',
  'submit_rsvp',
  'rsvp_rate_hit',
  'publish_invitation',
  'restore_invitation_version',
]);
const IDENT = /^p_[a-z_]+$/;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const match = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(new URL(req.url, 'http://x').pathname);
  if (req.method !== 'POST' || !match || !FUNCTIONS.has(match[1]))
    return send(res, 404, { message: 'not found' });
  const role = ROLES[req.headers.apikey];
  if (!role) return send(res, 401, { message: 'invalid api key' });
  let body = '';
  for await (const chunk of req) body += chunk;
  const args = body ? JSON.parse(body) : {};
  const names = Object.keys(args);
  if (!names.every((n) => IDENT.test(n))) return send(res, 400, { message: 'bad argument name' });
  const values = names.map((n) =>
    args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n],
  );
  const call = `select public.${match[1]}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  const client = await pool.connect();
  try {
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
}).listen(Number(process.env.REST_SHIM_PORT ?? 54321), '127.0.0.1', () => {
  console.log(`rest shim on :${process.env.REST_SHIM_PORT ?? 54321}`);
});
