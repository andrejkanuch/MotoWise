import type { SupportedLocale } from '@motovault/types';

export const LOCALE_TO_REGCONFIG = {
  en: 'english',
  es: 'spanish',
  de: 'german',
  fr: 'french',
  it: 'italian',
  'pt-BR': 'portuguese',
  ja: 'simple',
  hi: 'simple',
  th: 'simple',
  id: 'simple',
  tr: 'turkish',
  pl: 'simple',
} as const satisfies Record<SupportedLocale, string>;
