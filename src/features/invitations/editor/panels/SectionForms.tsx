'use client';

import { Info, MapPin } from 'lucide-react';
import { Card, Checkbox, Field, Select } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import {
  DIETARY_KEYS,
  TIMELINE_ICONS,
  type L10n,
  type Locale,
  type Section,
  type SectionOf,
  type TimelineIcon,
  type Venue,
} from '../../contracts/types';
import { CAPS, MAX_VENUES } from '../../contracts/validate';
import { t as invitationText } from '../../i18n/dictionary';
import { formatTime } from '../../lib/dates';
import { SEED_COPY } from '../../templates/seed-copy';
import {
  BoolField,
  DateField,
  L10nField,
  PanelCard,
  RangeField,
  SegmentedField,
  SelectField,
  SwitchRow,
  TextField,
  TimeField,
  hostsText,
} from '../fields/fields';
import { ListEditor } from '../fields/ListEditor';
import { HeroMediaField, IMAGE_TYPES, ImageField, UploadTile, useUploader } from '../fields/media';
import { getAt, insertAt, setAt, uniqueId } from '../paths';
import { useEditor } from '../state/EditorProvider';

const pick = (value: L10n, locales: readonly Locale[]): L10n =>
  Object.fromEntries(locales.filter((l) => value[l] !== undefined).map((l) => [l, value[l]]));

/** The form of one section (§7.3 b); `index` locates it in `doc.sections`. */
export function SectionForm({ section, index }: { section: Section; index: number }) {
  const base = `sections.${index}.data`;
  switch (section.type) {
    case 'hero':
      return <HeroForm base={base} section={section} />;
    case 'countdown':
      return <CountdownForm base={base} section={section} />;
    case 'text':
      return <TextForm base={base} section={section} />;
    case 'venues':
      return <VenuesForm base={base} />;
    case 'timeline':
      return <TimelineForm base={base} section={section} />;
    case 'faq':
      return <FaqForm base={base} />;
    case 'gallery':
      return <GalleryForm base={base} section={section} />;
    case 'gifts':
      return <GiftsForm base={base} />;
    case 'reveal':
      return <RevealForm base={base} section={section} />;
    case 'rsvp':
      return <RsvpForm base={base} section={section} />;
    case 'footer':
      return <FooterForm base={base} />;
  }
}

function useText() {
  const { t, locale } = useUi();
  return { e: t.editor, f: t.editor.f, cards: t.editor.cards, ui: locale, t };
}

// ─── hero ──────────────────────────────────────────────────────────────────────────────────────

