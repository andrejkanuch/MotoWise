import { CURRENCY_TOTALS_SEPARATOR, type Currency } from '@motovault/types';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useCurrency } from '@/hooks/use-currency';
import {
  COSTS_REST_KEY,
  DELTA_DIRECTION,
  type DeltaDirection,
} from '@/lib/bike-hub/constants';
import type { CostsShare, CostsSummary } from '@/lib/bike-hub/costs-summary';
import { CATEGORY_LABELS, formatCurrency } from '@/lib/expense-constants';
import { HubCard } from '../ui/hub-card';
import { REFRESH_BLOCK, RefreshFailed } from '../ui/refresh-failed';
import { RowChevron } from '../ui/row-chevron';
import { SectionHeader } from '../ui/section-header';
import { Stat } from '../ui/stat';
import {
  HUB_FIGURE_STRONG,
  HUB_TOUCH_TARGET,
  type HubColorKey,
  type HubCopyKey,
  type HubTheme,
  hubCategoryColor,
  SYSTEM_WEIGHT,
  useHubTheme,
} from '../ui/tokens';

// Spending more is not "due soon" and spending less is not "ready": the change
// is a fact, so it reads in Bone with its arrow, never in a status colour.
const YOY_STYLE: Record<DeltaDirection, { arrow: string; color: HubColorKey }> = {
  [DELTA_DIRECTION.UP]: { arrow: '▲', color: 'text' },
  [DELTA_DIRECTION.DOWN]: { arrow: '▼', color: 'text' },
  [DELTA_DIRECTION.FLAT]: { arrow: '=', color: 'dim' },
};

