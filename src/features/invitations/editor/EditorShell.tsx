'use client';

import { CloudOff, Eye, Palette, PenLine, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog as RadixDialog } from 'radix-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, IconButton, cn, useDir, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { InvitationDocument } from '../contracts/types';
import { loginUrl } from '../app/api';
import { Canvas, type Device } from './Canvas';
import { OPEN_PUBLISH_EVENT } from './events';
import { PreviewControlsProvider } from './fields/fields';
import { FormPanel } from './FormPanel';
import { usePreviewChannel } from './preview/usePreviewChannel';
import { PublishDialog } from './PublishDialog';
import { Rail } from './Rail';
import { useEditor } from './state/EditorProvider';
import { useAutosave } from './state/useAutosave';
import { Topbar } from './Topbar';
import { VersionsDrawer } from './VersionsDrawer';

type MobileView = 'edit' | 'preview';

/**
 * The editor (§7.3, §9B.3-D): desktop 280 | 400 | canvas (the rail collapses to 64px icons between
 * 1024 and 1279px); below 1024 a full-width form with a bottom tab bar and the section list in a
 * bottom sheet.
 */
export function EditorShell({
  initialDoc,
  initialUpdatedAt,
}: {
  initialDoc: InvitationDocument;
  initialUpdatedAt: string;
}) {
  const editor = useEditor();
  const { doc, locale, meta, setMeta, select, undo, redo, replace, apply, setRailTab } = editor;
  const { t } = useUi();
  const e = t.editor;
  const router = useRouter();
  const { toast, dismiss } = useToast();

  const autosave = useAutosave({
    id: meta.id,
    doc,
    initialDoc,
    initialUpdatedAt,
    onSaved: () => {
      if (meta.status === 'published' && !meta.unpublishedChanges) setMeta({ unpublishedChanges: true });
    },
    onUnauthorized: () => router.push(loginUrl()),
  });

  const frame = useRef<HTMLIFrameElement>(null);
  const channel = usePreviewChannel(frame, {
    doc,
    locale,
    cinematic: editor.features.cinematic ?? true,
    onSelect: (path) => {
      const m = /^sections\.(\d+)/.exec(path);
      const section = m ? doc.sections[Number(m[1])] : undefined;
      if (section) {
        fromFrame.current = true;
        select({ kind: 'section', id: section.id }, path);
      }
      setMobileView('edit');
    },
  });
  const controls = useMemo(
    () => ({ highlight: channel.highlight, replay: channel.replay }),
    [channel.highlight, channel.replay],
  );

  // Selecting a section scrolls the preview to it (not when the frame itself asked for it: it's in view).
  const fromFrame = useRef(false);
  const selectedIndex =
    editor.selection.kind === 'section'
      ? doc.sections.findIndex((s) => s.id === (editor.selection as { id: string }).id)
      : -1;
  useEffect(() => {
    if (fromFrame.current) {
      fromFrame.current = false;
      return;
    }
    if (selectedIndex >= 0) channel.reveal(`sections.${selectedIndex}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on selection changes only
  }, [editor.selection]);

  const [device, setDevice] = useState<Device>('mobile');
  const [mobileView, setMobileView] = useState<MobileView>('edit');
  const [sheet, setSheet] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState(false);

  // e.g. the share panel's "publish" button
  useEffect(() => {
    const open = () => setPublishing(true);
    window.addEventListener(OPEN_PUBLISH_EVENT, open);
    return () => window.removeEventListener(OPEN_PUBLISH_EVENT, open);
  }, []);

  // `?publish=1` (the list's and the workspace's "publish" buttons): open with the publish window, once
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('publish') !== '1') return;
    setPublishing(true);
    url.searchParams.delete('publish');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Undo/redo from the keyboard (the document history, also inside text fields).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) {
        ev.preventDefault();
        undo();
      } else if ((k === 'z' && ev.shiftKey) || k === 'y') {
        ev.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // A failed save stays on screen with "retry" until the next save goes through (§9B.3-H).
  useEffect(() => {
    if (autosave.status === 'failed' || autosave.status === 'invalid')
      toast({
        id: 'autosave',
        title: autosave.status === 'invalid' ? e.save.invalid : e.save.failed,
        variant: 'danger',
        duration: Infinity,
        action: { label: t.common.retry, altText: t.common.retry, onClick: () => void autosave.flush() },
      });
    else if (autosave.status === 'saved') dismiss('autosave');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to status changes only
  }, [autosave.status]);

  /** Opens the saved draft full-page; waits for pending changes to reach the server first. */
  const openPreview = () => {
    const url = `/app/preview-frame/${editor.template.id}?${new URLSearchParams({ invitation: meta.id, lang: locale })}`;
    const win = window.open('about:blank', '_blank');
    void autosave.flush().then(() => {
      if (win) win.location.href = url;
      else window.open(url, '_blank');
    });
  };

  const conflict = autosave.conflict;

  return (
    <PreviewControlsProvider value={controls}>
      <div className="flex h-dvh flex-col bg-canvas">
        <Topbar
          status={autosave.status}
          device={device}
          onDevice={setDevice}
          onPublish={() => setPublishing(true)}
          onVersions={() => setVersions(true)}
          onPreview={openPreview}
        />
        {autosave.status === 'offline' ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-warning-bg px-4 py-2 text-[13px] text-warning"
          >
            <CloudOff aria-hidden size={16} strokeWidth={1.75} />
            {e.save.offline}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 max-lg:pb-14 lg:grid-cols-[64px_360px_minmax(0,1fr)] xl:grid-cols-[280px_400px_minmax(0,1fr)]">
          <div className="hidden min-h-0 border-e border-line lg:flex lg:flex-col [&_aside]:flex-1">
            <Rail />
          </div>
          <FormPanel
            className={cn(
              'min-h-0 overflow-auto border-line bg-canvas p-5 lg:border-e',
              mobileView !== 'edit' && 'max-lg:hidden',
            )}
          />
          <Canvas
            device={device}
            frame={frame}
            onReplay={channel.replay}
            onOpenTab={openPreview}
            className={cn('min-h-0', mobileView !== 'preview' && 'max-lg:hidden')}
          />
        </div>

        <MobileTabs
          view={mobileView}
          onEdit={() => {
            setMobileView('edit');
            setRailTab('sections');
            setSheet(true);
          }}
          onPreview={() => setMobileView('preview')}
          onDesign={() => {
            setRailTab('design');
            setSheet(true);
          }}
          onPublish={() => setPublishing(true)}
        />
        <SectionsSheet
          open={sheet}
          onOpenChange={setSheet}
          onNavigate={() => {
            setSheet(false);
            setMobileView('edit');
          }}
        />

        {publishing ? <PublishDialog onClose={() => setPublishing(false)} flush={autosave.flush} /> : null}
        {versions ? (
          <VersionsDrawer
            onClose={() => setVersions(false)}
            onRestored={(draft, updatedAt) => {
              autosave.rebase(draft, updatedAt);
              apply(() => draft, null);
            }}
          />
        ) : null}
        {conflict ? (
          <Dialog
            open
            title={e.conflict.title}
            description={e.conflict.body}
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    autosave.acceptTheirs(conflict);
                    replace(conflict.draft);
                  }}
                >
                  {e.conflict.theirs}
                </Button>
                <Button onClick={() => autosave.keepMine(conflict)}>{e.conflict.mine}</Button>
              </>
            }
          />
        ) : null}
      </div>
    </PreviewControlsProvider>
  );
}

/** Below 1024px: [עריכה | תצוגה | עיצוב | פרסום] (§9B.3-D). */
function MobileTabs({
  view,
  onEdit,
  onPreview,
  onDesign,
  onPublish,
}: {
  view: MobileView;
  onEdit: () => void;
  onPreview: () => void;
  onDesign: () => void;
  onPublish: () => void;
}) {
  const { t } = useUi();
  const m = t.editor.mobileTabs;
  const item = (label: string, Icon: typeof Eye, onClick: () => void, current = false) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={current || undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
        current ? 'text-ink' : 'text-muted',
      )}
    >
      <Icon aria-hidden size={20} strokeWidth={1.75} className={Icon === Send ? 'icon-dir' : undefined} />
      {label}
    </button>
  );
  return (
    <nav
      aria-label={m.label}
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {item(m.edit, PenLine, onEdit, view === 'edit')}
      {item(m.preview, Eye, onPreview, view === 'preview')}
      {item(m.design, Palette, onDesign)}
      {item(m.publish, Send, onPublish)}
    </nav>
  );
}

/** The rail as a bottom sheet on small screens. */
function SectionsSheet({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const { t } = useUi();
  const dir = useDir();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[rgba(28,25,23,0.4)] motion-safe:data-[state=open]:animate-app-fade-in lg:hidden" />
        <RadixDialog.Content
          dir={dir}
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[80dvh] flex-col rounded-t-dialog bg-surface shadow-lg outline-none lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <RadixDialog.Title className="text-[15px] font-bold">{t.editor.sectionsSheet}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label={t.common.close}>
                <X />
              </IconButton>
            </RadixDialog.Close>
          </div>
          <RadixDialog.Description className="sr-only">{t.editor.rail.label}</RadixDialog.Description>
          <div className="flex min-h-0 flex-1 flex-col [&_aside]:min-h-0 [&_aside]:flex-1">
            <Rail onNavigate={onNavigate} />
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
