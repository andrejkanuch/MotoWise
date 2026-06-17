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
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorFallback } from '../../components/error-fallback';
import { maintenanceBadgeOptions } from '../../lib/query-options';
import { useRideStore } from '../../stores/ride.store';
import { useEditorialTheme } from '../../theme/editorial';

const TAB_CONFIG = [
  { name: '(home)', icon: Home, labelKey: 'tabs.home' },
  { name: '(discover)', icon: Compass, labelKey: 'tabs.discover' },
  { name: '(garage)', icon: Bike, labelKey: 'tabs.garage' },
  { name: '(profile)', icon: User, labelKey: 'tabs.profile' },
] as const;

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function RideFAB() {
  const router = useRouter();
  const { t: rideTheme } = useEditorialTheme();
  const rideStatus = useRideStore((s) => s.status);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const isActive = rideStatus === 'recording' || rideStatus === 'paused';

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.12, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isActive, pulseScale]);

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
        { position: 'relative', alignItems: 'center', justifyContent: 'center', flex: 1 },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: palette.editorialSuccess,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -28,
          borderCurve: 'continuous',
          boxShadow: `0 10px 30px ${isActive ? 'rgba(78,186,111,0.5)' : 'rgba(78,186,111,0.3)'}`,
          borderWidth: 3,
          borderColor: rideTheme.bg,
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Route size={24} color={palette.white} strokeWidth={2.2} />
      </Pressable>
      {isActive && (
        <Text
          style={{
            fontSize: 9,
            fontWeight: '700',
            color: palette.editorialSuccess,
            marginTop: 2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatElapsed(elapsedTime)}
        </Text>
      )}
    </Animated.View>
  );
}

function IslandTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();

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
      entering={FadeIn.duration(400)}
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 12),
        left: 20,
        right: 20,
        backgroundColor: theme.bg,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderCurve: 'continuous',
        boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 8px 24px rgba(0, 0, 0, 0.12)',
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

        const tabButton = (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              paddingVertical: 4,
            }}
          >
            <View>
              <Icon
                size={22}
                color={
                  isFocused ? (config.name === '(garage)' ? theme.warm : theme.ink) : theme.ink3
                }
                strokeWidth={isFocused ? 2.5 : 1.8}
              />
              {showBadge && (
                <Animated.View
                  entering={ZoomIn.springify()}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -10,
                    backgroundColor: palette.danger500,
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: palette.white,
                    }}
                  >
                    {badgeDisplay}
                  </Text>
                </Animated.View>
              )}
            </View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: isFocused ? '700' : '500',
                color: isFocused
                  ? config.name === '(garage)'
                    ? theme.warm
                    : theme.ink
                  : theme.ink3,
                marginTop: 3,
              }}
            >
              {label}
            </Text>
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
    </Sentry.ErrorBoundary>
  );
}
