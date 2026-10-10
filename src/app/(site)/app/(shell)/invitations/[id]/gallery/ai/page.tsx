import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { aiHostDeps } from '@/features/ai-photos/server/deps';
import { aiHostView } from '@/features/ai-photos/server/host-api';
import { AiPhotosSetup } from '@/features/ai-photos/ui/AiPhotosSetup';
import { AiPhotosCard } from '@/features/ai-photos/ui/AiPhotosCard';
import { deploymentFeatures } from '@/features/flags/server';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.errorPages.notFound.metaTitle };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.aiPhotos.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/gallery/ai — the AI photos' setup (feature ai_photos), under the gallery tab: the
 * people of honor and their photos, the consent and the settings, and the photos guests made. Without the
 * feature the card says why (the package that has it, or the switch). Not offered by this deployment (no
 * OpenAI key): a 404.
 */
export default async function AiPhotosPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!deploymentFeatures().has('ai_photos')) notFound();
  const user = await requireUser(`/app/invitations/${id}/gallery/ai`);
  const view = await aiHostView(user.id, id, aiHostDeps());
  if (!view) notFound();
  if (!view.feature.on)
    return (
      <div className="mx-auto max-w-[720px] px-4 pt-6 pb-16 sm:px-6">
        <AiPhotosCard initial={view} />
      </div>
    );
  return <AiPhotosSetup initial={view} />;
}
