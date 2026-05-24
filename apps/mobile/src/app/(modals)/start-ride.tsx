import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, MyRidesDocument, StartRideDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { AlertTriangle, Bike, ChevronDown, ChevronRight, Route, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
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

// ─── Slide to Start Component ───────────────────────────────────────────────────

const TRACK_HEIGHT = 64;
const THUMB_SIZE = 52;
const THUMB_MARGIN = 6;

function SlideToAction({
  onComplete,
  disabled,
  label,
}: {
  onComplete: () => void;
  disabled: boolean;
  label: string;
}) {
  const { t: theme } = useEditorialTheme();
  const translateX = useSharedValue(0);
  const trackWidth = useSharedValue(0);

  const maxSlide = () => trackWidth.value - THUMB_SIZE - THUMB_MARGIN * 2;

  const handleComplete = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onComplete();
  }, [onComplete]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      const max = maxSlide();
      translateX.value = Math.min(Math.max(0, e.translationX), max);
    })
    .onEnd(() => {
      const max = maxSlide();
      if (translateX.value > max * 0.85) {
        translateX.value = withSpring(max, { damping: 15 });
        runOnJS(handleComplete)();
      } else {
        translateX.value = withSpring(0, { damping: 15 });
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, maxSlide() * 0.5], [1, 0], 'clamp'),
  }));

  return (
    <View
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
      style={{
        width: '100%',
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        borderCurve: 'continuous',
        backgroundColor: theme.ink,
        opacity: disabled ? 0.5 : 1,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Label */}
      <Animated.Text
        style={[
          {
            position: 'absolute',
            alignSelf: 'center',
            fontSize: 15,
            fontWeight: '600',
            color: theme.bg,
            letterSpacing: -0.2,
          },
          labelStyle,
        ]}
      >
        {label}
      </Animated.Text>

      {/* Thumb */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              borderCurve: 'continuous',
              backgroundColor: palette.signature500,
              marginLeft: THUMB_MARGIN,
              alignItems: 'center',
              justifyContent: 'center',
            },
            thumbStyle,
          ]}
        >
          <ChevronRight size={20} color="#fff" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ─── GPS Status Indicator ───────────────────────────────────────────────────────

function GPSStatusIndicator({ accuracy, isReady }: { accuracy: number | null; isReady: boolean }) {
  const { t: theme } = useEditorialTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isReady) {
      pulse.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isReady, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const dotColor = isReady ? theme.success : palette.signature400;
  const label = accuracy != null ? `GPS: ${Math.round(accuracy)}m` : 'Acquiring GPS...';

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
      }}
    >
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
          },
          dotStyle,
        ]}
      />
      <Text style={{ fontSize: 12, color: theme.ink3, fontWeight: '500' }}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

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

  // GPS readiness state
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsOverride, setGpsOverride] = useState(false);
  const [gpsLowWarning, setGpsLowWarning] = useState(false);
  const gpsMountTime = useRef(Date.now());
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  // GPS watcher
  useEffect(() => {
    gpsMountTime.current = Date.now();
    let overrideTimer: ReturnType<typeof setTimeout> | null = null;

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationWatcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (location) => {
          const acc = location.coords.accuracy ?? null;
          setGpsAccuracy(acc);
          if (acc != null && acc < 20) {
            setGpsReady(true);
          }
        },
      );

      // 10s override timeout
      overrideTimer = setTimeout(() => {
        setGpsOverride(true);
      }, 10000);
    };

    startWatching();

    return () => {
      locationWatcher.current?.remove();
      if (overrideTimer) clearTimeout(overrideTimer);
    };
  }, []);

  // Show low accuracy warning when override kicks in but GPS not ready
  useEffect(() => {
    if (gpsOverride && !gpsReady) {
      setGpsLowWarning(true);
    }
  }, [gpsOverride, gpsReady]);

  const canStart = gpsReady || gpsOverride;

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

      // Track GPS readiness analytics
      const waitTimeS = (Date.now() - gpsMountTime.current) / 1000;
      trackEvent(AnalyticsEvent.RIDE_GPS_READINESS, {
        accuracy: gpsAccuracy ?? -1,
        wait_time_s: Math.round(waitTimeS * 10) / 10,
        was_override: !gpsReady && gpsOverride,
      });

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
  }, [
    selectedBikeId,
    selectedBike?.make,
    startRide,
    router,
    t,
    gpsAccuracy,
    gpsReady,
    gpsOverride,
  ]);

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
            width: 36,
            height: 36,
            borderRadius: 18,
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
              fontSize: 10,
              fontWeight: '700',
              color: theme.ink3,
              textTransform: 'uppercase',
              letterSpacing: 1.6,
              marginBottom: 8,
            }}
          >
            {t('startRide.preFlight')}
          </Text>
          <Text
            style={{
              fontSize: 50,
              fontWeight: '200',
              color: theme.ink,
              letterSpacing: -2,
              lineHeight: 50,
            }}
          >
            {t('startRide.readyTo')}
            {'\n'}
            <Text style={{ fontStyle: 'italic', fontWeight: '300' }}>{t('startRide.ride')}</Text>
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: theme.ink3,
              lineHeight: 20,
              marginTop: 12,
              maxWidth: 280,
            }}
          >
            {t('startRide.subtitle')}
          </Text>
        </Animated.View>

        {/* GPS Status Indicator */}
        <GPSStatusIndicator accuracy={gpsAccuracy} isReady={gpsReady} />

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
              borderRadius: 18,
              borderCurve: 'continuous',
              padding: 14,
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
                borderRadius: 14,
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
                  fontSize: 9,
                  fontWeight: '700',
                  color: theme.ink3,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  marginBottom: 3,
                }}
              >
                {t('startRide.riding')}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: theme.ink,
                  letterSpacing: -0.2,
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {selectedBikeLabel || t('startRide.selectMotorcycle')}
              </Text>
              {selectedBike && (
                <Text style={{ fontSize: 12, color: theme.ink3 }}>
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
                gap: 12,
                padding: 14,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 14,
                borderCurve: 'continuous',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: tint(theme.warm, 0.1),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Route size={14} color={theme.warm} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.ink }}>
                  {t('startRide.previousRides')}
                  <Text style={{ fontWeight: '500', color: theme.ink3 }}> · {totalRides}</Text>
                </Text>
                {lastRide && (
                  <Text style={{ fontSize: 11, color: theme.ink3, marginTop: 2 }} numberOfLines={1}>
                    Last: {lastRide.name || 'Ride'} —{' '}
                    {formatDistance(lastRide.distanceM ?? 0, system)} ·{' '}
                    {formatRelativeDate(lastRide.startedAt)}
                  </Text>
                )}
              </View>
              <ChevronRight size={14} color={theme.ink3} />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* CTA — pinned at bottom */}
      <View style={{ paddingHorizontal: 26, paddingBottom: insets.bottom + 16, paddingTop: 12 }}>
        <Animated.View entering={FadeInUp.delay(250).duration(300)}>
          <SlideToAction
            onComplete={handleStartRide}
            disabled={isStarting || hasUnfinished || !canStart}
            label={t('startRide.slideToStart', { defaultValue: 'Slide to Start Ride' })}
          />
          <Text
            style={{
              fontSize: 11,
              color: theme.ink3,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            {t('startRide.trackingNote')}
          </Text>

          {gpsLowWarning && (
            <Animated.Text
              entering={FadeIn.delay(100).duration(200)}
              style={{
                fontSize: 12,
                color: palette.signature400,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              GPS accuracy is low — ride may not track properly
            </Animated.Text>
          )}

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
