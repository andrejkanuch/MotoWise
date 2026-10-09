import type { Currency } from '@motovault/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { formatMoney } from '../../lib/expense-constants';
import { useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';

interface SummaryCardsProps {
  avgPerMonth: number;
  expenseCount: number;
  costPerUnit: number | null;
  unitLabel: string;
  /** Currency of these figures: the dashboard's selected per-currency breakdown
   *  (see expense-dashboard). Every figure passed in is in this one currency. */
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
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const pills = [
    {
      label: t('expenses.avgPerMonth'),
      value: Number.isFinite(avgPerMonth) ? formatMoney(avgPerMonth, currency) : '\u2014',
    },
    {
      label: t('expenses.entries'),
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
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: space.sm,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <Text
            style={{
              ...type.label,
              color: theme.ink2,
              marginBottom: space.xxs,
            }}
            numberOfLines={1}
          >
            {pill.label}
          </Text>
          <Text
            style={{
              ...type.figure,
              fontSize: 24,
              lineHeight: 28,
              color: theme.ink,
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
