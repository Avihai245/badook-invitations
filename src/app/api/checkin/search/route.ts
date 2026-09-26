import { stationDeps } from '@/features/event-day/server/deps';
import { search } from '@/features/event-day/server/station-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/checkin/search { t, q } — families by name or phone. */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => search(body, ip, stationDeps()), { label: 'checkin api' });
}
