import { useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { trackScreen } from '../lib/analytics';
import { buildScreenView, screenKeyFor } from '../lib/analytics-screen';

/**
 * The app's ONE source of `$screen` events (PostHog's own screen autocapture is
 * off — see the PostHogProvider in app/_layout.tsx). Mounted once in the root
 * layout; screens must not call `trackScreen` themselves.
 *
 * Fires when the route template OR the pathname changes. The pathname alone is
 * not enough: Expo Router drops `(group)` segments and a trailing `index`, so
 * every tab root is `/` and `(onboarding)/scan-receipt` and
 * `(modals)/scan-receipt` share `/scan-receipt` — keyed on the pathname, a tab
 * switch was never a screen view. The pathname still matters on its own: moving
 * from one bike to another is a new view of `/(tabs)/(garage)/bike/[id]`.
 * Query-string churn is not a view. Naming convention: lib/analytics-screen.ts.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const lastScreenKey = useRef<string | undefined>(undefined);
  const lastScreen = useRef<string | null>(null);

  // Template + pathname, computed in render (a string, so a stable dependency).
  const screenKey = screenKeyFor(segments, pathname);
  // Read through refs: segments and params are new arrays/objects every render.
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (lastScreenKey.current === screenKey) return;
    lastScreenKey.current = screenKey;
    const view = buildScreenView(segmentsRef.current, paramsRef.current, lastScreen.current);
    trackScreen(view.name, view.properties);
    lastScreen.current = view.name;
  }, [screenKey]);
}
