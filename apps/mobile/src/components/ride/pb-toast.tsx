import { RideOverviewDocument, type RideOverviewQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { type Href, useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useEditorialTheme } from '../../theme/editorial';

const RECORD_LABELS: Record<string, string> = {
  longest_distance: 'Longest ride',
  longest_duration: 'Longest duration',
  top_speed: 'Top speed',
  max_elevation_gain: 'Most elevation',
  longest_streak: 'Longest streak',
};

interface PbToastProps {
  rideId: string;
}

/**
 * Personal-best toast shown on the ride summary screen after ride completion.
 * Queries rideOverview to check if the just-completed ride set any new records.
 * Only fires when previous_value is not null (first-ride records are suppressed).
 */
export function PbToast({ rideId }: PbToastProps) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data } = useQuery<RideOverviewQuery>({
    queryKey: queryKeys.rides.overview,
    queryFn: () => gqlFetcher(RideOverviewDocument),
    staleTime: 0, // Always re-fetch after ride completion
  });

  // Find records that belong to this ride AND have a previous value (not first-ever)
  const newRecords = useMemo(
    () =>
      (data?.rideOverview?.personalRecords ?? []).filter(
        (r) => r.rideId === rideId && r.previousValue != null,
      ),
    [data?.rideOverview?.personalRecords, rideId],
  );

  useEffect(() => {
    if (newRecords.length === 0) return;

    setVisible(true);

    // Haptic feedback
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Track event
    const first = newRecords[0];
    if (newRecords.length === 1 && first) {
      trackEvent(AnalyticsEvent.PB_TOAST_SEEN, {
        recordType: first.recordType,
        value: first.value,
        previousValue: first.previousValue ?? null,
        rideId,
      });
    } else {
      trackEvent(AnalyticsEvent.PB_TOAST_SEEN, {
        recordTypes: newRecords.map((r) => r.recordType),
        rideId,
      });
    }

    // Auto-dismiss after 5s
    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
      trackEvent(AnalyticsEvent.PB_TOAST_DISMISSED, { reason: 'timeout' });
    }, 5000);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [newRecords, rideId]);

  const handleTap = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setVisible(false);
    trackEvent(AnalyticsEvent.PB_TOAST_TAPPED, {
      recordType: newRecords[0]?.recordType,
      rideId,
    });
    const route: Href = { pathname: '/(modals)/ride-detail', params: { rideId } };
    router.push(route);
  }, [newRecords, rideId, router]);

  if (!visible || newRecords.length === 0) return null;

  const isSingle = newRecords.length === 1;
  const record = newRecords[0];
  const delta =
    isSingle && record.previousValue
      ? Math.round(((record.value - record.previousValue) / record.previousValue) * 100)
      : null;

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutDown.duration(250)}
      style={{
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        zIndex: 100,
      }}
    >
      <Pressable
        onPress={handleTap}
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: theme.ink,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: `${theme.warm}20`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trophy size={20} color={theme.warm} />
        </View>
        <View style={{ flex: 1 }}>
          {isSingle ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.ink }}>
                {t('rideSummary.newPersonalBest')}
              </Text>
              <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 2 }}>
                {RECORD_LABELS[record.recordType] ?? record.recordType}
                {delta != null && delta > 0 ? ` (+${delta}%)` : ''}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.ink }}>
                {t('rideSummary.newPersonalBests', { count: newRecords.length })}
              </Text>
              <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 2 }}>
                {newRecords.map((r) => RECORD_LABELS[r.recordType] ?? r.recordType).join(' · ')}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
