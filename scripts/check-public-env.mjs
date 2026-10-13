#!/usr/bin/env node
/**
 * Proof that no secret is named like a public variable. Next.js inlines every NEXT_PUBLIC_* variable into
 * the JavaScript the browser downloads, so a secret under that prefix is published with the next build.
 * Runs before every build (package.json `prebuild`) and exits 1, naming the variables (never values):
 *
 *   · in the environment: a NEXT_PUBLIC_* whose name says it is a secret (SECRET, PASSWORD, PRIVATE,
 *     TOKEN, SERVICE_ROLE, API_KEY, …) — the only allowed key-like name is NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *     which is public by design (Row Level Security protects the data);
 *   · in the environment: a NEXT_PUBLIC_* whose value looks like a secret (an `sb_secret_` key, a
 *     `sk-` API key, a service-role JWT, a private key block);
 *   · in .env.example (by name) and in any .env / .env.local / .env.production file on disk (by name and value).
 */
import { readFileSync } from 'node:fs';

const ALLOWED = new Set(['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
const SECRET_NAME =
  /(SECRET|PASSWORD|PASSWD|PRIVATE|TOKEN|SERVICE_ROLE|API_KEY|APIKEY|ACCESS_KEY|CREDENTIAL|_PW$)/i;
const SECRET_VALUE =
  /(sb_secret_|sk-ant-|sk-proj-|sk_live_|sk_test_|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,})/;

/** The problems with a set of variables: [{ name, why }]. Exported for tests. */
export function publicEnvProblems(env) {
  const problems = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_') || ALLOWED.has(name)) continue;
    if (SECRET_NAME.test(name)) problems.push({ name, why: 'the name says it is a secret' });
    else if (typeof value === 'string' && SECRET_VALUE.test(value))
      problems.push({ name, why: 'the value looks like a secret' });
  }
  return problems;
}

/** The assignments in a dotenv file's text, as { NAME: value }. */
export function parseDotenv(text) {
  const out = {};
  for (const m of text.matchAll(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/gm))
    out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  return out;
}

/** The names assigned in a dotenv file's text. */
export function namesIn(text) {
  return [...text.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
}

function main() {
  const problems = publicEnvProblems(process.env);
  let example = '';
  try {
    example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  } catch {
    /* no .env.example (a trimmed checkout): nothing to check there */
  }
  for (const name of namesIn(example)) {
    problems.push(
      ...publicEnvProblems({ [name]: '' }).map((p) => ({ ...p, name: `${name} (.env.example)` })),
    );
  }
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    let text = '';
    try {
      text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    } catch {
      continue;
    }
    problems.push(
      ...publicEnvProblems(parseDotenv(text)).map((p) => ({ ...p, name: `${p.name} (${file})` })),
    );
  }
  if (problems.length === 0) return;
  console.error('Secrets must never be named NEXT_PUBLIC_*: Next.js publishes those to every browser.');
  for (const p of problems) console.error(`  ✗ ${p.name} — ${p.why}`);
  console.error('Rename it without the NEXT_PUBLIC_ prefix and read it on the server (src/lib/env.ts).');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
