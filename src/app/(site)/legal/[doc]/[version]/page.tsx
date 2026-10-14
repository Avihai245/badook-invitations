import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLegalDocKey } from '@/features/legal/links';
import { LegalDocPage, legalDocMetadata } from '@/features/legal/render';

type Params = Promise<{ doc: string; version: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { doc, version } = await params;
  return isLegalDocKey(doc) ? legalDocMetadata(doc, version) : {};
}

/** /legal/<document>/<version> — the permanent address of one version of a legal document. */
export default async function Page({ params }: { params: Params }) {
  const { doc, version } = await params;
  if (!isLegalDocKey(doc)) notFound();
  return <LegalDocPage docKey={doc} version={version} />;
}
