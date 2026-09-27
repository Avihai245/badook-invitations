import { exportPayments } from '@/features/admin/finance/api';
import { adminDownload } from '@/features/admin/finance/download';
import { exportDeps } from '@/features/admin/finance/server';
import { getUiLocale } from '@/lib/i18n/server';

/**
 * GET /api/admin/finance/export?… — the payments the filters match, as a spreadsheet for Excel
 * (finance.export; the export is recorded in the record of actions).
 */
export async function GET(request: Request) {
  return adminDownload(request, 'finance.export', async (staff) =>
    exportPayments(staff, new URL(request.url).searchParams, await getUiLocale(), exportDeps),
  );
}
