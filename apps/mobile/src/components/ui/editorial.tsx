/**
 * Editorial UI primitives — Card, Chip, Button, Section, Stat, Divider, Priority.
 * Matches the warm magazine aesthetic from the design preview.
 */

import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';

// ── Card ──
export function ECard({
  children,
  style,
  pad = 16,
  onPress,
  delay,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: number;
  onPress?: () => void;
  delay?: number;
}) {
  const { t } = useEditorialTheme();
  const inner = (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 20,
          borderCurve: 'continuous',
          padding: pad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  const wrapped = onPress ? (
    <Pressable
      onPress={() => {
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      {inner}
    </Pressable>
  ) : (
    inner
  );

  if (delay != null) {
    return <Animated.View entering={FadeInUp.delay(delay).duration(300)}>{wrapped}</Animated.View>;
  }
  return wrapped;
}

// ── Button ──
const BUTTON_SIZES = {
  sm: { padV: 10, padH: 14, fs: 13, gap: 6, r: 12 },
  md: { padV: 14, padH: 18, fs: 15, gap: 8, r: 14 },
  lg: { padV: 18, padH: 22, fs: 16, gap: 10, r: 16 },
} as const;

export function EButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  size = 'md',
  full = false,
  style,
}: {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'solid' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useEditorialTheme();
  const s = BUTTON_SIZES[size];
  const variants = {
    primary: { bg: t.warm, fg: '#1a1208', border: 'transparent' },
    ghost: { bg: 'transparent', fg: t.ink, border: t.line },
    solid: { bg: t.surface2, fg: t.ink, border: t.line },
    danger: { bg: 'transparent', fg: t.danger, border: 'transparent' },
  } as const;
  const v = variants[variant];

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.gap,
          paddingVertical: s.padV,
          paddingHorizontal: s.padH,
          backgroundColor: v.bg,
          borderWidth: 1,
          borderColor: v.border,
          borderRadius: s.r,
          borderCurve: 'continuous',
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          fontSize: s.fs,
          fontWeight: '600',
          letterSpacing: -0.15,
          color: v.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Chip ──
export function EChip({
  label,
  icon,
  active,
  color,
  onPress,
  size = 'md',
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  size?: 'sm' | 'md';
}) {
  const { t } = useEditorialTheme();
  const pad = size === 'sm' ? { v: 5, h: 10 } : { v: 7, h: 12 };
  const fs = size === 'sm' ? 11 : 12;
  const bg = active ? (color ?? t.warm) : t.surface2;
  const fg = active ? '#1a1208' : t.ink2;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: pad.v,
        paddingHorizontal: pad.h,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: active ? 'transparent' : t.line,
      }}
    >
      {icon}
      <Text style={{ fontSize: fs, fontWeight: '600', color: fg }}>{label}</Text>
    </Pressable>
  );
}

// ── Section masthead ──
export function ESectionMasthead({
  label,
  kicker,
  action,
  onAction,
}: {
  label: string;
  kicker?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingLeft: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 2.2,
            textTransform: 'uppercase',
            color: t.ink2,
          }}
        >
          {label}
        </Text>
        {kicker ? (
          <>
            <View style={{ width: 14, height: 1, backgroundColor: t.line }} />
            <Text
              style={{
                fontSize: 10,
                color: t.ink3,
                fontStyle: 'italic',
                fontFamily: 'InstrumentSerif-Italic',
              }}
            >
              {kicker}
            </Text>
          </>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 11, color: t.ink2, fontWeight: '600' }}>{action} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Section header (caption) ──
export function ESectionHeader({
  title,
  action,
  onAction,
  children,
  gap = 10,
  style,
}: {
  title?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useEditorialTheme();
  return (
    <View style={style}>
      {(title || action) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            marginBottom: 10,
          }}
        >
          {title ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 1.3,
                textTransform: 'uppercase',
                color: t.ink3,
              }}
            >
              {title}
            </Text>
          ) : null}
          {action ? (
            <Pressable onPress={onAction}>
              <Text style={{ fontSize: 12, color: t.ink2, fontWeight: '500' }}>{action}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <View style={{ gap }}>{children}</View>
    </View>
  );
}

// ── Stat tile ──
export function EStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        backgroundColor: t.surface,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.line,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: t.ink3,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: tone ?? t.ink,
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Priority pill ──
export function EPriority({ level }: { level: 'low' | 'medium' | 'high' | 'critical' }) {
  const { t } = useEditorialTheme();
  const map = {
    low: { c: t.success, label: 'Low' },
    medium: { c: t.info, label: 'Medium' },
    high: { c: t.warm, label: 'High' },
    critical: { c: t.danger, label: 'Critical' },
  } as const;
  const { c, label } = map[level];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
        paddingHorizontal: 9,
        backgroundColor: tint(c, 0.18),
        borderWidth: 1,
        borderColor: tint(c, 0.32),
        borderRadius: 999,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: c,
        }}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: c,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Divider ──
export function EDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useEditorialTheme();
  return <View style={[{ height: 1, backgroundColor: t.line }, style]} />;
}

// ── Display text (Instrument Serif) ──
export function EDisplay({
  children,
  size = 40,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useEditorialTheme();
  return (
    <Text
      style={[
        {
          fontFamily: 'InstrumentSerif-Regular',
          fontSize: size,
          lineHeight: size * 1.05,
          color: t.ink,
          letterSpacing: -size * 0.02,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Display italic accent ──
export function EDisplayAccent({
  children,
  size = 40,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useEditorialTheme();
  return (
    <Text
      style={[
        {
          fontFamily: 'InstrumentSerif-Italic',
          fontSize: size,
          lineHeight: size * 1.05,
          color: t.warm2,
          letterSpacing: -size * 0.02,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Kicker / label ──
export function EKicker({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useEditorialTheme();
  return (
    <Text
      style={[
        {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: color ?? t.warm,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Progress bar ──
export function EProgressBar({ value, color }: { value: number; color?: string }) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        height: 6,
        backgroundColor: t.surface2,
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.min(value, 1) * 100}%`,
          height: '100%',
          backgroundColor: color ?? t.warm,
          borderRadius: 999,
        }}
      />
    </View>
  );
}
