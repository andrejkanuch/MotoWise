import { palette } from '@motolearn/design-system';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Bike, BookOpen, Home, User, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONFIG = [
  { name: '(home)', icon: Home, labelKey: 'tabs.home' },
  { name: '(learn)', icon: BookOpen, labelKey: 'tabs.learn' },
  { name: '(diagnose)', icon: Wrench, labelKey: 'tabs.diagnose' },
  { name: '(garage)', icon: Bike, labelKey: 'tabs.garage' },
  { name: '(profile)', icon: User, labelKey: 'tabs.profile' },
] as const;

function IslandTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

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
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG.find((c) => c.name === route.name);
        if (!config) return null;

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
          }
        };

        return (
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
            <Icon
              size={22}
              color={isFocused ? palette.tabActive : palette.tabInactive}
              strokeWidth={isFocused ? 2.5 : 1.8}
            />
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
      <Tabs.Screen name="(learn)" options={{ title: t('tabs.learn') }} />
      <Tabs.Screen name="(diagnose)" options={{ title: t('tabs.diagnose') }} />
      <Tabs.Screen name="(garage)" options={{ title: t('tabs.garage') }} />
      <Tabs.Screen name="(profile)" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
