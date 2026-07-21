import type { Currency } from '@motovault/types';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { formatMoney } from '../../lib/expense-constants';
import { useEditorialTheme } from '../../theme/editorial';

interface SummaryCardsProps {
  avgPerMonth: number;
  expenseCount: number;
  costPerUnit: number | null;
  unitLabel: string;
  /** Currency for these server-summed aggregates (dominant currency of the bike's
   *  expenses \u2014 see expense-dashboard). No FX, so a single currency is assumed. */
  currency: Currency;
  isDark: boolean;
}

export const SummaryCards = memo(function SummaryCards({
  avgPerMonth,
  expenseCount,
  costPerUnit,
  unitLabel,
  currency,
}: SummaryCardsProps) {
  const { t: theme } = useEditorialTheme();

  const pills = [
    {
      label: 'AVG/MO',
      value: Number.isFinite(avgPerMonth) ? formatMoney(avgPerMonth, currency) : '\u2014',
    },
    {
      label: 'ENTRIES',
      value: String(expenseCount),
    },
    {
      label: unitLabel,
      value:
        costPerUnit !== null && Number.isFinite(costPerUnit)
          ? formatMoney(costPerUnit, currency)
          : '\u2014',
    },
  ];

  return (
    <View accessibilityLabel="Expense summary metrics" style={{ flexDirection: 'row', gap: 8 }}>
      {pills.map((pill) => (
        <View
          key={pill.label}
          accessibilityLabel={`${pill.label}: ${pill.value}`}
          style={{
            flex: 1,
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 12,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: theme.ink3,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 6,
            }}
          >
            {pill.label}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 22,
              color: theme.ink,
              letterSpacing: -0.3,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {pill.value}
          </Text>
        </View>
      ))}
    </View>
  );
});
