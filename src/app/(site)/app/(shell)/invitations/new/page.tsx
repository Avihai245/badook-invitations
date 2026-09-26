import type { Metadata } from 'next';
import { isAdminEmail } from '@/features/billing/server/account';
import { TemplateGallery, type DevPreviews } from '@/features/invitations/app/gallery/TemplateGallery';
import { GALLERY_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { devRoutesEnabled } from '@/lib/dev-routes';
import { serverEnv } from '@/lib/env';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.gallery.title };
}

/**
 * Dev/QA (`?previews=fixture|missing`, dev routes only): every card gets the fixture poster + video of
 * tests/fixtures/media, or a video that 404s (the poster must stay).
 */
function devPreviews(param: string | string[] | undefined): DevPreviews | null {
  if (!devRoutesEnabled()) return null;
  if (param === 'fixture')
    return { image: '/dev/media/cover-poster.png', video: '/dev/media/cover-open.webm' };
  if (param === 'missing') return { image: null, video: '/dev/media/not-produced.webm' };
  return null;
}

/** /app/invitations/new — the template gallery (§9B.3-B) → preview → wizard. */
export default async function NewInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = serverEnv();
  const [{ previews }, user] = await Promise.all([searchParams, getSessionUser()]);
  return (
    <TemplateGallery
      bases={assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      })}
      fontCss={GALLERY_FONT_CSS}
      devPreviews={devPreviews(previews)}
      // unlisted designs (manifest `listed: false`) are the platform admins' to try
      admin={isAdminEmail(user?.email)}
    />
  );
}
