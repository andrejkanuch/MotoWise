import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/skip-link';
import '@/components/marketing/design-system.css';

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mv-marketing">
        <SkipLink />
        <Navbar />
        <main id={MAIN_CONTENT_ID}>{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
