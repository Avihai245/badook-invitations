import { HomePage, homeMetadata } from '@/features/site/home/HomePage';

// Static: one copy per language on the server and the CDN. The prices come from the deployment's settings.
export const revalidate = 3600;

export const metadata = homeMetadata('en');

export default function Page() {
  return <HomePage locale="en" />;
}
