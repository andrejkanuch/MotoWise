/**
 * One season-recap card, story-sized (9:16) and always graphite, whatever the
 * app theme: it is an image the rider keeps or posts. Everything is laid out
 * on a 200-unit-wide grid and scaled to the width it renders at, so the card
 * on screen and the 1080 px export are the same picture.
 */
import { palette } from '@motovault/design-system';
import { type MeasurementSystem, metersToUnit, mileageUnitLabel } from '@motovault/types';
import { Image } from 'expo-image';
import type { TFunction } from 'i18next';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, type TextStyle, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { routesBounds, shareRoutes } from '@/components/share/insights-share';
import type { LngLat } from '@/components/share/share-card-types';
import { tDynamic } from '@/i18n/t-dynamic';
import { tint } from '@/theme/editorial';
import { PLATE_FONT, radius, SYSTEM_WEIGHT } from '@/theme/type';
import { BlurCapture, blurCaptureKey } from '../blur-capture';
import { plateLettersFor } from '../country-codes';
import { formatArea, formatNumber, formatPercent, shortDate } from '../details/detail-format';
import { busiestSlot, gridLevels } from '../how-you-ride-list';
import {
  fitViewport,
  projectPoint,
  STATIC_STYLE,
  staticMapUrl,
  type Viewport,
} from '../region-tiles';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import {
  busiestCell,
  costOfRiding,
  DAY_PART_HOURS,
  formatCostPerUnit,
  RECAP_CARD,
  RECAP_STATE,
  type RecapCard,
  type RecapCardState,
} from './recap-model';
import { useRecapRideRoute } from './use-recap-ride-route';

/** The card's grid width; every size below is in these units. */
export const RECAP_UNITS_WIDTH = 200;
/** A story: 9:16. */
export const RECAP_ASPECT = 16 / 9;

const INK = {
  ground: palette.plateG0,
  card: palette.plateG1,
  cell: palette.plateG2,
  strong: palette.plateInk,
  soft: palette.plateInk2,
  muted: palette.plateInk3,
  route: palette.plateCopper,
  link: palette.plateCopperText,
  oval: palette.plateBone,
  onOval: palette.plateOnPlate,
} as const;

/** Layout in card units. */
const U = {
  insetX: 16,
  insetTop: 18,
  panelInset: 14,
  stackGap: 10,
  listGap: 14,
  mapHeight: 250,
  mapPadding: 16,
  mapRoute: 1.7,
  shape: 168,
  shapePadding: 10,
  shapeRoute: 4.2,
  ovalWidth: 52,
  ovalHeight: 32,
  cellHeight: 16,
  cellSeam: 3,
  blurHeight: 120,
  bandHeight: 28,
} as const;

/** Type sizes in card units: [fontSize, lineHeight]. */
const SIZE = {
  hero: [72, 72],
  big: [56, 56],
  figure: [40, 40],
  slot: [36, 36],
  area: [28, 30],
  oval: [20, 22],
  title: [20, 24],
  body: [15, 20],
  label: [13, 17],
  meta: [12, 16],
  axis: [11, 14],
} as const;

/** Ink strength of the rhythm grid's levels 1-3 (0 is an empty cell). */
const GRID_ALPHAS = [0, 0.36, 0.62, 0.92] as const;
/** Ink strength of the four road bands in the locked teaser, straight to tight. */
const BAND_ALPHAS = [0.16, 0.36, 0.62, 0.92] as const;
/** Countries listed on the card; the rest fold into "+N more". */
const LISTED_COUNTRIES = 4;
const BLUR_RADIUS = 6;
/** A neutral shape for the locked cost card: it carries no data at all. */
const COST_SHAPE = [0.9, 0.6, 0.75] as const;