/** Whole currency units ("€218") — for averages and the purchase price. */
function formatWhole(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function categoryLabel(key: string, t: TFunction): string {
  if (key === COSTS_REST_KEY) return t('bikeHub.costs.rest');
  return t(`expenses.category_${key}` as HubCopyKey, { defaultValue: CATEGORY_LABELS[key] ?? key });
}

function shareColor(share: CostsShare, hub: HubTheme): string {
  return share.key === COSTS_REST_KEY ? hub.track : hubCategoryColor(share.key, hub);
}

interface CostsCardProps {
  year: number;
  summary: CostsSummary;
  purchasePrice: number | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Figures are from the cache: the latest refetch failed. */
  refreshFailed?: boolean;
  /** Card and "Full analytics" both open the Costs segment. */
  onPress: () => void;
}

/**
 * "Costs · 2026": the year's total, the change against the same period of last
 * year, the category bar and three stats. No cost-per-distance figure. The
 * card is one pressable; the stats inside are not.
 */
export function CostsCard({
  year,
  summary,
  purchasePrice,
  isLoading,
  isError,
  onRetry,
  refreshFailed = false,
  onPress,
}: CostsCardProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  // The rider's display currency only prices the bike; spend is shown in the
  // currency it was recorded in (`summary.currency`).
  const { currency: userCurrency } = useCurrency();
  const { currency } = summary;
  const format = (amount: number) => formatCurrency(amount, currency);
  const title = t('bikeHub.costs.title');

  if (isLoading) {
    return (
      <View testID="costs-loading" style={{ gap: 8 }} accessibilityLabel={t('common.loading')}>
        <SectionHeader label={title} count={year} />
        <HubCard style={{ height: 150, opacity: 0.6 }}>{null}</HubCard>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ gap: 8 }}>
        <SectionHeader label={title} count={year} />
        <HubCard
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 6,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ flex: 1, ...SYSTEM_WEIGHT.regular, fontSize: 14, color: hub.dim }}>
            {t('bikeHub.costs.loadError')}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={{ minHeight: HUB_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 14, color: hub.copperText }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </HubCard>
      </View>
    );
  }

  // Spend in other currencies is listed beside the headline, never added to it.
  const total = [
    format(summary.total),
    ...summary.otherCurrencyTotals.map((group) => formatCurrency(group.total, group.currency)),
  ].join(CURRENCY_TOTALS_SEPARATOR);

  if (summary.total === 0) {
    return (
      <View testID="costs-empty" style={{ gap: 8 }}>
        <SectionHeader label={title} count={year} />
        <HubCard
          onPress={onPress}
          accessibilityLabel={t('bikeHub.costs.cardA11y', { year, total })}
          style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 2 }}
        >
          <Text
            style={{
              ...HUB_FIGURE_STRONG,
              fontSize: 28,
              lineHeight: 30,
              color: hub.text,
            }}
          >
            {total}
          </Text>
          <Text style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 17, color: hub.dim }}>
            {purchasePrice
              ? t('bikeHub.costs.emptyWithPrice', {
                  price: formatWhole(purchasePrice, userCurrency),
                })
              : t('bikeHub.costs.empty')}
          </Text>
        </HubCard>
      </View>
    );
  }

  const { yoy, topCategory } = summary;
  const yoyStyle = yoy ? YOY_STYLE[yoy.direction] : null;

  return (
    <View testID="costs-card" style={{ gap: 8 }}>
      <SectionHeader
        label={title}
        count={year}
        action={{ label: t('bikeHub.costs.full'), onPress }}
      />
      {refreshFailed ? (
        <RefreshFailed
          block={REFRESH_BLOCK.COSTS}
          testID="costs-refresh-failed"
          onRetry={onRetry}
        />
      ) : null}
      <HubCard
        onPress={onPress}
        accessibilityLabel={t('bikeHub.costs.cardA11y', { year, total })}
        style={{ padding: 16, gap: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                ...HUB_FIGURE_STRONG,
                fontSize: 32,
                lineHeight: 34,
                letterSpacing: -0.64,
                color: hub.text,
              }}
            >
              {total}
            </Text>
            {yoy && yoyStyle ? (
              <Text testID="costs-yoy" style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13 }}>
                <Text style={{ color: hub[yoyStyle.color] }}>
                  {`${yoyStyle.arrow} ${t('bikeHub.costs.percent', { value: yoy.percent })}`}
                </Text>
                <Text style={{ color: hub.muted }}>
                  {` ${t('bikeHub.costs.vsSamePeriod', { year: year - 1 })}`}
                </Text>
              </Text>
            ) : null}
          </View>
          <RowChevron />
        </View>

        <View
          style={{
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
            flexDirection: 'row',
            gap: 2,
          }}
        >
          {summary.shares.map((share) => (
            <View
              key={share.key}
              accessible
              accessibilityLabel={t('bikeHub.costs.shareA11y', {
                category: categoryLabel(share.key, t),
                percent: share.percent,
              })}
              style={{
                flexGrow: share.percent,
                flexBasis: 0,
                backgroundColor: shareColor(share, hub),
              }}
            />
          ))}
        </View>

        <View
          style={{
            flexDirection: 'row',
            // Values share a baseline even when one eyebrow wraps to two lines.
            alignItems: 'flex-end',
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: hub.hairline,
            paddingTop: 12,
          }}
        >
          <Stat
            compact
            eyebrow={t('bikeHub.costs.thisMonth')}
            value={format(summary.thisMonth)}
            valueStyle={{ fontSize: 16 }}
          />
          <Stat
            compact
            eyebrow={t('bikeHub.costs.perMonth', { year })}
            value={formatWhole(summary.perMonth, currency)}
            valueStyle={{ fontSize: 16 }}
          />
          {topCategory ? (
            <Stat
              compact
              eyebrow={t('bikeHub.costs.topCategory')}
              value={t('bikeHub.costs.topCategoryValue', {
                category: categoryLabel(topCategory.key, t),
                percent: topCategory.percent,
              })}
              valueStyle={{
                ...SYSTEM_WEIGHT.semibold,
                fontSize: 14,
                color: hub.text,
              }}
            />
          ) : null}
        </View>
      </HubCard>
    </View>
  );
}
