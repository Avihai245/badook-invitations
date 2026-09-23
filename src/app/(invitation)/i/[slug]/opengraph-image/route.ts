import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { invitationOgImage } from '@/features/invitations/server/og-image';
import { getPublishedInvitation, resolveLocale } from '@/features/invitations/server/published';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';

// satori + resvg on Node — no Edge anywhere (§1.1 rule 4)
export const runtime = 'nodejs';

type Params = Promise<{ slug: string }>;

const notFound = () => new Response('Not found', { status: 404 });

/**
 * `GET /i/<slug>/opengraph-image?lang=&v=` — the 1200×630 link-preview image of a published
 * invitation (§4). `v` (the document hash, see ogVersion) only busts caches; the page's metadata
 * links the current one.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  if (!invitationsEnabled()) return notFound();
  const { slug } = await params;
  const invitation = await getPublishedInvitation(slug);
  if (!invitation) return notFound();
  const locale = resolveLocale(invitation.doc, new URL(request.url).searchParams.get('lang') ?? 'default');
  const env = serverEnv();
  const ctx = buildRenderContext(
    invitation.doc,
    invitation.entry.manifest,
    locale ?? invitation.doc.defaultLocale,
    {
      brand: env.INVITES_BRAND_NAME,
      publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
      bases: assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      }),
    },
  );
  return invitationOgImage(ctx, {
    'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    // a hidden invitation's names and date stay out of image search too
    ...(invitation.doc.share.noindex ? { 'x-robots-tag': 'noindex' } : {}),
  });
}
