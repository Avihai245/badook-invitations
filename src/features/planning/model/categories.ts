/**
 * The one list of categories behind an event's budget and its vendors (planning is inside the
 * invitations system only: nothing here is read from, or shared with, another product). A category
 * is a key; its name comes from the dictionary (`t.planning.categories[key]`), in Hebrew and English.
 */
export const CATEGORY_KEYS = [
  'venue',
  'photographer',
  'videographer',
  'dj',
  'band',
  'catering',
  'bar',
  'cakes_sweets',
  'design',
  'flowers',
  'rental',
  'makeup_hair',
  'attire',
  'officiant',
  'host',
  'entertainment',
  'production',
  'transport',
  'invitations_print',
  'other',
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export const isCategoryKey = (v: unknown): v is CategoryKey => CATEGORY_KEYS.includes(v as CategoryKey);

/** How a budget category's cost follows the guests (see budget.ts). */
export const COST_BASES = ['fixed', 'per_adult', 'per_child', 'per_guest', 'per_table'] as const;
export type CostBasis = (typeof COST_BASES)[number];

/** Where the guest numbers a cost follows come from. */
export const GUEST_BASES = ['invited', 'confirmed', 'manual'] as const;
export type GuestBasis = (typeof GUEST_BASES)[number];

export const VAT_MODES = ['none', 'included', 'excluded'] as const;
export type VatMode = (typeof VAT_MODES)[number];

export const TASK_STATUSES = ['todo', 'doing', 'done', 'skipped'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ITEM_STATUSES = ['estimate', 'quoted', 'booked', 'paid'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const VENDOR_STATUSES = ['idea', 'contacted', 'quote', 'booked', 'rejected'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const IDEA_TYPES = ['note', 'link', 'image', 'list'] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];

/** The cards' colors: design tokens, never raw values. */
export const IDEA_COLORS = ['default', 'brand', 'success', 'warning', 'info'] as const;
export type IdeaColor = (typeof IDEA_COLORS)[number];

/** The wizard's variants: the couple's makeup decides a few words, never a fixed gendered text. */
export const VARIANTS = ['default', 'two_brides', 'two_grooms'] as const;
export type Variant = (typeof VARIANTS)[number];
