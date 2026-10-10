import { MyMotorcyclesDocument, MyRidesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertTriangle, Bike, ChevronDown, ChevronRight, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationDisclosureModal } from '../../components/ride/location-disclosure-modal';
import { PreFlightChecklist } from '../../components/ride/pre-flight-checklist';
import {
  buildRideSummaryHref,
  endRideSession,
  startRideSession,
} from '../../features/ride/ride-controller';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { distanceUnitLabel, formatDistance, formatRelativeDate } from '../../utils/ride-formatters';
import { startGPSListener } from '../../utils/ride-location';
import {
  hasAllLocationPermissions,
  markPrePromptDismissed,
  shouldShowPrePrompt,
} from '../../utils/ride-permissions';
import {
  armRideReminders,
  cancelRideReminders,
  rideEndTrimTarget,
} from '../../utils/ride-reminders';
import { rideMMKV } from '../../utils/ride-storage';

export default function StartRideScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const startRide = useRideStore((s) => s.startRide);
  const system = useMeasurementSystem();
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasUnfinished, setHasUnfinished] = useState(false);
  const [showBikePicker, setShowBikePicker] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const { data } = useQuery({
    queryKey: queryKeys.motorcycles.lists(),
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const motorcycles = data?.myMotorcycles ?? [];

  const selectedBike = motorcycles.find((m) => m.id === selectedBikeId);
  const selectedBikeLabel = selectedBike
    ? selectedBike.nickname || `${selectedBike.year} ${selectedBike.make} ${selectedBike.model}`
    : selectedBikeId === null
      ? 'Quick Ride'
      : '';

  // Fetch recent rides for the "Previous rides" link
  const { data: ridesData } = useQuery({
    queryKey: queryKeys.rides.summary,
    queryFn: () => gqlFetcher(MyRidesDocument, { first: 1 }),
  });
  const totalRides = ridesData?.myRides?.totalCount ?? 0;
  const lastRide = ridesData?.myRides?.edges?.[0]?.node;

  // Default to primary bike
  useEffect(() => {
    if (motorcycles.length > 0 && selectedBikeId === null) {
      const primary = motorcycles.find((m) => m.isPrimary);
      setSelectedBikeId(primary?.id ?? motorcycles[0].id);
    }
  }, [motorcycles, selectedBikeId]);

  // Crash recovery
  useEffect(() => {
    const currentId = rideMMKV.getCurrentId();
    if (currentId) setHasUnfinished(true);
  }, []);

  const handleResume = useCallback(() => {
    const rideId = rideMMKV.getCurrentId();
    startRide();
    startGPSListener(() => {});
    void armRideReminders();
    trackEvent(AnalyticsEvent.RIDE_STARTED, {
      ride_id: rideId ?? null,
      has_motorcycle: !!rideMMKV.getMotorcycleId(),
      motorcycle_id: rideMMKV.getMotorcycleId() ?? null,
      motorcycle_make: null,
      hud_layout: rideMMKV.getHudLayout() ?? 'A',
      is_resumed: true,
    });
    router.replace('/(modals)/ride-hud');
  }, [startRide, router]);

  const handleEndUnfinished = useCallback(() => {
    const rideId = rideMMKV.getCurrentId();
    if (rideId) {
      trackEvent(AnalyticsEvent.RIDE_ABANDONED, {
        ride_id: rideId,
        recovery_reason: 'crash',
      });
      // End it like any other ride, from the waypoints already on the phone and
      // trimmed to the last movement. This used to send distance 0 with no route —
      // throwing the recorded ride away, and overwriting the real distance if the
      // server sweep had already closed it.
      const summary = endRideSession('phone', { endAt: rideEndTrimTarget() });
      if (summary) {
        setHasUnfinished(false);
        router.replace(buildRideSummaryHref(summary));
        return;
      }
    }
    void cancelRideReminders();
    rideMMKV.setCurrentId('');
    setHasUnfinished(false);
  }, [router]);

  const runStartRide = useCallback(
    async (allowApproximate = false) => {
      setIsStarting(true);
      try {
        const result = await startRideSession({
          motorcycleId: selectedBikeId,
          source: 'phone',
          motorcycleMake: selectedBike?.make ?? null,
          allowApproximate,
        });

        if (!result.ok) {
          if (result.reason === 'approximate') {
            trackEvent(AnalyticsEvent.RIDE_GPS_READINESS, { status: 'approximate_location' });
            Alert.alert(t('startRide.approximateTitle'), t('startRide.approximateBody'), [
              { text: t('startRide.rideAnyway'), onPress: () => void runStartRide(true) },
              { text: t('startRide.openSettings'), onPress: () => Linking.openSettings() },
            ]);
          } else if (result.reason === 'denied') {
            Alert.alert(t('startRide.locationRequired'), t('startRide.locationMessage'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('startRide.openSettings'), onPress: () => Linking.openSettings() },
            ]);
          } else {
            // gps_failed — the listener threw; the controller already rolled back.
            Alert.alert(t('common.error'), t('startRide.startError'));
          }
          return;
        }

        router.replace('/(modals)/ride-hud');
      } catch (error) {
        captureException(error, { source: 'start-ride.startRide' });
        Alert.alert(t('common.error'), t('startRide.startError'));
      } finally {
        setIsStarting(false);
      }
    },
    [selectedBikeId, selectedBike?.make, router, t],
  );

  const handleStartRide = useCallback(async () => {
    // Prominent disclosure (Google Play policy + Expo guidance): explain background
    // location collection BEFORE the OS prompt / Android 11+ Settings redirect.
    // Skip only when both permissions are already granted — nothing to disclose.
    if (await hasAllLocationPermissions()) {
      await runStartRide();
      return;
    }
    // Honor the 7-day cooldown after a "Not now" decline — don't re-nag with the
    // disclosure; start the ride directly (runStartRide degrades to foreground-only).
    if (!shouldShowPrePrompt()) {
      await runStartRide();
      return;
    }
    setShowDisclosure(true);
  }, [runStartRide]);

  const handleDisclosureContinue = useCallback(() => {
    setShowDisclosure(false);
    void runStartRide();
  }, [runStartRide]);

  const handleDisclosureDismiss = useCallback(() => {
    // Record the decline so the existing 7-day cooldown can suppress re-nagging.
    markPrePromptDismissed();
    setShowDisclosure(false);
  }, []);

  // Pulsing green dot animation for CTA
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(withTiming(1, { duration: 0 }), withTiming(2.8, { duration: 1200 })),
      -1,
    );
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.55, { duration: 0 }), withTiming(0, { duration: 1200 })),
      -1,
    );
  }, [pulseScale, pulseOpacity]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: theme.success,
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const mileageLabel = useMemo(() => {
    if (!selectedBike) return '';
    const mileage = selectedBike.currentMileage;
    if (mileage != null && mileage > 0) {
      // Unit follows the user's profile preference, not the deprecated per-bike field.
      return `${mileage.toLocaleString()} ${distanceUnitLabel(system)}`;
    }
    return 'NA';
  }, [selectedBike, system]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Close button — pinned top */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 26, paddingBottom: 8 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            alignSelf: 'flex-start',
            width: 38,
            height: 38,
            borderRadius: 19,
            borderCurve: 'continuous',
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={15} color={theme.ink2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 26,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial headline */}
        <Animated.View entering={FadeInUp.duration(300)} style={{ marginBottom: 22 }}>
          <Text accessibilityRole="header" style={[type.largeTitle, { color: theme.ink }]}>
            {t('startRide.readyToRide')}
          </Text>
          <Text style={[type.body, { color: theme.ink2, marginTop: space.xs, maxWidth: 320 }]}>
            {t('startRide.subtitle')}
          </Text>
        </Animated.View>

        {/* Unfinished ride banner */}
        {hasUnfinished && (
          <Animated.View
            entering={FadeInUp.delay(50).duration(280)}
            style={{
              backgroundColor: tint(theme.plateDue, 0.1),
              borderRadius: radius.card,
              borderCurve: 'continuous',
              padding: 16,
              gap: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: tint(theme.plateDue, 0.3),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color={theme.plateDue} />
              <Text style={[type.bodyStrong, { color: theme.ink, flex: 1 }]}>
                {t('startRide.unfinishedTitle')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleResume}
                accessibilityRole="button"
                accessibilityLabel="Resume unfinished ride"
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: theme.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[type.bodyStrong, { color: theme.bg }]}>{t('startRide.resume')}</Text>
              </Pressable>
              <Pressable
                onPress={handleEndUnfinished}
                accessibilityRole="button"
                accessibilityLabel="End unfinished ride"
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: theme.line,
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[type.bodyStrong, { color: theme.ink2 }]}>
                  {t('startRide.endRide')}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Bike picker */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ marginBottom: 10 }}>
          <Pressable
            onPress={() => setShowBikePicker((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`Selected bike: ${selectedBikeLabel}. Tap to change.`}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 22,
              borderCurve: 'continuous',
              padding: 14,
              paddingRight: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            {/* Bike avatar */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: theme.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedBikeId ? (
                <Bike size={24} color={theme.ink2} />
              ) : (
                <Zap size={24} color={theme.ink3} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.caption, { color: theme.ink3, marginBottom: 2 }]}>
                {t('startRide.riding')}
              </Text>
              <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
                {selectedBikeLabel || t('startRide.selectMotorcycle')}
              </Text>
              {selectedBike && (
                <Text style={[type.caption, { color: theme.ink3, marginTop: 2 }]}>
                  {selectedBike.model} · {mileageLabel}
                </Text>
              )}
            </View>
            <View
              style={{
                transform: [{ rotate: showBikePicker ? '180deg' : '0deg' }],
              }}
            >
              <ChevronDown size={16} color={theme.ink3} />
            </View>
          </Pressable>

          {/* Expanded bike picker */}
          {showBikePicker && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 4,
                marginTop: 8,
              }}
            >
              {motorcycles
                .filter((b) => b.id !== selectedBikeId)
                .map((bike) => {
                  const label = bike.nickname || `${bike.year} ${bike.make} ${bike.model}`;
                  return (
                    <Pressable
                      key={bike.id}
                      onPress={() => {
                        triggerImpact(Haptics.ImpactFeedbackStyle.Light);
                        trackEvent(AnalyticsEvent.RIDE_BIKE_CHANGED, {
                          from_motorcycle_id: selectedBikeId ?? null,
                          to_motorcycle_id: bike.id,
                          motorcycle_count: motorcycles.length,
                        });
                        setSelectedBikeId(bike.id);
                        setShowBikePicker(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          borderCurve: 'continuous',
                          backgroundColor: theme.surface2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Bike size={18} color={theme.ink2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                      <ChevronRight size={14} color={theme.ink4} />
                    </Pressable>
                  );
                })}
              {/* Quick ride option */}
              <Pressable
                onPress={() => {
                  triggerImpact(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedBikeId(null);
                  setShowBikePicker(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  borderTopWidth: 1,
                  borderTopColor: theme.line2,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    backgroundColor: theme.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap size={18} color={theme.ink3} />
                </View>
                <Text style={[type.body, { flex: 1, color: theme.ink2 }]}>
                  {t('startRide.quickRideNoBike')}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>

        {/* Pre-flight checklist */}
        <Animated.View entering={FadeInUp.delay(150).duration(300)}>
          <PreFlightChecklist motorcycleId={selectedBikeId} />
        </Animated.View>

        {/* Previous rides link */}
        {totalRides > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ marginTop: 14 }}>
            <Pressable
              onPress={() => {
                router.push('/(tabs)/(profile)/rides');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                paddingRight: 18,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 22,
                borderCurve: 'continuous',
              }}
            >
              <Text style={[type.figure, { color: theme.ink, minWidth: 36 }]}>{totalRides}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type.bodyStrong, { color: theme.ink }]}>
                  {t('startRide.previousRides')}
                </Text>
                {lastRide && (
                  <Text
                    style={[
                      type.caption,
                      { color: theme.ink3, marginTop: 2, fontVariant: ['tabular-nums'] },
                    ]}
                    numberOfLines={1}
                  >
                    {t('startRide.lastRideSummary', {
                      distance: formatDistance(lastRide.distanceM ?? 0, system),
                      date: formatRelativeDate(lastRide.startedAt),
                    })}
                  </Text>
                )}
              </View>
              <ChevronRight size={14} color={theme.ink2} />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* CTA — pinned at bottom */}
      <View style={{ paddingHorizontal: 26, paddingBottom: insets.bottom + 16, paddingTop: 12 }}>
        <Animated.View entering={FadeInUp.delay(250).duration(300)}>
          <Pressable
            onPress={handleStartRide}
            disabled={isStarting || hasUnfinished}
            accessibilityRole="button"
            accessibilityLabel="Start ride"
            accessibilityState={{ disabled: isStarting || hasUnfinished }}
            style={({ pressed }) => ({
              width: '100%',
              height: 60,
              borderRadius: radius.pill,
              borderCurve: 'continuous',
              backgroundColor: theme.warm,
              opacity: isStarting || hasUnfinished ? 0.5 : pressed ? 0.85 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            })}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={theme.onWarm} />
            ) : (
              <>
                <View
                  style={{ width: 9, height: 9, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Animated.View style={pulseRingStyle} />
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      backgroundColor: theme.success,
                    }}
                  />
                </View>
                <Text style={[type.bodyStrong, { color: theme.onWarm }]}>
                  {t('startRide.startButton')}
                </Text>
              </>
            )}
          </Pressable>
          <Text
            style={[type.caption, { color: theme.ink3, textAlign: 'center', marginTop: space.sm }]}
          >
            {t('startRide.trackingNote')}
          </Text>

          {hasUnfinished && (
            <Animated.Text
              entering={FadeIn.delay(300).duration(200)}
              style={[
                type.label,
                { color: theme.plateDue, textAlign: 'center', marginTop: space.sm },
              ]}
            >
              {t('startRide.resolveUnfinished')}
            </Animated.Text>
          )}
        </Animated.View>
      </View>

      <LocationDisclosureModal
        visible={showDisclosure}
        onContinue={handleDisclosureContinue}
        onDismiss={handleDisclosureDismiss}
      />
    </View>
  );
}
