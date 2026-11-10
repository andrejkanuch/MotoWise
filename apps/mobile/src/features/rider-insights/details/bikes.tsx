import type { MeasurementSystem } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { formatDuration } from '@/utils/ride-formatters';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import { sharesOf } from './detail-format';
import { bandAlphas, Card, DetailHero, RowList, ShareBar, ValueRow } from './detail-parts';

type BikeItem = NonNullable<RiderInsightsData['bikes']['items']>[number];

const BAR_HEIGHT = 16;

/**
 * Bikes in the order they show: by distance, with rides that had no bike set
 * last, under "Unassigned".
 */
export function orderBikes(items: readonly BikeItem[]): BikeItem[] {
  const assigned = items
    .filter((item) => item.motorcycleId !== null)
    .sort((a, b) => b.distanceM - a.distanceM);
  const unassigned = items.filter((item) => item.motorcycleId === null);
  return [...assigned, ...unassigned];
}

/** Bikes (free): distance, rides and moving hours per bike, plus Unassigned. */
export function BikesDetail({
  items,
  system,
}: {
  items: readonly BikeItem[];
  system: MeasurementSystem;
}) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { isDark } = useEditorialTheme();
  const language = instance.language;
  const bikes = orderBikes(items);
  const total = bikes.reduce((sum, bike) => sum + bike.distanceM, 0);
  const alphas = bandAlphas(isDark);
  const name = (bike: BikeItem) =>
    bike.motorcycleId === null
      ? i18n('riderInsights.detail.bikes.unassigned')
      : (bike.name ?? i18n('riderInsights.howYouRide.bikes.unnamed'));
  const dist = (m: number) => formatInsightDistance(m, system, language);
  // Darkest ink for the bike ridden most, fading down the list.
  const barAlphas = bikes.map((_, i) => alphas[Math.max(0, alphas.length - 1 - i)]);

  return (
    <>
      <View style={{ gap: space.sm }}>
        <DetailHero figure={dist(total)} line={i18n('riderInsights.detail.bikes.heroLine')} />
        {bikes.length > 1 ? (
          <Card padded>
            <ShareBar
              testID="bikes-bar"
              shares={sharesOf(bikes.map((bike) => bike.distanceM))}
              alphas={barAlphas}
              height={BAR_HEIGHT}
              accessibilityLabel={bikes
                .map((bike) =>
                  i18n('riderInsights.howYouRide.bikes.item', {
                    name: name(bike),
                    distance: dist(bike.distanceM),
                  }),
                )
                .join(', ')}
            />
          </Card>
        ) : null}
      </View>
      <RowList
        inset={space.md}
        rows={bikes.map((bike) => (
          <ValueRow
            key={bike.motorcycleId ?? 'unassigned'}
            testID={`bike-${bike.motorcycleId ?? 'unassigned'}`}
            title={name(bike)}
            caption={i18n('riderInsights.detail.bikes.meta', {
              count: bike.rides,
              time: formatDuration(bike.movingTimeS),
            })}
            value={dist(bike.distanceM)}
          />
        ))}
      />
    </>
  );
}
