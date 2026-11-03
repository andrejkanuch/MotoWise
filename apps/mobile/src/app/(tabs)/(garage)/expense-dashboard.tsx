import { resolveCurrency, splitExpenseTotals } from '@motovault/types';
import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Info, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { CategoryDonut } from '@/components/expense-dashboard/category-donut';
import { costPerDistance } from '@/components/expense-dashboard/cost-per-distance';
import { ExpenseDashboardEmptyState } from '@/components/expense-dashboard/expense-dashboard-empty-state';
import { MonthlyTrend } from '@/components/expense-dashboard/monthly-trend';
import { SummaryCards } from '@/components/expense-dashboard/summary-cards';
import { useCurrency } from '@/hooks/use-currency';
import {
  PERIOD_OPTIONS,
  type Period,
  useDashboardData,
  useExpenseDashboard,
} from '@/hooks/use-expense-dashboard';
import { useMileageUnit } from '@/hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import {
  CATEGORY_COLORS,
  categoryLabel,
  dominantCurrency,
  formatCurrencyTotals,
  formatMoney,
} from '@/lib/expense-constants';
import { queryKeys } from '@/lib/query-keys';
import { EXPENSES_ALL_YEARS, expensesOptions, motorcyclesOptions } from '@/lib/query-options';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { GUTTER, radius, space, type } from '@/theme/type';
import { triggerImpact, triggerSelection } from '@/utils/haptics';

const PERIOD_LABEL_KEY = {
  thisYear: 'expenses.periodThisYear',
  lastYear: 'expenses.periodLastYear',
  allTime: 'expenses.periodAllTime',
} as const satisfies Record<Period, string>;

const PERIOD_TOTAL_KEY = {
  thisYear: 'expenses.totalSpentThisYear',
  lastYear: 'expenses.totalSpentLastYear',
  allTime: 'expenses.totalSpentAllTime',
} as const satisfies Record<Period, string>;

const STAT_LABEL_STYLE = type.label;

const STAT_VALUE_STYLE = {
  ...type.figureSmall,
  marginTop: space.xxs,
};

/**
 * One label/value cell in the cost-of-ownership card. The card carries four of
 * them across two rows (purchase + all expenses, then invested + cost of
 * riding); inlining the styles four times is what the mobile "inline unless
 * reused" rule stops covering.
 */
