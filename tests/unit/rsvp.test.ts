import { describe, expect, it, vi } from 'vitest';
import type { InvitationDocument, RsvpSubmission } from '@/features/invitations/contracts/types';
import type { PublishedInvitation } from '@/features/invitations/server/published';
import {
  MAX_BODY_BYTES,
  handleRsvp,
  sanitize,
  sha256,
  type RsvpDeps,
} from '@/features/invitations/server/rsvp';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { requireTemplate } from '@/features/invitations/templates/registry';

// §12.6 on the server side (the DB transaction itself is covered by tests/db).

const NOW = Date.parse('2027-05-01T10:00:00Z');

function invitation(mutate?: (doc: InvitationDocument) => void): PublishedInvitation {
  const doc = structuredClone(FIXTURES['wedding-he-en']);
  mutate?.(doc);
  return { id: 'inv-1', slug: doc.share.slug, doc, entry: requireTemplate(doc.templateId) };
}

type Overrides = {
  rateHit?: ReturnType<typeof vi.fn<RsvpDeps['rateHit']>>;
  submit?: ReturnType<typeof vi.fn<RsvpDeps['submit']>>;
  now?: () => number;
};

function deps(inv: PublishedInvitation | null = invitation(), overrides: Overrides = {}) {
  return {
    loadInvitation: vi.fn<RsvpDeps['loadInvitation']>(async () => inv),
    rateHit: overrides.rateHit ?? vi.fn<RsvpDeps['rateHit']>(async () => true),
    submit: overrides.submit ?? vi.fn<RsvpDeps['submit']>(async () => ({ id: 'resp-1', replaced: false })),
    now: overrides.now ?? (() => NOW),
    ipHashSalt: 'salt',
  };
}

const adult = (over: Partial<Extract<RsvpSubmission, { attending: true }>['adults'][number]> = {}) => ({
  firstName: 'Dana',
  lastName: 'Levi',
  phone: null as string | null,
  email: null as string | null,
  dietary: [] as never[],
  dietaryNotes: null as string | null,
  ...over,
});

function yes(over: Record<string, unknown> = {}) {
  return {
    invitationSlug: 'noa-and-itay',
    locale: 'en',
    hp: '',
    renderedAt: NOW - 20_000,
    answers: {},
    message: null,
    attending: true,
    adults: [adult({ phone: '050-123-4567' })],
    children: [],
    ...over,
  };
}

const call = (body: unknown, d = deps(), ip: string | null = '10.0.0.1') =>
  handleRsvp(typeof body === 'string' ? body : JSON.stringify(body), ip, d);

