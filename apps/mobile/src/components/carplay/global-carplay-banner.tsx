// Globally-mounted active-ride banner for CarPlay rides. Self-contained
// subscription (like RideFAB) so live ride ticks don't re-render the whole tab
// tree. Shows only when the head unit is connected AND a ride is active — it's
// the "ride is running via CarPlay, controls on the head unit" surface, distinct
// from the RideFAB that handles normal phone rides. Taps open the status sheet.

import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCarPlayConnection, useLiveRideSnapshot } from '../../features/carplay/use-carplay';
import { ActiveRideBanner } from './active-ride-banner';

export function GlobalCarPlayBanner() {
  const insets = useSafeAreaInsets();
  const { connected } = useCarPlayConnection();
  const ride = useLiveRideSnapshot();

  if (!connected || !ride.active) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12) + 78,
      }}
    >
      <ActiveRideBanner
        state={ride.bannerState}
        distance={ride.distance}
        time={ride.elapsed}
        onPress={() => router.push('/(modals)/carplay/status-sheet')}
      />
    </View>
  );
}
