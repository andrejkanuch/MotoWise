import { palette } from '@motovault/design-system';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { CATEGORY_COLORS, CATEGORY_LABELS, formatCurrency } from '../../lib/expense-constants';

interface CategoryDonutProps {
  categoryTotals: Array<{ category: string; total: number }>;
  totalAmount: number;
  isDark: boolean;
}

export const CategoryDonut = memo(function CategoryDonut({
  categoryTotals,
  totalAmount,
  isDark,
}: CategoryDonutProps) {
  const textColor = isDark ? palette.white : palette.neutral950;
  const bgColor = isDark ? palette.neutral900 : palette.neutral50;
  const separatorColor = isDark ? palette.neutral700 : palette.neutral200;

  // Sort by largest share first
  const sorted = useMemo(
    () => [...categoryTotals].sort((a, b) => b.total - a.total),
    [categoryTotals],
  );

  if (sorted.length === 0 || totalAmount === 0) return null;

  // Compute percentages for bar segments
  const segments = sorted.map((cat) => ({
    category: cat.category,
    total: cat.total,
    pct: (cat.total / totalAmount) * 100,
    color: CATEGORY_COLORS[cat.category] ?? palette.neutral400,
  }));

  // Count expenses per category — we only have totals, so show amount-based info
  return (
    <View>
      {/* Proportional bar */}
      <View
        style={{
          flexDirection: 'row',
          height: 8,
          borderRadius: 4,
          borderCurve: 'continuous',
          overflow: 'hidden',
          gap: 2,
          backgroundColor: bgColor,
        }}
      >
        {segments.map((seg) => (
          <View
            key={seg.category}
            style={{
              flex: seg.pct,
              backgroundColor: seg.color,
              borderRadius: 4,
              borderCurve: 'continuous',
            }}
          />
        ))}
      </View>

      {/* Category rows */}
      <View style={{ marginTop: 16 }}>
        {sorted.map((cat, index) => {
          const pct = totalAmount > 0 ? ((cat.total / totalAmount) * 100).toFixed(0) : '0';
          const color = CATEGORY_COLORS[cat.category] ?? palette.neutral400;
          const label = CATEGORY_LABELS[cat.category] ?? cat.category;

          return (
            <View key={cat.category}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 56,
                }}
              >
                {/* Color indicator bar */}
                <View
                  style={{
                    width: 4,
                    height: 32,
                    borderRadius: 2,
                    borderCurve: 'continuous',
                    backgroundColor: color,
                  }}
                />

                {/* Category info */}
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-Medium',
                      fontSize: 15,
                      color: textColor,
                    }}
                  >
                    {label}
                  </Text>
                </View>

                {/* Amount + percentage */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-SemiBold',
                      fontSize: 16,
                      color: textColor,
                    }}
                  >
                    {formatCurrency(cat.total)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-Regular',
                      fontSize: 13,
                      color: palette.neutral500,
                      marginTop: 1,
                    }}
                  >
                    {pct}%
                  </Text>
                </View>
              </View>

              {/* Separator */}
              {index < sorted.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: separatorColor,
                    marginLeft: 40,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});
