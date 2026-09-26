import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { slugLocale } from '@/features/live-gallery/server/pages';
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
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
