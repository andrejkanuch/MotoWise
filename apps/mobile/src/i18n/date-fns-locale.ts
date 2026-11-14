import type { SupportedLocale } from '@motovault/types';
import type { Locale } from 'date-fns';
import { de } from 'date-fns/locale/de';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { hi } from 'date-fns/locale/hi';
import { id } from 'date-fns/locale/id';
import { it } from 'date-fns/locale/it';
import { ja } from 'date-fns/locale/ja';
import { pl } from 'date-fns/locale/pl';
import { ptBR } from 'date-fns/locale/pt-BR';
import { sk } from 'date-fns/locale/sk';
import { th } from 'date-fns/locale/th';
import { tr } from 'date-fns/locale/tr';

/**
 * The date-fns locale of each app locale. Imported one by one: the
 * `date-fns/locale` barrel would bundle every locale date-fns ships.
 */
const DATE_FNS_LOCALES: Readonly<Record<SupportedLocale, Locale>> = {
  en: enUS,
  es,
  de,
  fr,
  it,
  'pt-BR': ptBR,
  ja,
  hi,
  th,
  id,
  tr,
  pl,
  sk,
};

const LOCALE_BY_TAG: ReadonlyMap<string, Locale> = new Map(
  Object.entries(DATE_FNS_LOCALES).map(([tag, locale]) => [tag.toLowerCase(), locale]),
);

/**
 * The date-fns locale for an i18next language (`de`, `es-ES`, `pt-BR`, `en-US`):
 * the exact tag first, then its language code, else English.
 */
export function dateFnsLocale(language: string): Locale {
  const tag = language.toLowerCase();
  return LOCALE_BY_TAG.get(tag) ?? LOCALE_BY_TAG.get(tag.split('-')[0]) ?? enUS;
}
