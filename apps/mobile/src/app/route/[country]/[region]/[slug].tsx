import { palette } from '@motovault/design-system';
import { RouteBySlugDeepLinkDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { gqlFetcher } from '../../../../lib/graphql-client';

/**
 * Universal link: https://motovault.app/route/:country/:region/:slug → resolve id → route detail.
 */
export default function RouteSlugDeepLinkScreen() {
  const { country, region, slug } = useLocalSearchParams<{
    country: string;
    region: string;
    slug: string;
  }>();
  const router = useRouter();
  const navigatedRef = useRef(false);

  const c = typeof country === 'string' ? country : Array.isArray(country) ? country[0] : '';
  const r = typeof region === 'string' ? region : Array.isArray(region) ? region[0] : '';
  const s = typeof slug === 'string' ? slug : Array.isArray(slug) ? slug[0] : '';

  const { data, isError, isLoading } = useQuery({
    queryKey: ['route-by-slug-deeplink', c, r, s],
    queryFn: () => gqlFetcher(RouteBySlugDeepLinkDocument, { country: c, region: r, slug: s }),
    enabled: Boolean(c && r && s),
  });

  const routeId = data?.routeBySlug?.id;

  useEffect(() => {
    if (navigatedRef.current || !routeId) return;
    navigatedRef.current = true;
    router.replace({ pathname: '/(modals)/route-detail', params: { routeId } });
  }, [routeId, router]);

  useEffect(() => {
    if (!isError || navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace('/(tabs)/(discover)' as never);
  }, [isError, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.neutral950,
        padding: 24,
        gap: 12,
      }}
    >
      {isLoading && !isError ? (
        <ActivityIndicator size="large" color={palette.accent500} />
      ) : isError ? (
        <Text style={{ color: palette.neutral400, textAlign: 'center' }}>Opening Discover…</Text>
      ) : (
        <ActivityIndicator size="large" color={palette.accent500} />
      )}
    </View>
  );
}
