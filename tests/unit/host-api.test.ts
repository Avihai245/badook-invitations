import { describe, expect, it, vi } from 'vitest';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import {
  checkSlug,
  createFollowUp,
  createInvitation,
  createUpload,
  duplicate,
  publish,
  restoreVersion,
  saveDraft,
  setArchived,
  type HostDeps,
} from '@/features/invitations/server/host-api';
import type { HostDb, OwnerInvitation } from '@/features/invitations/server/host-db';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { getTemplate } from '@/features/invitations/templates/registry';

const USER = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-09-23T10:00:00Z');

function invitation(
  over: Partial<OwnerInvitation> = {},
  mutate?: (d: InvitationDocument) => void,
): OwnerInvitation {
  const draft = structuredClone(FIXTURES['wedding-he-en']);
  mutate?.(draft);
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

/** Each database function is a vitest mock that still type-checks as the real HostDb function. */
type MockDb = { [K in keyof HostDb]: HostDb[K] & ReturnType<typeof vi.fn> };

function deps(db: Partial<Record<keyof HostDb, unknown>> = {}) {
  const mock = {
    list: vi.fn(),
    get: vi.fn(async () => invitation()),
    create: vi.fn(async (_u: string, _t: string, _e: string, slug: string) => ({ id: ID, slug })),
    saveDraft: vi.fn(async () => ({ ok: true, updatedAt: 'new' })),
    slugAvailable: vi.fn(async () => true),
    setSlug: vi.fn(async (_i: string, _o: string, slug: string) => ({ ok: true, slug, updatedAt: 'x' })),
    publish: vi.fn(async () => ({ slug: 'noa-and-itay', version: 1, publishedAt: 'p', updatedAt: 'u' })),
    versions: vi.fn(async () => []),
    version: vi.fn(async () => null),
    restore: vi.fn(async () => true),
    duplicate: vi.fn(async () => ({ id: 'copy', slug: 'x-copy' })),
    setArchived: vi.fn(async () => ({ slug: 'noa-and-itay', status: 'archived', updatedAt: 'u' })),
    signedUpload: vi.fn(async (path: string) => ({ path, token: 'tok', url: `https://s/${path}?token=tok` })),
    responses: vi.fn(async () => ({ notify: 'each', responses: [] })),
    deleteResponse: vi.fn(async () => true),
    setNotify: vi.fn(async () => true),
    ...db,
  } as unknown as MockDb;
  return {
    db: mock,
    template: getTemplate,
    revalidate: vi.fn<(slug: string) => void>(),
    now: () => NOW,
  } satisfies HostDeps;
}

const wizard = (over: Record<string, unknown> = {}) => ({
  templateId: 'sahar-bordeaux',
  eventType: 'wedding',
  locales: ['he', 'en'],
  defaultLocale: 'he',
  hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
  date: '2027-06-17',
  startTime: '19:30',
  endTime: '01:00',
  timezone: 'Asia/Jerusalem',
  ...over,
});

describe('create (wizard)', () => {
  it('seeds a draft from the template and a slug from the names', async () => {
    const d = deps();
    const r = await createInvitation(USER, wizard(), d);
    expect(r).toEqual({ status: 201, body: { ok: true, id: ID, slug: 'noa-and-itay' } });
    const [owner, template, eventType, slug, draft] = d.db.create.mock.calls[0]!;
    expect([owner, template, eventType, slug]).toEqual([USER, 'sahar-bordeaux', 'wedding', 'noa-and-itay']);
    const doc = draft as InvitationDocument;
    expect(doc.hosts.primary).toEqual({ he: 'נועה', en: 'Noa' });
    expect(doc.share.slug).toBe('noa-and-itay');
    expect(doc.sections[0]!.type).toBe('hero');
    expect(doc.cover.monogram).toEqual({ he: 'נ&א', en: 'N&I' });
  });

  it('rejects what the template or the event type can’t take', async () => {
    const d = deps();
    expect((await createInvitation(USER, wizard({ eventType: 'birthday' }), d)).body).toMatchObject({
      code: 'invalid',
      issues: ['eventType'],
    });
    expect(
      (await createInvitation(USER, wizard({ hosts: { primary: { he: 'נועה', en: 'Noa' } } }), d)).body,
    ).toMatchObject({
      issues: ['hosts.secondary'],
    });
    expect(
      (
        await createInvitation(
          USER,
          wizard({ hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } } }),
          d,
        )
      ).body,
    ).toMatchObject({
      issues: ['hosts.primary', 'hosts.secondary'],
    });
    expect((await createInvitation(USER, wizard({ templateId: 'nope' }), d)).status).toBe(400);
    expect(
      (await createInvitation(USER, wizard({ defaultLocale: 'en', locales: ['he'] }), d)).body,
    ).toMatchObject({
      issues: ['defaultLocale'],
    });
    expect((await createInvitation(USER, { ...wizard(), extra: 1 }, d)).status).toBe(400);
    expect(d.db.create).not.toHaveBeenCalled();
  });

  it('birthday on a ticket cover: name + age as the ticket text, shortened to fit', async () => {
    const d = deps();
    await createInvitation(
      USER,
      wizard({
        templateId: 'rooftop-dusk',
        eventType: 'birthday',
        hosts: { primary: { he: 'דנה', en: 'Dana' } },
        age: 30,
      }),
      d,
    );
    const doc = d.db.create.mock.calls[0]![4] as InvitationDocument;
    expect(doc.cover.monogram).toEqual({ he: 'דנה 30', en: 'DANA 30' });
    expect(doc.hosts.secondary).toBeNull();
    await createInvitation(
      USER,
      wizard({
        templateId: 'rooftop-dusk',
        eventType: 'birthday',
        hosts: { primary: { he: 'x', en: 'Bartholomew-Alexander' } },
        age: 40,
        locales: ['en'],
        defaultLocale: 'en',
      }),
      d,
    );
    expect((d.db.create.mock.calls[1]![4] as InvitationDocument).cover.monogram).toEqual({
      en: 'BARTHOLOM 40',
    });
  });

  it('birthday on a seal cover: the age is the monogram when it fits', async () => {
    const d = deps();
    const input = {
      templateId: 'honey-meadow',
      eventType: 'birthday',
      hosts: { primary: { he: 'דנה', en: 'Dana' } },
    };
    await createInvitation(USER, wizard({ ...input, age: 30 }), d);
    expect((d.db.create.mock.calls[0]![4] as InvitationDocument).cover.monogram).toEqual({
      he: '30',
      en: '30',
    });
    await createInvitation(USER, wizard({ ...input, age: 100 }), d);
    expect((d.db.create.mock.calls[1]![4] as InvitationDocument).cover.monogram).toEqual({
      he: '100',
      en: '100',
    });
    await createInvitation(USER, wizard(input), d);
    expect((d.db.create.mock.calls[2]![4] as InvitationDocument).cover.monogram).toEqual({
      he: 'ד',
      en: 'D',
    });
  });

  it('applies the palette preset and font pair chosen in the gallery preview', async () => {
    const d = deps();
    await createInvitation(USER, wizard({ paletteId: 'midnight', fontPairId: 'modern-serif' }), d);
    const doc = d.db.create.mock.calls[0]![4] as InvitationDocument;
    expect(doc.theme).toEqual({ fontPairId: 'modern-serif', palette: { ink: '#16263D', accent: '#1F3A5F' } });
    expect((await createInvitation(USER, wizard({ paletteId: 'neon' }), d)).body).toMatchObject({
      issues: ['paletteId'],
    });
    expect((await createInvitation(USER, wizard({ fontPairId: 'comic' }), d)).body).toMatchObject({
      issues: ['fontPairId'],
    });
    // a pair from the font library ("More fonts")
    await createInvitation(USER, wizard({ fontPairId: 'lib-typewriter' }), d);
    expect((d.db.create.mock.calls[1]![4] as InvitationDocument).theme.fontPairId).toBe('lib-typewriter');
  });

  it('falls back to a random slug when the names give none', async () => {
    const d = deps();
    await createInvitation(
      USER,
      wizard({
        locales: ['en'],
        defaultLocale: 'en',
        hosts: { primary: { en: '🎉' }, secondary: { en: '🎈' } },
      }),
      d,
    );
    expect(d.db.create.mock.calls[0]![3]).toMatch(/^invite-[0-9a-f]{6}$/);
  });
});

