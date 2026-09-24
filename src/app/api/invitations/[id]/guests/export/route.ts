import { csvCell } from '@/features/invitations/lib/guest-import';
import { displayPhone, guestState } from '@/features/invitations/lib/guest-status';
import { guestsDb } from '@/features/invitations/server/guests';
import { hostDb, isUuid } from '@/features/invitations/server/host-db';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/invitations/:id/guests/export — the guest list as CSV for Excel (UTF-8 with a BOM): each
 * guest's details, where they stand and their personal link.
 */
export async function GET(_request: Request, { params }: Params) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const { id } = await params;
  if (!isUuid(id)) return new Response('Not found', { status: 404, headers: NO_STORE });
  const [inv, guests, { t }] = await Promise.all([
    hostDb.get(id, user.id),
    guestsDb.list(id, user.id),
    getUi(),
  ]);
  if (!inv || !guests) return new Response('Not found', { status: 404, headers: NO_STORE });
  const g = t.guests;
  const c = g.csv;
  const base = serverEnv().INVITES_PUBLIC_BASE_URL;
  const header = [
    c.name,
    c.phone,
    c.email,
    c.party,
    c.group,
    c.status,
    c.opened,
    c.reply,
    c.adults,
    c.children,
    c.link,
  ];
  const rows = guests.map((x) => {
    const state = guestState(x);
    return [
      x.name,
      displayPhone(x.phone),
      x.email ?? '',
      x.partySize ?? '',
      x.group ?? '',
      x.sendChannel === 'manual' && x.sendStatus === 'sent' ? g.status.manual : g.status[x.sendStatus],
      x.openedAt || x.response ? c.yes : c.no,
      state === 'attending' ? g.status.attending : state === 'declined' ? g.status.declined : '',
      x.response?.attending ? x.response.adults : '',
      x.response?.attending ? x.response.children : '',
      `${base}/i/${inv.slug}?g=${x.token}`,
    ];
  });
  const csv = '﻿' + [header, ...rows].map((r) => r.map((v) => csvCell(v)).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="guests-${inv.slug}.csv"`,
    },
  });
}
