import 'server-only';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { addDaysISO } from '@/features/invitations/lib/dates';
import { hostLanguageOf } from '@/features/invitations/lib/locales';
import { emailLayout, escapeHtml, type EmailContent } from '@/features/invitations/lib/notify-email';
import { hostsLine } from '@/features/invitations/lib/text';
import { newLink, linkToken } from '@/features/live-gallery/server/tokens';
import { fmt } from '@/lib/i18n/app';
import { ALBUM } from '../config';
import { albumOpensAt } from '../model';
import type { AlbumDb, AlbumSettings } from './db';

/**
 * "Your album is ready" (the daily run, feature album): the morning after an event whose gallery has
 * photos, its hosts get one email with the album's link and the way to thank their guests with it. The
 * album is made then if the hosts never opened its card. Once per event (album_ready_mark); an event
 * without the feature, or whose album is off or opens later, waits for a later run (for a few days).
 */

const TEXT = {
  he: {
    subject: 'האלבום של {names} מוכן 💛',
    heading: 'בוקר טוב! האלבום מוכן',
    body: 'כל {n} התמונות והסרטונים שהאורחים שיתפו בגלריה סודרו לאלבום אחד, לפי רגעי האירוע. אפשר לפתוח אותו, לבחור תמונת שער, להסתיר תמונות — ולשלוח לכל המוזמנים תודה עם הקישור.',
    open: 'לאלבום',
    send: 'לשליחת התודה לאורחים',
    footer: 'קיבלתם את המייל הזה כי הגלריה של האירוע שלכם פעילה ב־{brand}.',
  },
  en: {
    subject: '{names} — your album is ready 💛',
    heading: 'Good morning! Your album is ready',
    body: 'All {n} photos and videos your guests shared in the gallery are now one album, arranged by the moments of the event. Open it, pick a cover, hide what you like — and send every guest a thank-you with the link.',
    open: 'Open the album',
    send: 'Send your guests the thank-you',
    footer: 'You got this email because your event’s gallery is on with {brand}.',
  },
} as const;

/** The email, in the invitation's host language (Hebrew, else English). */
export function readyEmail(opts: {
  doc: InvitationDocument;
  photos: number;
  albumUrl: string;
  studioUrl: string;
  brand: string;
}): EmailContent {
  const locale = hostLanguageOf(opts.doc);
  const t = TEXT[locale];
  const names = hostsLine(opts.doc.hosts, locale) || hostsLine(opts.doc.hosts, opts.doc.defaultLocale);
  const body = fmt(t.body, { n: String(opts.photos) });
  return {
    subject: fmt(t.subject, { names }),
    html: emailLayout(locale, {
      heading: escapeHtml(t.heading),
      body: `${escapeHtml(body)}<br><br><a href="${escapeHtml(opts.studioUrl)}" style="color:#1c1917">${escapeHtml(t.send)}</a>`,
      button: { href: opts.albumUrl, label: t.open },
      footer: escapeHtml(fmt(t.footer, { brand: opts.brand })),
      brand: opts.brand,
    }),
    text: `${t.heading}\n\n${body}\n\n${t.open}: ${opts.albumUrl}\n${t.send}: ${opts.studioUrl}`,
  };
}

export interface ReadyDeps {
  db: Pick<AlbumDb, 'readyCandidates' | 'readyMark' | 'ownerEnsure'>;
  /** the event has the album */
  hasAlbum(invitationId: string): Promise<boolean>;
  send(email: { to: string } & EmailContent): Promise<boolean>;
  base: string;
  brand: string;
}

/** The daily run's part: tells the hosts whose album just became ready. Never throws. */
export async function sendAlbumReadyEmails(
  now: Date,
  deps: ReadyDeps,
): Promise<{ checked: number; sent: number }> {
  const out = { checked: 0, sent: 0 };
  const today = now.toISOString().slice(0, 10);
  let candidates;
  try {
    candidates = await deps.db.readyCandidates(
      addDaysISO(today, -ALBUM.ready.daysBack),
      today,
      ALBUM.ready.perRun,
    );
  } catch (err) {
    console.error('[album] ready candidates', err);
    return out;
  }
  for (const c of candidates) {
    out.checked++;
    try {
      if (!c.email) continue;
      const parsed = safeMigrateDocument(c.document);
      if (!parsed.success) continue;
      const doc = parsed.data;
      if (!(await deps.hasAlbum(c.invitationId))) continue;
      let album: AlbumSettings | null = c.album;
      if (!album) {
        const link = newLink('album', c.invitationId);
        album = (await deps.db.ownerEnsure(c.invitationId, c.ownerId, link.hash, link.nonce))?.album ?? null;
      }
      if (!album?.enabled) continue;
      const opensAt = albumOpensAt(album.opensAt, doc);
      if (opensAt && opensAt.getTime() > now.getTime()) continue;
      const token = linkToken('album', c.invitationId, album.tokenNonce, album.tokenHash);
      if (!token) continue;
      const email = readyEmail({
        doc,
        photos: c.photos,
        albumUrl: `${deps.base}/e/${c.slug}/album?a=${token}`,
        studioUrl: `${deps.base}/app/invitations/${c.invitationId}/gallery/album`,
        brand: deps.brand,
      });
      if (await deps.send({ to: c.email, ...email })) {
        await deps.db.readyMark(c.invitationId);
        out.sent++;
      }
    } catch (err) {
      console.error('[album] ready email', c.invitationId, err);
    }
  }
  return out;
}
