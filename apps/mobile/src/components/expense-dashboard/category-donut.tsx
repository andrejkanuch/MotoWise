import { palette } from '@motovault/design-system';
import { memo, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { CATEGORY_COLORS, formatCurrency } from '../../lib/expense-constants';

interface CategoryDonutProps {
  categoryTotals: Array<{ category: string; total: number }>;
  totalAmount: number;
}

export const CategoryDonut = memo(function CategoryDonut({
  categoryTotals,
  totalAmount,
}: CategoryDonutProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const allZero = categoryTotals.every((c) => c.total === 0);

  const pieData = useMemo(
    () =>
      categoryTotals
        .filter((c) => c.total > 0)
        .map((c, index) => ({
          value: c.total,
          color: CATEGORY_COLORS[c.category] ?? palette.neutral400,
          onPress: () => setFocusedIndex((prev) => (prev === index ? null : index)),
        })),
    [categoryTotals],
  );

  if (allZero) return null;

  const focusedCategory =
    focusedIndex !== null ? categoryTotals.filter((c) => c.total > 0)[focusedIndex] : null;

  const centerLabel = () => {
    if (focusedCategory && totalAmount > 0) {
      const pct = ((focusedCategory.total / totalAmount) * 100).toFixed(0);
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontSize: 14,
              fontWeight: '600',
              color: palette.white,
            }}
          >
            {formatCurrency(focusedCategory.total)}
          </Text>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontSize: 11,
              fontWeight: '600',
              color: palette.neutral400,
              marginTop: 2,
            }}
          >
            {pct}%
          </Text>
        </View>
      );
    }

    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-SemiBold',
            fontSize: 16,
            fontWeight: '600',
            color: palette.white,
          }}
        >
          {formatCurrency(totalAmount)}
        </Text>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-SemiBold',
            fontSize: 10,
            fontWeight: '600',
            color: palette.neutral500,
            marginTop: 2,
          }}
        >
          Total
        </Text>
      </View>
    );
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <PieChart
        data={pieData}
        donut
        radius={80}
        innerRadius={52}
        centerLabelComponent={centerLabel}
        focusOnPress
        isAnimated
        animationDuration={300}
        innerCircleColor={palette.neutral800}
      />
    </View>
  );
});
