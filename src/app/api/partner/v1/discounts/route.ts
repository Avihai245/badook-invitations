import { removeDiscount, setDiscount } from '@/features/partner/api';
import { partnerRoute } from '@/features/partner/http';
import { readCappedJson } from '@/lib/read-body';

/** POST /api/partner/v1/discounts — { userId | externalId, percent, until?, note? } (docs/partner-api.md). */
export async function POST(request: Request) {
  const body = (await readCappedJson(request, 64 * 1024)) as unknown;
  return partnerRoute(request, '/discounts', (deps) => setDiscount(body, deps));
}

/** DELETE /api/partner/v1/discounts?externalId=… | ?userId=… — the user's discount is removed. */
export async function DELETE(request: Request) {
  return partnerRoute(request, '/discounts', (deps) =>
    removeDiscount(new URL(request.url).searchParams, deps),
  );
}
