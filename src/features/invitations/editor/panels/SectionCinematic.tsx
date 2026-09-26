'use client';

import { Play, RotateCcw, Wand2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, Button, ColorSwatch, Field, Input, Segmented, cn, rovingKeyDown } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { HEX_COLOR_RE } from '../../contracts/schemas';
import {
  DEFAULT_SECTION_ANIMATION,
  type MotionEasing,
  type Palette,
  type ScrollEffect,
  type Section,
  type SectionLayout,
  type TextReveal,
} from '../../contracts/types';
import { contrastRatio, mixHex, relativeLuminance } from '../../lib/contrast';
import {
  AA_TEXT,
  extractSwatches,
  photoPalettes,
  pixelsOf,
  repairPalette,
  scrimForPhoto,
  type PhotoPalette,
} from '../../lib/photo-palette';
import { resolvePalette, scrimOf } from '../../renderer/theme';
import { HelpFor } from '../../app/HelpFor';
import { FieldFrame, L10nField, PanelCard, RangeField, usePreviewControls } from '../fields/fields';
import { SectionMediaField } from '../fields/SectionMedia';
import {
  ENTER_CHOICES,
  LAYOUTS_BY_TYPE,
  applySectionPalette,
  layoutOf,
  layoutState,
  motionMs,
  patchSectionMedia,
  setSectionAnimation,
  setSectionColors,
  setSectionLayout,
  setSectionTokens,
  takesMedia,
  type AnimationPatch,
} from '../presentation';
import { useEditor } from '../state/EditorProvider';

/**
 * The cinematic cards of a section (feature `cinematic`): its picture or video, its layout, its
 * motion and its colors — the hero: the motion of its background and its text color only (its
 * picture is its own form's). The form shows them after the section's content.
 */
export function SectionCinematic({ section, index }: { section: Section; index: number }) {
  if (section.type === 'hero')
    return (
      <>
        <MotionCard section={section} index={index} />
        <HeroColorsCard section={section} index={index} />
      </>
    );
  const media = takesMedia(section.type);
  return (
    <>
      {media ? (
        <PanelCard title={<CardTitleWithHelp area="sectionMedia" title="media" />}>
          <SectionMediaField index={index} />
          <MediaExtras section={section} index={index} />
        </PanelCard>
      ) : null}
      {media ? <LayoutCard section={section} index={index} /> : null}
      <MotionCard section={section} index={index} />
      <ColorsCard section={section} index={index} />
    </>
  );
}

function CardTitleWithHelp({
  area,
  title,
}: {
  area: 'sectionMedia' | 'sectionLayout' | 'sectionMotion' | 'sectionColors';
  title: 'media' | 'layout' | 'motion' | 'colors' | 'heroMotion' | 'heroColors';
}) {
  const { t } = useUi();
  return (
    <span className="flex items-center gap-1">
      {t.editor.cine.cards[title]}
      <HelpFor area={area} className="-my-1 size-6" />
    </span>
  );
}

// ─── media: overlay + description ────────────────────────────────────────────────────────────────

const ON_MEDIA: readonly SectionLayout[] = ['full_bleed', 'parallax', 'video_bg'];

/** The scrim slider (text on the picture) and the description (a framed picture). */
function MediaExtras({ section, index }: { section: Section; index: number }) {
  const { template, apply } = useEditor();
  const { t } = useUi();
  const c = t.editor.cine.media;
  const media = section.type === 'hero' ? null : section.media;
  if (!media) return null;
  const layout = layoutOf(section);
  const path = `sections.${index}.media`;
  const auto = scrimOf(template).opacity;
  const value = media.overlay ?? null;
  return (
    <>
      {ON_MEDIA.includes(layout) ? (
        <div className="flex flex-col gap-1.5">
          <RangeField
            path={`${path}.overlay`}
            label={c.overlay}
            value={Math.round((value ?? auto) * 100)}
            min={0}
            max={85}
            format={(v) => (value === null ? fmt(c.overlayAuto, { percent: `${v}%` }) : `${v}%`)}
            onChange={(v) =>
              apply((d) => patchSectionMedia(d, index, { overlay: v / 100 }), `${path}.overlay`)
            }
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-muted">{c.overlayHelp}</p>
            {value !== null ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => apply((d) => patchSectionMedia(d, index, { overlay: null }), null)}
              >
                {c.overlayAutoButton}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <L10nField path={`${path}.alt`} label={c.alt} help={c.altHelp} nullable />
      )}
    </>
  );
}

