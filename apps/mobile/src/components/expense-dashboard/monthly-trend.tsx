import { EXPENSE_CATEGORIES } from '@motovault/types';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { CATEGORY_COLORS, categoryLabel } from '../../lib/expense-constants';
import { useEditorialTheme } from '../../theme/editorial';

interface MonthlyBucket {
  month: number;
  year: number;
  categories: ReadonlyArray<{ category: string; total: number }>;
  total: number;
}

interface MonthlyTrendProps {
  buckets: ReadonlyArray<MonthlyBucket>;
  isDark: boolean;
}

/** A month's short name in the app language ("Jan", "ene", "Jan."); `month` is 1-12. */
function monthLabel(month: number, locale: string): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(locale, { month: 'short' });
}

export const MonthlyTrend = memo(function MonthlyTrend({ buckets }: MonthlyTrendProps) {
  const { t: theme } = useEditorialTheme();
  const { t, i18n } = useTranslation();
  const { language } = i18n;

  const { stackData, maxValue, allZero, presentCategories } = useMemo(() => {
    const isEmpty = buckets.length === 0 || buckets.every((b) => b.total === 0);
    if (isEmpty) return { stackData: [], maxValue: 400, allZero: true, presentCategories: [] };

    let max = 0;
    const catSet = new Set<string>();

    const data = buckets.map((bucket) => {
      if (bucket.total > max) max = bucket.total;

      const stacks = bucket.categories
        .filter((c) => c.total > 0)
        .map((c) => {
          catSet.add(c.category);
          return { value: c.total, color: CATEGORY_COLORS[c.category] };
        });

      return {
        stacks: stacks.length > 0 ? stacks : [{ value: 0, color: 'transparent' }],
        label: bucket.month >= 1 && bucket.month <= 12 ? monthLabel(bucket.month, language) : '',
      };
    });

    const rounded = Math.ceil(max / 100) * 100;

    return {
      stackData: data,
      maxValue: rounded || 400,
      allZero: false,
      presentCategories: EXPENSE_CATEGORIES.filter((cat) => catSet.has(cat)),
    };
  }, [buckets, language]);

  if (allZero) return null;

  return (
    <View
      accessibilityLabel={t('expenses.trendChartA11y')}
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 16,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <BarChart
        stackData={stackData}
        barWidth={24}
        spacing={12}
        noOfSections={4}
        maxValue={maxValue}
        hideRules={false}
        rulesType="dashed"
        dashWidth={4}
        dashGap={4}
        rulesColor={theme.line}
        yAxisColor="transparent"
        xAxisColor="transparent"
        xAxisLabelTextStyle={{
          fontSize: 11,
          color: theme.ink3,
        }}
        yAxisTextStyle={{
          fontSize: 11,
          color: theme.ink3,
        }}
        isAnimated
        animationDuration={300}
      />

      {/* Legend */}
      <View
        accessibilityLabel={t('expenses.legendA11y', {
          list: presentCategories.map((c) => categoryLabel(t, c)).join(', '),
        })}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 16,
        }}
      >
        {presentCategories.map((cat) => (
          <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: CATEGORY_COLORS[cat],
              }}
            />
            <Text style={{ fontSize: 12, color: theme.ink3 }}>{categoryLabel(t, cat)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
