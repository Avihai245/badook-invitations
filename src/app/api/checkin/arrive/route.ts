import { stationDeps } from '@/features/event-day/server/deps';
import { arrive } from '@/features/event-day/server/station-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/checkin/arrive { t, id, unitId, count, station } — checks a family in (all of them or part). */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => arrive(body, ip, stationDeps()), { label: 'checkin api' });
}
