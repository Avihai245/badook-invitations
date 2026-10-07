import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RTL_LOCALES } from '@/features/invitations/contracts/types';
import { slugLocale } from '@/features/live-gallery/server/pages';
import { A11Y_BOOT } from '@/features/site/a11y';
import { assertInvitationsEnabled } from '@/lib/feature';
import '@/styles/app.css';
import '@/features/live-gallery/ui/gallery.css';

type Params = Promise<{ slug: string }>;

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// the links carry their own key: never indexed, never followed
export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };

/**
 * Root layout of the live gallery's guest pages (/e/<slug>/upload, /e/<slug>/projector): the host
 * app's styles, the invitation's language and direction from the first byte. A bilingual page
 * switches in place.
 */
export default async function GalleryLayout({ children, params }: { children: ReactNode; params: Params }) {
  assertInvitationsEnabled();
  const { slug } = await params;
  const locale = await slugLocale(slug);
  return (
    <html lang={locale} dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {/* the accessibility menu's settings from the last visit, before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
