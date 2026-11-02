import type { AbstractIntlMessages } from 'next-intl';

/**
 * Message namespaces read by Client Components (`useTranslations` inside a
 * 'use client' tree). Only these are serialized to the browser.
 *
 * Why: a bare `<NextIntlClientProvider>` (or `messages={await getMessages()}`)
 * ships the WHOLE catalog (~240 KB per locale) inside every page's RSC payload,
 * twice per page (inlined in the HTML and again in the `.rsc` file). On ISR
 * pages that is written to Vercel's cache on every regeneration and was the
 * main multiplier behind the ISR Writes bill. Server Components read messages
 * from `i18n/request.ts` directly and need nothing from here.
 *
 * `client-messages.test.ts` fails when a client component uses a namespace that
 * is missing from this list — add it here when that happens.
 */
export const CLIENT_MESSAGE_NAMESPACES = [
  'AppHandoff',
  'AuthV2',
  'Blog',
  'CommunityNav',
  'CookieBanner',
  'Error',
  'Faq',
  'Features',
  'Followers',
  'Garage',
  'GarageV2',
  'Hero',
  'LanguageSwitcher',
  'Manifesto',
  'Navbar',
  'Profile',
  'StickyBar',
] as const;

export function pickClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(
    CLIENT_MESSAGE_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]]),
  );
}
