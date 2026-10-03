'use client';

import { useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/app';
import type { ApiResponse } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import type { CategoryKey, VendorStatus } from '../../model/categories';
import { readIntegrations } from '../../model/integrations';
import type { PlanVendor } from '../../model/plan';
import type { ClosePlanInput } from '../../model/schemas-vendors';
import { usePlan } from '../PlanProvider';
import { newId, nextSort, sortVendors } from './helpers';

/** What a change to a vendor carries: any of its fields except the id. */
export type VendorFields = Partial<Omit<PlanVendor, 'id'>>;

interface CloseResult {
  vendor: PlanVendor;
  previous: { status: VendorStatus; quoteAmount: number | null };
  created: { categoryId?: string; itemId: string | null; paymentIds: string[]; taskIds: string[] };
}

const upsert = (list: PlanVendor[], v: PlanVendor) =>
  list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v];
const without = (list: PlanVendor[], id: string) => list.filter((x) => x.id !== id);

/** Every vendor field, for putting a deleted vendor back with the same id. */
const wholeVendor = (v: PlanVendor) => ({
  id: v.id,
  name: v.name,
  category: v.category,
  phone: v.phone,
  email: v.email,
  url: v.url,
  status: v.status,
  quoteAmount: v.quoteAmount,
  paymentTerms: v.paymentTerms,
  included: v.included,
  rating: v.rating,
  notes: v.notes,
  attachments: v.attachments,
  sort: v.sort,
});

/**
 * Everything the Vendors screen does to the plan: add, change, move, rate, delete (with Undo) and close
 * (with Undo). Every change is shown at once (`patch`), sent (`call`), and rolled back with a message when
 * it does not go through; what only the server can work out (the budget and the tasks after a close) is
 * read again with `refresh`.
 */
