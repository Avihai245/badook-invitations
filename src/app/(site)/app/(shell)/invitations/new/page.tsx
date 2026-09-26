import type { Metadata } from 'next';
import { isAdminEmail } from '@/features/billing/server/account';
import { NO_OVERRIDES, whyOff } from '@/features/flags/features';
import { accountFeatures, deploymentFeatures } from '@/features/flags/server';
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
  // the host's plan in force and this deployment (before signing in: only what this deployment offers)
  const account = user ? await accountFeatures(user).catch(() => null) : null;
  // languages beyond Hebrew and English (feature `languages`)
  const moreLanguages = (account ? account.features : deploymentFeatures()).has('languages');
  // "design it from my photos" (feature `art_direction`)
  const why = account
    ? whyOff('art_direction', {
        plan: account.plan,
        admin: account.admin,
        overrides: NO_OVERRIDES,
        available: deploymentFeatures(),
      })
    : 'unavailable';
  const studio =
    why === null
      ? { access: 'on' as const, cinematic: account!.features.has('cinematic') }
      : why === 'plan'
        ? { access: 'plan' as const, cinematic: false }
        : null;
  return (
    <TemplateGallery
      moreLanguages={moreLanguages}
      bases={assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      })}
      fontCss={GALLERY_FONT_CSS}
      devPreviews={devPreviews(previews)}
      // unlisted designs (manifest `listed: false`) are the platform admins' to try
      admin={isAdminEmail(user?.email)}
      studio={studio}
    />
  );
}
