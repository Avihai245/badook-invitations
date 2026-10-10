'use client';

import { ImageUp, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { dirOf, type InvitationDocument, type Locale } from '../../contracts/types';
import { autoShareDescription, calendarTitle } from '../../renderer/calendar-event';
import { buildRenderContext, type RenderContext } from '../../renderer/context';
import { IMAGE_TYPES, UploadTile, useUploader } from '../fields/media';
import { FieldFrame } from '../fields/fields';
import { useFlush } from '../state/flush';
import { useEditor } from '../state/EditorProvider';

/**
 * What the link preview says while the host wrote nothing of their own — the same texts the public
 * page puts in its metadata (renderer/calendar-event.ts), per language, so the share fields are never
 * empty.
 */
export function useShareAuto() {
  const { doc, template, bases, publicBaseUrl } = useEditor();
  return useMemo(() => {
    const contexts = new Map<Locale, RenderContext>();
    const ctx = (l: Locale) => {
      let c = contexts.get(l);
      if (!c)
        contexts.set(l, (c = buildRenderContext(doc, template, l, { brand: '', bases, publicBaseUrl })));
      return c;
    };
    return {
      title: (l: Locale) => (doc.locales.includes(l) ? calendarTitle(ctx(l)) : ''),
      description: (l: Locale) => (doc.locales.includes(l) ? autoShareDescription(ctx(l)) : ''),
    };
  }, [doc, template, bases, publicBaseUrl]);
}

/** What the generated image is drawn from (server/og-image.tsx): a change here asks for a new one. */
function imageKey(doc: InvitationDocument): string {
  const hero = doc.sections.find((s) => s.type === 'hero');
  const text = JSON.stringify([doc.templateId, doc.hosts, doc.event, doc.theme, doc.locales, hero]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The generated link-preview image of the saved draft, refreshed (after a save) when what it shows changes. */
function useGeneratedImage(enabled: boolean) {
  const { doc, meta, locale } = useEditor();
  // the latest save function, without restarting the wait when it changes
  const save = useFlush();
  const flush = useRef(save);
  flush.current = save;
  const key = imageKey(doc);
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  // the route draws the stored draft: save first, a moment after the last change
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const timer = window.setTimeout(
      () =>
        void flush.current().then(() => {
          if (live) setSrc(`/api/invitations/${meta.id}/share-image?lang=${locale}&v=${key}`);
        }),
      ready ? 900 : 0,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // `ready` only picks the delay of the first request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, locale, meta.id]);

  // load it aside, so the last image stays until the new one is in
  useEffect(() => {
    if (!src) return;
    let live = true;
    setState('loading');
    const url = attempt ? `${src}&r=${attempt}` : src;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      setReady(url);
      setState('ok');
    };
    img.onerror = () => live && setState('error');
    img.src = url;
    return () => {
      live = false;
    };
  }, [src, attempt]);

  return { ready, state, retry: () => setAttempt((n) => n + 1) };
}

/**
 * The share card as guests get it in WhatsApp (image, title, description, address) with the image's
 * controls: the image made from the invitation by default, or the host's own picture.
 */
export function ShareCardPreview() {
  const { doc, locale, publicBaseUrl, update, assetUrl } = useEditor();
  const { t } = useUi();
  const s = t.editor.f.share;
  const auto = useShareAuto();
  const own = doc.share.ogImage;
  const ownUrl = assetUrl(own);
  const generated = useGeneratedImage(!own);
  const { run, progress, error } = useUploader();

  const title = doc.share.ogTitle?.[locale]?.trim() || auto.title(locale);
  const description = doc.share.ogDescription?.[locale]?.trim() || auto.description(locale);
  const image = own ? ownUrl : generated.ready;
  const loading = !own && generated.state === 'loading';

  const onFiles = async ([file]: File[]) => {
    if (!file) return;
    const res = await run(file);
    if (res?.kind === 'image') update('share.ogImage', res.ref, null);
  };

  return (
    <FieldFrame path="share.ogImage" label={s.ogImage}>
      <div className="mb-1.5 text-[13px] font-semibold">{s.preview}</div>
      <div
        className="max-w-[360px] rounded-[10px] bg-[#DCF8C6] p-1.5 shadow-sm"
        dir={dirOf(locale)}
        data-testid="share-card"
      >
        <div className="overflow-hidden rounded-[8px] bg-white/80">
          <div className="relative aspect-[1200/630] w-full bg-subtle">
            {image ? (
              <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-faint">
                <ImageUp aria-hidden size={22} />
              </div>
            )}
            {loading ? (
              <span
                className="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white"
                aria-live="polite"
              >
                <LoaderCircle aria-hidden size={12} className="motion-safe:animate-spin" />
                {s.previewLoading}
              </span>
            ) : null}
          </div>
          <div className="px-2.5 py-2" lang={locale}>
            <div className="truncate text-[13px] font-semibold text-[#111]">{title}</div>
            <div className="line-clamp-2 text-[12px] text-[#555]">{description}</div>
            <div className="truncate text-[11px] text-[#777]" dir="ltr">
              {publicBaseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}
            </div>
          </div>
        </div>
      </div>

      {!own && generated.state === 'error' ? (
        <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-danger">
          {s.previewFailed}
          <button
            type="button"
            onClick={generated.retry}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            {s.retry}
          </button>
        </p>
      ) : null}

      <div className="mt-3 text-[13px] font-semibold">{s.ogImage}</div>
      <p className="mt-1 flex items-start gap-1.5 text-[12px] text-muted">
        {own ? null : (
          <Sparkles aria-hidden size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand-deep" />
        )}
        <span>{own ? s.ogImageOwnHelp : s.ogImageHelp}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <UploadTile
          variant="button"
          label={own ? s.ogImageReplace : s.ogImageUpload}
          accept={IMAGE_TYPES}
          onFiles={(f) => void onFiles(f)}
          progress={progress}
        />
        {own ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            onClick={() => update('share.ogImage', null, null)}
          >
            {s.ogImageReset}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </FieldFrame>
  );
}
