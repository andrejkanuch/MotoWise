/**
 * The old "Roads I've ridden" screen. Rider insights replaced it; this route
 * stays so existing links and deep links land on the new screen.
 */
import { Redirect } from 'expo-router';
import { PROFILE_ROUTE, RIDER_INSIGHTS_ENTRY } from '@/config/routes';

export default function HeatmapRedirect() {
  return (
    <Redirect
      href={{
        pathname: PROFILE_ROUTE.RIDER_INSIGHTS,
        params: { entry: RIDER_INSIGHTS_ENTRY.LEGACY_HEATMAP },
      }}
    />
  );
}