const TITLE: Record<RecapCard, (t: TFunction) => string> = {
  [RECAP_CARD.DISTANCE]: (t) => t('riderInsights.recap.title'),
  [RECAP_CARD.COUNTRIES]: (t) => t('riderInsights.detail.countries.title'),
  [RECAP_CARD.LONGEST]: (t) => t('riderInsights.recap.longest'),
  [RECAP_CARD.RHYTHM]: (t) => t('riderInsights.recap.rhythm'),
  [RECAP_CARD.NEW_ROADS]: (t) => t('riderInsights.recap.newRoads'),
  [RECAP_CARD.TWISTIEST]: (t) => t('riderInsights.recap.twistiest'),
  [RECAP_CARD.COST]: (t) => t('riderInsights.recap.cost'),
};

/** A card's name: what a locked card shows over its blur. */
export function recapCardTitle(card: RecapCard, t: TFunction): string {
  return TITLE[card](t);
}

const MISSING_LINE: Record<RecapCard, (t: TFunction) => string> = {
  [RECAP_CARD.DISTANCE]: (t) => t('riderInsights.hero.noRoutes'),
  [RECAP_CARD.COUNTRIES]: (t) => t('riderInsights.hero.noRoutes'),
  [RECAP_CARD.LONGEST]: (t) => t('riderInsights.howYouRide.computing'),
  [RECAP_CARD.RHYTHM]: (t) => t('riderInsights.howYouRide.rhythm.missing'),
  [RECAP_CARD.NEW_ROADS]: (t) => t('riderInsights.howYouRide.missingRoute'),
  [RECAP_CARD.TWISTIEST]: (t) => t('riderInsights.howYouRide.missingRoute'),
  [RECAP_CARD.COST]: (t) => t('riderInsights.recap.costMissing'),
};

// ── Frame and text ───────────────────────────────────────────────────────────

interface Scale {
  s: number;
  width: number;
  height: number;
}

/** A text style from a size pair, scaled. */
function font(size: readonly [number, number], s: number, figure = false): TextStyle {
  return {
    fontSize: size[0] * s,
    lineHeight: size[1] * s,
    ...(figure ? { fontFamily: PLATE_FONT.semibold, fontVariant: ['tabular-nums'] } : null),
  };
}

/** Card text never follows the font scale: the card is a fixed picture. */
function CardText({
  style,
  children,
  lines,
}: {
  style: TextStyle[];
  children: ReactNode;
  lines?: number;
}) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={lines}
      adjustsFontSizeToFit={lines === 1}
      style={style}
    >
      {children}
    </Text>
  );
}

interface FrameProps {
  testID: string;
  scale: Scale;
  rounded: boolean;
  /** The text a screen reader hears for the whole card. */
  label: string;
  ground?: string;
  padded?: boolean;
  /** The card's map and route shape have loaded (or failed): it can be captured. */
  settled?: boolean;
  onReady?: () => void;
  children: ReactNode;
}

function Frame({
  testID,
  scale,
  rounded,
  label,
  ground = INK.card,
  padded = true,
  settled = true,
  onReady,
  children,
}: FrameProps) {
  useEffect(() => {
    if (settled) onReady?.();
  }, [settled, onReady]);
  const { s, width, height } = scale;
  return (
    <View
      testID={testID}
      collapsable={false}
      accessible
      accessibilityLabel={label}
      style={{
        width,
        height,
        overflow: 'hidden',
        borderRadius: rounded ? radius.card : 0,
        borderCurve: 'continuous',
        backgroundColor: ground,
        paddingHorizontal: padded ? U.insetX * s : 0,
        paddingTop: padded ? U.insetTop * s : 0,
        paddingBottom: padded ? U.insetTop * s : 0,
        gap: U.stackGap * s,
      }}
    >
      {children}
    </View>
  );
}

const joined = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join('. ');

// ── Shapes ───────────────────────────────────────────────────────────────────

