'use client';

import { Crown, Headphones } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Hint, Switch, cn, useToast } from '@/components/app';
import { packageFor } from '@/features/flags/features';
import { hostApi } from '@/features/invitations/app/api';
import { PanelCard } from '@/features/invitations/editor/fields/fields';
import { useEditor } from '@/features/invitations/editor/state/EditorProvider';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';

interface VoiceState {
  on: boolean;
  configured: boolean;
  languages: { locale: string; status: 'pending' | 'processing' | 'ready' | 'failed'; ready: boolean }[];
}

/**
 * The invitation read aloud, in the editor's sharing settings (feature `voice`): offered to guests or
 * not (the event's switch), and how each language is read — its audio ready or being prepared, or the
 * guest's own device reading it. The plan without it: which package has it.
 */
export function VoiceCard() {
  const { meta, doc, features } = useEditor();
  const { t } = useUi();
  const { toast } = useToast();
  const v = t.studio.voice;
  const [state, setState] = useState<VoiceState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await hostApi<VoiceState & { ok: boolean }>(`/api/invitations/${meta.id}/voice`);
    if (res.ok && res.body?.ok) {
      setState(res.body);
      setFailed(false);
    } else setFailed(true);
  }, [meta.id]);

  useEffect(() => {
    if (features.voice === 'on') void load();
  }, [features.voice, load, meta.version]);

  // being prepared: look again in a little while
  const preparing = state?.languages.some((l) => l.status === 'pending' || l.status === 'processing');
  useEffect(() => {
    if (!preparing) return;
    const timer = window.setTimeout(() => void load(), 8_000);
    return () => window.clearTimeout(timer);
  }, [preparing, load, state]);

  if (!features.voice) return null;
  if (features.voice === 'plan')
    return (
      <PanelCard title={v.title}>
        <p className="flex items-center gap-2 text-[13px] text-muted" data-testid="voice-upsell">
          <Crown aria-hidden className="size-4 shrink-0 text-[#b08d2e]" />
          {fmt(v.offPlan, { package: t.seating.packages[packageFor('voice')] })}
        </p>
      </PanelCard>
    );

  const toggle = async (on: boolean) => {
    setBusy(true);
    const res = await hostApi(`/api/invitations/${meta.id}/features`, {
      method: 'PATCH',
      body: { feature: 'voice', off: !on },
    });
    setBusy(false);
    if (res.ok) await load();
    else toast({ title: t.common.error, variant: 'danger' });
  };

  const stateText = (locale: string) => {
    if (meta.status !== 'published') return v.states.unpublished;
    if (!state?.configured) return v.states.device;
    const l = state.languages.find((x) => x.locale === locale);
    if (!l) return v.states.changes;
    if (l.ready) return meta.unpublishedChanges ? `${v.states.ready} · ${v.states.changes}` : v.states.ready;
    return l.status === 'failed' ? v.states.failed : v.states.pending;
  };

  return (
    <PanelCard
      title={
        <span className="flex items-center gap-1.5">
          <Headphones aria-hidden className="size-4 text-muted" />
          {v.title}
        </span>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-muted">{v.body}</p>
      {failed ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {v.failed}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Hint text={v.switchHint}>
          <Switch
            id="voice-switch"
            label={v.switch}
            checked={state?.on ?? true}
            disabled={busy || !state}
            onCheckedChange={(on) => void toggle(on)}
            data-testid="voice-switch"
          />
        </Hint>
        <label htmlFor="voice-switch" className="cursor-pointer text-[13px] font-semibold">
          {v.switch}
        </label>
      </div>
      {state?.on ? (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-muted">{v.languages}</p>
          <ul className="flex flex-col gap-1" data-testid="voice-languages">
            {doc.locales.map((l) => (
              <li key={l} className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-semibold" lang={l}>
                  {t.editor.languageFull[l]}
                </span>
                <span className={cn('text-muted')} data-locale={l}>
                  {stateText(l)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PanelCard>
  );
}
