import type { Metadata } from 'next';
import { TemplateGallery } from '@/features/invitations/app/gallery/TemplateGallery';
import { fontFaceCss } from '@/features/invitations/fonts';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { getUi } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.gallery.title };
}

/** Display fonts of every pair: the preview dialog renders the names in each of them. */
const DISPLAY_FONT_CSS = fontFaceCss(
  new Set(
    [...TEMPLATES.values()].flatMap(({ manifest }) =>
      manifest.fontPairs.flatMap((p) => [p.display.hebrew, p.display.latin]),
    ),
  ),
);

/** /app/invitations/new — the template gallery (§9B.3-B) → preview → wizard. */
export default function NewInvitationPage() {
  const env = serverEnv();
  return (
    <TemplateGallery
      bases={assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      })}
      fontCss={DISPLAY_FONT_CSS}
    />
  );
}
