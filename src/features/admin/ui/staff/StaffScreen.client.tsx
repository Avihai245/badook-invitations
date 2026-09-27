'use client';

import { Check, Lock, Minus, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Hint,
  Input,
  Select,
  type BadgeVariant,
  type DataTableColumn,
} from '@/components/app';
import { PERMISSIONS, STAFF_ROLES, can as roleCan, manageableRoles, type StaffRole } from '../../permissions';
import type { StaffMember } from '../../server/db';
import { AdminPageHeader } from '../AdminShell.client';
import { useAdminUi } from '../AdminUi.client';
import { ActionDialog } from '../core/ActionDialog.client';
import { adminCall } from '../core/post';
import { TimeAgo } from '../core/TimeAgo.client';

type State = 'active' | 'pending' | 'unconfirmed' | 'partner' | 'suspended';

/** Whether a member's account can use the console now, and if not, why. */
export function memberState(m: StaffMember): State {
  if (!m.account) return 'pending';
  if (m.account.partner) return 'partner';
  if (!m.account.confirmed) return 'unconfirmed';
  if (m.account.banned) return 'suspended';
  return 'active';
}

const STATE_BADGE: Record<State, BadgeVariant> = {
  active: 'live',
  pending: 'draft',
  unconfirmed: 'warning',
  partner: 'danger',
  suspended: 'danger',
};

type Dialog =
  { kind: 'add' } | { kind: 'change'; member: StaffMember } | { kind: 'remove'; member: StaffMember };

/**
 * The staff: each member with their role and whether their account can use the console; the
 * platform's owners (INVITES_ADMIN_EMAILS) locked, "from the settings"; adding a member, changing a
 * role and removing one — only the roles the staff member's own role may manage (the database checks
 * again: its refusals come back in words) — and the table of what each role may do.
 */
