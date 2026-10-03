'use client';

import { useCallback, useRef } from 'react';
import { useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { statusFromPayments } from '../../model/budget-view';
import type { CostBasis, ItemStatus } from '../../model/categories';
import type {
  Attachment,
  PlanCategory,
  PlanItem,
  PlanPayment,
  PlanSettings,
  PlanView,
} from '../../model/plan';
import { usePlan } from '../PlanProvider';

/** What the host can change on a category (a new one needs a key or a name). */
export interface CategoryDraft {
  id?: string;
  key?: PlanCategory['key'];
  name?: string | null;
  plannedAmount?: number;
  costBasis?: CostBasis;
  unitPrice?: number | null;
  childPrice?: number | null;
  required?: boolean;
}

/** An item as the drawer saves it. */
export interface ItemDraft {
  id?: string;
  categoryId: string;
  vendorId: string | null;
  title: string;
  estimate: number | null;
  quoted: number | null;
  final: number | null;
  status: ItemStatus;
  vatIncluded: boolean | null;
  notes: string | null;
  /** only sent when the host changed the files (and the package has them) */
  attachments?: Attachment[];
}

/** A payment of an item's schedule. */
export interface PaymentDraft {
  id?: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  payOnEventDay: boolean;
  payer: string | null;
}

type Fail = { code?: string; feature?: string };

/** The budget screen's writes: change the view at once, ask the server, put it back (and say so) when it refuses. */
export function useBudget() {
  const plan = usePlan();
  const { toast } = useToast();
  const { t, fmt } = useUi();
  const T = t.planning.budget;
  // writes in flight: the plan is read again (the totals are the database's) when the last one lands
  const inflight = useRef(0);

  const send = useCallback(
    async <R extends object>(path: string, body: unknown) => {
      inflight.current += 1;
      try {
        return await plan.call<R & Fail>(path, body);
      } finally {
        inflight.current -= 1;
      }
    },
    [plan],
  );
  const settled = useCallback(() => {
    if (inflight.current === 0) void plan.refresh();
  }, [plan]);

  const complain = useCallback(
    (res: { status: number; body: Fail | null }) => {
      const code = res.body?.code;
      toast({
        variant: 'danger',
        title:
          code === 'duplicate'
            ? T.errors.duplicate
            : code === 'too_many'
              ? T.errors.tooMany
              : code === 'feature_off'
                ? T.errors.locked
                : t.planning.common.failed,
      });
    },
    [T, t, toast],
  );

  // ── categories ──────────────────────────────────────────────────────────────────────────────
  const saveCategory = useCallback(
    async (draft: CategoryDraft): Promise<PlanCategory | null> => {
      const id = draft.id ?? crypto.randomUUID();
      const before = plan.view.categories;
      const old = before.find((c) => c.id === id);
      const next: PlanCategory = {
        id,
        key: old?.key ?? null,
        name: old?.name ?? null,
        plannedAmount: old?.plannedAmount ?? 0,
        costBasis: old?.costBasis ?? 'fixed',
        unitPrice: old?.unitPrice ?? null,
        childPrice: old?.childPrice ?? null,
        required: old?.required ?? false,
        sort: old?.sort ?? Math.max(0, ...before.map((c) => c.sort)) + 10,
        ...defined(draft),
      };
      plan.patch((v) => ({
        ...v,
        categories: old ? v.categories.map((c) => (c.id === id ? next : c)) : [...v.categories, next],
      }));
      const res = await send<{ category: PlanCategory }>('/budget', {
        op: 'category_save',
        category: { ...draft, id },
      });
      if (!res.ok || !res.body?.category) {
        plan.patch((v) => ({ ...v, categories: before }));
        complain(res);
        return null;
      }
      const saved = res.body.category;
      plan.patch((v) => ({ ...v, categories: v.categories.map((c) => (c.id === id ? saved : c)) }));
      settled();
      return saved;
    },
    [plan, send, settled, complain],
  );

  /** Puts a deleted item (with its payments) back, as it was. */
  const restoreItem = useCallback(
    async (item: PlanItem, payments: PlanPayment[]) => {
      const res = await send<{ item: PlanItem; payments: PlanPayment[] }>('/budget', {
        op: 'item_save',
        item: itemBody(item, plan.view.features.export),
        payments: payments.map(paymentBody),
      });
      return res;
    },
    [plan, send],
  );

  const deleteCategory = useCallback(
    async (category: PlanCategory, name: string) => {
      const { categories, items, payments } = plan.view;
      const mine = items.filter((i) => i.categoryId === category.id);
      const mineIds = new Set(mine.map((i) => i.id));
      const myPayments = payments.filter((p) => mineIds.has(p.itemId));
      plan.patch((v) => ({
        ...v,
        categories: v.categories.filter((c) => c.id !== category.id),
        items: v.items.filter((i) => i.categoryId !== category.id),
        payments: v.payments.filter((p) => !mineIds.has(p.itemId)),
      }));
      const res = await send('/budget', { op: 'category_delete', ids: [category.id] });
      if (!res.ok) {
        plan.patch((v) => ({ ...v, categories, items, payments }));
        complain(res);
        return;
      }
      settled();
      toast({
        title: fmt(T.toasts.categoryDeleted, { name }),
        duration: 8000,
        action: {
          label: t.planning.common.undo,
          altText: T.toasts.undoAlt,
          onClick: () => {
            void (async () => {
              plan.patch((v) => ({
                ...v,
                categories: [...v.categories, category],
                items: [...v.items, ...mine],
                payments: [...v.payments, ...myPayments],
              }));
              const back = await send('/budget', {
                op: 'category_save',
                category: {
                  id: category.id,
                  key: category.key,
                  name: category.name,
                  plannedAmount: category.plannedAmount,
                  costBasis: category.costBasis,
                  unitPrice: category.unitPrice,
                  childPrice: category.childPrice,
                  required: category.required,
                  sort: category.sort,
                },
              });
              let failed = !back.ok;
              for (const item of mine) {
                if (failed) break;
                const r = await restoreItem(
                  item,
                  myPayments.filter((p) => p.itemId === item.id),
                );
                failed = !r.ok;
              }
              if (failed) toast({ variant: 'danger', title: t.planning.common.failed });
              void plan.refresh();
            })();
          },
        },
      });
    },
    [plan, send, settled, complain, toast, t, T, fmt, restoreItem],
  );

  // ── items and their payments ────────────────────────────────────────────────────────────────
  const saveItem = useCallback(
    async (
      draft: ItemDraft,
      payments?: PaymentDraft[],
    ): Promise<{ item: PlanItem; payments: PlanPayment[] } | null> => {
      const id = draft.id ?? crypto.randomUUID();
      const { items, payments: allPayments } = plan.view;
      const old = items.find((i) => i.id === id);
      const rows: PlanPayment[] | undefined = payments?.map((p) => ({
        id: p.id ?? crypto.randomUUID(),
        itemId: id,
        label: p.label,
        amount: p.amount,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        payOnEventDay: p.payOnEventDay,
        payer: p.payer,
      }));
      const status = rows ? statusFromPayments(draft.status, rows) : draft.status;
      const next: PlanItem = {
        id,
        categoryId: draft.categoryId,
        vendorId: draft.vendorId,
        title: draft.title,
        estimate: draft.estimate,
        quoted: draft.quoted,
        final: draft.final,
        status,
        vatIncluded: draft.vatIncluded,
        attachments: draft.attachments ?? old?.attachments ?? [],
        notes: draft.notes,
        sort: old?.sort ?? Math.max(0, ...items.map((i) => i.sort)) + 10,
      };
      plan.patch((v) => ({
        ...v,
        items: old ? v.items.map((i) => (i.id === id ? next : i)) : [...v.items, next],
        payments: rows ? [...v.payments.filter((p) => p.itemId !== id), ...rows] : v.payments,
      }));
      const res = await send<{ item: PlanItem; payments: PlanPayment[] }>('/budget', {
        op: 'item_save',
        item: {
          id,
          categoryId: draft.categoryId,
          vendorId: draft.vendorId,
          title: draft.title,
          estimate: draft.estimate,
          quoted: draft.quoted,
          final: draft.final,
          status: draft.status,
          vatIncluded: draft.vatIncluded,
          notes: draft.notes,
          ...(draft.attachments ? { attachments: draft.attachments } : {}),
        },
        ...(payments ? { payments: payments.map((p, n) => paymentBody({ ...p, id: rows![n]!.id })) } : {}),
      });
      if (!res.ok || !res.body?.item) {
        plan.patch((v) => ({ ...v, items, payments: allPayments }));
        complain(res);
        return null;
      }
      const saved = { item: res.body.item, payments: res.body.payments ?? [] };
      plan.patch((v) => ({
        ...v,
        items: v.items.map((i) => (i.id === id ? saved.item : i)),
        payments: payments ? [...v.payments.filter((p) => p.itemId !== id), ...saved.payments] : v.payments,
      }));
      settled();
      return saved;
    },
    [plan, send, settled, complain],
  );

  const deleteItem = useCallback(
    async (item: PlanItem) => {
      const { items, payments } = plan.view;
      const mine = payments.filter((p) => p.itemId === item.id);
      plan.patch((v) => ({
        ...v,
        items: v.items.filter((i) => i.id !== item.id),
        payments: v.payments.filter((p) => p.itemId !== item.id),
      }));
      const res = await send('/budget', { op: 'item_delete', ids: [item.id] });
      if (!res.ok) {
        plan.patch((v) => ({ ...v, items, payments }));
        complain(res);
        return;
      }
      settled();
      toast({
        title: fmt(T.toasts.itemDeleted, { title: item.title }),
        duration: 8000,
        action: {
          label: t.planning.common.undo,
          altText: T.toasts.undoAlt,
          onClick: () => {
            void (async () => {
              plan.patch((v) => ({
                ...v,
                items: [...v.items, item],
                payments: [...v.payments, ...mine],
              }));
              const back = await restoreItem(item, mine);
              if (!back.ok) toast({ variant: 'danger', title: t.planning.common.failed });
              void plan.refresh();
            })();
          },
        },
      });
    },
    [plan, send, settled, complain, toast, t, T, fmt, restoreItem],
  );

  /** Marks a payment paid (or not): its item follows in the same step, on the server too. */
  const markPaid = useCallback(
    async (payment: PlanPayment, paid: boolean) => {
      const { items, payments } = plan.view;
      const at = paid ? (payment.paidAt ?? new Date().toISOString()) : null;
      const after = payments.map((p) => (p.id === payment.id ? { ...p, paidAt: at } : p));
      plan.patch((v) => ({
        ...v,
        payments: after,
        items: v.items.map((i) =>
          i.id === payment.itemId
            ? {
                ...i,
                status: statusFromPayments(
                  i.status,
                  after.filter((p) => p.itemId === i.id),
                ),
              }
            : i,
        ),
      }));
      const res = await send<{ payment: PlanPayment; itemStatus: ItemStatus }>('/budget', {
        op: 'payment_paid',
        id: payment.id,
        paid,
      });
      if (!res.ok || !res.body?.payment) {
        plan.patch((v) => ({ ...v, items, payments }));
        complain(res);
        return false;
      }
      const done = res.body;
      plan.patch((v) => ({
        ...v,
        payments: v.payments.map((p) => (p.id === payment.id ? done.payment : p)),
        items: v.items.map((i) => (i.id === payment.itemId ? { ...i, status: done.itemStatus } : i)),
      }));
      settled();
      return true;
    },
    [plan, send, settled, complain],
  );

  // ── the plan's settings (guest numbers, total, VAT) ─────────────────────────────────────────
  const saveSettings = useCallback(
    async (
      patch: Partial<
        Pick<
          PlanSettings,
          | 'guestBasis'
          | 'manualAdults'
          | 'manualChildren'
          | 'manualTables'
          | 'totalBudget'
          | 'vatMode'
          | 'vatPct'
        >
      > & {
        integrations?: { guests?: boolean; seating?: boolean };
      },
    ) => {
      const before = plan.view.settings;
      if (!before) return false;
      const { integrations, ...rest } = patch;
      plan.patch((v) =>
        v.settings
          ? {
              ...v,
              settings: {
                ...v.settings,
                ...rest,
                integrations: { ...v.settings.integrations, ...integrations },
              },
            }
          : v,
      );
      const res = await plan.call<{ view?: PlanView }>('', { op: 'settings', patch });
      if (!res.ok || !res.body?.view) {
        plan.patch((v) => ({ ...v, settings: before }));
        toast({ variant: 'danger', title: t.planning.common.failed });
        return false;
      }
      plan.setView(res.body.view);
      return true;
    },
    [plan, toast, t],
  );

  return { saveCategory, deleteCategory, saveItem, deleteItem, markPaid, saveSettings };
}

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** An item as the server takes it (the files only when the package has them). */
function itemBody(i: PlanItem, files: boolean) {
  return {
    id: i.id,
    categoryId: i.categoryId,
    vendorId: i.vendorId,
    title: i.title,
    estimate: i.estimate,
    quoted: i.quoted,
    final: i.final,
    status: i.status,
    vatIncluded: i.vatIncluded,
    notes: i.notes,
    sort: i.sort,
    ...(files && i.attachments.length > 0 ? { attachments: i.attachments } : {}),
  };
}

function paymentBody(p: PaymentDraft | PlanPayment) {
  return {
    id: p.id,
    label: p.label,
    amount: p.amount,
    dueDate: p.dueDate,
    paidAt: p.paidAt,
    payOnEventDay: p.payOnEventDay,
    payer: p.payer,
  };
}
