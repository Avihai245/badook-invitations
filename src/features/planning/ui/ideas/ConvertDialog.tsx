'use client';

import { useState } from 'react';
import { Button, Dialog, Field, Input, Select } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_KEYS } from '../../model/categories';
import type { PlanIdea } from '../../model/plan';
import type { ConvertKind } from '../../model/schemas-ideas';
import { usePlan } from '../PlanProvider';
import { suggestName, suggestNotes } from './model';
import type { ConvertData, IdeasApi } from './useIdeas';

/** "1,500", "1500.5", "₪ 1500" → 1500 / 1500.5; empty → null; anything else → NaN. */
function parseAmount(text: string): number | null {
  const t = text.replace(/[₪\s,]/g, '');
  if (!t) return null;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : Number.NaN;
}

/**
 * The tiny dialog that turns a card into a task (title, optional date), a vendor (name, category) or a
 * budget line (category, name, estimate). The card's own words come along as the name and the notes; the
 * card keeps a link to what it became.
 */
export function ConvertDialog({
  idea,
  kind,
  onClose,
  api,
}: {
  idea: PlanIdea;
  kind: ConvertKind;
  onClose(): void;
  api: IdeasApi;
}) {
  const { t } = useUi();
  const { view } = usePlan();
  const T = t.planning.ideas;
  const C = T.convert[kind];
  const max = kind === 'task' ? 200 : 120;
  const [name, setName] = useState(() => suggestName(idea, max));
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState(view.categories[0]?.id ?? '');
  const [estimate, setEstimate] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const amount = parseAmount(estimate);
  const amountBad = kind === 'item' && Number.isNaN(amount);
  const nameBad = touched && !name.trim();

  const submit = async () => {
    setTouched(true);
    if (!name.trim() || amountBad || (kind === 'item' && !categoryId)) return;
    const title = name.trim();
    const data: ConvertData =
      kind === 'task'
        ? { title, dueDate: date || null, notes: suggestNotes(idea, 2000) || null }
        : kind === 'vendor'
          ? {
              name: title,
              category: category || null,
              url: idea.url && idea.url.length <= 500 ? idea.url : null,
              notes: suggestNotes({ ...idea, url: null }, 2000) || null,
            }
          : { title, categoryId, estimate: amount };
    setSaving(true);
    const ok = await api.convert(idea, kind, data);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={C.title}
      description={C.body}
      closeLabel={t.planning.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.planning.common.cancel}
          </Button>
          <Button type="submit" form="idea-convert" loading={saving}>
            {C.submit}
          </Button>
        </>
      }
    >
      <form
        id="idea-convert"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {kind === 'item' ? (
          <Field label={T.convert.item.category}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {view.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? (c.key ? t.planning.categories[c.key] : '')}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field
          label={
            kind === 'task'
              ? T.convert.task.name
              : kind === 'vendor'
                ? T.convert.vendor.name
                : T.convert.item.name
          }
          error={nameBad ? T.convert.nameRequired : undefined}
        >
          <Input value={name} maxLength={max} autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>

        {kind === 'task' ? (
          <Field label={T.convert.task.date} help={T.convert.task.dateHint}>
            <Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        ) : null}

        {kind === 'vendor' ? (
          <Field label={T.convert.vendor.category}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{T.convert.vendor.noCategory}</option>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t.planning.categories[key]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {kind === 'item' ? (
          <Field
            label={T.convert.item.estimate}
            help={T.convert.item.estimateHint}
            error={amountBad ? T.convert.item.estimateInvalid : undefined}
          >
            <Input
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="0"
            />
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}
