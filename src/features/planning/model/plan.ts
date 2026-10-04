import type { EventType } from '@/features/invitations/contracts/types';
import type {
  CategoryKey,
  CostBasis,
  GuestBasis,
  IdeaColor,
  IdeaType,
  ItemStatus,
  TaskStatus,
  Variant,
  VatMode,
  VendorStatus,
} from './categories';
import type { SystemKey } from './types';

/**
 * The shapes the planning functions in the database answer with (supabase/migrations/*_planning_*.sql,
 * camelCase like the other screens'), and the view the server makes of them for the screens.
 */

export interface PlanInvitation {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  eventType: EventType;
  /** YYYY-MM-DD in the event's zone */
  date: string | null;
  timezone: string | null;
  rsvpDeadline: string | null;
}

export const INTEGRATION_MODES = ['standalone', 'recommended', 'full'] as const;
export type IntegrationMode = (typeof INTEGRATION_MODES)[number];
/** Which parts of the invitation system the plan follows. Turning one off never deletes data. */
export interface Integrations {
  mode: IntegrationMode;
  /** closing a vendor makes a budget item and its payments */
  vendors: boolean;
  /** "done" asks what it cost */
  tasks: boolean;
  /** costs per adult / child / guest follow the list and the replies */
  guests: boolean;
  /** cost per table follows the seating */
  seating: boolean;
  /** today's payments on the event day */
  eventDay: boolean;
  /** the budget card on the overview and the insights block */
  overview: boolean;
}
export interface Reminders {
  /** a weekly email with the week's tasks and payments */
  email: boolean;
}

export interface PlanSettings {
  templateKey: string | null;
  variant: Variant;
  totalBudget: number | null;
  vatMode: VatMode;
  vatPct: number;
  guestBasis: GuestBasis;
  manualAdults: number | null;
  manualChildren: number | null;
  manualTables: number | null;
  integrations: Partial<Integrations>;
  reminders: Partial<Reminders>;
  requiredVendors: CategoryKey[];
  onboardingDone: boolean;
  anchorDate: string | null;
  headcountSeen: { adults?: number; children?: number; tables?: number } | null;
}

export interface PlanTask {
  id: string;
  /** null: a system task or a template's task nobody renamed — the dictionary / the template names it */
  title: string | null;
  notes: string | null;
  dueDate: string | null;
  dueIsManual: boolean;
  offsetDays: number | null;
  status: TaskStatus;
  category: CategoryKey | null;
  priority: 0 | 1;
  assignee: string | null;
  budgetItemId: string | null;
  vendorId: string | null;
  systemKey: SystemKey | null;
  tplKey: string | null;
  suggestHide: boolean;
  completedAt: string | null;
  sort: number;
}

export interface PlanCategory {
  id: string;
  key: CategoryKey | null;
  name: string | null;
  plannedAmount: number;
  costBasis: CostBasis;
  unitPrice: number | null;
  childPrice: number | null;
  required: boolean;
  sort: number;
}

export interface Attachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface PlanItem {
  id: string;
  categoryId: string;
  vendorId: string | null;
  title: string;
  estimate: number | null;
  quoted: number | null;
  final: number | null;
  status: ItemStatus;
  vatIncluded: boolean | null;
  attachments: Attachment[];
  notes: string | null;
  sort: number;
}

export interface PlanPayment {
  id: string;
  itemId: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  payOnEventDay: boolean;
  payer: string | null;
}

export interface PlanVendor {
  id: string;
  name: string;
  category: CategoryKey | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  status: VendorStatus;
  quoteAmount: number | null;
  paymentTerms: string | null;
  included: string | null;
  rating: number | null;
  notes: string | null;
  attachments: Attachment[];
  sort: number;
}

export interface OgPreview {
  title?: string;
  description?: string;
  image?: string;
  site?: string;
}
export interface PlanIdea {
  id: string;
  type: IdeaType;
  title: string | null;
  body: string | null;
  url: string | null;
  ogPreview: OgPreview | null;
  imagePath: string | null;
  color: IdeaColor;
  tags: string[];
  pinned: boolean;
  items: { text: string; done: boolean }[];
  linkedTaskId: string | null;
  linkedVendorId: string | null;
  linkedBudgetItemId: string | null;
  sort: number;
  createdAt: string;
}

export interface Headcount {
  /** where the numbers come from now (the host's choice, or 'manual' when the guests' link is off) */
  basis: GuestBasis;
  adults: number;
  children: number;
  guests: number;
  tables: number;
  invited: number;
  confirmedAdults: number;
  confirmedChildren: number;
}

export interface CategoryTotals {
  id: string;
  planned: number;
  expected: number;
  committed: number;
  paid: number;
}
export interface Totals {
  totalBudget: number | null;
  planned: number;
  expected: number;
  committed: number;
  paid: number;
  unpaid: number;
  remaining: number | null;
  perGuest: number | null;
  byCategory: CategoryTotals[];
}

/** How the guest numbers moved since the host last looked, and what that does to the costs. */
export interface HeadcountChange {
  adults: number;
  children: number;
  tables: number;
  cost: number;
}

export interface PlanFacts {
  tables: number;
  confirmedUnseated: number;
  stationReady: boolean;
}

export interface RawPlanState {
  invitation: PlanInvitation;
  settings: PlanSettings | null;
  tasks: PlanTask[];
  categories: PlanCategory[];
  items: PlanItem[];
  payments: PlanPayment[];
  vendors: PlanVendor[];
  ideas: PlanIdea[];
  headcount: Headcount;
  totals: Totals;
  headcountChange: HeadcountChange | null;
  facts: PlanFacts;
}

export interface RawPlanOverview {
  invitation: PlanInvitation;
  settings: PlanSettings | null;
  headcount?: Headcount;
  totals?: Totals;
  headcountChange?: HeadcountChange | null;
  facts?: PlanFacts;
  taskTotals?: { total: number; done: number; skipped: number };
  tasks?: PlanTask[];
  payments?: {
    id: string;
    label: string;
    amount: number;
    dueDate: string | null;
    payOnEventDay: boolean;
    itemTitle: string;
    vendorId: string | null;
  }[];
  vendors?: { total: number; closed: number; missing: CategoryKey[] };
}

/** A task as the screens see it: with what the app itself knows about it. */
export interface TaskView extends PlanTask {
  /** the app can tell it is done (true), is not (false), or has no way to tell (null) */
  derived: boolean | null;
}

/** What the planning screens load: the database's state, the system tasks resolved, and today. */
export interface PlanView extends Omit<RawPlanState, 'tasks'> {
  /** the calendar day in the event's zone */
  today: string;
  tasks: TaskView[];
  /** the invitation's own numbers the system tasks were judged by */
  summary: { guests: number; sent: number; responses: number; unpublishedChanges: boolean };
  /** the event's date was changed since the tasks were dated */
  dateChanged: boolean;
  /** the features the host's package gives this plan (the screens offer or lock tools by them) */
  features: { ai: boolean; export: boolean; templates: boolean; seating: boolean; checkin: boolean };
}
