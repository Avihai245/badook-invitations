'use client';

import { ExternalLink, Lightbulb, Store, CircleDollarSign } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Drawer, Field, Input, Segmented, Select, Textarea, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_KEYS, isCategoryKey, TASK_STATUSES, type TaskStatus } from '../../model/categories';
import { googleTaskUrl } from '../../model/calendar';
import type { TaskView } from '../../model/plan';
import { usePlan } from '../PlanProvider';
import type { TaskChange } from './useTaskActions';

/**
 * A task's details: its name and notes, the date it is due (one the host sets stays put when the event
 * moves), who is on it, its category and importance, its state, and what it is linked to (a vendor, a
 * budget item, an idea). A system task keeps its name — the dictionary's — and only takes a date, a
 * note, an owner and hiding.
 */
export function TaskDrawer({
  task,
  title,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  task: TaskView | null;
  /** the task's shown name (own, template's or system's) */
  title: string;
  open: boolean;
  onClose: () => void;
  onSave: (task: TaskView, change: TaskChange) => Promise<boolean> | boolean;
  onDelete: (task: TaskView) => void;
}) {
  const { t } = useUi();
  const D = t.planning.tasks.drawer;
  const plan = usePlan();
  const { view } = plan;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('');
  const [who, setWho] = useState<'none' | 'me' | 'other'>('none');
  const [other, setOther] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'0' | '1'>('0');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    setName(task.title ?? title);
    setNotes(task.notes ?? '');
    setDue(task.dueDate ?? '');
    setWho(task.assignee === null ? 'none' : task.assignee === 'me' ? 'me' : 'other');
    setOther(task.assignee && task.assignee !== 'me' ? task.assignee : '');
    setCategory(task.category ?? '');
    setPriority(task.priority === 1 ? '1' : '0');
    setStatus(task.status);
    // reset only when another task is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;
  const system = task.systemKey !== null;
  const vendor = task.vendorId ? view.vendors.find((v) => v.id === task.vendorId) : null;
  const item = task.budgetItemId ? view.items.find((i) => i.id === task.budgetItemId) : null;
  const ideas = view.ideas.filter((i) => i.linkedTaskId === task.id);
  const base = `/app/invitations/${plan.id}/plan`;

  const save = async () => {
    const change: TaskChange = {};
    if (!system && name.trim() && name.trim() !== (task.title ?? title)) change.title = name.trim();
    if ((task.notes ?? '') !== notes) change.notes = notes;
    if ((task.dueDate ?? '') !== due) change.dueDate = due || null;
    const assignee = who === 'none' ? null : who === 'me' ? 'me' : other.trim() || null;
    if (assignee !== task.assignee) change.assignee = assignee;
    if (!system && category !== (task.category ?? ''))
      change.category = isCategoryKey(category) ? category : null;
    if (!system && Number(priority) !== task.priority) change.priority = Number(priority) as 0 | 1;
    if (status !== task.status && task.derived !== true) change.status = status;
    if (Object.keys(change).length === 0) return onClose();
    setBusy(true);
    const done = await onSave(task, change);
    setBusy(false);
    if (done) onClose();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={D.title}
      closeLabel={D.closeLabel}
      footer={
        <>
          {!system ? (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              onClick={() => {
                onDelete(task);
                onClose();
              }}
            >
              {D.delete}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            {t.planning.common.cancel}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t.planning.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {system ? (
          <p className="rounded-card bg-info-bg p-3 text-[13px] text-info">{D.system}</p>
        ) : (
          <Field label={D.name} required>
            <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        {system ? <p className="text-[15px] font-bold">{title}</p> : null}

        <Field label={D.dueDate} help={D.dueHint}>
          <div className="flex gap-2">
            <Input
              type="date"
              dir="ltr"
              textAlign="start"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            {due ? (
              <Button variant="ghost" onClick={() => setDue('')}>
                {D.clearDate}
              </Button>
            ) : null}
          </div>
        </Field>

        <Field label={D.assignee}>
          <Select value={who} onChange={(e) => setWho(e.target.value as 'none' | 'me' | 'other')}>
            <option value="none">—</option>
            <option value="me">{t.planning.tasks.me}</option>
            <option value="other">{D.assigneeOther}</option>
          </Select>
        </Field>
        {who === 'other' ? (
          <Field label={D.assigneeName}>
            <Input value={other} maxLength={60} onChange={(e) => setOther(e.target.value)} />
          </Field>
        ) : null}

        {!system ? (
          <>
            <Field label={D.category}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{D.categoryNone}</option>
                {CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {t.planning.categories[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={D.priority}>
              <Segmented
                value={priority}
                onValueChange={setPriority}
                options={[
                  { value: '0', label: D.normal },
                  { value: '1', label: D.important },
                ]}
              />
            </Field>
          </>
        ) : null}

        {task.derived !== true ? (
          <Field label={D.status}>
            <Segmented
              value={status}
              onValueChange={setStatus}
              options={TASK_STATUSES.map((s) => ({ value: s, label: D.statuses[s] }))}
            />
          </Field>
        ) : null}

        <Field label={D.notes}>
          <Textarea
            value={notes}
            maxLength={2000}
            placeholder={D.notesPlaceholder}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <section aria-label={D.links} className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-[13.5px] font-bold">{D.links}</h3>
          {vendor || item || ideas.length ? (
            <ul className="flex flex-col gap-1.5">
              {vendor ? (
                <LinkRow icon={<Store />} label={D.linkVendor} name={vendor.name} href={`${base}/vendors`} />
              ) : null}
              {item ? (
                <LinkRow
                  icon={<CircleDollarSign />}
                  label={D.linkItem}
                  name={item.title}
                  href={`${base}/budget`}
                />
              ) : null}
              {ideas.map((idea) => (
                <LinkRow
                  key={idea.id}
                  icon={<Lightbulb />}
                  label={D.linkIdea}
                  name={idea.title ?? idea.body ?? idea.url ?? ''}
                  href={`${base}/ideas`}
                />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">{D.noLinks}</p>
          )}
        </section>

        {task.dueDate ? (
          <a
            href={googleTaskUrl({ title: name || title, notes: notes || null, dueDate: task.dueDate })}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              'inline-flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-brand-deep hover:underline',
            )}
          >
            <ExternalLink aria-hidden className="icon-dir size-4" />
            {t.planning.tasks.calendar.google}
          </a>
        ) : null}
      </div>
    </Drawer>
  );
}

function LinkRow({
  icon,
  label,
  name,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-2.5 rounded-btn bg-subtle px-3 text-[13.5px] hover:bg-brand-soft"
      >
        <span aria-hidden className="text-muted [&_svg]:size-4">
          {icon}
        </span>
        <span className="text-muted">{label}</span>
        <bdi className="min-w-0 flex-1 truncate font-semibold">{name}</bdi>
      </Link>
    </li>
  );
}
