import { appleDomainFile } from '@/features/billing/server/apple-pay-domain';

// /.well-known/apple-developer-merchantid-domain-association (next.config.ts rewrites it here):
// Apple Pay's domain file, so the Apple Pay button in Tranzila's form works on our domain
export const dynamic = 'force-dynamic';

export async function GET() {
  const file = await appleDomainFile();
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
