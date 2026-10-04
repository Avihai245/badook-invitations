import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Locale } from '@/features/invitations/contracts/types';
import { t } from '@/features/invitations/i18n/dictionary';
import { LOCALE_INFO, isLocale } from '@/features/invitations/lib/locales';
import { pageDescription, pageTitle } from '@/features/invitations/renderer/calendar-event';
import { buildRenderContext, type RenderContext } from '@/features/invitations/renderer/context';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
import { buildLivePayload } from '@/features/invitations/renderer/live/build';
import { cinematicForPage } from '@/features/invitations/server/cinematic';
import { OG_SIZE, ogVersion } from '@/features/invitations/server/og-image';
import { liveBodyPath } from '@/features/invitations/server/live-body';
import { pageExtras, type PageExtras } from '@/features/invitations/server/page-extras';
import { renderOptions } from '@/features/invitations/server/render-options';
import {
  getPublishedInvitation,
  resolveLocale,
  type PublishedInvitation,
} from '@/features/invitations/server/published';
import { voiceForPage } from '@/features/voice/server/page';

type Params = Promise<{ slug: string; lang: string }>;

// ISR (§1.1 rule 5): cached per slug + locale, on the server and the CDN. Every change a guest would
// see refreshes it on demand (server/revalidate.ts: publishing, edits, features, the account's end);
// the time limit only catches what changes with the clock — the RSVP deadline passing, a plan ending —
// within ten minutes. Unknown slugs render on demand.
export const revalidate = 600;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string; lang: string }[]> {
  return [];
}

function context(
  invitation: PublishedInvitation,
  locale: Locale,
  cinematic = false,
  extras?: PageExtras,
): RenderContext {
  return buildRenderContext(invitation.doc, invitation.entry.manifest, locale, {
    ...renderOptions(invitation, cinematic, extras),
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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, lang } = await params;
  const invitation = await getPublishedInvitation(slug);
  const locale = invitation && resolveLocale(invitation.doc, lang);
  // not-found.tsx: nothing to show on this link (yet)
  if (!invitation || !locale)
    return {
      title: t(isLocale(lang) ? lang : 'he', 'missing.metaTitle'),
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
      locale: LOCALE_INFO[locale].og,
      alternateLocale: invitation.doc.locales.filter((l) => l !== locale).map((l) => LOCALE_INFO[l].og),
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
  // the event's `cinematic` feature: its v2 presentation, or the plain rendering (features/flags)
  const [cinematic, voice, extras] = await Promise.all([
    cinematicForPage(invitation.id, invitation.doc, invitation.entry.manifest),
    // the invitation read aloud (feature `voice`): each language's audio, or its words for the device
    voiceForPage(invitation),
    // the gallery section's link and the insights beacon, when the event has them (features/flags)
    pageExtras(invitation.id, invitation.doc),
  ]);
  // the language control's plain links keep the cover skipped; with JS the language switches in place
  // (LiveLocale)
  const link = (l: Locale) => `/i/${slug}?lang=${l}&open=1`;
  const live = buildLivePayload(
    invitation.doc,
    invitation.entry.manifest,
    renderOptions(invitation, cinematic, extras),
    (l) => ({
      url: `/i/${slug}?lang=${l}`,
      href: link(l),
    }),
    // the document and template for the other languages come as a cached file, not in this page
    liveBodyPath(slug),
  );
  return (
    <InvitationBody
      ctx={context(invitation, locale, cinematic, extras)}
      showCover
      skipCoverFromUrl
      langHrefs={Object.fromEntries(invitation.doc.locales.map((l) => [l, link(l)]))}
      live={live}
      voice={voice}
    />
  );
}
