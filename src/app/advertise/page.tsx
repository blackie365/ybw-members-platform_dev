import type { Metadata } from 'next';
import { publicCatalogue } from '@/features/advertising/server';
import AdvertiseClient from './page.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Advertise in Yorkshire Businesswoman',
  description:
    'Reach Yorkshire’s businesswomen in print. Directory listings, classifieds, advertorials and display adverts — reserve your space in the next issue.',
};

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [catalogue, params] = await Promise.all([publicCatalogue(), searchParams]);
  return <AdvertiseClient catalogue={catalogue} cancelled={params?.cancelled === '1'} />;
}
