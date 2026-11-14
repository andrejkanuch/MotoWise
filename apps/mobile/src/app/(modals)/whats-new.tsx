import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useWhatsNewCta } from '@/features/whats-new/use-whats-new-cta';
import { WhatsNewScreen, whatsNewParams } from '@/features/whats-new/whats-new-screen';
import { LANDING_SHEET, LANDING_SHEET_TEST_ID } from '@/lib/landing-sheet-queue';

export default function WhatsNewRoute() {
  const params = useLocalSearchParams<{ source?: string; resume?: string; noBoot?: string }>();
  const onTryFeature = useWhatsNewCta();
  return (
    <View testID={LANDING_SHEET_TEST_ID[LANDING_SHEET.WHATS_NEW]} style={{ flex: 1 }}>
      <WhatsNewScreen {...whatsNewParams(params)} onTryFeature={onTryFeature} />
    </View>
  );
}
