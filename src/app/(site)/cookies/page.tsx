import type { Metadata } from 'next';
import { LegalDocPage, legalDocMetadata } from '@/features/legal/render';

export const generateMetadata = (): Promise<Metadata> => legalDocMetadata('cookies');

/** /cookies — the version of the document in force (features/legal/registry.ts). */
export default function Page() {
  return <LegalDocPage docKey="cookies" />;
}