// ─── layout ──────────────────────────────────────────────────────────────────────────────────────

/** A layout's little drawing: the picture (filled) and the text (lines), as on a wide screen. */
function LayoutDrawing({ layout }: { layout: SectionLayout }) {
  const lines = (x: number, w: number, light = false) => (
    <g
      stroke={light ? '#fff' : 'currentColor'}
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity={light ? 1 : 0.7}
    >
      <path d={`M${x} 13h${w}`} />
      <path d={`M${x + w * 0.12} 19h${w * 0.76}`} />
      <path d={`M${x + w * 0.2} 25h${w * 0.6}`} />
    </g>
  );
  const photo = <rect x="2" y="2" width="44" height="32" rx="3" fill="currentColor" opacity=".38" />;
  switch (layout) {
    case 'stack':
      return (
        <>
          <rect x="15" y="4" width="18" height="11" rx="2" fill="currentColor" opacity=".38" />
          <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".7">
            <path d="M14 21h20" />
            <path d="M17 27h14" />
          </g>
        </>
      );
    case 'full_bleed':
      return (
        <>
          {photo}
          {lines(12, 24, true)}
        </>
      );
    case 'split_start':
    case 'split_end': {
      const start = layout === 'split_start';
      return (
        <>
          <rect x={start ? 2 : 25} y="2" width="21" height="32" rx="3" fill="currentColor" opacity=".38" />
          {lines(start ? 27 : 4, 17)}
        </>
      );
    }
    case 'parallax':
      return (
        <>
          {photo}
          {lines(12, 24, true)}
          <path d="M41 9l2-3 2 3M41 27l2 3 2-3M43 7v22" stroke="#fff" strokeWidth="1.4" fill="none" />
        </>
      );
    case 'video_bg':
      return (
        <>
          {photo}
          <path d="M20 11l10 7-10 7z" fill="#fff" />
        </>
      );
  }
}

