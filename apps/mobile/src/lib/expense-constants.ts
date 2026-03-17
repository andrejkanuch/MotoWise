import { palette } from '@motovault/design-system';

export const CATEGORY_COLORS: Record<string, string> = {
  fuel: palette.warning500,
  maintenance: palette.primary500,
  parts: palette.success500,
  gear: palette.danger500,
};

export const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  parts: 'Parts',
  gear: 'Gear',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export function formatExpenseDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
