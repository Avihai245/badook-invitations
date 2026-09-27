import 'server-only';
import { hostsLine } from '@/features/invitations/lib/text';
import { serverEnv } from '@/lib/env';
import { usdToIls } from '../finance/model';
import { adminRpc } from '../server/db';
import type { Staff } from '../server/gate';
import type { FailureRaw, MessagesRaw } from './model';

/**
 * The messages area's database function (supabase/migrations/*_admin_money_messages.sql) — it checks
 * the staff member's role itself — and the daily job's housekeeping of the console's logs.
 */

export interface FailureRow extends Omit<FailureRaw, 'hosts' | 'locale'> {
  /** the invitation's hosts as it writes them (else its address) */
  title: string;
}

export interface MessagesPageData extends Omit<MessagesRaw, 'failures'> {
  failures: FailureRow[];
  monthIls: number;
  usdRate: number;
}

/** "Noa & Itay", from an invitation's draft (anything unreadable: null). */
function titleOf(hosts: unknown, locale: string | null): string | null {
  try {
    const h = hosts as Parameters<typeof hostsLine>[0];
    if (!h || typeof h !== 'object' || !h.primary) return null;
    const l = locale ?? 'he';
    return (
      hostsLine({ primary: h.primary, secondary: h.secondary ?? null, joiner: h.joiner ?? null }, l) || null
    );
  } catch {
    return null;
  }
}

export async function loadMessages(staff: Staff): Promise<MessagesPageData> {
  const raw = await adminRpc<MessagesRaw>('admin_messages_overview', { p_actor: staff.userId });
  const usdRate = serverEnv().INVITES_USD_TO_ILS;
  return {
    ...raw,
    failures: raw.failures.map(({ hosts, locale, ...f }) => ({
      ...f,
      title: titleOf(hosts, locale) ?? f.slug ?? f.invitationId.slice(0, 8),
    })),
    monthIls: usdToIls(raw.monthUsd, usdRate),
    usdRate,
  };
}

/**
 * The daily job: the partner API's calls and the emails' log after 90 days (the privacy policy says
 * so). null when it couldn't run (logged).
 */
export async function consoleLogsHousekeeping(): Promise<{ partnerCalls: number; emails: number } | null> {
  return adminRpc<{ partnerCalls: number; emails: number }>('admin_logs_maintenance', {}).catch(
    (err) => (console.error('[admin] logs housekeeping failed', err), null),
  );
}
