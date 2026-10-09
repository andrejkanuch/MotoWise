import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import type { ParseKeys } from 'i18next';
import {
  ArrowRight,
  ChevronRight,
  FileDown,
  Map as MapIcon,
  Navigation,
  Waypoints,
  X,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavProvider, RideThisProviderState } from '../hooks/use-ride-this';
import { useEditorialTheme } from '../theme/editorial';
import { SYSTEM_WEIGHT, type } from '../theme/type';

interface RideThisSheetProps {
  visible: boolean;
  onClose: () => void;
  providers: Record<NavProvider, RideThisProviderState>;
  activeSegment: {
    provider: NavProvider;
    index: number;
    total: number;
  } | null;
  onProvider: (provider: NavProvider) => void;
  onAdvance: () => void;
  gpxExporting?: boolean;
  /** Currently filtered day, or null when the rider wants every day in one handoff. */
  selectedDay?: number | null;
  onSelectDay?: (day: number | null) => void;
  /** Sorted day indices present in the waypoint set. A single-day trip omits the pills. */
  availableDays?: number[];
}

const PROVIDER_ORDER: NavProvider[] = ['apple', 'google', 'waze', 'gpx'];

/** Brand names stay as-is; only the GPX row is a description that needs translating. */
const LABELS: Record<NavProvider, { brand: string } | { key: ParseKeys }> = {
  apple: { brand: 'Apple Maps' },
  google: { brand: 'Google Maps' },
  waze: { brand: 'Waze' },
  gpx: { key: 'rideThis.gpx' },
};

const ICONS: Record<NavProvider, typeof MapIcon> = {
  apple: MapIcon,
  google: Navigation,
  waze: Waypoints,
  gpx: FileDown,
};

function DayPill({
  label,
  selected,
  onPress,
  pillBg,
  textColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  pillBg: string;
  textColor: string;
}) {
  const { t: theme } = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        height: 44,
        paddingHorizontal: 18,
        borderRadius: 22,
        borderCurve: 'continuous',
        backgroundColor: selected ? theme.warm : pillBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={[type.label, SYSTEM_WEIGHT.semibold, { color: selected ? theme.onWarm : textColor }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProviderRow({
  label,
  subtitle,
  Icon,
  disabled,
  showSpinner,
  onPress,
  rowBg,
  iconBg,
  titleColor,
  bodyColor,
  mutedColor,
}: {
  label: string;
  subtitle: string;
  Icon: typeof MapIcon;
  disabled: boolean;
  showSpinner: boolean;
  onPress: () => void;
  rowBg: string;
  iconBg: string;
  titleColor: string;
  bodyColor: string;
  mutedColor: string;
}) {
  const { t: theme } = useEditorialTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 320 });
        }}
        disabled={disabled || showSpinner}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${subtitle}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          marginBottom: 10,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: rowBg,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showSpinner ? (
            <ActivityIndicator size="small" color={theme.warm} />
          ) : (
            <Icon size={20} color={disabled ? mutedColor : theme.warm} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: titleColor, marginBottom: 2 }]}>{label}</Text>
          <Text style={[type.subhead, { color: bodyColor }]}>{subtitle}</Text>
        </View>
        <ChevronRight size={18} color={mutedColor} />
      </Pressable>
    </Animated.View>
  );
}

