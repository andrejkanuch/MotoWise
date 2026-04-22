import { palette } from '@motovault/design-system';
import {
  ExpensesByMotorcycleDocument,
  type ExpensesByMotorcycleQuery,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3, Info, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CategoryDonut } from '../../../components/expense-dashboard/category-donut';
import { MonthlyTrend } from '../../../components/expense-dashboard/monthly-trend';
import { SummaryCards } from '../../../components/expense-dashboard/summary-cards';
import { useCurrency } from '../../../hooks/use-currency';
import {
  PERIOD_OPTIONS,
  type Period,
  useDashboardData,
  useExpenseDashboard,
} from '../../../hooks/use-expense-dashboard';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const PERIOD_LABELS: Record<Period, string> = {
  thisYear: 'This Year',
  lastYear: 'Last Year',
  allTime: 'All Time',
};

function EmptyState({
  bgColor,
  textColor,
  subtextColor,
  copperColor,
  motorcycleId,
}: {
  bgColor: string;
  textColor: string;
  subtextColor: string;
  copperColor: string;
  motorcycleId: string;
}) {
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: bgColor,
      }}
    >
      <Animated.View entering={FadeIn.delay(100).duration(400)}>
        <BarChart3 size={48} color={subtextColor} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(200).duration(300)}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-SemiBold',
            fontWeight: '600',
            fontSize: 20,
            color: textColor,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          No expenses yet
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(280).duration(300)}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontWeight: '400',
            fontSize: 14,
            color: subtextColor,
            marginTop: 8,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          Track fuel, maintenance, parts, and gear costs.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(360).duration(300)} style={ctaAnimatedStyle}>
        <Pressable
          onPressIn={() => {
            ctaScale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
          }}
          onPressOut={() => {
            ctaScale.value = withSpring(1, { damping: 15, stiffness: 150 });
          }}
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            router.push({
              pathname: '/(tabs)/(garage)/add-expense',
              params: { motorcycleId },
            });
          }}
          accessibilityLabel="Add your first expense"
          accessibilityRole="button"
          style={{
            backgroundColor: copperColor,
            paddingHorizontal: 32,
            height: 48,
            borderRadius: 24,
            borderCurve: 'continuous',
            marginTop: 24,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontWeight: '600',
              fontSize: 16,
              color: palette.white,
            }}
          >
            Add First Expense
          </Text>
        </Pressable>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(500).duration(300)}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontWeight: '400',
            fontSize: 12,
            color: palette.neutral500,
            fontStyle: 'italic',
            marginTop: 12,
          }}
        >
          Tip: Start with your last fill-up
        </Text>
      </Animated.View>
    </View>
  );
}

