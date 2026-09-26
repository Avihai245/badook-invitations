'use client';

import {
  ArrowLeftRight,
  Clapperboard,
  Crown,
  Film,
  Images,
  Music,
  Pin,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaHelp,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Field,
  Hint,
  PageHeader,
  Segmented,
  Select,
  useToast,
} from '@/components/app';
import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { formatDate } from '@/features/invitations/lib/dates';
import { FILM_CARDS } from '@/lib/i18n/film-cards';
import { useUi } from '@/lib/i18n/client';
import { loadFilmChoice, saveFilmChoice } from '../client/choice';
import { loadCardFonts, type CardStyle } from '../client/paint';
import { suggestedQuality } from '../client/render';
import { FILM, filmSize, type FilmLength, type FilmQuality, type FilmShape } from '../config';
import { NO_CHOICE, selectShots, usable, type FilmCandidate, type FilmChoice } from '../select';
import type { FilmView } from '../server/api';
import { planFilm, shotCount } from '../timeline';
import { MakeCard } from './MakeCard';
import { ShotsCard } from './ShotsCard';
import { useFilmTrack, type MusicSource } from './useFilmTrack';

type Help = ReturnType<typeof useUi>['t']['film']['help']['items'];
const HELP_ICONS: Record<keyof Help, LucideIcon> = {
  choose: Sparkles,
  pin: Pin,
  music: Music,
  shape: ArrowLeftRight,
  make: Clapperboard,
  gallery: Images,
};

/** Up to this many card languages side by side; more are a list. */
const SIDE_BY_SIDE = 3;

/**
 * /app/invitations/[id]/gallery/film — the highlights film studio (feature auto_reel): the film's
 * length, shape, quality, card language (any of the invitation's — the cards right to left in Hebrew
 * and Arabic, in the invitation's faces for every script) and music; the shots it chose (pin, remove,
 * reorder, add); a preview; making it in this browser with progress and cancel; then download, and add
 * it to the gallery. Without the feature it offers the package that has it; without a gallery, the
 * gallery tab.
 */
