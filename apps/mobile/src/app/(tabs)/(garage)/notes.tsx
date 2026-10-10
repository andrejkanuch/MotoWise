import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotesScreen } from '@/components/bike-hub/notes/notes-screen';
import { useHubBike } from '@/components/bike-hub/shell/use-hub-bike';
import { HUB_TOUCH_TARGET, SYSTEM_WEIGHT, useHubTheme } from '@/components/bike-hub/ui/tokens';

type NotesRouteParams = {
  motorcycleId: string;
  /** The segment the screen was opened from (`BIKE_SEGMENT`) — the back label. */
  from?: string;
};

/** Notes screen route (card push inside the garage stack; the tab bar stays). */
export default function NotesRoute() {
  const hub = useHubTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { motorcycleId, from } = useLocalSearchParams<NotesRouteParams>();
  const { bike, isLoading } = useHubBike(motorcycleId);

  if (bike) return <NotesScreen bike={bike} from={from} />;

  return (
    <View style={{ flex: 1, backgroundColor: hub.ground, paddingTop: insets.top }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        style={{ minHeight: HUB_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 16 }}
      >
        <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 15, color: hub.copperText }}>
          {t('common.back')}
        </Text>
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {isLoading ? (
          <ActivityIndicator color={hub.copper} />
        ) : (
          <Text
            style={{ ...SYSTEM_WEIGHT.regular, fontSize: 16, color: hub.dim, textAlign: 'center' }}
          >
            {t('bikeHub.state.notFound')}
          </Text>
        )}
      </View>
    </View>
  );
}
