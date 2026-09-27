import { describe, expect, it, vi } from 'vitest';
import { migrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument, Locale, Section } from '@/features/invitations/contracts/types';
import { describeChanges, sectionFields } from '@/features/invitations/lib/doc-diff';
import { VERSIONS } from '@/features/invitations/lib/versions';
import {
  getEntry,
  listHistory,
  restoreEntry,
  saveDraft,
  snapshotDraft,
  type HostDeps,
} from '@/features/invitations/server/host-api';
import { hostDb, type HostDb, type OwnerInvitation } from '@/features/invitations/server/host-db';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { getTemplate, TEMPLATES } from '@/features/invitations/templates/registry';
import { seedDocument } from '@/features/invitations/templates/seed-document';

// Every save recoverable (Phase 5C): what restoring a version would change, in the host's terms, and
// the history's API — saves that tell the review page, restores and snapshots — in every language
// (Russian, Arabic and Amharic too: each language's texts compared and brought back whole).

vi.mock('server-only', () => ({}));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));

const doc = () => structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
const byId = (d: InvitationDocument, id: string) => d.sections.find((s) => s.id === id)!;

describe('what restoring changes', () => {
  it('nothing for the same document', () => {
    expect(describeChanges(doc(), doc())).toEqual([]);
  });

  it('the design: another template, colors, fonts, style, the opening, the cover, the music', () => {
    const now = doc();
    const then = doc();
    then.templateId = 'caesarea-shore';
    then.theme = {
      ...then.theme,
      palette: { accent: '#123456' },
      fontPairId: 'lib-modern',
      tokens: { motion: 0.5 },
    };
    then.cover = { ...then.cover, opening: 'gate', monogram: { he: 'א', en: 'A' } };
    then.music = { ...then.music, volume: 0.2 };
    expect(describeChanges(now, then).map((c) => c.kind)).toEqual([
      'template',
      'palette',
      'fonts',
      'style',
      'opening',
      'cover',
      'music',
    ]);
  });

  it('the event, names, languages and sharing', () => {
    const then = doc();
    then.hosts = { ...then.hosts, primary: { he: 'שירה', en: 'Shira' } };
    then.event = { ...then.event, startTime: '20:00' };
    then.defaultLocale = 'en';
    then.share = { ...then.share, noindex: false };
    expect(describeChanges(doc(), then).map((c) => c.kind)).toEqual(['hosts', 'event', 'languages', 'share']);
  });

  it('per section: brought back, removed, shown, hidden, changed (text, photo, layout, motion, colors, settings) and the order', () => {
    const now = doc();
    const then = doc();
    const ids = then.sections.map((s) => s.id);
    const moving = then.sections.find((s) => s.type === 'venues')!;
    // "removed" (not in the version), "added" (only in the version)
    now.sections.splice(1, 0, { ...structuredClone(moving), id: 'extra-venues' } as Section);
    then.sections = then.sections.filter((s) => s.type !== 'faq');
    const faq = now.sections.find((s) => s.type === 'faq');
    const countdown = byId(
      then,
      ids.find((id) => byId(then, id).type === 'countdown')!,
    );
    countdown.enabled = !countdown.enabled;
    const story = then.sections.find((s) => s.type === 'text')!;
    if (story.type === 'text') story.data = { ...story.data, body: { he: 'אחר', en: 'Other' } };
    story.media = { kind: 'image', src: 'upload:x/y.jpg', poster: null, focalPoint: { x: 0.5, y: 0.5 } };
    story.layout = 'full_bleed';
    story.animation = {
      enter: { preset: 'zoom', duration: 900, delay: 0, distance: 40, easing: 'smooth' },
      scroll: 'none',
      text: 'none',
      stagger: 80,
      intensity: 1,
    };
    story.themeOverrides = { palette: { bg: '#000000' } };
    const rsvp = then.sections.find((s) => s.type === 'rsvp')!;
    if (rsvp.type === 'rsvp') rsvp.data = { ...rsvp.data, maxAdults: 9 };
    const changes = describeChanges(now, then);
    const kinds = changes.map((c) => [c.kind, 'section' in c ? c.section.id : null]);
    expect(kinds).toContainEqual(['removed', 'extra-venues']);
    if (faq) expect(kinds).toContainEqual(['removed', faq.id]);
    expect(kinds).toContainEqual([countdown.enabled ? 'shown' : 'hidden', countdown.id]);
    expect(changes.find((c) => c.kind === 'changed' && c.section.id === story.id)).toMatchObject({
      fields: ['text', 'media', 'layout', 'motion', 'colors'],
    });
    expect(changes.find((c) => c.kind === 'changed' && c.section.id === rsvp.id)).toMatchObject({
      fields: ['settings'],
    });
    // the same sections in another order
    const reordered = doc();
    const [a, b] = [reordered.sections[1]!, reordered.sections[2]!];
    reordered.sections[1] = b;
    reordered.sections[2] = a;
    expect(describeChanges(doc(), reordered).map((c) => c.kind)).toEqual(['order']);
  });

  it('a list item added counts as its text and a setting', () => {
    const now = doc();
    const then = doc();
    const timeline = then.sections.find((s) => s.type === 'timeline');
    if (timeline?.type !== 'timeline') return;
    timeline.data.items.push({
      id: 'new',
      time: '23:00',
      label: { he: 'ריקודים', en: 'Dancing' },
      icon: 'music',
    });
    expect(sectionFields(byId(now, timeline.id), timeline)).toEqual(['text', 'settings']);
  });
});

