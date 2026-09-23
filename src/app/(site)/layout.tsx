import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@/styles/app.css';

export const metadata: Metadata = {
  title: { default: 'Badook — הזמנות דיגיטליות', template: '%s · Badook' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Root layout for the host app (Hebrew UI by default, RTL). The invitation has its own root layout. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
