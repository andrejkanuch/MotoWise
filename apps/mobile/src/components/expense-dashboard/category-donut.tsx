import type { Currency } from '@motovault/types';
import { ChevronRight } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CATEGORY_COLORS, CATEGORY_LABELS, formatMoney } from '../../lib/expense-constants';
import { useEditorialTheme } from '../../theme/editorial';

const MIN_SEGMENT_FLEX = 2;

interface CategoryDonutProps {
  categoryTotals: Array<{ category: string; total: number }>;
  totalAmount: number;
  /** Currency for these server-summed category totals (dominant currency of the
   *  bike's expenses — see expense-dashboard). No FX, so one currency is assumed. */
  currency: Currency;
  isDark: boolean;
  selectedCategory?: string | null;
  onCategoryPress?: (category: string) => void;
}

export const CategoryDonut = memo(function CategoryDonut({
  categoryTotals,
  totalAmount,
  currency,
  selectedCategory,
  onCategoryPress,
}: CategoryDonutProps) {
  const { t: theme } = useEditorialTheme();

  const sorted = useMemo(
    () => [...categoryTotals].sort((a, b) => b.total - a.total),
    [categoryTotals],
  );

  if (sorted.length === 0 || totalAmount <= 0) return null;

  const segments = sorted.map((cat) => {
    const rawPct = (cat.total / totalAmount) * 100;
    return {
      category: cat.category,
      total: cat.total,
      pct: rawPct,
      flex: Math.max(rawPct, MIN_SEGMENT_FLEX),
      color: CATEGORY_COLORS[cat.category] ?? theme.ink3,
    };
  });

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
          backgroundColor: theme.surface2,
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
          const color = CATEGORY_COLORS[cat.category] ?? theme.ink3;
          const label = CATEGORY_LABELS[cat.category] ?? cat.category;
          const isSelected = selectedCategory === cat.category;

          return (
            <View key={cat.category}>
              <Pressable
                onPress={() => onCategoryPress?.(cat.category)}
                accessibilityLabel={`${label}: ${formatMoney(cat.total, currency)}, ${pct} percent. Tap to view expenses.`}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 52,
                  backgroundColor: isSelected
                    ? `${color}12`
                    : pressed
                      ? `${theme.ink}06`
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
                    height: 28,
                    borderRadius: 2,
                    borderCurve: 'continuous',
                    backgroundColor: color,
                  }}
                />

                {/* Category info */}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: theme.ink,
                    }}
                  >
                    {label}
                  </Text>
                </View>

                {/* Amount + percentage */}
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 16,
                    color: theme.ink,
                    marginLeft: 8,
                  }}
                >
                  {formatMoney(cat.total, currency)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.ink3,
                    marginLeft: 8,
                    minWidth: 32,
                    textAlign: 'right',
                  }}
                >
                  {pct}%
                </Text>
                <ChevronRight size={14} color={theme.ink3} style={{ marginLeft: 4 }} />
              </Pressable>

              {/* Separator */}
              {index < sorted.length - 1 && (
                <View
                  style={{
                    height: 0.5,
                    backgroundColor: theme.line,
                    marginLeft: 22,
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