// ─── the API ─────────────────────────────────────────────────────────────────────────────────────

const USER = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';

function invitation(over: Partial<OwnerInvitation> = {}): OwnerInvitation {
  const draft = doc();
  return {
    id: ID,
    slug: draft.share.slug,
    status: 'draft',
    templateId: draft.templateId,
    eventType: draft.eventType,
    draft,
    published: null,
    version: 0,
    publishedAt: null,
    updatedAt: '2026-09-23T09:00:00.000001+00:00',
    createdAt: '2026-09-23T08:00:00+00:00',
    sourceSlug: null,
    ...over,
  };
}

function deps(db: Partial<Record<keyof HostDb, unknown>> = {}, over: Partial<HostDeps> = {}) {
  const mock = {
    get: vi.fn(async () => invitation()),
    saveDraft: vi.fn(async () => ({ ok: true, updatedAt: 'new', kept: true, reviewChannel: null })),
    history: vi.fn(async () => [
      {
        id: 7,
        kind: 'save',
        version: null,
        reason: 'autosave',
        templateId: 'sahar-bordeaux',
        createdAt: 'x',
      },
    ]),
    entry: vi.fn(async () => ({
      entry: {
        id: 7,
        kind: 'save',
        version: null,
        reason: 'autosave',
        templateId: 'sahar-bordeaux',
        createdAt: 'x',
      },
      document: doc(),
    })),
    restoreEntry: vi.fn(async () => ({
      draft: doc(),
      updatedAt: 'restored',
      reviewChannel: 'review-channel-123456',
    })),
    snapshot: vi.fn(async () => ({ ok: true, id: 9 })),
    ...db,
  } as unknown as HostDb;
  return {
    db: mock,
    template: getTemplate,
    revalidate: vi.fn(),
    now: () => Date.now(),
    broadcast: vi.fn(async () => true),
    ...over,
  } satisfies HostDeps;
}

