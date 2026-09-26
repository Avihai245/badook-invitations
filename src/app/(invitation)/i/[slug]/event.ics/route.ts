import { LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { buildIcs } from '@/features/invitations/lib/calendar';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import {
  eventCalendarEvent,
  shownVenues,
  venueCalendarEvent,
} from '@/features/invitations/renderer/calendar-event';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { getPublishedInvitation } from '@/features/invitations/server/published';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';

type Params = Promise<{ slug: string }>;

const notFound = () => new Response('Not found', { status: 404 });

/**
 * `GET /i/<slug>/event.ics?venue=<id>&lang=` — RFC 5545 file for one venue (§4), UID stable per venue;
 * without venues (a save-the-date) the event itself.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  if (!invitationsEnabled()) return notFound();
  const { slug } = await params;
  const invitation = await getPublishedInvitation(slug);
  if (!invitation) return notFound();
  const { doc, entry } = invitation;
  const query = new URL(request.url).searchParams;
  const venues = shownVenues(doc);
  const venueId = query.get('venue');
  // ?venue=<id> → that venue; none → the first venue, or the event itself (a save-the-date)
  const venue = venueId ? venues.find((v) => v.id === venueId) : (venues[0] ?? null);
  if (venue === undefined) return notFound();
  const lang = query.get('lang') ?? '';
  const locale: Locale =
    (LOCALES as readonly string[]).includes(lang) && doc.locales.includes(lang as Locale)
      ? (lang as Locale)
      : doc.defaultLocale;
  const env = serverEnv();
  const ctx = buildRenderContext(doc, entry.manifest, locale, {
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    icsViaRoute: true,
    bases: assetBasesFromEnv({ supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL }),
  });
  const file = venue ? `${slug}-${venue.id.replace(/[^A-Za-z0-9_-]/g, '')}.ics` : `${slug}.ics`;
  const event = venue ? venueCalendarEvent(ctx, venue) : eventCalendarEvent(ctx);
  return new Response(buildIcs(event), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'public, max-age=300, s-maxage=300',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
