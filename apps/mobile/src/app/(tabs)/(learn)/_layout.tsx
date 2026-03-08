import { Stack } from 'expo-router';

export default function LearnLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="article/[slug]" options={{ title: '' }} />
      <Stack.Screen name="quiz/[id]" options={{ title: 'Quiz' }} />
    </Stack>
  );
}
