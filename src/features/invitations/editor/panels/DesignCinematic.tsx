'use client';

import { ImagePlus, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn, rovingKeyDown, useToast } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import {
  OPENING_PRESETS,
  THEME_TOKEN_RANGES,
  dirOf,
  type Locale,
  type OpeningPreset,
  type Palette,
} from '../../contracts/types';
import generatedFaces from '../../fonts/font-faces.generated.json';
import { fontFor } from '../../fonts';
import { suggestFontPairs } from '../../lib/font-suggest';
import { extractSwatches, photoPalettes, pixelsOf, type PhotoPalette } from '../../lib/photo-palette';
import { docScale, resolvePalette } from '../../renderer/theme';
import { HelpFor } from '../../app/HelpFor';
import { FieldFrame, PanelCard, RangeField, hostsText, usePreviewControls } from '../fields/fields';
import { invitationPictures } from '../fields/SectionMedia';
import { applyDocPalette, seededHints, setOpening, setThemeTokens } from '../presentation';
import { useEditor } from '../state/EditorProvider';
import { PaletteChoices } from './SectionCinematic';

// ─── the cover's opening ─────────────────────────────────────────────────────────────────────────

/** A little moving picture of an opening (plays on hover, focus and when chosen). */
function OpeningMini({ preset }: { preset: OpeningPreset | 'design' }) {
  return (
    <span aria-hidden="true" className="open-mini" data-opening={preset}>
      <i />
      <i />
      <b />
    </span>
  );
}

/**
 * The opening (v2 `cover.opening`): the design's own, its envelope, a gate, a curtain, fireworks or
 * gold dust. Picking one plays it in the preview; the hint the template seeded (it names its own
 * cover) is cleared so the opening's own call to action shows.
 */
