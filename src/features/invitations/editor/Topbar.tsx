'use client';

import {
  ArrowLeft,
  Check,
  CircleAlert,
  CloudOff,
  Eye,
  History,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Redo2,
  Send,
  Smartphone,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, IconButton, Menu, Segmented, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { Locale } from '../contracts/types';
import type { Device } from './Canvas';
import { hostsText } from './fields/fields';
import type { SaveStatus } from './state/useAutosave';
import { useEditor } from './state/EditorProvider';

/** The editor's top bar (§9B.3-D, app.html `.topbar`): 56px. */
export function Topbar({
  status,
  device,
  onDevice,
  onPublish,
  onVersions,
  onPreview,
}: {
  status: SaveStatus;
  device: Device;
  onDevice: (d: Device) => void;
  onPublish: () => void;
  onVersions: () => void;
  onPreview: () => void;
}) {
  const { doc, meta, locale, setLocale, undo, redo, canUndo, canRedo } = useEditor();
  const { t, locale: ui } = useUi();
  const e = t.editor;
  const names =
    hostsText(doc, doc.locales.includes(ui) ? ui : doc.defaultLocale) || t.eventTypes[doc.eventType];
  const published = meta.status === 'published';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <Link
        href="/app/invitations"
        aria-label={e.back}
        title={e.back}
        className="grid size-9 shrink-0 place-items-center rounded-btn text-muted hover:bg-subtle hover:text-ink"
      >
        <ArrowLeft aria-hidden size={18} strokeWidth={1.75} className="icon-dir" />
      </Link>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold">
          <h1 className="truncate">
            <bdi>{names}</bdi>
            <span className="max-sm:hidden">
              {e.titleSeparator}
              {t.eventTypes[doc.eventType]}
            </span>
          </h1>
          <Badge variant={published ? 'live' : 'draft'}>
            {published ? t.status.published : t.status.draft}
          </Badge>
          {published && meta.unpublishedChanges ? (
            <Badge variant="warning" className="max-md:hidden">
              {e.unpublishedChanges}
            </Badge>
          ) : null}
        </div>
        <SaveLine status={status} />
      </div>

      <div className="mx-auto hidden items-center gap-2 lg:flex">
        <Segmented<Device>
          label={e.device}
          value={device}
          onValueChange={onDevice}
          options={[
            { value: 'mobile', label: e.mobile, icon: <Smartphone /> },
            { value: 'desktop', label: e.desktop, icon: <Monitor /> },
          ]}
        />
        {doc.locales.length > 1 ? (
          <Segmented<Locale>
            label={e.previewLanguage}
            value={locale}
            onValueChange={setLocale}
            options={doc.locales.map((l) => ({
              value: l,
              label: e.languageShort[l],
              ariaLabel: e.languageFull[l],
            }))}
          />
        ) : null}
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-1.5 lg:ms-0 lg:gap-2">
        <IconButton
          label={e.undo}
          tooltip
          onClick={undo}
          disabled={!canUndo}
          aria-keyshortcuts="Control+Z Meta+Z"
        >
          <Undo2 className="icon-dir" />
        </IconButton>
        <IconButton
          label={e.redo}
          tooltip
          onClick={redo}
          disabled={!canRedo}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        >
          <Redo2 className="icon-dir" />
        </IconButton>
        <div className="hidden items-center gap-2 md:flex">
          <IconButton label={e.versions} tooltip onClick={onVersions}>
            <History />
          </IconButton>
          <Button variant="secondary" size="sm" icon={<Eye />} onClick={onPreview}>
            {e.preview}
          </Button>
        </div>
        <div className="md:hidden">
          <Menu
            trigger={
              <IconButton label={e.moreActions}>
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: e.preview, icon: <Eye />, onSelect: onPreview },
              { label: e.versions, icon: <History />, onSelect: onVersions },
            ]}
          />
        </div>
        <Button size="sm" icon={<Send className="icon-dir" />} onClick={onPublish}>
          {published ? e.publishChanges : e.publish}
        </Button>
      </div>
    </header>
  );
}

function SaveLine({ status }: { status: SaveStatus }) {
  const { t } = useUi();
  const s = t.editor.save;
  const busy = status === 'saving' || status === 'dirty';
  const bad = status === 'failed' || status === 'invalid' || status === 'conflict';
  const text =
    status === 'saved'
      ? s.saved
      : busy
        ? s.saving
        : status === 'offline'
          ? s.offline
          : status === 'invalid'
            ? s.invalid
            : s.failed;
  const Icon =
    status === 'saved' ? Check : busy ? LoaderCircle : status === 'offline' ? CloudOff : CircleAlert;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-w-0 items-center gap-1 text-[12px]', bad ? 'text-danger' : 'text-muted')}
    >
      <Icon
        aria-hidden
        size={12}
        strokeWidth={1.75}
        className={cn('shrink-0', busy && 'motion-safe:animate-spin')}
      />
      <span className="truncate">{text}</span>
    </div>
  );
}
