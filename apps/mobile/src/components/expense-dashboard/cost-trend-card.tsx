import { COST_TREND_MIN_EXPENSES, RIDE_PAYWALL_PLACEMENT } from '@motovault/types';
import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useCurrency } from '@/hooks/use-currency';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { formatMoney } from '@/lib/expense-constants';
import { PAYWALL_SURFACE } from '@/lib/paywall-surfaces';
import { presentPaywall } from '@/lib/subscription';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';
import { type CostTrendData, useExpenseCostTrend } from './use-expense-cost-trend';

const BAR_AREA_HEIGHT = 64;
const MIN_BAR_HEIGHT = 2;

type CostTrendSeries = NonNullable<CostTrendData['series']>[number];

/** A `YYYY-MM` month as "Nov 2026" in the app language. */
function monthYearLabel(month: string, locale: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
}

function SeriesTrend({ series, otherCount }: { series: CostTrendSeries; otherCount: number }) {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { currency: displayCurrency } = useCurrency();
  const total = formatMoney(series.total, series.currency, displayCurrency);
  const max = Math.max(...series.months.map((m) => m.total), 0);
  const first = series.months[0]?.month;
  const last = series.months[series.months.length - 1]?.month;
  const from = first ? monthYearLabel(first, i18n.language) : '';
  const to = last ? monthYearLabel(last, i18n.language) : '';

  return (
    <View style={{ gap: space.xs }}>
      <View
        accessible
        accessibilityLabel={t('expenses.costTrend.seriesA11y', { amount: total, from, to })}
      >
        <Text style={{ ...type.label, color: theme.ink2 }}>
          {t('expenses.costTrend.last12Months')}
        </Text>
        <Text style={{ ...type.figureSmall, color: theme.ink }}>{total}</Text>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: BAR_AREA_HEIGHT,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: space.xxs,
        }}
      >
        {series.months.map((m) => (
          <View
            key={m.month}
            style={{
              flex: 1,
              height:
                max > 0 && m.total > 0
                  ? Math.max(MIN_BAR_HEIGHT, (m.total / max) * BAR_AREA_HEIGHT)
                  : MIN_BAR_HEIGHT,
              borderRadius: MIN_BAR_HEIGHT,
              borderCurve: 'continuous',
              backgroundColor: m.total > 0 ? theme.warm : theme.line,
            }}
          />
        ))}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text style={{ ...type.caption, color: theme.ink3 }}>{from}</Text>
        <Text style={{ ...type.caption, color: theme.ink3 }}>{to}</Text>
      </View>
      {otherCount > 0 ? (
        <Text style={{ ...type.caption, color: theme.ink3 }}>
          {t('expenses.costTrend.otherCurrencies', { count: otherCount })}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The expense dashboard's Cost trend card, from `COST_TREND_MIN_EXPENSES`
 * expenses. A free rider sees it locked and a tap opens the `cost_insights`
 * paywall; a Pro rider sees one 12-month trend per currency, each with a note
 * on the expenses in other currencies it leaves out.
 */
export function CostTrendCard({
  motorcycleId,
  expenseCount,
}: {
  motorcycleId: string;
  expenseCount: number;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const storePro = useSubscriptionStore((s) => s.isPro);
  const { trend, refreshEntitlement } = useExpenseCostTrend(motorcycleId, expenseCount);
  const visible =
    expenseCount >= COST_TREND_MIN_EXPENSES && trend !== null && trend.expenseCount > 0;
  const series = trend?.series ?? null;
  const locked = series === null;

  const shown = useRef(false);
  useEffect(() => {
    if (!visible || shown.current) return;
    shown.current = true;
    trackEvent(AnalyticsEvent.EXPENSE_COST_TREND_SHOWN, { locked });
  }, [visible, locked]);

  // The store can know about a purchase before the server does: then re-read
  // the tier instead of selling Pro to a rider who has it.
  const unlock = useCallback(async () => {
    triggerImpact();
    try {
      if (!storePro) {
        const result = await presentPaywall({
          source: 'expense_dashboard',
          feature: RIDE_PAYWALL_PLACEMENT.COST_INSIGHTS,
          surface: PAYWALL_SURFACE.EXPENSE_COST_TREND,
          placement: RIDE_PAYWALL_PLACEMENT.COST_INSIGHTS,
        });
        if (result !== 'purchased' && result !== 'restored') return;
      }
      await refreshEntitlement();
    } catch {
      // The card stays locked; the next refresh reads the tier again.
    }
  }, [storePro, refreshEntitlement]);

  if (!visible || trend === null) return null;

  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: radius.card,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: theme.line,
    padding: space.md,
  };

  return (
    <Animated.View
      testID="cost-trend-card"
      entering={FadeInUp.delay(280).duration(300)}
      style={{ marginTop: space.xl }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...type.sectionTitle, color: theme.ink, marginBottom: space.sm }}
      >
        {t('expenses.costTrend.title')}
      </Text>
      {series === null ? (
        <Pressable
          testID="cost-trend-locked"
          onPress={() => void unlock()}
          accessibilityRole="button"
          accessibilityLabel={t('expenses.costTrend.lockedA11y')}
          style={({ pressed }) => ({
            ...cardStyle,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tint(theme.warm, 0.15),
            }}
          >
            <Lock size={18} color={theme.warm} />
          </View>
          <Text style={{ ...type.subhead, color: theme.ink2, flex: 1 }}>
            {t('expenses.costTrend.lockedBody')}
          </Text>
          <Text style={{ ...type.bodyStrong, color: theme.warm }}>
            {t('expenses.costTrend.unlock')}
          </Text>
        </Pressable>
      ) : (
        <View testID="cost-trend-series" style={{ ...cardStyle, gap: space.lg }}>
          {series.map((s) => (
            <SeriesTrend
              key={s.currency}
              series={s}
              otherCount={trend.expenseCount - s.expenseCount}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}
