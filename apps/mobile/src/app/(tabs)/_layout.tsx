import { palette } from '@motovault/design-system';
import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { CommonActions } from 'expo-router/react-navigation';
import { Bike, Compass, Home, Route, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HUB_CHROME_MAX_FONT_SCALE } from '../../components/bike-hub/ui/tokens';
import { GlobalCarPlayBanner } from '../../components/carplay/global-carplay-banner';
import { ErrorFallback } from '../../components/error-fallback';
import { BIKE_HUB_ROUTES } from '../../lib/bike-hub/constants';
import { maintenanceBadgeOptions } from '../../lib/query-options';
import { useRideStore } from '../../stores/ride.store';
import { tabBarBottomOffset, useTabBarStore } from '../../stores/tab-bar.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';

const TAB_CONFIG = [
  { name: '(home)', icon: Home, labelKey: 'tabs.home' },
  { name: '(discover)', icon: Compass, labelKey: 'tabs.discover' },
  { name: '(garage)', icon: Bike, labelKey: 'tabs.garage' },
  { name: '(profile)', icon: User, labelKey: 'tabs.profile' },
] as const;

/**
 * Tab labels stop scaling at the hub's chrome cap: four labels and the ride
 * button share ~350 pt, so an uncapped label broke mid-word ("Gara/ge") at
 * accessibility sizes. Past the cap the label shrinks to fit, never wraps.
 */
const TAB_LABEL_MAX_FONT_SCALE = HUB_CHROME_MAX_FONT_SCALE;
const TAB_LABEL_MIN_SCALE = 0.75;
/** 44 pt on iOS, 48 dp on Android. */
const TAB_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;

/**
 * Over the bike hub the island sits on an opaque full-width dock so list rows
 * do not show beside and below it. It starts this far above the island's top.
 */
const HUB_DOCK_OVERHANG = 8;

/**
 * The island is an opaque raised surface with a hairline: there is no native
 * blur in the app, and any translucency let list text read through it.
 */
/** On a tablet the island stops at this width and centres; on a phone it spans the gutters. */
const TAB_BAR_MAX_WIDTH = 520;
const INDICATOR_SIZE = 4;
/**
 * The Ride button sits inside the island row. It used to rise half out of the
 * bar on a negative margin, and the tab bar's host view clipped that half on
 * Android (and on iOS in some container states).
 */
const FAB_SIZE = 52;

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function RideFAB() {
  const router = useRouter();
  const { t } = useTranslation();
  const { t: rideTheme } = useEditorialTheme();
  const reduceMotion = useReducedMotion();
  const rideStatus = useRideStore((s) => s.status);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const isActive = rideStatus === 'recording' || rideStatus === 'paused';

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isActive && !reduceMotion) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.12, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isActive, reduceMotion, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const onPress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (isActive) {
      router.push('/(modals)/ride-hud');
    } else {
      router.push('/(modals)/start-ride');
    }
  }, [isActive, router]);

  return (
    <Animated.View
      style={[
        {
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'stretch',
          flex: 1,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('common.ride')}
        android_ripple={{ color: tint(rideTheme.onWarm, 0.16), borderless: true }}
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          backgroundColor: rideTheme.warm,
          alignItems: 'center',
          justifyContent: 'center',
          borderCurve: 'continuous',
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Route size={24} color={rideTheme.onWarm} strokeWidth={2.2} />
      </Pressable>
      {isActive && (
        <Text
          maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
          style={[
            type.caption,
            SYSTEM_WEIGHT.semibold,
            { color: rideTheme.warm2, marginTop: 2, fontVariant: ['tabular-nums'] },
          ]}
        >
          {formatElapsed(elapsedTime)}
        </Text>
      )}
    </Animated.View>
  );
}

/**
 * Logging sheets presented as form sheets over a tab's stack, by route name
 * (the (garage) and (home) stacks share the names). On iOS the native sheet
 * covers the bar; on Android the island is drawn over the sheet and hid its
 * lower fields and the Cancel / Save row, so it is not drawn there.
 */
const SHEET_ROUTES: ReadonlySet<string> = new Set([
  'add-expense',
  'add-maintenance-task',
  'edit-maintenance-task',
  'complete-task',
  'add-document',
  'log-entry',
  'odometer',
  'note',
]);

const IS_ANDROID = process.env.EXPO_OS === 'android';

/** Name of the route on top of the focused tab's stack, if it has one. */
function topRouteName(state: BottomTabBarProps['state']): string | undefined {
  const tab = state.routes[state.index]?.state;
  if (!tab?.routes) return undefined;
  return tab.routes[tab.index ?? tab.routes.length - 1]?.name;
}

/**
 * The bar follows the system scheme everywhere, the bike hub included: the hub
 * now has a light scheme too, so pinning the bar dark over it would read as a
 * different app in light mode.
 */
function IslandTabBar(props: BottomTabBarProps) {
  const route = topRouteName(props.state);
  if (IS_ANDROID && route !== undefined && SHEET_ROUTES.has(route)) return null;
  const overHub = route !== undefined && BIKE_HUB_ROUTES.has(route);
  return (
    <>
      {overHub ? <HubDock /> : null}
      <IslandTabBarContent {...props} />
    </>
  );
}

/**
 * Opaque backing under the island on hub routes: from just above the bar to
 * the screen's bottom edge. The hub's content inset (`useHubBottomLayout`)
 * already lets the last row scroll clear of it.
 */
function HubDock() {
  // The hub's ground is the app's G0 ground in either scheme.
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const height = useTabBarStore((s) => s.height);
  if (height === null) return null;
  return (
    <View
      testID="hub-tab-dock"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: tabBarBottomOffset(insets.bottom) + height + HUB_DOCK_OVERHANG,
        backgroundColor: theme.bg,
      }}
    />
  );
}

