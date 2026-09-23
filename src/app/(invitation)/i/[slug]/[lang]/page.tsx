import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { pageDescription, pageTitle } from '@/features/invitations/renderer/calendar-event';
import {
  buildRenderContext,
  type RenderContext,
  type RenderOptions,
} from '@/features/invitations/renderer/context';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
import { buildLivePayload } from '@/features/invitations/renderer/live/build';
import { OG_SIZE, ogVersion } from '@/features/invitations/server/og-image';
import {
  getPublishedInvitation,
  resolveLocale,
  type PublishedInvitation,
} from '@/features/invitations/server/published';
import { serverEnv } from '@/lib/env';

type Params = Promise<{ slug: string; lang: string }>;

// ISR (§1.1 rule 5): cached per slug + locale, refreshed at most a minute after a change even where
// on-demand revalidation (revalidatePath on publish) is unavailable. Unknown slugs render on demand.
export const revalidate = 60;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string; lang: string }[]> {
  return [];
}

function renderOptions(invitation: PublishedInvitation): Omit<RenderOptions, 'mode'> {
  const env = serverEnv();
  return {
    followUp: invitation.followUp,
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    icsViaRoute: true,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
  };
}

function context(invitation: PublishedInvitation, locale: Locale): RenderContext {
  return buildRenderContext(invitation.doc, invitation.entry.manifest, locale, {
    ...renderOptions(invitation),
    mode: 'live',
  });
}

const otherLocale = (doc: InvitationDocument, locale: Locale): Locale | null =>
  doc.locales.length > 1
    ? (doc.locales[(doc.locales.indexOf(locale) + 1) % doc.locales.length] ?? null)
    : null;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, lang } = await params;
  const invitation = await getPublishedInvitation(slug);
  const locale = invitation && resolveLocale(invitation.doc, lang);
  if (!invitation || !locale) return {};
  const ctx = context(invitation, locale);
  const { share } = invitation.doc;
  const title = pageTitle(ctx);
  const description = pageDescription(ctx);
  const url = `${ctx.publicBaseUrl}/i/${slug}?lang=${locale}`;
  // the document hash in the URL: link previews cache images by URL (a new one per publish)
  const image = {
    url: `${ctx.publicBaseUrl}/i/${slug}/opengraph-image?lang=${locale}&v=${ogVersion(invitation.doc)}`,
    ...OG_SIZE,
    alt: title,
  };
  return {
    title,
    description,
    // §4: noindex unless the host turned it off
    robots: share.noindex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        invitation.doc.locales.map((l) => [l, `${ctx.publicBaseUrl}/i/${slug}?lang=${l}`]),
      ),
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: locale === 'he' ? 'he_IL' : 'en_GB',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

/** The public invitation — the same renderer as the kitchen sink and the editor preview (§5). */
export default async function PublicInvitationPage({ params }: { params: Params }) {
  const { slug, lang } = await params;
  const invitation = await getPublishedInvitation(slug);
  const locale = invitation && resolveLocale(invitation.doc, lang);
  if (!invitation || !locale) notFound();
  const next = otherLocale(invitation.doc, locale);
  // the pill's plain link keeps the cover skipped; with JS the language switches in place (LiveLocale)
  const link = (l: Locale) => `/i/${slug}?lang=${l}&open=1`;
  const live = buildLivePayload(
    invitation.doc,
    invitation.entry.manifest,
    renderOptions(invitation),
    (l) => ({
      url: `/i/${slug}?lang=${l}`,
      href: link(l),
    }),
  );
  return (
    <InvitationBody
      ctx={context(invitation, locale)}
      showCover
      skipCoverFromUrl
      langSwitchHref={next ? link(next) : null}
      live={live}
    />
  );
}
