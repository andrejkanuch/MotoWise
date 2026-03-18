import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { DollarSign } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useDashboardData, useExpenseDashboard } from '../../hooks/use-expense-dashboard';
import { CardWrapper } from './card-wrapper';
import { SectionHeader } from './section-header';

interface Motorcycle {
  id: string;
  make: string;
  model: string;
  nickname?: string | null;
  isPrimary: boolean;
}

interface ExpenseSummaryWidgetProps {
  isDark: boolean;
  motorcycles: Motorcycle[];
  onViewDetails: (motorcycleId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  fuel: palette.primary500,
  maintenance: palette.success500,
  parts: palette.warning500,
  gear: palette.signature400,
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getBikeName(bike: Motorcycle): string {
  return bike.nickname ?? `${bike.make} ${bike.model}`;
}

export function ExpenseSummaryWidget({
  isDark,
  motorcycles,
  onViewDetails,
}: ExpenseSummaryWidgetProps) {
  const primaryBike = motorcycles.find((b) => b.isPrimary) ?? motorcycles[0];
  const isMultiBike = motorcycles.length > 1;

  return (
    <Animated.View entering={FadeInUp.delay(250).duration(300)}>
      <SectionHeader
        icon={DollarSign}
        iconColor={palette.signature400}
        title="Expenses" // TODO: i18n
        isDark={isDark}
      />

      {motorcycles.length === 0 ? (
        <EmptyExpenseCard isDark={isDark} />
      ) : isMultiBike ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {motorcycles.map((bike) => (
            <BikeExpenseCard
              key={bike.id}
              bike={bike}
              isDark={isDark}
              onPress={() => onViewDetails(bike.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <SingleBikeExpenseContent
          isDark={isDark}
          motorcycleId={primaryBike.id}
          onViewDetails={() => onViewDetails(primaryBike.id)}
        />
      )}
    </Animated.View>
  );
}

/** Compact expense card for multi-bike horizontal scroll */
function BikeExpenseCard({
  bike,
  isDark,
  onPress,
}: {
  bike: Motorcycle;
  isDark: boolean;
  onPress: () => void;
}) {
  const { dashboard, isPending } = useExpenseDashboard(bike.id);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const monthBucket = dashboard?.monthlyBuckets.find(
    (b) => b.month === currentMonth && b.year === currentYear,
  );
  const monthlyTotal = monthBucket?.total ?? 0;
  const hasData = dashboard && dashboard.expenseCount > 0;

  return (
    <CardWrapper tier="medium" style={{ width: 160 }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${getBikeName(bike)} expenses: ${hasData ? formatCurrency(monthlyTotal) : 'no data'}`}
        style={({ pressed }) => ({
          padding: 14,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? palette.neutral300 : palette.neutral600,
            marginBottom: 6,
          }}
        >
          {getBikeName(bike)}
        </Text>
        {isPending ? (
          <ActivityIndicator size="small" color={palette.neutral400} />
        ) : hasData ? (
          <>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: isDark ? palette.neutral50 : palette.neutral950,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatCurrency(monthlyTotal)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: palette.neutral500,
                fontWeight: '500',
                marginTop: 2,
              }}
            >
              this month{/* TODO: i18n */}
            </Text>
          </>
        ) : (
          <Text
            style={{
              fontSize: 13,
              color: palette.neutral400,
              fontWeight: '500',
            }}
          >
            No expenses{/* TODO: i18n */}
          </Text>
        )}
      </Pressable>
    </CardWrapper>
  );
}

function EmptyExpenseCard({ isDark }: { isDark: boolean }) {
  return (
    <CardWrapper
      tier="subtle"
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: isDark ? palette.neutral700 : palette.neutral200,
      }}
    >
      <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
        <DollarSign size={36} color={palette.neutral400} strokeWidth={1.5} />
        <Text
          style={{
            fontSize: 14,
            color: isDark ? palette.neutral300 : palette.neutral700,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          Track your riding costs{/* TODO: i18n */}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: palette.neutral500,
            fontWeight: '500',
            textAlign: 'center',
          }}
        >
          Log fuel, parts, and maintenance{/* TODO: i18n */}
        </Text>
      </View>
    </CardWrapper>
  );
}

/** Full expense breakdown for single-bike users */
function SingleBikeExpenseContent({
  isDark,
  motorcycleId,
  onViewDetails,
}: {
  isDark: boolean;
  motorcycleId: string;
  onViewDetails: () => void;
}) {
  const { dashboard, isPending } = useExpenseDashboard(motorcycleId);
  const { periodTotal, categoryTotals } = useDashboardData(dashboard, 'thisYear');

  if (isPending) {
    return (
      <CardWrapper tier="subtle">
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={palette.primary500} />
        </View>
      </CardWrapper>
    );
  }

  if (!dashboard || dashboard.expenseCount === 0) {
    return <EmptyExpenseCard isDark={isDark} />;
  }

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentMonthBucket = dashboard.monthlyBuckets.find(
    (b) => b.month === currentMonth && b.year === currentYear,
  );
  const previousMonthBucket = dashboard.monthlyBuckets.find((b) =>
    currentMonth === 1
      ? b.month === 12 && b.year === currentYear - 1
      : b.month === currentMonth - 1 && b.year === currentYear,
  );

  const monthlyTotal = currentMonthBucket?.total ?? 0;
  const prevMonthTotal = previousMonthBucket?.total ?? 0;
  const pctChange =
    prevMonthTotal > 0 ? ((monthlyTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
  const isUp = pctChange > 0;

  const topCategories = [...categoryTotals].sort((a, b) => b.total - a.total).slice(0, 3);
  const maxCategoryTotal = topCategories.length > 0 ? topCategories[0].total : 1;

  return (
    <CardWrapper tier="medium">
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onViewDetails();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Monthly expenses: ${formatCurrency(monthlyTotal)}`}
        style={({ pressed }) => ({
          padding: 16,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCurrency(monthlyTotal)}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: palette.neutral500 }}>
            this month{/* TODO: i18n */}
          </Text>
        </View>

        {prevMonthTotal > 0 && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: isUp ? palette.warning500 : palette.success500,
              marginBottom: 12,
            }}
          >
            {isUp ? '+' : ''}
            {pctChange.toFixed(0)}% vs last month{/* TODO: i18n */}
          </Text>
        )}

        {topCategories.length > 0 && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {topCategories.map((cat) => (
              <View key={cat.category}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: palette.neutral500,
                      textTransform: 'capitalize',
                    }}
                  >
                    {cat.category}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: isDark ? palette.neutral300 : palette.neutral700,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatCurrency(cat.total)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    borderCurve: 'continuous',
                    backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${(cat.total / maxCategoryTotal) * 100}%`,
                      height: '100%',
                      borderRadius: 2,
                      borderCurve: 'continuous',
                      backgroundColor: CATEGORY_COLORS[cat.category] ?? palette.neutral400,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 12, fontWeight: '500', color: palette.neutral500 }}>
            YTD: {formatCurrency(periodTotal)}
            {/* TODO: i18n */}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary500 }}>
            View Details{/* TODO: i18n */}
          </Text>
        </View>
      </Pressable>
    </CardWrapper>
  );
}
