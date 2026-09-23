import { notFound } from 'next/navigation';
import { PreviewFrame } from '@/features/invitations/editor/preview/PreviewFrame.client';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';

type Params = Promise<{ template: string }>;

/** The preview iframe's page — waits for the editor (or the gallery) to post a document. */
export default async function PreviewFramePage({ params }: { params: Params }) {
  const entry = getTemplate((await params).template);
  if (!entry) notFound();
  const env = serverEnv();
  return (
    <PreviewFrame
      template={entry.manifest}
      brand={env.INVITES_BRAND_NAME}
      bases={assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      })}
      publicBaseUrl={env.INVITES_PUBLIC_BASE_URL}
    />
  );
}
