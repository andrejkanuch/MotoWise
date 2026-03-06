import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ProfileLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: 'systemMaterial',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: t('profile.title') }} />
    </Stack>
  );
}
