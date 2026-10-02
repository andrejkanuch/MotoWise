import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
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
import { HUB_FONT, hub, RIDE_STATUS_STYLE } from '../ui/tokens';

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
  /** Performs the top attention row's action. Omit when there is nothing to open. */
  onPress?: () => void;
}

/**
 * Three words in serif on a tinted card: Not ready / Check before riding /
 * Ready to ride, or neutral "Nothing tracked yet". The words carry the meaning;
 * the dot and tint only repeat it.
 */
export function RideStatusCard({ status, reasons, onPress }: RideStatusCardProps) {
  const { t, i18n } = useTranslation();
  const style = RIDE_STATUS_STYLE[status];
  const title = t(style.titleKey);
  const detail =
    status === RIDE_STATUS.UNTRACKED
      ? t('bikeHub.rideStatus.untrackedHint')
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
