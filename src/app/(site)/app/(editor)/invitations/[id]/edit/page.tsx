import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadAccount } from '@/features/billing/server/account';
import { Editor } from '@/features/invitations/editor/Editor';
import { fontFaceCss, libraryDisplayFamilies, templateFontFamilies } from '@/features/invitations/fonts';
import { hostsLine } from '@/features/invitations/lib/text';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { hostDb } from '@/features/invitations/server/host-db';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { getUi, getUiLocale } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.errorPages.notFound.metaTitle };
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
  const [uiLocale, account, publicBaseUrl] = await Promise.all([
    getUiLocale(),
    loadAccount(user),
    // the address the host sees and copies (the site's own domain, not a placeholder)
    requestBaseUrl(),
  ]);
  const unpublishedChanges =
    inv.status === 'published' && JSON.stringify(inv.draft) !== JSON.stringify(inv.published);
  return (
    <>
      {/* The font pair cards render the hosts' names in every pair of the template, and each font
          library pair's name in its display faces. */}
      <style
        dangerouslySetInnerHTML={{
          __html: [
            fontFaceCss(templateFontFamilies(entry.manifest)),
            fontFaceCss(libraryDisplayFamilies(), [400]),
          ].join('\n'),
        }}
      />
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
        publicBaseUrl={publicBaseUrl}
        uiLocale={uiLocale}
        features={{
          removeBranding: account.limits.removeBranding,
          premiumTemplates: account.limits.premiumTemplates,
        }}
      />
    </>
  );
}
