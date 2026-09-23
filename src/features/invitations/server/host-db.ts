import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import { migrateDocument } from '../contracts/migrate';
import type { EventType, InvitationDocument, L10n, Locale, Palette } from '../contracts/types';

/**
 * Typed access to the host-app database functions (supabase/migrations/*_host_app.sql). Always the
 * service role + the verified user's id: every function checks ownership itself.
 */

export type InvitationStatus = 'draft' | 'published' | 'archived';

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
}

export type SaveDraftResult =
  | { ok: true; updatedAt: string }
  | { ok: false; code: 'conflict'; updatedAt: string; draft: InvitationDocument }
  | null;

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
  if (error) throw new Error(`${fn}: ${error.message}`);
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
  ) =>
    rpc<{ id: string; slug: string }>('create_invitation', {
      p_owner_id: ownerId,
      p_template_id: templateId,
      p_event_type: eventType,
      p_slug: slug,
      p_draft: draft,
    }),

  saveDraft: (id: string, ownerId: string, draft: InvitationDocument, expectedUpdatedAt: string) =>
    rpc<SaveDraftResult>('save_invitation_draft', {
      p_id: id,
      p_owner_id: ownerId,
      p_draft: draft,
      p_expected_updated_at: expectedUpdatedAt,
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

  duplicate: (id: string, ownerId: string) =>
    rpc<{ id: string; slug: string } | null>('duplicate_invitation', { p_id: id, p_owner_id: ownerId }),

  setArchived: (id: string, ownerId: string, archived: boolean) =>
    rpc<{ slug: string; status: InvitationStatus; updatedAt: string } | null>('set_invitation_archived', {
      p_id: id,
      p_owner_id: ownerId,
      p_archived: archived,
    }),

  async signedUpload(path: string): Promise<{ path: string; token: string; url: string }> {
    const { data, error } = await serviceDb().storage.from('invitation-media').createSignedUploadUrl(path);
    if (error || !data) throw new Error(`signed upload: ${error?.message ?? 'no data'}`);
    return { path: data.path, token: data.token, url: data.signedUrl };
  },
};

export type HostDb = typeof hostDb;
