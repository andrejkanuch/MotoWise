import { View, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { palette } from '@motovault/design-system';

interface ElevationPoint {
  distance: number;
  elevation: number;
}

interface ElevationChartMobileProps {
  elevationData: ElevationPoint[];
}

/**
 * Mobile elevation profile chart.
 *
 * Renders a simple SVG-less elevation visualization using View bars.
 * For a richer chart, integrate react-native-chart-kit or victory-native.
 */
export default function ElevationChartMobile({ elevationData }: ElevationChartMobileProps) {
  if (!elevationData.length) return null;

  const minElev = Math.min(...elevationData.map((p) => p.elevation));
  const maxElev = Math.max(...elevationData.map((p) => p.elevation));
  const range = maxElev - minElev || 1;
  const gain = elevationData.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const diff = p.elevation - elevationData[i - 1].elevation;
    return diff > 0 ? acc + diff : acc;
  }, 0);

  // Sample ~50 bars for the chart
  const sampleRate = Math.max(1, Math.floor(elevationData.length / 50));
  const sampled = elevationData.filter((_, i) => i % sampleRate === 0);

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(300)}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: palette.text,
          marginBottom: 8,
          paddingHorizontal: 16,
        }}
      >
        Elevation Profile
      </Text>

      {/* Bar chart visualization */}
      <View
        style={{
          height: 120,
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          gap: 1,
        }}
      >
        {sampled.map((point, i) => {
          const heightPct = ((point.elevation - minElev) / range) * 100;
          return (
            <View
              key={`bar-${i}`}
              style={{
                flex: 1,
                height: `${Math.max(2, heightPct)}%`,
                backgroundColor: palette.primary500,
                opacity: 0.7,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          );
        })}
      </View>

      {/* Stats row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          marginTop: 8,
        }}
      >
        <View>
          <Text style={{ fontSize: 11, color: palette.textSecondary }}>Min</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {minElev.toFixed(0)} m
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 11, color: palette.textSecondary }}>Max</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {maxElev.toFixed(0)} m
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 11, color: palette.textSecondary }}>Gain</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {gain.toFixed(0)} m
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 11, color: palette.textSecondary }}>Distance</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {elevationData[elevationData.length - 1]?.distance.toFixed(1) ?? '?'} km
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
