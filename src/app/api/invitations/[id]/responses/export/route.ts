import type { DietaryKey } from '@/features/invitations/contracts/types';
import { formatPhone } from '@/features/invitations/lib/phone';
import { exportFileName, responsesCsv } from '@/features/invitations/lib/responses';
import { loadDashboard } from '@/features/invitations/server/responses';
import { getUi } from '@/lib/i18n/server';
import { invitationsEnabled } from '@/lib/feature';
import { getSessionUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/invitations/:id/responses/export — the replies as CSV for Excel (§12.7): UTF-8 with a BOM,
 * labels in the host's UI language, one row per reply.
 */
export async function GET(_request: Request, { params }: Params) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const { id } = await params;
  const [{ t, locale: ui }] = await Promise.all([getUi()]);
  const data = await loadDashboard(id, user.id, ui);
  if (!data) return new Response('Not found', { status: 404, headers: NO_STORE });
  const r = t.responses;
  const csv = responsesCsv(data.responses, {
    labels: {
      ...r.csv,
      attending: r.attending,
      declined: r.declined,
      yes: r.yes,
      no: r.no,
      diet: r.diet as Record<DietaryKey, string>,
      localeName: { he: t.common.hebrew, en: t.common.english },
    },
    questions: data.rawQuestions,
    uiLocale: ui,
    fallbackLocale: data.locale,
    timeZone: data.timeZone,
    formatPhone,
  });
  // an ASCII name: browsers (headless Chromium at least) drop a UTF-8 filename* and save "download"
  const file = exportFileName(data.slug);
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
    },
  });
}
