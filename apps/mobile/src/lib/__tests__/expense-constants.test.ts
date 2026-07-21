import type { TFunction } from 'i18next';
import {
  dominantCurrency,
  formatCurrency,
  formatCurrencyInput,
  formatCurrencyTotals,
  formatMoney,
  getExpenseTitle,
  groupTotalsByCurrency,
  humanizeServiceType,
  serviceTypeLabel,
} from '../expense-constants';

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

// Currency is stored per-record; render each amount in its OWN currency (no FX)
// so a stored $120 never shows as €120. These back the currency-aware totals in
// the expense list, detail, task cards, and dashboard.
describe('formatMoney', () => {
  it('formats in the given stored currency, ignoring any display preference', () => {
    expect(formatMoney(120, 'USD')).toBe('$120.00');
    expect(formatMoney(120, 'EUR')).toBe('€120.00');
  });

  it('falls back to the display currency for a blank/null currency (legacy rows)', () => {
    expect(formatMoney(120, null, 'EUR')).toBe('€120.00');
    expect(formatMoney(120, '', 'GBP')).toBe('£120.00');
    expect(formatMoney(120, undefined, 'USD')).toBe('$120.00');
  });

  it('falls back to the display currency for an unsupported code (never throws)', () => {
    expect(formatMoney(120, 'XYZ', 'EUR')).toBe('€120.00');
  });
});

describe('groupTotalsByCurrency', () => {
  it('collapses a single-currency set into one group equal to the plain sum', () => {
    const groups = groupTotalsByCurrency(
      [
        { amount: 100, currency: 'USD' },
        { amount: 20.5, currency: 'USD' },
      ],
      'EUR',
    );
    expect(groups).toEqual([{ currency: 'USD', total: 120.5 }]);
  });

  it('splits mixed currencies and sorts by total desc', () => {
    const groups = groupTotalsByCurrency([
      { amount: 40, currency: 'EUR' },
      { amount: 100, currency: 'USD' },
      { amount: 10, currency: 'EUR' },
    ]);
    expect(groups).toEqual([
      { currency: 'USD', total: 100 },
      { currency: 'EUR', total: 50 },
    ]);
  });

  it('buckets blank/unsupported currencies under the fallback', () => {
    const groups = groupTotalsByCurrency(
      [
        { amount: 30, currency: null },
        { amount: 70, currency: 'ZZZ' },
      ],
      'GBP',
    );
    expect(groups).toEqual([{ currency: 'GBP', total: 100 }]);
  });
});

describe('dominantCurrency', () => {
  it('returns the currency with the largest summed amount', () => {
    expect(
      dominantCurrency([
        { amount: 100, currency: 'USD' },
        { amount: 250, currency: 'EUR' },
      ]),
    ).toBe('EUR');
  });

  it('returns the fallback for an empty list', () => {
    expect(dominantCurrency([], 'GBP')).toBe('GBP');
  });
});

describe('formatCurrencyTotals', () => {
  it('renders a single-currency total as one plain formatted value', () => {
    expect(formatCurrencyTotals([{ currency: 'USD', total: 120 }])).toBe('$120.00');
  });

  it('joins mixed-currency subtotals with a middot (no meaningless cross-currency sum)', () => {
    expect(
      formatCurrencyTotals([
        { currency: 'USD', total: 100 },
        { currency: 'EUR', total: 50 },
      ]),
    ).toBe('$100.00 · €50.00');
  });

  it('renders a zero fallback total for an empty group set', () => {
    expect(formatCurrencyTotals([], 'EUR')).toBe('€0.00');
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

// Shared display helpers extracted so the expense list row, the expense detail
// screen and the maintenance/receipt cards never diverge (dedup of 3 copies).
describe('humanizeServiceType', () => {
  it('title-cases and de-underscores a canonical key', () => {
    expect(humanizeServiceType('oil_change')).toBe('Oil change');
    expect(humanizeServiceType('brake_pads')).toBe('Brake pads');
  });

  it('returns empty string for null/undefined/empty (guard branch)', () => {
    expect(humanizeServiceType(null)).toBe('');
    expect(humanizeServiceType(undefined)).toBe('');
    expect(humanizeServiceType('')).toBe('');
  });
});

// serviceTypeLabel is display-only (the canonical KEY is what's persisted/sent),
// so translating it is safe. It delegates to a passed-in `t` and falls back to the
// English humanizer when a locale is missing the key.
describe('serviceTypeLabel', () => {
  // Minimal react-i18next `t` stub: resolves a few keys, otherwise honors defaultValue.
  const resources: Record<string, string> = {
    'serviceType.oil_change': 'Vidange',
    'serviceType.chain': 'Chaîne',
  };
  const t = ((key: string, opts?: { defaultValue?: string }) =>
    resources[key] ?? opts?.defaultValue ?? key) as unknown as TFunction;

  it('returns the localized label when the key resolves', () => {
    expect(serviceTypeLabel('oil_change', t)).toBe('Vidange');
    expect(serviceTypeLabel('chain', t)).toBe('Chaîne');
  });

  it('falls back to the English humanizer when the locale is missing the key', () => {
    expect(serviceTypeLabel('brake_pads', t)).toBe('Brake pads');
    expect(serviceTypeLabel('general_service', t)).toBe('General service');
  });

  it('returns empty string for null/undefined/empty (never calls t)', () => {
    const throwT = (() => {
      throw new Error('t must not be called for a blank key');
    }) as unknown as TFunction;
    expect(serviceTypeLabel(null, throwT)).toBe('');
    expect(serviceTypeLabel(undefined, throwT)).toBe('');
    expect(serviceTypeLabel('', throwT)).toBe('');
  });
});

describe('getExpenseTitle', () => {
  it('prefers itemName over description and the category label', () => {
    expect(getExpenseTitle({ itemName: 'EBC pads', description: 'note' }, 'Parts')).toBe(
      'EBC pads',
    );
  });

  it('falls back to description when itemName is blank/whitespace', () => {
    expect(getExpenseTitle({ itemName: '  ', description: 'Chain lube' }, 'Parts')).toBe(
      'Chain lube',
    );
  });

  it('falls back to the (already-translated) category label when both are empty', () => {
    expect(getExpenseTitle({ itemName: null, description: null }, 'Service')).toBe('Service');
  });

  it('falls back to the category label when both fields are whitespace-only', () => {
    expect(getExpenseTitle({ itemName: '  ', description: '  ' }, 'Service')).toBe('Service');
  });
});
