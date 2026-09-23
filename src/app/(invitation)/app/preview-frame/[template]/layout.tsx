import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { fontFaceCss, templateFontFamilies } from '@/features/invitations/fonts';
import { getTemplate } from '@/features/invitations/templates/registry';
import '@/features/invitations/ui/invitation.css';
import { assertInvitationsEnabled } from '@/lib/feature';

type Params = Promise<{ template: string }>;

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } };

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/**
 * Root layout of the editor's preview iframe (§9B.3-D): the invitation's own document (so svh, media
 * queries, dir and lang behave like on a phone), with every font pair of the template available —
 * the host can switch pairs. lang/dir/theme are set by the frame once the editor posts the document.
 */
export default async function PreviewFrameLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  assertInvitationsEnabled();
  const entry = getTemplate((await params).template);
  if (!entry) notFound();
  return (
    <html lang="he" dir="rtl" data-template={entry.manifest.id} data-opened="1" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss(templateFontFamilies(entry.manifest)) }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
