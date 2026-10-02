import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { OdometerSheet } from '../../../components/bike-hub/sheets/odometer-sheet';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { hub } from '../../../components/bike-hub/ui/tokens';

const PLACEHOLDER_HEIGHT = 240;

/** Odometer sheet route (formSheet, fit to contents). Opened from the header's odometer chip. */
export default function OdometerScreen() {
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const { bike } = useHubBike(motorcycleId);
  if (!bike) {
    return (
      <View
        style={{
          height: PLACEHOLDER_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hub.card,
        }}
      >
        <ActivityIndicator color={hub.copper} />
      </View>
    );
  }
  return <OdometerSheet bike={bike} onClose={() => router.back()} />;
}
