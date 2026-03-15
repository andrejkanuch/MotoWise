import { Stack } from 'expo-router';

export default function DiagnoseLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Diagnose' }} />
      <Stack.Screen
        name="new"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Diagnosis Result', headerBackTitle: 'Diagnose' }}
      />
    </Stack>
  );
}
