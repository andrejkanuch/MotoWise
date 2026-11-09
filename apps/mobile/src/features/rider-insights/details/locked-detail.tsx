import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import { BlurCapture } from '../blur-capture';
import { fitViewport, routeSvgPath } from '../region-tiles';
import type { RiderInsightsRegion } from '../use-rider-insights';
import { bandAlphas, Card, DetailHero, UnlockButton } from './detail-parts';

const BAR_HEIGHT = 16;
const BAR_SEAM = 2;
const GRID_CELL_HEIGHT = 20;
const GRID_SEAM = 2;
const GRID_LEVEL_ALPHAS = [0, 0.36, 0.62, 0.92] as const;
const PATTERN_HEIGHT = 160;
const PATTERN_PADDING = 8;
const ROUTE_WIDTH = 1.5;
/** Blur per teaser: enough that a shape reads, never a value. */
export const DETAIL_BLUR = { band: 12, grid: 12, pattern: 12 } as const;

/** Road character's teaser: band shares rounded to 10%, drawn as the bar. */
export function TeaserBandBar({ shares, width }: { shares: readonly number[]; width: number }) {
  const { t, isDark } = useEditorialTheme();
  const alphas = bandAlphas(isDark);
  return (
    <View
      style={{
        width,
        height: BAR_HEIGHT,
        flexDirection: 'row',
        gap: BAR_SEAM,
        borderRadius: BAR_HEIGHT / 2,
        overflow: 'hidden',
      }}
    >
      {shares.map((share, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: four fixed bands
          key={i}
          style={{ flex: share, backgroundColor: tint(t.ink, alphas[i] ?? 1) }}
        />
      ))}
    </View>
  );
}

export const TEASER_BAR_HEIGHT = BAR_HEIGHT;
export const TEASER_GRID_HEIGHT = 4 * GRID_CELL_HEIGHT + 3 * GRID_SEAM;
export const TEASER_PATTERN_HEIGHT = PATTERN_HEIGHT;

/** Rhythm's teaser: the 7 x 4 grid of levels 0-3, days across, day parts down. */
export function TeaserGrid({
  levels,
  width,
}: {
  levels: readonly (readonly number[])[];
  width: number;
}) {
  const { t } = useEditorialTheme();
  const parts = levels[0]?.length ?? 0;
  return (
    <View style={{ width, gap: GRID_SEAM }}>
      {Array.from({ length: parts }, (_, p) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: four fixed day parts
          key={p}
          style={{ flexDirection: 'row', gap: GRID_SEAM }}
        >
          {levels.map((day, d) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed days
              key={d}
              style={{
                flex: 1,
                height: GRID_CELL_HEIGHT,
                borderRadius: GRID_SEAM * 2,
                backgroundColor:
                  day[p] > 0 ? tint(t.ink, GRID_LEVEL_ALPHAS[day[p]] ?? 1) : t.surface2,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Territory's teaser: the free map's own routes as a pattern, no number. */
export function TeaserPattern({
  region,
  width,
}: {
  region: RiderInsightsRegion | null;
  width: number;
}) {
  const { t } = useEditorialTheme();
  if (!region?.bounds || region.routes.length === 0) {
    return <View style={{ width, height: PATTERN_HEIGHT }} />;
  }
  const viewport = fitViewport(region.bounds, width, PATTERN_HEIGHT, PATTERN_PADDING);
  return (
    <Svg width={width} height={PATTERN_HEIGHT}>
      {region.routes.map((route, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
          key={i}
          d={routeSvgPath(route, viewport, width, PATTERN_HEIGHT)}
          stroke={t.ink3}
          strokeWidth={ROUTE_WIDTH}
          fill="none"
        />
      ))}
    </Svg>
  );
}

interface LockedDetailProps {
  /** The group's rounded headline, formatted; null when the API sent none. */
  figure: string | null;
  /** What the figure is: "bends per 10 km, rounded". */
  line: string;
  /** What Pro shows on this page, in words. */
  teaser: string;
  captureKey: string;
  graphic: ReactNode;
  graphicWidth: number;
  graphicHeight: number;
  blurRadius: number;
  unlocking: boolean;
  onUnlock: () => void;
}

/**
 * A Pro page for a rider without Pro: the group's rounded headline, the
 * rider's own pattern blurred, and one Unlock button that opens the paywall.
 * The title is the native header's.
 */
export function LockedDetail({
  figure,
  line,
  teaser,
  captureKey,
  graphic,
  graphicWidth,
  graphicHeight,
  blurRadius,
  unlocking,
  onUnlock,
}: LockedDetailProps) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  return (
    <View testID="detail-locked" style={{ gap: space.xl }}>
      <DetailHero figure={figure} line={line} />
      <Card padded>
        <BlurCapture
          cacheKey={captureKey}
          width={graphicWidth}
          height={graphicHeight}
          blurRadius={blurRadius}
        >
          {graphic}
        </BlurCapture>
        <Text style={[type.subhead, { color: t.ink2 }]}>{teaser}</Text>
      </Card>
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
  );
}
