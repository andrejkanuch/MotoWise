import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { PLATE_FONT } from '@/theme/type';

type NativeStackNavigationOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>['options']>,
  (...args: never[]) => unknown
>;

const IS_IOS = process.env.EXPO_OS === 'ios';
const IOS_MAJOR = IS_IOS ? Number.parseInt(String(Platform.Version), 10) : 0;
const LIQUID_GLASS_IOS = 26;

/**
 * Rider insights has a header button. On iOS 26 and later a header item plus the
 * bar's blur material draws the large title under the blur, unreadable; there the
 * system's own scroll edge effect softens content under the bar instead, so the
 * blur is dropped. Earlier iOS keeps the blur.
 */
export const INSIGHTS_TITLE_BLUR_FIX: { headerBlurEffect?: undefined } =
  IOS_MAJOR >= LIQUID_GLASS_IOS ? { headerBlurEffect: undefined } : {};

/**
 * The Profile stack's header, for the copies of Rider insights in another tab
 * stack: a large condensed title on iOS that collapses into the blurred bar,
 * and a solid top bar on Android. Detail and recap pages keep a small title.
 */
export function useInsightsHeaderOptions(): {
  main: NativeStackNavigationOptions;
  page: NativeStackNavigationOptions;
} {
  const { t: theme, isDark } = useEditorialTheme();
  const { t } = useTranslation();
  const main: NativeStackNavigationOptions = {
    headerShown: true,
    headerLargeTitle: IS_IOS,
    headerTransparent: IS_IOS,
    // Pinned to the APP scheme, as in the Profile stack.
    headerBlurEffect: IS_IOS
      ? isDark
        ? 'systemChromeMaterialDark'
        : 'systemChromeMaterialLight'
      : undefined,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: theme.ink,
    headerStyle: IS_IOS ? undefined : { backgroundColor: theme.bg },
    headerTitleStyle: { color: theme.ink },
    headerLargeTitleStyle: { color: theme.ink, fontFamily: PLATE_FONT.bold },
    contentStyle: { backgroundColor: theme.bg },
  };
  return {
    main: { ...main, ...INSIGHTS_TITLE_BLUR_FIX },
    // An insight's own page names where back goes: "‹ Insights".
    page: {
      ...main,
      headerLargeTitle: false,
      headerBackButtonDisplayMode: 'default',
      headerBackTitle: t('riderInsights.backTitle'),
    },
  };
}
