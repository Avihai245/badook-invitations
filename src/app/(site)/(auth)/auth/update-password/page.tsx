import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { UpdatePasswordForm } from '../../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.updateTitle };
}

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
