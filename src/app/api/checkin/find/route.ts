import { stationDeps } from '@/features/event-day/server/deps';
import { findByCode } from '@/features/event-day/server/station-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/checkin/find { t, code } — the family of a guest's entrance code (the QR on their table guide). */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => findByCode(body, ip, stationDeps()), {
    label: 'checkin api',
  });
}
