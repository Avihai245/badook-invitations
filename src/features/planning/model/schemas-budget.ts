import { z } from 'zod';
import { ISODateSchema } from '@/features/invitations/contracts/schemas';
import { ATTACHMENT_TYPES, MAX_ATTACHMENTS } from './budget-view';
import { ITEM_STATUSES } from './categories';
import { CategoryKeySchema, CostBasisSchema, Uuid } from './schemas';

/**
 * What the budget route accepts (POST …/planning/budget). Strict: an unknown key is a mistake, not a
 * feature. Amounts are shekels with at most two decimals; the server's own rows are the totals.
 */

const twoDecimals = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
/** 0 … 1,000,000,000, agorot at most. */
export const Amount = z.number().min(0).max(1_000_000_000).refine(twoDecimals, 'two decimals at most');
/** A payment is for something: more than nothing. */
const PaymentAmount = z.number().min(0.01).max(1_000_000_000).refine(twoDecimals, 'two decimals at most');
/** The price of one adult / guest / table: the table's own limit. */
const UnitAmount = z.number().min(0).max(10_000_000).refine(twoDecimals, 'two decimals at most');

const Sort = z.number().int().min(-1_000_000).max(1_000_000);
const Name = (max: number) => z.string().trim().min(1).max(max);

export const AttachmentSchema = z.strictObject({
  path: z.string().min(1).max(200),
  name: Name(120),
  size: z
    .number()
    .int()
    .min(0)
    .max(10 * 1024 * 1024),
  type: z.enum(ATTACHMENT_TYPES),
});

/** A category: a new one needs a key (the system's) or a name (the host's own). */
export const CategoryPatch = z
  .strictObject({
    id: Uuid.optional(),
    key: CategoryKeySchema.nullable().optional(),
    name: Name(80).nullable().optional(),
    plannedAmount: Amount.optional(),
    costBasis: CostBasisSchema.optional(),
    unitPrice: UnitAmount.nullable().optional(),
    childPrice: UnitAmount.nullable().optional(),
    required: z.boolean().optional(),
    sort: Sort.optional(),
  })
  .refine((c) => c.id !== undefined || !!c.key || !!c.name, { message: 'a key or a name', path: ['key'] });

/** An item: a new one needs its category and a title (an existing one takes the keys given). */
export const ItemPatch = z
  .strictObject({
    id: Uuid.optional(),
    categoryId: Uuid.optional(),
    vendorId: Uuid.nullable().optional(),
    title: Name(120).optional(),
    estimate: Amount.nullable().optional(),
    quoted: Amount.nullable().optional(),
    final: Amount.nullable().optional(),
    status: z.enum(ITEM_STATUSES).optional(),
    vatIncluded: z.boolean().nullable().optional(),
    attachments: z.array(AttachmentSchema).max(MAX_ATTACHMENTS).optional(),
    notes: z.string().max(1000).nullable().optional(),
    sort: Sort.optional(),
  })
  .refine((i) => i.id !== undefined || (!!i.categoryId && !!i.title), {
    message: 'a category and a title',
    path: ['categoryId'],
  });

const PaidAt = z.union([z.iso.datetime({ offset: true }), ISODateSchema]);

/** A payment of an item's schedule, as listed with the item (it already says which item). */
export const SchedulePayment = z.strictObject({
  id: Uuid.optional(),
  label: Name(60),
  amount: PaymentAmount,
  dueDate: ISODateSchema.nullable().optional(),
  paidAt: PaidAt.nullable().optional(),
  payOnEventDay: z.boolean().optional(),
  payer: Name(60).nullable().optional(),
});

/** One payment on its own: a new one needs its item, a label and an amount. */
export const PaymentPatch = z
  .strictObject({
    id: Uuid.optional(),
    itemId: Uuid.optional(),
    label: Name(60).optional(),
    amount: PaymentAmount.optional(),
    dueDate: ISODateSchema.nullable().optional(),
    paidAt: PaidAt.nullable().optional(),
    payOnEventDay: z.boolean().optional(),
    payer: Name(60).nullable().optional(),
  })
  .refine((p) => p.id !== undefined || (!!p.itemId && !!p.label && p.amount !== undefined), {
    message: 'an item, a label and an amount',
    path: ['itemId'],
  });

const Ids = z.array(Uuid).min(1).max(100);

export const BudgetOp = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('category_save'), category: CategoryPatch }),
  z.strictObject({ op: z.literal('category_delete'), ids: Ids }),
  z.strictObject({
    op: z.literal('item_save'),
    item: ItemPatch,
    payments: z.array(SchedulePayment).max(60).optional(),
  }),
  z.strictObject({ op: z.literal('item_delete'), ids: Ids }),
  z.strictObject({ op: z.literal('payment_save'), payment: PaymentPatch }),
  z.strictObject({ op: z.literal('payment_delete'), ids: Ids }),
  z.strictObject({ op: z.literal('payment_paid'), id: Uuid, paid: z.boolean() }),
]);
export type BudgetOpInput = z.infer<typeof BudgetOp>;
