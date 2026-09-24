import 'server-only';
import { serverEnv } from '../env';

/**
 * Is "Continue with Google" switched on in Supabase Auth (Authentication → Sign In / Providers →
 * Google)? Read from the project's public auth settings and re-checked every few minutes, so the
 * button shows up by itself once the provider is enabled, with no deploy. `fresh`: asked right now
 * (the button's click — the page may still show it from before the provider was switched off).
 */
export async function googleSignInEnabled({ fresh = false }: { fresh?: boolean } = {}): Promise<boolean> {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = serverEnv();
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 300 } }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, unknown> };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
