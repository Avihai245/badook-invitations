import type { SectionOf } from '../../contracts/types';
import { eventRange } from '../../lib/dates';
import { editPath, type SectionViewProps } from '../shared';
import { LiveGalleryCard } from '../../renderer/lazy.client';
import { galleryPhase } from './phase';

/**
 * The live gallery on the invitation (feature `live_gallery`): before and during the event it invites
 * guests to share their photos — a button (and a QR code for a guest reading on a computer) to the
 * gallery's upload page, keeping their personal link — and from the morning after it leads to the
 * album. The page is cached for everyone, so the guest's browser decides which (the event's date,
 * times and zone). Guests see it only while the event has the feature and its gallery is on; the
 * editor shows it with a placeholder button.
 */
export function LiveGalleryView({ section, ctx }: SectionViewProps<SectionOf<'live_gallery'>>) {
  const url = ctx.liveGallery?.url ?? null;
  if (ctx.mode === 'live' && !url) return null;
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  let range: { start: number; end: number };
  try {
    const r = eventRange(ctx.doc);
    range = { start: r.start.getTime(), end: r.end.getTime() };
  } catch {
    range = { start: Number.NaN, end: Number.NaN };
  }
  const known = Number.isFinite(range.start);
  return (
    <section className="sec lg" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        <LiveGalleryCard
          url={url}
          base={ctx.publicBaseUrl}
          start={known ? range.start : null}
          end={known ? range.end : null}
          initial={known ? galleryPhase(ctx.now, range.start, range.end) : 'during'}
          showQr={d.showQr}
          editPath={path}
          texts={{
            title: ctx.text(d.title) || ctx.t('liveGallery.title'),
            body: ctx.text(d.body) || ctx.t('liveGallery.body'),
            afterTitle: ctx.text(d.afterTitle) || ctx.t('liveGallery.afterTitle'),
            afterBody: ctx.text(d.afterBody) || ctx.t('liveGallery.afterBody'),
            before: ctx.t('liveGallery.cta.before'),
            during: ctx.t('liveGallery.cta.during'),
            after: ctx.t('liveGallery.cta.after'),
            soon: ctx.t('liveGallery.soon'),
            qr: ctx.t('liveGallery.qr'),
            qrAfter: ctx.t('liveGallery.qrAfter'),
            qrLabel: ctx.t('liveGallery.qrLabel'),
            preview: ctx.t('liveGallery.preview'),
          }}
        />
      </div>
    </section>
  );
}
