import { MyMotorcyclesDocument, MyRidesDocument, StartRideDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertTriangle, Bike, ChevronDown, ChevronRight, Route, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreFlightChecklist } from '../../components/ride/pre-flight-checklist';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { formatDistance, formatRelativeDate } from '../../utils/ride-formatters';
import { startGPSListener } from '../../utils/ride-location';
import { checkAndRequestPermissions } from '../../utils/ride-permissions';
import { rideMMKV } from '../../utils/ride-storage';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

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

  const { data } = useQuery({
    queryKey: queryKeys.motorcycles.lists(),
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const motorcycles =
    (
      data as {
        myMotorcycles?: Array<{
          id: string;
          make: string;
          model: string;
          year: number;
          nickname?: string | null;
          isPrimary: boolean;
          mileageKm?: number | null;
        }>;
      }
    )?.myMotorcycles ?? [];

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
  // biome-ignore lint/suspicious/noExplicitAny: MyRidesQuery type doesn't expose totalCount in this query shape
  const totalRides = (ridesData as any)?.myRides?.totalCount ?? 0;
  // biome-ignore lint/suspicious/noExplicitAny: extracting node from edges array
  const lastRide = (ridesData as any)?.myRides?.edges?.[0]?.node;

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
    trackEvent(AnalyticsEvent.RIDE_STARTED, {
      ride_id: rideId ?? null,
      has_motorcycle: !!rideMMKV.getMotorcycleId(),
      motorcycle_id: rideMMKV.getMotorcycleId() ?? null,
      motorcycle_make: null,
      hud_layout: rideMMKV.getHudLayout() ?? 'A',
      is_resumed: true,
    });
    // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
    router.replace('/(modals)/ride-hud' as any);
  }, [startRide, router]);

  const handleEndUnfinished = useCallback(() => {
    const rideId = rideMMKV.getCurrentId();
    if (rideId) {
      enqueueOrExecute('endRide', {
        variables: { input: { rideId, endedAt: new Date().toISOString() } },
      });
      trackEvent(AnalyticsEvent.RIDE_ABANDONED, {
        ride_id: rideId,
        recovery_reason: 'crash',
      });
    }
    rideMMKV.setCurrentId('');
    setHasUnfinished(false);
  }, []);

  const handleStartRide = useCallback(async () => {
    setIsStarting(true);
    try {
      const level = await checkAndRequestPermissions();
      if (level === 'denied') {
        Alert.alert(t('startRide.locationRequired'), t('startRide.locationMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('startRide.openSettings'), onPress: () => Linking.openSettings() },
        ]);
        return;
      }

      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const rideId = Crypto.randomUUID();
      const startedAt = new Date().toISOString();

      rideMMKV.setCurrentId(rideId);
      rideMMKV.setStartedAt(Date.now());
      if (selectedBikeId) rideMMKV.setMotorcycleId(selectedBikeId);
      startRide();

      enqueueOrExecute('startRide', {
        mutationDocument: StartRideDocument,
        variables: {
          input: { rideId, motorcycleId: selectedBikeId, startedAt },
        },
      });

      await startGPSListener(() => {});

      trackEvent(AnalyticsEvent.RIDE_STARTED, {
        ride_id: rideId,
        has_motorcycle: !!selectedBikeId,
        motorcycle_id: selectedBikeId ?? null,
        motorcycle_make: selectedBike?.make ?? null,
        hud_layout: rideMMKV.getHudLayout() ?? 'A',
        is_resumed: false,
      });

      // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
      router.replace('/(modals)/ride-hud' as any);
    } catch (error) {
      console.error('[StartRide] Error:', error);
      Alert.alert(t('common.error'), t('startRide.startError'));
    } finally {
      setIsStarting(false);
    }
  }, [selectedBikeId, selectedBike?.make, startRide, router, t]);

  // Pulsing green dot animation for CTA
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(2.8, { duration: 1200 }),
      ),
      -1,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 0 }),
        withTiming(0, { duration: 1200 }),
      ),
      -1,
    );
  }, [pulseScale, pulseOpacity]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: '#4ade80',
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const mileageLabel = useMemo(() => {
    if (!selectedBike) return '';
    // biome-ignore lint/suspicious/noExplicitAny: mileageKm may not be in generated type yet
    const km = (selectedBike as any).mileageKm;
    if (km != null && km > 0) {
      return system === 'imperial'
        ? `${Math.round(km * 0.621371).toLocaleString()} mi`
        : `${km.toLocaleString()} km`;
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
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 10.5,
              fontWeight: '500',
              color: theme.ink3,
              textTransform: 'uppercase',
              letterSpacing: 10.5 * 0.22,
              marginBottom: 14,
            }}
          >
            {t('startRide.preFlight')}
          </Text>
          <Text
            style={{
              fontSize: 58,
              fontWeight: '600',
              color: theme.ink,
              letterSpacing: -58 * 0.035,
              lineHeight: 58 * 0.96,
            }}
          >
            {t('startRide.readyTo')}
            {'\n'}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', fontWeight: '400', letterSpacing: -58 * 0.025 }}>
              {t('startRide.ride')}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 15.5,
              color: theme.ink2,
              lineHeight: 15.5 * 1.45,
              marginTop: 16,
              maxWidth: 320,
              letterSpacing: -0.08,
            }}
          >
            {t('startRide.subtitle')}
          </Text>
        </Animated.View>

        {/* Unfinished ride banner */}
        {hasUnfinished && (
          <Animated.View
            entering={FadeInUp.delay(50).duration(280)}
            style={{
              backgroundColor: tint(theme.warm, 0.1),
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              gap: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: tint(theme.warm, 0.3),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color={theme.warm} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.warm }}>
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
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.bg }}>
                  {t('startRide.resume')}
                </Text>
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
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink2 }}>
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
                backgroundColor: selectedBikeId ? tint(theme.warm, 0.15) : theme.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedBikeId ? (
                <Bike size={24} color={theme.warm} />
              ) : (
                <Zap size={24} color={theme.ink3} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: 'GeistMono',
                  fontSize: 9.5,
                  fontWeight: '500',
                  color: theme.warm,
                  textTransform: 'uppercase',
                  letterSpacing: 9.5 * 0.2,
                  marginBottom: 5,
                }}
              >
                {t('startRide.riding')}
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: theme.ink,
                  letterSpacing: -17 * 0.018,
                  lineHeight: 17 * 1.15,
                }}
                numberOfLines={1}
              >
                {selectedBikeLabel || t('startRide.selectMotorcycle')}
              </Text>
              {selectedBike && (
                <Text style={{ fontSize: 12.5, color: theme.ink3, marginTop: 3, letterSpacing: -0.05 }}>
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
                        if (process.env.EXPO_OS === 'ios')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                          backgroundColor: tint(theme.warm, 0.12),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Bike size={18} color={theme.warm} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ fontSize: 13, fontWeight: '600', color: theme.ink }}
                          numberOfLines={1}
                        >
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
                  if (process.env.EXPO_OS === 'ios')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                <Text style={{ flex: 1, fontSize: 13, color: theme.ink2, fontWeight: '500' }}>
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
                // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
                router.push('/(tabs)/(profile)/rides' as any);
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
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Italic',
                  fontSize: 30,
                  lineHeight: 30,
                  letterSpacing: -0.6,
                  color: theme.ink,
                  minWidth: 36,
                }}
              >
                {totalRides}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: theme.ink, letterSpacing: -0.15, lineHeight: 14.5 * 1.2 }}>
                  {t('startRide.previousRides')}
                </Text>
                {lastRide && (
                  <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 3, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                    Last: {formatDistance(lastRide.distanceM ?? 0, system)} · {formatRelativeDate(lastRide.startedAt)}
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
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: theme.ink,
              opacity: isStarting || hasUnfinished ? 0.5 : pressed ? 0.85 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            })}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={theme.bg} />
            ) : (
              <>
                <View style={{ width: 9, height: 9, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={pulseRingStyle} />
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      backgroundColor: '#4ade80',
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 17.5,
                    fontWeight: '600',
                    color: theme.bg,
                    letterSpacing: -17.5 * 0.012,
                  }}
                >
                  {t('startRide.startButton')}
                </Text>
              </>
            )}
          </Pressable>
          <Text
            style={{
              fontSize: 11.5,
              color: theme.ink3,
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 11.5 * 1.4,
            }}
          >
            {t('startRide.trackingNote')}
          </Text>

          {hasUnfinished && (
            <Animated.Text
              entering={FadeIn.delay(300).duration(200)}
              style={{
                fontSize: 13,
                color: theme.warm,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              {t('startRide.resolveUnfinished')}
            </Animated.Text>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