describe('RSVP endpoint rules', () => {
  it('yes with 2 adults + 1 child → one response with 3 attendees, sanitized, known answers only', async () => {
    const d = deps();
    const r = await call(
      yes({
        adults: [
          adult({ phone: '050-123-4567', dietary: ['vegan'] as never[] }),
          adult({ firstName: 'Tom', lastName: '<i>Levi</i>' }),
        ],
        children: [{ fullName: 'Noam', age: 6, dietary: ['kids_meal'], dietaryNotes: null }],
        answers: { shuttle: 'tlv', injected: 'x' },
        message: '<script>alert(1)</script>Mazal tov!',
      }),
      d,
    );
    expect(r).toEqual({
      status: 200,
      body: { ok: true, responseId: 'resp-1', editToken: expect.any(String) },
    });
    const input = d.submit.mock.calls[0]![0];
    expect(input.response).toMatchObject({
      attending: true,
      primary_name: 'Dana Levi',
      phone: '050-123-4567',
      adults_count: 2,
      children_count: 1,
      message: 'alert(1)Mazal tov!',
      answers: { shuttle: 'tlv' },
      ip_hash: sha256('salt:10.0.0.1'),
    });
    expect(input.attendees.map((a) => [a.kind, a.position, a.first_name ?? a.full_name])).toEqual([
      ['adult', 0, 'Dana'],
      ['adult', 1, 'Tom'],
      ['child', 0, 'Noam'],
    ]);
    expect(input.attendees[1]!.last_name).toBe('Levi');
    expect(input.newTokenHash).toBe(sha256(r.body.ok ? r.body.editToken : ''));
    expect(input.existingTokenHash).toBeNull();
  });

  it('honeypot filled → 200 with a fake success, nothing checked or stored', async () => {
    const d = deps();
    const r = await call(yes({ hp: 'http://spam' }), d);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(d.loadInvitation).not.toHaveBeenCalled();
    expect(d.submit).not.toHaveBeenCalled();
  });

  it('submitted < 3s after rendering → rejected; a client clock ahead of the server is not judged', async () => {
    expect((await call(yes({ renderedAt: NOW - 2_000 }))).body).toEqual({ ok: false, code: 'invalid' });
    expect((await call(yes({ renderedAt: NOW - 3_000 }))).body.ok).toBe(true);
    expect((await call(yes({ renderedAt: NOW + 60_000 }))).body.ok).toBe(true);
  });

  it('rejects oversized, malformed and off-contract payloads', async () => {
    expect((await call('x'.repeat(MAX_BODY_BYTES + 1))).status).toBe(413);
    expect((await call('{nope')).status).toBe(400);
    expect((await call(yes({ extra: 1 }))).status).toBe(400);
    expect((await call(yes({ adults: [] }))).status).toBe(400);
  });

  it('unknown invitation, disabled RSVP section, or a locale the invitation lacks', async () => {
    expect((await call(yes(), deps(null))).body).toEqual({ ok: false, code: 'not_found' });
    const disabled = invitation((doc) =>
      doc.sections.forEach((s) => s.type === 'rsvp' && (s.enabled = false)),
    );
    expect((await call(yes(), deps(disabled))).status).toBe(404);
    const heOnly = invitation((doc) => {
      doc.locales = ['he'];
      doc.defaultLocale = 'he';
    });
    expect((await call(yes(), deps(heOnly))).body).toEqual({ ok: false, code: 'invalid' });
  });

  it('rate limited → 429; the attempt is counted per invitation + hashed IP', async () => {
    const d = deps(invitation(), { rateHit: vi.fn<RsvpDeps['rateHit']>(async () => false) });
    expect((await call(yes(), d)).body).toEqual({ ok: false, code: 'rate_limited' });
    expect(d.rateHit).toHaveBeenCalledWith('inv-1', sha256('salt:10.0.0.1'));
    expect(d.submit).not.toHaveBeenCalled();
  });

  it('closed after the end of the deadline day in the invitation time zone', async () => {
    // deadline 2027-06-01 Asia/Jerusalem (UTC+3) → open until 2027-06-01T20:59:59.999Z
    const at = (iso: string) => deps(invitation(), { now: () => Date.parse(iso) });
    const renderedAt = (iso: string) => Date.parse(iso) - 20_000;
    const open = await call(
      yes({ renderedAt: renderedAt('2027-06-01T20:59:00Z') }),
      at('2027-06-01T20:59:00Z'),
    );
    expect(open.body.ok).toBe(true);
    const closed = await call(
      yes({ renderedAt: renderedAt('2027-06-01T21:00:01Z') }),
      at('2027-06-01T21:00:01Z'),
    );
    expect(closed).toEqual({ status: 409, body: { ok: false, code: 'closed' } });
  });

  it('dietary: none + vegan cannot both be checked; allergies need notes; options must be offered', async () => {
    const none = await call(
      yes({ adults: [adult({ phone: '0501234567', dietary: ['none', 'vegan'] as never[] })] }),
    );
    expect(none.body).toMatchObject({ ok: false, fieldErrors: { 'a0.dietary': expect.any(String) } });
    const nut = await call(
      yes({ adults: [adult({ phone: '0501234567', dietary: ['nut_allergy'] as never[] })] }),
    );
    expect(nut.body).toMatchObject({ ok: false, fieldErrors: { 'a0.dietaryNotes': 'Required' } });
    const withNotes = await call(
      yes({
        adults: [
          adult({ phone: '0501234567', dietary: ['nut_allergy'] as never[], dietaryNotes: 'cashews' }),
        ],
      }),
    );
    expect(withNotes.body.ok).toBe(true);
    const off = invitation((doc) =>
      doc.sections.forEach((s) => s.type === 'rsvp' && (s.data.dietary.options = ['none', 'vegetarian'])),
    );
    const notOffered = await call(
      yes({ adults: [adult({ phone: '0501234567', dietary: ['vegan'] as never[] })] }),
      deps(off),
    );
    expect(notOffered.body.ok).toBe(false);
  });

  it('contact rules: required phone, formats, counts within the section limits (localized messages)', async () => {
    const r = await call(yes({ locale: 'he', adults: [adult({ firstName: ' ', email: 'nope' })] }));
    expect(r.body).toEqual({
      ok: false,
      code: 'invalid',
      fieldErrors: {
        'a0.firstName': 'שדה חובה',
        'a0.phone': 'שדה חובה',
        'a0.email': 'כתובת אימייל לא תקינה',
      },
    });
    const tooMany = await call(
      yes({ adults: Array.from({ length: 5 }, () => adult({ phone: '0501234567' })) }),
    );
    expect(tooMany.body).toMatchObject({ ok: false, fieldErrors: { adults: expect.any(String) } });
  });

  it('custom questions: unknown select values and missing required answers are errors', async () => {
    const bad = await call(yes({ answers: { shuttle: 'mars' } }));
    expect(bad.body).toMatchObject({ ok: false, fieldErrors: { 'q.shuttle': expect.any(String) } });
    const required = invitation((doc) =>
      doc.sections.forEach(
        (s) => s.type === 'rsvp' && s.data.customQuestions.forEach((q) => (q.required = true)),
      ),
    );
    expect((await call(yes(), deps(required))).body.ok).toBe(false);
  });

  it('without per-attendee details only the primary contact needs a name; others are stored without names', async () => {
    const lean = invitation((doc) =>
      doc.sections.forEach((s) => s.type === 'rsvp' && (s.data.perAttendeeDetails = false)),
    );
    const d = deps(lean);
    const r = await call(
      yes({
        adults: [adult({ phone: '0501234567' }), adult({ firstName: '', lastName: '' })],
        children: [{ fullName: '', age: 0, dietary: [], dietaryNotes: null }],
      }),
      d,
    );
    expect(r.body.ok).toBe(true);
    const rows = d.submit.mock.calls[0]![0].attendees;
    expect(rows[1]).toMatchObject({ first_name: null, last_name: null });
    expect(rows[2]).toMatchObject({ kind: 'child', full_name: null, age: null });
  });

  it('decline: full name + a phone or an email; no attendees', async () => {
    const decline = (contact: object) => ({
      ...yes(),
      attending: false,
      adults: undefined,
      children: undefined,
      contact: { fullName: 'Dana', phone: null, email: null, ...contact },
    });
    const noContact = await call(decline({}));
    expect(noContact.body).toMatchObject({ ok: false, fieldErrors: { 'd.phone': expect.any(String) } });
    const d = deps();
    expect((await call(decline({ email: 'dana@example.com' }), d)).body.ok).toBe(true);
    const input = d.submit.mock.calls[0]![0];
    expect(input.response).toMatchObject({
      attending: false,
      primary_name: 'Dana',
      adults_count: 0,
      answers: {},
    });
    expect(input.attendees).toEqual([]);
  });

  it('edit token: sent hashed; the same token comes back when the reply was replaced', async () => {
    const token = 'x'.repeat(43);
    const d = deps(invitation(), {
      submit: vi.fn<RsvpDeps['submit']>(async () => ({ id: 'resp-1', replaced: true })),
    });
    const r = await call(yes({ editToken: token }), d);
    expect(r.body).toEqual({ ok: true, responseId: 'resp-1', editToken: token });
    expect(d.submit.mock.calls[0]![0].existingTokenHash).toBe(sha256(token));
    const fresh = await call(yes({ editToken: token }));
    expect(fresh.body.ok && fresh.body.editToken).not.toBe(token);
  });
});

describe('sanitize', () => {
  it('drops tags and control characters, keeps text', () => {
    expect(sanitize(' <b>שלום</b>\u0007 & <a href="x">hi</a> ')).toBe('שלום & hi');
  });
});
