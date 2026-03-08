import type { Metadata } from 'next';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';

export const metadata: Metadata = {
  title: {
    default: 'MotoLearn — AI-Powered Motorcycle Learning & Diagnostics',
    template: '%s | MotoLearn',
  },
  description:
    "Master motorcycle maintenance, diagnose issues with AI photos, and track your bike's health. Learn your bike. Fix your bike.",
  openGraph: {
    siteName: 'MotoLearn',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const },
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark grain-overlay min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
