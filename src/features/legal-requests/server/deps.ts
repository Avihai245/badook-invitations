import 'server-only';
import { after } from 'next/server';
import { sendEmailStrict } from '@/features/invitations/server/email';
import { legalContext } from '@/features/legal/context';
import { legalStatus } from '@/features/legal/status';
import { serverEnv } from '@/lib/env';
import { rateKey } from '@/lib/links/tokens';
import { broadcastRefresh } from '@/lib/live/broadcast';
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

// strict: not configured (nothing was sent) must not be recorded as a notice that went out
const send: SendMail = (email) => sendEmailStrict({ ...email, kind: 'other' });

/**
 * "Something changed" for the gallery's open pages (the guests' feed, the screen, the host's tab): a hidden
 * or restored item shows or goes at once. Best effort — a hint that fails is only logged.
 */
async function refreshGallery(invitationId: string): Promise<void> {
  try {
    const channel = await legalDb.galleryChannel(invitationId);
    if (channel) await broadcastRefresh(channel, 'items', fetch, 'gallery');
  } catch (err) {
    console.error('[legal] gallery refresh failed', err);
  }
}

/** The address as the database keeps it: a salted hash (never the address itself). */
const hashIp = (ip: string | null) => rateKey('legal', 'ip', ip ?? 'unknown');

const later = (job: () => Promise<unknown>) =>
  after(() => job().catch((err) => console.error('[legal] notices failed', err)));

export function reportDeps(): ReportDeps {
  return { db: legalDb, send, later, hashIp, refreshGallery, config: legalConfig() };
}

export function requestDeps(): RequestDeps {
  return { db: legalDb, send, later, hashIp, config: legalConfig() };
}

export function adminLegalDeps(): AdminLegalDeps {
  return { db: legalDb, send, refreshGallery, config: legalConfig() };
}
