'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button, Dialog, PhoneFrame, Segmented, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { Locale, Palette } from '../../contracts/types';
import { usePreviewChannel } from '../../editor/preview/usePreviewChannel';
import { demoDocument } from '../../templates/demo';
import { requireTemplate } from '../../templates/registry';

export interface DesignChoice {
  paletteId: string | null;
  fontPairId: string | null;
}

/**
 * Gallery preview (§9B.3-B): the template's demo invitation live in a phone, with its palette presets
 * and font pairs switching the preview instantly; "Use this design" continues to the wizard.
 */
export function PreviewDialog({
  templateId,
  locale,
  onLocaleChange,
  onClose,
  onUse,
}: {
  templateId: string;
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  onClose: () => void;
  onUse: (choice: DesignChoice) => void;
}) {
  const { t, fmt, locale: ui } = useUi();
  const { manifest } = requireTemplate(templateId);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [fontPairId, setFontPairId] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const doc = useMemo(() => {
    const d = demoDocument(templateId, undefined, manifest.supportsLocales, locale);
    const preset = manifest.palettePresets.find((p) => p.id === paletteId);
    const editable = new Set<string>(manifest.tokens.editablePaletteKeys);
    if (preset)
      d.theme.palette = Object.fromEntries(
        Object.entries(preset.palette).filter(([k]) => editable.has(k)),
      ) as Partial<Palette>;
    if (fontPairId) d.theme.fontPairId = fontPairId;
    return d;
  }, [templateId, manifest, locale, paletteId, fontPairId]);
  usePreviewChannel(frame, { doc, locale });

  const name = manifest.name[ui] ?? manifest.name.en ?? manifest.id;
  const sample = { he: 'נועה & איתי', en: 'Noa & Itay' };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={fmt(t.gallery.preview.title, { name })}
      description={manifest.description[ui] ?? manifest.description.en}
      closeLabel={t.common.close}
      className="max-w-[920px]"
      footer={
        <>
          <Button variant="ghost" asChild icon={<ExternalLink className="icon-dir" />}>
            <a href={`/i/demo-${templateId}?lang=${locale}&open=1`} target="_blank" rel="noreferrer">
              {t.gallery.preview.liveDemo}
            </a>
          </Button>
          <Button onClick={() => onUse({ paletteId, fontPairId })}>{t.gallery.preview.use}</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
        <div className="shrink-0">
          <PhoneFrame
            src={`/app/preview-frame/${templateId}`}
            title={fmt(t.gallery.preview.phoneLabel, { name })}
            iframeRef={frame}
            scale={0.6}
          />
        </div>
        <div className="flex w-full min-w-0 flex-col gap-5">
          <div>
            <Segmented<Locale>
              label={t.gallery.previewLanguage}
              value={locale}
              onValueChange={onLocaleChange}
              options={manifest.supportsLocales.map((l) => ({
                value: l,
                label: l === 'he' ? t.common.hebrew : t.common.english,
              }))}
            />
          </div>
          {manifest.palettePresets.length ? (
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">{t.gallery.preview.palettes}</legend>
              <div className="grid grid-cols-2 gap-2">
                {manifest.palettePresets.map((p) => {
                  const palette = { ...manifest.tokens.palette, ...p.palette };
                  const on = (paletteId ?? manifest.palettePresets[0]?.id) === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPaletteId(p.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-card border bg-surface px-3 py-2.5 text-start text-[13px]',
                        on ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
                      )}
                    >
                      <span aria-hidden className="flex gap-1">
                        {[palette.bg, palette.accent, palette.ink].map((c, i) => (
                          <span
                            key={i}
                            className="size-3.5 rounded-full border border-black/10"
                            style={{ background: c }}
                          />
                        ))}
                      </span>
                      <span className="truncate">{p.name[ui] ?? p.name.en}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">{t.gallery.preview.fonts}</legend>
            <div className="grid grid-cols-1 gap-2">
              {manifest.fontPairs.map((pair) => {
                const on = (fontPairId ?? manifest.fontPairs[0]?.id) === pair.id;
                return (
                  <button
                    key={pair.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFontPairId(pair.id)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-card border bg-surface px-3 py-2.5 text-start',
                      on ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span
                        lang="he"
                        dir="rtl"
                        className="truncate text-[22px] leading-tight"
                        style={{ fontFamily: `"${pair.display.hebrew}", serif` }}
                      >
                        {sample.he}
                      </span>
                      <span
                        lang="en"
                        dir="ltr"
                        className="truncate text-[22px] leading-tight"
                        style={{ fontFamily: `"${pair.display.latin}", serif` }}
                      >
                        {sample.en}
                      </span>
                    </span>
                    <span className="shrink-0 text-end text-[11px] leading-snug text-muted" dir="ltr">
                      {pair.display.hebrew}
                      <br />
                      {pair.display.latin}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>
    </Dialog>
  );
}
