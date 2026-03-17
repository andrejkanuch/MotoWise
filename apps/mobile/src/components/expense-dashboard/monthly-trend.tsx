import { palette } from '@motovault/design-system';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface MonthlyBucket {
  month: number;
  year: number;
  fuel: number;
  maintenance: number;
  parts: number;
  gear: number;
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
  const { stackData, maxValue, allZero } = useMemo(() => {
    const isEmpty = buckets.length === 0 || buckets.every((b) => b.total === 0);
    if (isEmpty) return { stackData: [], maxValue: 400, allZero: true };

    let max = 0;

    const data = buckets.map((bucket) => {
      if (bucket.total > max) max = bucket.total;

      return {
        stacks: [
          { value: bucket.fuel, color: palette.warning500 },
          { value: bucket.maintenance, color: palette.primary500 },
          { value: bucket.parts, color: palette.success500 },
          { value: bucket.gear, color: palette.danger500 },
        ],
        label: MONTH_LABELS[bucket.month - 1] ?? '',
      };
    });

    const rounded = Math.ceil(max / 100) * 100;

    return { stackData: data, maxValue: rounded || 400, allZero: false };
  }, [buckets]);

  if (allZero) return null;

  const cardBg = isDark ? palette.neutral800 : palette.white;
  const axisLabelColor = isDark ? palette.neutral500 : palette.neutral400;
  const rulesColor = isDark ? palette.neutral700 : palette.neutral200;
  const legendColor = isDark ? palette.neutral400 : palette.neutral500;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 16,
        ...(!isDark
          ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            }
          : {}),
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
        rulesColor={rulesColor}
        yAxisColor="transparent"
        xAxisColor="transparent"
        xAxisLabelTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          fontSize: 11,
          color: axisLabelColor,
        }}
        yAxisTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          fontSize: 11,
          color: axisLabelColor,
        }}
        isAnimated
        animationDuration={300}
      />

      {/* Legend — single row, only legend on the page */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          marginTop: 14,
        }}
      >
        {[
          { label: 'Fuel', color: palette.warning500 },
          { label: 'Maintenance', color: palette.primary500 },
          { label: 'Parts', color: palette.success500 },
          { label: 'Gear', color: palette.danger500 },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: item.color,
              }}
            />
            <Text
              style={{
                fontFamily: 'PlusJakartaSans-Regular',
                fontSize: 11,
                color: legendColor,
              }}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});
