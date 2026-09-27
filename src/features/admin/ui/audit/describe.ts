import type { AdminDict } from '../../i18n';
import { isStaffRole } from '../../permissions';
import type { AuditRow } from '../../server/core-db';

export interface AuditLine {
  /** the action in words ("Avichai added 50 credits to Dana") */
  text: string;
  /** a second line: the balance before and after, a note */
  detail: string | null;
  reason: string | null;
  /** where the target is in the console */
  href: string | null;
}

interface Formats {
  t: AdminDict;
  fmt(template: string, vars?: Record<string, string | number>): string;
  number(n: number): string;
  date(value: string): string;
  dir: 'rtl' | 'ltr';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Where an entry's target is in the console. */
export function auditHref(row: Pick<AuditRow, 'targetType' | 'targetId'>): string | null {
  const id = row.targetId;
  switch (row.targetType) {
    case 'user':
      return id && UUID.test(id) ? `/app/admin/users/${id}` : null;
    case 'invitation':
      return id && UUID.test(id) ? `/app/admin/invitations/${id}` : null;
    case 'ticket':
      return id ? `/app/admin/support/${encodeURIComponent(id)}` : '/app/admin/support';
    case 'staff':
      return '/app/admin/staff';
    case 'payment':
      return '/app/admin/finance';
    case 'partner':
      return '/app/admin/partners';
    case 'system':
      return '/app/admin/system';
    default:
      return null;
  }
}

/**
 * One entry of the record of actions in words: who did what to whom, and why — "אביחי הוסיף 50
 * קרדיטים ל־דנה", "סיבה: פיצוי". Actions of other areas it doesn't know are named as they are.
 */
export function describeAudit(row: AuditRow, { t, fmt, number, date, dir }: Formats): AuditLine {
  const a = t.audit;
  const L = a.lines;
  const d = row.details ?? {};
  const actor = row.actorName ?? row.actorEmail;
  const target =
    row.targetName ??
    (row.targetType === 'user'
      ? a.noName
      : row.targetType === 'invitation'
        ? a.untitled
        : (row.targetId ?? ''));
  const role = (r: unknown) => (isStaffRole(r) ? t.roles[r] : String(r ?? ''));
  const planName = (p: unknown) => (p === 'business' ? 'Business' : p === 'pro' ? 'Pro' : String(p ?? ''));
  const arrow = dir === 'rtl' ? '←' : '→';
  let text: string;
  let detail: string | null = null;
  switch (row.action) {
    case 'users.credits': {
      const delta = Number(d.delta ?? 0);
      text = fmt(delta >= 0 ? L.creditsAdd : L.creditsRemove, {
        actor,
        n: number(Math.abs(delta)),
        target,
      });
      if (typeof d.before === 'number' && typeof d.after === 'number')
        detail = fmt(L.creditsBalance, { before: number(d.before), after: number(d.after) }).replace(
          /[←→]/,
          arrow,
        );
      break;
    }
    case 'users.plan_gift':
      text = d.plan
        ? fmt(L.giftOn, {
            actor,
            target,
            plan: planName(d.plan),
            date: str(d.lastDay) ? date(String(d.lastDay)) : '',
          })
        : fmt(L.giftOff, { actor, target });
      break;
    case 'users.discount':
      text = d.percent
        ? fmt(L.discountOn, {
            actor,
            target,
            percent: number(Number(d.percent)),
            until: str(d.lastDay) ? fmt(L.discountUntil, { date: date(String(d.lastDay)) }) : L.discountNoEnd,
          })
        : fmt(L.discountOff, { actor, target });
      if (str(d.note)) detail = fmt(a.note, { note: String(d.note) });
      break;
    case 'users.suspend':
      text = fmt(L.suspend, { actor, target });
      break;
    case 'users.restore':
      text = fmt(L.restore, { actor, target });
      break;
    case 'invitations.feature': {
      const feature = t.invitations.features.names[String(d.feature)] ?? String(d.feature ?? '');
      text = fmt(d.grant === false ? L.featureOff : L.featureOn, { actor, feature, target });
      break;
    }
    case 'staff.set':
      text = d.before
        ? fmt(L.staffChange, { actor, target, before: role(d.before), role: role(d.role) }).replace(
            /[←→]/,
            arrow,
          )
        : fmt(L.staffAdd, { actor, target, role: role(d.role) });
      if (str(d.note)) detail = fmt(a.note, { note: String(d.note) });
      break;
    case 'staff.remove':
      text = fmt(L.staffRemove, { actor, target, role: role(d.role) });
      break;
    case 'system.channel_rotate':
      text = fmt(L.channel, { actor });
      break;
    default: {
      const name = a.actions[row.action] ?? row.action;
      text = fmt(L.other, { actor, action: target ? `${name} · ${target}` : name });
    }
  }
  return { text, detail, reason: str(d.reason), href: auditHref(row) };
}
