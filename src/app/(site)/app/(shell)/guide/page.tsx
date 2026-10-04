import type { Metadata } from 'next';
import { GuidePage } from '@/features/guide/GuidePage';
import { getUi } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.helpCenter.pageTitle };
}

/** /app/guide — the written guide: every capability, by the event's stages, with search and the FAQ. */
export default function Page() {
  return <GuidePage />;
}
