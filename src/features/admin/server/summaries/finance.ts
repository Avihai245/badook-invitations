import 'server-only';
import type { Staff } from '../gate';

/** The money on the console's overview (the finance area has the whole picture). */
export interface FinanceSummary {
  /** shekels including VAT, as charged */
  revenueMonth: number;
  revenuePrevMonth: number;
  /** monthly recurring revenue: the active plans at the price they renew at */
  mrr: number;
  activeSubscriptions: number;
  /** WhatsApp's cost this month, in shekels */
  whatsappCostMonth: number;
}

/** null: the role may not see money (finance.view), or the numbers couldn't be read. */
export async function financeSummary(staff: Staff): Promise<FinanceSummary | null> {
  void staff;
  return null;
}
