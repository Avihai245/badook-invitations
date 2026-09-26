import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { dirOf } from '@/features/invitations/contracts/types';
import { InvitationHtml } from '@/features/invitations/renderer/InvitationHtml';
import { getTemplate } from '@/features/invitations/templates/registry';
import { goneLocale, loadReview, reviewLocale } from '@/features/review/server/page';
import '@/features/invitations/ui/invitation.css';
import '@/features/review/ui/review.css';
import { assertInvitationsEnabled } from '@/lib/feature';

type Params = Promise<{ token: string; lang?: string[] }>;

export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// a draft behind a private link: never indexed, followed or kept (X-Robots-Tag too: next.config)
export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

/**
 * Root layout of the draft review page (/review/<token>[/<lang>]): the draft's own document — its
 * tokens, lang and dir on <html> from the first byte, like the public invitation's. A link with
 * nothing to show gets a plain document (the page explains).
 */
export default async function ReviewLayout({ children, params }: { children: ReactNode; params: Params }) {
  assertInvitationsEnabled();
  const { token, lang } = await params;
  const opened = await loadReview(token);
  const entry = opened?.status === 'ok' ? getTemplate(opened.state.templateId) : undefined;
  if (opened?.status !== 'ok' || !entry) {
    const locale = goneLocale(lang);
    return (
      <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
        <body>{children}</body>
      </html>
    );
  }
  return (
    <InvitationHtml
      doc={opened.state.draft}
      template={entry.manifest}
      locale={reviewLocale(opened.state.draft, lang)}
      cinematic={opened.state.cinematic}
    >
      {children}
    </InvitationHtml>
  );
}
