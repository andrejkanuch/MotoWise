import { useLocalSearchParams } from 'expo-router';
import { useWhatsNewCta } from '@/features/whats-new/use-whats-new-cta';
import { WhatsNewScreen, whatsNewParams } from '@/features/whats-new/whats-new-screen';

export default function WhatsNewRoute() {
  const params = useLocalSearchParams<{ source?: string; resume?: string; noBoot?: string }>();
  const onTryFeature = useWhatsNewCta();
  return <WhatsNewScreen {...whatsNewParams(params)} onTryFeature={onTryFeature} />;
}
