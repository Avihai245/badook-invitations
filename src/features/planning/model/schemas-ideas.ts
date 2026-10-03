import { z } from 'zod';
import { ISODateSchema } from '@/features/invitations/contracts/schemas';
import { IDEA_COLORS, IDEA_TYPES } from './categories';
import { CategoryKeySchema, Uuid } from './schemas';

/** What the notes & ideas routes accept (strict: an unknown key is a mistake, not a feature). */

/** An address a card or a preview may hold: http(s), no login in it, at most `max` characters. */
export const isWebUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password;
  } catch {
    return false;
  }
};
const WebUrl = (max: number) => z.string().trim().max(max).refine(isWebUrl, 'Expected an http(s) address');
const HttpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => isWebUrl(v) && v.toLowerCase().startsWith('https:'), 'Expected an https address');

/** What was read from a link's page (see server/preview.ts): every part is short and optional. */
export const OgPreviewSchema = z.strictObject({
  title: z.string().max(160).optional(),
  description: z.string().max(300).optional(),
  image: HttpsUrl.optional(),
  site: z.string().max(100).optional(),
});

export const IdeaLine = z.strictObject({
  text: z.string().max(200),
  done: z.boolean().default(false),
});

export const IdeaPatch = z.strictObject({
  /** the client's own (a new card, or putting a deleted one back with Undo) */
  id: Uuid.optional(),
  type: z.enum(IDEA_TYPES).optional(),
  title: z.string().trim().max(160).nullable().optional(),
  body: z.string().max(5000).nullable().optional(),
  url: WebUrl(1000).nullable().optional(),
  ogPreview: OgPreviewSchema.nullable().optional(),
  /** a file of this event in plan-files: `<owner id>/<invitation id>/<file>` */
  imagePath: z.string().max(300).nullable().optional(),
  color: z.enum(IDEA_COLORS).optional(),
  tags: z.array(z.string().trim().max(30)).max(12).optional(),
  pinned: z.boolean().optional(),
  items: z.array(IdeaLine).max(100).optional(),
  sort: z.number().int().min(-1_000_000).max(1_000_000).optional(),
});
export type IdeaPatchInput = z.infer<typeof IdeaPatch>;

const Money = z.number().min(0).max(1_000_000_000);

export const ConvertTask = z.strictObject({
  title: z.string().trim().min(1).max(200),
  dueDate: ISODateSchema.nullable().optional(),
  category: CategoryKeySchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export const ConvertVendor = z.strictObject({
  name: z.string().trim().min(1).max(120),
  category: CategoryKeySchema.nullable().optional(),
  url: WebUrl(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export const ConvertItem = z.strictObject({
  categoryId: Uuid,
  title: z.string().trim().min(1).max(120),
  estimate: Money.nullable().optional(),
});

export const CONVERT_KINDS = ['task', 'vendor', 'item'] as const;
export type ConvertKind = (typeof CONVERT_KINDS)[number];

/** save / delete: the discriminator is `op` */
export const IdeaEdit = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('save'), idea: IdeaPatch }),
  z.strictObject({ op: z.literal('delete'), ids: z.array(Uuid).min(1).max(100) }),
]);
/** convert: `op` is always 'convert'; the discriminator is `kind` (each kind has its own data) */
export const IdeaConvert = z.discriminatedUnion('kind', [
  z.strictObject({ op: z.literal('convert'), id: Uuid, kind: z.literal('task'), data: ConvertTask }),
  z.strictObject({ op: z.literal('convert'), id: Uuid, kind: z.literal('vendor'), data: ConvertVendor }),
  z.strictObject({ op: z.literal('convert'), id: Uuid, kind: z.literal('item'), data: ConvertItem }),
]);
export const IdeaOp = z.union([IdeaEdit, IdeaConvert]);
export type IdeaOpInput = z.infer<typeof IdeaOp>;

/** POST …/planning/ideas/preview { url } */
export const PreviewRequest = z.strictObject({ url: WebUrl(1000) });
