'use client';

import { Ban, Coins, Gift, Percent, RotateCcw, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, Card, Field, Hint, Input, Segmented } from '@/components/app';
import { CREDIT_CAPS, STAFF_RANK } from '../../lists';
import type { UserDetail } from '../../server/core-db';
import { useAdminUi } from '../AdminUi.client';
import { ActionDialog } from '../core/ActionDialog.client';
import { addDays, addYear } from '../core/dates';
import { adminCall } from '../core/post';

type Dialog = 'credits' | 'gift' | 'ungift' | 'discount' | 'undiscount' | 'suspend' | 'restore' | null;

/** One action's button: what it does on hover and focus, and why it can't be used when it can't. */
function ActionButton({
  label,
  help,
  why,
  icon,
  onClick,
  variant = 'secondary',
  testId,
}: {
  label: string;
  help: string;
  /** why it's off (null: it's on) */
  why: string | null;
  icon: ReactNode;
  onClick(): void;
  variant?: 'secondary' | 'danger';
  testId: string;
}) {
  return (
    <Hint text={help} disabledText={why} className="w-full">
      <Button
        fullWidth
        variant={variant}
        icon={icon}
        disabled={why !== null}
        onClick={onClick}
        data-testid={testId}
        className="justify-start"
      >
        {label}
      </Button>
    </Hint>
  );
}

/**
 * What the team may do to a customer — each for the roles with its permission (the others see the
 * button off, and why), each through a dialog that says exactly what will happen and asks for a
 * reason: credits, a plan as a gift, a discount, sign-in suspended or restored.
 */
