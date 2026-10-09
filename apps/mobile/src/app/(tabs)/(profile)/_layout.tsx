import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '../../../components/error-fallback';
import { captureException } from '../../../lib/analytics';
import { useEditorialTheme } from '../../../theme/editorial';
import { PLATE_FONT } from '../../../theme/type';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'profile' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

const IS_IOS = process.env.EXPO_OS === 'ios';

/**
 * One header pattern for every Profile screen: the native stack header with a
 * large condensed title on iOS (collapses into the blurred bar on scroll) and a
 * solid Material top bar on Android. Screens scroll with
 * `contentInsetAdjustmentBehavior="automatic"` and never draw their own back
 * button. The tab root draws its own identity header instead.
 */
export default function ProfileLayout() {
  const { t } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: IS_IOS,
        headerTransparent: IS_IOS,
        // Pinned to the APP scheme: the adaptive 'systemChromeMaterial' follows the
        // system appearance and paints a light bar under a dark-mode title.
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
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="rides" options={{ title: t('profile.myRidesTitle') }} />
      <Stack.Screen name="heatmap" options={{ title: t('profile.roadsTitle') }} />
      <Stack.Screen name="trips" options={{ title: t('profile.myTripsTitle') }} />
      <Stack.Screen name="saved" options={{ title: t('saved.title') }} />
      <Stack.Screen name="app-settings" options={{ title: t('profile.appSettings') }} />
      <Stack.Screen name="preference/[key]" options={{ headerLargeTitle: false }} />
      <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
      <Stack.Screen name="privacy" options={{ title: t('privacy.title') }} />
      <Stack.Screen name="support" options={{ title: t('profile.support') }} />
      <Stack.Screen
        name="edit-profile"
        options={{ title: t('community.editProfile'), headerLargeTitle: false }}
      />
      <Stack.Screen name="rider/[username]" options={{ headerLargeTitle: false }} />
      <Stack.Screen
        name="rider/followers"
        options={{ headerLargeTitle: false, title: t('community.followers') }}
      />
    </Stack>
  );
}
