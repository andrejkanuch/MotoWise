import { palette } from '@motovault/design-system';
import { AllMaintenanceTasksDocument } from '@motovault/graphql';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import { Bike, Home, Route, User, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
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
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';

const TAB_CONFIG = [
  { name: '(home)', icon: Home, labelKey: 'tabs.home' },
  { name: '(diagnose)', icon: Wrench, labelKey: 'tabs.diagnose' },
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
      // biome-ignore lint/suspicious/noExplicitAny: dynamic route
      router.push('/(modals)/ride-hud' as any);
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic route
      router.push('/(modals)/start-ride' as any);
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
          backgroundColor: palette.accent500,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -28,
          borderCurve: 'continuous',
          boxShadow: `0 4px 12px ${isActive ? 'rgba(45, 158, 120, 0.5)' : 'rgba(45, 158, 120, 0.3)'}`,
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
            color: palette.accent500,
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
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  // Badge count for garage tab
  const { data: maintenanceData } = useQuery({
    queryKey: queryKeys.maintenanceTasks.allUser,
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  });

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
        backgroundColor: isDark ? palette.tabBarDark : palette.tabBarLight,
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
          } else if (isFocused && !event.defaultPrevented) {
            // Pop to top when tapping already-focused tab (guard against in-flight mutations)
            const routeState = route.state;
            if (routeState?.index && routeState.index > 0 && queryClient.isMutating() === 0) {
              navigation.dispatch(StackActions.popToTop());
            }
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
                color={isFocused ? palette.tabActive : palette.tabInactive}
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
                color: isFocused ? palette.tabActive : palette.tabInactive,
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
    <Tabs
      key={i18n.language}
      tabBar={(props) => <IslandTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="(home)" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="(learn)" options={{ title: t('tabs.learn'), href: null }} />
      <Tabs.Screen name="(diagnose)" options={{ title: t('tabs.diagnose') }} />
      <Tabs.Screen name="(garage)" options={{ title: t('tabs.garage') }} />
      <Tabs.Screen name="(profile)" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
