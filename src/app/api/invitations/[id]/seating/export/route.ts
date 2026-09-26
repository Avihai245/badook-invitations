import writeXlsxFile from 'write-excel-file/node';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { loadSeating } from '@/features/seating/api';
import { excelSheets } from '@/features/seating/export';
import type { SeatingState } from '@/features/seating/model';
import { seatingDeps } from '@/features/seating/server';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/invitations/:id/seating/export — the seating as an Excel file (in the UI language): every
 * guest A→Z with their table number, and the tables with who sits at each.
 */
export async function GET(_request: Request, { params }: Params) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const { id } = await params;
  const [loaded, { t, locale }, item] = await Promise.all([
    loadSeating(user.id, id, seatingDeps),
    getUi(),
    ownerInvitation(user.id, id),
  ]);
  if (loaded.status !== 200 || !item)
    return new Response('Not found', { status: loaded.status === 403 ? 403 : 404, headers: NO_STORE });
  const state = loaded.body.state as SeatingState;
  const e = t.seating.excel;
  const sheets = excelSheets(state.plan, state.units, locale, e);
  const bold = (v: unknown) => ({ value: v as string, fontWeight: 'bold' as const });
  const buffer = await writeXlsxFile(
    sheets.map((s, i) => ({
      sheet: s.name,
      rightToLeft: locale === 'he',
      stickyRowsCount: 1,
      columns:
        i === 0
          ? [
              { width: 26 },
              { width: 26 },
              { width: 10 },
              { width: 10 },
              { width: 18 },
              { width: 18 },
              { width: 14 },
            ]
          : [{ width: 10 }, { width: 18 }, { width: 10 }, { width: 10 }, { width: 80 }],
      data: s.rows.map((row, r) => row.map((v) => (r === 0 ? bold(v) : v))),
    })),
  ).toBuffer();
  const name = `${e.fileName}-${item.slug}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      ...NO_STORE,
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="seating-${item.slug}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
