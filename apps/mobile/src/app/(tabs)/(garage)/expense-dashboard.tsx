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
import { CATEGORY_COLORS, formatCurrency } from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const PERIOD_LABELS: Record<Period, string> = {
  thisYear: 'This Year',
  lastYear: 'Last Year',
  allTime: 'All Time',
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

  // Fetch recent expenses for the list (reuse existing query with year=0 for all)
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
      .slice(0, 10);
  }, [expensesData]);

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

  // SwipeableExpense already shows a confirmation dialog, so just call mutate directly
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handlePeriodChange = (newPeriod: Period) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.selectionAsync();
    }
    setPeriod(newPeriod);
  };

  // Theme-aware colors
  const bgColor = isDark ? palette.neutral900 : palette.neutral50;
  const cardBg = isDark ? palette.neutral800 : palette.white;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtextColor = isDark ? palette.neutral400 : palette.neutral500;
  const pillBg = isDark ? palette.neutral800 : palette.neutral200;
  const pillActiveBg = isDark ? palette.neutral700 : palette.white;
  const pillActiveText = isDark ? palette.white : palette.neutral950;
  const pillInactiveText = isDark ? palette.neutral400 : palette.neutral500;
  const legendAmountColor = isDark ? palette.neutral300 : palette.neutral600;

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
          style={{
            backgroundColor: palette.primary500,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 10,
            borderCurve: 'continuous',
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
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
            fontFamily: 'PlusJakartaSans-Bold',
            fontSize: 18,
            color: textColor,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          No Expenses Yet
        </Text>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontSize: 14,
            color: subtextColor,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Log your first expense to unlock spending insights, trends, and cost-per-mile tracking.
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/(garage)/add-expense',
              params: { motorcycleId },
            })
          }
          style={{
            backgroundColor: palette.primary500,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 10,
            borderCurve: 'continuous',
            marginTop: 20,
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans-SemiBold',
              fontSize: 14,
              color: palette.white,
            }}
          >
            Log Your First Expense
          </Text>
        </Pressable>
      </View>
    );
  }

  const mileageNum = currentMileage ? Number(currentMileage) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Period Selector */}
      <Animated.View entering={FadeInUp.duration(300)} style={{ marginTop: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: pillBg,
            borderRadius: 10,
            borderCurve: 'continuous',
            padding: 3,
            marginBottom: 20,
          }}
        >
          {PERIOD_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => handlePeriodChange(option)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                borderCurve: 'continuous',
                backgroundColor: period === option ? pillActiveBg : 'transparent',
                alignItems: 'center',
                ...(period === option && !isDark
                  ? {
                      shadowColor: '#000',
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
                  fontSize: 13,
                  color: period === option ? pillActiveText : pillInactiveText,
                }}
              >
                {PERIOD_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Summary Cards */}
      <Animated.View entering={FadeInUp.delay(60).duration(300)}>
        <SummaryCards
          ytdTotal={dashboard.currentYearTotal}
          allTimeTotal={dashboard.allTimeTotal}
          previousYearTotal={dashboard.previousYearTotal}
          expenseCount={dashboard.expenseCount}
          currentMileage={mileageNum}
          mileageUnit={mileageUnit ?? null}
          motorcycleId={motorcycleId}
          isDark={isDark}
        />
      </Animated.View>

      {/* Category Donut */}
      <Animated.View entering={FadeInUp.delay(120).duration(300)} style={{ marginTop: 20 }}>
        <View
          style={{
            backgroundColor: cardBg,
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
              color: textColor,
              marginBottom: 12,
            }}
          >
            Spending by Category
          </Text>
          <CategoryDonut
            categoryTotals={categoryTotals}
            totalAmount={periodTotal}
            isDark={isDark}
          />

          {/* Category legend */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 14,
              justifyContent: 'center',
            }}
          >
            {categoryTotals.map((cat) => (
              <View
                key={cat.category}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      CATEGORY_COLORS[cat.category as keyof typeof CATEGORY_COLORS] ??
                      palette.neutral400,
                  }}
                />
                <Text
                  style={{
                    fontFamily: 'PlusJakartaSans-Regular',
                    fontSize: 11,
                    color: subtextColor,
                    textTransform: 'capitalize',
                  }}
                >
                  {cat.category}
                </Text>
                <Text
                  style={{
                    fontFamily: 'PlusJakartaSans-SemiBold',
                    fontSize: 11,
                    color: legendAmountColor,
                  }}
                >
                  {formatCurrency(cat.total)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Monthly Trend */}
      <Animated.View entering={FadeInUp.delay(180).duration(300)} style={{ marginTop: 16 }}>
        <MonthlyTrend buckets={filteredBuckets} isDark={isDark} />
      </Animated.View>

      {/* Recent Expenses */}
      <Animated.View entering={FadeInUp.delay(240).duration(300)} style={{ marginTop: 20 }}>
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
              fontSize: 14,
              fontWeight: '600',
              color: textColor,
            }}
          >
            Recent Expenses
          </Text>
          {recentExpenses.length > 0 && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: { id: motorcycleId },
                })
              }
            >
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontSize: 12,
                  color: palette.primary400,
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
              fontSize: 13,
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
                entering={FadeInUp.delay(240 + index * 50).duration(250)}
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
