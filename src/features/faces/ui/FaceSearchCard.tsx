'use client';

import { CircleStop, Crown, ScanFace, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardTitle, Dialog, Hint, useToast } from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { prepareFaces, type PrepareProgress } from '../client/prepare';
import type { FaceHostView } from '../server/api';

/**
 * "The photos I'm in" in the host's gallery tab (feature face_albums): where face search stands (the
 * photos prepared, the faces found, the guests who asked to be left out, until when it is open),
 * "prepare face search" in the host's browser — with progress, stop, and going on from where it
 * stopped — and turning it on, or off (its face data erased at once). Not shown where this deployment
 * doesn't offer it (INVITES_FACE_ALBUMS); the package that has it otherwise.
 */
export function FaceSearchCard({ id, initial }: { id: string; initial: FaceHostView }) {
  const { t, fmt, plural, number, date } = useUi();
  const F = t.faces;
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const [progress, setProgress] = useState<PrepareProgress | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const reload = useCallback(async () => {
    const res = await hostApi<{ view: FaceHostView }>(`/api/invitations/${id}/gallery/faces`);
    if (res.ok && res.body?.view) setView(res.body.view);
  }, [id]);

  const prepare = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ done: 0, total: Math.max(0, view.state.photos - view.state.scanned), phase: 'model' });
    const outcome = await prepareFaces(id, setProgress, controller.signal);
    abort.current = null;
    setProgress(null);
    await reload();
    if (outcome.ok) toast({ variant: 'success', title: F.prepared });
    else if (outcome.error === 'unauthorized') window.location.assign(loginUrl());
    else if (outcome.error === 'unsupported') toast({ variant: 'danger', title: F.unsupported });
    else if (outcome.error === 'failed') toast({ variant: 'danger', title: F.failed });
  };

  const setFeature = async (off: boolean) => {
    setBusy(true);
    const res = await hostApi(`/api/invitations/${id}/features`, {
      method: 'PATCH',
      body: { feature: 'face_albums', off },
    });
    setBusy(false);
    setConfirm(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ variant: 'danger', title: t.common.error });
    toast({ variant: 'success', title: off ? F.switchedOff : F.switchedOn });
    await reload();
  };

  const f = view.feature;
  const s = view.state;
  const planName = t.liveGallery.plans[f.plan];
  const ready = f.on && s.gallery && view.window.open;
  const left = Math.max(0, s.photos - s.scanned);
  const percent = s.photos ? Math.round((s.scanned / s.photos) * 100) : 0;
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-testid="face-search-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
        >
          <ScanFace className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <CardTitle as="h2" className="mb-1 flex flex-wrap items-center gap-2">
            {F.title}
            <Badge variant="info">{F.badge}</Badge>
          </CardTitle>
          <p className="text-[13px] text-muted">{F.body}</p>
        </div>
      </div>

      {f.why === 'plan' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-input border border-brand-line bg-brand-soft px-3 py-2.5 text-[13px]">
          <Crown aria-hidden className="size-4 text-brand-deep" />
          <span>{fmt(F.plan.title, { plan: planName })}</span>
          <Link href={`/app/billing?plan=${f.plan}`} className="font-semibold text-brand-deep underline">
            {fmt(F.plan.cta, { plan: planName })}
          </Link>
        </div>
      ) : f.why === 'switched_off' ? (
        <div
          className="flex flex-col items-start gap-2.5 rounded-input bg-subtle px-3 py-3 text-[13px]"
          data-testid="face-search-off"
        >
          <p className="font-semibold">{F.off.title}</p>
          <p className="text-muted">{F.off.body}</p>
          <Hint text={F.switchOnHint}>
            <Button size="sm" icon={<ScanFace />} loading={busy} onClick={() => void setFeature(false)}>
              {F.off.cta}
            </Button>
          </Hint>
        </div>
      ) : !s.gallery ? (
        <p className="text-[13px] text-muted">{F.noGallery}</p>
      ) : !view.window.open ? (
        <p className="rounded-input bg-subtle px-3 py-2 text-[13px] text-muted">{F.expired}</p>
      ) : (
        <>
          <div>
            <p className="text-[13.5px] font-semibold" data-testid="face-search-status">
              {fmt(F.status, {
                scanned: number(s.scanned),
                photos: number(s.photos),
                faces: number(s.faces),
              })}
            </p>
            <span aria-hidden className="mt-2 flex h-2 overflow-hidden rounded-full bg-subtle">
              <span
                className="h-full rounded-full bg-ink transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </span>
            <ul className="mt-2 grid gap-0.5 text-[12.5px] text-muted">
              {s.excluded ? <li>{fmt(F.excluded, { n: number(s.excluded) })}</li> : null}
              {s.optouts ? <li>{plural(F.optouts, s.optouts, { n: number(s.optouts) })}</li> : null}
              {view.window.until ? (
                <li>
                  {fmt(F.window, {
                    date: date(`${view.window.until}T12:00:00Z`, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }),
                  })}
                </li>
              ) : null}
            </ul>
          </div>
          {progress ? (
            <div
              className="flex flex-wrap items-center gap-3"
              role="status"
              data-testid="face-search-progress"
            >
              <span className="text-[13px]">
                {progress.phase === 'model'
                  ? F.loadingModel
                  : fmt(F.preparing, { done: number(progress.done), total: number(progress.total) })}
              </span>
              <Hint text={F.stopHint}>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<CircleStop />}
                  onClick={() => abort.current?.abort()}
                >
                  {F.stop}
                </Button>
              </Hint>
            </div>
          ) : left ? (
            <Hint text={F.prepareHint}>
              <Button
                size="sm"
                icon={<ScanFace />}
                className="self-start"
                onClick={() => void prepare()}
                disabled={!ready}
                data-testid="face-search-prepare"
              >
                {F.prepare}
              </Button>
            </Hint>
          ) : (
            <p className="text-[13px] text-success">{F.allReady}</p>
          )}
          <p className="flex items-start gap-2 text-[12px] text-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {F.privacy}
          </p>
          <div className="border-t border-line pt-3">
            <Hint text={F.switchOffHint}>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 />}
                onClick={() => setConfirm(true)}
                data-testid="face-search-switch-off"
              >
                {F.switchOff}
              </Button>
            </Hint>
          </div>
        </>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={F.confirmTitle}
        description={F.confirmBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" icon={<Trash2 />} loading={busy} onClick={() => void setFeature(true)}>
              {F.confirm}
            </Button>
          </>
        }
      />
    </Card>
  );
}