function LayoutCard({ section, index }: { section: Section; index: number }) {
  const { apply } = useEditor();
  const { t } = useUi();
  const c = t.editor.cine;
  const current = layoutOf(section);
  const options = LAYOUTS_BY_TYPE[section.type];
  return (
    <PanelCard title={<CardTitleWithHelp area="sectionLayout" title="layout" />}>
      <FieldFrame path={`sections.${index}.layout`} label={c.cards.layout}>
        <div
          role="radiogroup"
          aria-label={c.cards.layout}
          onKeyDown={rovingKeyDown}
          className="grid grid-cols-3 gap-2"
        >
          {options.map((layout) => {
            const state = layoutState(section, layout);
            const on = current === layout;
            const disabled = state !== 'ok';
            const why =
              state === 'needs_video' ? c.needsVideo : state === 'needs_media' ? c.needsMedia : null;
            return (
              <button
                key={layout}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={disabled || undefined}
                tabIndex={on ? 0 : -1}
                data-roving-item=""
                data-layout={layout}
                title={why ?? c.layoutHints[layout]}
                onClick={() => !disabled && apply((d) => setSectionLayout(d, index, layout), null)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-card border bg-surface px-1.5 py-2 text-center text-[12px] leading-tight',
                  on ? 'border-ink font-semibold ring-1 ring-ink' : 'border-line hover:bg-subtle',
                  disabled && 'cursor-not-allowed opacity-45 hover:bg-surface',
                )}
              >
                <svg
                  viewBox="0 0 48 36"
                  width="48"
                  height="36"
                  aria-hidden="true"
                  // "start" is the reading side: the drawing mirrors in Hebrew
                  className={cn(
                    'text-ink',
                    (layout === 'split_start' || layout === 'split_end') && 'icon-dir',
                  )}
                >
                  <rect
                    x="1"
                    y="1"
                    width="46"
                    height="34"
                    rx="4"
                    fill="none"
                    stroke="currentColor"
                    opacity=".25"
                  />
                  <LayoutDrawing layout={layout} />
                </svg>
                <span>{c.layouts[layout]}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {!section.media && section.type !== 'hero' ? c.needsMedia : c.layoutHints[current]}
        </p>
      </FieldFrame>
    </PanelCard>
  );
}

// ─── motion ──────────────────────────────────────────────────────────────────────────────────────

/** A preset's little live preview: a card that comes in its way (on hover, focus and when chosen). */
function PresetPreview({ preset }: { preset: string }) {
  return (
    <span aria-hidden="true" className="cine-mini" data-preset={preset}>
      <span className="cine-mini-card" />
    </span>
  );
}

function MotionCard({ section, index }: { section: Section; index: number }) {
  const { apply } = useEditor();
  const { t } = useUi();
  const { play } = usePreviewControls();
  const c = t.editor.cine.motion;
  const hero = section.type === 'hero';
  const a = section.animation ?? DEFAULT_SECTION_ANIMATION;
  const path = `sections.${index}.animation`;
  const change = (patch: AnimationPatch, key: string | null = null) =>
    apply((d) => setSectionAnimation(d, index, patch), key);
  const media = !hero && !!section.media;
  const layout = layoutOf(section);
  const fine = useId();
  const moving = a.enter.preset !== 'auto' && a.enter.preset !== 'none';
  // the hero's scroll effect: its drift (parallax) unless its motion says otherwise
  const heroScroll: ScrollEffect = section.animation ? a.scroll : 'parallax';
  return (
    <PanelCard
      title={<CardTitleWithHelp area="sectionMotion" title={hero ? 'heroMotion' : 'motion'} />}
      aside={
        play ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Play />}
            aria-label={c.playLabel}
            title={c.playLabel}
            onClick={() => play(`sections.${index}`, motionMs(section))}
          >
            {c.play}
          </Button>
        ) : null
      }
    >
      <FieldFrame path={path} label={t.editor.cine.cards.motion}>
        <div className="flex flex-col gap-3.5">
          {hero ? (
            <Field label={c.scroll}>
              <Segmented<ScrollEffect>
                fullWidth
                value={heroScroll}
                onValueChange={(v) => change({ scroll: v })}
                options={(['parallax', 'ken_burns', 'none'] as const).map((v) => ({
                  value: v,
                  label: c.heroScrolls[v],
                }))}
              />
            </Field>
          ) : (
            <>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold">{c.entrance}</legend>
                <div
                  role="radiogroup"
                  aria-label={c.entrance}
                  onKeyDown={rovingKeyDown}
                  className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5"
                >
                  {ENTER_CHOICES.map((preset) => {
                    const on = a.enter.preset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        tabIndex={on ? 0 : -1}
                        data-roving-item=""
                        data-preset={preset}
                        onClick={() => change({ enter: { preset } })}
                        className={cn(
                          'group/mini flex flex-col items-center gap-1 rounded-btn border px-1 py-1.5 text-[11.5px] leading-tight',
                          on ? 'border-ink bg-subtle font-semibold' : 'border-line hover:bg-subtle',
                        )}
                        data-on={on ? '' : undefined}
                      >
                        <PresetPreview preset={preset} />
                        {c.presets[preset]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Field label={c.scroll} help={media ? undefined : c.scrollNeedsMedia}>
                <Segmented<ScrollEffect>
                  fullWidth
                  value={layout === 'parallax' ? 'parallax' : a.scroll}
                  onValueChange={(v) => change({ scroll: v })}
                  disabled={!media || layout === 'parallax'}
                  options={(['none', 'parallax', 'ken_burns'] as const).map((v) => ({
                    value: v,
                    label: c.scrolls[v],
                  }))}
                />
              </Field>
              <Field label={c.text}>
                <Segmented<TextReveal>
                  fullWidth
                  value={a.text}
                  onValueChange={(v) => change({ text: v })}
                  options={(['none', 'letters', 'words', 'lines'] as const).map((v) => ({
                    value: v,
                    label: c.texts[v],
                  }))}
                />
              </Field>
            </>
          )}
          <RangeField
            path={`${path}.intensity`}
            label={c.intensity}
            value={Math.round(a.intensity * 100)}
            min={0}
            max={200}
            step={10}
            format={(v) => `${v}%`}
            onChange={(v) => change({ intensity: v / 100 }, `${path}.intensity`)}
          />
          {!hero && moving ? (
            <details className="group rounded-input border border-line px-3 py-2">
              <summary
                id={fine}
                className="cursor-pointer list-none text-[13px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden"
              >
                {c.fineTune}
              </summary>
              <div className="mt-3 flex flex-col gap-3" aria-labelledby={fine}>
                <RangeField
                  label={c.duration}
                  value={a.enter.duration}
                  min={300}
                  max={2400}
                  step={50}
                  format={(v) => fmt(c.ms, { n: v })}
                  onChange={(v) => change({ enter: { duration: v } }, `${path}.enter.duration`)}
                />
                <RangeField
                  label={c.delay}
                  value={a.enter.delay}
                  min={0}
                  max={1500}
                  step={50}
                  format={(v) => fmt(c.ms, { n: v })}
                  onChange={(v) => change({ enter: { delay: v } }, `${path}.enter.delay`)}
                />
                <RangeField
                  label={c.distance}
                  value={a.enter.distance}
                  min={0}
                  max={160}
                  step={4}
                  format={(v) => fmt(c.px, { n: v })}
                  onChange={(v) => change({ enter: { distance: v } }, `${path}.enter.distance`)}
                />
                <RangeField
                  label={c.stagger}
                  value={a.stagger}
                  min={0}
                  max={400}
                  step={10}
                  format={(v) => fmt(c.ms, { n: v })}
                  onChange={(v) => change({ stagger: v }, `${path}.stagger`)}
                />
                <Field label={c.easing}>
                  <Segmented<MotionEasing>
                    fullWidth
                    value={a.enter.easing}
                    onValueChange={(v) => change({ enter: { easing: v } })}
                    options={(['smooth', 'spring', 'gentle', 'linear'] as const).map((v) => ({
                      value: v,
                      label: c.easings[v],
                    }))}
                  />
                </Field>
              </div>
            </details>
          ) : null}
          {section.animation ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              className="self-start"
              onClick={() => apply((d) => setSectionAnimation(d, index, null), null)}
            >
              {c.reset}
            </Button>
          ) : null}
        </div>
      </FieldFrame>
    </PanelCard>
  );
}

// ─── colors ──────────────────────────────────────────────────────────────────────────────────────

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
const EDIT_ALL = new Set(ALL_KEYS);

type Band = 'own' | 'dark' | 'soft' | 'accent';

/** The ready bands, from the invitation's own colors, each readable (repaired to AA). */
function bandsOf(p: Palette): Record<Exclude<Band, 'own'>, Palette> {
  const darkBg =
    relativeLuminance(p.bg) < 0.2
      ? mixHex(p.bg, '#000000', 0.45)
      : relativeLuminance(p.ink) < 0.03
        ? p.ink
        : mixHex(p.ink, '#000000', 0.35);
  const lightInk = relativeLuminance(p.bg) > 0.6 ? p.bg : '#FAF7F2';
  const dark = repairPalette(
    {
      ...p,
      bg: darkBg,
      surface: mixHex(darkBg, lightInk, 0.08),
      ink: lightInk,
      inkMuted: mixHex(lightInk, darkBg, 0.28),
      accent: relativeLuminance(p.accent) < 0.25 ? mixHex(p.accent, '#FFFFFF', 0.45) : p.accent,
      accentInk: darkBg,
      line: mixHex(lightInk, darkBg, 0.72),
    },
    EDIT_ALL,
  );
  const softBg = relativeLuminance(p.bg) < 0.2 ? mixHex(p.bg, p.accent, 0.14) : mixHex(p.bg, p.accent, 0.09);
  const soft = repairPalette({ ...p, bg: softBg, surface: mixHex(softBg, p.bg, 0.5) }, EDIT_ALL);
  const accent = repairPalette(
    {
      ...p,
      bg: p.accent,
      surface: mixHex(p.accent, p.accentInk, 0.1),
      ink: p.accentInk,
      inkMuted: mixHex(p.accentInk, p.accent, 0.22),
      accent: p.accentInk,
      accentInk: p.accent,
      line: mixHex(p.accentInk, p.accent, 0.6),
    },
    EDIT_ALL,
  );
  return { dark, soft, accent };
}

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * A section palette as the change to store: the colors that differ from the invitation's, and null
 * for the others (a color the section had of its own and no longer needs goes).
 */
function paletteDiff(base: Palette, target: Palette): Partial<Record<keyof Palette, string | null>> {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, same(base[k], target[k]) ? null : target[k]]));
}

/** One color of the section: the invitation's colors as swatches, or any other. */
function ColorPick({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: string[];
  onChange: (hex: string) => void;
}) {
  const { t } = useUi();
  const c = t.editor.cine.colors;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {choices.map((hex) => (
          <ColorSwatch
            key={hex}
            color={hex}
            size={26}
            label={`${label} ${hex}`}
            selected={same(hex, value)}
            onClick={() => onChange(hex)}
          />
        ))}
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} — ${c.custom}`}
          className="size-7 cursor-pointer rounded-full border border-line bg-surface p-0.5"
        />
        <Input
          aria-label={`${label} — ${t.editor.f.palette.hex}`}
          value={draft}
          dir="ltr"
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setDraft(v);
            if (HEX_COLOR_RE.test(v)) onChange(v.toUpperCase());
          }}
          onBlur={() => setDraft(value)}
          className="h-8! w-[88px]! font-mono text-[12px]!"
        />
      </div>
    </div>
  );
}

function ColorsCard({ section, index }: { section: Section; index: number }) {
  const { doc, template, apply, assetUrl } = useEditor();
  const { t } = useUi();
  const c = t.editor.cine.colors;
  const base = useMemo(() => resolvePalette(template, doc), [template, doc]);
  const own = section.themeOverrides?.palette ?? {};
  const effective: Palette = { ...base, ...own };
  const bands = useMemo(() => bandsOf(base), [base]);
  const matches = (band: Palette) => ALL_KEYS.every((k) => same(band[k], effective[k]));
  const active: Band | 'custom' = !Object.keys(own).length
    ? 'own'
    : matches(bands.dark)
      ? 'dark'
      : matches(bands.soft)
        ? 'soft'
        : matches(bands.accent)
          ? 'accent'
          : 'custom';
  const [custom, setCustom] = useState(active === 'custom');
  const path = `sections.${index}.themeOverrides`;
  const setBand = (band: Band) => {
    setCustom(false);
    apply((d) => setSectionColors(d, index, band === 'own' ? null : paletteDiff(base, bands[band])), null);
  };
  const setKey = (key: keyof Palette, hex: string) =>
    apply((d) => setSectionColors(d, index, { [key]: hex }), `${path}.palette.${key}`);
  const choices = [
    ...new Set(
      [
        base.bg,
        base.surface,
        base.ink,
        base.inkMuted,
        base.accent,
        ...template.palettePresets.flatMap((p) => [p.palette.accent ?? '', p.palette.bg ?? '']),
      ]
        .filter((h) => HEX_COLOR_RE.test(h))
        .map((h) => h.toUpperCase()),
    ),
  ].slice(0, 8);
  const ratio = contrastRatio(effective.ink, effective.bg);
  const low = ratio < AA_TEXT || contrastRatio(effective.accentInk, effective.accent) < AA_TEXT;
  const photo =
    section.type !== 'hero' && section.media
      ? assetUrl(section.media.kind === 'video' ? section.media.poster : section.media.src)
      : null;
  const onMedia = ON_MEDIA.includes(layoutOf(section)) && !!photo;
  const typography = section.themeOverrides?.typography?.display?.size ?? 1;
  const spacing = section.themeOverrides?.spacing?.section ?? 1;
  const radius = section.themeOverrides?.radius?.media;
  const sizePath = `${path}.typography.display.size`;
  return (
    <PanelCard title={<CardTitleWithHelp area="sectionColors" title="colors" />}>
      <FieldFrame path={`${path}.palette`} label={t.editor.fieldLabels['section.themeOverrides']}>
        <div className="flex flex-col gap-3">
          <div
            role="radiogroup"
            aria-label={c.bandsLabel}
            onKeyDown={rovingKeyDown}
            className="grid grid-cols-2 gap-2"
          >
            {(['own', 'dark', 'soft', 'accent'] as const).map((band) => {
              const colors = band === 'own' ? base : bands[band];
              const on = !custom && active === band;
              return (
                <button
                  key={band}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  data-roving-item=""
                  data-band={band}
                  onClick={() => setBand(band)}
                  className={cn(
                    'flex items-center gap-2 rounded-card border px-2.5 py-2 text-start text-[12.5px]',
                    on ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
                  )}
                >
                  <span
                    aria-hidden
                    className="grid h-7 w-10 shrink-0 place-items-center rounded-[6px] border border-black/10 text-[12px] font-semibold"
                    style={{ background: colors.bg, color: colors.ink }}
                  >
                    Aa
                  </span>
                  <span className="truncate">{c.bands[band]}</span>
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={custom || active === 'custom'}
              tabIndex={custom || active === 'custom' ? 0 : -1}
              data-roving-item=""
              onClick={() => setCustom(true)}
              className={cn(
                'col-span-2 rounded-card border px-2.5 py-2 text-start text-[12.5px]',
                custom || active === 'custom' ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
              )}
            >
              {c.bands.custom}
            </button>
          </div>
          {custom || active === 'custom' ? (
            <div className="flex flex-col gap-3">
              <ColorPick
                label={c.bg}
                value={effective.bg}
                choices={choices}
                onChange={(v) => setKey('bg', v)}
              />
              <ColorPick
                label={c.ink}
                value={effective.ink}
                choices={choices}
                onChange={(v) => setKey('ink', v)}
              />
              <ColorPick
                label={c.accent}
                value={effective.accent}
                choices={choices}
                onChange={(v) => setKey('accent', v)}
              />
            </div>
          ) : null}
          {Object.keys(own).length ? (
            <div className="flex flex-wrap items-center gap-2" data-testid="section-contrast">
              <Badge variant={low ? 'warning' : 'live'}>{fmt(c.contrast, { ratio: ratio.toFixed(1) })}</Badge>
              {low ? (
                <>
                  <span className="text-[12px] text-warning">{c.contrastLow}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Wand2 />}
                    onClick={() =>
                      apply(
                        (d) =>
                          setSectionColors(d, index, paletteDiff(base, repairPalette(effective, EDIT_ALL))),
                        null,
                      )
                    }
                  >
                    {c.fix}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {photo ? <PhotoColors url={photo} index={index} onMedia={onMedia} /> : null}
          <details className="rounded-input border border-line px-3 py-2">
            <summary className="cursor-pointer list-none text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
              {c.advanced}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <RangeField
                path={sizePath}
                label={c.titleSize}
                value={Math.round(typography * 100)}
                min={80}
                max={140}
                step={5}
                format={(v) => `${v}%`}
                onChange={(v) => apply((d) => setSectionTokens(d, index, { titleSize: v / 100 }), sizePath)}
              />
              <RangeField
                label={c.spacing}
                value={Math.round(spacing * 100)}
                min={50}
                max={200}
                step={10}
                format={(v) => `${v}%`}
                onChange={(v) =>
                  apply(
                    (d) => setSectionTokens(d, index, { sectionSpacing: v / 100 }),
                    `${path}.spacing.section`,
                  )
                }
              />
              {section.type !== 'hero' && section.media ? (
                <RangeField
                  label={c.corners}
                  value={radius ?? template.tokens.radius.media ?? template.tokens.radius.card}
                  min={0}
                  max={40}
                  format={(v) => `${v}px`}
                  onChange={(v) =>
                    apply((d) => setSectionTokens(d, index, { mediaRadius: v }), `${path}.radius.media`)
                  }
                />
              ) : null}
            </div>
          </details>
          {section.themeOverrides ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              className="self-start"
              onClick={() => {
                setCustom(false);
                apply(
                  (d) =>
                    setSectionTokens(setSectionColors(d, index, null), index, {
                      titleSize: null,
                      sectionSpacing: null,
                      mediaRadius: null,
                    }),
                  null,
                );
              }}
            >
              {c.reset}
            </Button>
          ) : null}
        </div>
      </FieldFrame>
    </PanelCard>
  );
}

/** Three palettes from the section's picture (read in the browser); the scrim follows its brightness. */
function PhotoColors({ url, index, onMedia }: { url: string; index: number; onMedia: boolean }) {
  const { apply } = useEditor();
  const { t } = useUi();
  const c = t.editor.cine.colors;
  const p = t.editor.cine.photoPalette;
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'reading' }
    | { status: 'failed' }
    | { status: 'ready'; options: PhotoPalette[]; scrim: number }
  >({ status: 'idle' });
  // a new picture: its colors must be read again
  useEffect(() => setState({ status: 'idle' }), [url]);
  const read = () => {
    setState({ status: 'reading' });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const { rgba, width } = pixelsOf(img);
        setState({
          status: 'ready',
          options: photoPalettes(extractSwatches(rgba)),
          scrim: scrimForPhoto(rgba, width),
        });
      } catch {
        setState({ status: 'failed' });
      }
    };
    img.onerror = () => setState({ status: 'failed' });
    img.src = url;
  };
  return (
    <div className="flex flex-col gap-2 rounded-input bg-subtle p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold">{c.fromPhoto}</span>
        {state.status === 'idle' || state.status === 'failed' ? (
          <Button variant="secondary" size="sm" icon={<Wand2 />} onClick={read}>
            {c.suggest}
          </Button>
        ) : null}
      </div>
      {state.status === 'reading' ? (
        <p className="text-[12px] text-muted">{t.editor.cine.media.reading}</p>
      ) : null}
      {state.status === 'failed' ? (
        <p role="alert" className="text-[12px] text-danger">
          {p.failed}
        </p>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <PaletteChoices
            options={state.options}
            onApply={(palette) =>
              apply((d) => applySectionPalette(d, index, palette, onMedia ? state.scrim : null), null)
            }
          />
          <p className="text-[12px] text-muted">{c.fromPhotoHelp}</p>
        </>
      ) : null}
    </div>
  );
}

/** The three palettes as buttons: their colors, a sample on their paper, their name. */
export function PaletteChoices({
  options,
  onApply,
  sample,
}: {
  options: PhotoPalette[];
  onApply: (palette: Palette, option: PhotoPalette) => void;
  sample?: ReactNode;
}) {
  const { t } = useUi();
  const p = t.editor.cine.photoPalette;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
      {options.map((o) => {
        const q = o.palette;
        const name = p.options[o.id];
        return (
          <button
            key={o.id}
            type="button"
            data-palette-option={o.id}
            aria-label={fmt(p.apply, { name })}
            onClick={() => onApply(q, o)}
            className="flex flex-col gap-1.5 rounded-card border border-line p-2 text-start hover:border-ink"
            style={{ background: q.bg } as CSSProperties}
          >
            <span className="flex items-center justify-between gap-1">
              <span className="text-[13px] font-semibold" style={{ color: q.ink }}>
                {name}
              </span>
              <span
                aria-hidden
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: q.accent, color: q.accentInk }}
              >
                Aa
              </span>
            </span>
            {sample ? (
              <span className="truncate text-[12px]" style={{ color: q.inkMuted }}>
                {sample}
              </span>
            ) : null}
            <span aria-hidden className="flex gap-1">
              {[q.bg, q.surface, q.ink, q.inkMuted, q.accent].map((color, i) => (
                <span
                  key={i}
                  className="size-4 rounded-full border border-black/10"
                  style={{ background: color }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── the hero: its text color ────────────────────────────────────────────────────────────────────

function HeroColorsCard({ section, index }: { section: Section; index: number }) {
  const { doc, template, apply } = useEditor();
  const { t } = useUi();
  const c = t.editor.cine.colors;
  const base = resolvePalette(template, doc);
  const own = section.themeOverrides?.palette?.heroText ?? null;
  const choices = [
    ...new Set(['#FFFFFF', base.bg, base.surface, base.accent, base.ink].map((h) => h.toUpperCase())),
  ];
  return (
    <PanelCard title={<CardTitleWithHelp area="sectionColors" title="heroColors" />}>
      <FieldFrame path={`sections.${index}.themeOverrides.palette.heroText`} label={c.heroText}>
        <div className="flex flex-col gap-2">
          <ColorPick
            label={c.heroText}
            value={own ?? base.heroText}
            choices={choices}
            onChange={(hex) => apply((d) => setSectionColors(d, index, { heroText: hex }), null)}
          />
          {own ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              className="self-start"
              onClick={() => apply((d) => setSectionColors(d, index, { heroText: null }), null)}
            >
              {c.heroTextAuto}
            </Button>
          ) : null}
        </div>
      </FieldFrame>
    </PanelCard>
  );
}
