import { palette } from '@motovault/design-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Universal link: https://motovault.app/routes/:id → route detail modal (UUID).
 */
export default function RouteUuidDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    const routeId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    if (routeId) {
      router.replace({ pathname: '/(modals)/route-detail', params: { routeId } });
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