describe('save-the-date flow', () => {
  const saveTheDate = (over: Partial<OwnerInvitation> = {}) => {
    const draft = structuredClone(FIXTURES['savethedate-he']);
    return invitation({ slug: draft.share.slug, eventType: 'save_the_date', draft, ...over });
  };

  it('a new save-the-date leaves the plain slug to its full invitation', async () => {
    const d = deps();
    const r = await createInvitation(USER, wizard({ eventType: 'save_the_date' }), d);
    expect(r.body).toMatchObject({ ok: true, slug: 'noa-and-itay-save-the-date' });
  });

  it('creates the full invitation: same template, the event type asked for, the plain slug', async () => {
    const d = deps({ get: vi.fn(async () => saveTheDate()) });
    const r = await createFollowUp(USER, ID, { eventType: 'wedding' }, d);
    expect(r).toEqual({ status: 201, body: { ok: true, id: ID, slug: 'noa-and-itay' } });
    expect(d.db.get).toHaveBeenCalledWith(ID, USER);
    const [owner, template, eventType, slug, draft, source] = d.db.create.mock.calls[0]!;
    expect(source).toBe(ID); // the save-the-date links to it once it is published
    expect([owner, template, eventType, slug]).toEqual([USER, 'sahar-bordeaux', 'wedding', 'noa-and-itay']);
    const doc = draft as InvitationDocument;
    expect(doc.eventType).toBe('wedding');
    expect(doc.share.slug).toBe('noa-and-itay');
    expect(doc.hosts.primary).toEqual({ he: 'נועה' });
    expect(doc.sections.some((s) => s.type === 'rsvp' && s.enabled)).toBe(true);
  });

  it('a save-the-date slug without the suffix → one from the names (the database makes it unique)', async () => {
    const d = deps({ get: vi.fn(async () => saveTheDate({ slug: 'noa-itay-2027' })) });
    await createFollowUp(USER, ID, { eventType: 'engagement' }, d);
    expect(d.db.create.mock.calls[0]![3]).toBe('noa-and-aiti'); // he-only names, transliterated
  });

  it('only for the owner’s save-the-date, to an event its template offers', async () => {
    const missing = deps({ get: vi.fn(async () => null) });
    expect((await createFollowUp(USER, ID, { eventType: 'wedding' }, missing)).status).toBe(404);
    const wedding = deps();
    expect(await createFollowUp(USER, ID, { eventType: 'wedding' }, wedding)).toEqual({
      status: 409,
      body: { ok: false, code: 'not_save_the_date' },
    });
    for (const body of [{ eventType: 'save_the_date' }, { eventType: 'birthday' }, { eventType: 'x' }, {}]) {
      const d = deps({ get: vi.fn(async () => saveTheDate()) });
      expect((await createFollowUp(USER, ID, body, d)).status).toBe(400);
      expect(d.db.create).not.toHaveBeenCalled();
    }
  });
});

