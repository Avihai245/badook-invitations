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
import { StartWizard } from '@/features/invitations/app/onboarding/StartWizard';
import { EVENT_TYPES, type EventType } from '@/features/invitations/contracts/types';

const isEventType = (v: string): v is EventType => (EVENT_TYPES as readonly string[]).includes(v);

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

/** /app/invitations/new — the start wizard → the template gallery (§9B.3-B) → preview → wizard. */
export default async function NewInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = serverEnv();
  const [{ previews, template, type, gallery }, user] = await Promise.all([searchParams, getSessionUser()]);
  // "New event" starts with three questions (the start wizard); the gallery is the next screen, or
  // straight away for a link to a design (?template=), a type (?type=) or "skip" (?gallery=1)
  if (!template && !type && !gallery && !previews) return <StartWizard />;
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
  const initialTemplateId = typeof template === 'string' ? template : null;
  return (
    <TemplateGallery
      // a fresh mount whenever ?template= changes (e.g. a new link from the support chat while already
      // on this page): a client re-render alone wouldn't reopen the preview dialog, since preview is
      // only ever set from this prop once, on mount
      key={initialTemplateId ?? 'gallery'}
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
      initialTemplateId={initialTemplateId}
      initialType={typeof type === 'string' && isEventType(type) ? type : null}
    />
  );
}
