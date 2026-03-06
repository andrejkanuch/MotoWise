import { Stack } from 'expo-router';

export default function LearnLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Learn', headerLargeTitle: true }} />
      <Stack.Screen name="article/[slug]" options={{ title: '' }} />
      <Stack.Screen name="quiz/[id]" options={{ title: 'Quiz' }} />
    </Stack>
  );
}
