import 'server-only';
import { notFound } from 'next/navigation';
import { serverEnv } from './env';

/** Kitchen sink & showcases: always on in `next dev`; in builds only when INVITES_DEV_ROUTES=true (dev branch). */
export function devRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || serverEnv().INVITES_DEV_ROUTES;
}

/** Call at the top of every /dev page. */
export function assertDevRoutes(): void {
  if (!devRoutesEnabled()) notFound();
}
