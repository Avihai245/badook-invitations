'use client';

import { Check, Copy, ExternalLink, Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Field,
  Input,
  Segmented,
  Select,
  SwatchGroup,
  cn,
  useToast,
} from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { HEX_COLOR_RE } from '../../contracts/schemas';
import type { EventType, InvitationDocument, Locale, Palette } from '../../contracts/types';
import { contrastRatio } from '../../lib/contrast';
import { visibleGlyphCount } from '../../lib/text';
import { timezoneOptions } from '../../lib/timezones';
import { templateFileUrl, withStartAt } from '../../renderer/assets';
import { COUPLE_EVENTS } from '../../templates/seed-copy';
import { openPublishDialog } from '../events';
import {
  BoolField,
  DateField,
  FieldFrame,
  L10nField,
  PanelCard,
  RangeField,
  RsvpDeadlineField,
  SelectField,
  TimeField,
  hostsText,
  usePreviewControls,
} from '../fields/fields';
import { LibraryFontPairs } from '../fields/font-library';
import { AUDIO_TYPES, ImageField, UploadTile, useUploader } from '../fields/media';
import { addLocale, removeLocale } from '../locales';
import { useEditor, type PanelId } from '../state/EditorProvider';
import { FontSuggestions, OpeningPicker, PhotoPaletteCard, StylePanel } from './DesignCinematic';

/**
 * A track's licence as the template pack gives it — unless it's still a placeholder ("TBD …"),
 * which hosts must never see.
 */
export function trackLicense(license: string): string | null {
  const text = license.trim();
  return !text || /^(tbd|todo|tba)\b/i.test(text) ? null : text;
}

export function GlobalPanel({ panel }: { panel: PanelId }) {
  switch (panel) {
    case 'cover':
      return <CoverPanel />;
    case 'palette':
      return <PalettePanel />;
    case 'fonts':
      return <FontsPanel />;
    case 'style':
      return <StylePanel />;
    case 'music':
      return <MusicPanel />;
    case 'event':
      return <EventPanel />;
    case 'languages':
      return <LanguagesPanel />;
    case 'share':
      return <SharePanel />;
  }
}

// ─── cover ─────────────────────────────────────────────────────────────────────────────────────

function CoverPanel() {
  const { doc, template, update, features } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const c = e.f.cover;
  const { replay } = usePreviewControls();
  const overlay = template.cover.overlay;
  const max = overlay.text.maxGlyphs;
  return (
    <>
      <PanelCard>
        <BoolField path="cover.enabled" label={c.enabled} help={c.enabledHelp} />
      </PanelCard>
      {/* the cinematic openings (feature `cinematic`) */}
      {doc.cover.enabled && features.cinematic !== false ? <OpeningPicker /> : null}
      {doc.cover.enabled ? (
        <PanelCard
          title={e.cards.overlay}
          aside={
            <Button variant="secondary" size="sm" icon={<Play />} onClick={replay}>
              {e.canvas.replay}
            </Button>
          }
        >
          {overlay.kind !== 'none' ? (
            <L10nField
              path="cover.monogram"
              label={overlay.kind === 'ticket_text' ? c.ticketText : c.monogram}
              cap={max}
              count={visibleGlyphCount}
              help={fmt(c.monogramHelp, { max })}
              maxLength={max * 4}
              nullable
            />
          ) : null}
          {overlay.recolor && template.cover.sealColors.length ? (
            <FieldFrame path="cover.sealColor" label={c.sealColor}>
              <div className="mb-1.5 text-[13px] font-semibold">{c.sealColor}</div>
              <SwatchGroup
                label={c.sealColor}
                value={doc.cover.sealColor ?? template.cover.sealColors[0]!}
                onValueChange={(v) => update('cover.sealColor', v, null)}
                options={template.cover.sealColors.map((color) => ({
                  value: color,
                  color,
                  label: `${c.sealColor} ${color}`,
                }))}
              />
            </FieldFrame>
          ) : null}
          <L10nField path="cover.hint" label={c.hint} cap={40} nullable />
        </PanelCard>
      ) : null}
    </>
  );
}

