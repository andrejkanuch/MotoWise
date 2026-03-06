import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
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
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
