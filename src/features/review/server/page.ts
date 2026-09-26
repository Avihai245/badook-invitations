import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { ipFromHeaders } from '@/lib/client-ip';
import { reviewGuestDeps } from './deps';
import { openReview } from './guest-api';

/**
 * The review page's data (/review/<token>[/<lang>]): opened once per request — the layout (tokens on
 * <html>), the metadata and the page share it.
 */
export const loadReview = cache(async (token: string) =>
  openReview(token, ipFromHeaders(await headers()), reviewGuestDeps()),
);

/** The language asked for (`/review/<token>/<lang>`), when the invitation has it; else its first. */
export function reviewLocale(doc: InvitationDocument, lang: string[] | undefined): Locale {
  const asked = lang?.length === 1 ? lang[0] : undefined;
  return asked && (doc.locales as readonly string[]).includes(asked) ? (asked as Locale) : doc.defaultLocale;
}

/** The language of the page when there is no draft to show (Hebrew unless English was asked for). */
export const goneLocale = (lang: string[] | undefined): 'he' | 'en' => (lang?.[0] === 'en' ? 'en' : 'he');
