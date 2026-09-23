import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale, loadDevDocument } from '@/features/invitations/dev/load-dev-document';
import { InvitationHtml } from '@/features/invitations/renderer/InvitationHtml';
import '@/features/invitations/ui/invitation.css';
import { assertDevRoutes } from '@/lib/dev-routes';

type Params = Promise<{ template: string; lang: string; doc: string }>;

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invitation — kitchen sink render',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Root layout for one kitchen-sink invitation render (one invitation per document, like /i/[slug]). */
export default async function RenderLayout({ children, params }: { children: ReactNode; params: Params }) {
  assertDevRoutes();
  const { template, lang, doc: docKey } = await params;
  const loaded = loadDevDocument(template, docKey);
  if (!loaded || !isLocale(lang) || !loaded.doc.locales.includes(lang)) notFound();
  return (
    <InvitationHtml doc={loaded.doc} template={loaded.entry.manifest} locale={lang}>
      {children}
    </InvitationHtml>
  );
}
