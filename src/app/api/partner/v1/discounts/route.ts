import { removeDiscount, setDiscount } from '@/features/partner/api';
import { partnerRoute } from '@/features/partner/http';

/** POST /api/partner/v1/discounts — { userId | externalId, percent, until?, note? } (docs/partner-api.md). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  return partnerRoute(request, (deps) => setDiscount(body, deps));
}

/** DELETE /api/partner/v1/discounts?externalId=… | ?userId=… — the user's discount is removed. */
export async function DELETE(request: Request) {
  return partnerRoute(request, (deps) => removeDiscount(new URL(request.url).searchParams, deps));
}
