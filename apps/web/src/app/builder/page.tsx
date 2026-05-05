import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/constants';
import { BuilderClient } from '@/components/builder/builder-client';

export const metadata: Metadata = {
  title: 'Trip Builder | MotoVault',
  description:
    'Create custom multi-day motorcycle itineraries. Add waypoints, organize by day, and export GPX.',
  alternates: { canonical: `${BASE_URL}/builder` },
};

export default function BuilderPage() {
  return <BuilderClient />;
}
