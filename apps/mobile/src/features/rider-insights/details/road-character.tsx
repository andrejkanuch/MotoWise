import type { MeasurementSystem } from '@motovault/types';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import type { RiderInsightsData } from '../use-rider-insights';
import { formatInsightDistance } from '../use-rider-insights';
import {
  formatNumber,
  formatPercent,
  LEAN_BANDS,
  type LeanBand,
  sharesOf,
  shortDate,
} from './detail-format';
import {
  BandSwatch,
  bandAlphas,
  Card,
  DetailHero,
  Footnote,
  openRide,
  RANK_ROW_INSET,
  RankWell,
  RowList,
  Section,
  ShareBar,
  SWATCH_ROW_INSET,
  ValueRow,
} from './detail-parts';

type RoadDetail = NonNullable<RiderInsightsData['roadCharacter']['detail']>;
type RankedRide = RoadDetail['twistiest'][number];
const STRAIGHTEST_SHOWN = 1;
type Lean = NonNullable<RoadDetail['lean']>;

const BAR_HEIGHT = 16;
const LEAN_CELL_HEIGHT = 12;
const LEAN_SEAM = 2;
/** Least and most ink a lean cell gets, scaled by its share of the biggest band. */
const LEAN_ALPHA = { min: 0.12, span: 0.8 } as const;

const BANDS = ['straight', 'sweeping', 'twisty', 'tight'] as const;
type Band = (typeof BANDS)[number];

const BAND_NAME: Record<Band, (t: TFunction) => string> = {
  straight: (t) => t('riderInsights.detail.roadCharacter.band.straight'),
  sweeping: (t) => t('riderInsights.detail.roadCharacter.band.sweeping'),
  twisty: (t) => t('riderInsights.detail.roadCharacter.band.twisty'),
  tight: (t) => t('riderInsights.detail.roadCharacter.band.tight'),
};

const BAND_RULE: Record<Band, (t: TFunction) => string> = {
  straight: (t) => t('riderInsights.detail.roadCharacter.rule.straight'),
  sweeping: (t) => t('riderInsights.detail.roadCharacter.rule.sweeping'),
  twisty: (t) => t('riderInsights.detail.roadCharacter.rule.twisty'),
  tight: (t) => t('riderInsights.detail.roadCharacter.rule.tight'),
};

const LEAN_LABEL: Record<LeanBand, (t: TFunction) => string> = {
  under20: (t) => t('riderInsights.detail.lean.band.under20'),
  from20to30: (t) => t('riderInsights.detail.lean.band.from20to30'),
  from30to40: (t) => t('riderInsights.detail.lean.band.from30to40'),
  from40: (t) => t('riderInsights.detail.lean.band.from40'),
};

interface Props {
  detail: RoadDetail;
  system: MeasurementSystem;
}

