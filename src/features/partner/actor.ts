import { z } from 'zod';

/**
 * One of the partner's own users (a venue owner, one of their staff), as a call names them: their id in
 * Badook Events, and what else it says about them — the creator of a provisioning (createdBy on
 * POST / PATCH /users) or a venue's owner (owner on PUT /venues/{venueId}). The admin console shows
 * which of them opened each account (supabase/migrations/*_partner_origin.sql).
 */
export interface PartnerActor {
  id: string;
  name: string | null;
  email: string | null;
  /** e.g. "owner", "manager" */
  role: string | null;
}

/** The shape a call sends: an id (1–200), and optionally a name (≤120), an email and a role (≤60). */
export const PartnerActorSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().max(120).nullish(),
  // (an empty one is left out, like an empty name or role)
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.literal(''), z.email().max(254)]))
    .nullish(),
  role: z.string().trim().max(60).nullish(),
});

/** The actor a call named (absent, null: it didn't say). */
export const actorOf = (v: z.infer<typeof PartnerActorSchema> | null | undefined): PartnerActor | null =>
  v ? { id: v.id, name: v.name || null, email: v.email || null, role: v.role || null } : null;
