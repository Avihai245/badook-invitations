import type { Metadata } from 'next';
import { assertDevRoutes } from '@/lib/dev-routes';
import { Showcase } from './Showcase';

export const metadata: Metadata = { title: 'App UI' };
// Rendered per request so the INVITES_DEV_ROUTES gate is read at runtime, never baked in at build.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ lang?: string | string[] }> };

/** Dev-only showcase of the host-app primitives (src/components/app). `?lang=en` renders it LTR. */
export default async function AppUiPage({ searchParams }: Props) {
  assertDevRoutes();
  const { lang } = await searchParams;
  return <Showcase locale={lang === 'en' ? 'en' : 'he'} />;
}