/** Routes as SVG paths in a `size` box, trimmed at both ends like every share image. */
function routePaths(
  encoded: readonly string[],
  box: { width: number; height: number },
  viewport: Viewport | null,
  padding: number,
): string[] {
  const routes = shareRoutes(encoded, true);
  const bounds = routesBounds(routes);
  if (!bounds) return [];
  const camera = viewport ?? fitViewport(bounds, box.width, box.height, padding);
  return routes.map((route: LngLat[]) =>
    route
      .map((point, i) => {
        const [x, y] = projectPoint(point, camera, box.width, box.height);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' '),
  );
}

function RouteShape({ route, s }: { route: string | null; s: number }) {
  const size = U.shape * s;
  const paths = useMemo(
    () =>
      route ? routePaths([route], { width: size, height: size }, null, U.shapePadding * s) : [],
    [route, size, s],
  );
  return (
    <Svg width={size} height={size} accessibilityElementsHidden>
      {paths.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: one route, split only by the trim
          key={i}
          d={d}
          stroke={INK.route}
          strokeWidth={U.shapeRoute * s * (U.shape / RECAP_UNITS_WIDTH)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

/** Weekday rows by day-part columns, levels 0-3. */
function RhythmCells({ levels, s }: { levels: readonly (readonly number[])[]; s: number }) {
  return (
    <View style={{ gap: U.cellSeam * s }}>
      {levels.map((parts, day) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed weekdays
        <View key={day} style={{ flexDirection: 'row', gap: U.cellSeam * s }}>
          {parts.map((level, part) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: four fixed day parts
              key={part}
              style={{
                flex: 1,
                height: U.cellHeight * s,
                borderRadius: U.cellSeam * s,
                backgroundColor: level > 0 ? tint(INK.strong, GRID_ALPHAS[level]) : INK.cell,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Free cards ───────────────────────────────────────────────────────────────

interface BodyProps {
  testID: string;
  insights: RiderInsightsData;
  scale: Scale;
  rounded: boolean;
  system: MeasurementSystem;
  onReady?: () => void;
}

function DistanceCard({ testID, insights, scale, rounded, system, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s, width } = scale;
  const mapHeight = U.mapHeight * s;
  const main = insights.regions[0] ?? null;
  const year = Number(insights.season.from.slice(0, 4));

  const { url, paths } = useMemo(() => {
    if (!main?.bounds) return { url: null, paths: [] };
    const viewport = fitViewport(main.bounds, width, mapHeight, U.mapPadding * s);
    return {
      url: staticMapUrl(STATIC_STYLE.DARK, viewport, width, mapHeight),
      paths: routePaths(main.routes, { width, height: mapHeight }, viewport, 0),
    };
  }, [main, width, mapHeight, s]);
  const [mapSettled, setMapSettled] = useState(false);

  const distance = formatInsightDistance(insights.totals.distanceM, system, i18n.language);
  const rides = t('riderInsights.recap.ridesIn', { count: insights.totals.rides, year });

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(distance, rides)}
      ground={INK.ground}
      padded={false}
      settled={url === null || mapSettled}
      onReady={onReady}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ position: 'absolute', top: 0, left: 0, width, height: mapHeight }}
          onLoad={() => setMapSettled(true)}
          onError={() => setMapSettled(true)}
          accessible={false}
        />
      ) : null}
      <Svg width={width} height={mapHeight} style={{ position: 'absolute', top: 0, left: 0 }}>
        {paths.map((d, i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
            key={i}
            d={d}
            stroke={INK.route}
            strokeWidth={U.mapRoute * s}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: U.panelInset * s,
          backgroundColor: INK.ground,
        }}
      >
        <CardText lines={1} style={[font(SIZE.figure, s, true), { color: INK.strong }]}>
          {distance}
        </CardText>
        <CardText style={[font(SIZE.label, s), SYSTEM_WEIGHT.semibold, { color: INK.strong }]}>
          {rides}
        </CardText>
      </View>
    </Frame>
  );
}

function CountriesCard({ testID, insights, scale, rounded, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s } = scale;
  const countries = insights.countries;
  const listed = countries.slice(0, LISTED_COUNTRIES);
  const rest = countries.length - listed.length;
  const heading = t('riderInsights.recap.countries', { count: countries.length });
  const rows = listed.map((country) => ({
    code: plateLettersFor(country.isoA2),
    name: country.name ?? country.isoA2,
    since: t('riderInsights.recap.since', { date: shortDate(country.firstDate, i18n.language) }),
  }));
  const more = rest > 0 ? t('riderInsights.recap.moreCountries', { count: rest }) : null;

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(heading, ...rows.map((r) => `${r.name}, ${r.since}`), more)}
      onReady={onReady}
    >
      <CardText lines={1} style={[font(SIZE.figure, s, true), { color: INK.strong }]}>
        {heading}
      </CardText>
      <View style={{ gap: U.listGap * s }}>
        {rows.map((row) => (
          <View
            key={row.code + row.name}
            style={{ flexDirection: 'row', alignItems: 'center', gap: U.stackGap * s }}
          >
            <View
              style={{
                minWidth: U.ovalWidth * s,
                height: U.ovalHeight * s,
                paddingHorizontal: U.cellSeam * 2 * s,
                borderRadius: (U.ovalHeight / 2) * s,
                borderCurve: 'continuous',
                backgroundColor: INK.oval,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CardText style={[font(SIZE.oval, s, true), { color: INK.onOval }]}>
                {row.code}
              </CardText>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <CardText
                lines={1}
                style={[font(SIZE.body, s), SYSTEM_WEIGHT.semibold, { color: INK.strong }]}
              >
                {row.name}
              </CardText>
              <CardText style={[font(SIZE.meta, s), { color: INK.muted }]}>{row.since}</CardText>
            </View>
          </View>
        ))}
        {more ? (
          <CardText style={[font(SIZE.meta, s), { color: INK.muted }]}>{more}</CardText>
        ) : null}
      </View>
    </Frame>
  );
}

function LongestCard({ testID, insights, scale, rounded, system, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s } = scale;
  // biome-ignore lint/style/noNonNullAssertion: the card is ready only with a longest ride
  const ride = insights.longestRide!;
  const { route, settled } = useRecapRideRoute(ride.rideId);
  const date = shortDate(ride.localDate, i18n.language);
  const title = recapCardTitle(RECAP_CARD.LONGEST, t);
  const distance = formatInsightDistance(ride.distanceM, system, i18n.language);
  const name = ride.name ?? t('riderInsights.howYouRide.bestRides.unnamed', { date });
  const place =
    ride.startPlace && ride.endPlace && ride.startPlace !== ride.endPlace
      ? t('riderInsights.recap.places', { from: ride.startPlace, to: ride.endPlace })
      : (ride.startPlace ?? ride.endPlace);
  const meta = [date, place].filter(Boolean).join(' · ');

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(title, distance, name, meta)}
      settled={settled}
      onReady={onReady}
    >
      <CardText style={[font(SIZE.label, s), { color: INK.muted }]}>{title}</CardText>
      <RouteShape route={route} s={s} />
      <CardText lines={1} style={[font(SIZE.figure, s, true), { color: INK.strong }]}>
        {distance}
      </CardText>
      <CardText
        lines={2}
        style={[font(SIZE.body, s), SYSTEM_WEIGHT.semibold, { color: INK.strong }]}
      >
        {name}
      </CardText>
      <CardText style={[font(SIZE.meta, s), { color: INK.muted }]}>{meta}</CardText>
    </Frame>
  );
}

// ── Pro cards ────────────────────────────────────────────────────────────────

function RhythmCard({ testID, insights, scale, rounded, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s } = scale;
  // biome-ignore lint/style/noNonNullAssertion: the card is ready only with rhythm detail
  const grid = insights.rhythm.detail!.grid;
  const slot = busiestSlot(grid, t, i18n.language) ?? '';
  const cell = busiestCell(grid);
  const started = cell
    ? t('riderInsights.recap.rhythmStarted', { count: cell.rides, ...DAY_PART_HOURS[cell.part] })
    : null;

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(recapCardTitle(RECAP_CARD.RHYTHM, t), slot, started)}
      onReady={onReady}
    >
      <CardText lines={2} style={[font(SIZE.slot, s, true), { color: INK.strong }]}>
        {slot}
      </CardText>
      {started ? (
        <CardText style={[font(SIZE.label, s), { color: INK.soft }]}>{started}</CardText>
      ) : null}
      <View style={{ marginTop: U.cellSeam * 2 * s, gap: U.cellSeam * 2 * s }}>
        <RhythmCells levels={gridLevels(grid)} s={s} />
        <View style={{ flexDirection: 'row' }}>
          {DAY_PART_HOURS.map((part) => (
            <CardText key={part.from} style={[font(SIZE.axis, s), { flex: 1, color: INK.muted }]}>
              {part.from}
            </CardText>
          ))}
        </View>
      </View>
    </Frame>
  );
}

function NewRoadsCard({ testID, insights, scale, rounded, system, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s } = scale;
  // biome-ignore lint/style/noNonNullAssertion: the card is ready only with territory detail
  const detail = insights.territory.detail!;
  const title = recapCardTitle(RECAP_CARD.NEW_ROADS, t);
  const share =
    detail.newRoadShare === null ? null : formatPercent(detail.newRoadShare, i18n.language);
  const area = formatArea(detail.exploredKm2, system, i18n.language);

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(
        title,
        share ? `${share} ${t('riderInsights.recap.newRoadsShare')}` : null,
        `${area} ${t('riderInsights.recap.newRoadsArea')}`,
      )}
      onReady={onReady}
    >
      <CardText style={[font(SIZE.label, s), { color: INK.muted }]}>{title}</CardText>
      {share ? (
        <>
          <CardText lines={1} style={[font(SIZE.hero, s, true), { color: INK.strong }]}>
            {share}
          </CardText>
          <CardText style={[font(SIZE.body, s), { color: INK.strong }]}>
            {t('riderInsights.recap.newRoadsShare')}
          </CardText>
        </>
      ) : null}
      <View style={{ flex: 1 }} />
      <CardText lines={1} style={[font(SIZE.area, s, true), { color: INK.strong }]}>
        {area}
      </CardText>
      <CardText style={[font(SIZE.meta, s), { color: INK.muted }]}>
        {t('riderInsights.recap.newRoadsArea')}
      </CardText>
    </Frame>
  );
}

function TwistiestCard({ testID, insights, scale, rounded, system, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s } = scale;
  // biome-ignore lint/style/noNonNullAssertion: the card is ready only with a twistiest ride
  const ride = insights.roadCharacter.detail!.twistiest[0];
  const { route, settled } = useRecapRideRoute(ride.rideId);
  const date = shortDate(ride.localDate, i18n.language);
  const title = recapCardTitle(RECAP_CARD.TWISTIEST, t);
  const name = ride.name ?? t('riderInsights.howYouRide.bestRides.unnamed', { date });
  const unit = mileageUnitLabel(system);
  const distance = `${formatNumber(metersToUnit(ride.distanceM, unit), i18n.language, 1)} ${unit}`;
  const bends =
    ride.bendsPer10km === null
      ? null
      : t('riderInsights.recap.twistiestBends', { bends: Math.round(ride.bendsPer10km) });
  const meta = [date, distance, bends].filter(Boolean).join(' · ');

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(title, name, meta)}
      settled={settled}
      onReady={onReady}
    >
      <CardText style={[font(SIZE.label, s), { color: INK.muted }]}>{title}</CardText>
      <RouteShape route={route} s={s} />
      <CardText
        lines={2}
        style={[font(SIZE.body, s), SYSTEM_WEIGHT.semibold, { color: INK.strong }]}
      >
        {name}
      </CardText>
      <CardText style={[font(SIZE.meta, s), { color: INK.muted }]}>{meta}</CardText>
    </Frame>
  );
}

