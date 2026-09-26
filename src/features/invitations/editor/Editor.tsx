'use client';

import { ReviewProvider } from '@/features/review/ui/host/ReviewProvider';
import type { InvitationDocument, Locale } from '../contracts/types';
import type { AssetBases } from '../renderer/assets';
import { requireTemplate } from '../templates/registry';
import { EditorShell } from './EditorShell';
import { EditorProvider, type EditorFeatures, type InvitationMeta } from './state/EditorProvider';

/** The editor page's client root: the template comes from the (client-side) registry. */
export function Editor({
  draft,
  meta,
  updatedAt,
  templateId,
  bases,
  publicBaseUrl,
  uiLocale,
  features,
}: {
  draft: InvitationDocument;
  meta: InvitationMeta;
  updatedAt: string;
  templateId: string;
  bases: AssetBases;
  publicBaseUrl: string;
  uiLocale: Locale;
  features?: EditorFeatures;
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
      features={features}
    >
      {/* the family's comments on the draft (features/review): the rail, the preview, the drawer */}
      <ReviewProvider>
        <EditorShell initialDoc={draft} initialUpdatedAt={updatedAt} />
      </ReviewProvider>
    </EditorProvider>
  );
}
