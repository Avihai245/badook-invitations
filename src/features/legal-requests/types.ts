import type {
  ReportCategory,
  ReportResolution,
  ReportRole,
  ReportStatus,
  RequestKind,
  RequestRelation,
  RequestStatus,
} from './config';

/** What the console's functions return (media_report_json / privacy_request_json + the events). */

export interface LegalEvent {
  actor: 'reporter' | 'requester' | 'system' | 'staff' | 'host';
  action: string;
  detail: Record<string, unknown>;
  at: string;
}

export interface AdminReport {
  id: string;
  number: number;
  surface: 'gallery' | 'album' | 'link' | 'invitation' | 'ai_photo';
  category: ReportCategory;
  intimate: boolean;
  role: ReportRole;
  urgent: boolean;
  status: ReportStatus;
  resolution: ReportResolution | null;
  resolutionNote: string | null;
  description: string;
  reference: string | null;
  invitationId: string | null;
  itemId: string | null;
  hiddenByReport: boolean;
  priorStatus: 'pending' | 'published' | 'hidden' | 'rejected' | null;
  item: { status: string; reason: string | null; kind: string; deleted: boolean } | null;
  /** null for roles without users.pii (the database masks them) */
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  /** the reporter gave an email: the outcome can be sent */
  canReply: boolean;
  teamNotifiedAt: string | null;
  hostNotifiedAt: string | null;
  reporterNotifiedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  events?: LegalEvent[];
}

export interface AdminRequest {
  id: string;
  number: number;
  kind: RequestKind;
  relation: RequestRelation;
  status: RequestStatus;
  details: string;
  reference: string | null;
  decisionNote: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  teamNotifiedAt: string | null;
  requesterNotifiedAt: string | null;
  createdAt: string;
  dueAt: string;
  resolvedAt: string | null;
  overdue: boolean;
  events?: LegalEvent[];
}

/** The unmasked facts the server needs to write to the reporter / requester after a decision. */
export interface ReportTarget {
  id: string;
  number: number;
  invitationId: string | null;
  status: ReportStatus;
  resolution: ReportResolution | null;
  resolvedAt: string | null;
  reporterEmail: string | null;
  locale: 'he' | 'en';
}

export interface RequestTarget {
  id: string;
  number: number;
  status: RequestStatus;
  resolvedAt: string | null;
  email: string;
  locale: 'he' | 'en';
}
