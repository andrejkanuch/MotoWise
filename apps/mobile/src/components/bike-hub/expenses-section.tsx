import {
  ExpensesByMotorcycleDocument,
  MaintenanceTasksByMotorcycleDocument,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { useDeleteExpense } from '../../hooks/use-delete-expense';
import { EXPENSE_ENTRY_SOURCE } from '../../lib/expense-analytics';
import {
  CATEGORY_LABELS,
  formatCurrencyTotals,
  groupTotalsByCurrency,
} from '../../lib/expense-constants';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { QUERY_META } from '../../lib/query-meta';
import { triggerImpact } from '../../utils/haptics';
import { SwipeableExpense } from '../shared/swipeable-expense';
import { LoadError } from './load-error';
import { HubCard } from './ui/hub-card';
import { SectionHeader } from './ui/section-header';
import {
  HUB_FONT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  hub,
  hubCategoryColor,
} from './ui/tokens';

/** `year` value that means every year. */
const ALL_TIME = 0;
/** Rows shown before "See all". */
const RECENT_LIMIT = 5;
const YEAR_CHIP_HEIGHT = 32;
const YEAR_TRACK_PADDING = 2;
/** Vertical slop that grows a year chip to a full touch target. */
const YEAR_CHIP_SLOP = Math.ceil((HUB_TOUCH_TARGET - YEAR_CHIP_HEIGHT) / 2);

interface ExpensesSectionProps {
  motorcycleId: string;
  isDark: boolean;
  currentMileage?: number;
  mileageUnit?: string;
  /** Rendered under the summary (the Costs segment's quiet scan-a-receipt row). */
  afterSummary?: ReactNode;
}

interface YearOption {
  value: number;
  label: string;
  mono: boolean;
}

/**
 * The Costs segment's expense list (interim until R4): a year / all-time
 * switch, the period total with its category split, and the recent expenses.
 * Adding an expense is the segment's action pill — this section has no add
 * button of its own.
 */
export function ExpensesSection({
  motorcycleId,
  isDark,
  currentMileage,
  mileageUnit,
  afterSummary,
}: ExpensesSectionProps) {
  const { t } = useTranslation();
  const { currency: displayCurrency } = useCurrency();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [showAll, setShowAll] = useState(false);

  // Shares the Overview's cache entry for this year, so it passes the same
  // opt-out and renders its own error with Retry (below) — never "No expenses
  // yet" for a list that failed to load.
  const {
    data,
    isLoading,
    isError: expensesError,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(motorcycleId), year],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId, year }),
    meta: QUERY_META.OWN_ERROR_UI,
  });
  const loadFailed = expensesError && !data;

  // Same cache entry as the bike hub — used to gate the wrench badge so list and
  // detail agree when maintenanceTaskId is orphaned. A failure only hides the
  // badge; the hub shell shows the task list's own error.
  const { data: tasksData } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
    meta: QUERY_META.OWN_ERROR_UI,
  });
  const liveTaskIds = useMemo(
    () => new Set(tasksData?.maintenanceTasks.map((task) => task.id) ?? []),
    [tasksData],
  );

  const deleteMutation = useDeleteExpense({ motorcycleId });

  const expenses = data?.expenses;
  const categories = expenses?.categories ?? [];

  // Flatten all expenses for the list
  const allExpenses = useMemo(
    () =>
      categories
        .flatMap((cat) => cat.expenses)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [categories],
  );

  // Currency-aware totals from each expense's own stored `currency`. Single
  // currency (the norm) -> one group equal to the plain sum; mixed -> one
  // subtotal per currency, never added together (no FX source).
  const totalGroups = useMemo(
    () => groupTotalsByCurrency(allExpenses, displayCurrency),
    [allExpenses, displayCurrency],
  );
  const hasSpend = totalGroups.some((g) => g.total > 0);

  // The segment bar shows category shares of ONE currency, the most-used one —
  // a share of a mixed-currency sum would be meaningless. Categories with no
  // spend in it get no segment but keep their legend entry.
  const categoryShares = useMemo(() => {
    const primary = totalGroups[0];
    const shares = new Map<string, number>();
    if (!primary || primary.total <= 0) return shares;
    for (const cat of categories) {
      const inPrimary =
        groupTotalsByCurrency(cat.expenses, displayCurrency).find(
          (g) => g.currency === primary.currency,
        )?.total ?? 0;
      shares.set(cat.category, (inPrimary / primary.total) * 100);
    }
    return shares;
  }, [categories, totalGroups, displayCurrency]);

  const displayedExpenses = showAll ? allExpenses : allExpenses.slice(0, RECENT_LIMIT);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const yearOptions: YearOption[] = [
    { value: currentYear, label: String(currentYear), mono: true },
    { value: ALL_TIME, label: t('common.all'), mono: false },
  ];

  const selectYear = (value: number) => {
    if (value === year) return;
    triggerImpact();
    setYear(value);
    setShowAll(false);
  };

  const openInsights = () => {
    router.push({
      pathname: '/(tabs)/(garage)/expense-dashboard',
      params: {
        motorcycleId,
        currentMileage: currentMileage ? String(currentMileage) : '',
        mileageUnit: mileageUnit ?? 'mi',
      },
    });
  };

  const addExpense = () => {
    triggerImpact();
    router.push({
      pathname: '/(tabs)/(garage)/add-expense',
      params: { motorcycleId, entrySource: EXPENSE_ENTRY_SOURCE.BIKE_HUB },
    });
  };

  const categoryLabel = (key: string) =>
    t(`expenses.category_${key}` as HubCopyKey, { defaultValue: CATEGORY_LABELS[key] ?? key });

  const periodLabel =
    year === ALL_TIME
      ? t('bikeHub.costsSegment.spentAllTime')
      : t('bikeHub.costsSegment.spentIn', { year });

  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      {/* Year / all-time switch */}
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          gap: YEAR_TRACK_PADDING,
          padding: YEAR_TRACK_PADDING,
          borderRadius: HUB_RADIUS.segment + YEAR_TRACK_PADDING,
          borderCurve: 'continuous',
          backgroundColor: hub.card,
          borderWidth: 1,
          borderColor: hub.hairline,
        }}
      >
        {yearOptions.map((option) => {
          const selected = option.value === year;
          return (
            <Pressable
              key={option.value}
              testID={`expenses-year-${option.value === ALL_TIME ? 'all' : option.value}`}
              onPress={() => selectYear(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              hitSlop={{ top: YEAR_CHIP_SLOP, bottom: YEAR_CHIP_SLOP }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: YEAR_CHIP_HEIGHT,
                paddingHorizontal: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: HUB_RADIUS.segment - 1,
                borderCurve: 'continuous',
                backgroundColor: selected ? hub.raised : undefined,
                opacity: pressed && !selected ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: option.mono
                    ? selected
                      ? HUB_FONT.monoMedium
                      : HUB_FONT.mono
                    : HUB_FONT.sansSemiBold,
                  fontSize: 13,
                  color: selected ? hub.text : hub.dim,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading && (
        <HubCard style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator color={hub.dim} accessibilityLabel={t('common.loading')} />
        </HubCard>
      )}

      {loadFailed && (
        <LoadError
          testID="expenses-load-error"
          retryTestID="expenses-retry"
          message={t('expenses.failedToLoad')}
          onRetry={() => void refetchExpenses()}
        />
      )}

      {/* Empty state */}
      {!isLoading && !loadFailed && allExpenses.length === 0 && (
        <Animated.View entering={FadeInUp.duration(250)}>
          <HubCard
            onPress={addExpense}
            accessibilityLabel={`${t('expenses.empty')}. ${t('expenses.emptyHint')}`}
            style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 4 }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                marginBottom: 8,
                borderRadius: HUB_RADIUS.tile,
                borderCurve: 'continuous',
                backgroundColor: hub.raised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={20} color={hub.dim} strokeWidth={1.8} />
            </View>
            <Text
              style={{
                fontFamily: HUB_FONT.sansSemiBold,
                fontSize: 15,
                lineHeight: 20,
                color: hub.text,
                textAlign: 'center',
              }}
            >
              {t('expenses.empty')}
            </Text>
            <Text
              style={{
                fontFamily: HUB_FONT.sans,
                fontSize: 13,
                lineHeight: 17,
                color: hub.dim,
                textAlign: 'center',
              }}
            >
              {t('expenses.emptyHint')}
            </Text>
          </HubCard>
        </Animated.View>
      )}

      {/* Period total + category split */}
      {!isLoading && allExpenses.length > 0 && hasSpend && (
        <Animated.View entering={FadeInUp.duration(200)} style={{ gap: 8 }}>
          <SectionHeader
            label={periodLabel}
            action={{ label: t('bikeHub.costs.full'), onPress: openInsights }}
          />
          <HubCard style={{ padding: 16, gap: 14 }}>
            <Text
              testID="expenses-total"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontFamily: HUB_FONT.monoMedium,
                fontSize: 32,
                lineHeight: 34,
                letterSpacing: -0.64,
                color: hub.text,
              }}
            >
              {formatCurrencyTotals(totalGroups, displayCurrency)}
            </Text>

            {/* The legend below names every segment, so the bar itself is hidden from screen readers. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flexDirection: 'row',
                height: 8,
                gap: 2,
                borderRadius: 4,
                borderCurve: 'continuous',
                overflow: 'hidden',
              }}
            >
              {categories.map((cat) => {
                const pct = categoryShares.get(cat.category) ?? 0;
                if (pct <= 0) return null;
                return (
                  <View
                    key={cat.category}
                    style={{
                      flexGrow: pct,
                      flexBasis: 0,
                      backgroundColor: hubCategoryColor(cat.category),
                    }}
                  />
                );
              })}
            </View>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                columnGap: 14,
                rowGap: 8,
                borderTopWidth: 1,
                borderTopColor: hub.hairline,
                paddingTop: 12,
              }}
            >
              {categories.map((cat) => {
                if (!cat.expenses.some((e) => e.amount !== 0)) return null;
                return (
                  <View
                    key={cat.category}
                    accessible
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: hubCategoryColor(cat.category),
                      }}
                    />
                    <Text style={{ fontFamily: HUB_FONT.sans, fontSize: 13, color: hub.dim }}>
                      {categoryLabel(cat.category)}{' '}
                      <Text style={{ fontFamily: HUB_FONT.mono, color: hub.text }}>
                        {formatCurrencyTotals(
                          groupTotalsByCurrency(cat.expenses, displayCurrency),
                          displayCurrency,
                        )}
                      </Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          </HubCard>
        </Animated.View>
      )}

      {afterSummary}

      {/* Recent expenses */}
      {!isLoading && allExpenses.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionHeader label={t('bikeHub.costsSegment.recent')} count={allExpenses.length} />
          <HubCard style={{ overflow: 'hidden' }}>
            {displayedExpenses.map((expense, index) => (
              <SwipeableExpense
                key={expense.id}
                expense={expense}
                motorcycleId={motorcycleId}
                isDark={isDark}
                onDelete={handleDelete}
                index={index}
                divider={index < displayedExpenses.length - 1}
                hasServiceRecord={
                  !!expense.maintenanceTaskId && liveTaskIds.has(expense.maintenanceTaskId)
                }
              />
            ))}
          </HubCard>

          {allExpenses.length > RECENT_LIMIT && (
            <Pressable
              testID="expenses-see-all"
              onPress={() => {
                triggerImpact();
                setShowAll((prev) => !prev);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAll }}
              style={({ pressed }) => ({
                minHeight: HUB_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.copperText }}
              >
                {showAll
                  ? t('expenses.showLess')
                  : t('expenses.seeAll', { count: allExpenses.length })}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
