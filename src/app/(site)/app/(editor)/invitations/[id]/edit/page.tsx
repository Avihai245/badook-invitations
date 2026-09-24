import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadAccount } from '@/features/billing/server/account';
import { Editor } from '@/features/invitations/editor/Editor';
import { fontFaceCss, templateFontFamilies } from '@/features/invitations/fonts';
import { hostsLine } from '@/features/invitations/lib/text';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { hostDb } from '@/features/invitations/server/host-db';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { getUi, getUiLocale } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.editor.preview };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return { title: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType] };
}

/** /app/invitations/[id]/edit — the editor (§7.3, §9B.3-D), full screen without the app shell. */
export default async function EditInvitationPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/edit`);
  const inv = await hostDb.get(id, user.id);
  if (!inv) notFound();
  const entry = getTemplate(inv.templateId);
  if (!entry) notFound();
  const env = serverEnv();
  const [uiLocale, account] = await Promise.all([getUiLocale(), loadAccount(user)]);
  const unpublishedChanges =
    inv.status === 'published' && JSON.stringify(inv.draft) !== JSON.stringify(inv.published);
  return (
    <>
      {/* The font pair cards render the hosts' names in every pair of the template. */}
      <style dangerouslySetInnerHTML={{ __html: fontFaceCss(templateFontFamilies(entry.manifest)) }} />
      <Editor
        draft={inv.draft}
        meta={{
          id: inv.id,
          slug: inv.slug,
          status: inv.status,
          version: inv.version,
          publishedAt: inv.publishedAt,
          unpublishedChanges,
        }}
        updatedAt={inv.updatedAt}
        templateId={entry.manifest.id}
        bases={assetBasesFromEnv({
          supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
          templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
        })}
        publicBaseUrl={env.INVITES_PUBLIC_BASE_URL}
        uiLocale={uiLocale}
        features={{
          removeBranding: account.limits.removeBranding,
          premiumTemplates: account.limits.premiumTemplates,
        }}
      />
    </>
  );
}