function IslandTabBarContent({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sideInset = Math.max(space.lg, (windowWidth - TAB_BAR_MAX_WIDTH) / 2);
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  // Screens that float chrome above the bar (the bike hub's action pill) read
  // its real height: it grows with the system text size. Measuring only — the
  // bar's look is unchanged.
  const setTabBarHeight = useTabBarStore((s) => s.setHeight);

  // Badge count for garage tab
  const { data: maintenanceData } = useQuery(maintenanceBadgeOptions());

  const garageBadgeCount = useMemo(() => {
    const tasks = maintenanceData?.allMaintenanceTasks ?? [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let count = 0;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const due = new Date(task.dueDate);
      const daysUntil = Math.floor((due.getTime() - today.getTime()) / 86400000);
      // Overdue tasks
      if (daysUntil < 0) {
        count++;
      }
      // Critical/high due within 3 days
      else if (daysUntil <= 3 && (task.priority === 'critical' || task.priority === 'high')) {
        count++;
      }
    }
    return count;
  }, [maintenanceData]);

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        bottom: tabBarBottomOffset(insets.bottom),
        left: sideInset,
        right: sideInset,
        backgroundColor: theme.surface,
        borderRadius: radius.plate + space.xs,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.line,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        // Symmetric so the Ride button, centred on the island, sits optically
        // centred (owner report: it read low).
        paddingVertical: space.xs,
        paddingHorizontal: space.xs,
        borderCurve: 'continuous',
      }}
    >
      {state.routes.flatMap((route, index) => {
        const config = TAB_CONFIG.find((c) => c.name === route.name);
        if (!config) return [];

        const isFocused = state.index === index;
        const Icon = config.icon;
        const label = t(config.labelKey);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate(route.name, route.params);
          } else if (isFocused && !event.defaultPrevented && queryClient.isMutating() === 0) {
            // Pop nested stack to root when re-tapping the active tab.
            // Use CommonActions.reset to reliably clear the entire nested stack,
            // since StackActions.popToTop doesn't reach into nested navigators.
            navigation.dispatch({
              ...CommonActions.reset({
                index: 0,
                routes: [{ name: route.name }],
              }),
              target: state.key,
            });
          }
        };

        const showBadge = config.name === '(garage)' && garageBadgeCount > 0 && !isFocused;
        const badgeDisplay = garageBadgeCount >= 10 ? '9+' : String(garageBadgeCount);

        // Without an explicit label, VoiceOver concatenates the child Text
        // nodes and reads the badge count then the tab name ("1, Garage").
        // Provide a natural, grouped label + tab semantics instead.
        const accessibilityLabel = showBadge
          ? `${label}, ${t('tabs.dueCount', { count: garageBadgeCount, defaultValue: '{{count}} due' })}`
          : label;

        const tabButton = (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={accessibilityLabel}
            android_ripple={{ color: tint(theme.ink, 0.08), borderless: true }}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minHeight: TAB_MIN_HEIGHT,
              paddingVertical: space.xxs,
            }}
          >
            <View>
              <Icon
                size={22}
                color={isFocused ? theme.ink : theme.ink3}
                strokeWidth={isFocused ? 2.2 : 1.8}
              />
              {showBadge && (
                <Animated.View
                  entering={ZoomIn.springify()}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -10,
                    backgroundColor: theme.danger,
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                    style={[
                      type.caption,
                      SYSTEM_WEIGHT.bold,
                      { fontSize: 10, lineHeight: 12, color: palette.white },
                    ]}
                  >
                    {badgeDisplay}
                  </Text>
                </Animated.View>
              )}
            </View>
            <Text
              maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={TAB_LABEL_MIN_SCALE}
              style={[
                type.caption,
                isFocused ? SYSTEM_WEIGHT.semibold : SYSTEM_WEIGHT.regular,
                {
                  color: isFocused ? theme.ink : theme.ink3,
                  marginTop: 2,
                  // Bounds the label to its tab so `adjustsFontSizeToFit` has a width to fit.
                  maxWidth: '100%',
                },
              ]}
            >
              {label}
            </Text>
            {/* Selection mark: copper is the app's selection colour. */}
            <View
              style={{
                width: INDICATOR_SIZE,
                height: INDICATOR_SIZE,
                borderRadius: INDICATOR_SIZE / 2,
                marginTop: 2,
                backgroundColor: isFocused ? theme.warm : 'transparent',
              }}
            />
          </Pressable>
        );

        // Insert the Ride FAB between Diagnose and Garage tabs
        if (config.name === '(garage)') {
          return [<RideFAB key="ride-fab" />, tabButton];
        }
        return [tabButton];
      })}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { t, i18n } = useTranslation();

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => <ErrorFallback error={error} onRetry={resetError} />}
      beforeCapture={(scope) => scope.setTag('boundary', 'tabs')}
    >
      <Tabs
        key={i18n.language}
        tabBar={(props) => <IslandTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="(home)" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="(discover)" options={{ title: t('tabs.discover') }} />
        <Tabs.Screen name="(learn)" options={{ title: t('tabs.learn'), href: null }} />
        <Tabs.Screen name="(diagnose)" options={{ title: t('tabs.diagnose'), href: null }} />
        <Tabs.Screen name="(garage)" options={{ title: t('tabs.garage') }} />
        <Tabs.Screen name="(profile)" options={{ title: t('tabs.profile') }} />
      </Tabs>
      <GlobalCarPlayBanner />
    </Sentry.ErrorBoundary>
  );
}