function CostCard({ testID, insights, scale, rounded, system, onReady }: BodyProps) {
  const { t, i18n } = useTranslation();
  const { s } = scale;
  const title = recapCardTitle(RECAP_CARD.COST, t);
  const cost = costOfRiding(insights.costPerKm.items, system);
  const main = cost && cost.main.perUnit !== null ? cost.main : null;
  const figure =
    cost && main?.perUnit != null
      ? formatCostPerUnit(main.perUnit, main.currency, cost.unit, i18n.language)
      : null;
  const source = main
    ? tDynamic(t, `riderInsights.recap.costSource.${main.source}`)
    : t('riderInsights.recap.costMissing');
  const others = (cost?.others ?? []).flatMap((line) =>
    line.perUnit === null || !cost
      ? []
      : [
          t('riderInsights.recap.costAlso', {
            cost: formatCostPerUnit(line.perUnit, line.currency, cost.unit, i18n.language),
          }),
        ],
  );
  const from = t('riderInsights.recap.costFrom');

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(title, figure, from, source, ...others)}
      onReady={onReady}
    >
      <CardText style={[font(SIZE.label, s), { color: INK.muted }]}>{title}</CardText>
      {figure ? (
        <CardText lines={1} style={[font(SIZE.big, s, true), { color: INK.strong }]}>
          {figure}
        </CardText>
      ) : null}
      <CardText style={[font(SIZE.body, s), { color: INK.strong }]}>{from}</CardText>
      <View style={{ flex: 1 }} />
      <CardText style={[font(SIZE.meta, s), { color: INK.muted }]}>{source}</CardText>
      {others.map((line) => (
        <CardText key={line} style={[font(SIZE.meta, s), { color: INK.muted }]}>
          {line}
        </CardText>
      ))}
    </Frame>
  );
}

