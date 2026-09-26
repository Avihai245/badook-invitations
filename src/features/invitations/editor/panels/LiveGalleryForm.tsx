'use client';

import { Images } from 'lucide-react';
import { useUi } from '@/lib/i18n/client';
import { CAPS } from '../../contracts/validate';
import { BoolField, L10nField, PanelCard } from '../fields/fields';
import { useEditor } from '../state/EditorProvider';

/**
 * The live gallery's section on the invitation (feature `live_gallery`): its texts before and during
 * the event (the invitation to share photos) and after it (the album), and the QR code beside the
 * button. The button's words are the guests' page's own; the link is the gallery's — so the form says
 * when the gallery isn't on yet, and where to turn it on.
 */
export function LiveGalleryForm({ base }: { base: string }) {
  const { features, meta } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const L = e.liveGallery;
  const labels = e.fieldLabels;
  return (
    <>
      {features.galleryOn === false ? (
        <div
          className="flex items-start gap-3 rounded-input border border-brand-line bg-brand-soft px-3 py-2.5 text-[13px]"
          data-testid="live-gallery-off"
        >
          <Images aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-deep" />
          <p>
            {L.off}{' '}
            <a
              href={`/app/invitations/${meta.id}/gallery`}
              target="_blank"
              rel="noopener"
              className="font-semibold text-brand-deep underline"
            >
              {L.openTab}
            </a>
          </p>
        </div>
      ) : null}
      <PanelCard title={L.before}>
        <p className="text-[12px] text-muted">{L.beforeHelp}</p>
        <L10nField path={`${base}.title`} label={e.f.title} cap={CAPS.title} nullable />
        <L10nField
          path={`${base}.body`}
          label={labels['liveGallery.body']}
          cap={CAPS.note}
          multiline
          rows={3}
          nullable
        />
      </PanelCard>
      <PanelCard title={L.after}>
        <p className="text-[12px] text-muted">{L.afterHelp}</p>
        <L10nField
          path={`${base}.afterTitle`}
          label={labels['liveGallery.afterTitle']}
          cap={CAPS.title}
          nullable
        />
        <L10nField
          path={`${base}.afterBody`}
          label={labels['liveGallery.afterBody']}
          cap={CAPS.note}
          multiline
          rows={3}
          nullable
        />
      </PanelCard>
      <PanelCard title={L.display}>
        <BoolField path={`${base}.showQr`} label={L.showQr} help={L.showQrHelp} />
      </PanelCard>
    </>
  );
}
