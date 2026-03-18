import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es', 'de', 'fr', 'it', 'pt-BR', 'ja', 'hi', 'th', 'id', 'tr', 'pl'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
