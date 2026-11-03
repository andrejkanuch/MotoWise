// Money renders in the rider's number locale, not always en-US, so German,
// Spanish and Colombian riders see their own separators and symbol placement.
const mockLocale = { value: 'en-US' };
jest.mock('../number-locale', () => ({ getNumberLocale: () => mockLocale.value }));

import { formatCurrency, formatCurrencyWhole, formatMoney } from '../expense-constants';

/** Intl uses narrow/no-break spaces; compare with plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatCurrency in the rider locale', () => {
  it('formats EUR the German way in de-DE', () => {
    mockLocale.value = 'de-DE';
    expect(plain(formatCurrency(1234.5, 'EUR'))).toBe('1.234,50 €');
  });

  it('formats COP with a peso sign and dot grouping in es-CO', () => {
    mockLocale.value = 'es-CO';
    expect(plain(formatCurrencyWhole(185000, 'COP'))).toBe('$ 185.000');
  });

  it('formats BRL the Brazilian way in pt-BR', () => {
    mockLocale.value = 'pt-BR';
    expect(plain(formatMoney(1234.5, 'BRL'))).toBe('R$ 1.234,50');
  });

  it('keeps en-US output unchanged', () => {
    mockLocale.value = 'en-US';
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    expect(formatCurrencyWhole(218.4, 'EUR')).toBe('€218');
  });
});
