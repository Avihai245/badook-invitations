import type { Metadata } from 'next';
import { LegalDocPage, legalDocMetadata } from '@/features/legal/render';

export const generateMetadata = (): Promise<Metadata> => legalDocMetadata('gallery-rules');

/** /gallery-rules — new in version 2 of the legal documents: not found until that version is in force. */
export default function Page() {
  return <LegalDocPage docKey="gallery-rules" />;
}