export default function ExpenseDashboardScreen() {
  const { motorcycleId, currentMileage, mileageUnit } = useLocalSearchParams<{
    motorcycleId: string;
    currentMileage?: string;
    mileageUnit?: string;
  }>();

  const [period, setPeriod] = useState<Period>('thisYear');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const isDark = useColorScheme() === 'dark';
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const { dashboard, isPending, isError, refetch } = useExpenseDashboard(motorcycleId);
  const { filteredBuckets, periodTotal, categoryTotals } = useDashboardData(dashboard, period);

  useEffect(() => {
    trackEvent(AnalyticsEvent.EXPENSE_DASHBOARD_VIEWED);
  }, []);

  // Fetch bike data for purchase price (uses existing cache from garage tab)
  const { data: bikesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    staleTime: 5 * 60 * 1000,
  });
  const bike = (bikesData?.myMotorcycles ?? []).find((m: { id: string }) => m.id === motorcycleId);
  const purchasePrice = bike?.purchasePrice as number | null | undefined;

  // Fetch individual expenses for category drill-down
  const { data: expensesData } = useQuery({
    queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId, year: 0 }),
    enabled: !!motorcycleId,
    staleTime: 5 * 60 * 1000,
  });

  const categoryExpenses = useMemo(() => {
    if (!selectedCategory || !expensesData) return [];
    const data = expensesData as ExpensesByMotorcycleQuery;
    const cat = data.expenses?.categories?.find((c) => c.category === selectedCategory);
    return cat?.expenses ?? [];
  }, [selectedCategory, expensesData]);

  const handleCategoryPress = useCallback((category: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory((prev) => (prev === category ? null : category));
  }, []);

  const handlePeriodChange = (newPeriod: Period) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.selectionAsync();
    }
    setPeriod(newPeriod);
  };

  const onRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.motorcycles.all,
          refetchType: 'active',
        }),
      ]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [queryClient, motorcycleId]);

  // Theme colors
  const bgColor = isDark ? palette.neutral900 : palette.neutral50;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtextColor = isDark ? palette.neutral400 : palette.neutral500;
  const tertiaryColor = palette.neutral500;
  const pillBg = isDark ? palette.neutral800 : palette.neutral200;
  const pillActiveBg = isDark ? palette.neutral700 : palette.white;
  const pillActiveText = isDark ? palette.white : palette.neutral950;
  const pillInactiveText = isDark ? palette.neutral400 : palette.neutral500;
  const copperColor = isDark ? palette.signature500 : palette.signature400;

  if (isPending) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: bgColor,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  if (isError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
          backgroundColor: bgColor,
        }}
      >
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-SemiBold',
            fontWeight: '600',
            fontSize: 16,
            color: subtextColor,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Failed to load expense data
        </Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityLabel="Retry loading expense data"
          accessibilityRole="button"
          style={{
            backgroundColor: palette.primary500,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            borderCurve: 'continuous',
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontWeight: '600',
              fontSize: 14,
              color: palette.white,
            }}
          >
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  // Empty state
  if (!dashboard || dashboard.expenseCount === 0) {
    return (
      <EmptyState
        bgColor={bgColor}
        textColor={textColor}
        subtextColor={subtextColor}
        copperColor={copperColor}
        motorcycleId={motorcycleId}
      />
    );
  }

  const mileageNum = currentMileage ? Number(currentMileage) : null;

  const monthsInPeriod = (() => {
    if (filteredBuckets.length === 0) return 1;
    const nonZero = filteredBuckets.filter((b) => b.total > 0);
    return Math.max(nonZero.length, 1);
  })();
  const avgPerMonth = monthsInPeriod > 0 ? periodTotal / monthsInPeriod : 0;

  const topCategory =
    categoryTotals.length > 0
      ? categoryTotals.reduce((a, b) => (b.total > a.total ? b : a), categoryTotals[0])
      : null;
  const topCategoryPct =
    topCategory && periodTotal > 0 ? ((topCategory.total / periodTotal) * 100).toFixed(0) : null;

  const previousYearTotal = dashboard.previousYearTotal;
  const yoyChange =
    previousYearTotal > 0 ? ((periodTotal - previousYearTotal) / previousYearTotal) * 100 : null;

  const costPerUnit =
    mileageNum != null && mileageNum > 0 ? dashboard.allTimeTotal / mileageNum : null;
  const unitLabel = mileageUnit === 'km' ? 'COST/KM' : 'COST/MI';

  const periodContextLabel =
    period === 'thisYear'
      ? 'Total spent this year'
      : period === 'lastYear'
        ? 'Total spent last year'
        : 'Total spent all time';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 100,
        // headerTransparent: true doesn't auto-inset on Android
        ...(process.env.EXPO_OS === 'android' && { paddingTop: 56 }),
      }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? palette.white : palette.primary500}
        />
      }
    >
      {/* Period Selector */}
      <Animated.View entering={FadeInUp.duration(300)} style={{ marginTop: 16 }}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Expense period selector"
          style={{
            flexDirection: 'row',
            backgroundColor: pillBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            padding: 4,
          }}
        >
          {PERIOD_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => handlePeriodChange(option)}
              accessibilityLabel={`Show ${PERIOD_LABELS[option]} expenses`}
              accessibilityRole="button"
              accessibilityState={{ selected: period === option }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                borderCurve: 'continuous',
                backgroundColor: period === option ? pillActiveBg : 'transparent',
                alignItems: 'center',
                ...(period === option && !isDark
                  ? {
                      shadowColor: palette.black,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                    }
                  : {}),
              }}
            >
              <Text
                style={{
                  fontFamily:
                    period === option ? 'PlusJakartaSans-SemiBold' : 'PlusJakartaSans-Medium',
                  fontWeight: period === option ? '600' : '500',
                  fontSize: 14,
                  color: period === option ? pillActiveText : pillInactiveText,
                }}
              >
                {PERIOD_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Hero Area */}
      <Animated.View entering={FadeInUp.delay(60).duration(300)} style={{ marginTop: 24 }}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontWeight: '400',
            fontSize: 14,
            color: subtextColor,
          }}
        >
          {periodContextLabel}
        </Text>

        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          accessibilityLabel={`Total: ${formatCurrency(periodTotal)}`}
          style={{
            fontFamily: 'PlusJakartaSans-Bold',
            fontWeight: '700',
            fontSize: 44,
            color: textColor,
            letterSpacing: -1.5,
            marginTop: 4,
          }}
        >
          {formatCurrency(periodTotal)}
        </Text>

        {period === 'thisYear' && yoyChange !== null && previousYearTotal > 0 && (
          <Text
            accessibilityLabel={`${yoyChange <= 0 ? 'Down' : 'Up'} ${Math.abs(yoyChange).toFixed(0)} percent versus last year`}
            style={{
              fontFamily: 'PlusJakartaSans-Medium',
              fontWeight: '500',
              fontSize: 14,
              color: yoyChange <= 0 ? palette.success500 : palette.warning500,
              marginTop: 4,
            }}
          >
            {yoyChange <= 0 ? '\u2193' : '\u2191'} {Math.abs(yoyChange).toFixed(0)}% vs last year
          </Text>
        )}

        {topCategory && topCategory.total > 0 && (
          <View
            accessibilityLabel={`Top category: ${CATEGORY_LABELS[topCategory.category] ?? topCategory.category}, ${formatCurrency(topCategory.total)}${topCategoryPct ? `, ${topCategoryPct} percent` : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingHorizontal: 12,
              paddingVertical: 8,
              alignSelf: 'flex-start',
              marginTop: 20,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: CATEGORY_COLORS[topCategory.category] ?? palette.neutral400,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'PlusJakartaSans-Medium',
                fontWeight: '500',
                fontSize: 12,
                color: subtextColor,
                marginLeft: 4,
                flexShrink: 1,
              }}
            >
              {CATEGORY_LABELS[topCategory.category] ?? topCategory.category}
            </Text>
            <Text
              style={{
                fontFamily: 'PlusJakartaSans-SemiBold',
                fontWeight: '600',
                fontSize: 12,
                color: textColor,
                marginLeft: 4,
              }}
            >
              {formatCurrency(topCategory.total)}
            </Text>
            {topCategoryPct && (
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans-Regular',
                  fontWeight: '400',
                  fontSize: 12,
                  color: tertiaryColor,
                  marginLeft: 4,
                }}
              >
                {topCategoryPct}%
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* Purchase Price / Total Cost of Ownership */}
      {purchasePrice != null && purchasePrice > 0 ? (
        <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ marginTop: 20 }}>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: subtextColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Total Cost of Ownership
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: textColor,
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.5,
              }}
            >
              {formatCurrency(purchasePrice + dashboard.allTimeTotal)}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '500', color: subtextColor }}>
                  Bike Purchase
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: textColor,
                    fontVariant: ['tabular-nums'],
                    marginTop: 2,
                  }}
                >
                  {formatCurrency(purchasePrice)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '500', color: subtextColor }}>
                  All Expenses
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: textColor,
                    fontVariant: ['tabular-nums'],
                    marginTop: 2,
                  }}
                >
                  {formatCurrency(dashboard.allTimeTotal)}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ marginTop: 20 }}>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/(tabs)/(garage)/edit-bike',
                params: { id: motorcycleId },
              });
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? `${palette.primary500}15` : `${palette.primary500}08`,
              borderRadius: 12,
              borderCurve: 'continuous',
              padding: 14,
              gap: 10,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Info size={18} color={palette.primary500} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '500',
                color: isDark ? palette.primary400 : palette.primary600,
              }}
            >
              Add your bike's purchase price in Edit Bike to see total cost of ownership
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Summary Metric Pills */}
      <Animated.View entering={FadeInUp.delay(140).duration(300)} style={{ marginTop: 16 }}>
        <SummaryCards
          avgPerMonth={avgPerMonth}
          expenseCount={dashboard.expenseCount}
          costPerUnit={costPerUnit}
          unitLabel={unitLabel}
          isDark={isDark}
        />
      </Animated.View>

      {/* Category Breakdown — card treatment for visual separation from hero */}
      <Animated.View entering={FadeInUp.delay(180).duration(300)} style={{ marginTop: 32 }}>
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
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
              color: textColor,
              marginBottom: 16,
            }}
          >
            By Category
          </Text>
          <CategoryDonut
            categoryTotals={categoryTotals}
            totalAmount={periodTotal}
            isDark={isDark}
            selectedCategory={selectedCategory}
            onCategoryPress={handleCategoryPress}
          />
        </View>
      </Animated.View>

      {/* Category Expense List (drill-down) */}
      {selectedCategory && categoryExpenses.length > 0 && (
        <Animated.View entering={FadeInUp.duration(250)} style={{ marginTop: 16 }}>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: CATEGORY_COLORS[selectedCategory] ?? palette.neutral400,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontWeight: '600',
                  fontSize: 16,
                  color: textColor,
                  flex: 1,
                }}
              >
                {CATEGORY_LABELS[selectedCategory] ?? selectedCategory} ({categoryExpenses.length})
              </Text>
              <Pressable
                onPress={() => setSelectedCategory(null)}
                hitSlop={12}
                accessibilityLabel="Close expense list"
              >
                <X size={18} color={subtextColor} />
              </Pressable>
            </View>

            {categoryExpenses.map((expense, index) => (
              <View key={expense.id}>
                {index > 0 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: isDark ? palette.neutral700 : palette.neutral200,
                      marginVertical: 1,
                    }}
                  />
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: 'PlusJakartaSans-Medium',
                        fontWeight: '500',
                        fontSize: 14,
                        color: textColor,
                      }}
                    >
                      {expense.description ||
                        (CATEGORY_LABELS[expense.category] ?? expense.category)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'PlusJakartaSans-Regular',
                        fontWeight: '400',
                        fontSize: 12,
                        color: subtextColor,
                        marginTop: 2,
                      }}
                    >
                      {new Date(expense.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-SemiBold',
                      fontWeight: '600',
                      fontSize: 15,
                      color: textColor,
                      marginLeft: 12,
                    }}
                  >
                    {formatCurrency(expense.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Monthly Trend */}
      <Animated.View entering={FadeInUp.delay(240).duration(300)} style={{ marginTop: 16 }}>
        <MonthlyTrend buckets={filteredBuckets} isDark={isDark} />
      </Animated.View>
    </ScrollView>
  );
}