/** Road character: the band bar with km and share per band, the twistiest and straightest rides, and lean in bands. */
export function RoadCharacterDetail({ detail, system }: Props) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const language = instance.language;
  const alphas = bandAlphas(isDark);
  const kmOf = (km: number) => formatInsightDistance(km * 1000, system, language);
  const shares = sharesOf(BANDS.map((band) => detail.bandKm[band]));
  const bandText = BANDS.map(
    (band, i) => `${kmOf(detail.bandKm[band])}, ${formatPercent(shares[i], language)}`,
  );

  // One straightest ride is the contrast to the twistiest list; more reads as a ranking.
  const straightest = detail.straightest.slice(0, STRAIGHTEST_SHOWN);

  const rideRow = (ride: RankedRide, rank: number) => (
    <ValueRow
      key={ride.rideId}
      testID={`ride-${ride.rideId}`}
      leading={<RankWell rank={rank} />}
      title={
        ride.name ??
        i18n('riderInsights.howYouRide.bestRides.unnamed', {
          date: shortDate(ride.localDate, language),
        })
      }
      caption={
        // An unnamed ride is already titled by its date.
        ride.name === null
          ? formatInsightDistance(ride.distanceM, system, language)
          : i18n('riderInsights.detail.rideMeta', {
              date: shortDate(ride.localDate, language),
              distance: formatInsightDistance(ride.distanceM, system, language),
            })
      }
      value={ride.bendsPer10km === null ? '–' : formatNumber(ride.bendsPer10km, language, 1)}
      unit={i18n('riderInsights.detail.roadCharacter.per10km')}
      onPress={() => openRide(ride.rideId)}
    />
  );

  return (
    <>
      <View style={{ gap: space.sm }}>
        <DetailHero
          figure={formatPercent(shares[2] + shares[3], language)}
          line={i18n('riderInsights.detail.roadCharacter.heroLine', {
            distance: kmOf(detail.routedKm),
          })}
        />
        <Card>
          <View style={{ padding: space.md }}>
            <ShareBar
              testID="road-character-bar"
              shares={shares}
              alphas={alphas}
              height={BAR_HEIGHT}
              accessibilityLabel={i18n('riderInsights.detail.roadCharacter.barA11y', {
                straight: bandText[0],
                sweeping: bandText[1],
                twisty: bandText[2],
                tight: bandText[3],
              })}
            />
          </View>
          {BANDS.map((band, i) => (
            <View key={band}>
              {i > 0 ? (
                <View
                  style={{ height: 1, marginLeft: SWATCH_ROW_INSET, backgroundColor: t.line }}
                />
              ) : null}
              <ValueRow
                testID={`band-${band}`}
                leading={<BandSwatch alpha={alphas[i]} />}
                title={BAND_NAME[band](i18n)}
                caption={BAND_RULE[band](i18n)}
                value={kmOf(detail.bandKm[band])}
                unit={formatPercent(shares[i], language)}
              />
            </View>
          ))}
        </Card>
        <Footnote>
          {i18n('riderInsights.detail.roadCharacter.footnote', { count: detail.bendsCount })}
        </Footnote>
      </View>

      {detail.twistiest.length > 0 ? (
        <Section
          title={i18n('riderInsights.detail.roadCharacter.twistiest', {
            count: detail.twistiest.length,
          })}
        >
          <RowList
            inset={RANK_ROW_INSET}
            rows={detail.twistiest.map((r, i) => rideRow(r, i + 1))}
          />
        </Section>
      ) : null}

      {detail.straightest.length > 0 ? (
        <Section
          title={i18n('riderInsights.detail.roadCharacter.straightest', {
            count: straightest.length,
          })}
        >
          <RowList inset={RANK_ROW_INSET} rows={straightest.map((r, i) => rideRow(r, i + 1))} />
        </Section>
      ) : null}

      <Section title={i18n('riderInsights.detail.lean.title')}>
        <Card padded>
          {detail.lean ? (
            <LeanBands
              lean={detail.lean}
              withLean={detail.ridesWithLean}
              ofRides={detail.ridesWithBands}
            />
          ) : (
            <Text testID="lean-missing" style={[type.subhead, { color: t.ink2 }]}>
              {i18n('riderInsights.detail.lean.missing')}
            </Text>
          )}
          <Text style={[type.caption, { color: t.ink3 }]}>
            {i18n('riderInsights.detail.lean.note')}
          </Text>
        </Card>
      </Section>
    </>
  );
}

/**
 * Lean as the share of corners in four bands, with how many rides it comes
 * from. There is no single degree value anywhere: not as a figure, not in the
 * label.
 */
function LeanBands({ lean, withLean, ofRides }: { lean: Lean; withLean: number; ofRides: number }) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const max = Math.max(...LEAN_BANDS.map((band) => lean[band]));
  const percent = (band: LeanBand) => formatPercent(lean[band], language);

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: space.xs,
        }}
      >
        <Text style={[type.figure, { color: t.ink }]}>{formatNumber(lean.corners, language)}</Text>
        <Text style={[type.subhead, { color: t.ink2, flexShrink: 1 }]}>
          {i18n('riderInsights.detail.lean.corners', { count: lean.corners })}
        </Text>
      </View>
      <View
        testID="lean-bands"
        accessible
        accessibilityRole="image"
        accessibilityLabel={i18n('riderInsights.detail.lean.a11y', {
          under20: percent('under20'),
          from20to30: percent('from20to30'),
          from30to40: percent('from30to40'),
          from40: percent('from40'),
        })}
        style={{ flexDirection: 'row', gap: LEAN_SEAM }}
      >
        {LEAN_BANDS.map((band, i) => (
          <View key={band} style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
            <View
              style={{
                height: LEAN_CELL_HEIGHT,
                borderTopLeftRadius: i === 0 ? LEAN_CELL_HEIGHT / 2 : 0,
                borderBottomLeftRadius: i === 0 ? LEAN_CELL_HEIGHT / 2 : 0,
                borderTopRightRadius: i === LEAN_BANDS.length - 1 ? LEAN_CELL_HEIGHT / 2 : 0,
                borderBottomRightRadius: i === LEAN_BANDS.length - 1 ? LEAN_CELL_HEIGHT / 2 : 0,
                backgroundColor: tint(
                  t.ink,
                  LEAN_ALPHA.min + (max > 0 ? (lean[band] / max) * LEAN_ALPHA.span : 0),
                ),
              }}
            />
            <Text style={[type.subhead, { color: t.ink2 }]}>{LEAN_LABEL[band](i18n)}</Text>
            <Text style={[type.caption, { color: t.ink3 }]}>{percent(band)}</Text>
          </View>
        ))}
      </View>
      <Text testID="lean-coverage" style={[type.caption, { color: t.ink3 }]}>
        {i18n('riderInsights.detail.coverage', { count: withLean, total: ofRides })}
      </Text>
    </>
  );
}
