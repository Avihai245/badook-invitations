'use client';

import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, Drawer, Field, Input, Segmented, Select, Textarea } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { amountText, itemAmount, itemVariance, parseAmount, STAGES } from '../../model/budget-view';
import type { ItemStatus } from '../../model/categories';
import type { Attachment, PlanItem } from '../../model/plan';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { AttachmentsField } from './AttachmentsField';
import { Fill } from './Fill';
import { MoneyField } from './MoneyField';
import { draftsFromRows, rowsFromPayments, ScheduleEditor, type ScheduleRow } from './ScheduleEditor';
import { useBudget, type ItemDraft } from './useBudget';

type Vat = 'follow' | 'included' | 'excluded';
const vatOf = (v: boolean | null): Vat => (v === null ? 'follow' : v ? 'included' : 'excluded');
const vatValue = (v: Vat): boolean | null => (v === 'follow' ? null : v === 'included');

/**
 * An item (an expense) in a side drawer: what it is, its category and vendor, the three amounts, where it stands
 * (estimate → quote → closed → paid), VAT, notes, files (Pro) and its payment schedule. Saving closes it at once;
 * the change is already on the screen and is put back, with a note, only if the server refuses.
 */
export function ItemDrawer({
  open,
  onOpenChange,
  itemId,
  categoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null: a new expense */
  itemId: string | null;
  /** where a new expense starts */
  categoryId: string | null;
}) {
  const { t } = useUi();
  const T = t.planning.budget;
  const { view } = usePlan();
  const { deleteItem } = useBudget();
  const formId = useId();
  const item = itemId ? (view.items.find((i) => i.id === itemId) ?? null) : null;
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={item ? T.item.titleEdit : T.item.titleNew}
      description={T.item.description}
      closeLabel={t.planning.common.close}
      footer={
        <>
          {item ? (
            <Button
              variant="ghost"
              icon={<Trash2 />}
              className="me-auto text-danger hover:text-danger"
              onClick={() => {
                void deleteItem(item);
                onOpenChange(false);
              }}
            >
              {T.item.delete}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.planning.common.cancel}
          </Button>
          <Button type="submit" form={formId}>
            {item ? t.planning.common.save : T.item.create}
          </Button>
        </>
      }
    >
      {/* a form that starts over each time the drawer opens (its content is only there while it is open) */}
      {itemId !== null && item === null ? null : (
        <ItemForm
          key={item?.id ?? `new-${categoryId ?? ''}`}
          formId={formId}
          item={item}
          categoryId={categoryId}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Drawer>
  );
}

function ItemForm({
  formId,
  item,
  categoryId,
  onDone,
}: {
  formId: string;
  item: PlanItem | null;
  categoryId: string | null;
  onDone: () => void;
}) {
  const { t } = useUi();
  const T = t.planning.budget;
  const I = T.item;
  const { view } = usePlan();
  const { saveItem } = useBudget();
  const vatMode = view.settings?.vatMode ?? 'included';
  const vatPct = view.settings?.vatPct ?? 18;
  const payments = item ? view.payments.filter((p) => p.itemId === item.id) : [];

  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState(item?.categoryId ?? categoryId ?? view.categories[0]?.id ?? '');
  const [vendor, setVendor] = useState(item?.vendorId ?? '');
  const [estimate, setEstimate] = useState(amountText(item?.estimate));
  const [quoted, setQuoted] = useState(amountText(item?.quoted));
  const [final, setFinal] = useState(amountText(item?.final));
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? 'estimate');
  const [vat, setVat] = useState<Vat>(vatOf(item?.vatIncluded ?? null));
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [files, setFiles] = useState<Attachment[]>(item?.attachments ?? []);
  const [rows, setRows] = useState<ScheduleRow[]>(() => rowsFromPayments(payments));
  const [initialDrafts] = useState(() => JSON.stringify(draftsFromRows(rowsFromPayments(payments)).drafts));
  const [tried, setTried] = useState(false);

  const est = parseAmount(estimate);
  const quo = parseAmount(quoted);
  const fin = parseAmount(final);
  const amounts = {
    estimate: typeof est === 'number' ? est : null,
    quoted: typeof quo === 'number' ? quo : null,
    final: typeof fin === 'number' ? fin : null,
    vatIncluded: vatValue(vat),
  };
  const total = itemAmount(amounts, vatMode, vatPct);
  const variance = itemVariance(amounts, vatMode, vatPct);

  const pickStatus = (next: ItemStatus) => {
    setStatus(next);
    // "paid" means every payment of the schedule is
    if (next === 'paid' && rows.length > 0)
      setRows(rows.map((r) => (r.paid ? r : { ...r, paid: true, paidAt: new Date().toISOString() })));
  };

  const submit = () => {
    setTried(true);
    const { drafts, bad } = draftsFromRows(rows);
    if (
      !title.trim() ||
      !category ||
      est === undefined ||
      quo === undefined ||
      fin === undefined ||
      bad.size > 0
    )
      return;
    const scheduleChanged = JSON.stringify(drafts) !== initialDrafts;
    const filesChanged = JSON.stringify(files) !== JSON.stringify(item?.attachments ?? []);
    const draft: ItemDraft = {
      ...(item ? { id: item.id } : {}),
      categoryId: category,
      vendorId: vendor || null,
      title: title.trim(),
      estimate: est,
      quoted: quo,
      final: fin,
      status,
      vatIncluded: vatValue(vat),
      notes: notes.trim() ? notes.trim() : null,
      ...(filesChanged && view.features.export ? { attachments: files } : {}),
    };
    void saveItem(draft, scheduleChanged ? drafts : undefined);
    onDone();
  };

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      <Field label={I.name} error={tried && !title.trim() ? I.nameMissing : undefined}>
        <Input
          value={title}
          maxLength={120}
          placeholder={I.namePlaceholder}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!item}
        />
      </Field>
      <div className={view.vendors.length > 0 ? 'grid grid-cols-2 gap-3' : ''}>
        <Field label={I.category}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {view.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? (c.key ? t.planning.categories[c.key] : '')}
              </option>
            ))}
          </Select>
        </Field>
        {view.vendors.length > 0 ? (
          <Field label={I.vendor}>
            <Select value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">{I.noVendor}</option>
              {view.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <section aria-label={I.amounts} className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold">{I.amounts}</h3>
        <div className="grid grid-cols-3 gap-3 max-[420px]:grid-cols-1">
          <MoneyField
            label={I.estimate}
            value={estimate}
            onChange={setEstimate}
            error={tried && est === undefined ? I.invalidAmount : undefined}
          />
          <MoneyField
            label={I.quoted}
            value={quoted}
            onChange={setQuoted}
            error={tried && quo === undefined ? I.invalidAmount : undefined}
          />
          <MoneyField
            label={I.final}
            value={final}
            onChange={setFinal}
            error={tried && fin === undefined ? I.invalidAmount : undefined}
          />
        </div>
        <p className="text-[12.5px] text-muted">{I.amountsHelp}</p>
        {variance && variance.delta !== 0 ? (
          <p
            className={variance.delta > 0 ? 'text-[13px] text-warning' : 'text-[13px] text-success'}
            role="status"
          >
            <Fill
              text={variance.delta > 0 ? I.variance.over : I.variance.under}
              vars={{ amount: <Money value={Math.abs(variance.delta)} className="font-semibold" /> }}
            />
          </p>
        ) : null}
      </section>

      <Field label={I.stage}>
        <Segmented<ItemStatus>
          label={I.stage}
          value={status}
          onValueChange={pickStatus}
          options={STAGES.map((s) => ({ value: s, label: T.status[s] }))}
          fullWidth
        />
      </Field>

      {vatMode !== 'none' ? (
        <Field label={T.vat.item.label}>
          <Select value={vat} onChange={(e) => setVat(e.target.value as Vat)}>
            <option value="follow">{T.vat.item.follows}</option>
            <option value="included">{T.vat.item.included}</option>
            <option value="excluded">{T.vat.item.excluded}</option>
          </Select>
        </Field>
      ) : null}

      <section aria-label={T.schedule.title} className="flex flex-col gap-3 border-t border-line pt-5">
        <div>
          <h3 className="text-[13px] font-semibold">{T.schedule.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">{T.schedule.help}</p>
        </div>
        <ScheduleEditor rows={rows} onChange={setRows} total={total} tried={tried} />
      </section>

      <Field label={I.notes}>
        <Textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <section aria-label={T.files.title} className="flex flex-col gap-2.5 border-t border-line pt-5">
        <h3 className="text-[13px] font-semibold">{T.files.title}</h3>
        <AttachmentsField files={files} onChange={setFiles} />
      </section>
    </form>
  );
}
