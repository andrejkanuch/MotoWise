import { palette } from '@motovault/design-system';
import { ChevronRight } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCurrency } from '../../hooks/use-currency';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/expense-constants';

const MIN_SEGMENT_FLEX = 2;

interface CategoryDonutProps {
  categoryTotals: Array<{ category: string; total: number }>;
  totalAmount: number;
  isDark: boolean;
  selectedCategory?: string | null;
  onCategoryPress?: (category: string) => void;
}

export const CategoryDonut = memo(function CategoryDonut({
  categoryTotals,
  totalAmount,
  isDark,
  selectedCategory,
  onCategoryPress,
}: CategoryDonutProps) {
  const { format: formatCurrency } = useCurrency();
  const textColor = isDark ? palette.white : palette.neutral950;
  const bgColor = isDark ? palette.neutral900 : palette.neutral50;
  const separatorColor = isDark ? palette.neutral700 : palette.neutral200;

  // Sort by largest share first
  const sorted = useMemo(
    () => [...categoryTotals].sort((a, b) => b.total - a.total),
    [categoryTotals],
  );

  if (sorted.length === 0 || totalAmount <= 0) return null;

  // Compute percentages for bar segments — enforce minimum flex for visibility
  const segments = sorted.map((cat) => {
    const rawPct = (cat.total / totalAmount) * 100;
    return {
      category: cat.category,
      total: cat.total,
      pct: rawPct,
      flex: Math.max(rawPct, MIN_SEGMENT_FLEX),
      color: CATEGORY_COLORS[cat.category] ?? palette.neutral400,
    };
  });

  // Build accessibility description for the proportional bar
  const barDescription = segments
    .map((seg) => `${CATEGORY_LABELS[seg.category] ?? seg.category}: ${seg.pct.toFixed(0)}%`)
    .join(', ');

  return (
    <View>
      {/* Proportional bar */}
      <View
        accessibilityLabel={`Expense breakdown: ${barDescription}`}
        accessibilityRole="summary"
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
              flex: seg.flex,
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

          const isSelected = selectedCategory === cat.category;
          return (
            <View key={cat.category}>
              <Pressable
                onPress={() => onCategoryPress?.(cat.category)}
                accessibilityLabel={`${label}: ${formatCurrency(cat.total)}, ${pct} percent. Tap to view expenses.`}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 56,
                  backgroundColor: isSelected
                    ? `${color}12`
                    : pressed
                      ? isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.03)'
                      : 'transparent',
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  paddingHorizontal: 4,
                  marginHorizontal: -4,
                })}
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
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontFamily: 'PlusJakartaSans-Medium',
                      fontWeight: '500',
                      fontSize: 16,
                      color: textColor,
                    }}
                  >
                    {label}
                  </Text>
                </View>

                {/* Amount + percentage */}
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-SemiBold',
                      fontWeight: '600',
                      fontSize: 16,
                      color: textColor,
                    }}
                  >
                    {formatCurrency(cat.total)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-Regular',
                      fontWeight: '400',
                      fontSize: 12,
                      color: palette.neutral500,
                      marginTop: 2,
                    }}
                  >
                    {pct}%
                  </Text>
                </View>
                <ChevronRight
                  size={16}
                  color={isDark ? palette.neutral600 : palette.neutral400}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>

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