export function StaffScreen({ members }: { members: StaffMember[] }) {
  const { t, fmt, plural, number, date, can, staff } = useAdminUi();
  const S = t.staff;
  const manageable = manageableRoles(staff.role);
  const allowed = can('staff.manage');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>(
    manageable.includes('support') ? 'support' : (manageable[0] ?? 'viewer'),
  );
  const [note, setNote] = useState('');
  const roleId = useId();

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && email.trim().length <= 254;
  const why = (m: StaffMember): string | null =>
    !allowed
      ? S.why.noPermission
      : m.source === 'env'
        ? S.why.env
        : m.email === staff.email
          ? S.why.self
          : !manageable.includes(m.role)
            ? S.why.rank
            : null;

  const openAdd = () => {
    setEmail('');
    setNote('');
    setRole(manageable.includes('support') ? 'support' : (manageable[0] ?? 'viewer'));
    setDialog({ kind: 'add' });
  };
  const openChange = (m: StaffMember) => {
    setRole(m.role);
    setNote(m.note ?? '');
    setDialog({ kind: 'change', member: m });
  };

  const columns: DataTableColumn<StaffMember>[] = [
    {
      key: 'member',
      header: S.columns.member,
      cell: (m) => (
        <span className="flex min-w-[180px] flex-col">
          <span
            dir="ltr"
            className="text-start font-semibold [overflow-wrap:anywhere]"
            data-testid="admin-staff-email"
          >
            {m.email}
          </span>
          {m.email === staff.email ? <span className="text-[12px] text-muted">{S.you}</span> : null}
          {m.note ? <span className="text-[12px] text-muted">{m.note}</span> : null}
        </span>
      ),
    },
    {
      key: 'role',
      header: S.columns.role,
      cell: (m) => (
        <span className="flex flex-col items-start gap-1">
          <Hint text={t.roleHelp[m.role]}>
            <span tabIndex={0} className="inline-flex rounded-full">
              <Badge variant="info">{t.roles[m.role]}</Badge>
            </span>
          </Hint>
          {m.source === 'env' ? (
            <Hint text={S.fromSettingsHelp}>
              <span
                tabIndex={0}
                className="inline-flex items-center gap-1 rounded-full text-[12px] text-muted"
              >
                <Lock aria-hidden className="size-3" />
                {S.fromSettings}
              </span>
            </Hint>
          ) : null}
        </span>
      ),
    },
    {
      key: 'state',
      header: S.columns.state,
      cell: (m) => {
        const state = memberState(m);
        return (
          <span className="flex min-w-[150px] flex-col items-start gap-1">
            <Badge variant={STATE_BADGE[state]}>{S.states[state]}</Badge>
            <span className="text-[12px] text-muted">
              {state === 'active' ? (
                m.account?.lastSignInAt ? (
                  <>
                    {fmt(S.stateHelp.active, { when: '' })}
                    <TimeAgo at={m.account.lastSignInAt} />
                  </>
                ) : (
                  S.stateHelp.activeNever
                )
              ) : (
                S.stateHelp[state]
              )}
            </span>
          </span>
        );
      },
    },
    {
      key: 'addedBy',
      header: S.columns.addedBy,
      cell: (m) =>
        m.addedBy ? (
          <span dir="ltr" className="block max-w-[180px] truncate text-start">
            {m.addedBy}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: 'since',
      header: S.columns.since,
      cell: (m) => <span className="whitespace-nowrap">{date(m.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: S.columns.actions,
      cell: (m) => {
        const off = why(m);
        return (
          <span className="flex gap-1.5">
            <Hint text={S.changeHelp} disabledText={off}>
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil />}
                disabled={off !== null}
                onClick={() => openChange(m)}
                data-testid="admin-staff-change"
              >
                {S.change}
              </Button>
            </Hint>
            <Hint text={S.removeHelp} disabledText={off}>
              <Button
                size="sm"
                variant="ghost"
                icon={<UserMinus />}
                disabled={off !== null}
                onClick={() => setDialog({ kind: 'remove', member: m })}
                data-testid="admin-staff-remove"
              >
                {S.remove}
              </Button>
            </Hint>
          </span>
        );
      },
    },
  ];

  const roleField = (
    <Field label={S.dialog.role} required id={roleId} help={t.roleHelp[role]}>
      <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} name="role">
        {manageable.map((r) => (
          <option key={r} value={r}>
            {t.roles[r]}
          </option>
        ))}
      </Select>
    </Field>
  );
  const noteField = (
    <Field label={S.dialog.note} help={S.dialog.noteHelp} counter={{ value: note.trim().length, max: 200 }}>
      <Input name="note" value={note} maxLength={220} onChange={(e) => setNote(e.target.value)} />
    </Field>
  );
  const current = dialog && dialog.kind !== 'add' ? dialog.member : null;

  return (
    <>
      <AdminPageHeader
        title={S.title}
        intro={S.intro}
        actions={
          <Hint text={S.addHelp} disabledText={allowed ? null : S.why.noPermission}>
            <Button icon={<UserPlus />} disabled={!allowed} onClick={openAdd} data-testid="admin-staff-add">
              {S.add}
            </Button>
          </Hint>
        }
      />
      <p className="mb-3 text-[13px] text-muted tabular-nums">
        {plural(S.count, members.length, { count: number(members.length) })}
      </p>
      <Card className="overflow-hidden" data-testid="admin-staff-list">
        <DataTable
          caption={S.title}
          columns={columns}
          rows={members}
          getRowKey={(m) => m.email}
          rowData={(m) => ({ 'data-email': m.email, 'data-role': m.role })}
        />
      </Card>

      <section aria-labelledby="admin-roles" className="mt-8">
        <h2 id="admin-roles" className="text-[17px] font-bold">
          {S.matrix.title}
        </h2>
        <p className="mb-3 text-[13px] text-muted">{S.matrix.intro}</p>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" data-testid="admin-permissions">
              <caption className="sr-only">{S.matrix.title}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b border-line bg-canvas px-3 py-2.5 text-start font-semibold text-muted"
                  >
                    {S.matrix.permission}
                  </th>
                  {STAFF_ROLES.map((r) => (
                    <th
                      key={r}
                      scope="col"
                      className="border-b border-line bg-canvas px-3 py-2.5 text-center font-semibold whitespace-nowrap text-muted"
                    >
                      {t.roles[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p} className="hover:bg-row-hover">
                    <th scope="row" className="border-b border-line px-3 py-2.5 text-start font-normal">
                      {S.permissions[p] ?? p}
                    </th>
                    {STAFF_ROLES.map((r) => (
                      <td key={r} className="border-b border-line px-3 py-2.5 text-center">
                        {roleCan(r, p) ? (
                          <Check
                            aria-label={S.matrix.yes}
                            className="mx-auto size-4 text-success"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <Minus aria-label={S.matrix.no} className="mx-auto size-4 text-faint" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STAFF_ROLES.map((r) => (
            <li key={r} className="rounded-card border border-line bg-surface p-3">
              <p className="text-[13.5px] font-semibold">{t.roles[r]}</p>
              <p className="text-[12.5px] text-muted">{t.roleHelp[r]}</p>
            </li>
          ))}
        </ul>
      </section>

      <ActionDialog
        open={dialog?.kind === 'add'}
        onOpenChange={(next) => !next && setDialog(null)}
        testId="admin-staff-add-dialog"
        title={S.dialog.addTitle}
        description={S.dialog.addDescription}
        valid={emailOk && manageable.includes(role)}
        summary={
          emailOk
            ? fmt(S.dialog.addSummary, {
                email: email.trim().toLowerCase(),
                role: t.roles[role],
                help: t.roleHelp[role],
              })
            : null
        }
        confirmLabel={S.dialog.addConfirm}
        confirmHelp={S.dialog.addConfirmHelp}
        errors={S.errors}
        success={fmt(S.dialog.added, { email: email.trim().toLowerCase() })}
        onConfirm={(reason) =>
          adminCall('/api/admin/staff', { email: email.trim(), role, note: note.trim() || null, reason })
        }
      >
        <Field label={S.dialog.email} required help={S.dialog.emailHelp}>
          <Input
            name="email"
            type="email"
            dir="ltr"
            autoComplete="off"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {roleField}
        {noteField}
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'change'}
        onOpenChange={(next) => !next && setDialog(null)}
        testId="admin-staff-change-dialog"
        title={current ? fmt(S.dialog.changeTitle, { email: current.email }) : ''}
        description={S.dialog.changeDescription}
        valid={manageable.includes(role)}
        summary={fmt(S.dialog.changeSummary, { role: t.roles[role], help: t.roleHelp[role] })}
        confirmLabel={S.dialog.changeConfirm}
        confirmHelp={S.dialog.changeConfirmHelp}
        errors={S.errors}
        success={current ? fmt(S.dialog.changed, { email: current.email }) : ''}
        onConfirm={(reason) =>
          adminCall('/api/admin/staff', { email: current!.email, role, note: note.trim() || null, reason })
        }
      >
        {roleField}
        {noteField}
      </ActionDialog>

      <ActionDialog
        open={dialog?.kind === 'remove'}
        onOpenChange={(next) => !next && setDialog(null)}
        testId="admin-staff-remove-dialog"
        title={current ? fmt(S.dialog.removeTitle, { email: current.email }) : ''}
        description={S.dialog.removeDescription}
        confirmLabel={S.dialog.removeConfirm}
        confirmHelp={S.dialog.removeConfirmHelp}
        confirmVariant="danger"
        errors={S.errors}
        success={current ? fmt(S.dialog.removed, { email: current.email }) : ''}
        onConfirm={(reason) => adminCall('/api/admin/staff', { email: current!.email, reason }, 'DELETE')}
      />
    </>
  );
}
