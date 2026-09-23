import { notFound } from 'next/navigation';
import { isLocale, loadDevDocument } from '@/features/invitations/dev/load-dev-document';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { invitationOgImage } from '@/features/invitations/server/og-image';
import { assertDevRoutes } from '@/lib/dev-routes';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ template: string; lang: string; doc: string }>;

/** Kitchen sink: the OG image of a dev document (QA of the Hebrew rendering without a database). */
export async function GET(_request: Request, { params }: { params: Params }) {
  assertDevRoutes();
  const { template, lang, doc: docKey } = await params;
  const loaded = loadDevDocument(template, docKey);
  if (!loaded || !isLocale(lang)) notFound();
  const env = serverEnv();
  const ctx = buildRenderContext(loaded.doc, loaded.entry.manifest, lang, {
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
  });
  return invitationOgImage(ctx, { 'cache-control': 'no-store' });
}
