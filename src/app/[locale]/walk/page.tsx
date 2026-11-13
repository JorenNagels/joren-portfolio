import type { Metadata } from 'next';
import { WalkPreview } from '@/components/street/WalkPreview';
import type { Locale } from '@/content/types';

// A page to get the walk right before it goes into the street. Not linked, not indexed.
export const metadata: Metadata = { title: 'Walk', robots: { index: false, follow: false } };

export default async function WalkPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <WalkPreview locale={locale} />;
}
