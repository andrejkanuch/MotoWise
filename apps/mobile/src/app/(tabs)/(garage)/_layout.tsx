import { Stack } from 'expo-router';

export default function GarageLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My Garage' }} />
      <Stack.Screen name="bike/[id]" options={{ title: 'Bike Details' }} />
      <Stack.Screen name="add-bike" options={{ title: 'Add Bike', presentation: 'formSheet' }} />
    </Stack>
  );
}
