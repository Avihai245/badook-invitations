'use client';

import {
  CalendarClock,
  Check,
  Copy,
  Crown,
  Download,
  ExternalLink,
  Images,
  KeyRound,
  Link2,
  MonitorPlay,
  Pause,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  AreaHelp,
  Badge,
  Button,
  Card,
  CardTitle,
  Dialog,
  EmptyState,
  Hint,
  KpiCard,
  PageHeader,
  useToast,
} from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { GALLERY } from '../../config';
import { useLiveRefresh } from '../../client/live';
import { formatBytes } from '../../format';
import type { HostGalleryView } from '../../server/host-api';
import type { HostPageData } from '../../server/pages';
import { DownloadDialog } from './DownloadDialog';
import type { HostAction } from './ItemTile';
import { ItemsSection } from './ItemsSection';
import { SettingsCard, type SettingsPatch } from './SettingsCard';
import { ShareCard } from './ShareCard';

type Help = ReturnType<typeof useUi>['t']['liveGallery']['help']['items'];
const HELP_ICONS: Record<keyof Help, LucideIcon> = {
  link: Link2,
  rotate: RefreshCw,
  mode: Check,
  pause: Pause,
  code: KeyRound,
  window: CalendarClock,
  ai: ShieldCheck,
  review: Check,
  delete: Trash2,
  projector: MonitorPlay,
  download: Download,
};

/**
 * The invitation's "Gallery" tab: turn the live gallery on; its link and QR code for guests; the
 * settings; the venue screen; the review queue and every photo and video; download everything; delete
 * the gallery. Without live_gallery in the plan it offers the package that has it (packageFor). Stays
 * current by itself (a live hint, polling while that is down).
 */