const READY_BODY: Record<RecapCard, (props: BodyProps) => ReactNode> = {
  [RECAP_CARD.DISTANCE]: (props) => <DistanceCard {...props} />,
  [RECAP_CARD.COUNTRIES]: (props) => <CountriesCard {...props} />,
  [RECAP_CARD.LONGEST]: (props) => <LongestCard {...props} />,
  [RECAP_CARD.RHYTHM]: (props) => <RhythmCard {...props} />,
  [RECAP_CARD.NEW_ROADS]: (props) => <NewRoadsCard {...props} />,
  [RECAP_CARD.TWISTIEST]: (props) => <TwistiestCard {...props} />,
  [RECAP_CARD.COST]: (props) => <CostCard {...props} />,
};

// ── Locked teaser shapes: coarse, never a value ─────────────────────────────

function BandsShape({ shares, s }: { shares: readonly number[]; s: number }) {
  return (
    <View style={{ flexDirection: 'row', height: U.bandHeight * s, gap: U.cellSeam * s }}>
      {shares.map((share, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: four fixed bands
          key={i}
          style={{
            flex: share,
            borderRadius: U.cellSeam * s,
            backgroundColor: tint(INK.strong, BAND_ALPHAS[i]),
          }}
        />
      ))}
    </View>
  );
}