export function RideThisSheet({
  visible,
  onClose,
  providers,
  activeSegment,
  onProvider,
  onAdvance,
  gpxExporting,
  selectedDay = null,
  onSelectDay,
  availableDays = [],
}: RideThisSheetProps) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const providerLabel = (provider: NavProvider) => {
    const label = LABELS[provider];
    return 'brand' in label ? label.brand : t(label.key);
  };

  const bg = theme.surface;
  const titleColor = theme.ink;
  const bodyColor = theme.ink2;
  const mutedColor = theme.ink3;
  const dividerColor = theme.line;
  const rowBg = theme.surface2;
  const closeBg = theme.surface2;
  const pillBg = theme.surface2;
  const pillTextColor = theme.ink;

  const showDayPills = availableDays.length > 1;

  const handleSelectDay = (day: number | null) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectDay?.(day);
  };

  const bodyText =
    selectedDay !== null ? t('rideThis.bodyDay', { day: selectedDay + 1 }) : t('rideThis.bodyAll');

  const visibleProviders = useMemo(
    () => PROVIDER_ORDER.filter((p) => (p === 'apple' ? process.env.EXPO_OS === 'ios' : true)),
    [],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: dividerColor,
          }}
        >
          <Text accessibilityRole="header" style={[type.sheetTitle, { color: titleColor }]}>
            {t('rideThis.title')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('rideThis.close')}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderCurve: 'continuous',
              backgroundColor: closeBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color={titleColor} />
          </Pressable>
        </View>

        {/* Active segment banner — only shown during a chunked/multi-leg handoff */}
        {activeSegment && (
          <Animated.View
            entering={FadeIn.duration(180)}
            style={{
              marginHorizontal: 20,
              marginTop: 16,
              padding: 16,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: theme.warm,
            }}
          >
            <Text style={[type.label, { color: theme.onWarm, opacity: 0.85, marginBottom: 6 }]}>
              {providerLabel(activeSegment.provider)}
            </Text>
            <Text style={[type.bodyStrong, { color: theme.onWarm, marginBottom: 12 }]}>
              {t('rideThis.segmentOpened', {
                index: activeSegment.index + 1,
                total: activeSegment.total,
              })}
            </Text>
            <Pressable
              onPress={onAdvance}
              accessibilityRole="button"
              accessibilityLabel={t('rideThis.openSegmentA11y', {
                index: activeSegment.index + 2,
                total: activeSegment.total,
              })}
              style={{
                backgroundColor: theme.onWarm,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Text style={[type.bodyStrong, { color: theme.warm }]}>
                {activeSegment.index + 1 >= activeSegment.total - 1
                  ? t('rideThis.openFinalSegment')
                  : t('rideThis.openSegment', { index: activeSegment.index + 2 })}
              </Text>
              <ArrowRight size={16} color={theme.warm} />
            </Pressable>
          </Animated.View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text style={[type.subhead, { color: bodyColor, marginBottom: showDayPills ? 12 : 16 }]}>
            {bodyText}
          </Text>

          {showDayPills && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 20 }}
              style={{ marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 16 }}
            >
              <DayPill
                label={t('rideThis.allDays')}
                selected={selectedDay === null}
                onPress={() => handleSelectDay(null)}
                pillBg={pillBg}
                textColor={pillTextColor}
              />
              {availableDays.map((day) => (
                <DayPill
                  key={day}
                  label={t('trips.dayHeaderShort', { day: day + 1 })}
                  selected={selectedDay === day}
                  onPress={() => handleSelectDay(day)}
                  pillBg={pillBg}
                  textColor={pillTextColor}
                />
              ))}
            </ScrollView>
          )}

          {visibleProviders.map((provider, i) => {
            const state = providers[provider];
            const Icon = ICONS[provider];
            const isGpx = provider === 'gpx';
            const disabled =
              !state.available && !(provider === 'waze' && process.env.EXPO_OS === 'ios');
            const showSpinner = isGpx && gpxExporting;

            return (
              <Animated.View key={provider} entering={FadeInUp.delay(i * 40).duration(220)}>
                <ProviderRow
                  label={providerLabel(provider)}
                  subtitle={state.subtitle}
                  Icon={Icon}
                  disabled={disabled}
                  showSpinner={!!showSpinner}
                  onPress={() => !showSpinner && onProvider(provider)}
                  rowBg={rowBg}
                  iconBg={theme.surface2}
                  titleColor={titleColor}
                  bodyColor={bodyColor}
                  mutedColor={mutedColor}
                />
              </Animated.View>
            );
          })}

          <Text style={[type.caption, { color: mutedColor, marginTop: 8, paddingHorizontal: 4 }]}>
            {t('rideThis.disclaimer')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Sticky primary CTA. Keeps a single visual primary action on route / trip
 * screens regardless of scroll position. Consumers place this at the bottom of
 * their screen with `position: 'absolute'`.
 */
export function RideThisStickyCta({
  onPress,
  subtitle,
  disabled,
}: {
  onPress: () => void;
  subtitle?: string;
  disabled?: boolean;
}) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 12,
        zIndex: 10,
      }}
      pointerEvents="box-none"
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            onPress();
          }}
          onPressIn={() => {
            scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 12, stiffness: 300 });
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${t('rideThis.title')}${subtitle ? `. ${subtitle}` : ''}`}
          style={{
            backgroundColor: disabled ? theme.surface3 : theme.warm,
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            shadowColor: palette.black,
            shadowOpacity: 0.22,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
            opacity: disabled ? 0.7 : 1,
          }}
        >
          <Navigation size={18} color={disabled ? theme.ink3 : theme.onWarm} />
          <Text style={[type.bodyStrong, { color: disabled ? theme.ink3 : theme.onWarm }]}>
            {t('rideThis.title')}
          </Text>
        </Pressable>
      </Animated.View>
      {subtitle && (
        <Text
          style={[
            type.caption,
            { textAlign: 'center', color: theme.ink2, marginTop: 6, opacity: 0.8 },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
