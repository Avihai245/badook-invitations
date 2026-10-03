import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventHome } from '@/features/invitations/app/home/EventHome';
import { ItemPoster } from '@/features/invitations/app/ItemPoster';
import { TOUR_DONE_META } from '@/features/invitations/app/home/tour-meta';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { loadEventHome } from '@/features/invitations/server/event-home';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.errorPages.notFound.metaTitle };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.eventHome.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id] — the event's home: the countdown, the one next step, the budget's gauge, the
 * RSVPs' ring, the tasks, the road through the four stages and what else is worth doing (the event's
 * navigation and strip come from the layout).
 */
export default async function EventHomePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}`);
  const item = await ownerInvitation(user.id, id);
  if (!item) notFound();
  const data = await loadEventHome(user.id, item, await requestBaseUrl());
  if (!data) notFound();
  const { t, locale } = await getUi();
  const tourDone = (user.user_metadata as Record<string, unknown> | null)?.[TOUR_DONE_META] === true;
  return (
    <EventHome
      data={data}
      tourDone={tourDone}
      poster={
        <ItemPoster
          item={item}
          uiLocale={locale}
          fallbackName={hostsLine(item.hosts, item.defaultLocale) || t.eventTypes[item.eventType]}
          className="w-[96px] shrink-0 rotate-[-3deg] rounded-[16px]! shadow-[0_24px_40px_-20px_rgba(60,35,15,0.75)]! ring-4 ring-white/85 sm:w-[124px] dark:ring-line-strong"
        />
      }
    />
  );
}
