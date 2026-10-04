import 'server-only';
import { revalidatePath } from 'next/cache';
import { serviceDb } from '@/lib/supabase/server';
import { LOCALES } from '../contracts/types';

/**
 * Refreshes the cached public page of an invitation in every language. A page is cached under the
 * path the guest asked for: /i/<slug> (?lang= is a rewrite to /i/<slug>/<lang>), or /i/<slug>/<lang>
 * when that was requested directly. Everything that changes what a guest sees calls this — publishing,
 * the host's edits, a feature turned on or off, a plan that ends — so the pages can stay cached long.
 */
export function revalidateInvitationPage(slug: string) {
  revalidatePath(`/i/${slug}`);
  for (const lang of [...LOCALES, 'default']) revalidatePath(`/i/${slug}/${lang}`);
}

/** The same for an invitation known by its id (a feature toggle): looks its address up first. */
export async function revalidateInvitationPageById(invitationId: string) {
  const { data, error } = await serviceDb()
    .from('invitations')
    .select('slug')
    .eq('id', invitationId)
    .maybeSingle();
  if (error) throw new Error(`invitation slug: ${error.message}`);
  if (data?.slug) revalidateInvitationPage(data.slug as string);
}
