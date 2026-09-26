import 'server-only';
import QRCode from 'qrcode';
import { accountDb, loadAccount } from '@/features/billing/server/account';
import { featureInput, featuresFor } from '@/features/flags/server';
import { serverEnv } from '@/lib/env';
import { broadcastRefresh, realtimeInfo } from '@/lib/live/broadcast';
import { getSessionUser } from '@/lib/supabase/session';
import { eventDayDb } from './db';
import type { DayHostDeps } from './host-api';
import { processNoticeQueue, tableTemplateReady } from './notify';
import type { StationDeps } from './station-api';

/** The real dependencies of the event day's API (tests pass their own). */

const broadcast = (channel: string, kind: string) => broadcastRefresh(channel, kind, fetch, 'event-day');

export function stationDeps(): StationDeps {
  return { db: eventDayDb, features: featuresFor, broadcast, realtime: realtimeInfo };
}

const QR = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1C1917', light: '#FFFFFF' } } as const;

/** A QR code as SVG and PNG (the station link on the host's screen). */
export async function qrCode(text: string): Promise<{ svg: string; png: string }> {
  const [svg, png] = await Promise.all([
    QRCode.toString(text, { ...QR, type: 'svg' }),
    QRCode.toDataURL(text, { ...QR, width: 1024 }),
  ]);
  return { svg, png };
}

export function dayHostDeps(): DayHostDeps {
  return {
    db: eventDayDb,
    featureInput,
    broadcast,
    realtime: realtimeInfo,
    qr: qrCode,
    notify: {
      ready: tableTemplateReady,
      priceUsd: serverEnv().INVITES_WHATSAPP_PRICE_USD,
      send: (invitationId, limit) => processNoticeQueue(invitationId, limit),
      async account(userId) {
        // the signed-in host (the API routes verified the session): their email decides admin
        const user = await getSessionUser();
        const account = await loadAccount({
          id: userId,
          email: user?.id === userId ? user.email : undefined,
        });
        return { credits: account.credits, admin: account.admin };
      },
      async addCredits(userId, count, ref) {
        await accountDb.creditsAdd(userId, count, 'admin', ref);
      },
    },
    now: () => Date.now(),
  };
}
