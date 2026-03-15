import { Stack } from 'expo-router';

export default function DiagnoseLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="new"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Diagnosis Result' }} />
    </Stack>
  );
}
