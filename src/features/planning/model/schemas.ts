import { z } from 'zod';
import { ISODateSchema } from '@/features/invitations/contracts/schemas';
import { CATEGORY_KEYS, COST_BASES, GUEST_BASES, TASK_STATUSES, VARIANTS, VAT_MODES } from './categories';
import { INTEGRATION_MODES } from './plan';

/** What the planning routes accept. Strict: an unknown key is a mistake, not a feature. */

export const Uuid = z.uuid();
export const CategoryKeySchema = z.enum(CATEGORY_KEYS);
export const CostBasisSchema = z.enum(COST_BASES);
const Money = z.number().min(0).max(1_000_000_000);

export const IntegrationsPatch = z.strictObject({
  mode: z.enum(INTEGRATION_MODES).optional(),
  vendors: z.boolean().optional(),
  tasks: z.boolean().optional(),
  guests: z.boolean().optional(),
  seating: z.boolean().optional(),
  eventDay: z.boolean().optional(),
  overview: z.boolean().optional(),
});

/** A plan's content as a draft the host approved (the AI's suggestion, a private template's items). */
export const DraftSchema = z.strictObject({
  tasks: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(200),
        notes: z.string().max(2000).nullable(),
        offsetDays: z.number().int().min(-1000).max(1000),
        category: CategoryKeySchema.nullable(),
        priority: z.union([z.literal(0), z.literal(1)]),
      }),
    )
    .max(200),
  categories: z
    .array(
      z.strictObject({
        key: CategoryKeySchema.nullable(),
        name: z.string().trim().min(1).max(80).nullable(),
        pct: z.number().min(0).max(100),
        basis: CostBasisSchema,
        required: z.boolean(),
      }),
    )
    .max(40),
  requiredVendors: z.array(CategoryKeySchema).max(40),
});

export const InitSchema = z.strictObject({
  /** a system template's key, 'blank', 'private:<id>' or 'draft' (then `draft` is the content) */
  template: z.string().regex(/^([a-z_]{2,40}|private:[0-9a-f-]{36})$/),
  variant: z.enum(VARIANTS).default('default'),
  totalBudget: Money.nullable().default(null),
  guestBasis: z.enum(GUEST_BASES).default('invited'),
  manualAdults: z.number().int().min(0).max(100_000).nullable().optional(),
  manualChildren: z.number().int().min(0).max(100_000).nullable().optional(),
  manualTables: z.number().int().min(0).max(10_000).nullable().optional(),
  integrationsMode: z.enum(INTEGRATION_MODES).default('recommended'),
  remindersEmail: z.boolean().default(true),
  draft: DraftSchema.optional(),
});
export type InitInput = z.infer<typeof InitSchema>;

export const SettingsSchema = z.strictObject({
  variant: z.enum(VARIANTS).optional(),
  totalBudget: Money.nullable().optional(),
  vatMode: z.enum(VAT_MODES).optional(),
  vatPct: z.number().min(0).max(100).optional(),
  guestBasis: z.enum(GUEST_BASES).optional(),
  manualAdults: z.number().int().min(0).max(100_000).nullable().optional(),
  manualChildren: z.number().int().min(0).max(100_000).nullable().optional(),
  manualTables: z.number().int().min(0).max(10_000).nullable().optional(),
  integrations: IntegrationsPatch.optional(),
  reminders: z.strictObject({ email: z.boolean().optional() }).optional(),
  requiredVendors: z.array(CategoryKeySchema).max(40).optional(),
  onboardingDone: z.boolean().optional(),
});
export type SettingsInput = z.infer<typeof SettingsSchema>;

export const TaskPatch = z.strictObject({
  id: Uuid.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: ISODateSchema.nullable().optional(),
  dueIsManual: z.boolean().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  category: CategoryKeySchema.nullable().optional(),
  priority: z.union([z.literal(0), z.literal(1)]).optional(),
  assignee: z.string().trim().min(1).max(60).nullable().optional(),
  budgetItemId: Uuid.nullable().optional(),
  vendorId: Uuid.nullable().optional(),
  suggestHide: z.boolean().optional(),
  sort: z.number().int().min(-1_000_000).max(1_000_000).optional(),
});

export const TaskOp = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('save'), task: TaskPatch }),
  z.strictObject({ op: z.literal('delete'), ids: z.array(Uuid).min(1).max(100) }),
  z.strictObject({ op: z.literal('reorder'), ids: z.array(Uuid).min(1).max(600) }),
  z.strictObject({
    op: z.literal('bulk'),
    ids: z.array(Uuid).min(1).max(200),
    patch: z.strictObject({ status: z.enum(TASK_STATUSES).optional(), suggestHide: z.boolean().optional() }),
  }),
]);
export type TaskOpInput = z.infer<typeof TaskOp>;

/** The root route's operations. */
export const PlanOp = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('init'), ...InitSchema.shape }),
  z.strictObject({ op: z.literal('settings'), patch: SettingsSchema }),
  z.strictObject({ op: z.literal('dates'), keep: z.boolean().optional() }),
  z.strictObject({ op: z.literal('ack_headcount') }),
]);
