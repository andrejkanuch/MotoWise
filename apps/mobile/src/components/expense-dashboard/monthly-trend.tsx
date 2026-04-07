import { palette } from '@motovault/design-system';
import { EXPENSE_CATEGORIES } from '@motovault/types/validators';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/expense-constants';

interface MonthlyBucket {
  month: number;
  year: number;
  fuel: number;
  maintenance: number;
  parts: number;
  gear: number;
  tires: number;
  insurance: number;
  registration: number;
  tolls: number;
  parking: number;
  modifications: number;
  training: number;
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

export const MonthlyTrend = memo(function MonthlyTrend({ buckets, isDark }: MonthlyTrendProps) {
  const { stackData, maxValue, allZero, presentCategories } = useMemo(() => {
    const isEmpty = buckets.length === 0 || buckets.every((b) => b.total === 0);
    if (isEmpty) return { stackData: [], maxValue: 400, allZero: true, presentCategories: [] };

    let max = 0;
    const catSet = new Set<string>();

    const data = buckets.map((bucket) => {
      if (bucket.total > max) max = bucket.total;

      const stacks = EXPENSE_CATEGORIES
        .filter((cat) => bucket[cat] > 0)
        .map((cat) => {
          catSet.add(cat);
          return { value: bucket[cat], color: CATEGORY_COLORS[cat] };
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

  const cardBg = isDark ? palette.neutral800 : palette.white;
  const axisLabelColor = isDark ? palette.neutral500 : palette.neutral400;
  const rulesColor = isDark ? palette.neutral700 : palette.neutral200;
  const legendColor = isDark ? palette.neutral400 : palette.neutral500;

  return (
    <View
      accessibilityLabel="Monthly expense trend chart"
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        borderCurve: 'continuous',
        padding: 16,
        ...(!isDark
          ? {
              shadowColor: palette.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            }
          : {}),
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans-SemiBold',
          fontWeight: '600',
          fontSize: 16,
          color: isDark ? palette.white : palette.neutral950,
          marginBottom: 16,
        }}
      >
        Monthly Trend
      </Text>
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
        rulesColor={rulesColor}
        yAxisColor="transparent"
        xAxisColor="transparent"
        xAxisLabelTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          fontSize: 12,
          color: axisLabelColor,
        }}
        yAxisTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          fontSize: 12,
          color: axisLabelColor,
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
            <Text
              style={{
                fontFamily: 'PlusJakartaSans-Regular',
                fontWeight: '400',
                fontSize: 12,
                color: legendColor,
              }}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});
