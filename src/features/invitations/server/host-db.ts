import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import { migrateDocument } from '../contracts/migrate';
import type { PosterTemplate } from '../app/TemplatePoster';
import type {
  EventType,
  InvitationDocument,
  L10n,
  Locale,
  Palette,
  TemplateManifest,
} from '../contracts/types';
import type { NotifyMode, ResponseRecord } from '../lib/responses';
import { VERSIONS, type HistoryEntry, type SaveReason } from '../lib/versions';
import { syncSeedOnce } from './seed-sync';

/**
 * Typed access to the host-app database functions (supabase/migrations/*_host_app.sql,
 * *_responses.sql). Always the
 * service role + the verified user's id: every function checks ownership itself.
 */

export type InvitationStatus = 'draft' | 'published' | 'archived';

/** An invitation's design as the host app's screens draw it (server/design-summary.ts). */
export type DesignSummary = PosterTemplate & Pick<TemplateManifest, 'categories'>;

export interface InvitationSummary {
  id: string;
  slug: string;
  status: InvitationStatus;
  templateId: string;
  eventType: EventType;
  hosts: InvitationDocument['hosts'];
  date: string;
  locales: Locale[];
  defaultLocale: Locale;
  palette: Partial<Palette> | null;
  monogram: L10n | null;
  sealColor: string | null;
  version: number;
  unpublishedChanges: boolean;
  publishedAt: string | null;
  updatedAt: string;
  responses: number;
  attending: number;
  /** the guest list, and how many of them were sent the invitation (WhatsApp or by hand) */
  guests: number;
  sent: number;
  /** its design, filled in on the server for the screens (not from the database) */
  design?: DesignSummary | null;
}

export interface OwnerInvitation {
  id: string;
  slug: string;
  status: InvitationStatus;
  templateId: string;
  eventType: EventType;
  draft: InvitationDocument;
  published: InvitationDocument | null;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  /** the save-the-date this invitation was created from (its page links here once published) */
  sourceSlug: string | null;
}

export type SaveDraftResult =
  | {
      ok: true;
      updatedAt: string;
      /** a copy of the draft it replaced went into the history */
      kept?: boolean;
      /** the review link's channel (the family's open review pages are told the draft changed) */
      reviewChannel?: string | null;
    }
  | { ok: false; code: 'conflict'; updatedAt: string; draft: InvitationDocument }
  | null;

export interface HistoryDocument {
  entry: HistoryEntry;
  document: InvitationDocument;
}

export type SetSlugResult =
  { ok: true; slug: string; updatedAt: string } | { ok: false; code: 'taken' | 'invalid' } | null;

