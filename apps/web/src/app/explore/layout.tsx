import { Instrument_Serif } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { CursorDot } from '@/components/marketing/cursor-dot';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { pickClientMessages } from '@/i18n/client-messages';
import '@/components/marketing/design-system.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={pickClientMessages(messages)}>
      <div className={`mv-marketing ${instrumentSerif.variable}`}>
        <CursorDot />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