// ─── palette ───────────────────────────────────────────────────────────────────────────────────

/** Text colors and the background they're read on (§7.5: warn below 4.5:1). */
const CONTRAST_PAIRS: Partial<Record<keyof Palette, keyof Palette>> = {
  ink: 'bg',
  inkMuted: 'bg',
  accent: 'bg',
  accentInk: 'accent',
};

function PalettePanel() {
  const { doc, template, update } = useEditor();
  const { t, locale } = useUi();
  const e = t.editor;
  const p = e.f.palette;
  const editable = template.tokens.editablePaletteKeys;
  const overrides = doc.theme.palette ?? {};
  const effective: Palette = { ...template.tokens.palette, ...overrides };
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const presetOf = (preset: (typeof template.palettePresets)[number]) =>
    Object.fromEntries(Object.entries(preset.palette).filter(([k]) => editable.includes(k as keyof Palette)));
  const active = template.palettePresets.find((preset) =>
    editable.every((k) => same(preset.palette[k] ?? template.tokens.palette[k], effective[k])),
  );
  const setColor = (key: keyof Palette, hex: string) =>
    update('theme.palette', { ...overrides, [key]: hex }, `theme.palette.${key}`);

  return (
    <>
      <PhotoPaletteCard />
      {template.palettePresets.length ? (
        <PanelCard title={e.cards.presets}>
          <FieldFrame path="theme.palette" label={e.names.palette}>
            <div className="grid grid-cols-2 gap-2">
              {template.palettePresets.map((preset) => {
                const colors = { ...template.tokens.palette, ...preset.palette };
                const on = active?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update('theme.palette', presetOf(preset), null)}
                    className={cn(
                      'flex items-center gap-2 rounded-card border bg-surface px-3 py-2.5 text-start text-[13px]',
                      on ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
                    )}
                  >
                    <span aria-hidden className="flex gap-1">
                      {[colors.bg, colors.accent, colors.ink].map((color, i) => (
                        <span
                          key={i}
                          className="size-3.5 rounded-full border border-black/10"
                          style={{ background: color }}
                        />
                      ))}
                    </span>
                    <span className="truncate">{preset.name[locale] ?? preset.name.en}</span>
                  </button>
                );
              })}
            </div>
          </FieldFrame>
        </PanelCard>
      ) : null}
      <PanelCard
        title={e.cards.custom}
        aside={
          doc.theme.palette ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              onClick={() => update('theme.palette', null, null)}
            >
              {p.reset}
            </Button>
          ) : null
        }
      >
        {editable.map((key) => {
          const against = CONTRAST_PAIRS[key];
          const ratio = against ? contrastRatio(effective[key], effective[against]) : null;
          return (
            <ColorRow
              key={key}
              label={p.keys[key]}
              value={effective[key]}
              onChange={(hex) => setColor(key, hex)}
              contrast={
                ratio !== null && against
                  ? {
                      ratio,
                      ok: ratio >= 4.5,
                      text: fmt(p.contrast, { ratio: ratio.toFixed(1), against: p.keys[against] }),
                    }
                  : null
              }
            />
          );
        })}
      </PanelCard>
    </>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  contrast,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  contrast: { ratio: number; ok: boolean; text: string } | null;
}) {
  const { t } = useUi();
  const p = t.editor.f.palette;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="color"
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="size-8 shrink-0 cursor-pointer rounded-[6px] border border-line bg-surface p-0.5"
      />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>
      {contrast ? (
        <Badge variant={contrast.ok ? 'live' : 'warning'} title={contrast.text} aria-label={contrast.text}>
          {contrast.ok ? p.contrastOk : p.contrastLow}
        </Badge>
      ) : null}
      <Input
        aria-label={`${label} — ${p.hex}`}
        value={draft}
        dir="ltr"
        maxLength={7}
        onChange={(e) => {
          const v = e.target.value.trim();
          setDraft(v);
          if (HEX_COLOR_RE.test(v)) onChange(v);
        }}
        onBlur={() => setDraft(value)}
        className="h-8! w-[92px]! shrink-0 font-mono text-[12px]!"
      />
    </div>
  );
}