export function GalleryScreen({ initial }: { initial: HostPageData }) {
  const { t, fmt, number, date, locale, plural } = useUi();
  const L = t.liveGallery;
  const { toast } = useToast();
  const router = useRouter();
  const [view, setView] = useState<HostGalleryView>(initial.view);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = view.id;
  const g = view.gallery;
  const f = view.features.live_gallery;

  const call = useCallback(
    async <T,>(url: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
      const res = await hostApi<T & { ok?: boolean; code?: string }>(url, { method, body });
      if (res.status === 401) {
        window.location.assign(loginUrl());
        return null;
      }
      if (!res.ok) {
        toast({ title: t.common.error, variant: 'danger' });
        return null;
      }
      return res.body;
    },
    [t.common.error, toast],
  );

  const reload = useCallback(async () => {
    const body = await hostApi<{ view: HostGalleryView }>(`/api/invitations/${id}/gallery`);
    if (body.ok && body.body?.view) setView(body.body.view);
    setVersion((v) => v + 1);
  }, [id]);

  const live = useLiveRefresh(g?.realtime ?? null, () => void reload(), GALLERY.live.pollHostMs);

  const turnOn = async () => {
    setBusy(true);
    const body = await call<{ view: HostGalleryView }>(`/api/invitations/${id}/gallery`, 'POST', {});
    setBusy(false);
    if (body?.view) setView(body.view);
  };
  const patch = async (p: SettingsPatch, done?: string) => {
    const body = await call<{ view: HostGalleryView }>(`/api/invitations/${id}/gallery`, 'PATCH', p);
    if (!body?.view) return false;
    setView(body.view);
    if (done) toast({ title: done, variant: 'success' });
    return true;
  };
  const rotate = async (which: 'upload' | 'projector') => {
    const body = await call<{ view: HostGalleryView }>(`/api/invitations/${id}/gallery/rotate`, 'POST', {
      which,
    });
    if (body?.view) setView(body.view);
    return !!body?.view;
  };
  const feature = async (name: 'gallery_ai' | 'live_gallery', on: boolean) => {
    const body = await call(`/api/invitations/${id}/features`, 'PATCH', { feature: name, off: !on });
    if (body) {
      await reload();
      toast({ title: L.settings.saved, variant: 'success' });
    }
  };
  const moderate = async (ids: string[], action: HostAction) => {
    const body = await call<{ count: number }>(`/api/invitations/${id}/gallery/items`, 'POST', {
      action,
      ids,
    });
    if (!body) return false;
    toast({ title: plural(L.items.done[action], body.count), variant: 'success' });
    void reload();
    return true;
  };
  const deleteGallery = async () => {
    setBusy(true);
    const body = await call(`/api/invitations/${id}/gallery`, 'DELETE', {});
    setBusy(false);
    setConfirmDelete(false);
    if (!body) return;
    toast({ title: L.danger.deleted, variant: 'success' });
    router.refresh();
    await reload();
  };

  const help = (
    <AreaHelp
      label={t.common.helpLabel}
      title={L.help.title}
      items={(Object.keys(L.help.items) as (keyof Help)[]).map((key) => {
        const Icon = HELP_ICONS[key];
        return { icon: <Icon />, label: L.help.items[key].label, text: L.help.items[key].text };
      })}
    />
  );
  const planName = (plan: 'free' | 'pro' | 'business') => L.plans[plan];

  // ── not in the plan / switched off / not offered here ──
  if (!f.on && !g) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
        <PageHeader size="section" title={L.title} help={help} description={L.subtitle} />
        {f.why === 'plan' ? (
          <Card
            padding="lg"
            className="mt-6 flex flex-col items-start gap-3 border-brand-line bg-brand-soft"
            data-testid="gallery-upgrade"
          >
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-full bg-surface text-brand-deep"
            >
              <Crown className="size-5" />
            </span>
            <h2 className="text-[18px] font-bold">{fmt(L.plan.title, { plan: planName(f.plan) })}</h2>
            <p className="max-w-[60ch] text-[14px] text-muted">{L.plan.body}</p>
            <ul className="grid gap-1.5 text-[13.5px]">
              {L.start.points.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-wrap gap-2">
              <Hint text={L.hints.upgrade}>
                <Button icon={<Sparkles />} asChild>
                  <Link href={`/app/billing?plan=${f.plan}`}>
                    {fmt(L.plan.cta, { plan: planName(f.plan) })}
                  </Link>
                </Button>
              </Hint>
              <Button variant="secondary" asChild>
                <Link href="/app/billing">{L.plan.compare}</Link>
              </Button>
            </div>
          </Card>
        ) : f.why === 'switched_off' ? (
          <EmptyState
            className="mt-6 py-14"
            illustration={<GalleryArt />}
            title={L.switchedOff.title}
            description={L.switchedOff.body}
            action={
              <Hint text={L.hints.switchOn}>
                <Button icon={<Images />} onClick={() => void feature('live_gallery', true)}>
                  {L.switchedOff.cta}
                </Button>
              </Hint>
            }
          />
        ) : (
          <EmptyState
            className="mt-6 py-14"
            illustration={<GalleryArt />}
            title={L.unavailable.title}
            description={L.unavailable.body}
          />
        )}
      </div>
    );
  }

  // ── not on yet ──
  if (!g) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
        <PageHeader size="section" title={L.title} help={help} description={L.subtitle} />
        <Card
          padding="lg"
          className="mt-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-center"
          data-testid="gallery-start"
        >
          <div>
            <h2 className="text-[20px] font-bold">{L.start.title}</h2>
            <p className="mt-1 max-w-[62ch] text-[14px] text-muted">{L.start.body}</p>
            <ul className="mt-4 grid gap-2 text-[14px]">
              {L.start.points.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {p}
                </li>
              ))}
            </ul>
            <Hint text={L.hints.turnOn}>
              <Button
                size="lg"
                className="mt-5"
                icon={<Images />}
                loading={busy}
                onClick={() => void turnOn()}
              >
                {L.start.cta}
              </Button>
            </Hint>
          </div>
          <div className="hidden md:block">
            <GalleryArt large />
          </div>
        </Card>
      </div>
    );
  }

  const counts = view.counts!;
  const stateLabel =
    g.state === 'scheduled' && g.opensAt
      ? fmt(L.state.scheduled, {
          date: date(g.opensAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        })
      : L.state[g.state];
  const projector = view.features.projector;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6" data-testid="gallery-screen">
      <PageHeader
        size="section"
        title={L.title}
        help={help}
        description={L.subtitle}
        actions={<DownloadDialog invitationId={id} slug={view.slug} counts={counts} />}
      />
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Badge
          variant={g.state === 'open' ? 'live' : g.state === 'off' ? 'neutral' : 'warning'}
          data-testid="gallery-state"
        >
          {stateLabel}
        </Badge>
        <span className="text-muted">{live === 'live' ? L.live.live : L.live.polling}</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={L.kpi.label} role="group">
        <KpiCard
          label={L.kpi.photos}
          value={number(counts.images)}
          sub={fmt(L.kpi.size, { size: formatBytes(counts.bytes, locale) })}
          icon={<Images />}
        />
        <KpiCard label={L.kpi.videos} value={number(counts.videos)} icon={<Video />} />
        <KpiCard label={L.kpi.pending} value={number(counts.pending)} icon={<ShieldCheck />} />
        <KpiCard label={L.kpi.uploaders} value={number(counts.uploaders)} icon={<Smartphone />} />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <ShareCard view={view} onRotate={rotate} />
          {projector.why !== 'unavailable' ? (
            <ProjectorCard
              url={g.projectorUrl}
              planned={projector.on}
              plan={projector.plan}
              onRotate={() => rotate('projector')}
            />
          ) : null}
        </div>
        <SettingsCard view={view} onPatch={patch} onAi={(on) => feature('gallery_ai', on)} />
      </div>

      <ItemsSection
        key={id}
        invitationId={id}
        initialPending={initial.pending}
        initialItems={initial.items}
        initialNext={initial.next}
        version={version}
        onModerate={moderate}
      />

      <Card padding="lg" className="mt-10 border-[#fecaca]" data-testid="gallery-danger">
        <CardTitle as="h2" className="mb-1 text-danger">
          {L.danger.title}
        </CardTitle>
        <p className="text-[13px] text-muted">{L.danger.body}</p>
        <Hint text={L.hints.deleteGallery}>
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            icon={<Trash2 />}
            onClick={() => setConfirmDelete(true)}
          >
            {L.danger.button}
          </Button>
        </Hint>
      </Card>
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={L.danger.confirmTitle}
        description={fmt(L.danger.confirmBody, { n: number(counts.total) })}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" loading={busy} icon={<Trash2 />} onClick={() => void deleteGallery()}>
              {L.danger.confirm}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ProjectorCard({
  url,
  planned,
  plan,
  onRotate,
}: {
  url: string | null;
  planned: boolean;
  plan: 'free' | 'pro' | 'business';
  onRotate(): Promise<boolean>;
}) {
  const { t, fmt } = useUi();
  const P = t.liveGallery.projector;
  const h = t.liveGallery.hints;
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const planName = t.liveGallery.plans[plan];
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-testid="gallery-projector">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
        >
          <MonitorPlay className="size-[18px]" />
        </span>
        <div>
          <CardTitle as="h2" className="mb-1">
            {P.title}
          </CardTitle>
          <p className="text-[13px] text-muted">{P.body}</p>
        </div>
      </div>
      {!planned ? (
        <div className="flex flex-wrap items-center gap-3 rounded-input border border-brand-line bg-brand-soft px-3 py-2.5 text-[13px]">
          <span>{fmt(P.plan, { plan: planName })}</span>
          <Link href={`/app/billing?plan=${plan}`} className="font-semibold text-brand-deep underline">
            {fmt(P.upgrade, { plan: planName })}
          </Link>
        </div>
      ) : url ? (
        <div className="flex flex-wrap gap-2">
          <Hint text={h.projectorOpen}>
            <Button size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
              <a href={url} target="_blank" rel="noreferrer" data-testid="gallery-projector-open">
                {P.open}
              </a>
            </Button>
          </Hint>
          <Hint text={h.projectorCopy}>
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy />}
              onClick={() =>
                void navigator.clipboard.writeText(url).then(
                  () => toast({ title: P.copied, variant: 'success' }),
                  () => toast({ title: t.liveGallery.share.copyFailed, variant: 'danger' }),
                )
              }
            >
              {P.copy}
            </Button>
          </Hint>
          <Hint text={h.projectorRotate}>
            <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setConfirm(true)}>
              {P.rotate}
            </Button>
          </Hint>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-warning">{P.lost}</p>
          <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => setConfirm(true)}>
            {P.rotate}
          </Button>
        </div>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={P.rotateTitle}
        description={P.rotateBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await onRotate();
                setBusy(false);
                if (ok) setConfirm(false);
              }}
            >
              {P.rotateConfirm}
            </Button>
          </>
        }
      />
    </Card>
  );
}

/** A small stack of photos (decorative). */
function GalleryArt({ large = false }: { large?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={large ? 'size-40' : undefined} aria-hidden>
      <circle cx="60" cy="60" r="44" fill="#F6EDE1" />
      <rect
        x="30"
        y="34"
        width="44"
        height="54"
        rx="4"
        transform="rotate(-8 52 61)"
        fill="#fff"
        stroke="#A0703F"
        strokeWidth="2"
      />
      <rect
        x="46"
        y="30"
        width="44"
        height="54"
        rx="4"
        transform="rotate(7 68 57)"
        fill="#fff"
        stroke="#A0703F"
        strokeWidth="2"
      />
      <path d="M54 70l8-10 7 8 5-5 9 11H54z" fill="#EAD8C0" transform="rotate(7 68 57)" />
      <circle cx="78" cy="46" r="4" fill="#EAD8C0" transform="rotate(7 68 57)" />
    </svg>
  );
}
