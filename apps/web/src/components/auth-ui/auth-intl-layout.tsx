import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { mvFontsClassName } from '@/lib/fonts';

/**
 * Server wrapper for /login and /signup: hands the client pages only the
 * AuthV2 namespace (not the whole catalogue) and resolves the --mv-font-*
 * tokens, Instrument Serif included, on this wrapper.
 */
export async function AuthIntlLayout({ children }: { children: React.ReactNode }) {
  const messages = (await getMessages()) as Record<string, unknown>;
  return (
    <NextIntlClientProvider messages={{ AuthV2: messages.AuthV2 } as typeof messages}>
      <div className={mvFontsClassName}>{children}</div>
    </NextIntlClientProvider>
  );
}
