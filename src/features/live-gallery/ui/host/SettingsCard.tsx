'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, CardTitle, Hint, Input, Segmented, Switch } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { GALLERY } from '../../config';
import type { HostGalleryView } from '../../server/host-api';

export type SettingsPatch = Partial<{
  enabled: boolean;
  mode: 'instant' | 'approval';
  paused: boolean;
  opensAt: string | null;
  closesAt: string | null;
  accessCode: string | null;
}>;

/** "2027-06-17T20:30" in the browser's time zone (a datetime-local input's value). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null);

/**
 * The gallery's settings: on/off, what happens to a new photo (instant or after approval), pause,
 * an access code (set / replace / remove — never shown back), the upload window, and the automatic
 * check (a feature switch of the event, when the plan has it).
 */
export function SettingsCard({
  view,
  onPatch,
  onAi,
}: {
  view: HostGalleryView;
  onPatch(patch: SettingsPatch, done?: string): Promise<boolean>;
  onAi(on: boolean): Promise<void>;
}) {
  const { t, fmt } = useUi();
  const s = t.liveGallery.settings;
  const h = t.liveGallery.hints;
  const g = view.gallery!;
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [opens, setOpens] = useState(toLocalInput(g.opensAt));
  const [closes, setCloses] = useState(toLocalInput(g.closesAt));
  const [windowError, setWindowError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setOpens(toLocalInput(g.opensAt));
    setCloses(toLocalInput(g.closesAt));
  }, [g.opensAt, g.closesAt]);

  const run = async (key: string, patch: SettingsPatch, done?: string) => {
    setBusy(key);
    const ok = await onPatch(patch, done);
    setBusy(null);
    return ok;
  };
  const saveCode = async () => {
    const clean = code.normalize('NFKC').replace(/[\s\-_.]+/g, '');
    const { min, max } = GALLERY.limits.codeLength;
    if (clean.length < min || clean.length > max) return setCodeError(s.codeInvalid);
    setCodeError(null);
    if (await run('code', { accessCode: code }, s.codeSaved)) setCode('');
  };
  const saveWindow = async () => {
    const a = fromLocalInput(opens);
    const b = fromLocalInput(closes);
    if (a && b && Date.parse(b) <= Date.parse(a)) return setWindowError(s.windowInvalid);
    setWindowError(null);
    await run('window', { opensAt: a, closesAt: b }, s.saved);
  };
  const ai = view.features.gallery_ai;
  const planName = (plan: 'free' | 'pro' | 'business') => t.liveGallery.plans[plan];

  return (
    <Card padding="lg" className="flex flex-col gap-5" data-testid="gallery-settings">
      <CardTitle as="h2" className="mb-0">
        {s.title}
      </CardTitle>

      <Row label={s.enabled} help={s.enabledHelp}>
        <Hint text={h.enabled}>
          <Switch
            label={s.enabled}
            checked={g.enabled}
            disabled={busy === 'enabled'}
            onCheckedChange={(on) => void run('enabled', { enabled: on }, s.saved)}
          />
        </Hint>
      </Row>

      <div>
        <p id="gallery-mode-label" className="mb-1.5 text-[13px] font-semibold">
          {s.mode}
        </p>
        <Hint text={h.mode}>
          <Segmented
            label={s.mode}
            value={g.mode}
            fullWidth
            onValueChange={(mode) => void run('mode', { mode }, s.saved)}
            options={[
              { value: 'instant', label: s.instant },
              { value: 'approval', label: s.approval },
            ]}
          />
        </Hint>
        <p className="mt-1.5 text-[12px] text-muted">
          {g.mode === 'approval' ? s.approvalHelp : s.instantHelp}
        </p>
      </div>

      <Row label={s.paused} help={s.pausedHelp}>
        <Hint text={h.pause}>
          <Switch
            label={s.paused}
            checked={g.paused}
            disabled={busy === 'paused'}
            onCheckedChange={(on) => void run('paused', { paused: on }, s.saved)}
          />
        </Hint>
      </Row>

      <div>
        <p className="text-[13px] font-semibold">{s.code}</p>
        <p className="mt-0.5 text-[12.5px] text-muted" data-testid="gallery-code-state">
          {g.hasCode ? s.codeSet : s.codeNone}
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={s.codePlaceholder}
            maxLength={64}
            autoComplete="off"
            aria-label={s.code}
            invalid={!!codeError}
            dir="ltr"
          />
          <Hint text={h.code}>
            <Button
              variant="secondary"
              loading={busy === 'code'}
              onClick={() => void saveCode()}
              disabled={!code.trim()}
            >
              {s.codeSave}
            </Button>
          </Hint>
        </div>
        {codeError ? (
          <p role="alert" className="mt-1 text-[12px] text-danger">
            {codeError}
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-muted">{s.codeHelp}</p>
        )}
        {g.hasCode ? (
          <Hint text={h.codeRemove}>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 -ms-2"
              loading={busy === 'codeRemove'}
              onClick={() => void run('codeRemove', { accessCode: null }, s.codeRemoved)}
            >
              {s.codeRemove}
            </Button>
          </Hint>
        ) : null}
      </div>

      <div>
        <p className="text-[13px] font-semibold">{s.window}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-[12.5px] text-muted">
            {s.opensAt}
            <Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} dir="ltr" />
          </label>
          <label className="grid gap-1 text-[12.5px] text-muted">
            {s.closesAt}
            <Input
              type="datetime-local"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
              dir="ltr"
              invalid={!!windowError}
            />
          </label>
        </div>
        {windowError ? (
          <p role="alert" className="mt-1 text-[12px] text-danger">
            {windowError}
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-muted">{s.windowHelp}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Hint text={h.window}>
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'window'}
              onClick={() => void saveWindow()}
            >
              {s.windowSave}
            </Button>
          </Hint>
          {g.opensAt || g.closesAt ? (
            <Hint text={h.windowClear}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpens('');
                  setCloses('');
                  void run('window', { opensAt: null, closesAt: null }, s.saved);
                }}
              >
                {s.windowClear}
              </Button>
            </Hint>
          ) : null}
        </div>
      </div>

      {ai.why !== 'unavailable' ? (
        <Row label={s.ai} help={ai.why === 'plan' ? fmt(s.aiPlan, { plan: planName(ai.plan) }) : s.aiHelp}>
          <Hint text={h.ai} disabledText={fmt(s.aiPlan, { plan: planName(ai.plan) })}>
            <Switch
              label={s.ai}
              checked={ai.on}
              disabled={ai.why === 'plan' || busy === 'ai'}
              onCheckedChange={async (on) => {
                setBusy('ai');
                await onAi(on);
                setBusy(null);
              }}
            />
          </Hint>
        </Row>
      ) : null}
    </Card>
  );
}

function Row({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[12.5px] text-muted">{help}</p>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}
