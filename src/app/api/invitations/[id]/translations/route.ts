import { hostRoute } from '@/features/invitations/server/host-route';
import { translateDeps } from '@/features/invitations/translate/deps';
import {
  approveTranslations,
  listTranslations,
  saveGlossary,
  translateLocale,
} from '@/features/invitations/translate/server';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/translations — the translations, the glossary, whether the machine is on. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, _body, deps) => listTranslations(userId, id, translateDeps(deps)));
}

/** POST /api/invitations/:id/translations — { locale, paths? }: the machine translation (translate_ai). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => translateLocale(userId, id, body, translateDeps(deps)));
}

/** PATCH /api/invitations/:id/translations — { locale, paths }: the host approves the machine's texts. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) =>
    approveTranslations(userId, id, body, translateDeps(deps)),
  );
}

/** PUT /api/invitations/:id/translations — { terms }: the glossary, words never translated. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => saveGlossary(userId, id, body, translateDeps(deps)));
}
