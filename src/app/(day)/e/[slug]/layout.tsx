import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { slugLanguage } from '@/features/event-day/server/pages';
import { assertInvitationsEnabled } from '@/lib/feature';
import '@/styles/app.css';
import '@/features/event-day/ui/event-day.css';

type Params = Promise<{ slug: string }>;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fafaf9',
};

// the links carry their own key: never indexed, never followed
export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };

/**
 * Root layout of the event day's pages opened without an account (/e/<slug>/table — a guest's table
 * guide; /e/<slug>/station — the entrance station): the host app's styles, the invitation's language
 * and direction from the first byte. A bilingual page switches in place.
 */
export default async function DayLayout({ children, params }: { children: ReactNode; params: Params }) {
  assertInvitationsEnabled();
  const { slug } = await params;
  const locale = await slugLanguage(slug);
  return (
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
