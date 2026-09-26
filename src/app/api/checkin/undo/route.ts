import { stationDeps } from '@/features/event-day/server/deps';
import { undo } from '@/features/event-day/server/station-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/checkin/undo { t, id } — undoes a check-in. */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => undo(body, ip, stationDeps()), { label: 'checkin api' });
}
