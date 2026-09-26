import { stationDeps } from '@/features/event-day/server/deps';
import { stationState } from '@/features/event-day/server/station-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/checkin/station { t } — what an entrance station shows: the event, the hall's numbers, the latest arrivals. */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => stationState(body, ip, stationDeps()), {
    label: 'checkin api',
  });
}
