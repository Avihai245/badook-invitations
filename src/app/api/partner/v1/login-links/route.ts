import { createLoginLink } from '@/features/partner/api';
import { partnerRoute } from '@/features/partner/http';

/** POST /api/partner/v1/login-links — a one-time sign-in link for one of the partner's users. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  return partnerRoute(request, (deps) => createLoginLink(body, deps));
}
