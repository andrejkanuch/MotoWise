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

  return (
    <View
      style={{
        backgroundColor: palette.neutral800,
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 16,
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans-SemiBold',
          fontSize: 14,
          fontWeight: '600',
          color: palette.white,
          marginBottom: 16,
        }}
      >
        Monthly Breakdown
      </Text>

      <BarChart
        stackData={stackData}
        barWidth={20}
        spacing={8}
        noOfSections={4}
        maxValue={maxValue}
        hideRules={false}
        rulesColor={palette.neutral700}
        xAxisLabelTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          fontSize: 10,
          color: palette.neutral500,
        }}
        yAxisTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          fontSize: 10,
          color: palette.neutral500,
        }}
        yAxisColor={palette.neutral700}
        xAxisColor={palette.neutral700}
        isAnimated
        animationDuration={300}
      />

      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
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
                color: palette.neutral400,
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
