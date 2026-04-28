import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowRight, Coffee, Mountain, Sunrise } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Circle, Path, Svg } from 'react-native-svg';

type TripMode = 'day' | 'overnight' | 'multi';

const TRIP_MODES = [
  { id: 'day' as const, icon: Sunrise, title: 'Day ride', subtitle: '< 6h' },
  { id: 'overnight' as const, icon: Coffee, title: 'Overnight', subtitle: '1 night' },
  { id: 'multi' as const, icon: Mountain, title: 'Multi-day', subtitle: '2+ nights' },
];

function RouteDecoration() {
  return (
    <Svg
      viewBox="0 0 350 120"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        opacity: 0.18,
      }}
    >
      <Path
        d="M-10 90 Q60 70 100 80 T200 50 Q260 30 360 40"
        stroke={palette.editorialLightWarm}
        strokeWidth={1.4}
        fill="none"
        strokeDasharray="2 4"
      />
      <Circle cx={100} cy={80} r={3} fill={palette.editorialLightWarm} />
      <Circle cx={200} cy={50} r={3} fill={palette.editorialLightWarm} />
    </Svg>
  );
}

interface PlanRideCardProps {
  weatherLine?: string;
  fromLabel?: string;
  locationDenied?: boolean;
  onRequestLocation?: () => void;
}

export function PlanRideCard({
  weatherLine,
  fromLabel = 'My garage',
  locationDenied,
  onRequestLocation,
}: PlanRideCardProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [selectedMode, setSelectedMode] = useState<TripMode | null>(null);

  const handleModePress = useCallback((mode: TripMode) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMode((prev) => (prev === mode ? null : mode));
  }, []);

  const handleGoPress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/create-trip');
  }, [router]);

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(400).delay(100)}
      style={{
        backgroundColor: palette.editorialLightInk,
        borderRadius: 22,
        padding: 18,
        paddingBottom: 14,
        overflow: 'hidden',
        boxShadow: '0 18px 38px rgba(26,21,16,0.35)',
      }}
    >
      <RouteDecoration />

      <View style={{ position: 'relative' }}>
        {/* Weather context */}
        {locationDenied ? (
          <Pressable onPress={onRequestLocation} style={{ marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 9.5,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: palette.editorialDarkWarm2,
              }}
            >
              Enable location for weather →
            </Text>
          </Pressable>
        ) : (
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 9.5,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: palette.editorialDarkWarm2,
              marginBottom: 8,
            }}
          >
            {weatherLine || '–'}
          </Text>
        )}

        {/* Title */}
        <Text
          style={{
            fontFamily: 'InstrumentSerif',
            fontSize: 26,
            lineHeight: 28,
            letterSpacing: -0.5,
            color: palette.editorialDarkInk,
            marginBottom: 2,
          }}
        >
          Where are{' '}
          <Text style={{ fontStyle: 'italic', color: palette.editorialDarkWarm }}>we riding?</Text>
        </Text>

        <Text
          style={{
            fontSize: 12,
            lineHeight: 17,
            color: 'rgba(255,255,255,0.65)',
            marginBottom: 14,
          }}
        >
          Build a trip in seconds. Add roads as you find them.
        </Text>

        {/* Trip mode buttons */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {TRIP_MODES.map((m) => {
            const active = selectedMode === m.id;
            const Icon = m.icon;
            return (
              <Pressable
                key={m.id}
                onPress={() => handleModePress(m.id)}
                style={{
                  flex: 1,
                  backgroundColor: active ? palette.editorialDarkWarm : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: active ? palette.editorialDarkWarm : 'rgba(255,255,255,0.14)',
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 11,
                  paddingBottom: 10,
                  gap: 8,
                }}
              >
                <Icon size={16} color={active ? '#1a1208' : '#fff'} />
                <View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      lineHeight: 14,
                      color: active ? '#1a1208' : '#fff',
                    }}
                  >
                    {m.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9.5,
                      color: active ? 'rgba(26,18,8,0.7)' : 'rgba(255,255,255,0.7)',
                      marginTop: 3,
                    }}
                  >
                    {m.subtitle}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* From / To row */}
        <View
          style={{
            marginTop: 10,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 4,
            paddingLeft: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View style={{ flex: 1, paddingVertical: 8 }}>
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 9,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 1,
              }}
            >
              From
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff' }} numberOfLines={1}>
              {fromLabel}
            </Text>
          </View>
          <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.14)' }} />
          <View style={{ flex: 1, paddingVertical: 8 }}>
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 9,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 1,
              }}
            >
              To
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)' }}>
              Pick or loop ↺
            </Text>
          </View>
          <Pressable
            onPress={handleGoPress}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: palette.editorialDarkWarm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowRight size={15} color="#1a1208" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
