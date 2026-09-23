import 'server-only';
import QRCode from 'qrcode';
import type { Locale } from '../contracts/types';
import { assetBasesFromEnv } from '../renderer/assets';
import { pageDescription, pageTitle } from '../renderer/calendar-event';
import { buildRenderContext } from '../renderer/context';
import type { TemplateEntry } from '../templates/registry';
import type { OwnerInvitation } from './host-db';
import { ogVersion } from './og-image';
import { serverEnv } from '@/lib/env';

/** One language of the share screen: the link to send, the prefilled message and the preview card. */
export interface ShareLocale {
  locale: Locale;
  /** the default locale gets the bare link; another one adds ?lang= */
  url: string;
  message: string;
  card: { title: string; description: string; image: string };
}

export interface ShareData {
  url: string;
  /** the default locale first (§9B.3-F: the message is prefilled in it) */
  locales: ShareLocale[];
  /** the host shown under the WhatsApp card */
  domain: string;
  /** QR of `url`: inline SVG markup and a 1024px PNG data URL (downloads) */
  qr: { svg: string; png: string };
  unpublishedChanges: boolean;
}

const QR_OPTIONS = {
  margin: 1,
  errorCorrectionLevel: 'M',
  color: { dark: '#1C1917', light: '#FFFFFF' },
} as const;

/**
 * Everything the share screen shows for a published invitation (§7.7, §9B.3-F), from the published
 * document — what guests actually get. null while the invitation isn't published.
 */
export async function shareData(inv: OwnerInvitation, entry: TemplateEntry): Promise<ShareData | null> {
  const doc = inv.published;
  if (!doc || inv.status !== 'published') return null;
  const env = serverEnv();
  const base = env.INVITES_PUBLIC_BASE_URL.replace(/\/+$/, '');
  const url = `${base}/i/${inv.slug}`;
  const version = ogVersion(doc);
  const ordered = [doc.defaultLocale, ...doc.locales.filter((l) => l !== doc.defaultLocale)];
  const locales = ordered.map((locale): ShareLocale => {
    const ctx = buildRenderContext(doc, entry.manifest, locale, {
      brand: env.INVITES_BRAND_NAME,
      publicBaseUrl: base,
      bases: assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      }),
    });
    const link = locale === doc.defaultLocale ? url : `${url}?lang=${locale}`;
    const title = pageTitle(ctx);
    return {
      locale,
      url: link,
      message: ctx.t('share.message', { title, date: ctx.eventDateLong, url: link }),
      card: {
        title,
        description: pageDescription(ctx),
        // same origin as the host app: the preview works wherever the app runs
        image: `/i/${inv.slug}/opengraph-image?lang=${locale}&v=${version}`,
      },
    };
  });
  const [svg, png] = await Promise.all([
    QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' }),
    QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1024 }),
  ]);
  return {
    url,
    locales,
    domain: new URL(base).host,
    qr: { svg, png },
    unpublishedChanges: JSON.stringify(inv.draft) !== JSON.stringify(doc),
  };
}
