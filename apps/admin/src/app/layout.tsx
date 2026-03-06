import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MotoLearn Admin',
  description: 'Admin dashboard for MotoLearn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
