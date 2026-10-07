import { palette } from '@motovault/design-system';
import { breakdownTotals } from '@motovault/types';
import { getMonth, getYear, subMonths } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { DollarSign } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { useDashboardData, useExpenseDashboard } from '../../hooks/use-expense-dashboard';
import { CATEGORY_COLORS, formatCurrencyTotals, formatMoney } from '../../lib/expense-constants';
import { monthTotalOf } from '../../lib/expense-dashboard-period';
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

  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(250).duration(300)}>
      <SectionHeader
        icon={DollarSign}
        iconColor={palette.signature400}
        title={t('home.expenses')}
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
  const { t } = useTranslation();
  const { currency: displayCurrency } = useCurrency();
  const { dashboard, isPending } = useExpenseDashboard(bike.id);
  const { breakdowns } = useDashboardData(dashboard, 'thisYear', {
    currency: displayCurrency,
    legacyCurrency: displayCurrency,
  });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  // One total per currency, never summed across them.
  const monthlyLabel = formatCurrencyTotals(
    breakdownTotals(breakdowns, (b) => monthTotalOf(b, currentYear, currentMonth)),
    displayCurrency,
  );
  const hasData = dashboard && dashboard.expenseCount > 0;

  return (
    <CardWrapper tier="medium" style={{ width: 160 }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${getBikeName(bike)} expenses: ${hasData ? monthlyLabel : 'no data'}`}
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
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: isDark ? palette.neutral50 : palette.neutral950,
                fontVariant: ['tabular-nums'],
              }}
            >
              {monthlyLabel}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: palette.neutral500,
                fontWeight: '500',
                marginTop: 2,
              }}
            >
              {t('home.thisMonth')}
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
            {t('home.noExpenses')}
          </Text>
        )}
      </Pressable>
    </CardWrapper>
  );
}

function EmptyExpenseCard({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  return (
    <CardWrapper
      tier="subtle"
      style={{
        borderWidth: 1,
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
          {t('home.trackCosts')}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: palette.neutral500,
            fontWeight: '500',
            textAlign: 'center',
          }}
        >
          {t('home.logExpenses')}
        </Text>
      </View>
    </CardWrapper>
  );
}

function AnimatedCategoryBar({
  percentage,
  color,
  index,
}: {
  percentage: number;
  color: string;
  index: number;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      index * 100,
      withTiming(percentage, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [percentage, index, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    height: '100%',
    borderRadius: 2,
    borderCurve: 'continuous',
    backgroundColor: color,
  }));

  return <Animated.View style={animatedStyle} />;
}

function SingleBikeExpenseContent({
  isDark,
  motorcycleId,
  onViewDetails,
}: {
  isDark: boolean;
  motorcycleId: string;
  onViewDetails: () => void;
}) {
  const { t } = useTranslation();
  const { currency: displayCurrency } = useCurrency();
  const { dashboard, isPending } = useExpenseDashboard(motorcycleId);
  // Hero figures list every currency; the month-over-month change and the
  // category bars are for ONE currency (the display currency when the bike has
  // it), since shares of a mixed-currency sum would be meaningless.
  const { breakdowns, selected, periodTotals, categoryTotals } = useDashboardData(
    dashboard,
    'thisYear',
    { currency: displayCurrency, legacyCurrency: displayCurrency },
  );

  if (isPending) {
    return (
      <CardWrapper tier="subtle">
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={palette.primary500} />
        </View>
      </CardWrapper>
    );
  }

  if (!dashboard || dashboard.expenseCount === 0 || !selected) {
    return <EmptyExpenseCard isDark={isDark} />;
  }

  const now = new Date();
  const currentMonth = getMonth(now) + 1;
  const currentYear = getYear(now);
  const previousMonthDate = subMonths(now, 1);
  const previousMonth = getMonth(previousMonthDate) + 1;
  const previousYear = getYear(previousMonthDate);

  const monthlyLabel = formatCurrencyTotals(
    breakdownTotals(breakdowns, (b) => monthTotalOf(b, currentYear, currentMonth)),
    displayCurrency,
  );
  const monthlyTotal = monthTotalOf(selected, currentYear, currentMonth);
  const prevMonthTotal = monthTotalOf(selected, previousYear, previousMonth);
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
        accessibilityLabel={`Monthly expenses: ${monthlyLabel}`}
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
            {monthlyLabel}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: palette.neutral500 }}>
            {t('home.thisMonth')}
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
            {t('home.vsLastMonth', { pct: `${isUp ? '+' : ''}${pctChange.toFixed(0)}` })}
          </Text>
        )}

        {topCategories.length > 0 && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {topCategories.map((cat, index) => (
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
                    {formatMoney(cat.total, selected.currency, displayCurrency)}
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
                  <AnimatedCategoryBar
                    percentage={(cat.total / maxCategoryTotal) * 100}
                    color={CATEGORY_COLORS[cat.category] ?? palette.neutral400}
                    index={index}
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
            {t('home.ytd', { amount: formatCurrencyTotals(periodTotals, displayCurrency) })}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary500 }}>
            {t('home.viewDetails')}
          </Text>
        </View>
      </Pressable>
    </CardWrapper>
  );
}