function PatternShape({
  routes,
  width,
  height,
}: {
  routes: readonly string[];
  width: number;
  height: number;
}) {
  const paths = useMemo(
    () => routePaths(routes, { width, height }, null, 0),
    [routes, width, height],
  );
  return (
    <Svg width={width} height={height}>
      {paths.map((d, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
        <Path key={i} d={d} stroke={INK.muted} strokeWidth={2} fill="none" />
      ))}
    </Svg>
  );
}

function CostShape({ s }: { s: number }) {
  return (
    <View style={{ gap: U.stackGap * s }}>
      {COST_SHAPE.map((share) => (
        <View
          key={share}
          style={{
            width: `${share * 100}%`,
            height: U.cellHeight * s,
            borderRadius: U.cellSeam * s,
            backgroundColor: tint(INK.strong, BAND_ALPHAS[1]),
          }}
        />
      ))}
    </View>
  );
}

/** The coarse shape behind a locked card, and the data that makes its blur cache key. */
function lockedShape(
  card: RecapCard,
  insights: RiderInsightsData,
  s: number,
  width: number,
): { shape: ReactNode; data: unknown } {
  const height = U.blurHeight * s;
  switch (card) {
    case RECAP_CARD.RHYTHM: {
      const levels = insights.rhythm.teaser?.grid ?? [];
      return { shape: <RhythmCells levels={levels} s={s} />, data: levels };
    }
    case RECAP_CARD.NEW_ROADS: {
      const routes = insights.regions[0]?.routes ?? [];
      return {
        shape: <PatternShape routes={routes} width={width} height={height} />,
        data: routes.length,
      };
    }
    case RECAP_CARD.TWISTIEST: {
      const bands = insights.roadCharacter.teaser?.bandShares;
      const shares = bands
        ? [bands.straight, bands.sweeping, bands.twisty, bands.tight]
        : [1, 0, 0, 0];
      return { shape: <BandsShape shares={shares} s={s} />, data: shares };
    }
    default:
      return { shape: <CostShape s={s} />, data: card };
  }
}