describe('the history API', () => {
  it('autosave: saves through the tracked save and tells the open review pages', async () => {
    const d = deps({
      saveDraft: vi.fn(async () => ({
        ok: true,
        updatedAt: 'new',
        reviewChannel: 'review-channel-abcdefgh',
      })),
    });
    const res = await saveDraft(USER, ID, { draft: doc(), updatedAt: 'old' }, d);
    expect(res).toEqual({ status: 200, body: { ok: true, updatedAt: 'new' } });
    expect(d.broadcast).toHaveBeenCalledWith('review-channel-abcdefgh', 'draft');
    const quiet = deps();
    await saveDraft(USER, ID, { draft: doc(), updatedAt: 'old' }, quiet);
    expect(quiet.broadcast).not.toHaveBeenCalled();
  });

  it('autosave: another design this deployment has (an unlisted one only for admins, unless it is on it)', async () => {
    const other = { ...doc(), templateId: 'caesarea-shore' };
    expect((await saveDraft(USER, ID, { draft: other, updatedAt: 'old' }, deps())).status).toBe(200);
    const unknown = { ...doc(), templateId: 'no-such-design' };
    expect((await saveDraft(USER, ID, { draft: unknown, updatedAt: 'old' }, deps())).body).toMatchObject({
      code: 'invalid',
      issues: ['templateId'],
    });
    const lumiere = { ...doc(), templateId: 'lumiere' };
    expect(
      (await saveDraft(USER, ID, { draft: lumiere, updatedAt: 'old' }, deps({}, { admin: false }))).status,
    ).toBe(422);
    expect(
      (await saveDraft(USER, ID, { draft: lumiere, updatedAt: 'old' }, deps({}, { admin: true }))).status,
    ).toBe(200);
    const onIt = deps({ get: vi.fn(async () => invitation({ templateId: 'lumiere' })) }, { admin: false });
    expect((await saveDraft(USER, ID, { draft: lumiere, updatedAt: 'old' }, onIt)).status).toBe(200);
  });

  it('lists the history with the keeping rules; one entry with its document', async () => {
    const d = deps();
    expect((await listHistory(USER, ID, d)).body).toMatchObject({
      ok: true,
      entries: [{ id: 7, kind: 'save' }],
      keep: { days: VERSIONS.keepSavesDays, max: VERSIONS.maxSaves },
    });
    expect((await listHistory(USER, ID, deps({ get: vi.fn(async () => null) }))).status).toBe(404);
    expect((await getEntry(USER, ID, 7, d)).body).toMatchObject({ ok: true, entry: { id: 7 } });
    expect((await getEntry(USER, ID, 0, d)).status).toBe(400);
    expect((await getEntry(USER, ID, Number('x'), d)).status).toBe(400);
    expect((await getEntry(USER, ID, 7, deps({ entry: vi.fn(async () => null) }))).status).toBe(404);
  });

  it('restores an entry (the review pages are told) and keeps a snapshot on request', async () => {
    const d = deps();
    const res = await restoreEntry(USER, ID, 7, d);
    expect(res.body).toMatchObject({ ok: true, updatedAt: 'restored' });
    expect(d.db.restoreEntry).toHaveBeenCalledWith(ID, USER, 7);
    expect(d.broadcast).toHaveBeenCalledWith('review-channel-123456', 'draft');
    expect((await restoreEntry(USER, ID, 7, deps({ restoreEntry: vi.fn(async () => null) }))).status).toBe(
      404,
    );
    expect((await snapshotDraft(USER, ID, { reason: 'concept' }, d)).body).toEqual({ ok: true, kept: true });
    expect(d.db.snapshot).toHaveBeenCalledWith(ID, USER, 'concept');
    expect((await snapshotDraft(USER, ID, { reason: 'autosave' }, d)).status).toBe(400);
    expect(
      (await snapshotDraft(USER, ID, { reason: 'concept' }, deps({ snapshot: vi.fn(async () => null) })))
        .status,
    ).toBe(404);
  });
});

// ─── every language ──────────────────────────────────────────────────────────────────────────────

