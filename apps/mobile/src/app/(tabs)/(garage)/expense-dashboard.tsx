import { palette } from '@motovault/design-system';
import {
  ExpensesByMotorcycleDocument,
  type ExpensesByMotorcycleQuery,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import type { ExpenseCategory } from '@motovault/types';
import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3, Info, Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CategoryDonut } from '../../../components/expense-dashboard/category-donut';
import { MonthlyTrend } from '../../../components/expense-dashboard/monthly-trend';
import { SummaryCards } from '../../../components/expense-dashboard/summary-cards';
import { GARAGE_ROUTE } from '../../../config/routes';
import { ReceiptScanEntry } from '../../../features/receipt-scan/receipt-scan-entry';
import { SCAN_ENTRY_SURFACE } from '../../../features/receipt-scan/scan-flow-constants';
import { useCurrency } from '../../../hooks/use-currency';
import {
  PERIOD_OPTIONS,
  type Period,
  useDashboardData,
  useExpenseDashboard,
} from '../../../hooks/use-expense-dashboard';
import { useMileageUnit } from '../../../hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { tint, useEditorialTheme } from '../../../theme/editorial';

const PERIOD_LABELS: Record<Period, string> = {
  thisYear: 'This Year',
  lastYear: 'Last Year',
  allTime: 'All Time',
};

/**
 * MOT-273: one-tap quick-add categories on the empty state. Prefilling the
 * category + landing on the form (amount-only) cuts the friction between
 * "I see the value" and "I logged my first expense".
 */
const QUICK_ADD_CATEGORIES: ExpenseCategory[] = ['fuel', 'maintenance', 'insurance'];

