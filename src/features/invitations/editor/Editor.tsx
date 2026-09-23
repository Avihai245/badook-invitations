'use client';

import type { InvitationDocument, Locale } from '../contracts/types';
import type { AssetBases } from '../renderer/assets';
import { requireTemplate } from '../templates/registry';
import { EditorShell } from './EditorShell';
import { EditorProvider, type InvitationMeta } from './state/EditorProvider';

/** The editor page's client root: the template comes from the (client-side) registry. */
export function Editor({
  draft,
  meta,
  updatedAt,
  templateId,
  bases,
  publicBaseUrl,
  uiLocale,
}: {
  draft: InvitationDocument;
  meta: InvitationMeta;
  updatedAt: string;
  templateId: string;
  bases: AssetBases;
  publicBaseUrl: string;
  uiLocale: Locale;
}) {
  const { manifest, defaults } = requireTemplate(templateId);
  return (
    <EditorProvider
      initialDoc={draft}
      initialMeta={meta}
      template={manifest}
      defaults={defaults}
      bases={bases}
      publicBaseUrl={publicBaseUrl}
      initialLocale={uiLocale}
    >
      <EditorShell initialDoc={draft} initialUpdatedAt={updatedAt} />
    </EditorProvider>
  );
}
