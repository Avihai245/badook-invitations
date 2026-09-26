import 'server-only';
import QRCode from 'qrcode';
import { accountDb, loadAccount } from '@/features/billing/server/account';
import { featureInput, featuresFor } from '@/features/flags/server';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { hostDeps } from '@/features/invitations/server/host-route';
import { getSessionUser } from '@/lib/supabase/session';
import { serverEnv } from '@/lib/env';
import { realtimeInfo } from '@/lib/live/broadcast';
import { checkImage } from './ai';
import { galleryDb } from './db';
import type { GuestDeps } from './guest-api';
import type { HostGalleryDeps } from './host-api';
import type { GalleryNotifyDeps } from './notices-api';
import { galleryNoticesDb } from './notices-db';
import { galleryTemplateReady, processGalleryNoticeQueue } from './notify';
import { broadcastRefresh } from './realtime';
import { galleryStorage } from './storage';
import { sweepNow } from './sweep';

/** The real dependencies of the gallery's API (tests pass their own). */

const realtime = realtimeInfo;

function aiCheck() {
  const env = serverEnv();
  const model = env.INVITES_GALLERY_AI_MODEL || env.INVITES_AI_MODEL;
  if (!env.ANTHROPIC_API_KEY || !model) return null;
  return (jpeg: Uint8Array) =>
    checkImage(jpeg, { apiKey: env.ANTHROPIC_API_KEY, model, apiBase: env.INVITES_AI_API_BASE });
}

export function guestDeps(): GuestDeps {
  return {
    db: galleryDb,
    storage: galleryStorage,
    features: featuresFor,
    broadcast: broadcastRefresh,
    checkImage: aiCheck(),
    realtime,
    swept: sweepNow,
    now: () => Date.now(),
  };
}

const QR = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1C1917', light: '#FFFFFF' } } as const;

export function hostGalleryDeps(): HostGalleryDeps {
  return {
    db: galleryDb,
    storage: galleryStorage,
    featureInput,
    broadcast: broadcastRefresh,
    realtime,
    sweep: sweepNow,
    qr: async (url) => {
      const [svg, png] = await Promise.all([
        QRCode.toString(url, { ...QR, type: 'svg' }),
        QRCode.toDataURL(url, { ...QR, width: 1024 }),
      ]);
      return { svg, png };
    },
    now: () => Date.now(),
    // the invitation's gallery section links to the gallery: its cached page follows the link
    revalidateInvitation: (slug) => hostDeps.revalidate(slug),
  };
}

export function galleryNotifyDeps(): GalleryNotifyDeps {
  return {
    db: galleryNoticesDb,
    gallery: galleryDb,
    featureInput,
    async invitation(id, userId) {
      const inv = await hostDb.get(id, userId);
      if (!inv) return null;
      const doc = inv.published ?? inv.draft;
      const locale = doc.defaultLocale === 'en' ? 'en' : 'he';
      return { hosts: hostsLine(doc.hosts, locale), locale };
    },
    ready: galleryTemplateReady,
    priceUsd: serverEnv().INVITES_WHATSAPP_PRICE_USD,
    send: (invitationId, limit) => processGalleryNoticeQueue(invitationId, limit),
    async account(userId) {
      // the signed-in host (the API routes verified the session): their email decides admin
      const user = await getSessionUser();
      const account = await loadAccount({ id: userId, email: user?.id === userId ? user.email : undefined });
      return { credits: account.credits, admin: account.admin };
    },
    async addCredits(userId, count, ref) {
      await accountDb.creditsAdd(userId, count, 'admin', ref);
    },
  };
}
