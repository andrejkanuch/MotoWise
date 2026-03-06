import type { SupportedLocale } from '@motolearn/types';

export const LOCALE_TO_REGCONFIG = {
  en: 'english',
  es: 'spanish',
  de: 'german',
} as const satisfies Record<SupportedLocale, string>;