// ─── fonts ─────────────────────────────────────────────────────────────────────────────────────

function FontsPanel() {
  const { doc, template, update } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const sample = (l: Locale) => hostsText(doc, l) || (l === 'he' ? 'נועה & איתי' : 'Noa & Itay');
  return (
    <>
      <FontSuggestions />
      <PanelCard>
        <FieldFrame path="theme.fontPairId" label={e.names.fonts}>
          <div role="radiogroup" aria-label={e.names.fonts} className="flex flex-col gap-2">
            {template.fontPairs.map((pair) => {
              const on = doc.theme.fontPairId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update('theme.fontPairId', pair.id, null)}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-card border bg-surface px-3 py-3 text-start',
                    on ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      lang="he"
                      dir="rtl"
                      className="truncate text-[24px] leading-tight"
                      style={{ fontFamily: `"${pair.display.hebrew}", serif` }}
                    >
                      {sample('he')}
                    </span>
                    <span
                      lang="en"
                      dir="ltr"
                      className="truncate text-[24px] leading-tight"
                      style={{ fontFamily: `"${pair.display.latin}", serif` }}
                    >
                      {sample('en')}
                    </span>
                  </span>
                  <span
                    className="flex shrink-0 flex-col items-end gap-1 text-[11px] leading-snug text-muted"
                    dir="ltr"
                  >
                    {on ? <Check aria-hidden size={16} className="text-ink" /> : null}
                    <span>{pair.display.hebrew}</span>
                    <span>{pair.display.latin}</span>
                  </span>
                </button>
              );
            })}
            <LibraryFontPairs
              selected={doc.theme.fontPairId}
              onSelect={(id) => update('theme.fontPairId', id, null)}
              title={e.f.fonts.more}
              help={e.f.fonts.moreHelp}
            />
          </div>
        </FieldFrame>
      </PanelCard>
    </>
  );
}

// ─── music ─────────────────────────────────────────────────────────────────────────────────────

