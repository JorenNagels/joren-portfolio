import type { Metadata } from 'next';
import { ModelPreview } from '@/components/street/ModelPreview';
import type { Locale } from '@/content/types';

// A page to look at one figure before it goes into the street. Not linked, not indexed.
export const metadata: Metadata = { title: 'Model', robots: { index: false, follow: false } };

export default async function ModelPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <ModelPreview locale={locale} />;
}
