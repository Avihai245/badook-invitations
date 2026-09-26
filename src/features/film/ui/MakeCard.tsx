'use client';

import { Clapperboard, Download, ImagePlus, Play, RotateCcw, Square, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardTitle, Checkbox, Hint, useToast } from '@/components/app';
import { loginUrl } from '@/features/invitations/app/api';
import { GALLERY } from '@/features/live-gallery/config';
import { formatBytes } from '@/features/live-gallery/format';
import { useUi } from '@/lib/i18n/client';
import { FilmAssets } from '../client/assets';
import { renderSoundtrack } from '../client/audio';
import { paintFrame, type CardStyle, type Sources } from '../client/paint';
import { addFilmToGallery } from '../client/publish';
import { filmStills, pickEngine, playFilm, renderFilm, type Engine } from '../client/render';
import type { FilmQuality, FilmShape } from '../config';
import type { FilmView } from '../server/api';
import type { FilmPlan } from '../timeline';

type Size = { width: number; height: number };

const NO_PICTURES: Sources = { picture: () => null, backdrop: () => null, motion: () => null };

type Making =
  | { phase: 'idle' }
  | { phase: 'preparing' }
  | { phase: 'rendering'; progress: number; engine: Engine['kind'] }
  | { phase: 'done'; result: Result }
  | { phase: 'failed'; reason: 'unsupported' | 'failed' };

interface Result {
  url: string;
  blob: Blob;
  ext: 'mp4' | 'webm';
  engine: Engine['kind'];
  durationMs: number;
  size: Size;
  stills: { display: Blob; thumb: Blob } | null;
}

type Adding =
  | { phase: 'idle' }
  | { phase: 'sending'; progress: number }
  | { phase: 'done'; shown: boolean }
  | { phase: 'failed'; code: keyof ReturnType<typeof useUi>['t']['film']['result']['errors'] };

const itemsOf = (view: FilmView) =>
  view.items.map((i) => ({
    id: i.id,
    kind: i.kind,
    thumb: i.thumb,
    display: i.display,
    video: i.video,
    faces: i.faces,
  }));

/**
 * The preview (a small canvas, played with the song), "make the film" with its progress and cancel,
 * and the finished film: watch it, download it, add it to the gallery (shown to guests or not).
 */
