import { palette } from '@motovault/design-system';
import { format } from 'date-fns';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Image, Text, type TextStyle, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { tint } from '../../../theme/editorial';
import { PLATE_FONT, SYSTEM_WEIGHT } from '../../../theme/type';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
} from '../../../utils/ride-formatters';
import type { LngLat, RideSharePayload } from '../share-card-types';

/**
 * Share-card type: the app's roles scaled down to the 222pt card. Cards render
 * to an image, so sizes are fixed (no Dynamic Type) — numbers and titles on the
 * condensed plate face, words on the system face, sentence case.
 */
export const CARD_TYPE = {
  label: { ...SYSTEM_WEIGHT.semibold, fontSize: 9 },
  figure: { fontFamily: PLATE_FONT.semibold, fontVariant: ['tabular-nums'] },
  title: { fontFamily: PLATE_FONT.bold, letterSpacing: 0.2 },
} as const satisfies Record<string, TextStyle>;

/** Ink on the dark cards. Cards are images, so they never follow the app theme. */
export const CARD_INK = {
  strong: palette.whitePure,
  body: tint(palette.whitePure, 0.9),
  muted: palette.whiteAlpha70,
  faint: palette.whiteAlpha50,
  rule: palette.whiteAlpha12,
} as const;

/** Ink on the cream route-print card. */
export const CARD_INK_CREAM = {
  strong: palette.shareCreamText,
  muted: tint(palette.shareCreamText, 0.7),
  faint: tint(palette.shareCreamText, 0.5),
  rule: tint(palette.shareCreamText, 0.18),
} as const;

const DATE_FORMAT = {
  long: 'EEE d MMM yyyy',
  compact: 'dd.MM.yyyy',
} as const;

const APP_ICON = require('../../../assets/images/motovault-icon-card.png');

// ── Wordmark ────────────────────────────────────────────────────────────────

export function Wordmark({ color = CARD_INK.muted }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4.5,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        <Image source={APP_ICON} style={{ width: 18, height: 18 }} />
      </View>
      <Text
        style={{
          ...SYSTEM_WEIGHT.bold,
          fontSize: 10,
          color,
        }}
      >
        {/* Brand name — not localized */}
        {'MotoVault'}
      </Text>
    </View>
  );
}

// ── Dates ───────────────────────────────────────────────────────────────────

/** Ride date as a sentence-case meta line (sits under the ride name). */
export function DateLine({ date, color = CARD_INK.muted }: { date: string; color?: string }) {
  return (
    <Text style={{ ...CARD_TYPE.label, color }}>{format(new Date(date), DATE_FORMAT.long)}</Text>
  );
}

export function DateCompact({ date, color = CARD_INK.faint }: { date: string; color?: string }) {
  return (
    <Text style={{ ...CARD_TYPE.figure, fontSize: 11, color }}>
      {format(new Date(date), DATE_FORMAT.compact)}
    </Text>
  );
}

// ── Stat Footer ─────────────────────────────────────────────────────────────

interface StatItem {
  labelKey: ParseKeys;
  value: string;
  unit: string;
}

