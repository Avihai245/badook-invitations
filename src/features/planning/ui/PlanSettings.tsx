'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Dialog, Field, Input, Segmented, Switch, useToast } from '@/components/app';
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
  const { t, plural, number, locale } = useUi();
  const P = t.planning;
  const S = P.settings;
  const { toast } = useToast();
  const plan = usePlan();
  const settings = plan.view.settings;
  const [busy, setBusy] = useState(false);
  // the host's own templates (Business)
  const TT = P.templates;
  const canTemplates = plan.view.features.templates;
  const [templates, setTemplates] = useState<{ id: string; name: string; tasks: number }[]>([]);
  const [name, setName] = useState('');
  useEffect(() => {
    if (!open || !canTemplates) return;
    let live = true;
    void plan.call<{ templates?: typeof templates }>('/templates', { op: 'list' }).then((r) => {
      if (live && r.ok && r.body?.templates) setTemplates(r.body.templates);
    });
    return () => {
      live = false;
    };
    // when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canTemplates]);
  if (!settings) return null;

  const saveTemplate = async () => {
    setBusy(true);
    const res = await plan.call<{ template?: { id: string; name: string; tasks: number }; code?: string }>(
      '/templates',
      {
        op: 'save',
        name: name.trim(),
        locale,
      },
    );
    setBusy(false);
    if (res.ok && res.body?.template) {
      setTemplates((l) => [res.body!.template!, ...l]);
      setName('');
      return void toast({ title: TT.saved, variant: 'success' });
    }
    const code = res.body?.code;
    toast({
      title: code === 'too_many' ? TT.tooMany : code === 'empty' ? TT.emptyPlan : P.common.failed,
      variant: 'danger',
    });
  };
  const deleteTemplate = async (id: string) => {
    const before = templates;
    setTemplates((l) => l.filter((x) => x.id !== id));
    const res = await plan.call('/templates', { op: 'delete', templateId: id });
    if (!res.ok) {
      setTemplates(before);
      return void toast({ title: P.common.failed, variant: 'danger' });
    }
    toast({ title: TT.deleted });
  };
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
        <section className="flex flex-col gap-2.5 border-t border-line pt-4">
          <h3 className="text-[14px] font-bold">{TT.title}</h3>
          {canTemplates ? (
            <>
              <p className="text-[12.5px] text-muted">{TT.body}</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) void saveTemplate();
                }}
              >
                <Field label={TT.name} className="min-w-0 flex-1">
                  <Input
                    value={name}
                    maxLength={80}
                    placeholder={TT.namePlaceholder}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Button type="submit" className="self-end" loading={busy} disabled={!name.trim()}>
                  {TT.save}
                </Button>
              </form>
              <p className="text-[13px] font-semibold">{TT.list}</p>
              {templates.length === 0 ? (
                <p className="text-[13px] text-muted">{TT.empty}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {templates.map((x) => (
                    <li
                      key={x.id}
                      className="flex items-center justify-between gap-3 rounded-btn bg-subtle px-3 py-2 text-[13.5px]"
                    >
                      <span className="min-w-0">
                        <bdi className="block truncate font-semibold">{x.name}</bdi>
                        <span className="text-[12px] text-muted">
                          {plural(TT.tasks, x.tasks, { n: number(x.tasks) })}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => void deleteTemplate(x.id)}
                      >
                        {P.common.delete}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-subtle p-3">
              <span>
                <span className="block text-[13.5px] font-semibold">{TT.locked}</span>
                <span className="block text-[12.5px] text-muted">{TT.lockedBody}</span>
              </span>
              <Button size="sm" variant="secondary" asChild>
                <Link href="/app/billing?plan=business">{TT.lockedCta}</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
