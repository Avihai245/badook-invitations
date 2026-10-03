import { z } from 'zod';
import { ISODateSchema } from '@/features/invitations/contracts/schemas';
import { VENDOR_STATUSES } from './categories';
import { CategoryKeySchema, Uuid } from './schemas';

/** What POST …/planning/vendors accepts. Strict: an unknown key is a mistake, not a feature. */

const Money = z.number().min(0).max(1_000_000_000);

/** A text the host typed: trimmed, and nothing at all (empty) means "none". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** A web address a link may point to: http or https only (it ends up in an href). */
const webUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => {
      if (v === '') return true;
      try {
        const u = new URL(v);
        return u.protocol === 'https:' || u.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'url' },
  )
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const emailAddress = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === '' || z.email().safeParse(v).success, { message: 'email' })
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

/** A file attached to a vendor: uploaded through the files route, so its path is the event's own. */
export const AttachmentSchema = z.strictObject({
  path: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
  size: z
    .number()
    .int()
    .min(0)
    .max(10 * 1024 * 1024),
  type: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
});

export const MAX_ATTACHMENTS = 6;

export const VendorPatch = z
  .strictObject({
    id: Uuid.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    category: CategoryKeySchema.nullable().optional(),
    phone: optionalText(40),
    email: emailAddress,
    url: webUrl,
    status: z.enum(VENDOR_STATUSES).optional(),
    quoteAmount: Money.nullable().optional(),
    paymentTerms: optionalText(500),
    included: optionalText(1000),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: optionalText(2000),
    attachments: z.array(AttachmentSchema).max(MAX_ATTACHMENTS).optional(),
    sort: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  // a vendor that exists can be changed by any of its fields; a new one needs a name
  .refine((v) => v.id !== undefined || v.name !== undefined, { path: ['name'], message: 'name' });
export type VendorPatchInput = z.infer<typeof VendorPatch>;

/** What a close opens with the vendor (each part is optional). */
export const ClosePlan = z.strictObject({
  item: z
    .strictObject({
      categoryId: Uuid.optional(),
      categoryKey: CategoryKeySchema.optional(),
      title: z.string().trim().min(1).max(120),
      amount: Money.nullable().optional(),
    })
    .optional(),
  payments: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1).max(60),
        amount: z.number().positive().max(1_000_000_000),
        dueDate: ISODateSchema.nullable().optional(),
        payOnEventDay: z.boolean().optional(),
      }),
    )
    .max(20)
    .optional(),
  tasks: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(200),
        dueDate: ISODateSchema.nullable().optional(),
        category: CategoryKeySchema.nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
});
export type ClosePlanInput = z.infer<typeof ClosePlan>;

/** What a close answers with, and what undoing it needs back. */
export const Previous = z.strictObject({
  status: z.enum(VENDOR_STATUSES),
  quoteAmount: Money.nullable(),
});
export const Created = z.strictObject({
  categoryId: Uuid.optional(),
  itemId: Uuid.nullable().optional(),
  paymentIds: z.array(Uuid).max(20).default([]),
  taskIds: z.array(Uuid).max(20).default([]),
});

export const VendorOp = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('save'), vendor: VendorPatch }),
  z.strictObject({ op: z.literal('delete'), ids: z.array(Uuid).min(1).max(100) }),
  z.strictObject({ op: z.literal('close'), id: Uuid, plan: ClosePlan.optional() }),
  z.strictObject({ op: z.literal('undo_close'), id: Uuid, previous: Previous, created: Created }),
]);
export type VendorOpInput = z.infer<typeof VendorOp>;
