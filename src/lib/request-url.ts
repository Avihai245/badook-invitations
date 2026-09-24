import { headers } from 'next/headers';
import { serverEnv } from './env';
import { preferredBaseUrl } from './public-url';

/**
 * The public address for this request (see preferredBaseUrl) — for what a signed-in host sees and
 * copies (share links, QR codes, personal links) and for sign-in redirects (Supabase checks those
 * against its allow list). Pages that are cached and served to others, and background jobs, use the
 * configured address as is: a forged Host header changes nothing for anyone but its sender.
 */
export async function requestBaseUrl(): Promise<string> {
  const configured = serverEnv().INVITES_PUBLIC_BASE_URL;
  const h = await headers();
  return preferredBaseUrl(
    configured,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto') ?? (configured.startsWith('https:') ? 'https' : 'http'),
  );
}