function HeroForm({ base, section }: { base: string; section: SectionOf<'hero'> }) {
  const { doc, update, locale } = useEditor();
  const { f, cards, e } = useText();
  const d = section.data;
  const names = hostsText(doc, locale);
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.eyebrow`} label={f.eyebrow} cap={CAPS.eyebrow} nullable />
        <SegmentedField
          path={`${base}.title`}
          label={f.title}
          value={d.title.mode}
          onValueChange={(mode) =>
            update(
              `${base}.title`,
              mode === 'hosts'
                ? { mode: 'hosts' }
                : {
                    mode: 'custom',
                    text: Object.fromEntries(doc.locales.map((l) => [l, hostsText(doc, l)])),
                  },
              null,
            )
          }
          options={[
            { value: 'hosts', label: f.titleModes.hosts },
            { value: 'custom', label: f.titleModes.custom },
          ]}
          help={d.title.mode === 'hosts' ? fmt(f.titleFromHosts, { names }) : undefined}
        />
        {d.title.mode === 'custom' ? (
          <L10nField path={`${base}.title.text`} label={f.customTitle} cap={CAPS.heroTitle} />
        ) : null}
        <L10nField path={`${base}.locationLine`} label={f.locationLine} cap={CAPS.locationLine} nullable />
        <BoolField path={`${base}.showDate`} label={f.showDate} help={f.showDateHelp} />
        <SelectField
          path="event.hebrewDate"
          label={f.event.hebrewDate}
          options={(['day', 'eve', 'off'] as const).map((v) => ({ value: v, label: f.event.hebrewDates[v] }))}
        />
      </PanelCard>
      <PanelCard title={cards.background}>
        <HeroMediaField path={`${base}.media`} label={e.fieldLabels['hero.media']} />
        <RangeField
          path={`${base}.overlayOpacity`}
          label={f.overlay}
          value={Math.round(d.overlayOpacity * 100)}
          min={0}
          max={70}
          format={(v) => `${v}%`}
          onChange={(v) => update(`${base}.overlayOpacity`, v / 100, `${base}.overlayOpacity`)}
        />
      </PanelCard>
    </>
  );
}

// ─── countdown ─────────────────────────────────────────────────────────────────────────────────

function CountdownForm({ base, section }: { base: string; section: SectionOf<'countdown'> }) {
  const { doc, update } = useEditor();
  const { f, cards } = useText();
  const target = section.data.target;
  return (
    <PanelCard title={cards.texts}>
      <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} />
      <L10nField path={`${base}.subtitle`} label={f.subtitle} cap={CAPS.subtitle} nullable />
      <SegmentedField
        label={f.target}
        value={target === 'event' ? 'event' : 'custom'}
        onValueChange={(v) =>
          update(
            `${base}.target`,
            v === 'event' ? 'event' : { date: doc.event.date, time: doc.event.startTime },
            null,
          )
        }
        options={[
          { value: 'event', label: f.targets.event },
          { value: 'custom', label: f.targets.custom },
        ]}
      />
      {target !== 'event' ? (
        <div className="grid grid-cols-2 gap-3">
          <DateField path={`${base}.target.date`} label={f.targetDate} />
          <TimeField path={`${base}.target.time`} label={f.targetTime} />
        </div>
      ) : null}
      <L10nField path={`${base}.afterEvent`} label={f.afterEvent} cap={CAPS.subtitle} />
    </PanelCard>
  );
}

// ─── text ──────────────────────────────────────────────────────────────────────────────────────

const httpsLike = (s: string) => s.trim().length > 0;

function TextForm({ base, section }: { base: string; section: SectionOf<'text'> }) {
  const { update } = useEditor();
  const { f, cards } = useText();
  const cta = section.data.cta;
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} nullable />
        <L10nField path={`${base}.subtitle`} label={f.subtitle} cap={CAPS.subtitle} nullable />
        <L10nField path={`${base}.body`} label={f.body} cap={CAPS.body} multiline rows={6} />
        <ImageField path={`${base}.illustration`} label={f.illustration} />
      </PanelCard>
      <PanelCard title={cards.button}>
        <SwitchRow
          path={`${base}.cta`}
          label={f.cta}
          checked={!!cta}
          onCheckedChange={(on) => update(`${base}.cta`, on ? { label: {}, url: 'https://' } : null, null)}
        />
        {cta ? (
          <>
            <L10nField path={`${base}.cta.label`} label={f.ctaLabel} cap={CAPS.title} />
            <TextField
              path={`${base}.cta.url`}
              label={f.ctaUrl}
              help={f.urlHelp}
              dir="ltr"
              type="url"
              inputMode="url"
              accept={httpsLike}
              invalidText={f.urlRequired}
            />
          </>
        ) : null}
      </PanelCard>
    </>
  );
}

// ─── venues ────────────────────────────────────────────────────────────────────────────────────

function VenuesForm({ base }: { base: string }) {
  const { doc, locale, update } = useEditor();
  const { f, cards, e } = useText();
  const v = f.venue;
  return (
    <PanelCard title={cards.items}>
      <ListEditor<Venue>
        path={`${base}.items`}
        idBase="venue"
        max={MAX_VENUES}
        addLabel={e.list.add}
        summary={(item) => item.name[locale]?.trim() || item.label[locale]?.trim() || ''}
        create={(ids) => ({
          id: uniqueId('venue', ids),
          label: pick(SEED_COPY.venueLabel, doc.locales),
          name: {},
          address: {},
          geo: null,
          mapsQuery: null,
          date: null,
          startTime: doc.event.startTime,
          endTime: null,
          showMap: true,
          buttons: { maps: true, waze: doc.locales.includes('he'), calendar: true },
        })}
        render={(item, _i, p) => (
          <>
            <L10nField path={`${p}.label`} label={v.label} cap={CAPS.title} />
            <L10nField path={`${p}.name`} label={v.name} />
            <L10nField path={`${p}.address`} label={v.address} />
            {item.geo ? (
              <div className="flex items-start gap-2 rounded-input bg-subtle px-3 py-2 text-[12px] text-muted">
                <MapPin aria-hidden size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  {v.geo}
                  <button
                    type="button"
                    onClick={() => update(`${p}.geo`, null, null)}
                    className="ms-1 font-semibold text-ink underline-offset-2 hover:underline"
                  >
                    {v.geoClear}
                  </button>
                </div>
              </div>
            ) : (
              <TextField
                path={`${p}.mapsQuery`}
                label={v.mapsQuery}
                help={v.mapsQueryHelp}
                toValue={(s) => (s.trim() ? s : null)}
              />
            )}
            <DateField path={`${p}.date`} label={v.date} help={v.dateHelp} nullable />
            <div className="grid grid-cols-2 gap-3">
              <TimeField path={`${p}.startTime`} label={v.startTime} />
              <TimeField path={`${p}.endTime`} label={v.endTime} nullable />
            </div>
            <BoolField path={`${p}.showMap`} label={v.showMap} />
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1.5 text-[13px] font-semibold">{v.buttons}</legend>
              <BoolField path={`${p}.buttons.maps`} label={v.maps} />
              <BoolField path={`${p}.buttons.waze`} label={v.waze} />
              <BoolField path={`${p}.buttons.calendar`} label={v.calendar} />
            </fieldset>
          </>
        )}
      />
    </PanelCard>
  );
}

// ─── timeline ──────────────────────────────────────────────────────────────────────────────────

function TimelineForm({ base, section }: { base: string; section: SectionOf<'timeline'> }) {
  const { doc, locale, update } = useEditor();
  const { f, cards, e, ui } = useText();
  const tl = f.timeline;
  type Item = SectionOf<'timeline'>['data']['items'][number];
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} />
        <BoolField path={`${base}.showDate`} label={f.showDate} />
        <SegmentedField
          label={tl.revealMode}
          value={section.data.revealMode}
          onValueChange={(v) => update(`${base}.revealMode`, v, null)}
          options={[
            { value: 'none', label: tl.revealModes.none },
            { value: 'flip', label: tl.revealModes.flip },
          ]}
        />
      </PanelCard>
      <PanelCard title={cards.items}>
        <ListEditor<Item>
          path={`${base}.items`}
          idBase="t"
          addLabel={e.list.add}
          summary={(item) => (
            <span className="flex min-w-0 items-center gap-2">
              <span dir="ltr" className="shrink-0 text-muted tabular-nums">
                {formatTime(item.time, ui, doc.event.timeFormat)}
              </span>
              <span className="truncate">{item.label[locale]}</span>
            </span>
          )}
          create={(ids) => {
            const last = section.data.items.at(-1);
            return {
              id: uniqueId('t', ids),
              time: last?.time ?? doc.event.startTime,
              label: {},
              icon: 'star',
            };
          }}
          render={(_item, _i, p) => (
            <>
              <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                <TimeField path={`${p}.time`} label={tl.time} />
                <SelectField<TimelineIcon>
                  path={`${p}.icon`}
                  label={tl.icon}
                  options={TIMELINE_ICONS.map((icon) => ({ value: icon, label: tl.icons[icon] }))}
                />
              </div>
              <L10nField path={`${p}.label`} label={tl.label} cap={CAPS.timelineLabel} />
            </>
          )}
        />
      </PanelCard>
    </>
  );
}

// ─── faq ───────────────────────────────────────────────────────────────────────────────────────

function FaqForm({ base }: { base: string }) {
  const { locale } = useEditor();
  const { f, cards, e } = useText();
  type Item = SectionOf<'faq'>['data']['items'][number];
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} />
      </PanelCard>
      <PanelCard title={cards.items}>
        <ListEditor<Item>
          path={`${base}.items`}
          idBase="q"
          addLabel={e.list.add}
          summary={(item) => item.q[locale]?.trim() ?? ''}
          create={(ids) => ({ id: uniqueId('q', ids), q: {}, a: {} })}
          render={(_item, _i, p) => (
            <>
              <L10nField path={`${p}.q`} label={f.faq.q} />
              <L10nField path={`${p}.a`} label={f.faq.a} multiline rows={3} />
            </>
          )}
        />
      </PanelCard>
    </>
  );
}

// ─── gallery ───────────────────────────────────────────────────────────────────────────────────

function GalleryForm({ base, section }: { base: string; section: SectionOf<'gallery'> }) {
  const { apply, update, assetUrl, locale } = useEditor();
  const { f, cards, e } = useText();
  const g = f.gallery;
  const { run, progress, error } = useUploader();
  type Image = SectionOf<'gallery'>['data']['images'][number];
  const add = async (files: File[]) => {
    for (const file of files) {
      const res = await run(file);
      if (res?.kind !== 'image') continue;
      apply((d) => {
        const images = getAt(d, `${base}.images`) as Image[];
        const img: Image = {
          id: uniqueId(
            'img',
            images.map((i) => i.id),
          ),
          src: res.ref,
          alt: {},
        };
        return insertAt(d, `${base}.images`, img);
      }, null);
    }
  };
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} nullable />
        <SegmentedField
          label={g.layout}
          value={section.data.layout}
          onValueChange={(v) => update(`${base}.layout`, v, null)}
          options={[
            { value: 'carousel', label: g.layouts.carousel },
            { value: 'grid', label: g.layouts.grid },
          ]}
        />
      </PanelCard>
      <PanelCard title={cards.items}>
        <ListEditor<Image>
          path={`${base}.images`}
          idBase="img"
          addLabel={e.list.add}
          hideAdd
          summary={(img) => (
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-8 shrink-0 overflow-hidden rounded-[6px] bg-subtle">
                {assetUrl(img.src) ? (
                  <img src={assetUrl(img.src)!} alt="" className="size-full object-cover" />
                ) : null}
              </span>
              <span className="truncate">{img.alt[locale]?.trim() || e.list.untitled}</span>
            </span>
          )}
          create={() => {
            throw new Error('gallery items come from uploads');
          }}
          render={(_img, _i, p) => <L10nField path={`${p}.alt`} label={g.alt} help={g.altHelp} />}
        />
        <UploadTile
          label={g.add}
          accept={IMAGE_TYPES}
          multiple
          onFiles={(fs) => void add(fs)}
          progress={progress}
          className="h-16"
        />
        {error ? (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        ) : null}
      </PanelCard>
    </>
  );
}

// ─── gifts ─────────────────────────────────────────────────────────────────────────────────────

function GiftsForm({ base }: { base: string }) {
  const { locale } = useEditor();
  const { f, cards, e } = useText();
  const g = f.gifts;
  type Link = SectionOf<'gifts'>['data']['links'][number];
  const kinds = Object.keys(g.kinds) as Link['kind'][];
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} />
        <L10nField path={`${base}.body`} label={f.body} cap={CAPS.body} multiline rows={3} />
      </PanelCard>
      <PanelCard title={cards.items}>
        <ListEditor<Link>
          path={`${base}.links`}
          idBase="gift"
          addLabel={e.list.add}
          summary={(link) => link.label[locale]?.trim() || g.kinds[link.kind]}
          create={(ids) => ({ id: uniqueId('gift', ids), kind: 'bit', label: {}, url: null, details: null })}
          render={(_link, _i, p) => (
            <>
              <SelectField<Link['kind']>
                path={`${p}.kind`}
                label={g.kind}
                options={kinds.map((k) => ({ value: k, label: g.kinds[k] }))}
              />
              <L10nField path={`${p}.label`} label={g.label} cap={CAPS.title} />
              <TextField
                path={`${p}.url`}
                label={g.url}
                help={f.urlHelp}
                dir="ltr"
                type="url"
                inputMode="url"
                toValue={(s) => (s.trim() ? s.trim() : null)}
              />
              <L10nField
                path={`${p}.details`}
                label={g.details}
                help={g.detailsHelp}
                multiline
                rows={2}
                nullable
              />
            </>
          )}
        />
      </PanelCard>
    </>
  );
}

// ─── reveal ────────────────────────────────────────────────────────────────────────────────────

function RevealForm({ base, section }: { base: string; section: SectionOf<'reveal'> }) {
  const { update } = useEditor();
  const { f, cards } = useText();
  const r = f.reveal;
  return (
    <PanelCard title={cards.texts}>
      <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} />
      <SegmentedField
        label={r.mechanic}
        value={section.data.mechanic}
        onValueChange={(v) => update(`${base}.mechanic`, v, null)}
        options={(['scratch', 'tap', 'spin'] as const).map((m) => ({ value: m, label: r.mechanics[m] }))}
      />
      <L10nField path={`${base}.prompt`} label={r.prompt} />
      <BoolField path={`${base}.showCalendarButton`} label={r.calendar} />
    </PanelCard>
  );
}

// ─── rsvp ──────────────────────────────────────────────────────────────────────────────────────

function RsvpForm({ base, section }: { base: string; section: SectionOf<'rsvp'> }) {
  const { update, locale, apply } = useEditor();
  const { f, cards, ui } = useText();
  const r = f.rsvp;
  const d = section.data;
  type Question = SectionOf<'rsvp'>['data']['customQuestions'][number];
  type Option = NonNullable<Question['options']>[number];
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} />
        <L10nField path={`${base}.subtitle`} label={f.subtitle} cap={CAPS.subtitle} nullable />
        <DateField
          path="event.rsvpDeadline"
          label={f.event.rsvpDeadline}
          help={f.event.noDeadline}
          nullable
        />
      </PanelCard>
      <PanelCard title={cards.options}>
        <SelectField
          path={`${base}.maxAdults`}
          label={r.maxAdults}
          options={range(1, 10).map((n) => ({ value: n, label: n }))}
          toValue={Number}
        />
        <BoolField path={`${base}.askChildren`} label={r.askChildren} />
        {d.askChildren ? (
          <SelectField
            path={`${base}.maxChildren`}
            label={r.maxChildren}
            options={range(0, 10).map((n) => ({ value: n, label: n }))}
            toValue={Number}
          />
        ) : null}
        <BoolField path={`${base}.perAttendeeDetails`} label={r.perAttendee} help={r.perAttendeeHelp} />
        <BoolField path={`${base}.requirePhone`} label={r.requirePhone} />
        <BoolField path={`${base}.requireEmail`} label={r.requireEmail} />
      </PanelCard>
      <PanelCard title={cards.dietary}>
        <BoolField path={`${base}.dietary.enabled`} label={r.dietaryEnabled} />
        {d.dietary.enabled ? (
          <>
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">{r.dietaryOptions}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DIETARY_KEYS.map((key) => {
                  const on = d.dietary.options.includes(key);
                  return (
                    <Checkbox
                      key={key}
                      checked={on}
                      label={invitationText(ui, `diet.${key}` as Parameters<typeof invitationText>[1])}
                      onCheckedChange={(checked) =>
                        update(
                          `${base}.dietary.options`,
                          checked
                            ? DIETARY_KEYS.filter((k) => k === key || d.dietary.options.includes(k))
                            : d.dietary.options.filter((k) => k !== key),
                          null,
                        )
                      }
                    />
                  );
                })}
              </div>
            </fieldset>
            <L10nField path={`${base}.dietary.note`} label={r.dietaryNote} nullable />
          </>
        ) : null}
      </PanelCard>
      <PanelCard title={cards.questions}>
        <ListEditor<Question>
          path={`${base}.customQuestions`}
          idBase="question"
          addLabel={r.addQuestion}
          summary={(q) => q.label[locale]?.trim() ?? ''}
          create={(ids) => ({ id: uniqueId('question', ids), type: 'text', required: false, label: {} })}
          render={(q, _i, p) => (
            <>
              <L10nField path={`${p}.label`} label={r.questionLabel} />
              <Field label={r.questionType}>
                <Select
                  value={q.type}
                  onChange={(ev) => {
                    const type = ev.target.value as Question['type'];
                    apply((doc) => {
                      const current = getAt(doc, p) as Question;
                      const next: Question =
                        type === 'select'
                          ? {
                              ...current,
                              type,
                              options: current.options?.length
                                ? current.options
                                : [{ value: 'option-1', label: {} }],
                            }
                          : { id: current.id, type, required: current.required, label: current.label };
                      return setAt(doc, p, next);
                    }, null);
                  }}
                >
                  {(['text', 'select', 'boolean'] as const).map((tp) => (
                    <option key={tp} value={tp}>
                      {r.questionTypes[tp]}
                    </option>
                  ))}
                </Select>
              </Field>
              <BoolField path={`${p}.required`} label={r.questionRequired} />
              {q.type === 'select' ? (
                <fieldset>
                  <legend className="mb-2 text-[13px] font-semibold">{r.options}</legend>
                  <ListEditor<Option & { id: string }>
                    path={`${p}.options`}
                    idBase="option"
                    min={1}
                    addLabel={r.addOption}
                    summary={(o, n) => o.label[locale]?.trim() || fmt(r.option, { n: n + 1 })}
                    create={(ids) => {
                      const value = uniqueId('option', [...ids, ...(q.options ?? []).map((o) => o.value)]);
                      return { id: value, value, label: {} } as Option & { id: string };
                    }}
                    render={(_o, n, op) => (
                      <L10nField path={`${op}.label`} label={fmt(r.option, { n: n + 1 })} />
                    )}
                  />
                </fieldset>
              ) : null}
            </>
          )}
        />
      </PanelCard>
      <PanelCard title={cards.messages}>
        <L10nField path={`${base}.messageLabel`} label={r.messageLabel} help={r.messageHelp} nullable />
        <L10nField path={`${base}.successMessage`} label={r.successMessage} multiline rows={2} />
        <L10nField path={`${base}.declineMessage`} label={r.declineMessage} multiline rows={2} />
        <L10nField path={`${base}.closedMessage`} label={r.closedMessage} multiline rows={2} />
      </PanelCard>
    </>
  );
}

// ─── footer ────────────────────────────────────────────────────────────────────────────────────

function FooterForm({ base }: { base: string }) {
  const { f, cards } = useText();
  const ft = f.footer;
  return (
    <PanelCard title={cards.display}>
      <BoolField path={`${base}.showHosts`} label={ft.showHosts} />
      <BoolField path={`${base}.showDate`} label={ft.showDate} />
      <BoolField path={`${base}.showParents`} label={ft.showParents} help={f.hosts.parentsHelp} />
      <L10nField path={`${base}.closingLine`} label={ft.closingLine} nullable />
      <BoolField path={`${base}.showCredit`} label={ft.showCredit} />
    </PanelCard>
  );
}

export function ReviewTextsNote() {
  const { e } = useText();
  return (
    <Card padding="sm" tone="info" className="mt-4">
      <div className="flex items-start gap-3">
        <Info aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-[#1d4ed8]" />
        <p className="flex-1 text-[12px] text-[#1e3a8a]">{e.reviewTexts}</p>
      </div>
    </Card>
  );
}
