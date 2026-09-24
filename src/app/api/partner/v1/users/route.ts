import { lookupUser, provisionUser } from '@/features/partner/api';
import { partnerRoute } from '@/features/partner/http';

/** POST /api/partner/v1/users — Badook Events opens a user (docs/partner-api.md). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  return partnerRoute(request, (deps) => provisionUser(body, deps));
}

/** GET /api/partner/v1/users?externalId=… | userId=… | email=… — one of the partner's users. */
export async function GET(request: Request) {
  return partnerRoute(request, (deps) => lookupUser(new URL(request.url).searchParams, deps));
}
