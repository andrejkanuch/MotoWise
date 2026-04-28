import { palette } from '@motovault/design-system';
import { TripTemplatesDocument } from '@motovault/graphql';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AddableRouteRow,
  DraftTripStrip,
  InviteRidersCard,
  PlanRideCard,
  SmartTripSuggestion,
  TripBasket,
  TripDetailSheet,
} from '../../../components/discover/planner';
import { useWeatherForecast } from '../../../hooks/use-weather-forecast';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useTripPlannerStore } from '../../../stores/trip-planner.store';
import { useEditorialTheme } from '../../../theme/editorial';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Stable callbacks for AddableRouteRow — avoids inline closures defeating memo
const MemoizedAddableRouteRow = memo(AddableRouteRow);

export default function DiscoverScreen() {
  const { t } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { data: weather, locationStatus, requestPermission, coords } = useWeatherForecast();

  // Zustand store for basket state (survives tab switches)
  const basketIds = useTripPlannerStore((s) => s.basketIds);
  const toggleBasketItem = useTripPlannerStore((s) => s.toggleBasketItem);
  const removeFromBasket = useTripPlannerStore((s) => s.removeFromBasket);

  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Defer below-fold sections for faster first paint
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setBelowFoldReady(true));
    return () => task.cancel();
  }, []);

  useEffect(() => {
    trackEvent(AnalyticsEvent.DISCOVER_TAB_VIEWED);
  }, []);

  // --- Data fetching (trip templates for "Add roads" section) ---
  const { data: tripData, isLoading: tripsLoading } = useInfiniteQuery({
    queryKey: queryKeys.tripTemplates.list('{}'),
    queryFn: ({ pageParam }) =>
      gqlFetcher(TripTemplatesDocument, {
        filter: null,
        first: 20,
        after: pageParam ?? null,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      const pi = lastPage?.tripTemplates?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? undefined) : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allTrips = useMemo(() => {
    if (!tripData?.pages) return [];
    return tripData.pages.flatMap((p) => p?.tripTemplates?.edges?.map((e) => e.node) ?? []);
  }, [tripData]);

  const basketTrips = useMemo(
    () => allTrips.filter((trip) => basketIds.includes(trip.id)),
    [allTrips, basketIds],
  );

  // --- Callbacks ---

  const handleTripPress = useCallback(
    (tripId: string) => {
      router.push({ pathname: '/(modals)/trip-detail', params: { tripId } });
    },
    [router],
  );

  const handleCreatePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/create-trip');
  }, [router]);

  const handleOpenSheet = useCallback(() => setShowDetailSheet(true), []);

  // --- FAB animation ---
  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + (basketIds.length > 0 ? 200 : 110),
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            gap: 12,
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 10,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: t.ink3,
                marginBottom: 4,
              }}
            >
              Discover
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif',
                fontSize: 28,
                lineHeight: 30,
                letterSpacing: -0.6,
                color: t.ink,
              }}
            >
              Plan a ride
            </Text>
          </View>
          <Pressable
            onPress={() => {
              // TODO: P0-3 — wire to TypeaheadSearch
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={15} color={t.ink2} />
          </Pressable>
        </View>

        {/* Primary CTA — Plan a ride card */}
        <View style={{ marginTop: 6 }}>
          <PlanRideCard
            weatherLine={weather?.headline}
            locationDenied={locationStatus === 'denied'}
            onRequestLocation={requestPermission}
            coords={coords}
          />
        </View>

        {/* Continue planning — drafts */}
        <View style={{ marginTop: 20 }}>
          <DraftTripStrip />
        </View>

        {/* Smart suggestions */}
        <View style={{ marginTop: 24 }}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInUp.duration(300).delay(250)}
            style={{ gap: 4, marginBottom: 14 }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 10.5,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: t.warm,
                fontWeight: '600',
              }}
            >
              For your weekend
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif',
                fontSize: 22,
                lineHeight: 24,
                letterSpacing: -0.4,
                color: t.ink,
              }}
            >
              Built around <Text style={{ fontStyle: 'italic', color: t.warm }}>your GS</Text> &
              forecast
            </Text>
            <Text style={{ fontSize: 12.5, color: t.ink3, lineHeight: 17, marginTop: 2 }}>
              BMW R 1250 GS · 280 km tank
              {weather?.days?.[0]
                ? ` · ${Math.round(weather.days[0].tempMax)}°C ${weather.days[0].label.toLowerCase()}`
                : ''}
            </Text>
          </Animated.View>

          <SmartTripSuggestion
            onUse={handleCreatePress}
            onTweak={handleCreatePress}
            weatherReason={
              weather?.days?.[0]
                ? `${weather.days[0].label} today, ${Math.round(weather.days[0].tempMax)}°C — ${weather.days[0].precipProbability}% rain chance`
                : undefined
            }
          />
        </View>

        {/* Add roads to your trip — deferred for faster first paint */}
        {belowFoldReady && (
          <View style={{ marginTop: 24 }}>
            <Animated.View
              entering={reducedMotion ? undefined : FadeInUp.duration(300).delay(100)}
              style={{ marginBottom: 14 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontFamily: 'GeistMono',
                      fontSize: 10.5,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      color: t.ink2,
                      fontWeight: '600',
                      marginBottom: 4,
                    }}
                  >
                    Add roads to your trip
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'InstrumentSerif',
                      fontSize: 18,
                      color: t.ink,
                      lineHeight: 20,
                    }}
                  >
                    Stitched well with <Text style={{ fontStyle: 'italic' }}>your routes</Text>
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, color: t.ink3, lineHeight: 16, marginTop: 6 }}>
                Within a day's ride — tap + to chain into your current trip
              </Text>
            </Animated.View>

            {tripsLoading ? (
              <ActivityIndicator
                size="small"
                color={palette.accent500}
                style={{ paddingVertical: 24 }}
              />
            ) : (
              <View style={{ gap: 10 }}>
                {allTrips.slice(0, 6).map((trip) => (
                  <MemoizedAddableRouteRow
                    key={trip.id}
                    trip={trip}
                    added={basketIds.includes(trip.id)}
                    onToggle={toggleBasketItem}
                    onPress={handleTripPress}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Invite riders — deferred */}
        {belowFoldReady && (
          <View style={{ marginTop: 28 }}>
            <InviteRidersCard />
          </View>
        )}
      </ScrollView>

      {/* Floating trip basket */}
      <TripBasket items={basketTrips} onOpen={handleOpenSheet} onRemove={removeFromBasket} />

      {/* Create trip FAB */}
      <AnimatedPressable
        onPress={handleCreatePress}
        onPressIn={() => {
          fabScale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          fabScale.value = withTiming(1, { duration: 200 });
        }}
        accessibilityRole="button"
        accessibilityLabel="Create a new trip"
        accessibilityHint="Opens the trip planner"
        style={[
          {
            position: 'absolute',
            bottom: insets.bottom + 88,
            right: 14,
            height: 52,
            paddingLeft: 14,
            paddingRight: 18,
            borderRadius: 26,
            borderCurve: 'continuous',
            backgroundColor: palette.editorialSuccess,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            boxShadow: '0 0 0 6px rgba(78,186,111,0.10), 0 16px 30px rgba(78,186,111,0.45)',
          },
          fabStyle,
        ]}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={16} color="#fff" strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', letterSpacing: -0.1 }}>
          Create trip
        </Text>
      </AnimatedPressable>

      {/* Trip detail sheet */}
      {showDetailSheet && (
        <TripDetailSheet
          title="Gavia & Grimsel weekend"
          dateRange="Sat 27 → Sun 28 Apr"
          duration="2 days · 1 night"
          totalKm={627}
          totalElev={3370}
          fuelStops={2}
          ridingHours={14}
          days={[]}
          riders={[]}
          onClose={() => setShowDetailSheet(false)}
          onConfirm={() => {
            setShowDetailSheet(false);
            handleCreatePress();
          }}
          onEdit={() => {
            setShowDetailSheet(false);
            handleCreatePress();
          }}
        />
      )}
    </View>
  );
}
