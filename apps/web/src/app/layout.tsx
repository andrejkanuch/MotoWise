import { GeistMono } from 'geist/font/mono';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://motowise.app'),
  title: {
    default: 'MotoWise',
    template: '%s | MotoWise',
  },
  description: 'AI-powered motorcycle learning & diagnostics platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${plusJakarta.variable} ${GeistMono.variable} antialiased`}>
      <body className="bg-[--color-surface] text-[--color-on-surface] m-0">{children}</body>
    </html>
  );
}
