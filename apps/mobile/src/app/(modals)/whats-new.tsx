import { useLocalSearchParams } from 'expo-router';
import { WhatsNewScreen, whatsNewParams } from '@/features/whats-new/whats-new-screen';

export default function WhatsNewRoute() {
  const params = useLocalSearchParams<{ source?: string; resume?: string; noBoot?: string }>();
  return <WhatsNewScreen {...whatsNewParams(params)} />;
}
