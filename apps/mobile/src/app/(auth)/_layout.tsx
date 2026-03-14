import { palette } from '@motovault/design-system';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.surfaceDark },
        animation: 'slide_from_right',
      }}
    />
  );
}
