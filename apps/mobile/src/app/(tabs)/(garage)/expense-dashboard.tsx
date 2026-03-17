import { palette } from '@motovault/design-system';
import { DeleteExpenseDocument, ExpensesByMotorcycleDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CategoryDonut } from '../../../components/expense-dashboard/category-donut';
import { MonthlyTrend } from '../../../components/expense-dashboard/monthly-trend';
import { SummaryCards } from '../../../components/expense-dashboard/summary-cards';
import { SwipeableExpense } from '../../../components/shared/swipeable-expense';
import {
  PERIOD_OPTIONS,
  type Period,
  useDashboardData,
  useExpenseDashboard,
} from '../../../hooks/use-expense-dashboard';
import { CATEGORY_COLORS, CATEGORY_LABELS, formatCurrency } from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const PERIOD_LABELS: Record<Period, string> = {
  thisYear: 'This Year',
  lastYear: 'Last Year',
  allTime: 'All Time',
};

const PERIOD_CONTEXT_LABELS: Record<Period, string> = {
  thisYear: 'Total spent this year',
  lastYear: 'Total spent last year',
  allTime: 'Total spent all time',
};

export default function ExpenseDashboardScreen() {
  const { motorcycleId, currentMileage, mileageUnit } = useLocalSearchParams<{
    motorcycleId: string;
    currentMileage?: string;
    mileageUnit?: string;
  }>();

  const [period, setPeriod] = useState<Period>('thisYear');
  const queryClient = useQueryClient();
  const isDark = useColorScheme() === 'dark';

  const { dashboard, isPending, isError, refetch } = useExpenseDashboard(motorcycleId);
  const { filteredBuckets, periodTotal, categoryTotals } = useDashboardData(dashboard, period);

  const { data: expensesData } = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(motorcycleId), 0],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId, year: 0 }),
    staleTime: 5 * 60 * 1000,
  });

  const recentExpenses = useMemo(() => {
    if (!expensesData?.expenses?.categories) return [];
    return expensesData.expenses.categories
      .flatMap((cat) => cat.expenses)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [expensesData]);

  const periodExpenseCount = dashboard?.expenseCount ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlFetcher(DeleteExpenseDocument, { id }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete expense.');
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handlePeriodChange = (newPeriod: Period) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.selectionAsync();
    }
    setPeriod(newPeriod);
  };

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

  // Loading state
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

  // Error state
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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
          backgroundColor: bgColor,
        }}
      >
        <BarChart3 size={48} color={subtextColor} />
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
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/(garage)/add-expense',
              params: { motorcycleId },
            })
          }
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
      </View>
    );
  }

  const mileageNum = currentMileage ? Number(currentMileage) : null;

  // Compute months in period for avg/mo — guard against 0-division
  const monthsInPeriod = (() => {
    if (filteredBuckets.length === 0) return 1;
    const nonZero = filteredBuckets.filter((b) => b.total > 0);
    return Math.max(nonZero.length, 1);
  })();

  const avgPerMonth = monthsInPeriod > 0 ? periodTotal / monthsInPeriod : 0;

  // Top category
  const topCategory =
    categoryTotals.length > 0
      ? categoryTotals.reduce((a, b) => (b.total > a.total ? b : a), categoryTotals[0])
      : null;

  const topCategoryPct =
    topCategory && periodTotal > 0 ? ((topCategory.total / periodTotal) * 100).toFixed(0) : null;

  // YoY comparison
  const previousYearTotal = dashboard.previousYearTotal;
  const yoyChange =
    previousYearTotal > 0 ? ((periodTotal - previousYearTotal) / previousYearTotal) * 100 : null;

  const costPerUnit =
    mileageNum != null && mileageNum > 0 ? dashboard.allTimeTotal / mileageNum : null;
  const unitLabel = mileageUnit === 'km' ? 'COST/KM' : 'COST/MI';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Act 1: Period Selector */}
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

      {/* Act 1: Hero Area */}
      <Animated.View entering={FadeInUp.delay(60).duration(300)} style={{ marginTop: 24 }}>
        {/* Contextual label */}
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontWeight: '400',
            fontSize: 14,
            color: subtextColor,
          }}
        >
          {PERIOD_CONTEXT_LABELS[period]}
        </Text>

        {/* Hero amount */}
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

        {/* YoY comparison — only for thisYear when previous year has data */}
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

        {/* Top category capsule */}
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

      {/* Act 1: Summary Metric Pills */}
      <Animated.View entering={FadeInUp.delay(120).duration(300)} style={{ marginTop: 24 }}>
        <SummaryCards
          avgPerMonth={avgPerMonth}
          expenseCount={periodExpenseCount}
          costPerUnit={costPerUnit}
          unitLabel={unitLabel}
          isDark={isDark}
        />
      </Animated.View>

      {/* Act 2: Category Breakdown */}
      <Animated.View entering={FadeInUp.delay(180).duration(300)} style={{ marginTop: 32 }}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-SemiBold',
            fontWeight: '600',
            fontSize: 20,
            color: textColor,
            marginBottom: 16,
          }}
        >
          By Category
        </Text>
        <CategoryDonut categoryTotals={categoryTotals} totalAmount={periodTotal} isDark={isDark} />
      </Animated.View>

      {/* Act 3: Monthly Trend */}
      <Animated.View entering={FadeInUp.delay(240).duration(300)} style={{ marginTop: 32 }}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-SemiBold',
            fontWeight: '600',
            fontSize: 20,
            color: textColor,
            marginBottom: 16,
          }}
        >
          Monthly Trend
        </Text>
        <MonthlyTrend buckets={filteredBuckets} isDark={isDark} />
      </Animated.View>

      {/* Act 3: Recent Expenses */}
      <Animated.View entering={FadeInUp.delay(300).duration(300)} style={{ marginTop: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontWeight: '600',
              fontSize: 20,
              color: textColor,
            }}
          >
            Recent
          </Text>
          {recentExpenses.length > 0 && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: { id: motorcycleId },
                })
              }
              accessibilityLabel="See all expenses"
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontWeight: '600',
                  fontSize: 14,
                  color: copperColor,
                }}
              >
                See All
              </Text>
            </Pressable>
          )}
        </View>

        {recentExpenses.length === 0 ? (
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-Regular',
              fontWeight: '400',
              fontSize: 12,
              color: subtextColor,
              textAlign: 'center',
              padding: 20,
            }}
          >
            No recent expenses
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {recentExpenses.map((expense, index) => (
              <Animated.View
                key={expense.id}
                entering={FadeInUp.delay(300 + index * 50).duration(250)}
              >
                <SwipeableExpense
                  expense={expense}
                  isDark={isDark}
                  index={index}
                  onDelete={handleDelete}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}
