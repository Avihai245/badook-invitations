import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { calendarTitle } from '@/features/invitations/renderer/calendar-event';
import { buildRenderContext, type RenderContext } from '@/features/invitations/renderer/context';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
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

function context(invitation: PublishedInvitation, locale: Locale): RenderContext {
  const env = serverEnv();
  return buildRenderContext(invitation.doc, invitation.entry.manifest, locale, {
    mode: 'live',
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    icsViaRoute: true,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
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
  const title = ctx.text(share.ogTitle) || calendarTitle(ctx);
  const description =
    ctx.text(share.ogDescription) || [ctx.eventDateLong, ctx.hebrewDate].filter(Boolean).join(' · ');
  const url = `${ctx.publicBaseUrl}/i/${slug}?lang=${locale}`;
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
    openGraph: { title, description, url, type: 'website', locale: locale === 'he' ? 'he_IL' : 'en_GB' },
  };
}

/** The public invitation — the same renderer as the kitchen sink and the editor preview (§5). */
export default async function PublicInvitationPage({ params }: { params: Params }) {
  const { slug, lang } = await params;
  const invitation = await getPublishedInvitation(slug);
  const locale = invitation && resolveLocale(invitation.doc, lang);
  if (!invitation || !locale) notFound();
  const next = otherLocale(invitation.doc, locale);
  return (
    <InvitationBody
      ctx={context(invitation, locale)}
      showCover
      skipCoverFromUrl
      // keeps the cover skipped when switching language (P3 swaps texts in place without a reload)
      langSwitchHref={next ? `/i/${slug}?lang=${next}&open=1` : null}
    />
  );
}
