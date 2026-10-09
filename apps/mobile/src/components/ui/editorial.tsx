/**
 * Shared UI primitives — the priority pill and the inset grouped settings kit
 * (ESettingsGroup, ESettingsRow, EToggleRow, EOptionRow, ESectionLabel,
 * ESectionFooter).
 */

import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { triggerImpact, triggerSelection } from '../../utils/haptics';
import { NativeToggle } from './native-toggle';

// ── Priority pill ──
const PRIORITY_LABEL_KEYS = {
  low: 'maintenance.priorityLow',
  medium: 'maintenance.priorityMedium',
  high: 'maintenance.priorityHigh',
  critical: 'maintenance.priorityCritical',
} as const;

export function EPriority({ level }: { level: keyof typeof PRIORITY_LABEL_KEYS }) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  // Graphite for routine, the plate-state inks for urgency; copper stays action-only.
  const color = {
    low: t.ink3,
    medium: t.ink2,
    high: t.dueInk,
    critical: t.overdueInk,
  }[level];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
        paddingHorizontal: 9,
        backgroundColor: tint(color, 0.18),
        borderWidth: 1,
        borderColor: tint(color, 0.32),
        borderRadius: radius.pill,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={[type.caption, SYSTEM_WEIGHT.bold, { color }]}>
        {i18n(PRIORITY_LABEL_KEYS[level])}
      </Text>
    </View>
  );
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
  subtitle,
  value,
  chevron,
  destructive,
  onPress,
  testID,
  isLast,
  badge,
  accessory,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon?: LucideIcon;
  title: string;
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
  badge?: ReactNode;
  /** Trailing control in place of value/chevron (e.g. a spinner). */
  accessory?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { t } = useEditorialTheme();
  const isInteractive = !!onPress;
  const tone = destructive ? t.danger : undefined;
  const showChevron = chevron ?? (isInteractive && !destructive);

  const content = (
    <RowShell icon={icon} iconColor={tone ?? t.ink2} isLast={isLast}>
      <RowText title={title} subtitle={subtitle} color={tone ?? t.ink} />
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
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : undefined)}
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
