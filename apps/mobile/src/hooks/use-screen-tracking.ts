import { useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { trackScreen } from '../lib/analytics';
import { buildScreenView } from '../lib/analytics-screen';

/**
 * The app's ONE source of `$screen` events (PostHog's own screen autocapture is
 * off — see the PostHogProvider in app/_layout.tsx). Mounted once in the root
 * layout; screens must not call `trackScreen` themselves.
 *
 * Fires when the pathname changes, so moving from one bike to another is a new
 * view of the same `/(tabs)/(garage)/bike/[id]` screen, while query-string
 * churn is not. Naming convention: lib/analytics-screen.ts.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const lastPathname = useRef<string | undefined>(undefined);
  const lastScreen = useRef<string | null>(null);

  // Read through refs so the effect is keyed on the pathname alone: segments
  // and params are new arrays/objects on every render.
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    const view = buildScreenView(segmentsRef.current, paramsRef.current, lastScreen.current);
    trackScreen(view.name, view.properties);
    lastScreen.current = view.name;
  }, [pathname]);
}
