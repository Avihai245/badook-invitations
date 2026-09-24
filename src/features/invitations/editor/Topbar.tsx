'use client';

import {
  ArrowLeft,
  Check,
  CircleAlert,
  CloudOff,
  Crown,
  ExternalLink,
  Eye,
  History,
  LoaderCircle,
  MessageCircleQuestion,
  Monitor,
  MoreHorizontal,
  Redo2,
  Send,
  Smartphone,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { Popover } from 'radix-ui';
import { Badge, Button, IconButton, Menu, Segmented, cn, useDir } from '@/components/app';
import { HelpFor } from '@/features/invitations/app/HelpFor';
import { openSupport } from '@/features/support/open';
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
          <PremiumNotice />
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
        <HelpFor area="editor" />
        <IconButton
          label={e.undo}
          tooltip
          disabledTooltip={e.undoNone}
          onClick={undo}
          disabled={!canUndo}
          aria-keyshortcuts="Control+Z Meta+Z"
        >
          <Undo2 className="icon-dir" />
        </IconButton>
        {/* phones: in the ⋯ menu, to leave room for the "?" */}
        <IconButton
          label={e.redo}
          tooltip
          disabledTooltip={e.redoNone}
          onClick={redo}
          disabled={!canRedo}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          className="max-sm:hidden"
        >
          <Redo2 className="icon-dir" />
        </IconButton>
        <div className="hidden items-center gap-2 md:flex">
          <IconButton
            label={t.support.open}
            tooltip
            onClick={() => openSupport()}
            data-testid="support-button"
          >
            <MessageCircleQuestion />
          </IconButton>
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
              { label: e.redo, icon: <Redo2 className="icon-dir" />, onSelect: redo, disabled: !canRedo },
              { label: e.versions, icon: <History />, onSelect: onVersions },
              { label: t.support.open, icon: <MessageCircleQuestion />, onSelect: () => openSupport() },
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

/** A premium design (manifest tier) — publishing it needs a paid plan (the 402 of the publish route). */
export const premiumLocked = (template: { tier?: unknown }, features: { premiumTemplates: boolean }) =>
  template.tier === 'premium' && !features.premiumTemplates;

/**
 * A premium design on a plan without premium designs: a small "Premium" tag in the bar that says, as
 * early as the editor opens, that publishing it needs Pro or Business — editing goes on as usual.
 */
function PremiumNotice() {
  const { template, features } = useEditor();
  const { t } = useUi();
  const p = t.editor.premium;
  const dir = useDir();
  if (!premiumLocked(template, features)) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={p.label}
          title={p.body}
          data-testid="premium-notice"
          className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full bg-[#2b2118] px-2 text-[11.5px] font-semibold text-[#f3d98b] transition-colors hover:bg-black"
        >
          <Crown aria-hidden className="size-3" />
          <span className="max-sm:sr-only">{p.badge}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir={dir}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[70] w-[min(300px,calc(100vw-24px))] rounded-[14px] border border-brand-line bg-surface p-4 shadow-lg outline-none data-[state=open]:animate-app-dialog-in motion-reduce:animate-none"
        >
          <p className="flex items-center gap-2 text-[14px] font-bold">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-full bg-[#2b2118] text-[#f3d98b]"
            >
              <Crown className="size-3.5" />
            </span>
            {p.title}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{p.body}</p>
          <Button size="sm" className="mt-3" icon={<ExternalLink className="icon-dir" />} asChild>
            {/* a new tab: the editor stays open as it is */}
            <a href="/app/billing" target="_blank" rel="noreferrer">
              {p.cta}
              <span className="sr-only"> {p.newTab}</span>
            </a>
          </Button>
          <Popover.Arrow className="fill-surface" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
