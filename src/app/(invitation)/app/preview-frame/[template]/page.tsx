import { notFound, redirect } from 'next/navigation';
import type { Locale } from '@/features/invitations/contracts/types';
import { PreviewFrame } from '@/features/invitations/editor/preview/PreviewFrame.client';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { cinematicFor } from '@/features/invitations/server/cinematic';
import { hostDb } from '@/features/invitations/server/host-db';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser } from '@/lib/supabase/session';

type Params = Promise<{ template: string }>;
type Search = Promise<{ invitation?: string; version?: string; lang?: string }>;

/**
 * The preview iframe's page — waits for the editor (or the gallery) to post a document.
 * With `?invitation=<id>` (the editor's "open in a new tab") it renders that invitation's saved draft,
 * or a published `&version=<n>`, full-page for its owner.
 */
export default async function PreviewFramePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const entry = getTemplate((await params).template);
  if (!entry) notFound();
  const env = serverEnv();
  const { invitation, version, lang } = await searchParams;
  let standalone = null;
  if (invitation) {
    const user = await getSessionUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(`/app/invitations/${invitation}/edit`)}`);
    const inv = await hostDb.get(invitation, user.id);
    if (!inv || inv.templateId !== entry.manifest.id) notFound();
    const n = Number(version);
    const doc = version ? await hostDb.version(invitation, user.id, n) : inv.draft;
    if (!doc) notFound();
    const locale: Locale = doc.locales.includes(lang as Locale) ? (lang as Locale) : doc.defaultLocale;
    const other = doc.locales.find((l) => l !== locale);
    const query = (l: Locale) =>
      `?${new URLSearchParams({ invitation, ...(version ? { version } : {}), lang: l }).toString()}`;
    standalone = { doc, locale, langHref: other ? query(other) : null, cinematic: await cinematicFor(inv.id) };
  }
  return (
    <PreviewFrame
      template={entry.manifest}
      brand={env.INVITES_BRAND_NAME}
      bases={assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      })}
      publicBaseUrl={await requestBaseUrl()}
      standalone={standalone}
    />
  );
}
