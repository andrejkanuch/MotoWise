import type { MeasurementSystem } from '@motovault/types';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ThemedSegmentedControl } from '@/components/ui/themed-segmented-control';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import { formatDuration } from '@/utils/ride-formatters';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import { formatClimb, formatNumber, shortDate } from './detail-format';
import {
  Footnote,
  openRide,
  RANK_ROW_INSET,
  RankWell,
  RowList,
  Section,
  UnlockButton,
  ValueRow,
} from './detail-parts';

type BestRidesDetailData = NonNullable<RiderInsightsData['bestRides']['detail']>;
type BestRide = BestRidesDetailData['byDistance'][number];
type LongestRide = NonNullable<RiderInsightsData['longestRide']>;

/** The ranking switch, in the order the segments show. Distance is the free one. */
export const BEST_RIDES_METRIC = { DISTANCE: 'distance', CLIMB: 'climb', BENDS: 'bends' } as const;
type Metric = (typeof BEST_RIDES_METRIC)[keyof typeof BEST_RIDES_METRIC];
const METRICS: readonly Metric[] = [
  BEST_RIDES_METRIC.DISTANCE,
  BEST_RIDES_METRIC.CLIMB,
  BEST_RIDES_METRIC.BENDS,
];

const SEGMENT_LABEL: Record<Metric, (t: TFunction) => string> = {
  distance: (t) => t('riderInsights.detail.bestRides.segment.distance'),
  climb: (t) => t('riderInsights.detail.bestRides.segment.climb'),
  bends: (t) => t('riderInsights.detail.bestRides.segment.bends'),
};

const LIST: Record<Metric, (detail: BestRidesDetailData) => BestRide[]> = {
  distance: (detail) => detail.byDistance,
  climb: (detail) => detail.byClimb,
  bends: (detail) => detail.byBends,
};

function rideTitle(
  ride: { name: string | null; localDate: string },
  t: TFunction,
  language: string,
) {
  return (
    ride.name ??
    t('riderInsights.howYouRide.bestRides.unnamed', { date: shortDate(ride.localDate, language) })
  );
}

interface SwitchProps {
  selected: Metric;
  onSelect: (metric: Metric) => void;
  /** Bumped to put a native control back on the selected segment after a refused tap. */
  resetKey?: number;
}

function MetricSwitch({ selected, onSelect, resetKey = 0 }: SwitchProps) {
  const { t: i18n } = useTranslation();
  return (
    <ThemedSegmentedControl
      key={resetKey}
      testID="best-rides-switch"
      values={METRICS.map((metric) => SEGMENT_LABEL[metric](i18n))}
      selectedIndex={METRICS.indexOf(selected)}
      onChange={(index) => {
        const metric = METRICS[index];
        if (metric) onSelect(metric);
      }}
    />
  );
}

/** Pro: the season's rides ranked by distance, climb or bends per 10 km; each opens. */
export function BestRidesDetail({
  detail,
  system,
}: {
  detail: BestRidesDetailData;
  system: MeasurementSystem;
}) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const [metric, setMetric] = useState<Metric>(BEST_RIDES_METRIC.DISTANCE);
  const rides = LIST[metric](detail);

  const value = (ride: BestRide): { value: string; unit: string | null } => {
    if (metric === BEST_RIDES_METRIC.CLIMB) {
      return {
        value: ride.climbM === null ? '–' : formatClimb(ride.climbM, system, language),
        unit: null,
      };
    }
    if (metric === BEST_RIDES_METRIC.BENDS) {
      return {
        value: ride.bendsPer10km === null ? '–' : formatNumber(ride.bendsPer10km, language, 1),
        unit: i18n('riderInsights.detail.roadCharacter.per10km'),
      };
    }
    return { value: formatInsightDistance(ride.distanceM, system, language), unit: null };
  };

  return (
    <>
      <MetricSwitch selected={metric} onSelect={setMetric} />
      {rides.length > 0 ? (
        <RowList
          inset={RANK_ROW_INSET}
          rows={rides.map((ride, i) => (
            <ValueRow
              key={ride.rideId}
              testID={`best-ride-${i}`}
              leading={<RankWell rank={i + 1} />}
              title={rideTitle(ride, i18n, language)}
              caption={[
                shortDate(ride.localDate, language),
                metric === BEST_RIDES_METRIC.DISTANCE
                  ? null
                  : formatInsightDistance(ride.distanceM, system, language),
                ride.movingTimeS === null ? null : formatDuration(ride.movingTimeS),
              ]
                .filter(Boolean)
                .join(' · ')}
              {...value(ride)}
              onPress={() => openRide(ride.rideId)}
            />
          ))}
        />
      ) : (
        <Text
          testID="best-rides-empty"
          style={[type.subhead, { color: t.ink2, marginHorizontal: space.md }]}
        >
          {i18n('riderInsights.detail.bestRides.empty')}
        </Text>
      )}
      <Footnote>{i18n('riderInsights.detail.bestRides.footnote')}</Footnote>
    </>
  );
}

interface FreeProps {
  longest: LongestRide | null;
  /** How many rides Pro ranks (the group's rounded headline), when known. */
  rankedCount: number | null;
  system: MeasurementSystem;
  unlocking: boolean;
  onUnlock: () => void;
}

/**
 * Free: the longest ride in full, with the ranking switch on show. Distance is
 * the only segment a free rider can pick; climb and bends open the paywall.
 */
export function BestRidesFree({ longest, rankedCount, system, unlocking, onUnlock }: FreeProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <MetricSwitch
        selected={BEST_RIDES_METRIC.DISTANCE}
        resetKey={resetKey}
        onSelect={(metric) => {
          if (metric === BEST_RIDES_METRIC.DISTANCE) return;
          setResetKey((k) => k + 1);
          if (!unlocking) onUnlock();
        }}
      />
      {longest ? (
        <Section title={i18n('riderInsights.detail.bestRides.longest')}>
          <RowList
            inset={RANK_ROW_INSET}
            rows={[
              <ValueRow
                key={longest.rideId}
                testID="best-ride-longest"
                leading={<RankWell rank={1} />}
                title={rideTitle(longest, i18n, language)}
                caption={[
                  shortDate(longest.localDate, language),
                  longest.startPlace && longest.endPlace
                    ? i18n('riderInsights.detail.bestRides.places', {
                        start: longest.startPlace,
                        end: longest.endPlace,
                      })
                    : null,
                  formatDuration(longest.movingTimeS ?? longest.durationS),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={formatInsightDistance(longest.distanceM, system, language)}
                onPress={() => openRide(longest.rideId)}
              />,
            ]}
          />
        </Section>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Text style={[type.subhead, { color: t.ink2, marginHorizontal: space.md }]}>
          {rankedCount === null
            ? i18n('riderInsights.detail.bestRides.proLineDefault')
            : i18n('riderInsights.detail.bestRides.proLine', { count: rankedCount })}
        </Text>
        <UnlockButton
          label={
            unlocking
              ? i18n('riderInsights.howYouRide.unlocking')
              : i18n('riderInsights.howYouRide.unlock')
          }
          disabled={unlocking}
          onPress={onUnlock}
        />
      </View>
    </>
  );
}
