import { formatCurrency, formatCurrencyInput } from '../expense-constants';

// Expenses are the #1 PostHog-validated feature; formatCurrency/Input render in
// 10+ screens. Behavioral coverage (MOT-265). Locale is hardcoded en-US.

describe('formatCurrency', () => {
  it('formats USD with symbol, grouping, and 2 decimals', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('defaults to USD', () => {
    expect(formatCurrency(5)).toBe('$5.00');
  });

  it('formats zero and negative amounts', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency(-50, 'USD')).toBe('-$50.00');
  });

  it('formats EUR with its symbol in the en-US locale', () => {
    expect(formatCurrency(1234.5, 'EUR')).toBe('€1,234.50');
  });

  it('formats zero-decimal currencies (JPY) without fraction digits and rounds', () => {
    expect(formatCurrency(1235, 'JPY')).toBe('¥1,235');
    expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,235');
  });
});

describe('formatCurrencyInput', () => {
  it('caps decimals at 2 for standard currencies', () => {
    expect(formatCurrencyInput('12.345', 'USD')).toBe('12.34');
  });

  it('collapses multiple decimal points', () => {
    expect(formatCurrencyInput('1.2.3', 'USD')).toBe('1.23');
  });

  it('strips non-numeric garbage but keeps the decimal', () => {
    expect(formatCurrencyInput('abc12.3def', 'USD')).toBe('12.3');
  });

  it('restricts zero-decimal currencies (JPY) to whole numbers', () => {
    expect(formatCurrencyInput('12.34', 'JPY')).toBe('1234');
    expect(formatCurrencyInput('1000', 'JPY')).toBe('1000');
  });

  it('returns an empty string for empty/garbage-only input', () => {
    expect(formatCurrencyInput('', 'USD')).toBe('');
    expect(formatCurrencyInput('abc', 'USD')).toBe('');
  });
});