export function StatFooter({
  stats,
  borderColor = palette.whiteAlpha20,
  labelColor = CARD_INK.muted,
  valueColor = CARD_INK.strong,
  unitColor = CARD_INK.muted,
}: {
  stats: StatItem[];
  borderColor?: string;
  labelColor?: string;
  valueColor?: string;
  unitColor?: string;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: borderColor,
        flexDirection: 'row',
        gap: 4,
      }}
    >
      {stats.map((s) => (
        <View key={s.labelKey} style={{ flex: 1 }}>
          <Text
            style={{
              ...CARD_TYPE.label,
              color: labelColor,
            }}
          >
            {t(s.labelKey)}
          </Text>
          <Text
            style={{
              ...CARD_TYPE.figure,
              fontSize: 20,
              lineHeight: 22,
              marginTop: 2,
              color: valueColor,
            }}
          >
            {s.value}
            <Text style={{ ...SYSTEM_WEIGHT.medium, fontSize: 10, color: unitColor }}>
              {' '}
              {s.unit}
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Build standard 3-col stats from payload */
export function buildDefaultStats(p: RideSharePayload): StatItem[] {
  const sys = p.measurementSystem;
  return [
    {
      labelKey: 'shareSheet.distance',
      value: formatDistanceValue(p.distanceM, sys),
      unit: distanceUnitLabel(sys),
    },
    { labelKey: 'shareSheet.time', value: formatDuration(p.durationS), unit: '' },
    {
      labelKey: 'shareSheet.elev',
      value: p.elevationGainM != null ? String(formatElevationValue(p.elevationGainM, sys)) : '—',
      unit: p.elevationGainM != null ? elevationUnitLabel(sys) : '',
    },
  ];
}

export function buildElevStats(p: RideSharePayload): StatItem[] {
  const sys = p.measurementSystem;
  return [
    {
      labelKey: 'shareSheet.gain',
      value: p.elevationGainM != null ? String(formatElevationValue(p.elevationGainM, sys)) : '—',
      unit: elevationUnitLabel(sys),
    },
    {
      labelKey: 'shareSheet.peak',
      value: p.elevationPeakM != null ? String(formatElevationValue(p.elevationPeakM, sys)) : '—',
      unit: elevationUnitLabel(sys),
    },
    {
      labelKey: 'shareSheet.distance',
      value: formatDistanceValue(p.distanceM, sys),
      unit: distanceUnitLabel(sys),
    },
  ];
}

// ── Route Silhouette SVG ────────────────────────────────────────────────────

export function RouteSilhouette({
  coordinates,
  width = 110,
  height = 60,
  strokeColor = tint(palette.shareCopperSoft, 0.85),
  strokeWidth = 1.6,
}: {
  coordinates: LngLat[];
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}) {
  if (coordinates.length < 2) return null;

  // Project coords to normalized 0-1 bounding box, then scale to width×height
  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const lngRange = maxLng - minLng || 0.001;
  const latRange = maxLat - minLat || 0.001;

  // Downsample to ~60 points for perf
  const step = Math.max(1, Math.floor(coordinates.length / 60));
  const sampled = coordinates.filter((_, i) => i % step === 0 || i === coordinates.length - 1);

  const points = sampled.map(([lng, lat]) => {
    const x = pad + ((lng - minLng) / lngRange) * w;
    const y = pad + (1 - (lat - minLat) / latRange) * h; // flip Y
    return [x, y] as const;
  });

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {start && <Circle cx={start[0]} cy={start[1]} r={3} fill={palette.shareEmerald} />}
      {end && (
        <Circle
          cx={end[0]}
          cy={end[1]}
          r={3}
          fill="none"
          stroke={palette.shareDanger}
          strokeWidth={1.5}
        />
      )}
    </Svg>
  );
}

// ── Elevation Sparkline SVG ─────────────────────────────────────────────────

export function ElevationSparkline({
  profile,
  width = 222,
  height = 180,
}: {
  profile: number[];
  width?: number;
  height?: number;
}) {
  if (profile.length < 2) return null;

  // Downsample to ~80 points for performance
  const step = Math.max(1, Math.floor(profile.length / 80));
  const sampled = profile.filter((_, i) => i % step === 0 || i === profile.length - 1);

  // Single-pass min/max/peakIdx — avoids 3x Math.max(...spread) which can stack-overflow on large arrays
  let min = sampled[0];
  let max = sampled[0];
  let peakIdx = 0;
  for (let i = 1; i < sampled.length; i++) {
    if (sampled[i] < min) min = sampled[i];
    if (sampled[i] > max) {
      max = sampled[i];
      peakIdx = i;
    }
  }
  min -= 50;
  max += 50;

  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 18;
  const range = max - min || 1;
  const xStep = (width - padL - padR) / (sampled.length - 1);

  const points = sampled.map((v, i) => [
    padL + i * xStep,
    padT + (1 - (v - min) / range) * (height - padT - padB),
  ]);

  let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(1)},${points[i][1].toFixed(1)}`;
  }

  const fillD = `${d} L ${points[points.length - 1][0].toFixed(1)},${height - padB} L ${padL},${height - padB} Z`;
  const peak = points[peakIdx];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={fillD} fill={palette.shareCopper} fillOpacity={0.25} />
      <Path
        d={d}
        fill="none"
        stroke={palette.shareCopper}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {peak && (
        <>
          <Path
            d={`M ${peak[0]} ${padT} L ${peak[0]} ${height - padB}`}
            stroke={palette.shareCopperSoft}
            strokeWidth={1}
            strokeDasharray="2 3"
            strokeOpacity={0.45}
          />
          <Circle
            cx={peak[0]}
            cy={peak[1]}
            r={4.5}
            fill={palette.shareCopper}
            stroke={palette.whitePure}
            strokeWidth={2}
          />
        </>
      )}
    </Svg>
  );
}
