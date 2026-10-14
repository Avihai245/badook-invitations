import 'server-only';
import { AdminDbError } from '@/features/admin/server/db';
import { albumDb } from '@/features/album/server/db';
import { galleryDb } from '@/features/live-gallery/server/db';
import { serviceDb } from '@/lib/supabase/server';
import type { AdminReport, AdminRequest, ReportTarget, RequestTarget } from '../types';

/**
 * Typed access to the report and privacy-request functions (supabase/migrations/*_legal_compliance.sql).
 * Always the service role. The console's functions take the acting staff member and check the role
 * themselves; a rule of the database ('forbidden', 'note required', 'no item'…) comes back as an
 * AdminDbError with that reason in snake_case — the console's routes turn it into 403 / 409.
 */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) {
    if (error.code === 'P0001' && /^[a-z ]+$/.test(error.message)) {
      const reason = error.message.replace(/ /g, '_');
      throw new AdminDbError(reason, `${fn}: ${error.message}`);
    }
    throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  }
  return data as T;
}

export interface ReportSubmission {
  invitation_id: string | null;
  item_id: string | null;
  surface: 'gallery' | 'album' | 'link';
  category: string;
  intimate: boolean;
  role: string;
  description: string;
  reference: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  locale: string;
  ip_hash: string;
}

export interface RequestSubmission {
  kind: string;
  relation: string;
  name: string;
  email: string;
  phone: string | null;
  details: string;
  reference: string | null;
  locale: string;
  ip_hash: string;
}

export type ReportStored = { id: string; number: number; urgent: boolean; hidden: boolean };
export type RequestStored = { id: string; number: number; dueAt: string };

export const legalDb = {
  // ── the public side ──
  /** The invitation behind a gallery upload link / an album link (null: a link that opens nothing). */
  async invitationOfGalleryLink(hash: string): Promise<string | null> {
    return (await galleryDb.byToken(hash, 'upload'))?.invitation.id ?? null;
  },
  async invitationOfAlbumLink(hash: string): Promise<string | null> {
    return (await albumDb.byToken(hash))?.invitation.id ?? null;
  },
  itemVisible: (invitationId: string, itemId: string) =>
    rpc<boolean>('media_report_item_visible', { p_invitation_id: invitationId, p_item_id: itemId }),
  submitReport: (p: ReportSubmission) => rpc<ReportStored>('media_report_submit', { p_data: p }),
  markReportNotified: (id: string, who: 'team' | 'host' | 'reporter', ok: boolean) =>
    rpc<null>('media_report_mark_notified', { p_id: id, p_who: who, p_ok: ok }),
  submitRequest: (p: RequestSubmission) => rpc<RequestStored>('privacy_request_submit', { p_data: p }),
  markRequestNotified: (id: string, who: 'team' | 'requester', ok: boolean) =>
    rpc<null>('privacy_request_mark_notified', { p_id: id, p_who: who, p_ok: ok }),

  /** Reports / requests this address (hashed) sent since `hours` ago. */
  async countSince(table: 'media_reports' | 'privacy_requests', ipHash: string, hours: number) {
    return rpc<number>('legal_count_since', { p_table: table, p_ip_hash: ipHash, p_hours: hours });
  },
  /** The same address's report of the same item for the same reason within `hours` (null: none). */
  async earlierReport(ipHash: string, itemId: string, category: string, hours: number) {
    const row = await rpc<{ number: number; urgent: boolean; hidden: boolean } | null>(
      'media_report_earlier',
      {
        p_ip_hash: ipHash,
        p_item_id: itemId,
        p_category: category,
        p_hours: hours,
      },
    );
    return row ?? null;
  },
  /** The gallery's realtime channel (null: no gallery). */
  async galleryChannel(invitationId: string): Promise<string | null> {
    return (await rpc<string | null>('legal_gallery_channel', { p_invitation_id: invitationId })) ?? null;
  },
  /** The email of whoever created the invitation (null: none on file). */
  async ownerEmail(invitationId: string): Promise<string | null> {
    const ownerId = await rpc<string | null>('legal_invitation_owner', { p_invitation_id: invitationId });
    if (!ownerId) return null;
    const { data: user, error: userError } = await serviceDb().auth.admin.getUserById(ownerId);
    if (userError) throw new Error(`getUserById: ${userError.message}`);
    return user.user?.email ?? null;
  },

  // ── the console ──
  reports: (actor: string, status: 'open' | 'all', limit: number) =>
    rpc<AdminReport[]>('media_report_admin_list', { p_actor: actor, p_status: status, p_limit: limit }),
  report: (actor: string, id: string) =>
    rpc<AdminReport | null>('media_report_admin_get', { p_actor: actor, p_id: id }),
  act: (actor: string, id: string, action: string, note: string | null) =>
    rpc<AdminReport>('media_report_admin_act', { p_actor: actor, p_id: id, p_action: action, p_note: note }),
  requests: (actor: string, status: 'open' | 'all', limit: number) =>
    rpc<AdminRequest[]>('privacy_request_admin_list', { p_actor: actor, p_status: status, p_limit: limit }),
  request: (actor: string, id: string) =>
    rpc<AdminRequest | null>('privacy_request_admin_get', { p_actor: actor, p_id: id }),
  setStatus: (actor: string, id: string, status: string, note: string | null) =>
    rpc<AdminRequest>('privacy_request_admin_set', {
      p_actor: actor,
      p_id: id,
      p_status: status,
      p_note: note,
    }),

  /** What the outcome email needs, unmasked (never leaves the server). */
  async reportTarget(id: string): Promise<ReportTarget | null> {
    const r = await rpc<Record<string, string | number | null> | null>('media_report_target', { p_id: id });
    if (!r) return null;
    return {
      id: r.id as string,
      number: r.number as number,
      invitationId: (r.invitation_id as string | null) ?? null,
      status: r.status as ReportTarget['status'],
      resolution: (r.resolution as ReportTarget['resolution']) ?? null,
      resolvedAt: (r.resolved_at as string | null) ?? null,
      reporterEmail: (r.reporter_email as string | null) ?? null,
      locale: r.locale === 'en' ? 'en' : 'he',
    };
  },
  async requestTarget(id: string): Promise<RequestTarget | null> {
    const r = await rpc<Record<string, string | number | null> | null>('privacy_request_target', {
      p_id: id,
    });
    if (!r) return null;
    return {
      id: r.id as string,
      number: r.number as number,
      status: r.status as RequestTarget['status'],
      resolvedAt: (r.resolved_at as string | null) ?? null,
      email: r.email as string,
      locale: r.locale === 'en' ? 'en' : 'he',
    };
  },
};

export type LegalDb = typeof legalDb;
