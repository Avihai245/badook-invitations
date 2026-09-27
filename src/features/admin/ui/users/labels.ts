import type { AdminDict } from '../../i18n';
import type { UserSource } from '../../server/core-db';

/** Where an account came from, in words ("Badook Events" for any partner's). */
export function sourceLabel(t: AdminDict, source: UserSource | string): string {
  if (source.startsWith('partner:')) return t.users.sources.partner;
  return source === 'google' ? t.users.sources.google : t.users.sources.signup;
}

/** A plan's name. */
export const planLabel = (t: AdminDict, plan: string) =>
  (t.users.plans as Record<string, string>)[plan] ?? plan;