export function UserActions({ user, self, today }: { user: UserDetail; self: boolean; today: string }) {
  const { t, fmt, number, date, can, staff } = useAdminUi();
  const u = t.users;
  const [open, setOpen] = useState<Dialog>(null);
  const name = user.name ?? u.noName;
  const onOpenChange = (next: boolean) => !next && setOpen(null);

  // credits
  const cap = CREDIT_CAPS[staff.role];
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const n = Number(amount);
  const amountOk = amount !== '' && Number.isInteger(n) && n >= 1 && n <= cap;
  const balance = user.credits.balance;
  const after = direction === 'add' ? balance + n : balance - n;
  // gift
  const [plan, setPlan] = useState<'pro' | 'business'>('pro');
  const [lastDay, setLastDay] = useState(() => addDays(today, 30));
  const maxDay = addYear(today);
  const lastDayOk = /^\d{4}-\d{2}-\d{2}$/.test(lastDay) && lastDay >= today && lastDay <= maxDay;
  // discount
  const [percent, setPercent] = useState('');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const p = Number(percent);
  const percentOk = percent !== '' && Number.isInteger(p) && p >= 1 && p <= 90;
  const untilOk = until === '' || (/^\d{4}-\d{2}-\d{2}$/.test(until) && until >= today);

  const noPermission = u.actions.noPermission;
  const suspendWhy = !can('users.suspend')
    ? noPermission
    : self
      ? u.actions.selfSuspend
      : user.staff && STAFF_RANK[user.staff.role] >= STAFF_RANK[staff.role]
        ? u.actions.staffRank
        : null;
  const url = (action: string) => `/api/admin/users/${user.id}/${action}`;
  const replacing =
    user.plan.plan !== 'free' && !user.plan.gift && !user.plan.running && user.plan.effective !== 'free';

  return (
    <Card padding="md" data-testid="admin-user-actions">
      <h2 className="mb-3 text-[15px] font-bold">{u.actions.title}</h2>
      <div className="flex flex-col gap-2">
        <ActionButton
          label={u.actions.credits}
          help={u.actions.creditsHelp}
          why={can('users.credits') ? null : noPermission}
          icon={<Coins />}
          onClick={() => setOpen('credits')}
          testId="admin-action-credits"
        />
        {user.plan.gift ? (
          <ActionButton
            label={u.giftDialog.remove}
            help={u.giftDialog.removeConfirmHelp}
            why={can('users.plan') ? null : noPermission}
            icon={<Undo2 />}
            onClick={() => setOpen('ungift')}
            testId="admin-action-ungift"
          />
        ) : null}
        <ActionButton
          label={u.actions.gift}
          help={u.actions.giftHelp}
          why={!can('users.plan') ? noPermission : user.plan.running ? u.giftDialog.subscribed : null}
          icon={<Gift />}
          onClick={() => setOpen('gift')}
          testId="admin-action-gift"
        />
        <ActionButton
          label={u.actions.discount}
          help={u.actions.discountHelp}
          why={can('users.plan') ? null : noPermission}
          icon={<Percent />}
          onClick={() => setOpen('discount')}
          testId="admin-action-discount"
        />
        {user.discount ? (
          <ActionButton
            label={u.discountDialog.remove}
            help={u.discountDialog.removeConfirmHelp}
            why={can('users.plan') ? null : noPermission}
            icon={<Undo2 />}
            onClick={() => setOpen('undiscount')}
            testId="admin-action-undiscount"
          />
        ) : null}
        {user.suspended ? (
          <ActionButton
            label={u.actions.restore}
            help={u.actions.restoreHelp}
            why={suspendWhy}
            icon={<RotateCcw />}
            onClick={() => setOpen('restore')}
            testId="admin-action-restore"
          />
        ) : (
          <ActionButton
            label={u.actions.suspend}
            help={u.actions.suspendHelp}
            why={suspendWhy}
            icon={<Ban />}
            variant="danger"
            onClick={() => setOpen('suspend')}
            testId="admin-action-suspend"
          />
        )}
      </div>

      <ActionDialog
        open={open === 'credits'}
        onOpenChange={onOpenChange}
        testId="admin-credits-dialog"
        title={fmt(u.credits.title, { name })}
        description={`${u.credits.description} ${u.credits.customerLabel}`}
        valid={amountOk && after >= 0}
        summary={
          amountOk
            ? after < 0
              ? u.errors.below_zero
              : fmt(direction === 'add' ? u.credits.summaryAdd : u.credits.summaryRemove, {
                  n: number(n),
                  after: number(after),
                  before: number(balance),
                })
            : null
        }
        confirmLabel={direction === 'add' ? u.credits.confirmAdd : u.credits.confirmRemove}
        confirmHelp={u.credits.confirmHelp}
        errors={u.errors}
        success={(body) => fmt(u.credits.done, { name, balance: number(Number(body.balance ?? 0)) })}
        onConfirm={(reason) => adminCall(url('credits'), { delta: direction === 'add' ? n : -n, reason })}
      >
        <Field label={u.credits.direction}>
          <Segmented
            value={direction}
            onValueChange={setDirection}
            options={[
              { value: 'add', label: u.credits.add },
              { value: 'remove', label: u.credits.remove },
            ]}
          />
        </Field>
        <Field label={u.credits.amount} required help={fmt(u.credits.amountHelp, { cap: number(cap) })}>
          <Input
            name="amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={cap}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-nums"
          />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={open === 'gift'}
        onOpenChange={onOpenChange}
        testId="admin-gift-dialog"
        title={fmt(u.giftDialog.title, { name })}
        description={u.giftDialog.description}
        valid={lastDayOk}
        summary={
          lastDayOk
            ? `${fmt(u.giftDialog.summary, { name, plan: u.plans[plan], date: date(lastDay) })}${
                replacing
                  ? ` ${fmt(u.giftDialog.replaces, {
                      plan: u.plans[user.plan.plan],
                      date: user.plan.renewsAt ? date(user.plan.renewsAt) : '',
                    })}`
                  : ''
              }`
            : null
        }
        confirmLabel={u.giftDialog.confirm}
        confirmHelp={u.giftDialog.confirmHelp}
        errors={u.errors}
        success={fmt(u.giftDialog.done, { name, plan: u.plans[plan] })}
        onConfirm={(reason) => adminCall(url('gift'), { plan, lastDay, reason })}
      >
        <Field label={u.giftDialog.plan}>
          <Segmented
            value={plan}
            onValueChange={setPlan}
            options={[
              { value: 'pro', label: u.plans.pro },
              { value: 'business', label: u.plans.business },
            ]}
          />
        </Field>
        <Field label={u.giftDialog.lastDay} required help={u.giftDialog.lastDayHelp}>
          <Input
            name="lastDay"
            type="date"
            min={today}
            max={maxDay}
            value={lastDay}
            onChange={(e) => setLastDay(e.target.value)}
          />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={open === 'ungift'}
        onOpenChange={onOpenChange}
        testId="admin-ungift-dialog"
        title={fmt(u.giftDialog.removeTitle, { name })}
        description={u.giftDialog.removeDescription}
        confirmLabel={u.giftDialog.remove}
        confirmHelp={u.giftDialog.removeConfirmHelp}
        confirmVariant="danger"
        errors={u.errors}
        success={fmt(u.giftDialog.removeDone, { name })}
        onConfirm={(reason) => adminCall(url('gift'), { plan: null, reason })}
      />

      <ActionDialog
        open={open === 'discount'}
        onOpenChange={onOpenChange}
        testId="admin-discount-dialog"
        title={fmt(u.discountDialog.title, { name })}
        description={u.discountDialog.description}
        valid={percentOk && untilOk}
        summary={
          percentOk && untilOk
            ? fmt(u.discountDialog.summary, {
                name,
                percent: number(p),
                until: until
                  ? fmt(u.discountDialog.summaryUntil, { date: date(until) })
                  : u.discountDialog.summaryNoEnd,
              })
            : null
        }
        confirmLabel={u.discountDialog.confirm}
        confirmHelp={u.discountDialog.confirmHelp}
        errors={u.errors}
        success={fmt(u.discountDialog.done, { name, percent: number(p) })}
        onConfirm={(reason) =>
          adminCall(url('discount'), {
            percent: p,
            lastDay: until || null,
            note: note.trim() || null,
            reason,
          })
        }
      >
        <Field label={u.discountDialog.percent} required help={u.discountDialog.percentHelp}>
          <Input
            name="percent"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            step={1}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="tabular-nums"
          />
        </Field>
        <Field label={u.discountDialog.lastDay} help={u.discountDialog.lastDayHelp}>
          <Input
            name="until"
            type="date"
            min={today}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </Field>
        <Field
          label={u.discountDialog.note}
          help={u.discountDialog.noteHelp}
          counter={{ value: note.trim().length, max: 200 }}
        >
          <Input name="note" value={note} maxLength={220} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={open === 'undiscount'}
        onOpenChange={onOpenChange}
        testId="admin-undiscount-dialog"
        title={fmt(u.discountDialog.removeTitle, { name })}
        description={u.discountDialog.removeDescription}
        confirmLabel={u.discountDialog.remove}
        confirmHelp={u.discountDialog.removeConfirmHelp}
        confirmVariant="danger"
        errors={u.errors}
        success={fmt(u.discountDialog.removeDone, { name })}
        onConfirm={(reason) => adminCall(url('discount'), { percent: null, reason })}
      />

      <ActionDialog
        open={open === 'suspend'}
        onOpenChange={onOpenChange}
        testId="admin-suspend-dialog"
        title={fmt(u.suspendDialog.title, { name })}
        description={u.suspendDialog.description}
        confirmLabel={u.suspendDialog.confirm}
        confirmHelp={u.suspendDialog.confirmHelp}
        confirmVariant="danger"
        errors={u.errors}
        success={fmt(u.suspendDialog.done, { name })}
        onConfirm={(reason) => adminCall(url('suspend'), { suspend: true, reason })}
      />

      <ActionDialog
        open={open === 'restore'}
        onOpenChange={onOpenChange}
        testId="admin-restore-dialog"
        title={fmt(u.suspendDialog.restoreTitle, { name })}
        description={u.suspendDialog.restoreDescription}
        confirmLabel={u.suspendDialog.restoreConfirm}
        confirmHelp={u.suspendDialog.restoreConfirmHelp}
        errors={u.errors}
        success={fmt(u.suspendDialog.restoreDone, { name })}
        onConfirm={(reason) => adminCall(url('suspend'), { suspend: false, reason })}
      />
    </Card>
  );
}
