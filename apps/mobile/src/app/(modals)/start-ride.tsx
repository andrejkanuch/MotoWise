import { MyMotorcyclesDocument, MyRidesDocument, StartRideDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertTriangle, Bike, ChevronDown, ChevronRight, Route, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
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
    startRide();
    startGPSListener(() => {});
    // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
    router.replace('/(modals)/ride-hud' as any);
  }, [startRide, router]);

  const handleEndUnfinished = useCallback(() => {
    const rideId = rideMMKV.getCurrentId();
    if (rideId) {
      enqueueOrExecute('endRide', {
        variables: { input: { rideId, endedAt: new Date().toISOString() } },
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
        has_motorcycle: !!selectedBikeId,
      });

      // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
      router.replace('/(modals)/ride-hud' as any);
    } catch (error) {
      console.error('[StartRide] Error:', error);
      Alert.alert(t('common.error'), t('startRide.startError'));
    } finally {
      setIsStarting(false);
    }
  }, [selectedBikeId, startRide, router, t]);

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
          <Pressable
            onPress={handleStartRide}
            disabled={isStarting || hasUnfinished}
            accessibilityRole="button"
            accessibilityLabel="Start ride"
            accessibilityState={{ disabled: isStarting || hasUnfinished }}
            style={({ pressed }) => ({
              width: '100%',
              paddingVertical: 20,
              paddingHorizontal: 18,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: theme.ink,
              opacity: isStarting || hasUnfinished ? 0.5 : pressed ? 0.85 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            })}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={theme.bg} />
            ) : (
              <>
                {/* Left spacer to balance the chevron */}
                <View style={{ width: 18 }} />
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.success,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.bg,
                      letterSpacing: -0.2,
                    }}
                  >
                    {t('startRide.startButton')}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.bg} />
              </>
            )}
          </Pressable>
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
