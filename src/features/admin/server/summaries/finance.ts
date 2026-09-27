import 'server-only';
import { serverEnv } from '@/lib/env';
import { financeDb } from '../../finance/server';
import { usdToIls } from '../../finance/model';
import { can } from '../../permissions';
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

/**
 * null: the role may not see money (finance.view), or the numbers couldn't be read. Income: the paid
 * purchases and renewals of this month and of last month (Israel), including VAT; MRR: the plans that
 * renew through the provider, at the price they renew at; WhatsApp: price_usd of the messages Meta
 * charges for (sent, delivered, read) × INVITES_USD_TO_ILS (supabase/migrations/*_admin_money_messages.sql).
 */
export async function financeSummary(staff: Staff): Promise<FinanceSummary | null> {
  if (!can(staff.role, 'finance.view')) return null;
  try {
    const s = await financeDb.summary(staff.userId);
    return {
      revenueMonth: s.revenueMonth,
      revenuePrevMonth: s.revenuePrevMonth,
      mrr: s.mrr,
      activeSubscriptions: s.activeSubscriptions,
      whatsappCostMonth: usdToIls(s.whatsappUsdMonth, serverEnv().INVITES_USD_TO_ILS),
    };
  } catch (err) {
    console.error('[admin] finance summary', err);
    return null;
  }
}
