// Shared primitives for the CarPlay phone-companion screens.
// Faithful to docs/design/2026-06-25-carplay-ride-companion-ux-design.md (§5)
// and the imported design (claude.ai/design — companion.jsx), translated to
// the real MotoVault editorial theme. No hardcoded colors — palette/theme only.

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { type EditorialTokens, tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';

// Small system label (sentence case) — sits above a value or heads a grouped list.
export function Eyebrow({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: object;
}) {
  const { t: c } = useEditorialTheme();
  return (
    <Text
      style={{
        ...type.label,
        color: color ?? c.ink3,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Eyebrow
      style={{
        paddingHorizontal: space.xxs,
        marginTop: space.lg,
        marginBottom: space.xs,
        ...style,
      }}
    >
      {children}
    </Eyebrow>
  );
}

// Pulsing dot — recording "live" signal. Reanimated v4 (never RN Animated).
export function PulseDot({ color, size = 9 }: { color: string; size?: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 1.6 }],
    opacity: 0.55 * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderCurve: 'continuous',
            backgroundColor: color,
          },
          ring,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderCurve: 'continuous',
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// Static dot (paused / acquiring — no pulse; stillness reads as not-live).
export function StaticDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderCurve: 'continuous',
        backgroundColor: color,
      }}
    />
  );
}

// Card list container with hairline dividers between rows.
export function CardGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { t: c } = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: c.line,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </View>
  );
}

// Caution banner (due-signal tint; copper is reserved for actions) — used when
// both cue channels are off, etc.
export function CautionRow({ children }: { children: ReactNode }) {
  const { t: c } = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: tint(c.plateDue, 0.12),
        borderColor: tint(c.plateDue, 0.4),
        borderWidth: 1,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        padding: space.md,
        marginTop: space.sm,
      }}
    >
      <Text style={{ ...type.label, color: c.ink }}>{children}</Text>
    </View>
  );
}

export type { EditorialTokens };
