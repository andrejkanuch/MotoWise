import { useLocalSearchParams } from 'expo-router';
import { ServicePlanReadyScreen } from '@/features/landing/service-plan-ready-screen';

export default function ServicePlanReadyRoute() {
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();
  return <ServicePlanReadyScreen motorcycleId={motorcycleId} bikeName={bikeName} />;
}
