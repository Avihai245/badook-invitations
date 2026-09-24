/**
 * Settings a production deployment should have, checked once at server start (instrumentation):
 * what's missing is logged by name — never a value — so it shows up in the hosting logs. The app
 * works without them, but the legal pages then name only "the operator of <brand>", the accessibility
 * statement has no coordinator to contact (the regulations require one), and links fall back to the
 * address a request came in on.
 */
const RECOMMENDED: [name: string, why: string][] = [
  ['INVITES_LEGAL_NAME', 'the operator named in the privacy policy and terms'],
  ['INVITES_LEGAL_ID', 'company / business number in the legal pages'],
  ['INVITES_LEGAL_ADDRESS', 'address in the legal pages'],
  ['INVITES_ACCESSIBILITY_COORDINATOR', 'the accessibility coordinator named in the statement'],
  ['INVITES_ACCESSIBILITY_PHONE', 'the coordinator’s phone in the statement'],
  ['INVITES_SUPPORT_EMAIL', 'where the contact form and the statement send people'],
];

export function missingSettings(env: Record<string, string | undefined>): string[] {
  const missing = RECOMMENDED.filter(([name]) => !env[name]?.trim()).map(([name, why]) => `${name} (${why})`);
  const base = env.INVITES_PUBLIC_BASE_URL?.trim() ?? '';
  if (!base || /localhost|127\.0\.0\.1|\.amplifyapp\.com/i.test(base))
    missing.push('INVITES_PUBLIC_BASE_URL (the site’s own domain, e.g. https://invitations.example.com)');
  return missing;
}

export function logMissingSettings(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const missing = missingSettings(env);
  if (missing.length)
    console.warn(`[startup] settings to add in the hosting console:\n  - ${missing.join('\n  - ')}`);
}
