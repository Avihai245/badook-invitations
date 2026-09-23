import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import { InvitationHtml } from '@/features/invitations/renderer/InvitationHtml';
import { MissingInvitationHtml } from '@/features/invitations/renderer/MissingInvitation';
import { getPublishedInvitation, resolveLocale } from '@/features/invitations/server/published';
import '@/features/invitations/ui/invitation.css';
import { assertInvitationsEnabled } from '@/lib/feature';

type Params = Promise<{ slug: string; lang: string }>;

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/**
 * Root layout of the public invitation (`/i/<slug>?lang=` is rewritten to `/i/<slug>/<lang|default>`
 * by next.config rewrites). Tokens, lang and dir are on <html> from the first byte.
 *
 * An unknown, unpublished or archived slug gets a plain document instead: the page then calls
 * notFound() and the guest sees ./not-found.tsx (404) rather than a bare error page.
 */
export default async function PublicInvitationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  assertInvitationsEnabled();
  const { slug, lang } = await params;
  const invitation = await getPublishedInvitation(slug);
  const locale = invitation && resolveLocale(invitation.doc, lang);
  if (!invitation || !locale)
    return <MissingInvitationHtml locale={lang === 'en' ? 'en' : 'he'}>{children}</MissingInvitationHtml>;
  return (
    <InvitationHtml doc={invitation.doc} template={invitation.entry.manifest} locale={locale}>
      {children}
    </InvitationHtml>
  );
}
