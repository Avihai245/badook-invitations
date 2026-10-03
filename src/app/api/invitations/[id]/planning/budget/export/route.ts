import writeXlsxFile from 'write-excel-file/node';
import { budgetSheets, type BudgetSheetWords } from '@/features/planning/server/budget';
import { planningDeps } from '@/features/planning/server/deps';
import { gate, isRefusal, rawState } from '@/features/planning/server/types';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };
const MONEY = '#,##0.00';

/**
 * GET /api/invitations/:id/planning/budget/export — the budget as an Excel file (in the UI language): the
 * numbers, the categories, every item and the payment schedule. A paid tool (`planning_export`).
 */
export async function GET(_request: Request, { params }: Params) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const { id } = await params;
  try {
    const g = await gate(user.id, id, planningDeps, 'planning_export');
    if (isRefusal(g))
      return new Response(g.status === 403 ? 'Forbidden' : 'Not found', {
        status: g.status,
        headers: NO_STORE,
      });
    const [raw, { t, locale }] = await Promise.all([rawState(planningDeps, id, user.id), getUi()]);
    if (!raw?.settings) return new Response('Not found', { status: 404, headers: NO_STORE });
    const e = t.planning.budget.excel;
    const words: BudgetSheetWords = {
      ...e,
      vatModes: t.planning.budget.vat.modes,
      statuses: t.planning.budget.status,
      bases: t.planning.budget.basis,
      categories: t.planning.categories,
    };
    const sheets = budgetSheets(raw, words);
    const bold = (v: string | number | null) => ({ value: v ?? '', fontWeight: 'bold' as const });
    const buffer = await writeXlsxFile(
      sheets.map((s) => ({
        sheet: s.name,
        rightToLeft: locale === 'he',
        stickyRowsCount: 1,
        columns: s.widths.map((width) => ({ width })),
        data: s.rows.map((row, r) =>
          row.map((v, c) => {
            if (r === 0) return bold(v);
            if (typeof v === 'number' && (s.money.includes(c) || (c === 1 && s.moneyRows?.includes(r))))
              return { value: v, type: Number, format: MONEY };
            return v;
          }),
        ),
      })),
    ).toBuffer();
    const name = `${e.fileName}-${raw.invitation.slug}.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...NO_STORE,
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="budget-${raw.invitation.slug}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (err) {
    console.error('[budget export]', err);
    return new Response('Server error', { status: 500, headers: NO_STORE });
  }
}
