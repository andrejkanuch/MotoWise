import { Stack } from 'expo-router';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';

export default function AuthLayout() {
  const oc = useOnboardingColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: oc.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
