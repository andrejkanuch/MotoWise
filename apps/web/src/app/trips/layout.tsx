import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import '@/components/marketing/design-system.css';

export default async function TripsLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mv-marketing">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2"
          style={{ background: 'var(--mv-copper)', color: 'var(--mv-on-copper)' }}
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
