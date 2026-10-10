'use client';
/* eslint-disable @next/next/no-img-element -- photos from the host's device and short-lived signed URLs of private storage */

import { Camera, ExternalLink, Images, Plus, Save, Sparkles, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  useToast,
} from '@/components/app';
import { RTL_LOCALES, type L10n, type Locale } from '@/features/invitations/contracts/types';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { AI_PHOTOS } from '../config';
import { nameIn, type Role } from '../model';
import { shrinkPhoto, type ShrunkPhoto } from '../client/photo';
import type { HostAiPerson, HostAiPhoto, HostAiView } from '../types';

const PER_EVENT = [25, 50, 100, 150, 200, 300, 500];

interface Draft {
  key: string;
  person: HostAiPerson | null;
  role: Role;
  name: L10n;
}

/**
 * The AI photos' setup (/app/invitations/:id/gallery/ai, feature ai_photos): the people of honor —
 * started from who the invitation celebrates (a couple's two, the bar mitzvah boy…), each with a role,
 * a name in each of the invitation's languages, a few helpful words and a photo (made small on this
 * device) — the hosts' consent, turning it on for guests, the limits, adding to the gallery, and every
 * photo the guests made (opened, deleted).
 */
export function AiPhotosSetup({ initial }: { initial: HostAiView }) {
  const { t, fmt, number, date } = useUi();
  const P = t.aiPhotos;
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const id = view.id;
  const s = view.settings;

  // people being added (not saved yet): from the invitation's hosts when there is nobody
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    initial.people.length
      ? []
      : initial.suggested.map((p, k) => ({ key: `s${k}`, person: null, role: p.role, name: p.name })),
  );
  const editors: Draft[] = [
    ...view.people.map((p) => ({ key: p.id, person: p, role: p.role, name: p.name })),
    ...drafts,
  ];

  const settings = async (patch: Record<string, unknown>) => {
    const res = await hostApi<{ view?: HostAiView; code?: string }>(`/api/invitations/${id}/ai-photos`, {
      method: 'PATCH',
      body: patch,
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body?.view) {
      const code = res.body?.code;
      toast({
        title:
          code === 'consent'
            ? P.settings.needConsent
            : code === 'no_people'
              ? P.settings.needPeople
              : P.failed,
        variant: 'danger',
      });
      return;
    }
    setView(res.body.view);
    toast({ title: P.settings.saved, variant: 'success' });
  };

  // ── the guests' photos ──
  const [photos, setPhotos] = useState<HostAiPhoto[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const loadPhotos = useCallback(
    async (before: string | null = null) => {
      const res = await hostApi<{ photos: HostAiPhoto[]; next: string | null }>(
        `/api/invitations/${id}/ai-photos/photos${before ? `?before=${encodeURIComponent(before)}` : ''}`,
      );
      if (!res.ok || !res.body) return setPhotos((p) => p ?? []);
      setPhotos((p) => (before && p ? [...p, ...res.body!.photos] : res.body!.photos));
      setNext(res.body.next);
    },
    [id],
  );
  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);
  const [confirmPhoto, setConfirmPhoto] = useState<string | null>(null);
  const deletePhoto = async (photoId: string) => {
    const res = await hostApi(`/api/invitations/${id}/ai-photos/photos`, {
      method: 'POST',
      body: { action: 'delete', ids: [photoId] },
    });
    setConfirmPhoto(null);
    if (!res.ok) return toast({ title: P.failed, variant: 'danger' });
    setPhotos((list) => list?.filter((p) => p.id !== photoId) ?? null);
    toast({ title: P.photos.deleted, variant: 'success' });
  };

  const full = editors.length >= AI_PHOTOS.people.max;
  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6" data-testid="ai-setup">
      <PageHeader
        size="section"
        title={P.title}
        description={P.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Images />} asChild>
              <Link href={`/app/invitations/${id}/gallery`}>{P.back}</Link>
            </Button>
            <Badge variant={s.enabled ? 'live' : 'neutral'}>{s.enabled ? P.card.on : P.card.off}</Badge>
          </div>
        }
      />
      {!view.gallery ? (
        <p className="mt-4 rounded-input bg-warning-bg px-3 py-2.5 text-[13px] text-warning">{P.noGallery}</p>
      ) : null}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card padding="lg" className="flex flex-col gap-4" data-testid="ai-people">
          <div>
            <CardTitle as="h2" className="mb-1">
              {P.people.title}
            </CardTitle>
            <p className="text-[13px] text-muted">
              {fmt(P.people.body, { max: number(AI_PHOTOS.people.max) })}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {editors.map((d) => (
              <PersonEditor
                key={d.key}
                invitationId={id}
                draft={d}
                locales={view.event.locales}
                roles={view.roles}
                onSaved={(v) => {
                  setView(v);
                  if (!d.person) setDrafts((list) => list.filter((x) => x.key !== d.key));
                }}
                onRemoved={(v) => {
                  if (v) setView(v);
                  else setDrafts((list) => list.filter((x) => x.key !== d.key));
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus />}
              disabled={full}
              onClick={() =>
                setDrafts((list) => [
                  ...list,
                  { key: `n${Date.now()}`, person: null, role: view.roles[0]!, name: {} },
                ])
              }
            >
              {P.people.add}
            </Button>
            {full ? (
              <span className="self-center text-[12.5px] text-muted">
                {fmt(P.people.full, { max: number(AI_PHOTOS.people.max) })}
              </span>
            ) : null}
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col gap-4" data-testid="ai-settings">
          <CardTitle as="h2">{P.settings.title}</CardTitle>
          <div className="rounded-input border border-line p-3">
            <p className="mb-2 text-[13.5px] font-semibold">{P.settings.consent}</p>
            <Checkbox
              checked={!!s.consentAt}
              onCheckedChange={(on) => void settings({ consent: on })}
              label={P.settings.consentLabel}
            />
            <p className="mt-1.5 text-[12px] text-muted">
              {P.settings.consentHint}
              {s.consentAt ? ` · ${date(s.consentAt)}` : ''}
            </p>
          </div>
          <SettingRow label={P.settings.enabled} hint={P.settings.enabledHint}>
            <Switch
              label={P.settings.enabled}
              checked={s.enabled}
              onCheckedChange={(on) => void settings({ enabled: on })}
            />
          </SettingRow>
          <SettingRow label={P.settings.perGuest} hint={P.settings.perGuestHint}>
            <Select
              value={s.perGuest}
              onChange={(e) => void settings({ perGuest: Number(e.target.value) })}
              aria-label={P.settings.perGuest}
              wrapperClassName="w-24"
            >
              {Array.from(
                { length: AI_PHOTOS.limits.perGuest.max - AI_PHOTOS.limits.perGuest.min + 1 },
                (_, k) => AI_PHOTOS.limits.perGuest.min + k,
              ).map((n) => (
                <option key={n} value={n}>
                  {number(n)}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow label={P.settings.perEvent} hint={P.settings.perEventHint}>
            <Select
              value={s.perEvent}
              onChange={(e) => void settings({ perEvent: Number(e.target.value) })}
              aria-label={P.settings.perEvent}
              wrapperClassName="w-28"
            >
              {[...new Set([...PER_EVENT, s.perEvent])]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {number(n)}
                  </option>
                ))}
            </Select>
          </SettingRow>
          <SettingRow label={P.settings.toGallery} hint={P.settings.toGalleryHint}>
            <Switch
              label={P.settings.toGallery}
              checked={s.toGallery}
              onCheckedChange={(on) => void settings({ toGallery: on })}
            />
          </SettingRow>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="ai-photos-made">
        <h2 id="ai-photos-made" className="mb-3 text-[18px] font-bold">
          {P.photos.title}
        </h2>
        {!photos ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, k) => (
              <Skeleton key={k} height={220} radius={12} />
            ))}
          </div>
        ) : !photos.length ? (
          <p className="rounded-input bg-subtle px-3 py-3 text-[13.5px] text-muted">{P.photos.empty}</p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" data-testid="ai-photos-list">
              {photos.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-surface"
                >
                  <div className="grid aspect-[3/4] place-items-center bg-subtle">
                    {p.thumb ? (
                      <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Sparkles aria-hidden className="size-6 text-muted" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant={
                          p.status === 'done'
                            ? 'live'
                            : p.status === 'blocked' || p.status === 'failed'
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {P.photos.status[p.status]}
                      </Badge>
                      {p.shared ? <Badge variant="neutral">{P.photos.inGallery}</Badge> : null}
                    </div>
                    <p className="line-clamp-2 text-[12.5px]" title={p.prompt}>
                      <bdi>{p.prompt}</bdi>
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {fmt(P.photos.by, { name: p.guestName || P.photos.anonymous })} ·{' '}
                      {date(p.createdAt, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <div className="mt-auto flex gap-1 pt-1">
                      {p.result ? (
                        <a
                          href={p.result}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-8 place-items-center rounded-full hover:bg-subtle"
                          aria-label={P.photos.open}
                          title={P.photos.open}
                        >
                          <ExternalLink aria-hidden className="icon-dir size-4" />
                        </a>
                      ) : null}
                      {p.source ? (
                        <a
                          href={p.source}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-8 place-items-center rounded-full hover:bg-subtle"
                          aria-label={P.photos.original}
                          title={P.photos.original}
                        >
                          <Camera aria-hidden className="size-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setConfirmPhoto(p.id)}
                        className="ms-auto grid size-8 place-items-center rounded-full text-muted hover:bg-subtle hover:text-danger"
                        aria-label={P.photos.delete}
                        title={P.photos.delete}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {next ? (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => void loadPhotos(next)}>
                  {P.photos.more}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Dialog
        open={!!confirmPhoto}
        onOpenChange={(o) => !o && setConfirmPhoto(null)}
        title={P.photos.deleteTitle}
        description={P.photos.deleteBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPhoto(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 />}
              onClick={() => confirmPhoto && void deletePhoto(confirmPhoto)}
            >
              {P.photos.delete}
            </Button>
          </>
        }
      />
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="text-[12.5px] text-muted">{hint}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

/** One person of honor: their photo, role, name in each language and a few words — saved together. */
function PersonEditor({
  invitationId,
  draft,
  locales,
  roles,
  onSaved,
  onRemoved,
}: {
  invitationId: string;
  draft: Draft;
  locales: Locale[];
  roles: Role[];
  onSaved(view: HostAiView): void;
  onRemoved(view: HostAiView | null): void;
}) {
  const { t, fmt } = useUi();
  const P = t.aiPhotos.people;
  const { toast } = useToast();
  const saved = draft.person;
  const [role, setRole] = useState<Role>(draft.role);
  const [name, setName] = useState<L10n>(draft.name);
  const [description, setDescription] = useState(saved?.description ?? '');
  const [photo, setPhoto] = useState<ShrunkPhoto | null>(null);
  const [busy, setBusy] = useState<'photo' | 'save' | 'delete' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const roleOptions = roles.includes(role) ? roles : [role, ...roles];
  const dirty =
    !saved ||
    !!photo ||
    role !== saved.role ||
    (description || null) !== (saved.description || null) ||
    JSON.stringify(name) !== JSON.stringify(saved.name);
  const label = nameIn(name, locales[0]!) || P.name;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy('photo');
    try {
      const shrunk = await shrinkPhoto(f, {
        longSide: AI_PHOTOS.people.maxEdge,
        quality: AI_PHOTOS.people.quality,
        maxBytes: AI_PHOTOS.people.maxBytes,
      });
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(shrunk);
    } catch {
      toast({ title: P.notPhoto, variant: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    const res = await hostApi<{ view?: HostAiView; code?: string }>(
      `/api/invitations/${invitationId}/ai-photos/people`,
      {
        method: 'POST',
        body: {
          ...(saved ? { id: saved.id } : {}),
          role,
          name,
          description: description.trim() || null,
          ...(photo ? { photo: photo.base64 } : {}),
        },
      },
    );
    setBusy(null);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body?.view) {
      const code = res.body?.code;
      return toast({
        title:
          code === 'too_large'
            ? P.tooLarge
            : code === 'unsupported_type'
              ? P.notPhoto
              : code === 'full'
                ? fmt(P.full, { max: String(AI_PHOTOS.people.max) })
                : t.aiPhotos.failed,
        variant: 'danger',
      });
    }
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    toast({ title: P.saved, variant: 'success' });
    onSaved(res.body.view);
  };

  const remove = async () => {
    if (!saved) return onRemoved(null);
    setBusy('delete');
    const res = await hostApi<{ view?: HostAiView }>(`/api/invitations/${invitationId}/ai-photos/people`, {
      method: 'DELETE',
      body: { personId: saved.id },
    });
    setBusy(null);
    setConfirm(false);
    if (!res.ok) return toast({ title: t.aiPhotos.failed, variant: 'danger' });
    onRemoved(res.body?.view ?? null);
  };

  const shown = photo?.url ?? saved?.photo ?? null;
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] border border-line p-3"
      data-ai-person={saved?.id ?? 'new'}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-subtle"
          aria-label={shown ? P.replace : P.upload}
          title={shown ? P.replace : P.upload}
        >
          {shown ? (
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <UserRound aria-hidden className="size-8 text-muted" />
          )}
          <span className="absolute inset-x-0 bottom-0 grid h-6 place-items-center bg-black/45 text-white">
            <Camera aria-hidden className="size-3.5" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">
            <bdi>{label}</bdi>
          </p>
          <p className="text-[12px] text-muted">{shown ? '' : P.noPhoto}</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 -ms-2"
            loading={busy === 'photo'}
            onClick={() => file.current?.click()}
          >
            {busy === 'photo' ? P.preparing : shown ? P.replace : P.upload}
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold">{P.role}</span>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {P.roles[r]}
            </option>
          ))}
        </Select>
      </label>
      {locales.map((l) => (
        <label key={l} className="block">
          <span className="mb-1 block text-[12.5px] font-semibold">
            {locales.length > 1 ? fmt(P.nameIn, { language: t.editor.languageIn[l] }) : P.name}
          </span>
          <Input
            lang={l}
            dir={RTL_LOCALES.includes(l) ? 'rtl' : 'ltr'}
            value={name[l] ?? ''}
            maxLength={AI_PHOTOS.people.nameLength}
            onChange={(e) => setName({ ...name, [l]: e.target.value })}
          />
        </label>
      ))}
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold">{P.description}</span>
        <Input
          value={description}
          maxLength={AI_PHOTOS.people.descriptionLength}
          placeholder={P.descriptionPlaceholder}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          icon={<Save />}
          disabled={!dirty || !Object.values(name).some((v) => v?.trim())}
          loading={busy === 'save'}
          onClick={() => void save()}
        >
          {P.save}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 />}
          onClick={() => (saved ? setConfirm(true) : void remove())}
        >
          {P.delete}
        </Button>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={fmt(P.deleteTitle, { name: label })}
        description={P.deleteBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              loading={busy === 'delete'}
              icon={<Trash2 />}
              onClick={() => void remove()}
            >
              {P.delete}
            </Button>
          </>
        }
      />
    </div>
  );
}
