import type { Metadata } from 'next';
import { AppToasts } from '../../AppProviders';
import { MessagesScreen } from '@/features/invitations/app/messages/MessagesScreen';
import type { GuestRecord, GuestsPageData } from '@/features/invitations/server/guests';
import type { HubData } from '@/features/whatsapp/hub';
import { assertDevRoutes } from '@/lib/dev-routes';

export const metadata: Metadata = { title: 'WhatsApp messages' };
// Rendered per request so the INVITES_DEV_ROUTES gate is read at runtime, never baked in at build.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ tab?: string; state?: string }> };

const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const iso = (days: number) => at(days).slice(0, 10);

function guest(i: number, name: string, over: Partial<GuestRecord> = {}): GuestRecord {
  return {
    id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
    name,
    phone: `+97250${String(1_000_000 + i)}`,
    email: null,
    partySize: 2,
    group: null,
    language: null,
    token: `tokenToken${String(i).padStart(6, '0')}`,
    sendStatus: 'none',
    sendChannel: null,
    sentAt: null,
    sendError: null,
    openedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    createdAt: at(-10),
    optedOut: false,
    retryAt: null,
    response: null,
    ...over,
  };
}
const yes = { id: 'r', attending: true, adults: 2, children: 0, updatedAt: at(-1) };
const no = { ...yes, attending: false, adults: 0 };

/**
 * Dev-only: the guests' WhatsApp section with made-up data — send now (?tab=manual) and smart
 * scheduling (?tab=smart; ?state=active shows a sequence already running) — for screenshots and QA.
 */
export default async function DevWhatsAppPage({ searchParams }: Props) {
  assertDevRoutes();
  const { tab, state } = await searchParams;
  const guests = [
    guest(1, 'דניאל כהן', { sendStatus: 'read', response: yes }),
    guest(2, 'מיכל לוי', { sendStatus: 'delivered' }),
    guest(3, 'יוסי אברהם', { sendStatus: 'read', openedAt: at(-2) }),
    guest(4, 'רותם שפירא', { sendStatus: 'delivered', response: no }),
    guest(5, 'נועה ברק'),
    guest(6, 'אבי מזרחי', { phone: '+97231234567' }),
    guest(7, 'שירה גולן', { optedOut: true }),
    guest(8, 'Emma Stone', { language: 'en' }),
  ];
  const data: GuestsPageData = {
    id: '00000000-0000-4000-8000-00000000aaaa',
    slug: 'dana-and-itay',
    published: true,
    title: 'דנה & איתי',
    dateLine: 'יום רביעי, 18 בנובמבר 2026',
    eventType: 'wedding',
    locale: 'he',
    locales: ['he', 'en'],
    publicBaseUrl: 'https://invitations.badooks.com',
    guests,
    replies: [],
    greeting: null,
    plan: 'pro',
    maxGuests: 1000,
    credits: 42,
    unlimited: false,
    own: {},
    whatsapp: {
      configured: true,
      priceIls: 0.16,
      priceUsd: 0.0353,
      langs: [
        { locale: 'he', code: 'he' },
        { locale: 'en', code: 'en' },
      ],
      values: {},
    },
  };
  const active = state === 'active';
  const hub: HubData = {
    schedule: active
      ? { preset: 'smart', status: 'active', consentAt: at(-3), activatedAt: at(-3), updatedAt: at(-3) }
      : null,
    stages: active
      ? [
          {
            id: 's1',
            key: 'invitation',
            kind: 'invitation',
            message: 'invitation',
            audience: 'not_received',
            label: null,
            sendAt: at(-3),
            enabled: true,
            status: 'done',
            ranAt: at(-3),
            outcome: { ok: true, queued: 5 },
            stats: { read: 3, delivered: 2 },
          },
          {
            id: 's2',
            key: 'followup1',
            kind: 'followup',
            message: 'reminder',
            audience: 'unanswered',
            label: null,
            sendAt: at(-0.5),
            enabled: true,
            status: 'failed',
            ranAt: at(-0.5),
            outcome: { ok: false, code: 'credits', needed: 3, balance: 0 },
            stats: {},
          },
          ...(
            [
              ['followup2', 'followup', 'reminder', 'unanswered', 4],
              ['followup3', 'followup', 'reminder', 'unanswered', 34],
              ['event_reminder', 'event_reminder', 'event_reminder', 'attending', 39],
              ['thanks', 'thanks', 'album', 'attending', 40.1],
            ] as const
          ).map(([key, kind, message, audience, days], i) => ({
            id: `s${i + 3}`,
            key,
            kind,
            message,
            audience,
            label: null,
            sendAt: at(days),
            enabled: true,
            status: 'scheduled' as const,
            ranAt: null,
            outcome: null,
            stats: {},
          })),
        ]
      : [],
    history: active
      ? guests.slice(0, 5).map((g, i) => ({
          id: `h${i}`,
          kind: 'invitation' as const,
          guestId: g.id,
          name: g.name,
          status: i < 3 ? 'read' : 'delivered',
          error: null,
          at: at(-3),
          stageId: 's1',
        }))
      : [],
    approved: ['invitation', 'reminder', 'event_reminder', 'thanks', 'album'],
    album: true,
    albumFeature: true,
    checkins: false,
    values: {
      he: {
        hosts: 'דנה & איתי',
        event: 'לחתונה',
        date: 'יום רביעי, 18 בנובמבר 2026',
        when: 'יום רביעי, 18 בנובמבר · 19:30 · גן האירועים',
        phrase: 'בחתונה שלנו',
      },
      en: {
        hosts: 'Dana & Itay',
        event: 'to the wedding',
        date: 'Wednesday, 18 November 2026',
        when: 'Wednesday, 18 November · 7:30 PM · The Garden',
        phrase: 'at our wedding',
      },
    },
    timeZone: 'Asia/Jerusalem',
    eventDate: iso(39),
    startTime: '19:30',
    rsvpDeadline: null,
    eventStart: Date.parse(`${iso(39)}T17:30:00Z`),
    eventEnd: Date.parse(`${iso(39)}T22:00:00Z`),
    plan: 'pro',
    admin: false,
  };
  return (
    <AppToasts>
      <MessagesScreen data={data} hub={hub} tab={tab === 'smart' ? 'smart' : 'manual'} />
    </AppToasts>
  );
}
