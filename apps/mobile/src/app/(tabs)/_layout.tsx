import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(learn)" options={{ title: t('tabs.learn') }} />
      <Tabs.Screen name="(diagnose)" options={{ title: t('tabs.diagnose') }} />
      <Tabs.Screen name="(garage)" options={{ title: t('tabs.garage') }} />
      <Tabs.Screen name="(profile)" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
