import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { useCurrency } from '../../hooks/use-currency';

interface SummaryCardsProps {
  avgPerMonth: number;
  expenseCount: number;
  costPerUnit: number | null;
  unitLabel: string;
  isDark: boolean;
}

export const SummaryCards = memo(function SummaryCards({
  avgPerMonth,
  expenseCount,
  costPerUnit,
  unitLabel,
  isDark,
}: SummaryCardsProps) {
  const { format: formatCurrency } = useCurrency();
  const textColor = isDark ? palette.white : palette.neutral950;
  const pillBg = isDark ? palette.neutral800 : palette.white;
  const borderColor = isDark ? 'transparent' : palette.neutral200;

  const pills = [
    {
      label: 'AVG/MO',
      value: Number.isFinite(avgPerMonth) ? formatCurrency(avgPerMonth) : '\u2014',
    },
    {
      label: 'ENTRIES',
      value: String(expenseCount),
    },
    {
      label: unitLabel,
      value:
        costPerUnit !== null && Number.isFinite(costPerUnit)
          ? formatCurrency(costPerUnit)
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
            backgroundColor: pillBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            padding: 12,
            borderWidth: 1,
            borderColor,
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-Medium',
              fontWeight: '500',
              fontSize: 12,
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            {pill.label}
          </Text>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontWeight: '600',
              fontSize: 20,
              color: textColor,
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