describe('a save-the-date’s full invitation', () => {
  it('publishing or archiving it refreshes the save-the-date’s page too', async () => {
    const d = deps({
      get: vi.fn(async () =>
        invitation({ sourceSlug: 'noa-and-itay-save-the-date' }, (doc) => {
          for (const s of doc.sections)
            if (s.type === 'venues')
              for (const v of s.data.items) {
                v.name = { he: 'אחוזה', en: 'Estate' };
                v.address = { he: 'רחוב 1', en: '1 Street' };
              }
        }),
      ),
    });
    const r = await publish(USER, ID, {}, d);
    expect(r.status).toBe(200);
    expect(d.revalidate).toHaveBeenCalledWith('noa-and-itay-save-the-date');
    d.revalidate.mockClear();
    await setArchived(USER, ID, { archived: true }, d);
    expect(d.revalidate).toHaveBeenCalledWith('noa-and-itay-save-the-date');
  });
});

describe('autosave', () => {
  it('saves a structurally valid draft; 409 with the server draft on conflict; 404 for others', async () => {
    const draft = FIXTURES['wedding-he-en'];
    expect(await saveDraft(USER, ID, { draft, updatedAt: 'a' }, deps())).toEqual({
      status: 200,
      body: { ok: true, updatedAt: 'new' },
    });
    const conflict = deps({
      saveDraft: vi.fn(async () => ({ ok: false, code: 'conflict', updatedAt: 'b', draft })),
    });
    expect(await saveDraft(USER, ID, { draft, updatedAt: 'a' }, conflict)).toMatchObject({
      status: 409,
      body: { code: 'conflict', updatedAt: 'b', draft },
    });
    expect(
      (await saveDraft(USER, ID, { draft, updatedAt: 'a' }, deps({ saveDraft: vi.fn(async () => null) })))
        .status,
    ).toBe(404);
  });

  it('rejects malformed drafts before touching the database', async () => {
    const d = deps();
    expect((await saveDraft(USER, ID, { draft: { nope: true }, updatedAt: 'a' }, d)).status).toBe(422);
    expect((await saveDraft(USER, ID, { draft: FIXTURES['wedding-he-en'] }, d)).status).toBe(400);
    expect(d.db.saveDraft).not.toHaveBeenCalled();
  });
});

