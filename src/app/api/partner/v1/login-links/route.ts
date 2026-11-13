import { createLoginLink } from '@/features/partner/api';
import { partnerRoute } from '@/features/partner/http';
import { readCappedJson } from '@/lib/read-body';

/** POST /api/partner/v1/login-links — a one-time sign-in link for one of the partner's users. */
export async function POST(request: Request) {
  const body = (await readCappedJson(request, 64 * 1024)) as unknown;
  return partnerRoute(request, '/login-links', (deps) => createLoginLink(body, deps));
}
