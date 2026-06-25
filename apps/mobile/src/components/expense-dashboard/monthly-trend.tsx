import { palette } from '@motovault/design-system';
import { EXPENSE_CATEGORIES } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/expense-constants';
import { useEditorialTheme } from '../../theme/editorial';

interface MonthlyBucket {
  month: number;
  year: number;
  categories: { category: string; total: number }[];
  total: number;
}

interface MonthlyTrendProps {
  buckets: MonthlyBucket[];
  isDark: boolean;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const MonthlyTrend = memo(function MonthlyTrend({ buckets }: MonthlyTrendProps) {
  const { t: theme, isDark } = useEditorialTheme();

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
        label: MONTH_LABELS[bucket.month - 1] ?? '',
      };
    });

    const rounded = Math.ceil(max / 100) * 100;

    return {
      stackData: data,
      maxValue: rounded || 400,
      allZero: false,
      presentCategories: EXPENSE_CATEGORIES.filter((cat) => catSet.has(cat)),
    };
  }, [buckets]);

  if (allZero) return null;

  return (
    <View
      accessibilityLabel="Monthly expense trend chart"
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
        rulesColor={isDark ? palette.neutral700 : palette.neutral200}
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
        accessibilityLabel={`Chart legend: ${presentCategories.map((c) => CATEGORY_LABELS[c]).join(', ')}`}
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
            <Text style={{ fontSize: 12, color: theme.ink3 }}>{CATEGORY_LABELS[cat]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