function MusicPanel() {
  const { doc, template, update, apply, bases, assetUrl } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const m = e.f.music;
  const music = doc.music;
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<number | undefined>(undefined);
  const [playing, setPlaying] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const { run, progress, error } = useUploader();

  useEffect(
    () => () => {
      audio.current?.pause();
      window.clearTimeout(stopTimer.current);
    },
    [],
  );
  const stop = () => {
    audio.current?.pause();
    window.clearTimeout(stopTimer.current);
    setPlaying(null);
  };
  const play = (id: string, url: string) => {
    if (playing === id) return stop();
    stop();
    const el = (audio.current ??= new Audio());
    // the same start second as the invitation (a media fragment — see withStartAt)
    el.src = withStartAt(url, music.startAtSec);
    try {
      el.volume = music.volume;
    } catch {
      // read-only on iOS
    }
    void el.play().then(
      () => {
        setPlaying(id);
        stopTimer.current = window.setTimeout(stop, 10_000);
      },
      () => setPlaying(null),
    );
  };
  const choose = (patch: Partial<InvitationDocument['music']>) =>
    apply((d) => ({ ...d, music: { ...d.music, ...patch } }), null);
  const custom = music.customUrl;
  const hero = doc.sections.find((s) => s.type === 'hero');
  const heroVideo = hero?.type === 'hero' && hero.data.media.kind === 'video';
  // the hero video's own sound instead of a track (only while the hero is a video)
  const videoSound = heroVideo && music.videoSound;

  return (
    <>
      <PanelCard>
        <BoolField path="music.enabled" label={m.enabled} help={m.enabledHelp} />
        {music.enabled ? <p className="text-[12px] text-muted">{m.whereHelp}</p> : null}
      </PanelCard>
      {music.enabled && heroVideo ? (
        <PanelCard>
          <Field label={m.source}>
            <Segmented<'track' | 'video'>
              fullWidth
              value={videoSound ? 'video' : 'track'}
              onValueChange={(v) => {
                stop();
                choose({ videoSound: v === 'video' });
              }}
              options={[
                { value: 'track', label: m.sourceTrack },
                { value: 'video', label: m.sourceVideo },
              ]}
            />
          </Field>
          {videoSound ? <p className="text-[12px] text-muted">{m.sourceVideoHelp}</p> : null}
        </PanelCard>
      ) : null}
      {music.enabled && !videoSound ? (
        <PanelCard title={e.cards.tracks}>
          <div role="radiogroup" aria-label={e.cards.tracks} className="flex flex-col gap-2">
            {template.music.tracks.map((track) => {
              const on = !custom && music.trackId === track.id;
              const url = templateFileUrl(template.id, track.url, bases);
              const license = trackLicense(track.license);
              return (
                <TrackRow
                  key={track.id}
                  title={track.title}
                  subtitle={license ? fmt(m.license, { license }) : m.designTrack}
                  selected={on}
                  onSelect={() => choose({ trackId: track.id, customUrl: null })}
                  playing={playing === track.id}
                  onPlay={url ? () => play(track.id, url) : undefined}
                />
              );
            })}
            {custom ? (
              <TrackRow
                title={m.custom}
                subtitle={e.upload.uploaded}
                selected
                onSelect={() => {}}
                playing={playing === 'custom'}
                onPlay={assetUrl(custom) ? () => play('custom', assetUrl(custom)!) : undefined}
                onRemove={() => choose({ customUrl: null, trackId: template.music.defaultTrackId })}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-3.5">
            <div className="text-[13px] font-semibold">{m.custom}</div>
            <p className="text-[12px] text-muted">{m.customHelp}</p>
            <Checkbox checked={rights} onCheckedChange={setRights} label={m.rights} />
            <UploadTile
              label={e.upload.audio}
              accept={AUDIO_TYPES}
              onFiles={async ([file]) => {
                if (!file) return;
                const res = await run(file);
                if (res?.kind === 'audio') choose({ customUrl: res.ref, trackId: null });
              }}
              progress={progress}
              disabled={!rights}
              className="h-12"
            />
            {!rights ? <p className="text-[12px] text-muted">{m.rightsRequired}</p> : null}
            {error ? (
              <p role="alert" className="text-[12px] text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </PanelCard>
      ) : null}
      {music.enabled ? (
        <PanelCard>
          <RangeField
            path="music.volume"
            label={m.volume}
            value={Math.round(music.volume * 100)}
            min={0}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => update('music.volume', v / 100, 'music.volume')}
          />
          {videoSound ? null : (
            <Field label={m.startAt}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                dir="ltr"
                value={music.startAtSec}
                onChange={(ev) => {
                  const n = Math.max(0, Math.min(600, Math.round(Number(ev.target.value) || 0)));
                  update('music.startAtSec', n, 'music.startAtSec');
                }}
                className="w-28!"
              />
            </Field>
          )}
        </PanelCard>
      ) : null}
    </>
  );
}

function TrackRow({
  title,
  subtitle,
  selected,
  onSelect,
  playing,
  onPlay,
  onRemove,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
  playing: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  const { t } = useUi();
  const m = t.editor.f.music;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-card border bg-surface px-3 py-2',
        selected ? 'border-ink ring-1 ring-ink' : 'border-line',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col text-start"
      >
        <span className="truncate text-[14px] font-semibold" dir="auto">
          {title}
        </span>
        <span className="truncate text-[12px] text-muted" dir="auto">
          {subtitle}
        </span>
      </button>
      {onPlay ? (
        <Button
          variant="ghost"
          size="sm"
          icon={playing ? <Pause /> : <Play />}
          onClick={onPlay}
          aria-pressed={playing}
        >
          {playing ? m.stop : m.play}
        </Button>
      ) : null}
      {onRemove ? (
        <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={onRemove}>
          {t.editor.upload.remove}
        </Button>
      ) : null}
    </div>
  );
}

// ─── event ─────────────────────────────────────────────────────────────────────────────────────

function EventPanel() {
  const { doc, template, apply, update } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const f = e.f;
  const couple = COUPLE_EVENTS.includes(doc.eventType);
  const zones = useMemo(() => timezoneOptions([doc.timezone]), [doc.timezone]);
  const changeType = (type: EventType) =>
    apply(
      (d) => ({
        ...d,
        eventType: type,
        hosts: {
          ...d.hosts,
          secondary: COUPLE_EVENTS.includes(type) ? (d.hosts.secondary ?? {}) : null,
          joiner: COUPLE_EVENTS.includes(type)
            ? (d.hosts.joiner ?? Object.fromEntries(d.locales.map((l) => [l, '&'])))
            : d.hosts.joiner,
        },
      }),
      null,
    );
  return (
    <>
      <PanelCard title={e.cards.hosts}>
        <Field label={f.event.eventType}>
          <Select value={doc.eventType} onChange={(ev) => changeType(ev.target.value as EventType)}>
            {template.categories.map((c) => (
              <option key={c} value={c}>
                {t.eventTypes[c]}
              </option>
            ))}
          </Select>
        </Field>
        <L10nField
          path="hosts.primary"
          label={couple ? f.hosts.primaryCouple : f.hosts.primary}
          cap={20}
          required
        />
        {couple ? (
          <>
            <L10nField path="hosts.secondary" label={f.hosts.secondary} cap={20} required />
            <L10nField path="hosts.joiner" label={f.hosts.joiner} maxLength={5} nullable />
          </>
        ) : null}
        <L10nField path="hosts.parents" label={f.hosts.parents} help={f.hosts.parentsHelp} nullable />
      </PanelCard>
      <PanelCard title={e.cards.when}>
        <DateField path="event.date" label={f.event.date} />
        <div className="grid grid-cols-2 gap-3">
          <TimeField path="event.startTime" label={f.event.startTime} />
          <TimeField path="event.endTime" label={f.event.endTime} nullable />
        </div>
        <p className="-mt-2 text-[12px] text-muted">{f.event.endTimeHelp}</p>
        <Field label={f.event.timezone}>
          <Select value={doc.timezone} onChange={(ev) => update('timezone', ev.target.value, null)} dir="ltr">
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </Select>
        </Field>
        <SelectField
          path="event.hebrewDate"
          label={f.event.hebrewDate}
          options={(['day', 'eve', 'off'] as const).map((v) => ({ value: v, label: f.event.hebrewDates[v] }))}
        />
        <SelectField
          path="event.timeFormat"
          label={f.event.timeFormat}
          options={(['auto', '24h', '12h'] as const).map((v) => ({
            value: v,
            label: f.event.timeFormats[v],
          }))}
          fromValue={(v) => (v === null ? 'auto' : String(v))}
          toValue={(v) => (v === 'auto' ? null : v)}
        />
        <RsvpDeadlineField />
      </PanelCard>
    </>
  );
}

// ─── languages ─────────────────────────────────────────────────────────────────────────────────

function LanguagesPanel() {
  const { doc, template, defaults, apply, update, setLocale } = useEditor();
  const { t } = useUi();
  const { toast } = useToast();
  const e = t.editor;
  const l = e.f.languages;
  const [removing, setRemoving] = useState<Locale | null>(null);
  return (
    <>
      <PanelCard title={e.cards.active}>
        <ul className="flex flex-col gap-2">
          {template.supportsLocales.map((locale) => {
            const active = doc.locales.includes(locale);
            const name = e.languageFull[locale];
            return (
              <li
                key={locale}
                className="flex h-12 items-center gap-3 rounded-card border border-line bg-surface px-3"
              >
                <span lang={locale} className="flex-1 text-[14px] font-semibold">
                  {name}
                </span>
                {active ? (
                  doc.locales.length > 1 ? (
                    <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setRemoving(locale)}>
                      {fmt(l.remove, { language: e.languageIn[locale] })}
                    </Button>
                  ) : (
                    <Check aria-hidden size={16} className="text-success" />
                  )
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus />}
                    onClick={() => {
                      apply((d) => addLocale(d, locale, template, defaults), null);
                      setLocale(locale);
                      toast({ title: fmt(l.added, { language: e.languageIn[locale] }), variant: 'success' });
                    }}
                  >
                    {fmt(l.add, { language: e.languageIn[locale] })}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {doc.locales.length > 1 ? (
          <>
            <Field label={l.default}>
              <Segmented<Locale>
                value={doc.defaultLocale}
                onValueChange={(v) => update('defaultLocale', v, null)}
                options={doc.locales.map((v) => ({ value: v, label: e.languageFull[v] }))}
              />
            </Field>
            <p className="text-[12px] text-muted">{l.switcherNote}</p>
          </>
        ) : null}
      </PanelCard>
      {removing ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fmt(l.removeTitle, { language: e.languageIn[removing] })}
          description={fmt(l.removeBody, { language: e.languageIn[removing] })}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = removing;
                  apply((d) => removeLocale(d, target), null);
                  setRemoving(null);
                }}
              >
                {fmt(l.remove, { language: e.languageIn[removing] })}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}

// ─── share ─────────────────────────────────────────────────────────────────────────────────────

function SharePanel() {
  const { meta, publicBaseUrl } = useEditor();
  const { t } = useUi();
  const { toast } = useToast();
  const e = t.editor;
  const s = e.f.share;
  const url = `${publicBaseUrl.replace(/\/+$/, '')}/i/${meta.slug}`;
  return (
    <>
      <PanelCard title={e.cards.link}>
        <Field label={s.slug} help={s.slugHelp}>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} dir="ltr" onFocus={(ev) => ev.target.select()} />
            <Button
              variant="secondary"
              icon={<Copy />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast({ title: e.publishDialog.copied, variant: 'success' }))
              }
            >
              {t.common.copy}
            </Button>
          </div>
        </Field>
        {meta.status === 'published' ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline"
            >
              <ExternalLink aria-hidden className="size-3.5" />
              {s.open}
            </a>
            {meta.unpublishedChanges ? <span className="text-warning">{s.pendingChanges}</span> : null}
          </div>
        ) : (
          // the link is only live once published (guests would get "not available yet")
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-[#fde68a] bg-warning-bg px-3 py-2.5 text-[13px] text-warning"
          >
            <span>{s.notLive}</span>
            <Button size="sm" onClick={openPublishDialog}>
              {s.publishNow}
            </Button>
          </div>
        )}
      </PanelCard>
      <PanelCard title={e.cards.card}>
        <L10nField path="share.ogTitle" label={s.ogTitle} help={s.ogTitleHelp} cap={60} nullable />
        <L10nField
          path="share.ogDescription"
          label={s.ogDescription}
          help={s.ogDescriptionHelp}
          cap={120}
          multiline
          rows={2}
          nullable
        />
        <ImageField path="share.ogImage" label={s.ogImage} help={s.ogImageHelp} />
        <BoolField path="share.noindex" label={s.noindex} help={s.noindexHelp} />
      </PanelCard>
    </>
  );
}
