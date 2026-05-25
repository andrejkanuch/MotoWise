import { palette } from '@motovault/design-system';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
} from '../../../utils/ride-formatters';
import type { LngLat, RideSharePayload } from '../share-card-types';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

// ── Wordmark ────────────────────────────────────────────────────────────────

function BikeGlyph({ size = 8, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        d="M2 11h2l1.5-5L7 9l1.5-3L10 11h2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function Wordmark({ color = 'rgba(255,255,255,0.7)' }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          backgroundColor: palette.shareCopper,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <BikeGlyph />
      </View>
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 8.5,
          fontWeight: '700',
          letterSpacing: 1.87,
          textTransform: 'uppercase',
          color,
        }}
      >
        MOTOVAULT
      </Text>
    </View>
  );
}

// ── Date Eyebrow ────────────────────────────────────────────────────────────

export function DateEyebrow({
  date,
  color = 'rgba(255,255,255,0.7)',
}: {
  date: string;
  color?: string;
}) {
  const d = new Date(date);
  const formatted = d
    .toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
  return (
    <Text
      style={{
        fontFamily: MONO,
        fontSize: 8.5,
        fontWeight: '600',
        letterSpacing: 1.53,
        color,
        textTransform: 'uppercase',
      }}
    >
      {formatted}
    </Text>
  );
}

export function DateCompact({
  date,
  color = 'rgba(255,255,255,0.5)',
}: {
  date: string;
  color?: string;
}) {
  const d = new Date(date);
  const formatted = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  return (
    <Text
      style={{
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '600',
        letterSpacing: 1.44,
        color,
        textTransform: 'uppercase',
      }}
    >
      {formatted}
    </Text>
  );
}

// ── Stat Footer ─────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  unit: string;
}

export function StatFooter({
  stats,
  borderColor = 'rgba(255,255,255,0.2)',
  labelColor = 'rgba(255,255,255,0.72)',
  valueColor = '#fff',
  unitColor = 'rgba(255,255,255,0.7)',
}: {
  stats: StatItem[];
  borderColor?: string;
  labelColor?: string;
  valueColor?: string;
  unitColor?: string;
}) {
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
        <View key={s.label} style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 7.5,
              fontWeight: '600',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: labelColor,
            }}
          >
            {s.label}
          </Text>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.37,
              marginTop: 2,
              color: valueColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {s.value}
            <Text style={{ fontSize: 10, fontWeight: '500', color: unitColor, letterSpacing: 0 }}>
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
      label: 'Distance',
      value: formatDistanceValue(p.distanceM, sys),
      unit: distanceUnitLabel(sys),
    },
    { label: 'Time', value: formatDuration(p.durationS), unit: '' },
    {
      label: 'Elev',
      value: p.elevationGainM != null ? String(formatElevationValue(p.elevationGainM, sys)) : '—',
      unit: p.elevationGainM != null ? elevationUnitLabel(sys) : '',
    },
  ];
}

export function buildElevStats(p: RideSharePayload): StatItem[] {
  const sys = p.measurementSystem;
  return [
    {
      label: 'Gain',
      value: p.elevationGainM != null ? String(formatElevationValue(p.elevationGainM, sys)) : '—',
      unit: elevationUnitLabel(sys),
    },
    {
      label: 'Peak',
      value: p.elevationPeakM != null ? String(formatElevationValue(p.elevationPeakM, sys)) : '—',
      unit: elevationUnitLabel(sys),
    },
    {
      label: 'Distance',
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
  strokeColor = 'rgba(232,157,90,0.85)',
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
  peakM,
  width = 222,
  height = 180,
}: {
  profile: number[];
  peakM: number | null;
  width?: number;
  height?: number;
}) {
  if (profile.length < 2) return null;

  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 18;
  const min = Math.min(...profile) - 50;
  const max = Math.max(...profile) + 50;
  const range = max - min || 1;
  const xStep = (width - padL - padR) / (profile.length - 1);

  const points = profile.map((v, i) => [
    padL + i * xStep,
    padT + (1 - (v - min) / range) * (height - padT - padB),
  ]);

  // Build smooth path
  let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(1)},${points[i][1].toFixed(1)}`;
  }

  // Fill path
  const fillD = `${d} L ${points[points.length - 1][0].toFixed(1)},${height - padB} L ${padL},${height - padB} Z`;

  // Peak marker
  const peakIdx = profile.indexOf(Math.max(...profile));
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
            stroke="#fff"
            strokeWidth={2}
          />
        </>
      )}
    </Svg>
  );
}
