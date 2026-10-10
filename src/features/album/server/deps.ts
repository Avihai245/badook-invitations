import 'server-only';
import QRCode from 'qrcode';
import { accountDb, loadAccount } from '@/features/billing/server/account';
import { filmFontCss, filmFonts } from '@/features/film/server/deps';
import { featureInput, featuresFor } from '@/features/flags/server';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import { resolvePalette } from '@/features/invitations/renderer/theme';
import { guestsDb } from '@/features/invitations/server/guests';
import { hostDb } from '@/features/invitations/server/host-db';
import { hostDeps } from '@/features/invitations/server/host-route';
import { sendEmail } from '@/features/invitations/server/email';
import { getTemplate } from '@/features/invitations/templates/registry';
import { galleryStorage } from '@/features/live-gallery/server/storage';
import { configuredTemplateLanguages } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { getSessionUser } from '@/lib/supabase/session';
import { albumEventPhrase } from '../phrases';
import type { AlbumDeps, AlbumDesign } from './api';
import { albumDb } from './db';
import type { AlbumNotifyDeps } from './notices-api';
import { albumNoticesDb } from './notices-db';
import { albumTemplateReady, processAlbumNoticeQueue } from './notify';
import type { ReadyDeps } from './ready';

/** The real dependencies of the album's API (tests pass their own). */

const QR = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1C1917', light: '#FFFFFF' } } as const;

/** The design's palette and fonts, and the @font-face rules the album page declares for them. */
export function albumDesign(doc: InvitationDocument): (AlbumDesign & { fontCss: string }) | null {
  const template = getTemplate(doc.templateId)?.manifest;
  if (!template) return null;
  const p = resolvePalette(template, doc);
  const fonts = filmFonts(template, doc);
  return {
    palette: {
      bg: p.bg,
      surface: p.surface,
      ink: p.ink,
      inkMuted: p.inkMuted,
      accent: p.accent,
      accentInk: p.accentInk,
      line: p.line,
    },
    fonts: { display: fonts.display, heading: fonts.heading },
    fontCss: filmFontCss(fonts),
  };
}

export function albumDeps(): AlbumDeps {
  return {
    db: albumDb,
    storage: galleryStorage,
    featureInput,
    features: featuresFor,
    qr: async (url) => {
      const [svg, png] = await Promise.all([
        QRCode.toString(url, { ...QR, type: 'svg' }),
        QRCode.toDataURL(url, { ...QR, width: 1024 }),
      ]);
      return { svg, png };
    },
    design: albumDesign,
    revalidateInvitation: (slug) => hostDeps.revalidate(slug),
    now: () => Date.now(),
    brand: serverEnv().INVITES_BRAND_NAME,
  };
}

export function albumNotifyDeps(): AlbumNotifyDeps {
  return {
    db: albumNoticesDb,
    album: albumDb,
    featureInput,
    async invitation(id, userId) {
      const inv = await hostDb.get(id, userId);
      if (!inv) return null;
      const doc = inv.published ?? inv.draft;
      const hosts: Partial<Record<Locale, string>> = {};
      const phrase: Partial<Record<Locale, string>> = {};
      for (const l of doc.locales) {
        hosts[l] = hostsLine(doc.hosts, l);
        phrase[l] = albumEventPhrase(doc, l);
      }
      return { locale: doc.defaultLocale, locales: [...doc.locales], hosts, phrase };
    },
    async guestLanguages(id, userId) {
      const guests = await guestsDb.list(id, userId);
      return Object.fromEntries((guests ?? []).map((g) => [g.id, g.language]));
    },
    templateLanguages: configuredTemplateLanguages,
    ready: albumTemplateReady,
    priceUsd: serverEnv().INVITES_WHATSAPP_PRICE_USD,
    send: (invitationId, limit) => processAlbumNoticeQueue(invitationId, limit),
    async account(userId) {
      const user = await getSessionUser();
      const account = await loadAccount({ id: userId, email: user?.id === userId ? user.email : undefined });
      return { credits: account.credits, admin: account.admin };
    },
    async addCredits(userId, count, ref) {
      await accountDb.creditsAdd(userId, count, 'admin', ref);
    },
  };
}

export function readyDeps(): ReadyDeps {
  const env = serverEnv();
  return {
    db: albumDb,
    hasAlbum: async (id) => (await featuresFor(id)).has('album'),
    send: (email) => sendEmail({ ...email, kind: 'other' }),
    base: env.INVITES_PUBLIC_BASE_URL,
    brand: env.INVITES_BRAND_NAME,
  };
}
