import type { MeasurementSystem } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import { formatArea, formatPercent, shortDate } from './detail-format';
import {
  bandAlphas,
  Card,
  DetailHero,
  Footnote,
  openRide,
  RowList,
  Section,
  ShareBar,
  ValueRow,
} from './detail-parts';

type TerritoryDetailData = NonNullable<RiderInsightsData['territory']['detail']>;

const BAR_HEIGHT = 16;

interface Props {
  detail: TerritoryDetailData;
  system: MeasurementSystem;
}

/** Territory: map area covered, the share of this season's distance on new roads, and the furthest point from home. */
export function TerritoryDetail({ detail, system }: Props) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const language = instance.language;
  const dist = (m: number) => formatInsightDistance(m, system, language);
  const alphas = bandAlphas(isDark);
  const newShare = detail.newRoadShare;
  const furthest = detail.furthest;

  return (
    <>
      <View style={{ gap: space.sm }}>
        <DetailHero
          figure={formatArea(detail.exploredKm2, system, language)}
          line={i18n('riderInsights.detail.territory.heroLine')}
        />
        {newShare !== null ? (
          <Card padded>
            <View style={{ gap: space.xxs }}>
              <Text style={[type.body, { color: t.ink }]}>
                {i18n('riderInsights.detail.territory.newRoads')}
              </Text>
              <Text style={[type.caption, { color: t.ink3 }]}>
                {i18n('riderInsights.detail.territory.newRoadsCaption', {
                  distance: dist(detail.newRoadM),
                  total: dist(detail.routedM),
                })}
              </Text>
            </View>
            <ShareBar
              testID="territory-new-roads-bar"
              shares={[newShare, 1 - newShare]}
              alphas={[alphas[3], alphas[0]]}
              height={BAR_HEIGHT}
              accessibilityLabel={i18n('riderInsights.detail.territory.barA11y', {
                share: formatPercent(newShare, language),
                before: formatPercent(1 - newShare, language),
              })}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={[type.subhead, { color: t.ink2 }]}>
                {i18n('riderInsights.detail.territory.newShare', {
                  share: formatPercent(newShare, language),
                })}
              </Text>
              <Text style={[type.subhead, { color: t.ink3, textAlign: 'right' }]}>
                {i18n('riderInsights.detail.territory.beforeShare', {
                  share: formatPercent(1 - newShare, language),
                })}
              </Text>
            </View>
          </Card>
        ) : null}
      </View>

      {furthest ? (
        <Section title={i18n('riderInsights.detail.territory.furthest')}>
          <RowList
            inset={space.md}
            rows={[
              <ValueRow
                key="furthest"
                testID="territory-furthest"
                title={i18n('riderInsights.detail.territory.furthestRide', {
                  date: shortDate(furthest.localDate, language),
                })}
                caption={i18n('riderInsights.detail.territory.fromHome')}
                value={dist(furthest.distanceM)}
                onPress={() => openRide(furthest.rideId)}
              />,
            ]}
          />
        </Section>
      ) : null}

      <Footnote>{i18n('riderInsights.detail.territory.footnote')}</Footnote>
    </>
  );
}
