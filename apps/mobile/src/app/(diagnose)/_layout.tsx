import { Stack } from 'expo-router';

export default function DiagnoseLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Diagnose' }} />
      <Stack.Screen name="new" options={{ title: 'New Diagnosis', presentation: 'formSheet' }} />
      <Stack.Screen name="[id]" options={{ title: 'Diagnosis Result' }} />
    </Stack>
  );
}
