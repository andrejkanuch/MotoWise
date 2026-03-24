import { Stack } from 'expo-router';

export default function LearnLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Learn' }} />
      <Stack.Screen name="article/[slug]" options={{ title: '', headerBackTitle: 'Learn' }} />
      <Stack.Screen name="quiz/[id]" options={{ title: 'Quiz' }} />
    </Stack>
  );
}
