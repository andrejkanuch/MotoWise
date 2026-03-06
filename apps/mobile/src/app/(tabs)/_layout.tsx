import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

const TAB_BAR_ACTIVE_COLOR = 'oklch(0.55 0.17 230)'; // primary-500
const TAB_BAR_BG_COLOR = 'oklch(0.98 0 0)'; // neutral-50 (surface)

export default function TabsLayout() {
  const { t, i18n } = useTranslation();

  return (
    <Tabs
      key={i18n.language}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_BAR_ACTIVE_COLOR,
        tabBarStyle: { backgroundColor: TAB_BAR_BG_COLOR },
      }}
    >
      <Tabs.Screen
        name="(learn)"
        options={{
          title: t('tabs.learn'),
          tabBarIcon: ({ color }) => (
            <SymbolView name="book.fill" tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="(diagnose)"
        options={{
          title: t('tabs.diagnose'),
          tabBarIcon: ({ color }) => (
            <SymbolView name="wrench.and.screwdriver.fill" tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="(garage)"
        options={{
          title: t('tabs.garage'),
          tabBarIcon: ({ color }) => (
            <SymbolView name="car.fill" tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <SymbolView name="person.fill" tintColor={color} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}
