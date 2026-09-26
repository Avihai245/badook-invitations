'use client';

import { Check, Copy, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Dialog, Segmented, Textarea, type BadgeVariant } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { RTL_LOCALES, type L10n, type Locale } from '../contracts/types';
import {
  sourceLocaleOf,
  textFields,
  translationState,
  type TextField,
  type TranslationState,
} from '../translate/fields';
import { sectionName } from './fields/fields';
import { useEditor } from './state/EditorProvider';
import { useTranslations } from './translations';

type ItemState = Exclude<TranslationState, 'gone'> | 'missing' | 'name';

const STATE_BADGE: Record<ItemState, BadgeVariant> = {
  machine: 'warning',
  stale: 'warning',
  missing: 'danger',
  name: 'danger',
  approved: 'live',
  own: 'neutral',
};
const TO_REVIEW: ReadonlySet<ItemState> = new Set(['machine', 'stale', 'missing', 'name']);

interface Item {
  field: TextField;
  from: Locale;
  state: ItemState;
}

const dirOf = (l: Locale) => (RTL_LOCALES.includes(l) ? 'rtl' : 'ltr');

/**
 * The side-by-side translation of one language (§ seven languages): each text of the invitation with
 * its original next to it — the machine's translations to approve (one, or all), the ones whose
 * original changed since, the missing ones, and the names the host writes. Typing here changes the
 * draft like the field itself (the host's own words count as approved); without the machine
 * translation this is where hosts translate by hand.
 */
export function TranslationReview({
  locale,
  onLocale,
  onClose,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  onClose: () => void;
}) {
  const { doc, update } = useEditor();
  const tr = useTranslations()!;
  const { t, plural, number, locale: ui } = useUi();
  const e = t.editor;
  const r = e.translations;
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [working, setWorking] = useState<string | null>(null);
  const language = e.languageIn[locale];

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const field of textFields(doc)) {
      const from = sourceLocaleOf(doc, field.value, locale);
      if (!from) continue;
      const text = (field.value[locale] ?? '').trim();
      const row = tr.rows.find((x) => x.locale === locale && x.path === field.path);
      const state: ItemState = !text
        ? field.name
          ? 'name'
          : 'missing'
        : row
          ? (translationState(doc, row) as Exclude<TranslationState, 'gone'>)
          : 'own';
      out.push({ field, from, state });
    }
    return out;
  }, [doc, locale, tr.rows]);

  const shown = filter === 'all' ? items : items.filter((i) => TO_REVIEW.has(i.state));
  const toApprove = items
    .filter((i) => i.state === 'machine' || i.state === 'stale')
    .map((i) => i.field.path);
  const missing = items.filter((i) => i.state === 'missing').map((i) => i.field.path);
  const others = doc.locales.filter((l) => l !== doc.defaultLocale || doc.locales.length === 1);
  const targets = others.includes(locale) ? others : [locale, ...others];

  const write = (field: TextField, text: string) =>
    update(field.docPath, { ...field.value, [locale]: text } satisfies L10n, `${field.docPath}.${locale}`);

  const run = async (key: string, task: () => Promise<void>) => {
    setWorking(key);
    try {
      await task();
    } finally {
      setWorking(null);
    }
  };

  const label = (field: TextField) => {
    const name = e.fieldLabels[field.field] ?? field.field;
    return field.section ? `${sectionName(field.section, e, ui)} · ${name}` : name;
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(r.title, { language })}
      description={r.description}
      closeLabel={t.common.close}
      className="max-w-[1040px]!"
      footer={
        <>
          {tr.available && missing.length ? (
            <Button
              variant="secondary"
              icon={tr.busy === locale ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              disabled={!!tr.busy}
              onClick={() => void tr.translate(locale)}
            >
              {tr.busy === locale ? fmt(e.f.languages.translating, { language }) : r.translateMissing}
            </Button>
          ) : null}
          {toApprove.length ? (
            <Button
              icon={<Check />}
              disabled={working !== null}
              onClick={() => void run('all', () => tr.approve(locale, toApprove))}
              data-testid="approve-all"
            >
              {plural(r.approveAll, toApprove.length, { n: number(toApprove.length) })}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              {t.common.close}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="translation-review">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {targets.length > 1 ? (
            <Segmented<Locale>
              label={r.language}
              value={locale}
              onValueChange={onLocale}
              options={targets.map((l) => ({
                value: l,
                label: e.languageShort[l],
                ariaLabel: e.languageFull[l],
              }))}
            />
          ) : (
            <span />
          )}
          <Segmented<'pending' | 'all'>
            label={r.filterLabel}
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'pending', label: r.filter.pending },
              { value: 'all', label: r.filter.all },
            ]}
          />
        </div>

        {shown.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {shown.map(({ field, from, state }) => {
              const text = field.value[locale] ?? '';
              const source = field.value[from] ?? '';
              return (
                <li key={field.path} className="flex flex-col gap-2 p-3" data-translation={field.path}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-muted">{label(field)}</span>
                    <Badge variant={STATE_BADGE[state]}>{r.state[state]}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div
                      lang={from}
                      dir={dirOf(from)}
                      className="rounded-btn bg-subtle px-3 py-2 text-[14px] leading-relaxed whitespace-pre-line text-ink"
                      aria-label={fmt(r.source, { language: e.languageIn[from] })}
                    >
                      {source}
                    </div>
                    <Textarea
                      value={text}
                      onChange={(ev) => write(field, ev.target.value)}
                      lang={locale}
                      dir={dirOf(locale)}
                      textAlign="start"
                      rows={Math.min(8, Math.max(1, Math.ceil(Math.max(source.length, text.length) / 48)))}
                      className="min-h-[42px]!"
                      aria-label={`${label(field)} · ${e.languageFull[locale]}`}
                      maxLength={field.cap ? field.cap * 2 : 2000}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {state === 'name' ? (
                      <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => write(field, source)}>
                        {r.copySource}
                      </Button>
                    ) : null}
                    {state === 'stale' && tr.available ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<RefreshCw />}
                        disabled={!!tr.busy}
                        onClick={() => void tr.translate(locale, [field.path])}
                      >
                        {r.again}
                      </Button>
                    ) : null}
                    {state === 'machine' || state === 'stale' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Check />}
                        disabled={working !== null}
                        onClick={() => void run(field.path, () => tr.approve(locale, [field.path]))}
                      >
                        {r.approve}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-card bg-subtle px-4 py-6 text-center text-[14px] text-muted">
            {fmt(r.empty, { language })}
          </p>
        )}
        {items.some((i) => i.field.name) ? (
          <p className="text-[12.5px] text-muted">{fmt(r.namesHelp, { language })}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
