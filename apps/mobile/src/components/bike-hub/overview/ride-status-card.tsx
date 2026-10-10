import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import {
  RIDE_STATUS,
  RIDE_STATUS_REASON,
  type RideStatus,
  type RideStatusReasonKind,
} from '@/lib/bike-hub/constants';
import { midSentence } from '@/lib/bike-hub/format';
import type { RideStatusReason } from '@/lib/bike-hub/ride-status';
import { type } from '@/theme/type';
import type { PlateCopy } from '../../home/home-plate';
import { BikePlate, PLATE_SIZE, PLATE_STATE, type PlateState } from '../../ui/bike-plate';
import { HubCard } from '../ui/hub-card';
import { RowChevron } from '../ui/row-chevron';
import { HUB_TOUCH_TARGET, RIDE_STATUS_STYLE, SYSTEM_WEIGHT, useHubTheme } from '../ui/tokens';

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
  /**
   * The bike's plate (Home/Garage logic: `describePlate`). The card shows it
   * once tasks and documents are known; `null` keeps the plain card.
   */
  plate: PlateCopy | null;
}

const RIDE_PLATE_STATE: Record<RideStatus, PlateState> = {
  [RIDE_STATUS.NOT_READY]: PLATE_STATE.OVERDUE,
  [RIDE_STATUS.CHECK]: PLATE_STATE.DUE,
  [RIDE_STATUS.READY]: PLATE_STATE.READY,
  [RIDE_STATUS.UNTRACKED]: PLATE_STATE.READY,
};

const PLATE_SEVERITY: Record<PlateState, number> = {
  [PLATE_STATE.READY]: 0,
  [PLATE_STATE.DUE]: 1,
  [PLATE_STATE.OVERDUE]: 2,
};

/**
 * The bike's readiness as its plate (the Race Plate signature, as on Home and
 * Garage): bone = ready, signal yellow = due soon, red = overdue, with the
 * countdown to the most urgent task. Recalls and riding-blocking documents
 * escalate the plate and name themselves on it; the reasons line sits below.
 * "Nothing tracked yet" stays a plain card. Without loaded tasks and documents
 * it gives no verdict: a neutral skeleton while loading, an error with Retry.
 */
export function RideStatusCard({
  status,
  reasons,
  isLoading = false,
  isError = false,
  onRetry,
  noOpenRecalls = false,
  onPress,
  plate,
}: RideStatusCardProps) {
  const hub = useHubTheme();
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return (
      <HubCard
        testID="ride-status-loading"
        accessibilityLabel={t('common.loading')}
        style={{
          height: 76,
          backgroundColor: hub.card,
          borderColor: hub.hairline,
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
          backgroundColor: hub.card,
          borderColor: hub.hairline,
        }}
      >
        <Text
          style={{
            flex: 1,
            ...SYSTEM_WEIGHT.regular,
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
          <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 14, color: hub.copperText }}>
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

  // Nothing tracked: no verdict, so no plate — a plain card says so.
  if (status === RIDE_STATUS.UNTRACKED || !plate) {
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
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...type.sheetTitle, color: hub.text }}>{title}</Text>
          {detail ? (
            <Text
              style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 17, color: hub.dim }}
            >
              {detail}
            </Text>
          ) : null}
        </View>
        {onPress ? <RowChevron /> : null}
      </HubCard>
    );
  }

  // The plate: the same task countdown as Home and Garage, escalated when the
  // ride status (recalls, riding-blocking documents) is more severe than it.
  const rideState = RIDE_PLATE_STATE[status];
  const escalated = PLATE_SEVERITY[rideState] > PLATE_SEVERITY[plate.state];
  const state = escalated ? rideState : plate.state;
  const stateLabel = escalated ? title : plate.stateLabel;
  const caption = escalated && detail ? detail : plate.caption;
  const showDetail = Boolean(detail) && caption !== detail;
  const testID = `ride-status-${status}`;
  const accessibilityLabel = [stateLabel, `${plate.figure} ${plate.unit ?? ''}`.trim(), caption]
    .concat(showDetail ? [detail] : [])
    .join('. ');

  return (
    <View testID={onPress ? undefined : testID} style={{ gap: 8 }}>
      <BikePlate
        state={state}
        figure={plate.figure}
        unit={plate.unit}
        caption={caption}
        stateLabel={stateLabel}
        // An escalated plate's caption is the reasons line: print the verdict before it.
        captionSaysState={escalated ? false : undefined}
        size={PLATE_SIZE.COMPACT}
        onPress={onPress}
        testID={onPress ? testID : undefined}
        accessibilityLabel={accessibilityLabel}
      />
      {showDetail ? (
        <Text
          style={{
            ...SYSTEM_WEIGHT.regular,
            fontSize: 13,
            lineHeight: 17,
            color: hub.dim,
            paddingHorizontal: 2,
          }}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
