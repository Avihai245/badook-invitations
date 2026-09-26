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
import { cinematicForPage } from '@/features/invitations/server/cinematic';
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

function renderOptions(invitation: PublishedInvitation, cinematic: boolean): Omit<RenderOptions, 'mode'> {
  const env = serverEnv();
  return {
    cinematic,
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

function context(invitation: PublishedInvitation, locale: Locale, cinematic = false): RenderContext {
  return buildRenderContext(invitation.doc, invitation.entry.manifest, locale, {
    ...renderOptions(invitation, cinematic),
    mode: 'live',
  });
}

/**
 * A hidden invitation (`share.noindex`, the default): not indexed, links not followed, no cached copy,
 * no image search — in <head> for every crawler (htmlLimitedBots), which is why robots.txt must let
 * them fetch /i/ (app/robots.ts). The OG image and the calendar file say the same in X-Robots-Tag.
 */
const HIDDEN_ROBOTS = {
  index: false,
  follow: false,
  noarchive: true,
  noimageindex: true,
  googleBot: { index: false, follow: false, noarchive: true, noimageindex: true },
} satisfies Metadata['robots'];

const otherLocale = (doc: InvitationDocument, locale: Locale): Locale | null =>
  doc.locales.length > 1
    ? (doc.locales[(doc.locales.indexOf(locale) + 1) % doc.locales.length] ?? null)
    : null;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, lang } = await params;
  const invitation = await getPublishedInvitation(slug);
  const locale = invitation && resolveLocale(invitation.doc, lang);
  // not-found.tsx: nothing to show on this link (yet)
  if (!invitation || !locale)
    return {
      title: lang === 'en' ? 'Invitation not available' : 'ההזמנה לא זמינה',
      robots: { index: false, follow: false },
    };
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
    // §4: hidden from search engines unless the host turned it off — see HIDDEN_ROBOTS
    robots: share.noindex ? HIDDEN_ROBOTS : undefined,
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
  // the event's `cinematic` feature: its v2 presentation, or the plain rendering (features/flags)
  const cinematic = await cinematicForPage(invitation.id, invitation.doc, invitation.entry.manifest);
  // the pill's plain link keeps the cover skipped; with JS the language switches in place (LiveLocale)
  const link = (l: Locale) => `/i/${slug}?lang=${l}&open=1`;
  const live = buildLivePayload(
    invitation.doc,
    invitation.entry.manifest,
    renderOptions(invitation, cinematic),
    (l) => ({
      url: `/i/${slug}?lang=${l}`,
      href: link(l),
    }),
  );
  return (
    <InvitationBody
      ctx={context(invitation, locale, cinematic)}
      showCover
      skipCoverFromUrl
      langSwitchHref={next ? link(next) : null}
      live={live}
    />
  );
}