// ── The card ─────────────────────────────────────────────────────────────────

interface RecapCardViewProps {
  entry: RecapCardState;
  insights: RiderInsightsData;
  width: number;
  system: MeasurementSystem;
  /** Rounded on screen; square in the exported image. */
  rounded?: boolean;
  testID?: string;
  /** The rider just bought Pro and the server has not caught up: no second paywall. */
  unlocking?: boolean;
  onUnlock?: () => void;
  onReady?: () => void;
}

/** A recap card drawn by its state: values, a keep-riding or computing line, or its title over a blur. */
export function RecapCardView({
  entry,
  insights,
  width,
  system,
  rounded = true,
  testID = `recap-card-${entry.card}`,
  unlocking = false,
  onUnlock,
  onReady,
}: RecapCardViewProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const s = width / RECAP_UNITS_WIDTH;
  const scale = { s, width, height: width * RECAP_ASPECT };
  const title = recapCardTitle(entry.card, t);

  if (entry.state === RECAP_STATE.READY) {
    return READY_BODY[entry.card]({ testID, insights, scale, rounded, system, onReady });
  }

  if (entry.state === RECAP_STATE.LOCKED) {
    const inner = width - 2 * U.insetX * s;
    const { shape, data } = lockedShape(entry.card, insights, s, inner);
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={
          unlocking
            ? t('riderInsights.howYouRide.unlockingA11y', { title })
            : t('riderInsights.howYouRide.lockedA11y', { title })
        }
        onPress={unlocking ? undefined : onUnlock}
        disabled={unlocking}
        style={{
          width,
          height: scale.height,
          overflow: 'hidden',
          borderRadius: rounded ? radius.card : 0,
          borderCurve: 'continuous',
          backgroundColor: INK.card,
          paddingHorizontal: U.insetX * s,
          paddingVertical: U.insetTop * s,
          gap: U.listGap * s,
        }}
      >
        <CardText style={[font(SIZE.title, s), SYSTEM_WEIGHT.semibold, { color: INK.strong }]}>
          {title}
        </CardText>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <BlurCapture
            cacheKey={blurCaptureKey({ row: `recap-${entry.card}`, data, isDark: true, fontScale })}
            width={inner}
            height={U.blurHeight * s}
            blurRadius={BLUR_RADIUS * s}
          >
            <View style={{ width: inner, height: U.blurHeight * s, justifyContent: 'center' }}>
              {shape}
            </View>
          </BlurCapture>
        </View>
        <CardText style={[font(SIZE.body, s), SYSTEM_WEIGHT.semibold, { color: INK.link }]}>
          {unlocking
            ? t('riderInsights.howYouRide.unlocking')
            : t('riderInsights.howYouRide.unlock')}
        </CardText>
      </Pressable>
    );
  }

  const line =
    entry.state === RECAP_STATE.NOT_ENOUGH
      ? t('riderInsights.howYouRide.keepRiding')
      : entry.state === RECAP_STATE.COMPUTING
        ? t('riderInsights.howYouRide.computing')
        : MISSING_LINE[entry.card](t);

  return (
    <Frame
      testID={testID}
      scale={scale}
      rounded={rounded}
      label={joined(title, line)}
      onReady={onReady}
    >
      <CardText style={[font(SIZE.label, s), { color: INK.muted }]}>{title}</CardText>
      {entry.card === RECAP_CARD.COST ? (
        <CardText style={[font(SIZE.body, s), { color: INK.strong }]}>
          {t('riderInsights.recap.costFrom')}
        </CardText>
      ) : null}
      <View style={{ flex: 1 }} />
      <CardText style={[font(SIZE.body, s), { color: INK.soft }]}>{line}</CardText>
    </Frame>
  );
}
