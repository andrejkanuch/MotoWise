import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(learn)" options={{ title: 'Learn' }} />
      <Tabs.Screen name="(diagnose)" options={{ title: 'Diagnose' }} />
      <Tabs.Screen name="(garage)" options={{ title: 'Garage' }} />
      <Tabs.Screen name="(profile)" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