export interface PublishResult {
  slug: string;
  version: number;
  publishedAt: string;
  updatedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

type RawInvitation = Omit<OwnerInvitation, 'draft' | 'published'> & { draft: unknown; published: unknown };

export const hostDb = {
  list: (ownerId: string) => rpc<InvitationSummary[]>('owner_invitations', { p_owner_id: ownerId }),

  async get(id: string, ownerId: string): Promise<OwnerInvitation | null> {
    if (!isUuid(id)) return null;
    const raw = await rpc<RawInvitation | null>('owner_invitation', { p_id: id, p_owner_id: ownerId });
    if (!raw) return null;
    return {
      ...raw,
      draft: migrateDocument(raw.draft),
      published: raw.published ? migrateDocument(raw.published) : null,
    };
  },

  create: (
    ownerId: string,
    templateId: string,
    eventType: EventType,
    slug: string,
    draft: InvitationDocument,
    /** the owner's save-the-date this is the full invitation of */
    sourceId?: string,
  ) => {
    const create = () =>
      rpc<{ id: string; slug: string }>('create_invitation', {
        p_owner_id: ownerId,
        p_template_id: templateId,
        p_event_type: eventType,
        p_slug: slug,
        p_draft: draft,
        ...(sourceId ? { p_source_id: sourceId } : {}),
      });
    return create().catch(async (err: { code?: string }) => {
      // a template this deployment brought that the database doesn't have yet: sync, then once more
      if (err.code !== '23503') throw err;
      await syncSeedOnce('create with an unknown template');
      return create();
    });
  },

  /**
   * Autosave, with the history: a copy of the draft it replaces is kept at most once per stretch of
   * editing (lib/versions.ts).
   */
  saveDraft: (id: string, ownerId: string, draft: InvitationDocument, expectedUpdatedAt: string) =>
    rpc<SaveDraftResult>('save_invitation_draft_tracked', {
      p_id: id,
      p_owner_id: ownerId,
      p_draft: draft,
      p_expected_updated_at: expectedUpdatedAt,
      p_every_seconds: VERSIONS.saveEverySeconds,
      p_max_saves: VERSIONS.maxSaves,
    }),

  slugAvailable: (slug: string, id: string | null) =>
    rpc<boolean>('slug_available', { p_slug: slug, p_id: id && isUuid(id) ? id : null }),

  setSlug: (id: string, ownerId: string, slug: string) =>
    rpc<SetSlugResult>('set_invitation_slug', { p_id: id, p_owner_id: ownerId, p_slug: slug }),

  publish: (id: string, ownerId: string) =>
    rpc<PublishResult | null>('publish_invitation', { p_id: id, p_owner_id: ownerId }),

  versions: (id: string, ownerId: string) =>
    rpc<{ version: number; createdAt: string }[]>('owner_invitation_versions', {
      p_id: id,
      p_owner_id: ownerId,
    }),

  async version(id: string, ownerId: string, version: number): Promise<InvitationDocument | null> {
    const raw = await rpc<unknown>('owner_invitation_version', {
      p_id: id,
      p_owner_id: ownerId,
      p_version: version,
    });
    return raw ? migrateDocument(raw) : null;
  },

  restore: (id: string, ownerId: string, version: number) =>
    rpc<boolean>('restore_invitation_version', { p_id: id, p_owner_id: ownerId, p_version: version }),

  // ── the history: publishes and saves (supabase/migrations/*_studio.sql) ──

  history: (id: string, ownerId: string) =>
    isUuid(id)
      ? rpc<HistoryEntry[]>('owner_invitation_history', {
          p_id: id,
          p_owner_id: ownerId,
          p_limit: VERSIONS.historyLimit,
        })
      : Promise.resolve([] as HistoryEntry[]),

  async entry(id: string, ownerId: string, entryId: number): Promise<HistoryDocument | null> {
    if (!isUuid(id)) return null;
    const raw = await rpc<(HistoryEntry & { document: unknown }) | null>('owner_invitation_entry', {
      p_id: id,
      p_owner_id: ownerId,
      p_entry_id: entryId,
    });
    if (!raw) return null;
    const { document, ...entry } = raw;
    return {
      entry: { ...entry, templateId: (document as { templateId?: string })?.templateId ?? null },
      document: migrateDocument(document),
    };
  },

  async restoreEntry(
    id: string,
    ownerId: string,
    entryId: number,
  ): Promise<{ draft: InvitationDocument; updatedAt: string; reviewChannel: string | null } | null> {
    if (!isUuid(id)) return null;
    const raw = await rpc<{ draft: unknown; updatedAt: string; reviewChannel: string | null } | null>(
      'restore_invitation_entry',
      { p_id: id, p_owner_id: ownerId, p_entry_id: entryId, p_max_saves: VERSIONS.maxSaves },
    );
    return raw ? { ...raw, draft: migrateDocument(raw.draft) } : null;
  },

  /** A copy of the draft kept on purpose (before a design concept replaces the design). */
  snapshot: (id: string, ownerId: string, reason: Exclude<SaveReason, 'autosave'>) =>
    isUuid(id)
      ? rpc<{ ok: true; id: number | null } | null>('snapshot_invitation_draft', {
          p_id: id,
          p_owner_id: ownerId,
          p_reason: reason,
          p_max_saves: VERSIONS.maxSaves,
        })
      : Promise.resolve(null),

  duplicate: (id: string, ownerId: string) =>
    rpc<{ id: string; slug: string } | null>('duplicate_invitation', { p_id: id, p_owner_id: ownerId }),

  setArchived: (id: string, ownerId: string, archived: boolean) =>
    rpc<{ slug: string; status: InvitationStatus; updatedAt: string } | null>('set_invitation_archived', {
      p_id: id,
      p_owner_id: ownerId,
      p_archived: archived,
    }),

  /** The dashboard's replies (newest first, with attendees) and the notification mode; null if not the owner's. */
  responses: (id: string, ownerId: string) =>
    isUuid(id)
      ? rpc<{ notify: NotifyMode; responses: ResponseRecord[] } | null>('owner_responses', {
          p_id: id,
          p_owner_id: ownerId,
        })
      : Promise.resolve(null),

  deleteResponse: (id: string, ownerId: string, responseId: string) =>
    isUuid(id) && isUuid(responseId)
      ? rpc<boolean>('owner_delete_response', { p_id: id, p_owner_id: ownerId, p_response_id: responseId })
      : Promise.resolve(false),

  /** Matches a reply to a guest on the list (null: unmatches it): 'ok', 'taken', or null when not the owner's. */
  linkResponse: (id: string, ownerId: string, responseId: string, guestId: string | null) =>
    isUuid(id) && isUuid(responseId) && (guestId === null || isUuid(guestId))
      ? rpc<'ok' | 'taken' | null>('owner_link_response', {
          p_id: id,
          p_owner_id: ownerId,
          p_response_id: responseId,
          p_guest_id: guestId,
        })
      : Promise.resolve(null),

  setNotify: (id: string, ownerId: string, mode: NotifyMode) =>
    isUuid(id)
      ? rpc<boolean>('set_invitation_notify', { p_id: id, p_owner_id: ownerId, p_mode: mode })
      : Promise.resolve(false),

  async signedUpload(path: string): Promise<{ path: string; token: string; url: string }> {
    const { data, error } = await serviceDb().storage.from('invitation-media').createSignedUploadUrl(path);
    if (error || !data) throw new Error(`signed upload: ${error?.message ?? 'no data'}`);
    return { path: data.path, token: data.token, url: data.signedUrl };
  },
};

export type HostDb = typeof hostDb;
