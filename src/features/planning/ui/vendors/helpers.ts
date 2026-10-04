import { toE164 } from '@/features/invitations/lib/phone';
import { VENDOR_STATUSES, type CategoryKey, type VendorStatus } from '../../model/categories';
import type { PlanItem, PlanVendor } from '../../model/plan';

/** The pure parts of the Vendors screen (tested in tests/unit/planning-vendors.test.ts). */

/** The pipeline, left to right (right to left in Hebrew): an idea to a closed vendor, then the dropped ones. */
export const STATUSES = VENDOR_STATUSES;
/** Still being worked on: not booked, not dropped. */
export const IN_PROGRESS: readonly VendorStatus[] = ['idea', 'contacted', 'quote'];
export const isInProgress = (status: VendorStatus) => IN_PROGRESS.includes(status);

/** How many files a vendor may hold (the server's limit). */
export const MAX_FILES = 6;

/** A new vendor's id, chosen here so an Undo can put the same one back. */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The vendors in the order the host keeps them. */
export const sortVendors = (vendors: readonly PlanVendor[]) => [...vendors].sort((a, b) => a.sort - b.sort);

/** Where a vendor added now goes: after all of them. */
export const nextSort = (vendors: readonly PlanVendor[]) =>
  vendors.reduce((max, v) => Math.max(max, v.sort), 0) + 10;

export function countByStatus(vendors: readonly PlanVendor[]): Record<VendorStatus, number> {
  const out = { idea: 0, contacted: 0, quote: 0, booked: 0, rejected: 0 } as Record<VendorStatus, number>;
  for (const v of vendors) out[v.status] += 1;
  return out;
}

// ─── reaching the vendor ─────────────────────────────────────────────────────────────────────────

/** The phone as digits with the country code (WhatsApp's wa.me wants them), when it can be worked out. */
export function phoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = toE164(phone);
  return /^\+\d{8,15}$/.test(e164) ? e164.slice(1) : null;
}

/** A plain link to the vendor's WhatsApp: nothing is sent by the system. */
export function waLink(phone: string | null | undefined): string | null {
  const digits = phoneDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

/** `tel:` for a number someone could dial (the international form when it parses). */
export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = toE164(phone);
  const dial = (/^\+\d+$/.test(e164) ? e164 : phone).replace(/[^\d+]/g, '');
  return dial.replace(/\D/g, '').length >= 3 ? `tel:${dial}` : null;
}

export const mailLink = (email: string | null | undefined) =>
  email && email.includes('@') ? `mailto:${email}` : null;

/**
 * The website as typed ("example.com") as an address; ok false when it is not a web address (a link
 * ends up in an href, so only http and https are accepted). Empty is fine: no site.
 */
export function normalizeUrl(input: string): { url: string | null; ok: boolean } {
  const typed = input.trim();
  if (!typed) return { url: null, ok: true };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
  try {
    const u = new URL(withScheme);
    const web = (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
    return web ? { url: u.toString().replace(/\/$/, ''), ok: true } : { url: null, ok: false };
  } catch {
    return { url: null, ok: false };
  }
}

/** An amount as typed (₪, thousands separators, a decimal comma): null when empty, undefined when it is not one. */
export function parseAmount(input: string): number | null | undefined {
  let t = input.replace(/₪|ש"ח|\s/g, '');
  if (t === '') return null;
  if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,(?=\d{3}(?:\D|$))/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n <= 1_000_000_000 ? n : undefined;
}

// ─── what is missing, and comparing ──────────────────────────────────────────────────────────────

export interface MissingRow {
  category: CategoryKey;
  /** one of the event's required categories (else it is shown because vendors are in progress) */
  required: boolean;
  /** the vendors of it still being worked on */
  inProgress: PlanVendor[];
}

/**
 * The categories with no booked vendor that matter: the event's required ones, and any other with
 * vendors still in progress. In the required order first, then the others as they appear.
 */
export function missingCategories(
  vendors: readonly PlanVendor[],
  required: readonly CategoryKey[],
): MissingRow[] {
  const booked = new Set(vendors.filter((v) => v.status === 'booked' && v.category).map((v) => v.category));
  const keys: CategoryKey[] = [...new Set(required)];
  for (const v of vendors)
    if (v.category && isInProgress(v.status) && !keys.includes(v.category)) keys.push(v.category);
  return keys
    .filter((key) => !booked.has(key))
    .map((category) => ({
      category,
      required: required.includes(category),
      inProgress: vendors.filter((v) => v.category === category && isInProgress(v.status)),
    }));
}

/** The vendors with the lowest quote — only when two or more quoted and they differ (else nothing stands out). */
export function cheapestIds(vendors: readonly PlanVendor[]): Set<string> {
  const priced = vendors.filter((v) => v.quoteAmount !== null);
  if (priced.length < 2) return new Set();
  const amounts = priced.map((v) => v.quoteAmount!);
  const min = Math.min(...amounts);
  if (min === Math.max(...amounts)) return new Set();
  return new Set(priced.filter((v) => v.quoteAmount === min).map((v) => v.id));
}

/**
 * The selection for comparing quotes after toggling one: vendors of one category at a time — picking one
 * of another category starts a new selection with it.
 */
export function toggleCompare(
  selected: readonly string[],
  vendors: readonly PlanVendor[],
  id: string,
): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  const category = vendors.find((v) => v.id === id)?.category ?? null;
  const same = selected.filter((x) => (vendors.find((v) => v.id === x)?.category ?? null) === category);
  return [...same, id];
}

/** What a closed vendor cost: its budget items' amounts when it has any, else its quote. */
export function vendorCost(vendor: PlanVendor, items: readonly PlanItem[]): number | null {
  const own = items.filter((i) => i.vendorId === vendor.id);
  if (own.length === 0) return vendor.quoteAmount;
  return own.reduce((sum, i) => sum + (i.final ?? i.quoted ?? i.estimate ?? 0), 0);
}
