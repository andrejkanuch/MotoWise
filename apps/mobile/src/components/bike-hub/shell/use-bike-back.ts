import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { BIKE_ORIGIN, type BikeOrigin } from '@/lib/bike-hub/constants';

const GARAGE_HREF: Href = '/(tabs)/(garage)';
const HOME_HREF: Href = '/(tabs)/(home)';
const PROFILE_HREF: Href = '/(tabs)/(profile)';

type BackRouter = Pick<
  ReturnType<typeof useRouter>,
  'back' | 'canGoBack' | 'replace' | 'navigate' | 'canDismiss' | 'dismissAll'
>;

/**
 * Leave the garage stack clean, then switch tab: the bike is popped first so a
 * later tap on the Garage tab shows the garage list, not this bike again.
 */
function backToTab(router: BackRouter, tab: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(tab);
}

const BACK_ACTION: Record<BikeOrigin, (router: BackRouter) => void> = {
  // Cold start from a notification has nothing beneath the bike: land on the list.
  [BIKE_ORIGIN.GARAGE]: (router) =>
    router.canGoBack() ? router.back() : router.replace(GARAGE_HREF),
  [BIKE_ORIGIN.HOME]: (router) => backToTab(router, HOME_HREF),
  [BIKE_ORIGIN.PROFILE]: (router) => backToTab(router, PROFILE_HREF),
};

/** Back handler of the bike hub: returns to where the rider came from. */
export function useBikeBack(origin: BikeOrigin): () => void {
  const router = useRouter();
  return useCallback(() => BACK_ACTION[origin](router), [origin, router]);
}