export function OpeningPicker() {
  const { doc, template, defaults, apply } = useEditor();
  const { t } = useUi();
  const { replay } = usePreviewControls();
  const c = t.editor.cine.opening;
  const current = doc.cover.opening ?? null;
  const own: OpeningPreset = template.cover.opening?.preset ?? 'envelope';
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pick = (preset: OpeningPreset | null) => {
    apply((d) => setOpening(d, preset, seededHints(defaults)), null);
    // the preview gets the new document first (debounced), then plays it
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(replay, 450);
  };
  const shown = current ?? own;
  const photo =
    template.cover.opening?.backdrop === 'hero' && (shown === 'fireworks' || shown === 'gold_dust');
  const options: (OpeningPreset | null)[] = [null, ...OPENING_PRESETS];
  return (
    <PanelCard
      title={
        <span className="flex items-center gap-1">
          {c.title}
          <HelpFor area="designCover" className="-my-1 size-6" />
        </span>
      }
      aside={
        <Button variant="secondary" size="sm" icon={<Play />} onClick={replay}>
          {t.editor.canvas.replay}
        </Button>
      }
    >
      <FieldFrame path="cover.opening" label={c.title}>
        <div
          role="radiogroup"
          aria-label={c.title}
          onKeyDown={rovingKeyDown}
          className="grid grid-cols-3 gap-2"
        >
          {options.map((preset) => {
            const on = current === preset;
            const label = preset === null ? `${c.design} · ${c.presets[own]}` : c.presets[preset];
            return (
              <button
                key={preset ?? 'design'}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                data-roving-item=""
                data-opening={preset ?? 'design'}
                title={preset === null ? c.designHint : c.hints[preset]}
                onClick={() => pick(preset)}
                className={cn(
                  'group/mini flex flex-col items-center gap-1 rounded-card border px-1.5 py-2 text-center text-[12px] leading-tight',
                  on ? 'border-ink bg-subtle font-semibold ring-1 ring-ink' : 'border-line hover:bg-subtle',
                )}
                data-on={on ? '' : undefined}
              >
                <OpeningMini preset={preset ?? own} />
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {c.hints[shown]}
          {photo ? ` · ${c.photo}` : ''}
        </p>
        {!doc.cover.hint ? <p className="mt-1 text-[12px] text-muted">{c.hintNote}</p> : null}
      </FieldFrame>
    </PanelCard>
  );
}

// ─── style & motion (theme.tokens) ───────────────────────────────────────────────────────────────

/**
 * The invitation's type scale, spacing density and motion intensity (v2 `theme.tokens`) — each ×
 * the design's own; the preview follows at once.
 */
export function StylePanel() {
  const { doc, apply } = useEditor();
  const { t } = useUi();
  const s = t.editor.cine.style;
  const scale = docScale(doc);
  const R = THEME_TOKEN_RANGES;
  const pct = (v: number) => Math.round(v * 100);
  const ends = (from: string, to: string) => (
    <div className="-mt-2 flex justify-between text-[11.5px] text-muted" aria-hidden="true">
      <span>{from}</span>
      <span>{to}</span>
    </div>
  );
  return (
    <PanelCard
      aside={
        doc.theme.tokens ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            onClick={() => apply((d) => setThemeTokens(d, null), null)}
          >
            {s.reset}
          </Button>
        ) : null
      }
    >
      <RangeField
        path="theme.tokens.typeScale"
        label={s.typeScale}
        value={pct(scale.typeScale)}
        min={pct(R.typeScale.min)}
        max={pct(R.typeScale.max)}
        step={5}
        format={(v) => (v === 100 ? s.asDesigned : `${v}%`)}
        onChange={(v) => apply((d) => setThemeTokens(d, { typeScale: v / 100 }), 'theme.tokens.typeScale')}
      />
      {ends(s.smaller, s.larger)}
      <RangeField
        path="theme.tokens.spacing"
        label={s.spacing}
        value={pct(scale.spacing)}
        min={pct(R.spacing.min)}
        max={pct(R.spacing.max)}
        step={5}
        format={(v) => (v === 100 ? s.asDesigned : `${v}%`)}
        onChange={(v) => apply((d) => setThemeTokens(d, { spacing: v / 100 }), 'theme.tokens.spacing')}
      />
      {ends(s.compact, s.airy)}
      <RangeField
        path="theme.tokens.motion"
        label={s.motion}
        value={pct(scale.motion)}
        min={pct(R.motion.min)}
        max={pct(R.motion.max)}
        step={10}
        format={(v) => (v === 100 ? s.asDesigned : v === 0 ? s.still : `${v}%`)}
        onChange={(v) => apply((d) => setThemeTokens(d, { motion: v / 100 }), 'theme.tokens.motion')}
      />
      {ends(s.still, s.lively)}
      {scale.motion === 0 ? <p className="text-[12px] text-muted">{s.stillNote}</p> : null}
    </PanelCard>
  );
}

// ─── colors from a photo ─────────────────────────────────────────────────────────────────────────

const ALL_KEYS: readonly (keyof Palette)[] = [
  'bg',
  'surface',
  'ink',
  'inkMuted',
  'accent',
  'accentInk',
  'line',
  'heroText',
];

type Reading =
  | { status: 'idle' }
  | { status: 'reading'; url: string }
  | { status: 'failed' }
  | { status: 'ready'; url: string; options: PhotoPalette[] };

/**
 * Colors from a photo (nothing is uploaded): a picture from the device (read from the file) or one the
 * invitation has → three palettes → one tap applies the keys this design lets the host change (one
 * undo step).
 */
export function PhotoPaletteCard() {
  const { doc, template, apply, assetUrl } = useEditor();
  const { t } = useUi();
  const { toast } = useToast();
  const p = t.editor.cine.photoPalette;
  const file = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<Reading>({ status: 'idle' });
  const editable = template.tokens.editablePaletteKeys;
  const effective = resolvePalette(template, doc);
  const pictures = invitationPictures(doc, template, assetUrl)
    .filter((x) => x.kind === 'image')
    .slice(0, 8);
  const objectUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const read = (url: string, cors: boolean) => {
    setReading({ status: 'reading', url });
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const { rgba } = pixelsOf(img);
        const options = photoPalettes(extractSwatches(rgba), { palette: effective, editable });
        // a design that lets only a key or two change can make two options the same: once each
        const unique = options.filter(
          (o, i) => options.findIndex((x) => ALL_KEYS.every((k) => x.palette[k] === o.palette[k])) === i,
        );
        setReading({ status: 'ready', url, options: unique });
      } catch {
        setReading({ status: 'failed' });
      }
    };
    img.onerror = () => setReading({ status: 'failed' });
    img.src = url;
  };

  const locked = editable.length < ALL_KEYS.length;
  return (
    <PanelCard
      title={
        <span className="flex items-center gap-1">
          {p.title}
          <HelpFor area="designPalette" className="-my-1 size-6" />
        </span>
      }
    >
      <p className="text-[12px] text-muted">{p.help}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={<ImagePlus />} onClick={() => file.current?.click()}>
          {p.choose}
        </Button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          data-testid="photo-palette-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
            objectUrl.current = URL.createObjectURL(f);
            read(objectUrl.current, false);
          }}
        />
      </div>
      {pictures.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">{p.fromInvitation}</span>
          <div className="flex flex-wrap gap-2">
            {pictures.map((pic, n) => (
              <button
                key={pic.src}
                type="button"
                aria-label={fmt(p.pick, { n: n + 1 })}
                title={fmt(p.pick, { n: n + 1 })}
                onClick={() => read(pic.thumb, !pic.thumb.startsWith('/'))}
                className={cn(
                  'size-12 overflow-hidden rounded-input border-2 bg-subtle',
                  reading.status !== 'idle' && 'url' in reading && reading.url === pic.thumb
                    ? 'border-ink'
                    : 'border-transparent hover:border-line-strong',
                )}
              >
                <img src={pic.thumb} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {reading.status === 'reading' ? (
        <p className="text-[12px] text-muted" role="status">
          {t.editor.cine.media.reading}
        </p>
      ) : null}
      {reading.status === 'failed' ? (
        <p role="alert" className="text-[12px] text-danger">
          {p.failed}
        </p>
      ) : null}
      {reading.status === 'ready' ? (
        <div className="flex flex-col gap-2" data-testid="photo-palette-options">
          <div className="flex items-start gap-3">
            <img
              src={reading.url}
              alt=""
              className="size-14 shrink-0 rounded-input border border-line object-cover"
            />
            {locked ? (
              <p className="text-[12px] text-muted">
                {fmt(p.locked, { keys: editable.map((k) => t.editor.f.palette.keys[k]).join(', ') })}
              </p>
            ) : null}
          </div>
          <PaletteChoices
            options={reading.options}
            sample={p.sample}
            onApply={(palette) => {
              apply((d) => applyDocPalette(d, palette, editable), null);
              toast({ title: p.applied, variant: 'success' });
            }}
          />
        </div>
      ) : null}
    </PanelCard>
  );
}

// ─── font suggestions ────────────────────────────────────────────────────────────────────────────

const CATEGORIES = (generatedFaces as { families: Record<string, { category?: string }> }).families;
const categoryOf = (family: string) => CATEGORIES[family]?.category ?? null;

/**
 * Three font pairs for this invitation (lib/font-suggest.ts: its event type and colors), each a live
 * specimen — the names in the display face and a line in the text face — in every language of the
 * invitation. A tap uses it (one undo step).
 */
export function FontSuggestions() {
  const { doc, template, update } = useEditor();
  const { t, locale: uiLocale } = useUi();
  const f = t.editor.cine.fontSuggest;
  const palette = resolvePalette(template, doc);
  const suggestions = useMemo(
    () =>
      suggestFontPairs(
        template,
        { eventType: doc.eventType, palette, current: doc.theme.fontPairId },
        { category: categoryOf },
      ),
    // the palette's accent and background decide the mood
    // eslint-disable-next-line react-hooks/exhaustive-deps -- palette is derived from these
    [template, doc.eventType, palette.bg, palette.accent, doc.theme.fontPairId],
  );
  const sample = (l: Locale) => hostsText(doc, l) || (l === 'he' ? 'נועה & איתי' : 'Noa & Itay');
  const line = (l: Locale) => (f.sample as Partial<Record<Locale, string>>)[l] ?? f.sample.en;
  return (
    <PanelCard
      title={
        <span className="flex items-center gap-1">
          {f.title}
          <HelpFor area="designFonts" className="-my-1 size-6" />
        </span>
      }
    >
      <p className="-mt-1 text-[12px] text-muted">{f.help}</p>
      <div className="flex flex-col gap-2" data-testid="font-suggestions">
        {suggestions.map((s) => {
          const name = 'name' in s.pair ? (s.pair.name[uiLocale as Locale] ?? s.pair.name.en) : null;
          const label = f.labels[s.label];
          return (
            <button
              key={s.pair.id}
              type="button"
              data-font-pair={s.pair.id}
              aria-label={fmt(f.apply, {
                name: name ?? `${s.pair.display.latin} / ${s.pair.display.hebrew}`,
              })}
              onClick={() => update('theme.fontPairId', s.pair.id, null)}
              className="flex flex-col gap-1 rounded-card border border-line bg-surface px-3 py-2.5 text-start hover:border-ink"
            >
              <span className="flex items-center justify-between gap-2 text-[11px] text-muted">
                <span className="rounded-full bg-subtle px-2 py-0.5 font-semibold text-ink">{label}</span>
                <span dir="ltr" className="truncate">
                  {name ? `${name} · ` : ''}
                  {s.pair.display.latin}
                </span>
              </span>
              {doc.locales.map((l) => (
                <span key={l} lang={l} dir={dirOf(l)} className="flex flex-col">
                  <span
                    className="truncate text-[24px] leading-tight"
                    style={{ fontFamily: `"${fontFor(s.pair, 'display', l)}", serif` }}
                  >
                    {sample(l)}
                  </span>
                  <span
                    className="truncate text-[13px] text-muted"
                    style={{ fontFamily: `"${fontFor(s.pair, 'body', l)}", serif` }}
                  >
                    {line(l)}
                  </span>
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </PanelCard>
  );
}
