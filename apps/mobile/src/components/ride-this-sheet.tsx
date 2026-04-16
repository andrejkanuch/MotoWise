import { palette } from '@motovault/design-system';
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
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavProvider, RideThisProviderState } from '../hooks/use-ride-this';

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

export function RideThisSheet({
  visible,
  onClose,
  providers,
  activeSegment,
  onProvider,
  onAdvance,
  gpxExporting,
}: RideThisSheetProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const bodyColor = isDark ? palette.neutral400 : palette.neutral500;
  const mutedColor = isDark ? palette.neutral500 : palette.neutral400;
  const dividerColor = isDark ? palette.neutral800 : palette.neutral200;
  const rowBg = isDark ? palette.neutral900 : palette.neutral50;
  const closeBg = isDark ? palette.neutral800 : palette.neutral100;

  const visibleProviders = useMemo(
    () => PROVIDER_ORDER.filter((p) => (p === 'apple' ? Platform.OS === 'ios' : true)),
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
              width: 34,
              height: 34,
              borderRadius: 17,
              borderCurve: 'continuous',
              backgroundColor: closeBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color={titleColor} />
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
              backgroundColor: palette.accent500,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: palette.white,
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
                color: palette.white,
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
                backgroundColor: palette.white,
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
                  color: palette.accent500,
                }}
              >
                {activeSegment.index + 1 >= activeSegment.total - 1
                  ? 'Open final segment'
                  : `Open segment ${activeSegment.index + 2}`}
              </Text>
              <ArrowRight size={16} color={palette.accent500} />
            </Pressable>
          </Animated.View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text
            style={{
              fontSize: 13,
              color: bodyColor,
              lineHeight: 19,
              marginBottom: 16,
            }}
          >
            Hand the route off to the app you ride with.
          </Text>

          {visibleProviders.map((provider, i) => {
            const state = providers[provider];
            const Icon = ICONS[provider];
            const isGpx = provider === 'gpx';
            const disabled = !state.available && !(provider === 'waze' && Platform.OS === 'ios');
            const showSpinner = isGpx && gpxExporting;

            return (
              <Animated.View key={provider} entering={FadeInUp.delay(i * 40).duration(220)}>
                <Pressable
                  onPress={() => !showSpinner && onProvider(provider)}
                  disabled={disabled || showSpinner}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABELS[provider]}. ${state.subtitle}`}
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
                      backgroundColor: isDark ? palette.neutral800 : palette.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showSpinner ? (
                      <ActivityIndicator size="small" color={palette.accent500} />
                    ) : (
                      <Icon size={20} color={disabled ? mutedColor : palette.accent500} />
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
                      {LABELS[provider]}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: bodyColor,
                        lineHeight: 18,
                      }}
                    >
                      {state.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={mutedColor} />
                </Pressable>
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
  const insets = useSafeAreaInsets();

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
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Ride this${subtitle ? `. ${subtitle}` : ''}`}
        style={{
          backgroundColor: disabled ? palette.neutral500 : palette.accent500,
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
        <Navigation size={18} color={palette.white} />
        <Text
          style={{
            color: palette.white,
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: 0.2,
          }}
        >
          Ride this
        </Text>
      </Pressable>
      {subtitle && (
        <Text
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: palette.white,
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
