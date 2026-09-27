'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { useGuest } from '../../renderer/guest.client';
import { iv } from '../shared';
import { galleryHref, galleryPhase, type GalleryPhase } from './phase';

interface Texts {
  title: string;
  body: string;
  afterTitle: string;
  afterBody: string;
  before: string;
  during: string;
  after: string;
  soon: string;
  qr: string;
  qrAfter: string;
  qrLabel: string;
  preview: string;
}

/** Wide screens get the QR code (a guest reading on a computer scans it with their phone). */
const QR_MEDIA = '(min-width: 720px)';

/**
 * The gallery section's card: its phase decided here, in the guest's browser (the cached page is the
 * same for everyone — the server's phase is only the first paint), the button to the gallery with the
 * guest's personal link kept, and the QR code made on wide screens only when the section comes near
 * (the QR library isn't part of the page otherwise).
 */
export function LiveGalleryCard({
  url,
  base,
  start,
  end,
  initial,
  showQr,
  editPath,
  texts,
}: {
  /** the upload page (null in the editor before the gallery is on) */
  url: string | null;
  /** the site's public address (the QR code needs a full one) */
  base: string;
  start: number | null;
  end: number | null;
  initial: GalleryPhase;
  showQr: boolean;
  editPath?: string;
  texts: Texts;
}) {
  const [phase, setPhase] = useState<GalleryPhase>(initial);
  useEffect(() => {
    if (start === null || end === null) return;
    const update = () => setPhase(galleryPhase(Date.now(), start, end));
    update();
    // the page may stay open across a phase's change (a tab left open over the evening)
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [start, end]);

  const guest = useGuest();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    // the personal link's token, before the guest's name comes back from the server
    const g = new URLSearchParams(window.location.search).get('g');
    if (g) setToken(g);
  }, []);
  // the language the guest reads the invitation in (the page's, also after switching it in place):
  // the gallery opens in it
  const [lang, setLang] = useState<string | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setLang(html.lang || null);
    read();
    const watch = new MutationObserver(read);
    watch.observe(html, { attributes: true, attributeFilter: ['lang'] });
    return () => watch.disconnect();
  }, []);
  const href = url ? galleryHref(url, guest?.token ?? token, lang) : null;

  // the QR code: made for the address as it is now (the guest's personal link may arrive later)
  const full = href ? (href.startsWith('http') ? href : `${base}${href}`) : null;
  const [qr, setQr] = useState<{ for: string; svg: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!showQr || !full || !el) return;
    const media = window.matchMedia(QR_MEDIA);
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    const make = () => {
      if (!media.matches || observer) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          observer?.disconnect();
          import('qrcode')
            .then((q) =>
              q.toString(full, {
                type: 'svg',
                margin: 1,
                errorCorrectionLevel: 'M',
                color: { dark: '#1C1917', light: '#FFFFFF' },
              }),
            )
            .then((svg) => {
              if (!cancelled) setQr({ for: full, svg });
            })
            .catch(() => undefined);
        },
        { rootMargin: '400px' },
      );
      observer.observe(el);
    };
    make();
    media.addEventListener('change', make);
    return () => {
      cancelled = true;
      observer?.disconnect();
      media.removeEventListener('change', make);
    };
  }, [showQr, full]);
  const svg = qr && qr.for === full ? qr.svg : null;

  const after = phase === 'after';
  const title = after ? texts.afterTitle : texts.title;
  const body = after ? texts.afterBody : texts.body;
  const cta = phase === 'before' ? texts.before : phase === 'during' ? texts.during : texts.after;
  return (
    <div className="lg-card card reveal" data-phase={phase} ref={box}>
      <div className="lg-main">
        <span className="lg-icon" aria-hidden>
          <Icon name="camera" size={26} />
        </span>
        <h2
          className="sec-title"
          data-edit-path={editPath && `${editPath}.${after ? 'afterTitle' : 'title'}`}
        >
          {title}
        </h2>
        <p className="sec-body" data-edit-path={editPath && `${editPath}.${after ? 'afterBody' : 'body'}`}>
          {body}
        </p>
        {phase === 'before' ? <p className="lg-soon">{texts.soon}</p> : null}
        <div className="actions reveal" style={iv(2)}>
          {href ? (
            <a className="btn btn-primary lg-cta" href={href} data-insight="gallery" data-phase={phase}>
              <Icon name="camera" size={18} />
              {cta}
            </a>
          ) : (
            // the editor, before the gallery is on: the button as guests will see it
            <span className="btn btn-primary lg-cta" aria-disabled="true" title={texts.preview}>
              <Icon name="camera" size={18} />
              {cta}
            </span>
          )}
        </div>
      </div>
      {showQr && svg ? (
        <figure className="lg-qr">
          <span
            role="img"
            aria-label={texts.qrLabel}
            // the qrcode library's own SVG markup (made here from the gallery's address)
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <figcaption>{after ? texts.qrAfter : texts.qr}</figcaption>
        </figure>
      ) : null}
    </div>
  );
}
