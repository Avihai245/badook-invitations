import 'server-only';
import { after } from 'next/server';
import { sendEmail } from '@/features/invitations/server/email';
import { legalContext } from '@/features/legal/context';
import { legalStatus } from '@/features/legal/status';
import { serverEnv } from '@/lib/env';
import { rateKey } from '@/lib/links/tokens';
import { legalDb } from './db';
import type { LegalConfig, SendMail } from './common';
import type { AdminLegalDeps } from './admin-api';
import type { RequestDeps } from './privacy-request';
import type { ReportDeps } from './report';

/** The real dependencies of the report and privacy-request flows (tests pass their own). */

/** Version 2 of the legal documents is in force: the flows exist; else they are "not found". */
export const legalRequestsActive = (): boolean => legalStatus().active;

export function legalConfig(): LegalConfig {
  const env = serverEnv();
  return {
    // INVITES_PRIVACY_EMAIL, else the support address (legal/context.ts)
    teamEmail: legalContext('he').privacyEmail,
    brand: env.INVITES_BRAND_NAME,
    site: env.INVITES_PUBLIC_BASE_URL,
  };
}

const send: SendMail = (email) => sendEmail({ ...email, kind: 'other' });

/** The address as the database keeps it: a salted hash (never the address itself). */
const hashIp = (ip: string | null) => rateKey('legal', 'ip', ip ?? 'unknown');

const later = (job: () => Promise<unknown>) =>
  after(() => job().catch((err) => console.error('[legal] notices failed', err)));

export function reportDeps(): ReportDeps {
  return { db: legalDb, send, later, hashIp, config: legalConfig() };
}

export function requestDeps(): RequestDeps {
  return { db: legalDb, send, later, hashIp, config: legalConfig() };
}

export function adminLegalDeps(): AdminLegalDeps {
  return { db: legalDb, send, config: legalConfig() };
}
