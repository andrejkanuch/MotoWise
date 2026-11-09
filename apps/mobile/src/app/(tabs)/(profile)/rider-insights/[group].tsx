/**
 * One Rider insights group on its own page, under a native header titled with
 * the group. An unknown group (a stale or mistyped link) lands on the main
 * Rider insights screen instead.
 */
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PROFILE_ROUTE } from '@/config/routes';
import { detailGroupFrom } from '@/features/rider-insights/details/detail-format';
import {
  detailTitle,
  RiderInsightsDetailScreen,
} from '@/features/rider-insights/details/rider-insights-detail-screen';

export default function RiderInsightsDetailRoute() {
  const { t } = useTranslation();
  const { group } = useLocalSearchParams<{ group?: string }>();
  const detailGroup = detailGroupFrom(group);

  if (!detailGroup) return <Redirect href={{ pathname: PROFILE_ROUTE.RIDER_INSIGHTS }} />;

  return (
    <>
      <Stack.Screen options={{ title: detailTitle(detailGroup, t) }} />
      <RiderInsightsDetailScreen group={detailGroup} />
    </>
  );
}