export function MakeCard({
  view,
  plan,
  size,
  shape,
  quality,
  card,
  fontsReady,
  track,
  blocked,
  fresh,
}: {
  view: FilmView;
  plan: FilmPlan;
  size: Size;
  shape: FilmShape;
  quality: FilmQuality;
  card: CardStyle;
  fontsReady: boolean;
  track: AudioBuffer | null;
  blocked: boolean;
  fresh(): Promise<FilmView>;
}) {
  const { t, fmt, number, locale } = useUi();
  const M = t.film.make;
  const R = t.film.result;
  const P = t.film.preview;
  const { toast } = useToast();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState<'loading' | 'playing' | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const preview = useRef<AbortController | null>(null);
  const [making, setMaking] = useState<Making>({ phase: 'idle' });
  const job = useRef<AbortController | null>(null);
  const [show, setShow] = useState(true);
  const [adding, setAdding] = useState<Adding>({ phase: 'idle' });
  const upload = useRef<AbortController | null>(null);

  const previewSize = useMemo<Size>(
    () => (shape === 'vertical' ? { width: 360, height: 640 } : { width: 640, height: 360 }),
    [shape],
  );

  // stop everything when leaving the page
  useEffect(
    () => () => {
      preview.current?.abort();
      job.current?.abort();
      upload.current?.abort();
    },
    [],
  );
  // a finished film's address goes with it
  const resultUrl = making.phase === 'done' ? making.result.url : null;
  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl]);

  // the still preview: the title card
  useEffect(() => {
    const c = canvas.current;
    if (!c || playing) return;
    c.width = previewSize.width;
    c.height = previewSize.height;
    const ctx = c.getContext('2d', { alpha: false });
    if (ctx) paintFrame(ctx, Math.min(1.2, plan.duration / 2), plan, c.width, c.height, NO_PICTURES, card);
  }, [plan, card, previewSize, fontsReady, playing]);

  // a changed film stops the preview
  useEffect(() => {
    preview.current?.abort();
  }, [plan, card, previewSize]);

  const play = async () => {
    if (playing) return preview.current?.abort();
    const c = canvas.current;
    if (!c) return;
    const controller = new AbortController();
    preview.current = controller;
    setPlaying('loading');
    const current = await fresh();
    const assets = new FilmAssets(itemsOf(current), previewSize);
    try {
      await assets.prepare(plan);
      const soundtrack = await renderSoundtrack(track, plan);
      if (controller.signal.aborted) return;
      setPlaying('playing');
      await playFilm({
        plan,
        size: previewSize,
        assets,
        card,
        soundtrack,
        canvas: c,
        signal: controller.signal,
        onTime: setPreviewTime,
      });
    } catch {
      toast({ variant: 'danger', title: t.common.error });
    } finally {
      assets.dispose();
      if (preview.current === controller) preview.current = null;
      setPlaying(null);
      setPreviewTime(0);
    }
  };

  const make = async () => {
    preview.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setAdding({ phase: 'idle' });
    setMaking({ phase: 'preparing' });
    const engine = await pickEngine(size, quality);
    if (!engine) return setMaking({ phase: 'failed', reason: 'unsupported' });
    const current = await fresh();
    const assets = new FilmAssets(itemsOf(current), size);
    try {
      await assets.prepare(plan);
      const soundtrack = await renderSoundtrack(track, plan);
      if (controller.signal.aborted) throw new DOMException('aborted', 'AbortError');
      setMaking({ phase: 'rendering', progress: 0, engine: engine.kind });
      let last = 0;
      const out = await renderFilm(
        { plan, size, quality, assets, card, soundtrack },
        engine,
        (p) => {
          // a few updates a second are enough
          const now = performance.now();
          if (now - last > 150 || p >= 1) {
            last = now;
            setMaking({ phase: 'rendering', progress: p, engine: engine.kind });
          }
        },
        controller.signal,
      );
      const stills = await filmStills(plan, size, assets, card, {
        posterMaxEdge: GALLERY.video.posterMaxEdge,
        posterQuality: GALLERY.video.posterQuality,
        thumbMaxEdge: GALLERY.image.thumbMaxEdge,
        thumbQuality: GALLERY.image.thumbQuality,
      }).catch(() => null);
      setMaking({
        phase: 'done',
        result: {
          url: URL.createObjectURL(out.blob),
          blob: out.blob,
          ext: out.ext,
          engine: out.engine,
          durationMs: Math.round(plan.duration * 1000),
          size,
          stills,
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMaking({ phase: 'idle' });
        toast({ title: M.cancelled });
      } else {
        console.error('[film]', err);
        setMaking({ phase: 'failed', reason: 'failed' });
      }
    } finally {
      assets.dispose();
      if (job.current === controller) job.current = null;
    }
  };

  const add = async (result: Result) => {
    if (!result.stills) return setAdding({ phase: 'failed', code: 'failed' });
    const controller = new AbortController();
    upload.current = controller;
    setAdding({ phase: 'sending', progress: 0 });
    const outcome = await addFilmToGallery(
      view.id,
      {
        video: result.blob,
        display: result.stills.display,
        thumb: result.stills.thumb,
        width: result.size.width,
        height: result.size.height,
        durationMs: result.durationMs,
      },
      show,
      (p) => setAdding({ phase: 'sending', progress: p }),
      controller.signal,
    );
    upload.current = null;
    if (outcome.ok) {
      setAdding({ phase: 'done', shown: show });
      toast({ variant: 'success', title: show ? R.added : R.addedHidden });
    } else if (outcome.code === 'unauthorized') window.location.assign(loginUrl());
    else if (outcome.code === 'aborted') setAdding({ phase: 'idle' });
    else setAdding({ phase: 'failed', code: outcome.code });
  };

  const busy = making.phase === 'preparing' || making.phase === 'rendering';
  const pct = making.phase === 'rendering' ? Math.round(making.progress * 100) : 0;
  const seconds = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <Card padding="lg" className="flex flex-col gap-4" data-testid="film-make">
      <CardTitle as="h2">{P.title}</CardTitle>
      <div className="flex flex-col items-center gap-3">
        <div
          className={`relative overflow-hidden rounded-card bg-ink shadow-sm ${shape === 'vertical' ? 'w-[min(100%,236px)]' : 'w-full'}`}
          style={{ aspectRatio: `${previewSize.width} / ${previewSize.height}` }}
        >
          <canvas
            ref={canvas}
            className="absolute inset-0 size-full"
            aria-label={P.title}
            role="img"
            data-testid="film-preview-canvas"
          />
          {playing === 'playing' ? (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1 bg-white/70"
              style={{ width: `${Math.min(100, (previewTime / plan.duration) * 100)}%` }}
            />
          ) : null}
        </div>
        <Hint text={P.hint}>
          <Button
            size="sm"
            variant="secondary"
            icon={playing ? <Square /> : <Play />}
            loading={playing === 'loading'}
            disabled={blocked || busy}
            onClick={() => void play()}
            data-testid="film-preview-play"
          >
            {playing ? P.stop : P.play}
          </Button>
        </Hint>
      </div>

      <div className="border-t border-line pt-4">
        {making.phase === 'done' ? (
          <div className="flex flex-col gap-3" data-testid="film-result">
            <p className="text-[14px] font-bold">{R.title}</p>
            <video
              src={making.result.url}
              controls
              playsInline
              className={`mx-auto rounded-card bg-ink ${shape === 'vertical' ? 'max-h-[420px]' : 'w-full'}`}
              data-testid="film-video"
            />
            <p className="text-[12.5px] text-muted">
              {fmt(R.size, {
                duration: seconds(making.result.durationMs),
                size: formatBytes(making.result.blob.size, locale),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Hint text={R.downloadHint}>
                <Button icon={<Download />} asChild>
                  <a
                    href={making.result.url}
                    download={`${view.slug}-film.${making.result.ext}`}
                    data-testid="film-download"
                  >
                    {R.download}
                  </a>
                </Button>
              </Hint>
              <Hint text={R.againHint}>
                <Button
                  variant="ghost"
                  icon={<RotateCcw />}
                  onClick={() => {
                    setMaking({ phase: 'idle' });
                    setAdding({ phase: 'idle' });
                  }}
                >
                  {R.again}
                </Button>
              </Hint>
            </div>
            <div className="flex flex-col gap-2 rounded-input bg-subtle p-3">
              {adding.phase === 'done' ? (
                <p className="text-[13px] font-semibold text-success" role="status" data-testid="film-added">
                  {adding.shown ? R.added : R.addedHidden}{' '}
                  <Link href={`/app/invitations/${view.id}/gallery`} className="text-brand-deep underline">
                    {t.film.back}
                  </Link>
                </p>
              ) : (
                <>
                  <Hint text={R.showHint}>
                    <span className="w-fit" data-testid="film-show">
                      <Checkbox
                        checked={show}
                        onCheckedChange={setShow}
                        label={R.show}
                        disabled={adding.phase === 'sending'}
                      />
                    </span>
                  </Hint>
                  <div className="flex flex-wrap items-center gap-3">
                    <Hint text={R.addHint}>
                      <Button
                        variant="secondary"
                        icon={<ImagePlus />}
                        loading={adding.phase === 'sending'}
                        onClick={() => void add(making.result)}
                        data-testid="film-add"
                      >
                        {R.add}
                      </Button>
                    </Hint>
                    {adding.phase === 'sending' ? (
                      <span className="text-[13px] text-muted" role="status">
                        {fmt(R.adding, { p: number(Math.round(adding.progress * 100)) })}
                      </span>
                    ) : null}
                  </div>
                  {adding.phase === 'failed' ? (
                    <p className="text-[13px] text-danger" role="alert">
                      {R.errors[adding.code]}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : busy ? (
          <div className="flex flex-col gap-2.5" data-testid="film-progress">
            <p className="text-[13.5px] font-semibold" role="status">
              {making.phase === 'preparing' ? M.preparing : fmt(M.progress, { p: number(pct) })}
            </p>
            <span
              className="flex h-2 overflow-hidden rounded-full bg-subtle"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={M.cta}
            >
              <span
                className="h-full rounded-full bg-ink transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </span>
            {making.phase === 'rendering' ? (
              <p className="text-[12.5px] text-muted" data-testid="film-engine" data-engine={making.engine}>
                {making.engine === 'webcodecs' ? M.engineCodecs : M.engineRecorder}
              </p>
            ) : null}
            <Hint text={M.cancelHint}>
              <Button
                size="sm"
                variant="secondary"
                icon={<X />}
                className="w-fit"
                onClick={() => job.current?.abort()}
                data-testid="film-cancel"
              >
                {M.cancel}
              </Button>
            </Hint>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Hint text={M.hint}>
              <Button
                icon={<Clapperboard />}
                disabled={blocked}
                onClick={() => void make()}
                data-testid="film-make-button"
              >
                {M.cta}
              </Button>
            </Hint>
            {making.phase === 'failed' ? (
              <p className="text-[13px] text-danger" role="alert" data-testid="film-error">
                {making.reason === 'unsupported' ? M.unsupported : M.failed}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
