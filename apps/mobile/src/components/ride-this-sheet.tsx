import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
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

const LABELS: Record<NavProvider, string> = {
  apple: 'Apple Maps',
  google: 'Google Maps',
  waze: 'Waze',
  gpx: 'GPX for offline apps',
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
        style={{
          fontSize: 14,
          fontWeight: '700',
          letterSpacing: -0.1,
          color: selected ? theme.onWarm : textColor,
        }}
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: titleColor,
              letterSpacing: -0.2,
              marginBottom: 2,
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: bodyColor,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
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
  const insets = useSafeAreaInsets();

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
    selectedDay !== null
      ? `Hand off Day ${selectedDay + 1} stops to your nav app.`
      : 'Hand the route off to the app you ride with.';

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
          <Text
            style={{
              fontSize: 20,
              fontWeight: '800',
              color: titleColor,
              letterSpacing: -0.4,
            }}
          >
            Ride this
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
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
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: theme.onWarm,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                opacity: 0.85,
                marginBottom: 6,
              }}
            >
              {LABELS[activeSegment.provider]}
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: theme.onWarm,
                marginBottom: 12,
                letterSpacing: -0.3,
              }}
            >
              Segment {activeSegment.index + 1} of {activeSegment.total} opened
            </Text>
            <Pressable
              onPress={onAdvance}
              accessibilityRole="button"
              accessibilityLabel={`Open segment ${activeSegment.index + 2} of ${activeSegment.total}`}
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: theme.warm,
                }}
              >
                {activeSegment.index + 1 >= activeSegment.total - 1
                  ? 'Open final segment'
                  : `Open segment ${activeSegment.index + 2}`}
              </Text>
              <ArrowRight size={16} color={theme.warm} />
            </Pressable>
          </Animated.View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text
            style={{
              fontSize: 13,
              color: bodyColor,
              lineHeight: 19,
              marginBottom: showDayPills ? 12 : 16,
            }}
          >
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
                label="All days"
                selected={selectedDay === null}
                onPress={() => handleSelectDay(null)}
                pillBg={pillBg}
                textColor={pillTextColor}
              />
              {availableDays.map((day) => (
                <DayPill
                  key={day}
                  label={`Day ${day + 1}`}
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
                  label={LABELS[provider]}
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

          <Text
            style={{
              fontSize: 11,
              color: mutedColor,
              lineHeight: 16,
              marginTop: 8,
              paddingHorizontal: 4,
            }}
          >
            We don't navigate for you — your ride stays on the app you know. MotoVault just builds
            the plan and hands it over cleanly.
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
          accessibilityLabel={`Ride this${subtitle ? `. ${subtitle}` : ''}`}
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
          <Text
            style={{
              color: disabled ? theme.ink3 : theme.onWarm,
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 0.2,
            }}
          >
            Ride this
          </Text>
        </Pressable>
      </Animated.View>
      {subtitle && (
        <Text
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: theme.ink2,
            marginTop: 6,
            opacity: 0.8,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