export function useVendorActions({ askClose }: { askClose?: (vendor: PlanVendor) => void } = {}) {
  const { t, fmt } = useUi();
  const V = t.planning.vendors;
  const C = t.planning.common;
  const { toast } = useToast();
  const plan = usePlan();
  const { view } = plan;
  const viewRef = useRef(view);
  viewRef.current = view;
  const [announcement, setAnnouncement] = useState('');

  const vendors = useMemo(() => sortVendors(view.vendors), [view.vendors]);
  const integrationOn = readIntegrations(view.settings?.integrations).vendors;

  const find = (id: string) => viewRef.current.vendors.find((v) => v.id === id) ?? null;
  const put = (v: PlanVendor) => plan.patch((p) => ({ ...p, vendors: upsert(p.vendors, v) }));
  const drop = (id: string) => plan.patch((p) => ({ ...p, vendors: without(p.vendors, id) }));

  /** The line to show when a call did not go through. */
  const why = (res: ApiResponse<{ code?: string }>) => {
    const code = res.body?.code;
    if (code === 'too_many') return V.toast.tooMany;
    if (code === 'invalid_link') return V.toast.invalidLink;
    return C.failed;
  };

  /** Closing: the dialog when the plan follows its vendors (budget, payments, tasks), else just the status. */
  const requestClose = (vendor: PlanVendor) => {
    if (integrationOn && askClose) askClose(vendor);
    else void closeVendor(vendor);
  };

  /** Changes some fields of a vendor as it is now (whatever else changed meanwhile stays). */
  const merge = (id: string, fields: VendorFields) =>
    plan.patch((p) => ({
      ...p,
      vendors: p.vendors.map((v) => (v.id === id ? { ...v, ...fields } : v)),
    }));

  async function update(id: string, fields: VendorFields): Promise<boolean> {
    const current = find(id);
    if (!current) return false;
    // "booked" is a close: it may open the budget, the payments and the tasks
    if (fields.status === 'booked' && current.status !== 'booked') {
      const rest = { ...fields };
      delete rest.status;
      if (Object.keys(rest).length > 0) await update(id, rest);
      requestClose({ ...current, ...rest });
      return true;
    }
    merge(id, fields);
    const res = await plan.call<{ vendor?: PlanVendor; code?: string }>('/vendors', {
      op: 'save',
      vendor: { id, ...fields },
    });
    if (!res.ok || !res.body?.vendor) {
      // back to what those fields were
      merge(
        id,
        Object.fromEntries(
          Object.keys(fields).map((k) => [k, current[k as keyof PlanVendor]]),
        ) as VendorFields,
      );
      toast({ title: why(res), variant: 'danger' });
      return false;
    }
    put(res.body.vendor);
    return true;
  }

  async function add(input: {
    name: string;
    category: CategoryKey | null;
    phone: string | null;
  }): Promise<PlanVendor | null> {
    const id = newId();
    const name = input.name.trim();
    const phone = input.phone?.trim() || null;
    const optimistic: PlanVendor = {
      id,
      name,
      category: input.category,
      phone,
      email: null,
      url: null,
      status: 'idea',
      quoteAmount: null,
      paymentTerms: null,
      included: null,
      rating: null,
      notes: null,
      attachments: [],
      sort: nextSort(viewRef.current.vendors),
    };
    put(optimistic);
    const res = await plan.call<{ vendor?: PlanVendor; code?: string }>('/vendors', {
      op: 'save',
      vendor: {
        id,
        name,
        ...(input.category ? { category: input.category } : {}),
        ...(phone ? { phone } : {}),
      },
    });
    if (!res.ok || !res.body?.vendor) {
      drop(id);
      toast({ title: why(res), variant: 'danger' });
      return null;
    }
    put(res.body.vendor);
    toast({ title: V.quick.added, variant: 'success' });
    return res.body.vendor;
  }

  function move(vendor: PlanVendor, status: VendorStatus) {
    if (status === vendor.status) return;
    if (status === 'booked') return requestClose(vendor);
    setAnnouncement(fmt(V.moved, { name: vendor.name, status: V.statuses[status] }));
    void update(vendor.id, { status });
  }

  function rate(vendor: PlanVendor, rating: number | null) {
    void update(vendor.id, { rating });
  }

  async function restore(vendor: PlanVendor) {
    put(vendor);
    const res = await plan.call<{ vendor?: PlanVendor; code?: string }>('/vendors', {
      op: 'save',
      vendor: wholeVendor(vendor),
    });
    if (!res.ok || !res.body?.vendor) {
      drop(vendor.id);
      toast({ title: why(res), variant: 'danger' });
      return;
    }
    put(res.body.vendor);
    toast({ title: V.toast.restored, variant: 'success' });
  }

  async function remove(vendor: PlanVendor) {
    drop(vendor.id);
    const res = await plan.call<{ code?: string }>('/vendors', { op: 'delete', ids: [vendor.id] });
    if (!res.ok) {
      put(vendor);
      toast({ title: why(res), variant: 'danger' });
      return;
    }
    toast({
      title: V.toast.deleted,
      duration: 8000,
      action: { label: C.undo, altText: C.undo, onClick: () => void restore(vendor) },
    });
  }

  async function undoClose(vendor: PlanVendor, result: CloseResult) {
    put({ ...vendor, status: result.previous.status, quoteAmount: result.previous.quoteAmount });
    const res = await plan.call('/vendors', {
      op: 'undo_close',
      id: vendor.id,
      previous: result.previous,
      created: result.created,
    });
    if (!res.ok) toast({ title: C.failed, variant: 'danger' });
    else toast({ title: V.toast.closeUndone, variant: 'success' });
    // the budget and the tasks the close made are gone again (or, when it failed, still there)
    await plan.refresh();
  }

  async function closeVendor(vendor: PlanVendor, closePlan?: ClosePlanInput): Promise<boolean> {
    const before = find(vendor.id) ?? vendor;
    const amount = closePlan?.item?.amount;
    put({
      ...before,
      status: 'booked',
      quoteAmount: amount !== undefined && amount !== null ? amount : before.quoteAmount,
    });
    const res = await plan.call<Partial<CloseResult> & { code?: string }>('/vendors', {
      op: 'close',
      id: vendor.id,
      ...(closePlan && Object.keys(closePlan).length > 0 ? { plan: closePlan } : {}),
    });
    const body = res.body;
    if (!res.ok || !body?.vendor || !body.previous || !body.created) {
      put(before);
      toast({ title: why(res), variant: 'danger' });
      return false;
    }
    const result = body as CloseResult;
    put(result.vendor);
    const made =
      !!result.created.itemId ||
      result.created.paymentIds.length > 0 ||
      result.created.taskIds.length > 0 ||
      !!result.created.categoryId;
    toast({
      title: V.toast.closed,
      description: made ? V.toast.closedBody : undefined,
      variant: 'success',
      duration: 10000,
      action: { label: C.undo, altText: C.undo, onClick: () => void undoClose(result.vendor, result) },
    });
    // the budget's totals, the new tasks and the system tasks are the server's to work out
    if (made) void plan.refresh();
    return true;
  }

  return {
    vendors,
    integrationOn,
    announcement,
    add,
    update,
    move,
    rate,
    remove,
    requestClose,
    closeVendor,
  };
}

export type VendorActions = ReturnType<typeof useVendorActions>;
