/**
 * Shared UI primitives — Card, Chip, Button, Section, Stat, Divider, Priority,
 * and the inset grouped settings kit (ESettingsGroup, ESettingsRow, EToggleRow,
 * EOptionRow, ESectionLabel, ESectionFooter).
 */

import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { triggerImpact, triggerSelection } from '../../utils/haptics';
import { NativeToggle } from './native-toggle';

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
          // Same card as the inset groups: ramp step, no outline.
          borderRadius: radius.card,
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
        triggerImpact();
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
    primary: { bg: t.warm, fg: t.onWarm, border: 'transparent' },
    ghost: { bg: 'transparent', fg: t.ink, border: t.line },
    solid: { bg: t.surface2, fg: t.ink, border: t.line },
    danger: { bg: 'transparent', fg: t.danger, border: 'transparent' },
  } as const;
  const v = variants[variant];

  return (
    <Pressable
      onPress={() => {
        triggerImpact();
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
  const fg = active ? t.onWarm : t.ink2;

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

// ── Section masthead (sentence-case section title + optional link) ──
export function ESectionMasthead({
  label,
  kicker,
  action,
  onAction,
}: {
  label: string;
  /** Secondary caption under the title (plain, never an eyebrow). */
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
        gap: space.sm,
        marginBottom: space.xs,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[type.sectionTitle, { color: t.ink }]}>
          {label}
        </Text>
        {kicker ? (
          <Text style={[type.caption, { color: t.ink3, marginTop: 2 }]}>{kicker}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={() => {
            triggerImpact();
            onAction?.();
          }}
          accessibilityRole="button"
          hitSlop={8}
          android_ripple={{ color: tint(t.ink, 0.08), borderless: true }}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>{action}</Text>
          <ChevronRight size={16} color={t.warm2} strokeWidth={2.25} />
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
    // Graphite for routine, the plate-state inks for urgency; copper stays action-only.
    low: { c: t.ink3, label: 'Low' },
    medium: { c: t.ink2, label: 'Medium' },
    high: { c: t.dueInk, label: 'High' },
    critical: { c: t.overdueInk, label: 'Critical' },
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

// ── Settings section label (sentence-case caption above a settings group) ──
export function ESectionLabel({
  label,
  color,
  style,
}: {
  label: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useEditorialTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        type.label,
        { color: color ?? t.ink3, marginBottom: space.xs, marginLeft: space.md },
        style,
      ]}
    >
      {label}
    </Text>
  );
}

/** @deprecated Use `ESectionLabel`. Kept for existing callers. */
export function ESettingsSectionLabel({ label }: { label: string }) {
  return <ESectionLabel label={label} />;
}

// ── Settings footer (caption under a settings group) ──
export function ESectionFooter({ children }: { children: ReactNode }) {
  const { t } = useEditorialTheme();
  return (
    <Text
      style={[type.caption, { color: t.ink3, marginTop: space.xs, marginHorizontal: space.md }]}
    >
      {children}
    </Text>
  );
}

// ── Settings group (inset grouped container) ──
type GroupedRowProps = { isLast?: boolean };

/**
 * Inset grouped container for settings rows. Marks its last row so the
 * hairline separators stop inside the card; falsy children are skipped.
 */
export function ESettingsGroup({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { t } = useEditorialTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {rows.map((row, index) =>
        index === rows.length - 1
          ? cloneElement(row as ReactElement<GroupedRowProps>, { isLast: true })
          : row,
      )}
    </View>
  );
}

const ROW_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;
const ROW_ICON_SIZE = 28;

/** Row frame. The hairline sits on the text column, so it starts under the title. */
function RowShell({
  icon: Icon,
  iconColor,
  isLast,
  children,
}: {
  icon?: LucideIcon;
  iconColor: string;
  isLast?: boolean;
  children: ReactNode;
}) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_MIN_HEIGHT,
        paddingLeft: space.md,
      }}
    >
      {Icon ? (
        <View
          style={{
            width: ROW_ICON_SIZE,
            height: ROW_ICON_SIZE,
            borderRadius: radius.chip - 2,
            borderCurve: 'continuous',
            backgroundColor: t.surface2,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space.sm,
          }}
        >
          <Icon size={16} color={iconColor} strokeWidth={1.9} />
        </View>
      ) : null}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          paddingVertical: space.sm,
          paddingRight: space.md,
          gap: space.xs,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.line,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function RowText({ title, subtitle, color }: { title: string; subtitle?: string; color: string }) {
  const { t } = useEditorialTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.body, { color }]}>{title}</Text>
      {subtitle ? (
        <Text style={[type.caption, { color: t.ink3, marginTop: 2 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ── Settings row (icon + title/subtitle, optional value/badge/accessory, chevron) ──
export function ESettingsRow({
  icon,
  title,
  label,
  subtitle,
  value,
  chevron,
  destructive,
  onPress,
  testID,
  isLast,
  color,
  badge,
  accessory,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon?: LucideIcon;
  /** Row title. */
  title?: string;
  /** @deprecated Use `title`. */
  label?: string;
  subtitle?: string;
  /** Current value, drawn trailing in secondary ink. */
  value?: string;
  /** Defaults to shown for tappable, non-destructive rows. */
  chevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  testID?: string;
  /** Set by `ESettingsGroup` — hides the bottom hairline. */
  isLast?: boolean;
  /** @deprecated Use `destructive`. Overrides title + icon colour. */
  color?: string;
  badge?: ReactNode;
  /** Trailing control in place of value/chevron (e.g. a spinner). */
  accessory?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { t } = useEditorialTheme();
  const text = title ?? label ?? '';
  const isInteractive = !!onPress;
  const tone = destructive ? t.danger : color;
  const showChevron = chevron ?? (isInteractive && !tone);

  const content = (
    <RowShell icon={icon} iconColor={tone ?? t.ink2} isLast={isLast}>
      <RowText title={text} subtitle={subtitle} color={tone ?? t.ink} />
      {badge}
      {value ? (
        <Text numberOfLines={1} style={[type.body, { color: t.ink3, maxWidth: '45%' }]}>
          {value}
        </Text>
      ) : null}
      {loading ? <ActivityIndicator size="small" color={t.ink3} /> : accessory}
      {showChevron ? <ChevronRight size={17} color={t.ink4} strokeWidth={2} /> : null}
    </RowShell>
  );

  if (!isInteractive) {
    return (
      <View testID={testID} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${text}, ${value}` : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      android_ripple={{ color: tint(t.ink, 0.08) }}
      style={({ pressed }) => ({
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, 0.06) : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}

// ── Toggle row (icon + title/subtitle + native switch) ──
export function EToggleRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  isLast,
  disabled,
  testID,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Set by `ESettingsGroup`. */
  isLast?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { t, isDark } = useEditorialTheme();
  return (
    <View testID={testID}>
      <RowShell icon={icon} iconColor={t.ink2} isLast={isLast}>
        <RowText title={title} subtitle={subtitle} color={t.ink} />
        <NativeToggle
          value={value}
          tint={t.warm}
          offTrack={isDark ? t.surface3 : t.line}
          disabled={disabled}
          onValueChange={(next) => {
            triggerSelection();
            onValueChange(next);
          }}
        />
      </RowShell>
    </View>
  );
}

// ── Option row (list item with a trailing check) ──
export function EOptionRow({
  title,
  subtitle,
  selected,
  onPress,
  isLast,
  testID,
  multiple,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  isLast?: boolean;
  testID?: string;
  /** Part of a multi-select list: announced as a checkbox instead of a radio. */
  multiple?: boolean;
}) {
  const { t } = useEditorialTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerSelection();
        onPress();
      }}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      android_ripple={{ color: tint(t.ink, 0.08) }}
      style={({ pressed }) => ({
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, 0.06) : 'transparent',
      })}
    >
      <RowShell iconColor={t.ink2} isLast={isLast}>
        <RowText title={title} subtitle={subtitle} color={t.ink} />
        {selected ? <Check size={18} color={t.warm} strokeWidth={2.5} /> : null}
      </RowShell>
    </Pressable>
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
