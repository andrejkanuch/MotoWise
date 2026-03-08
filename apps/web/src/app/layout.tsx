import { GeistMono } from 'geist/font/mono';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://motolearn.app'),
  title: {
    default: 'MotoLearn',
    template: '%s | MotoLearn',
  },
  description: 'AI-powered motorcycle learning & diagnostics platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${GeistMono.variable} antialiased`}>
      <body className="bg-[--color-surface] text-[--color-on-surface] m-0">{children}</body>
    </html>
  );
}
