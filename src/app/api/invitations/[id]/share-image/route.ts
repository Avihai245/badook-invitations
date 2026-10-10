import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { hostDb } from '@/features/invitations/server/host-db';
import { invitationOgImage } from '@/features/invitations/server/og-image';
import { resolveLocale } from '@/features/invitations/server/published';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { getSessionUser } from '@/lib/supabase/session';

// satori + resvg on Node — as the public opengraph-image route
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const fail = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

/**
 * `GET /api/invitations/:id/share-image?lang=&v=` — the link-preview image of the saved draft, for its
 * owner (the editor's "link and sharing" panel shows the card guests will get before it is published).
 * The same image as `/i/<slug>/opengraph-image`; `v` only busts the browser's cache.
 */
export async function GET(request: Request, { params }: Params) {
  if (!invitationsEnabled()) return fail(404);
  const user = await getSessionUser();
  if (!user) return fail(401);
  const { id } = await params;
  const inv = await hostDb.get(id, user.id);
  if (!inv) return fail(404);
  const doc = inv.draft;
  const entry = getTemplate(doc.templateId);
  if (!entry) return fail(404);
  const locale = resolveLocale(doc, new URL(request.url).searchParams.get('lang') ?? 'default');
  const env = serverEnv();
  const ctx = buildRenderContext(doc, entry.manifest, locale ?? doc.defaultLocale, {
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
  });
  try {
    return await invitationOgImage(ctx, { 'cache-control': 'private, max-age=600' });
  } catch (err) {
    console.error('[share-image]', id, err);
    return fail(500);
  }
}
