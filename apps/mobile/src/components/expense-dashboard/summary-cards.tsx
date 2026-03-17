import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { formatCurrency } from '../../lib/expense-constants';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PILL_MIN_WIDTH = 100;
const PILL_WIDTH = Math.max((SCREEN_WIDTH - 52) / 3, PILL_MIN_WIDTH);

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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      accessibilityLabel="Expense summary metrics"
    >
      {pills.map((pill) => (
        <View
          key={pill.label}
          accessibilityLabel={`${pill.label}: ${pill.value}`}
          style={{
            width: PILL_WIDTH,
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
    </ScrollView>
  );
});