function EmptyState({ motorcycleId }: { motorcycleId: string }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
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
        backgroundColor: theme.bg,
      }}
    >
      <Animated.View entering={FadeIn.delay(100).duration(400)}>
        <BarChart3 size={48} color={theme.ink3} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(200).duration(300)}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 24,
            color: theme.ink,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          {t('expenses.empty')}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(280).duration(300)}>
        <Text
          style={{
            fontSize: 14,
            color: theme.ink3,
            marginTop: 8,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          {t('expenses.emptyStateSubtitle')}
        </Text>
      </Animated.View>
      {/* MOT-273: prefilled quick-add chips — one tap to an amount-only form. */}
      <Animated.View
        entering={FadeInUp.delay(320).duration(300)}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          marginTop: 20,
        }}
      >
        {QUICK_ADD_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              trackEvent(AnalyticsEvent.EXPENSE_QUICK_ADD_TAPPED, { category: cat });
              router.push({
                pathname: GARAGE_ROUTE.ADD_EXPENSE,
                params: { motorcycleId, category: cat },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={t(`expenses.category_${cat}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              height: 38,
              borderRadius: 19,
              borderCurve: 'continuous',
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: CATEGORY_COLORS[cat] ?? theme.warm,
              }}
            />
            <Plus size={13} color={theme.ink3} strokeWidth={2} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>
              {t(`expenses.category_${cat}`)}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(420).duration(300)} style={ctaAnimatedStyle}>
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
              pathname: GARAGE_ROUTE.ADD_EXPENSE,
              params: { motorcycleId },
            });
          }}
          accessibilityLabel="Add your first expense"
          accessibilityRole="button"
          style={{
            backgroundColor: theme.warm,
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
              fontWeight: '600',
              fontSize: 16,
              color: palette.white,
            }}
          >
            {t('expenses.addFirstExpense')}
          </Text>
        </Pressable>
      </Animated.View>
      {/* Scan-a-receipt alternative to manual entry — carries bike context (U8) */}
      <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
        <ReceiptScanEntry
          motorcycleId={motorcycleId}
          surface={SCAN_ENTRY_SURFACE.EXPENSE_EMPTY}
          delay={480}
        />
      </View>
      <Animated.View entering={FadeIn.delay(560).duration(300)}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Italic',
            fontSize: 13,
            color: theme.ink3,
            marginTop: 12,
          }}
        >
          {t('expenses.emptyStateTip')}
        </Text>
      </Animated.View>
    </View>
  );
}

export default function ExpenseDashboardScreen() {
  const { motorcycleId, currentMileage } = useLocalSearchParams<{
    motorcycleId: string;
    currentMileage?: string;
  }>();
  // Unit follows the user's profile preference, not the deprecated per-bike field.
  const mileageUnit = useMileageUnit();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<Period>('thisYear');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const { t: theme, isDark } = useEditorialTheme();
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
  const bikeName = bike ? `${bike.make ?? ''} ${bike.model ?? ''}`.trim() : '';

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

  if (isPending) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.warm} />
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
          backgroundColor: theme.bg,
        }}
      >
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 20,
            color: theme.ink2,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          {t('expenses.failedToLoad')}
        </Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityLabel="Retry loading expense data"
          accessibilityRole="button"
          style={{
            backgroundColor: theme.warm,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            borderCurve: 'continuous',
          }}
        >
          <Text
            style={{
              fontWeight: '600',
              fontSize: 14,
              color: palette.white,
            }}
          >
            {t('common.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Empty state
  if (!dashboard || dashboard.expenseCount === 0) {
    return <EmptyState motorcycleId={motorcycleId} />;
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
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 100,
        ...(process.env.EXPO_OS === 'android' && { paddingTop: 56 }),
      }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.warm} />
      }
    >
      <Sentry.TimeToInitialDisplay record />
      <Sentry.TimeToFullDisplay record />
      {/* Editorial Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: 12 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: theme.ink3,
          }}
        >
          {t('expenses.dashboard')}
        </Text>
        {bikeName ? (
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 28,
              color: theme.ink,
              marginTop: 4,
              letterSpacing: -0.5,
            }}
          >
            {bikeName}
          </Text>
        ) : null}
      </Animated.View>

      {/* Period Selector */}
      <Animated.View entering={FadeInUp.delay(40).duration(300)} style={{ marginTop: 20 }}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Expense period selector"
          style={{
            flexDirection: 'row',
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.line,
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
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: period === option ? theme.surface2 : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontWeight: period === option ? '600' : '500',
                  fontSize: 13,
                  letterSpacing: period === option ? 0 : -0.1,
                  color: period === option ? theme.ink : theme.ink3,
                }}
              >
                {PERIOD_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Hero Total */}
      <Animated.View entering={FadeInUp.delay(80).duration(300)} style={{ marginTop: 28 }}>
        <Text
          style={{
            fontSize: 13,
            color: theme.ink3,
          }}
        >
          {periodContextLabel}
        </Text>

        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          accessibilityLabel={`Total: ${formatCurrency(periodTotal)}`}
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 48,
            color: theme.ink,
            letterSpacing: -1.5,
            marginTop: 2,
          }}
        >
          {formatCurrency(periodTotal)}
        </Text>

        {period === 'thisYear' && yoyChange !== null && previousYearTotal > 0 && (
          <Text
            accessibilityLabel={`${yoyChange <= 0 ? 'Down' : 'Up'} ${Math.abs(yoyChange).toFixed(0)} percent versus last year`}
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: yoyChange <= 0 ? theme.success : theme.danger,
              marginTop: 4,
            }}
          >
            {t('expenses.vsLastYear', {
              arrow: yoyChange <= 0 ? '\u2193' : '\u2191',
              percent: Math.abs(yoyChange).toFixed(0),
            })}
          </Text>
        )}

        {/* Top category pill */}
        {topCategory && topCategory.total > 0 && (
          <View
            accessibilityLabel={`Top category: ${CATEGORY_LABELS[topCategory.category] ?? topCategory.category}, ${formatCurrency(topCategory.total)}${topCategoryPct ? `, ${topCategoryPct} percent` : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: tint(theme.warm, 0.15),
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingHorizontal: 12,
              paddingVertical: 7,
              alignSelf: 'flex-start',
              marginTop: 16,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: CATEGORY_COLORS[topCategory.category] ?? theme.ink3,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                fontWeight: '500',
                fontSize: 12,
                color: theme.ink2,
                marginLeft: 6,
                flexShrink: 1,
              }}
            >
              {CATEGORY_LABELS[topCategory.category] ?? topCategory.category}
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 13,
                color: theme.ink,
                marginLeft: 6,
              }}
            >
              {formatCurrency(topCategory.total)}
            </Text>
            {topCategoryPct && (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.ink3,
                  marginLeft: 4,
                }}
              >
                {topCategoryPct}%
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* Total Cost of Ownership */}
      {purchasePrice != null && purchasePrice > 0 ? (
        <Animated.View entering={FadeInUp.delay(120).duration(300)} style={{ marginTop: 24 }}>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 8,
              }}
            >
              {t('expenses.totalCostOfOwnership')}
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 32,
                color: theme.ink,
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.5,
              }}
            >
              {formatCurrency(purchasePrice + dashboard.allTimeTotal)}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: theme.line,
                marginVertical: 12,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: theme.ink3,
                  }}
                >
                  {t('expenses.bikePurchase')}
                </Text>
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 18,
                    color: theme.ink,
                    fontVariant: ['tabular-nums'],
                    marginTop: 4,
                  }}
                >
                  {formatCurrency(purchasePrice)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: theme.ink3,
                  }}
                >
                  {t('expenses.allExpenses')}
                </Text>
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 18,
                    color: theme.ink,
                    fontVariant: ['tabular-nums'],
                    marginTop: 4,
                  }}
                >
                  {formatCurrency(dashboard.allTimeTotal)}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(120).duration(300)} style={{ marginTop: 24 }}>
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
              backgroundColor: tint(theme.warm, 0.1),
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: tint(theme.warm, 0.2),
              padding: 14,
              gap: 10,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Info size={18} color={theme.warm} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '500',
                color: theme.ink2,
              }}
            >
              {t('expenses.addPurchasePriceHint')}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Summary Metric Pills */}
      <Animated.View entering={FadeInUp.delay(160).duration(300)} style={{ marginTop: 16 }}>
        <SummaryCards
          avgPerMonth={avgPerMonth}
          expenseCount={dashboard.expenseCount}
          costPerUnit={costPerUnit}
          unitLabel={unitLabel}
          isDark={isDark}
        />
      </Animated.View>

      {/* Category Breakdown */}
      <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ marginTop: 32 }}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Italic',
            fontSize: 22,
            color: theme.warm2,
            marginBottom: 14,
            paddingLeft: 2,
          }}
        >
          {t('expenses.byCategory')}
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.line,
            padding: 16,
          }}
        >
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
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: CATEGORY_COLORS[selectedCategory] ?? theme.ink3,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Regular',
                  fontSize: 18,
                  color: theme.ink,
                  flex: 1,
                }}
              >
                {CATEGORY_LABELS[selectedCategory] ?? selectedCategory}{' '}
                <Text style={{ fontSize: 14, color: theme.ink3 }}>({categoryExpenses.length})</Text>
              </Text>
              <Pressable
                onPress={() => setSelectedCategory(null)}
                hitSlop={12}
                accessibilityLabel="Close expense list"
              >
                <X size={18} color={theme.ink3} />
              </Pressable>
            </View>

            {categoryExpenses.map((expense, index) => (
              <View key={expense.id}>
                {index > 0 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.line,
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
                        fontWeight: '500',
                        fontSize: 14,
                        color: theme.ink,
                      }}
                    >
                      {expense.description ||
                        (CATEGORY_LABELS[expense.category] ?? expense.category)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.ink3,
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
                      fontFamily: 'InstrumentSerif-Regular',
                      fontSize: 16,
                      color: theme.ink,
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
      <Animated.View entering={FadeInUp.delay(260).duration(300)} style={{ marginTop: 24 }}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Italic',
            fontSize: 22,
            color: theme.warm2,
            marginBottom: 14,
            paddingLeft: 2,
          }}
        >
          {t('expenses.monthlyTrend')}
        </Text>
        <MonthlyTrend buckets={filteredBuckets} isDark={isDark} />
      </Animated.View>
    </ScrollView>
  );
}
