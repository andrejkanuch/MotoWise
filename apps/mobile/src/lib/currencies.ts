import { CURRENCY_SYMBOLS, Currency, type Currency as CurrencyType } from '@motovault/types';

export interface CurrencyOption {
  code: CurrencyType;
  symbol: string;
  name: string;
}

/** Display metadata for the currency picker UI. */
export const CURRENCY_LIST: CurrencyOption[] = [
  { code: 'USD', symbol: CURRENCY_SYMBOLS.USD, name: 'US Dollar' },
  { code: 'EUR', symbol: CURRENCY_SYMBOLS.EUR, name: 'Euro' },
  { code: 'GBP', symbol: CURRENCY_SYMBOLS.GBP, name: 'British Pound' },
  { code: 'JPY', symbol: CURRENCY_SYMBOLS.JPY, name: 'Japanese Yen' },
  { code: 'CAD', symbol: CURRENCY_SYMBOLS.CAD, name: 'Canadian Dollar' },
  { code: 'AUD', symbol: CURRENCY_SYMBOLS.AUD, name: 'Australian Dollar' },
  { code: 'CHF', symbol: CURRENCY_SYMBOLS.CHF, name: 'Swiss Franc' },
  { code: 'INR', symbol: CURRENCY_SYMBOLS.INR, name: 'Indian Rupee' },
  { code: 'BRL', symbol: CURRENCY_SYMBOLS.BRL, name: 'Brazilian Real' },
  { code: 'MXN', symbol: CURRENCY_SYMBOLS.MXN, name: 'Mexican Peso' },
  { code: 'SEK', symbol: CURRENCY_SYMBOLS.SEK, name: 'Swedish Krona' },
  { code: 'NOK', symbol: CURRENCY_SYMBOLS.NOK, name: 'Norwegian Krone' },
  { code: 'DKK', symbol: CURRENCY_SYMBOLS.DKK, name: 'Danish Krone' },
  { code: 'PLN', symbol: CURRENCY_SYMBOLS.PLN, name: 'Polish Zloty' },
  { code: 'TRY', symbol: CURRENCY_SYMBOLS.TRY, name: 'Turkish Lira' },
  { code: 'RSD', symbol: CURRENCY_SYMBOLS.RSD, name: 'Serbian Dinar' },
  { code: 'CZK', symbol: CURRENCY_SYMBOLS.CZK, name: 'Czech Koruna' },
  { code: 'HUF', symbol: CURRENCY_SYMBOLS.HUF, name: 'Hungarian Forint' },
  { code: 'RON', symbol: CURRENCY_SYMBOLS.RON, name: 'Romanian Leu' },
  { code: 'BGN', symbol: CURRENCY_SYMBOLS.BGN, name: 'Bulgarian Lev' },
  { code: 'COP', symbol: CURRENCY_SYMBOLS.COP, name: 'Colombian Peso' },
  { code: 'ARS', symbol: CURRENCY_SYMBOLS.ARS, name: 'Argentine Peso' },
  { code: 'CLP', symbol: CURRENCY_SYMBOLS.CLP, name: 'Chilean Peso' },
  { code: 'PEN', symbol: CURRENCY_SYMBOLS.PEN, name: 'Peruvian Sol' },
];

/** Supported currency codes as a Set for quick lookup. */
export const SUPPORTED_CURRENCIES = new Set(Object.values(Currency));
