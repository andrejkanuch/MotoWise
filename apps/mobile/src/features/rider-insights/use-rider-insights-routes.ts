import { useSegments } from 'expo-router';
import { RIDER_INSIGHTS_STACK, type RiderInsightsStack } from '@/config/routes';

const HOME_GROUP = '(home)';

/** The Rider insights routes of the tab stack a screen is in, from its route segments. */
export function riderInsightsStackFor(segments: readonly string[]): RiderInsightsStack {
  return segments.includes(HOME_GROUP) ? RIDER_INSIGHTS_STACK.HOME : RIDER_INSIGHTS_STACK.PROFILE;
}

/**
 * The Rider insights routes of the current tab stack, so a page opened from
 * Home pushes its detail and recap pages on Home's stack and back stays there.
 */
export function useRiderInsightsRoutes(): RiderInsightsStack {
  const segments = useSegments();
  return riderInsightsStackFor(segments);
}
