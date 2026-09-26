'use client';

import { useUi } from '@/lib/i18n/client';
import type { SectionOf } from '../../contracts/types';
import { CAPS } from '../../contracts/validate';
import { BoolField, L10nField, PanelCard, SwitchRow, TextField } from '../fields/fields';
import { ListEditor } from '../fields/ListEditor';
import { uniqueId } from '../paths';
import { useEditor } from '../state/EditorProvider';

/**
 * The content of the schema-v2 section types (parents · when · where · quote · custom). Their
 * picture / video, layout, motion and colors are edited in the cinematic panel, not here.
 */
export function V2SectionForm({
  section,
  base,
}: {
  section: SectionOf<'parents' | 'when' | 'where' | 'quote' | 'custom'>;
  base: string;
}) {
  switch (section.type) {
    case 'parents':
      return <ParentsForm base={base} />;
    case 'when':
      return <WhenForm base={base} />;
    case 'where':
      return <WhereForm base={base} />;
    case 'quote':
      return <QuoteForm base={base} />;
    case 'custom':
      return <CustomForm base={base} section={section} />;
  }
}

function useText() {
  const { t } = useUi();
  const e = t.editor;
  return { e, f: e.f, cards: e.cards, labels: e.fieldLabels, v2: e.v2Forms };
}

function ParentsForm({ base }: { base: string }) {
  const { locale } = useEditor();
  const { e, f, cards, labels, v2 } = useText();
  type Item = SectionOf<'parents'>['data']['items'][number];
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} nullable />
        <L10nField path={`${base}.note`} label={labels['parents.note']} cap={CAPS.note} nullable />
      </PanelCard>
      <PanelCard title={cards.items}>
        <p className="text-[12px] text-muted">{v2.parentsHelp}</p>
        <ListEditor<Item>
          path={`${base}.items`}
          idBase="p"
          addLabel={e.list.add}
          summary={(item) => item.names[locale]?.trim() || item.label[locale]?.trim() || ''}
          create={(ids) => ({ id: uniqueId('p', ids), label: {}, names: {} })}
          render={(_item, _i, p) => (
            <>
              <L10nField path={`${p}.label`} label={labels['parents.label']} cap={CAPS.title} />
              <L10nField path={`${p}.names`} label={labels['parents.names']} cap={CAPS.parentsNames} />
            </>
          )}
        />
      </PanelCard>
    </>
  );
}

function WhenForm({ base }: { base: string }) {
  const { f, cards, labels, v2 } = useText();
  return (
    <PanelCard title={cards.display}>
      <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} nullable />
      <BoolField path={`${base}.showWeekday`} label={v2.showWeekday} />
      <BoolField path={`${base}.showHebrewDate`} label={v2.showHebrewDate} />
      <BoolField path={`${base}.showTime`} label={v2.showTime} />
      <BoolField path={`${base}.countdown`} label={v2.countdown} />
      <BoolField path={`${base}.showCalendar`} label={v2.showCalendar} />
      <L10nField path={`${base}.note`} label={labels['when.note']} cap={CAPS.note} nullable />
    </PanelCard>
  );
}

function WhereForm({ base }: { base: string }) {
  const { f, cards, labels } = useText();
  const v = f.venue;
  const p = `${base}.venue`;
  return (
    <PanelCard title={cards.texts}>
      <L10nField path={`${p}.label`} label={v.label} cap={CAPS.title} />
      <L10nField path={`${p}.name`} label={v.name} />
      <L10nField path={`${p}.address`} label={v.address} />
      <TextField
        path={`${p}.mapsQuery`}
        label={v.mapsQuery}
        help={v.mapsQueryHelp}
        toValue={(s) => (s.trim() ? s : null)}
      />
      <BoolField path={`${p}.showMap`} label={v.showMap} />
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1.5 text-[13px] font-semibold">{v.buttons}</legend>
        <BoolField path={`${p}.buttons.maps`} label={v.maps} />
        <BoolField path={`${p}.buttons.waze`} label={v.waze} />
        <BoolField path={`${p}.buttons.calendar`} label={v.calendar} />
      </fieldset>
      <L10nField path={`${base}.note`} label={labels['where.note']} cap={CAPS.note} nullable />
    </PanelCard>
  );
}

function QuoteForm({ base }: { base: string }) {
  const { cards, labels } = useText();
  return (
    <PanelCard title={cards.texts}>
      <L10nField path={`${base}.text`} label={labels['quote.text']} cap={CAPS.quote} multiline rows={4} />
      <L10nField
        path={`${base}.attribution`}
        label={labels['quote.attribution']}
        cap={CAPS.subtitle}
        nullable
      />
    </PanelCard>
  );
}

function CustomForm({ base, section }: { base: string; section: SectionOf<'custom'> }) {
  const { update } = useEditor();
  const { f, cards } = useText();
  const cta = section.data.cta;
  return (
    <>
      <PanelCard title={cards.texts}>
        <L10nField path={`${base}.title`} label={f.title} cap={CAPS.title} nullable />
        <L10nField path={`${base}.subtitle`} label={f.subtitle} cap={CAPS.subtitle} nullable />
        <L10nField path={`${base}.body`} label={f.body} cap={CAPS.body} multiline rows={6} />
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
              accept={(s) => s.trim().length > 0}
              invalidText={f.urlRequired}
            />
          </>
        ) : null}
      </PanelCard>
    </>
  );
}
