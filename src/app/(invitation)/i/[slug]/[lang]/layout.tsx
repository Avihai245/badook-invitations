import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { InvitationHtml } from '@/features/invitations/renderer/InvitationHtml';
import { getPublishedInvitation, resolveLocale } from '@/features/invitations/server/published';
import '@/features/invitations/ui/invitation.css';
import { assertInvitationsEnabled } from '@/lib/feature';

type Params = Promise<{ slug: string; lang: string }>;

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/**
 * Root layout of the public invitation (`/i/<slug>?lang=` is rewritten to `/i/<slug>/<lang|default>`
 * by the middleware). Tokens, lang and dir are on <html> from the first byte.
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
  if (!invitation || !locale) notFound();
  return (
    <InvitationHtml doc={invitation.doc} template={invitation.entry.manifest} locale={locale}>
      {children}
    </InvitationHtml>
  );
}
