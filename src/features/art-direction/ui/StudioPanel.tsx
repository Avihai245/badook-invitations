'use client';

import { Crown, ExternalLink, RotateCcw, Undo2, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Dialog, Hint, useToast } from '@/components/app';
import { HelpFor } from '@/features/invitations/app/HelpFor';
import { hostApi } from '@/features/invitations/app/api';
import { uploadFile } from '@/features/invitations/editor/fields/media';
import { useFlush } from '@/features/invitations/editor/state/flush';
import { useEditor } from '@/features/invitations/editor/state/EditorProvider';
import { packageFor } from '@/features/flags/features';
import { resolveFontPair } from '@/features/invitations/renderer/theme';
import { getTemplate } from '@/features/invitations/templates/registry';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { conceptDocument } from '../apply';
import { invitationPhotos } from '../client/photos';
import { ART_DIRECTION } from '../config';
import type { Concept } from '../model';
import { ConceptsView } from './ConceptsView';
import { PhotoPicker } from './PhotoPicker';
import { usedPhotos, useStudio, type Studio } from './useStudio';

/**
 * "Design it for me" in the editor's design tab (feature `art_direction`): 3–5 photos (the
 * invitation's own or new ones) and a mood → three concepts, live side by side → one is applied as a
 * single undo step, after the draft as it was is kept in the history.
 */
export function StudioPanel() {
  const { doc, meta, features, template, locale, assetUrl, apply } = useEditor();
  const flush = useFlush();
  const { t, locale: ui } = useUi();
  const { toast } = useToast();
  const a = t.studio.art;
  const cinematic = features.cinematic !== false;
  const current = useMemo(
    () => ({ templateId: doc.templateId, fontPairId: resolveFontPair(template, doc).id }),
    [doc, template],
  );
  const studio = useStudio({
    invitationId: meta.id,
    eventType: doc.eventType,
    locales: doc.locales,
    uiLocale: ui,
    current,
  });
  const own = useMemo(
    () =>
      invitationPhotos(doc).flatMap((ref) => {
        const url = assetUrl(ref);
        return url ? [{ ref, url }] : [];
      }),
    [doc, assetUrl],
  );
  const [open, setOpen] = useState(false);
  const [using, setUsing] = useState<string | null>(null);

  if (features.artDirection === 'plan') return <Upsell />;

  const docFor = (concept: Concept) => {
    const from = getTemplate(doc.templateId);
    const to = getTemplate(concept.templateId);
    return from && to ? conceptDocument(doc, from, to, concept, studio.conceptPhotos(), cinematic) : null;
  };

  const use = async (concept: Concept) => {
    setUsing(concept.id);
    try {
      // the draft as it is now is kept in the history first (the server copies what it has)
      await flush();
      await hostApi(`/api/invitations/${meta.id}/snapshot`, { method: 'POST', body: { reason: 'concept' } });
      // the device photos this concept shows go up (at most ART_DIRECTION.uploadLongSide)
      const used = usedPhotos(concept, cinematic);
      const refs = await Promise.all(
        studio.photos.map(async (p, i) =>
          p.origin.kind === 'ref'
            ? p.origin.ref
            : used.has(i) && p.upload
              ? (await uploadFile(meta.id, p.upload)).ref
              : null,
        ),
      );
      const photos = studio.conceptPhotos(refs);
      const to = getTemplate(concept.templateId);
      if (!to) throw new Error('template');
      // one undo step: the whole design at once
      apply((d) => {
        const from = getTemplate(d.templateId);
        return from ? conceptDocument(d, from, to, concept, photos, cinematic) : d;
      }, null);
      setOpen(false);
      toast({ title: a.applied, variant: 'success' });
    } catch {
      toast({ title: t.editor.upload.failed, variant: 'danger' });
    } finally {
      setUsing(null);
    }
  };

  const enough = studio.photos.length >= ART_DIRECTION.minPhotos;
  return (
    <div className="mt-4 flex flex-col gap-4" data-testid="studio-panel">
      <p className="text-[13px] leading-relaxed text-muted">{a.intro}</p>
      <PhotoPicker studio={studio} own={own} />
      <StudioErrors studio={studio} />
      <div className="flex flex-wrap items-center gap-3">
        <Hint text={a.createHint}>
          <Button
            icon={<WandSparkles />}
            loading={studio.busy}
            disabled={!enough || studio.reading > 0}
            onClick={async () => {
              if (await studio.ask()) setOpen(true);
            }}
            data-testid="studio-create"
          >
            {studio.busy ? a.creating : a.create}
          </Button>
        </Hint>
        {!enough ? <span className="text-[12.5px] text-muted">{a.needPhotos}</span> : null}
        {studio.result && !open ? (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            {a.conceptsTitle}
          </Button>
        ) : null}
      </div>
      {studio.busy ? (
        <p role="status" className="text-[12.5px] text-muted">
          {a.creatingHint}
        </p>
      ) : null}
      {open && studio.result ? (
        <Dialog
          open
          onOpenChange={(o) => !o && !using && setOpen(false)}
          title={a.conceptsTitle}
          description={a.conceptsIntro}
          closeLabel={using ? undefined : a.close}
          help={<HelpFor area="studio" inDialog />}
          className="max-w-[1200px]!"
          footer={
            <>
              <Button
                variant="ghost"
                icon={<Undo2 className="icon-dir" />}
                onClick={() => setOpen(false)}
                disabled={!!using}
              >
                {a.back}
              </Button>
              <Hint text={a.againHint}>
                <Button
                  variant="secondary"
                  icon={<RotateCcw />}
                  loading={studio.busy}
                  disabled={!!using}
                  onClick={() => void studio.ask(true)}
                  data-testid="studio-again"
                >
                  {a.again}
                </Button>
              </Hint>
            </>
          }
        >
          <StudioErrors studio={studio} />
          <ConceptsView
            result={studio.result}
            docFor={docFor}
            locale={locale}
            cinematic={cinematic}
            photosIn={(c) => [...usedPhotos(c, cinematic)].filter((i) => i < studio.photos.length).length}
            using={using}
            onUse={(c) => void use(c)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

export function StudioErrors({ studio }: { studio: Studio }) {
  const { t } = useUi();
  const a = t.studio.art;
  if (!studio.error) return null;
  const text =
    studio.error === 'unreadable'
      ? a.unreadable
      : studio.error === 'tooMany'
        ? a.tooMany
        : studio.error === 'rate'
          ? a.rate
          : a.failed;
  return (
    <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-[13px] text-danger">
      {text}
    </p>
  );
}

function Upsell() {
  const { t } = useUi();
  const a = t.studio.art;
  return (
    <div className="mt-4 rounded-card border border-brand-line bg-surface p-4" data-testid="studio-upsell">
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-[#2b2118] text-[#f3d98b]">
          <Crown className="size-3.5" />
        </span>
        {fmt(a.offTitle, { package: t.seating.packages[packageFor('art_direction')] })}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{a.offBody}</p>
      <Button size="sm" className="mt-3" icon={<ExternalLink className="icon-dir" />} asChild>
        <a href="/app/billing" target="_blank" rel="noreferrer">
          {a.offCta}
          <span className="sr-only"> {t.editor.premium.newTab}</span>
        </a>
      </Button>
    </div>
  );
}