export function FilmStudio({ initial }: { initial: FilmView }) {
  const { t, fmt } = useUi();
  const F = t.film;
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const id = view.id;
  const [busy, setBusy] = useState(false);

  // the host's choices (kept in this browser), the length and the shape
  const [choice, setChoice] = useState<FilmChoice>(NO_CHOICE);
  const [length, setLength] = useState<FilmLength>(60);
  const [shape, setShape] = useState<FilmShape>('vertical');
  const [quality, setQuality] = useState<FilmQuality>('full');
  const [cardLocale, setCardLocale] = useState<Locale>(view.event.defaultLocale);
  const [music, setMusic] = useState<MusicSource>(view.music.url ? 'invitation' : 'none');
  const restored = useRef(false);
  useEffect(() => {
    const saved = loadFilmChoice(id);
    setChoice({ pinned: saved.pinned, excluded: saved.excluded, order: saved.order });
    if (saved.length) setLength(saved.length);
    if (saved.shape) setShape(saved.shape);
    setQuality(suggestedQuality());
    restored.current = true;
  }, [id]);
  useEffect(() => {
    if (restored.current) saveFilmChoice(id, { ...choice, length, shape });
  }, [id, choice, length, shape]);

  const { state: track, pick } = useFilmTrack(music, view.music.url);
  const ready = track.status === 'ready' ? track : null;

  // the film: the shots chosen and the edit
  const candidates = useMemo<FilmCandidate[]>(
    () =>
      view.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        width: i.width,
        height: i.height,
        durationMs: i.durationMs,
        at: i.at,
        sharpness: i.sharpness,
        brightness: i.brightness,
        aiQuality: i.aiQuality,
        phash: i.phash,
        faces: i.faces,
      })),
    [view.items],
  );
  const usableCount = useMemo(() => candidates.filter(usable).length, [candidates]);
  const bpm = ready?.analysis.bpm ?? FILM.tempo.fallback;
  const selection = useMemo(
    () => selectShots(candidates, { count: shotCount(length, bpm), shape, choice }),
    [candidates, length, bpm, shape, choice],
  );
  const plan = useMemo(() => {
    const analysis = ready?.analysis;
    const startAt =
      ready && music === 'invitation'
        ? Math.max(view.music.startAt, analysis!.start)
        : (analysis?.start ?? 0);
    return planFilm({
      beats: analysis?.beats ?? [],
      downbeat: analysis?.downbeat ?? 0,
      bpm,
      trackDuration: ready ? ready.buffer.duration : Infinity,
      startAt,
      length,
      items: selection.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        durationMs: i.durationMs,
        priority: selection.priority.get(i.id) ?? 0,
      })),
    });
  }, [ready, music, view.music.startAt, bpm, length, selection]);

  const size = filmSize(shape, quality);
  // the cards in their language: the names, the date (as the invitation writes it — Arabic in Latin
  // digits) and the end card's line, in the invitation's faces for that script, right to left in
  // Hebrew and Arabic
  const cardLang: Locale = view.event.locales.includes(cardLocale) ? cardLocale : view.event.defaultLocale;
  const card = useMemo<CardStyle>(() => {
    const p = view.event.palette;
    const fonts = view.event.fonts;
    return {
      bg: p.bg,
      surface: p.surface,
      ink: p.ink,
      muted: p.inkMuted,
      accent: p.accent,
      display: fonts.display[cardLang] ?? fonts.display[view.event.defaultLocale] ?? 'serif',
      heading: fonts.heading[cardLang] ?? fonts.heading[view.event.defaultLocale] ?? 'serif',
      names: view.event.names[cardLang] ?? Object.values(view.event.names)[0] ?? '',
      date: formatDate(view.event.date, cardLang, { day: 'numeric', month: 'long', year: 'numeric' }),
      thanks: FILM_CARDS[cardLang].thanks,
      rtl: RTL_LOCALES.includes(cardLang),
    };
  }, [view.event, cardLang]);

  // the cards' faces, before they are painted (again for another language)
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    setFontsReady(false);
    void loadCardFonts(card).finally(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, [card]);

  /** Fresh signed URLs when they are about to expire (a page left open for hours). */
  const fresh = async (): Promise<FilmView> => {
    if (Date.now() < view.expiresAt - 30 * 60_000) return view;
    const res = await hostApi<{ view?: FilmView }>(`/api/invitations/${id}/gallery/film`);
    if (res.ok && res.body?.view) {
      setView(res.body.view);
      return res.body.view;
    }
    return view;
  };

  const turnOn = async () => {
    setBusy(true);
    const res = await hostApi(`/api/invitations/${id}/features`, {
      method: 'PATCH',
      body: { feature: 'auto_reel', off: false },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    const next = await hostApi<{ view?: FilmView }>(`/api/invitations/${id}/gallery/film`);
    setBusy(false);
    if (!res.ok || !next.body?.view) return toast({ variant: 'danger', title: t.common.error });
    setView(next.body.view);
  };

  const help = (
    <AreaHelp
      label={t.common.helpLabel}
      title={F.help.title}
      items={(Object.keys(F.help.items) as (keyof Help)[]).map((key) => {
        const Icon = HELP_ICONS[key];
        return { icon: <Icon />, label: F.help.items[key].label, text: F.help.items[key].text };
      })}
    />
  );
  const back = (
    <Button variant="secondary" size="sm" icon={<Images />} asChild>
      <Link href={`/app/invitations/${id}/gallery`}>{F.back}</Link>
    </Button>
  );
  const header = (
    <PageHeader size="section" title={F.title} help={help} description={F.subtitle} actions={back} />
  );
  const wrap = (children: React.ReactNode) => (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6" data-testid="film-studio">
      {header}
      {children}
    </div>
  );

  const f = view.feature;
  if (!f.on) {
    const planName = t.liveGallery.plans[f.plan];
    if (f.why === 'plan')
      return wrap(
        <Card
          padding="lg"
          className="mt-6 flex flex-col items-start gap-3 border-brand-line bg-brand-soft"
          data-testid="film-upgrade"
        >
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-full bg-surface text-brand-deep"
          >
            <Crown className="size-5" />
          </span>
          <h2 className="text-[18px] font-bold">{fmt(F.plan.title, { plan: planName })}</h2>
          <p className="max-w-[60ch] text-[14px] text-muted">{F.plan.body}</p>
          <Button icon={<Sparkles />} asChild>
            <Link href={`/app/billing?plan=${f.plan}`}>{fmt(F.plan.cta, { plan: planName })}</Link>
          </Button>
        </Card>,
      );
    if (f.why === 'switched_off')
      return wrap(
        <EmptyState
          className="mt-6 py-14"
          illustration={<Film className="size-10 text-muted" aria-hidden />}
          title={F.off.title}
          description={F.off.body}
          action={
            <Hint text={F.off.hint}>
              <Button icon={<Film />} loading={busy} onClick={() => void turnOn()} data-testid="film-turn-on">
                {F.off.cta}
              </Button>
            </Hint>
          }
        />,
      );
    return wrap(
      <EmptyState className="mt-6 py-14" title={F.unavailable.title} description={F.unavailable.body} />,
    );
  }
  if (!view.gallery)
    return wrap(
      <EmptyState
        className="mt-6 py-14"
        illustration={<Images className="size-10 text-muted" aria-hidden />}
        title={F.noGallery.title}
        description={F.noGallery.body}
        action={
          <Button icon={<Images />} asChild>
            <Link href={`/app/invitations/${id}/gallery`}>{F.noGallery.cta}</Link>
          </Button>
        }
      />,
    );
  if (usableCount < FILM.select.minItems)
    return wrap(
      <div data-testid="film-empty">
        <EmptyState
          className="mt-6 py-14"
          illustration={<Film className="size-10 text-muted" aria-hidden />}
          title={F.empty.title}
          description={fmt(F.empty.body, { n: FILM.select.minItems })}
        />
      </div>,
    );

  const S = F.settings;
  const musicOptions = [
    ...(view.music.url ? [{ value: 'invitation' as const, label: S.musicInvitation }] : []),
    { value: 'upload' as const, label: S.musicUpload },
    { value: 'none' as const, label: S.musicNone },
  ];
  const shortSong = ready && plan.duration < length - 8;
  const musicStatus =
    track.status === 'reading'
      ? S.reading
      : track.status === 'failed'
        ? track.reason === 'size'
          ? fmt(S.tooBig, { mb: Math.round(FILM.audio.uploadBytes / 1024 / 1024) })
          : S.failed
        : ready
          ? fmt(S.ready, { bpm: Math.round(ready.analysis.bpm) })
          : music === 'none'
            ? S.silent
            : music === 'invitation' && !view.music.url
              ? S.noInvitationSong
              : null;

  const settings = (
    <Card padding="lg" className="flex flex-col gap-4" data-testid="film-settings">
      <CardTitle as="h2">{S.title}</CardTitle>
      <Field label={S.length} help={S.lengthHint}>
        <Segmented
          value={String(length) as `${FilmLength}`}
          onValueChange={(v) => setLength(Number(v) as FilmLength)}
          options={FILM.lengths.map((n) => ({
            value: String(n) as `${FilmLength}`,
            label: fmt(S.seconds, { n }),
          }))}
          fullWidth
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label={S.shape} help={S.shapeHint}>
          <Segmented
            value={shape}
            onValueChange={setShape}
            options={[
              { value: 'vertical', label: S.vertical },
              { value: 'horizontal', label: S.horizontal },
            ]}
            fullWidth
          />
        </Field>
        <Field label={S.quality} help={S.qualityHint}>
          <Segmented
            value={quality}
            onValueChange={setQuality}
            options={[
              { value: 'full', label: S.full },
              { value: 'light', label: S.light },
            ]}
            fullWidth
          />
        </Field>
      </div>
      {view.event.locales.length > 1 ? (
        <Field label={S.language} help={S.languageHint}>
          {view.event.locales.length <= SIDE_BY_SIDE ? (
            <Segmented
              value={cardLang}
              onValueChange={setCardLocale}
              options={view.event.locales.map((l) => ({ value: l, label: S.languageNames[l] }))}
              fullWidth
            />
          ) : (
            <Select
              value={cardLang}
              onChange={(e) => setCardLocale(e.target.value as Locale)}
              data-testid="film-card-language"
            >
              {view.event.locales.map((l) => (
                <option key={l} value={l} lang={l}>
                  {S.languageNames[l]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label={S.music} help={S.musicHint}>
        <Segmented value={music} onValueChange={setMusic} options={musicOptions} fullWidth />
      </Field>
      {music === 'upload' ? (
        <Hint text={S.uploadHint}>
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-btn border border-line bg-surface px-3 py-2 text-[13px] font-semibold hover:bg-subtle focus-within:outline-2 focus-within:outline-focus">
            <Upload aria-hidden className="size-4" />
            {ready?.source === 'upload' && ready.name ? ready.name : S.uploadCta}
            <input
              type="file"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus,.webm"
              className="sr-only"
              data-testid="film-music-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(file);
                e.target.value = '';
              }}
            />
          </label>
        </Hint>
      ) : null}
      {musicStatus ? (
        <p
          className={`flex items-center gap-2 text-[13px] ${track.status === 'failed' ? 'text-danger' : 'text-muted'}`}
          role="status"
          data-testid="film-music-status"
          data-status={track.status}
        >
          <Music aria-hidden className="size-4 shrink-0" />
          {musicStatus}
        </p>
      ) : null}
      {shortSong ? (
        <p className="text-[12.5px] text-muted">{fmt(S.short, { n: Math.round(plan.duration) })}</p>
      ) : null}
    </Card>
  );

  const musicPending = music !== 'none' && !ready;
  return wrap(
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid gap-5 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4">
        {settings}
        <MakeCard
          view={view}
          plan={plan}
          size={size}
          shape={shape}
          quality={quality}
          card={card}
          fontsReady={fontsReady}
          track={ready?.buffer ?? null}
          blocked={musicPending || plan.shots.filter((s) => s.kind === 'item').length < FILM.select.minItems}
          fresh={fresh}
        />
      </div>
      <div className="lg:col-start-1 lg:row-start-1">
        <ShotsCard
          view={view}
          plan={plan}
          choice={choice}
          onChoice={setChoice}
          dropped={plan.dropped.length}
        />
      </div>
    </div>,
  );
}
