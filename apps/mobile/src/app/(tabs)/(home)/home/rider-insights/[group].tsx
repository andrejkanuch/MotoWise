/**
 * Home's copy of one Rider insights page, so back returns along Home's stack.
 * The page lives in `features/rider-insights/details/rider-insights-detail-page.tsx`.
 */
import { RiderInsightsDetailPage } from '@/features/rider-insights/details/rider-insights-detail-page';

export default function HomeRiderInsightsDetailRoute() {
  return <RiderInsightsDetailPage />;
}
