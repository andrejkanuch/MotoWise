import { palette } from '@motovault/design-system';
import { DeleteExpenseDocument, ExpensesByMotorcycleDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BarChart3, ChevronDown, Plus, Receipt } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/expense-constants';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { SwipeableExpense } from '../shared/swipeable-expense';

interface ExpensesSectionProps {
  motorcycleId: string;
  isDark: boolean;
  currentMileage?: number;
  mileageUnit?: string;
}

export function ExpensesSection({
  motorcycleId,
  isDark,
  currentMileage,
  mileageUnit,
}: ExpensesSectionProps) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(motorcycleId), year],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId, year }),
  });

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
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('expenses.deleteFailed', { defaultValue: 'Failed to delete expense.' }),
      );
    },
  });

  const expenses = data?.expenses;
  const ytdTotal = expenses?.ytdTotal ?? 0;
  const categories = expenses?.categories ?? [];

  // Flatten all expenses for the list
  const allExpenses = useMemo(
    () =>
      categories
        .flatMap((cat) => cat.expenses)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [categories],
  );

  const displayedExpenses = showAll ? allExpenses : allExpenses.slice(0, 5);

  const cardBg = isDark ? palette.neutral800 : palette.white;

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const toggleYear = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setYear((prev) => (prev === currentYear ? 0 : currentYear));
    setShowAll(false);
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Section header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginLeft: 4,
            }}
          >
            {t('expenses.title', { defaultValue: 'Expenses' })}
          </Text>
          {ytdTotal > 0 && (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '800',
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {formatCurrency(ytdTotal)}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Year filter pill */}
          <Pressable
            onPress={toggleYear}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: isDark ? palette.neutral300 : palette.neutral600,
              }}
            >
              {year === 0
                ? t('expenses.allTime', { defaultValue: 'All Time' })
                : String(currentYear)}
            </Text>
            <ChevronDown size={12} color={palette.neutral400} strokeWidth={2} />
          </Pressable>

          {/* Insights button */}
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push({
                pathname: '/(tabs)/(garage)/expense-dashboard',
                params: {
                  motorcycleId,
                  currentMileage: currentMileage ? String(currentMileage) : '',
                  mileageUnit: mileageUnit ?? 'mi',
                },
              });
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.neutral700 : palette.neutral200,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={14} color={palette.primary400} strokeWidth={2.5} />
          </Pressable>

          {/* Add button */}
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push({
                pathname: '/(tabs)/(garage)/add-expense',
                params: { motorcycleId },
              });
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: palette.primary500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={16} color={palette.white} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 32,
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color={palette.primary500} />
        </View>
      )}

      {/* Empty state */}
      {!isLoading && allExpenses.length === 0 && (
        <Animated.View entering={FadeInUp.duration(300)}>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push({
                pathname: '/(tabs)/(garage)/add-expense',
                params: { motorcycleId },
              });
            }}
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 24,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={22} color={palette.neutral400} strokeWidth={1.5} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: isDark ? palette.neutral200 : palette.neutral800,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {t('expenses.empty', { defaultValue: 'No expenses yet' })}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: palette.neutral500,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              {t('expenses.emptyHint', { defaultValue: 'Tap to log parts, service, or gear.' })}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Category breakdown bar */}
      {!isLoading && allExpenses.length > 0 && ytdTotal > 0 && (
        <Animated.View entering={FadeInUp.duration(250)}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 14,
              marginBottom: 10,
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {/* Segment bar */}
            <View
              style={{
                flexDirection: 'row',
                height: 8,
                borderRadius: 4,
                borderCurve: 'continuous',
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              {categories.map((cat) => {
                const pct = ytdTotal > 0 ? (cat.total / ytdTotal) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <View
                    key={cat.category}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: CATEGORY_COLORS[cat.category] ?? palette.neutral400,
                    }}
                  />
                );
              })}
            </View>

            {/* Category legend */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {categories.map((cat) => {
                if (cat.total === 0) return null;
                return (
                  <View
                    key={cat.category}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: CATEGORY_COLORS[cat.category] ?? palette.neutral400,
                      }}
                    />
                    <Text style={{ fontSize: 11, color: palette.neutral500, fontWeight: '500' }}>
                      {CATEGORY_LABELS[cat.category] ?? cat.category}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: isDark ? palette.neutral300 : palette.neutral700,
                      }}
                    >
                      {formatCurrency(cat.total)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Expense list */}
      {!isLoading && allExpenses.length > 0 && (
        <View style={{ gap: 6 }}>
          {displayedExpenses.map((expense, index) => (
            <SwipeableExpense
              key={expense.id}
              expense={expense}
              isDark={isDark}
              onDelete={handleDelete}
              index={index}
            />
          ))}

          {/* See all / Show less */}
          {allExpenses.length > 5 && (
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowAll((prev) => !prev);
              }}
              style={{
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: palette.primary500,
                }}
              >
                {showAll
                  ? t('expenses.showLess', { defaultValue: 'Show less' })
                  : t('expenses.seeAll', {
                      defaultValue: 'See all ({{count}})',
                      count: allExpenses.length,
                    })}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
