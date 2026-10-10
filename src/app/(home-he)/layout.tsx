import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { homeBoot } from '@/features/site/home/home-boot';
import { SiteRoot } from '@/features/site/SiteRoot';

export const metadata: Metadata = {
  title: { default: 'Badook — הזמנות דיגיטליות', template: '%s · Badook' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** The home page in Hebrew — static, so the language is fixed here instead of read from a cookie. */
export default function HomeHeLayout({ children }: { children: ReactNode }) {
  return (
    <SiteRoot locale="he" boot={homeBoot('he')}>
      {children}
    </SiteRoot>
  );
}
