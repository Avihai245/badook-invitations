import 'server-only';
import { publicJsonRoute } from '@/lib/public-route';
import type { ApiResult } from './guest-api';

/**
 * Wraps a guest (or screen) API route of the gallery (src/lib/public-route.ts): POST with a JSON body
 * only, a size cap — requests are a few KB (file sizes and types, never files: those go straight to
 * storage) — the link's checks in the handler, no caching, and no internal errors leaking out.
 */
export function galleryRoute(
  request: Request,
  handler: (body: unknown, ip: string | null) => Promise<ApiResult>,
): Promise<Response> {
  return publicJsonRoute(request, handler, { label: 'gallery api' });
}
