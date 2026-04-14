import { palette } from '@motovault/design-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Universal link / custom scheme: https://motovault.app/ride/:id or motovault://ride/:id
 * → full-screen ride detail modal.
 */
export default function RideDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    const rideId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    if (rideId) {
      router.replace({ pathname: '/(modals)/ride-detail', params: { rideId } });
    }
  }, [id, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.neutral950,
      }}
    >
      <ActivityIndicator size="large" color={palette.accent500} />
    </View>
  );
}
