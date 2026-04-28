import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Flame, Leaf, Plus, Sunrise } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Circle, Defs, G, Path, Pattern, Rect, Svg, Text as SvgText } from 'react-native-svg';
import { useEditorialTheme } from '../../../theme/editorial';

function MiniRouteSchematic() {
  const { t } = useEditorialTheme();

  return (
    <View style={{ height: 132, backgroundColor: t.surface2, position: 'relative' }}>
      <Svg
        viewBox="0 0 350 132"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <Defs>
          <Pattern
            id="contour-mini"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <Path d="M0 12 Q6 9 12 12 T24 12" fill="none" stroke={t.line} strokeWidth={0.5} />
          </Pattern>
        </Defs>
        <Rect width="350" height="132" fill="url(#contour-mini)" />
        {/* Coast */}
        <Path
          d="M0 0 L0 132 L20 132 Q26 100 16 70 Q8 40 0 28 Z"
          fill={palette.editorialInfo}
          opacity={0.15}
        />
        {/* Route */}
        <Path
          d="M40 100 Q90 80 130 90 T200 60 Q240 40 310 50"
          stroke={t.warm}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        {/* Stops */}
        {[
          { x: 40, y: 100, l: 'Start' },
          { x: 130, y: 90, l: 'Gavia' },
          { x: 200, y: 60, l: 'Stelvio' },
          { x: 310, y: 50, l: 'End' },
        ].map((p) => (
          <G key={p.l}>
            <Circle cx={p.x} cy={p.y} r={5} fill={t.warm} stroke="#fff" strokeWidth={1.5} />
            <SvgText
              x={p.x}
              y={p.y - 9}
              textAnchor="middle"
              fontSize={9}
              fontFamily="GeistMono"
              fill={t.ink2}
              fontWeight="500"
            >
              {p.l}
            </SvgText>
          </G>
        ))}
      </Svg>

      {/* Badge */}
      <View
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.86)',
        }}
      >
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 9.5,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: t.ink2,
            fontWeight: '600',
          }}
        >
          ★ Pre-built · Saturday
        </Text>
      </View>
    </View>
  );
}

const STATS = [
  { label: 'Distance', value: '412 km' },
  { label: 'Climb', value: '2,510m' },
  { label: 'Fuel', value: '€38' },
  { label: 'Daylight', value: '14h 12m' },
];

const REASONS = [
  { Icon: Sunrise, text: 'Dry until 4pm — clouds roll over Stelvio after' },
  { Icon: Leaf, text: 'Both passes opened for season Apr 22' },
  { Icon: Flame, text: 'Two refuels on the GS — both before noon' },
];

interface SmartTripSuggestionProps {
  onUse?: () => void;
  onTweak?: () => void;
  /** Override first reason line with live weather */
  weatherReason?: string;
}

export function SmartTripSuggestion({ onUse, onTweak, weatherReason }: SmartTripSuggestionProps) {
  const { t } = useEditorialTheme();
  const reducedMotion = useReducedMotion();

  const handleUse = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUse?.();
  }, [onUse]);

  const handleTweak = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTweak?.();
  }, [onTweak]);

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(300).delay(300)}
      style={{
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 20,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      <MiniRouteSchematic />

      <View style={{ padding: 14 }}>
        {/* Title */}
        <View style={{ marginBottom: 10 }}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif',
              fontSize: 20,
              lineHeight: 22,
              letterSpacing: -0.3,
              color: t.ink,
              marginBottom: 4,
            }}
          >
            Alpine double — <Text style={{ fontStyle: 'italic' }}>Gavia + Stelvio</Text>
          </Text>
          <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 17 }}>
            Leave 6:30am · home by 7pm · 412 km
          </Text>
        </View>

        {/* Stat strip */}
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: t.line,
            marginHorizontal: -2,
            marginBottom: 12,
          }}
        >
          {STATS.map((s, _i) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 4,
                alignItems: 'center',
                borderRightWidth: 1,
                borderRightColor: t.line,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: t.ink,
                  letterSpacing: -0.1,
                }}
              >
                {s.value}
              </Text>
              <Text
                style={{
                  fontFamily: 'GeistMono',
                  fontSize: 9,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: t.ink3,
                  marginTop: 2,
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Reasons */}
        <View style={{ gap: 6, marginBottom: 12 }}>
          {(weatherReason
            ? [{ Icon: Sunrise, text: weatherReason }, ...REASONS.slice(1)]
            : REASONS
          ).map((row) => (
            <View key={row.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <row.Icon size={11} color={t.warm} />
              <Text style={{ fontSize: 11.5, color: t.ink2, lineHeight: 16, flex: 1 }}>
                {row.text}
              </Text>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={handleUse}
            style={{
              flex: 1,
              paddingVertical: 11,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: t.ink,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Plus size={13} color={t.bg} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: t.bg }}>Use as my trip</Text>
          </Pressable>
          <Pressable
            onPress={handleTweak}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: t.ink }}>Tweak</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