function StatColumn({
  theme,
  label,
  value,
}: {
  theme: ReturnType<typeof useEditorialTheme>['t'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...STAT_LABEL_STYLE, color: theme.ink2 }}>{label}</Text>
      <Text style={{ ...STAT_VALUE_STYLE, color: theme.ink }}>{value}</Text>
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
  const { t, i18n } = useTranslation();

  const [period, setPeriod] = useState<Period>('thisYear');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Which currency the charts and derived stats show when the bike has
  // expenses in several (null = the user's display currency if present).
  const [chartCurrency, setChartCurrency] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const { t: theme, isDark } = useEditorialTheme();
  const { currency: displayCurrency, formatFor } = useCurrency();
  const queryClient = useQueryClient();

  const { dashboard, isPending, isError, refetch } = useExpenseDashboard(motorcycleId);

  useEffect(() => {
    trackEvent(AnalyticsEvent.EXPENSE_DASHBOARD_VIEWED);
  }, []);

  // Fetch bike data for purchase price (uses existing cache from garage tab)
  const { data: bikesData } = useQuery({
    ...motorcyclesOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const bike = (bikesData?.myMotorcycles ?? []).find((m: { id: string }) => m.id === motorcycleId);
  const purchasePrice = bike?.purchasePrice as number | null | undefined;
  const bikeName = bike ? `${bike.make ?? ''} ${bike.model ?? ''}`.trim() : '';

  // Fetch individual expenses for category drill-down
  const { data: expensesData } = useQuery({
    ...expensesOptions(motorcycleId, EXPENSES_ALL_YEARS),
    enabled: !!motorcycleId,
    staleTime: 5 * 60 * 1000,
  });

  const categoryExpenses = useMemo(() => {
    if (!selectedCategory || !expensesData) return [];
    const cat = expensesData.expenses?.categories?.find((c) => c.category === selectedCategory);
    return cat?.expenses ?? [];
  }, [selectedCategory, expensesData]);

  // Fallback label for a dashboard from an API that predates per-currency
  // aggregates: the currency most of this bike's expense rows use.
  const legacyCurrency = useMemo(() => {
    const records = expensesData?.expenses?.categories?.flatMap((c) => c.expenses) ?? [];
    return dominantCurrency(records, displayCurrency);
  }, [expensesData, displayCurrency]);

  // Amounts are never summed across currencies (no FX source). `periodTotals`
  // is one total per currency for the hero; the charts and derived stats are
  // for ONE currency, `selected`, switchable when the bike has several.
  const { breakdowns, selected, filteredBuckets, periodTotal, periodTotals, categoryTotals } =
    useDashboardData(dashboard, period, {
      currency: chartCurrency ?? displayCurrency,
      legacyCurrency,
    });
  const dashboardCurrency = resolveCurrency(selected?.currency, displayCurrency);

  const formatAgg = useCallback(
    (amount: number) => formatMoney(amount, dashboardCurrency, displayCurrency),
    [dashboardCurrency, displayCurrency],
  );

  const handleCurrencyChange = useCallback((currency: string) => {
    triggerSelection();
    setChartCurrency(currency);
  }, []);

  const handleCategoryPress = useCallback((category: string) => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory((prev) => (prev === category ? null : category));
  }, []);

  const handlePeriodChange = (newPeriod: Period) => {
    triggerSelection();
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
            ...type.body,
            color: theme.ink2,
            textAlign: 'center',
            marginBottom: space.md,
          }}
        >
          {t('expenses.failedToLoad')}
        </Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityLabel={t('expenses.retryLoadA11y')}
          accessibilityRole="button"
          style={{
            backgroundColor: theme.warm,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            borderCurve: 'continuous',
          }}
        >
          <Text style={{ ...type.bodyStrong, color: theme.onWarm }}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state
  if (!dashboard || dashboard.expenseCount === 0 || !selected) {
    return <ExpenseDashboardEmptyState motorcycleId={motorcycleId} />;
  }

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

  const previousYearTotal = selected.previousYearTotal;
  const yoyChange =
    previousYearTotal > 0 ? ((periodTotal - previousYearTotal) / previousYearTotal) * 100 : null;

  const costPerUnit = costPerDistance(selected.allTimeTotal, bike?.currentMileage, currentMileage);

  // What the machine kept vs what riding used up. Deliberately reads
  // `selected.categoryTotals` (all-time, straight from the RPC) and NOT the
  // `categoryTotals` in scope above, which useDashboardData narrows to the
  // selected period — this sits inside the all-time cost-of-ownership card, so a
  // period-scoped split would not add up to the total printed above it.
  const { invested, consumed } = splitExpenseTotals(selected.categoryTotals, purchasePrice ?? 0);
  const heroTotal = formatCurrencyTotals(periodTotals, dashboardCurrency);
  const unitLabel = t(mileageUnit === 'km' ? 'expenses.costPerKm' : 'expenses.costPerMi');

  const periodContextLabel = t(PERIOD_TOTAL_KEY[period]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        paddingHorizontal: GUTTER,
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
      {/* Which bike — the navigation bar already carries the screen title. */}
      {bikeName ? (
        <Animated.View entering={FadeInDown.duration(240)} style={{ marginTop: space.sm }}>
          <Text accessibilityRole="header" style={{ ...type.sheetTitle, color: theme.ink }}>
            {bikeName}
          </Text>
        </Animated.View>
      ) : null}

      {/* Period Selector */}
      <Animated.View entering={FadeInUp.delay(40).duration(300)} style={{ marginTop: 20 }}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={t('expenses.periodSelectorA11y')}
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
              accessibilityLabel={t(PERIOD_LABEL_KEY[option])}
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
                {t(PERIOD_LABEL_KEY[option])}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Currency selector: only when the bike has expenses in several
          currencies. The hero lists every currency; this picks the one the
          charts and stats below are drawn in. */}
      {breakdowns.length > 1 && (
        <Animated.View
          entering={FadeInUp.delay(60).duration(300)}
          accessibilityRole="tablist"
          style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {breakdowns.map((breakdown) => {
            const isSelected = breakdown.currency === selected.currency;
            return (
              <Pressable
                key={breakdown.currency}
                onPress={() => handleCurrencyChange(breakdown.currency)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t('expenses.showInCurrency', { currency: breakdown.currency })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: isSelected ? theme.warm : theme.line,
                  backgroundColor: isSelected ? tint(theme.warm, 0.15) : theme.surface,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? '600' : '500',
                    color: isSelected ? theme.ink : theme.ink3,
                  }}
                >
                  {breakdown.currency}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      )}

      {/* Hero Total */}
      <Animated.View entering={FadeInUp.delay(80).duration(300)} style={{ marginTop: 28 }}>
        <Text style={{ ...type.subhead, color: theme.ink2 }}>{periodContextLabel}</Text>

        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          accessibilityLabel={t('expenses.totalA11y', { amount: heroTotal })}
          style={{
            ...type.figure,
            fontSize: 52,
            lineHeight: 56,
            color: theme.ink,
            marginTop: 2,
          }}
        >
          {heroTotal}
        </Text>

        {period === 'thisYear' && yoyChange !== null && previousYearTotal > 0 && (
          <Text
            accessibilityLabel={t(yoyChange <= 0 ? 'expenses.yoyDownA11y' : 'expenses.yoyUpA11y', {
              percent: Math.abs(yoyChange).toFixed(0),
            })}
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
            accessibilityLabel={t(
              topCategoryPct ? 'expenses.topCategoryPctA11y' : 'expenses.topCategoryA11y',
              {
                category: categoryLabel(t, topCategory.category),
                amount: formatAgg(topCategory.total),
                percent: topCategoryPct,
              },
            )}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.surface2,
              borderRadius: radius.pill,
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
              {categoryLabel(t, topCategory.category)}
            </Text>
            <Text
              style={{
                ...type.figureSmall,
                fontSize: 16,
                lineHeight: 18,
                color: theme.ink,
                marginLeft: 6,
              }}
            >
              {formatAgg(topCategory.total)}
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
            <Text style={{ ...type.bodyStrong, color: theme.ink2, marginBottom: space.xxs }}>
              {t('expenses.totalCostOfOwnership')}
            </Text>
            <Text
              style={{
                ...type.figure,
                fontSize: 34,
                lineHeight: 38,
                color: theme.ink,
              }}
            >
              {formatAgg(purchasePrice + selected.allTimeTotal)}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: theme.line,
                marginVertical: 12,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <StatColumn
                theme={theme}
                label={t('expenses.bikePurchase')}
                value={formatAgg(purchasePrice)}
              />
              <StatColumn
                theme={theme}
                label={t('expenses.allExpenses')}
                value={formatAgg(selected.allTimeTotal)}
              />
            </View>
            {/* What a buyer would pay for vs what owning it cost. Riders
                selling a bike need the first number, and fuel is not in it —
                the two sum back to the total of ownership above, so nothing is
                hidden. */}
            <View
              style={{
                height: 1,
                backgroundColor: theme.line,
                marginVertical: 12,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <StatColumn
                theme={theme}
                label={t('expenses.investedInBike')}
                value={formatAgg(invested)}
              />
              <StatColumn
                theme={theme}
                label={t('expenses.runningCosts')}
                value={formatAgg(consumed)}
              />
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(120).duration(300)} style={{ marginTop: 24 }}>
          <Pressable
            onPress={() => {
              triggerImpact(Haptics.ImpactFeedbackStyle.Light);
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
          currency={dashboardCurrency}
          isDark={isDark}
        />
      </Animated.View>

      {/* Category Breakdown */}
      <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ marginTop: 32 }}>
        <Text
          accessibilityRole="header"
          style={{ ...type.sectionTitle, color: theme.ink, marginBottom: space.sm }}
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
            currency={dashboardCurrency}
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
                  ...type.bodyStrong,
                  color: theme.ink,
                  flex: 1,
                }}
              >
                {categoryLabel(t, selectedCategory)}{' '}
                <Text style={{ fontSize: 14, color: theme.ink3 }}>({categoryExpenses.length})</Text>
              </Text>
              <Pressable
                onPress={() => setSelectedCategory(null)}
                hitSlop={12}
                accessibilityLabel={t('expenses.closeListA11y')}
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
                      {expense.description || categoryLabel(t, expense.category)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.ink3,
                        marginTop: 2,
                      }}
                    >
                      {new Date(expense.date).toLocaleDateString(i18n.language, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...type.figureSmall,
                      fontSize: 18,
                      color: theme.ink,
                      marginLeft: space.sm,
                    }}
                  >
                    {formatFor(expense.amount, expense.currency)}
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
          accessibilityRole="header"
          style={{ ...type.sectionTitle, color: theme.ink, marginBottom: space.sm }}
        >
          {t('expenses.monthlyTrend')}
        </Text>
        <MonthlyTrend buckets={filteredBuckets} isDark={isDark} />
      </Animated.View>
    </ScrollView>
  );
}
