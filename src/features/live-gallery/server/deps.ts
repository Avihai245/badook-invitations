import 'server-only';
import QRCode from 'qrcode';
import { featureInput, featuresFor } from '@/features/flags/server';
import { serverEnv } from '@/lib/env';
import { checkImage } from './ai';
import { galleryDb } from './db';
import type { GuestDeps } from './guest-api';
import type { HostGalleryDeps } from './host-api';
import { broadcastRefresh } from './realtime';
import { galleryStorage } from './storage';
import { sweepNow } from './sweep';

/** The real dependencies of the gallery's API (tests pass their own). */

function realtime(channel: string) {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, ''),
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    channel,
  };
}

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
  };
}
