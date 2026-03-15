import { Stack } from 'expo-router';

export default function LearnLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Learn' }} />
      <Stack.Screen name="article/[slug]" options={{ title: '', headerBackTitle: 'Learn' }} />
    </Stack>
  );
}
