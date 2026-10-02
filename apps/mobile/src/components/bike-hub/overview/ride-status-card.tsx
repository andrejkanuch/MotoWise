import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import {
  RIDE_STATUS,
  RIDE_STATUS_REASON,
  type RideStatus,
  type RideStatusReasonKind,
} from '../../../lib/bike-hub/constants';
import { midSentence } from '../../../lib/bike-hub/format';
import type { RideStatusReason } from '../../../lib/bike-hub/ride-status';
import { HubCard } from '../ui/hub-card';
import { RowChevron } from '../ui/row-chevron';
import { HUB_FONT, HUB_TOUCH_TARGET, hub, RIDE_STATUS_STYLE } from '../ui/tokens';

const SEPARATOR = ' · ';

type ReasonOf<K extends RideStatusReasonKind> = Extract<RideStatusReason, { kind: K }>;
type ReasonCopy = {
  [K in RideStatusReasonKind]: (reason: ReasonOf<K>, t: TFunction, category: string) => string;
};

const REASON_COPY: ReasonCopy = {
  [RIDE_STATUS_REASON.OPEN_RECALLS]: (reason, t) =>
    t('bikeHub.rideStatus.reason.openRecalls', { count: reason.count }),
  [RIDE_STATUS_REASON.OVERDUE_CRITICAL]: (reason, t) =>
    t('bikeHub.rideStatus.reason.overdueCritical', { count: reason.count }),
  [RIDE_STATUS_REASON.OVERDUE_HIGH]: (reason, t) =>
    t('bikeHub.rideStatus.reason.overdueHigh', { count: reason.count }),
  [RIDE_STATUS_REASON.DOCUMENT_EXPIRED]: (_reason, t, category) =>
    t('bikeHub.rideStatus.reason.documentExpired', { category }),
  [RIDE_STATUS_REASON.DOCUMENT_EXPIRING]: (reason, t, category) =>
    reason.days === 0
      ? t('bikeHub.rideStatus.reason.documentExpiresToday', { category })
      : t('bikeHub.rideStatus.reason.documentExpiresIn', { category, count: reason.days }),
};

function describeReason(
  reason: RideStatusReason,
  index: number,
  t: TFunction,
  language: string,
): string {
  const name = 'categoryName' in reason ? reason.categoryName : '';
  // The first fragment starts the line and keeps its capital.
  const category = index === 0 ? name : midSentence(name, language);
  const copy = REASON_COPY[reason.kind] as (r: RideStatusReason, t: TFunction, c: string) => string;
  return copy(reason, t, category);
}

/** "1 open recall · 1 overdue high task · insurance expires in 12 days". */
export function describeRideStatusReasons(
  reasons: readonly RideStatusReason[],
  t: TFunction,
  language: string,
): string {
  return reasons.map((reason, index) => describeReason(reason, index, t, language)).join(SEPARATOR);
}

interface RideStatusCardProps {
  status: RideStatus;
  reasons: readonly RideStatusReason[];
  /** Tasks or documents are still loading: no verdict yet. */
  isLoading?: boolean;
  /** Tasks or documents failed to load: no verdict, offer Retry. */
  isError?: boolean;
  onRetry?: () => void;
  /** The recalls list is loaded and empty — only then may the card say "No open recalls." */
  noOpenRecalls?: boolean;
  /** Performs the top attention row's action. Omit when there is nothing to open. */
  onPress?: () => void;
}

const NEUTRAL = RIDE_STATUS_STYLE[RIDE_STATUS.UNTRACKED];

/**
 * Three words in serif on a tinted card: Not ready / Check before riding /
 * Ready to ride, or neutral "Nothing tracked yet". The words carry the meaning;
 * the dot and tint only repeat it. Without loaded tasks and documents it gives
 * no verdict: a neutral skeleton while loading, an error with Retry on failure.
 */
export function RideStatusCard({
  status,
  reasons,
  isLoading = false,
  isError = false,
  onRetry,
  noOpenRecalls = false,
  onPress,
}: RideStatusCardProps) {
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return (
      <HubCard
        testID="ride-status-loading"
        accessibilityLabel={t('common.loading')}
        style={{
          height: 76,
          backgroundColor: NEUTRAL.card,
          borderColor: NEUTRAL.border,
          opacity: 0.6,
        }}
      >
        {null}
      </HubCard>
    );
  }

  if (isError) {
    return (
      <HubCard
        testID="ride-status-error"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          paddingLeft: 16,
          paddingRight: 8,
          backgroundColor: NEUTRAL.card,
          borderColor: NEUTRAL.border,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: HUB_FONT.sans,
            fontSize: 14,
            lineHeight: 19,
            color: hub.dim,
          }}
        >
          {t('bikeHub.rideStatus.loadError')}
        </Text>
        <Pressable
          testID="ride-status-retry"
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: HUB_TOUCH_TARGET,
            justifyContent: 'center',
            paddingHorizontal: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.copperText }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </HubCard>
    );
  }

  const style = RIDE_STATUS_STYLE[status];
  const title = t(style.titleKey);
  const detail =
    status === RIDE_STATUS.UNTRACKED
      ? // One sentence pair per locale: joining two keys with ' ' is wrong for ja/th.
        t(
          noOpenRecalls
            ? 'bikeHub.rideStatus.untrackedHintNoRecalls'
            : 'bikeHub.rideStatus.untrackedHint',
        )
      : describeRideStatusReasons(reasons, t, i18n.language);

  return (
    <HubCard
      testID={`ride-status-${status}`}
      onPress={onPress}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 14,
        backgroundColor: style.card,
        borderColor: style.border,
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: style.dot }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: HUB_FONT.serif, fontSize: 24, lineHeight: 26, color: hub.text }}>
          {title}
        </Text>
        {detail ? (
          <Text style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 17, color: hub.dim }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onPress ? <RowChevron /> : null}
    </HubCard>
  );
}