describe('publish', () => {
  it('blocking errors → 422 with the issue list; nothing is written', async () => {
    const d = deps({
      get: vi.fn(async () =>
        invitation({}, (doc) => {
          doc.hosts.primary = { he: 'נועה' };
        }),
      ),
    });
    const r = await publish(USER, ID, {}, d);
    expect(r.status).toBe(422);
    expect((r.body as { issues: { path: string }[] }).issues.map((i) => i.path)).toEqual([
      'hosts.primary.en',
    ]);
    expect(d.db.setSlug).not.toHaveBeenCalled();
    expect(d.db.publish).not.toHaveBeenCalled();
  });

  it('publishes, applies a new slug first and refreshes both the new and the old public page', async () => {
    const d = deps({
      get: vi.fn(async () => invitation({ status: 'published', slug: 'old-slug' })),
      publish: vi.fn(async () => ({ slug: 'new-slug', version: 3, publishedAt: 'p', updatedAt: 'u' })),
    });
    const r = await publish(USER, ID, { slug: 'new-slug' }, d);
    expect(r).toMatchObject({
      status: 200,
      body: { ok: true, slug: 'new-slug', version: 3, updatedAt: 'u' },
    });
    expect(d.db.setSlug).toHaveBeenCalledWith(ID, USER, 'new-slug');
    expect(d.revalidate.mock.calls).toEqual([['new-slug'], ['old-slug']]);
  });

  it('a taken or malformed slug stops before publishing', async () => {
    const taken = deps({ setSlug: vi.fn(async () => ({ ok: false, code: 'taken' })) });
    expect((await publish(USER, ID, { slug: 'someone-else' }, taken)).body).toMatchObject({
      code: 'slug_taken',
    });
    expect(taken.db.publish).not.toHaveBeenCalled();
    const bad = deps();
    const r = await publish(USER, ID, { slug: 'Not Valid' }, bad);
    expect(r.status).toBe(422);
    expect(bad.db.setSlug).not.toHaveBeenCalled();
  });

  it('unknown or foreign invitation → 404', async () => {
    expect((await publish(USER, ID, {}, deps({ get: vi.fn(async () => null) }))).status).toBe(404);
  });
});

describe('uploads', () => {
  it('only whitelisted types within their size limit; path under the owner and invitation', async () => {
    const d = deps();
    expect((await createUpload(USER, ID, { contentType: 'image/gif', size: 10 }, d)).status).toBe(415);
    expect(
      (await createUpload(USER, ID, { contentType: 'image/jpeg', size: 9 * 1024 * 1024 }, d)).status,
    ).toBe(413);
    expect(
      (await createUpload(USER, ID, { contentType: 'video/mp4', size: 16 * 1024 * 1024 }, d)).status,
    ).toBe(413);
    const r = await createUpload(USER, ID, { contentType: 'video/mp4', size: 14 * 1024 * 1024 }, d);
    expect(r.status).toBe(200);
    const body = r.body as { path: string; ref: string; kind: string; token: string };
    expect(body.path).toMatch(new RegExp(`^${USER}/${ID}/[0-9a-f-]{36}\\.mp4$`));
    expect(body.ref).toBe(`upload:${body.path}`);
    expect(body).toMatchObject({ kind: 'video', token: 'tok' });
    expect(
      (
        await createUpload(
          USER,
          ID,
          { contentType: 'image/png', size: 5 },
          deps({ get: vi.fn(async () => null) }),
        )
      ).status,
    ).toBe(404);
  });
});

