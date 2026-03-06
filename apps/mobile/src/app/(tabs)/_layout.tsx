import { colors } from '@motolearn/design-system';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t, i18n } = useTranslation();

  return (
    <Tabs
      key={i18n.language}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarStyle: { backgroundColor: colors.neutral[50] },
      }}
    >
      <Tabs.Screen
        name="(learn)"
        options={{
          title: t('tabs.learn'),
          tabBarIcon: ({ color }) => <SymbolView name="book.fill" tintColor={color} size={22} />,
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
          tabBarIcon: ({ color }) => <SymbolView name="car.fill" tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <SymbolView name="person.fill" tintColor={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
