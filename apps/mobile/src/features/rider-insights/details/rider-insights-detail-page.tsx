/**
 * One Rider insights group on its own page, under a native header titled with
 * the group. An unknown group (a stale or mistyped link) lands on the main
 * Rider insights screen of the same tab stack instead.
 */
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRiderInsightsRoutes } from '../use-rider-insights-routes';
import { detailGroupFrom } from './detail-format';
import { detailTitle, RiderInsightsDetailScreen } from './rider-insights-detail-screen';

export function RiderInsightsDetailPage() {
  const { t } = useTranslation();
  const routes = useRiderInsightsRoutes();
  const { group } = useLocalSearchParams<{ group?: string }>();
  const detailGroup = detailGroupFrom(group);

  if (!detailGroup) return <Redirect href={{ pathname: routes.MAIN }} />;

  return (
    <>
      <Stack.Screen options={{ title: detailTitle(detailGroup, t) }} />
      <RiderInsightsDetailScreen group={detailGroup} />
    </>
  );
}