describe('slug, restore, archive', () => {
  it('slug check', async () => {
    expect((await checkSlug('Bad Slug', null, deps())).body).toEqual({
      ok: true,
      valid: false,
      available: false,
    });
    const d = deps({ slugAvailable: vi.fn(async () => false) });
    expect((await checkSlug('noa-and-itay', ID, d)).body).toEqual({
      ok: true,
      valid: true,
      available: false,
    });
    expect(d.db.slugAvailable).toHaveBeenCalledWith('noa-and-itay', ID);
  });

  it('restore returns the new draft and updatedAt', async () => {
    expect((await restoreVersion(USER, ID, 0, deps())).status).toBe(400);
    expect((await restoreVersion(USER, ID, 2, deps({ restore: vi.fn(async () => false) }))).status).toBe(404);
    const r = await restoreVersion(USER, ID, 2, deps());
    expect(r.body).toMatchObject({ ok: true, updatedAt: '2026-09-23T09:00:00.000001+00:00' });
  });

  it('archiving refreshes the public page', async () => {
    const d = deps();
    expect((await setArchived(USER, ID, { archived: true }, d)).body).toMatchObject({ status: 'archived' });
    expect(d.revalidate).toHaveBeenCalledWith('noa-and-itay');
    expect((await setArchived(USER, ID, {}, d)).status).toBe(400);
  });
});

describe('the plan’s limits', () => {
  const limits = (
    over: Partial<{
      activeInvitations: number | null;
      used: number;
      premiumTemplates: boolean;
      removeBranding: boolean;
    }> = {},
  ) =>
    vi.fn(async () => ({
      activeInvitations: 1 as number | null,
      used: 0,
      premiumTemplates: false,
      removeBranding: false,
      ...over,
    }));

  it('a new invitation needs room in the plan (free: one active at a time)', async () => {
    const full = { ...deps(), entitlements: limits({ used: 1 }) };
    expect(await createInvitation(USER, wizard(), full)).toEqual({
      status: 402,
      body: { ok: false, code: 'plan_limit', limit: 1 },
    });
    expect(full.db.create).not.toHaveBeenCalled();
    const room = { ...deps(), entitlements: limits({ used: 0 }) };
    expect((await createInvitation(USER, wizard(), room)).status).toBe(201);
    const unlimited = { ...deps(), entitlements: limits({ activeInvitations: null, used: 40 }) };
    expect((await createInvitation(USER, wizard(), unlimited)).status).toBe(201);
  });

  it('duplicating and bringing back from the archive count too; archiving never does', async () => {
    const full = {
      ...deps({ get: vi.fn(async () => invitation({ status: 'archived' })) }),
      entitlements: limits({ used: 1 }),
    };
    expect((await duplicate(USER, ID, full)).status).toBe(402);
    expect((await setArchived(USER, ID, { archived: false }, full)).status).toBe(402);
    expect((await setArchived(USER, ID, { archived: true }, full)).status).toBe(200);
    // a save-the-date's full invitation is part of the same event
    const followUp = {
      ...deps({
        get: vi.fn(async () => invitation({ status: 'archived', sourceSlug: 'noa-save-the-date' })),
      }),
      entitlements: limits({ used: 1 }),
    };
    expect((await setArchived(USER, ID, { archived: false }, followUp)).status).toBe(200);
  });

  it('a premium design is published only on a plan that includes it', async () => {
    const base = getTemplate('sahar-bordeaux')!;
    const premium = { ...base, manifest: { ...base.manifest, tier: 'premium' } } as typeof base;
    const free = {
      ...deps({ get: vi.fn(async () => invitation()) }),
      template: () => premium,
      entitlements: limits({ premiumTemplates: false }),
    };
    expect(await publish(USER, ID, {}, free)).toEqual({
      status: 402,
      body: { ok: false, code: 'premium_template' },
    });
    expect(free.db.publish).not.toHaveBeenCalled();
    const pro = { ...free, entitlements: limits({ premiumTemplates: true }) };
    expect((await publish(USER, ID, {}, pro)).status).toBe(200);
  });

  it('the "made with" credit comes off only on a plan that includes it', async () => {
    const noCredit = () =>
      invitation({}, (doc) => {
        for (const s of doc.sections) if (s.type === 'footer') s.data.showCredit = false;
      });
    const free = {
      ...deps({ get: vi.fn(async () => noCredit()) }),
      entitlements: limits({ removeBranding: false }),
    };
    expect(await publish(USER, ID, {}, free)).toEqual({ status: 402, body: { ok: false, code: 'branding' } });
    const pro = { ...free, entitlements: limits({ removeBranding: true }) };
    expect((await publish(USER, ID, {}, pro)).status).toBe(200);
    const withCredit = { ...deps(), entitlements: limits({ removeBranding: false }) };
    expect((await publish(USER, ID, {}, withCredit)).status).toBe(200);
  });
});