describe('versions in every language (Russian, Arabic, Amharic)', () => {
  const MORE: Locale[] = ['ru', 'ar', 'am'];
  const { manifest, defaults } = TEMPLATES.get('sahar-bordeaux')!;
  /** A wedding in Hebrew, English, Russian, Arabic and Amharic, its texts written in each. */
  const many = () =>
    seedDocument(manifest, defaults, {
      eventType: 'wedding',
      locales: ['he', 'en', 'ru', 'ar', 'am'],
      defaultLocale: 'he',
      hosts: {
        primary: { he: 'נועה', en: 'Noa', ru: 'Ноа', ar: 'نوعا', am: 'ኖዓ' },
        secondary: { he: 'איתי', en: 'Itay', ru: 'Итай', ar: 'إيتاي', am: 'ኢታይ' },
      },
      date: '2027-06-17',
      startTime: '19:30',
      endTime: '01:00',
      timezone: 'Asia/Jerusalem',
    });
  const isL10n = (v: Record<string, unknown>) =>
    Object.keys(v).length > 0 &&
    Object.entries(v).every(([k, x]) => /^[a-z]{2}$/.test(k) && typeof x === 'string');
  /** Every text of `value` in one language (each L10n's value for it), in the document's order. */
  const textsIn = (value: unknown, l: Locale, out: string[] = []): string[] => {
    if (Array.isArray(value)) for (const v of value) textsIn(v, l, out);
    else if (value && typeof value === 'object') {
      const o = value as Record<string, unknown>;
      if (isL10n(o)) {
        if (typeof o[l] === 'string') out.push(o[l] as string);
      } else for (const v of Object.values(o)) textsIn(v, l, out);
    }
    return out;
  };
  /** Changes the first text of `value` written in `l` (only that language's), and says whether it did. */
  const editFirst = (value: unknown, l: Locale, text: string): boolean => {
    if (Array.isArray(value)) return value.some((v) => editFirst(v, l, text));
    if (!value || typeof value !== 'object') return false;
    const o = value as Record<string, unknown>;
    if (isL10n(o)) {
      if (typeof o[l] !== 'string' || !o[l]) return false;
      o[l] = text;
      return true;
    }
    return Object.values(o).some((v) => editFirst(v, l, text));
  };

  it('the document has its texts in each of them', () => {
    const d = many();
    for (const l of MORE) expect(textsIn(d.sections, l).filter(Boolean).length, l).toBeGreaterThan(5);
  });

  it('a text changed in one language is its section’s text — nothing else', () => {
    for (const l of MORE) {
      const now = many();
      const then = many();
      const section = then.sections.find((s) => editFirst(s.data, l, `${l}: another text`))!;
      expect(section, l).toBeTruthy();
      expect(describeChanges(now, then), l).toEqual([{ kind: 'changed', section, fields: ['text'] }]);
      // in the other languages the section reads as before
      for (const other of ['he', 'en', ...MORE.filter((x) => x !== l)] as Locale[])
        expect(textsIn(section.data, other)).toEqual(textsIn(byId(now, section.id).data, other));
    }
  });

  it('a list item’s label in Amharic, the hosts in Russian, and the languages themselves', () => {
    const now = many();
    const then = many();
    const timeline = then.sections.find((s) => s.type === 'timeline');
    if (timeline?.type === 'timeline') {
      timeline.data.items[0]!.label = { ...timeline.data.items[0]!.label, am: 'ሌላ' };
      expect(sectionFields(byId(now, timeline.id), timeline)).toEqual(['text']);
    }
    const hosts = many();
    hosts.hosts = { ...hosts.hosts, primary: { ...hosts.hosts.primary, ru: 'Шира' } };
    expect(describeChanges(now, hosts).map((c) => c.kind)).toEqual(['hosts']);
    // a language removed, or another one first
    const fewer = many();
    fewer.locales = ['he', 'en', 'ru', 'ar'];
    expect(describeChanges(now, fewer).map((c) => c.kind)).toEqual(['languages']);
    const arabicFirst = many();
    arabicFirst.defaultLocale = 'ar';
    expect(describeChanges(now, arabicFirst).map((c) => c.kind)).toEqual(['languages']);
  });

  it('a saved entry comes back whole, every language’s texts in place: read, restored, saved again', async () => {
    const d = many();
    // what the database keeps and hands back (JSON), read the way the history reads it
    const stored = JSON.parse(JSON.stringify(d)) as unknown;
    const entry = { id: 7, kind: 'save', version: null, reason: 'autosave', createdAt: 'x' };
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: { ...entry, document: stored }, error: null });
    const read = await hostDb.entry(ID, USER, 7);
    expect(read!.document).toEqual(d);
    expect(describeChanges(d, read!.document)).toEqual([]);
    rpc.mockResolvedValueOnce({
      data: { ok: true, draft: stored, updatedAt: 'restored', reviewChannel: null },
      error: null,
    });
    const restored = await hostDb.restoreEntry(ID, USER, 7);
    expect(rpc).toHaveBeenLastCalledWith('restore_invitation_entry', {
      p_id: ID,
      p_owner_id: USER,
      p_entry_id: 7,
      p_max_saves: VERSIONS.maxSaves,
    });
    expect(restored!.draft).toEqual(d);
    for (const l of MORE) expect(textsIn(restored!.draft, l)).toEqual(textsIn(d, l));
    expect(restored!.draft.locales).toEqual(['he', 'en', 'ru', 'ar', 'am']);
    // the API hands it on as it came, and the next autosave keeps every language
    const d2 = deps({
      restoreEntry: vi.fn(async () => restored!),
      get: vi.fn(async () => invitation({ draft: restored!.draft })),
    });
    expect((await restoreEntry(USER, ID, 7, d2)).body).toMatchObject({ ok: true, draft: d });
    expect((await saveDraft(USER, ID, { draft: restored!.draft, updatedAt: 'restored' }, d2)).status).toBe(
      200,
    );
    const [, , saved] = (d2.db.saveDraft as ReturnType<typeof vi.fn>).mock.calls[0]! as [
      string,
      string,
      InvitationDocument,
    ];
    expect(migrateDocument(saved)).toEqual(d);
  });
});
