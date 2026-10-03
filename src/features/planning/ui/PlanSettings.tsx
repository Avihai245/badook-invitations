'use client';

import { useState } from 'react';
import { Dialog, Segmented, Switch, useToast, Button } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { INTEGRATION_MODES, type IntegrationMode, type Integrations } from '../model/plan';
import { readIntegrations } from '../model/integrations';
import { usePlan } from './PlanProvider';

type Toggle = Exclude<keyof Integrations, 'mode'>;
const TOGGLES: Toggle[] = ['vendors', 'tasks', 'guests', 'seating', 'eventDay', 'overview'];

/** The plan's settings: how far it follows the invitation system, and the weekly email. */
export function PlanSettings({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useUi();
  const P = t.planning;
  const S = P.settings;
  const { toast } = useToast();
  const plan = usePlan();
  const settings = plan.view.settings;
  const [busy, setBusy] = useState(false);
  if (!settings) return null;
  const integrations = readIntegrations(settings.integrations);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    const res = await plan.call<{ view?: typeof plan.view }>('', { op: 'settings', patch });
    setBusy(false);
    if (!res.ok || !res.body?.view) return toast({ title: P.common.failed, variant: 'danger' });
    plan.setView(res.body.view);
    toast({ title: S.saved, variant: 'success' });
  };

  const modeLabel: Record<IntegrationMode, string> = {
    standalone: P.onboarding.link.standalone,
    recommended: P.onboarding.link.recommended,
    full: P.onboarding.link.full,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={S.title}
      description={S.integrations.body}
      closeLabel={P.common.close}
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {P.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[14px] font-bold">{S.integrations.mode}</h3>
          <Segmented
            label={S.integrations.mode}
            value={integrations.mode}
            disabled={busy}
            onValueChange={(mode) => void save({ integrations: { mode } })}
            options={INTEGRATION_MODES.map((m) => ({ value: m, label: modeLabel[m] }))}
            fullWidth
          />
          <ul className="mt-1 flex flex-col gap-2.5">
            {TOGGLES.map((key) => (
              <li key={key} className="flex items-start justify-between gap-3">
                <span className="text-[13.5px]">{S.integrations[key]}</span>
                <Switch
                  label={S.integrations[key]}
                  checked={integrations[key]}
                  disabled={busy}
                  onCheckedChange={(on) => void save({ integrations: { [key]: on } })}
                />
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2.5 border-t border-line pt-4">
          <h3 className="text-[14px] font-bold">{S.reminders.title}</h3>
          <div className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-[13.5px] font-semibold">{S.reminders.email}</span>
              <span className="block text-[12.5px] text-muted">{S.reminders.emailBody}</span>
            </span>
            <Switch
              label={S.reminders.email}
              checked={settings.reminders.email ?? false}
              disabled={busy}
              onCheckedChange={(on) => void save({ reminders: { email: on } })}
            />
          </div>
        </section>
      </div>
    </Dialog>
  );
}
