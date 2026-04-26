import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, StartRideDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bike,
  ChevronDown,
  ChevronRight,
  Navigation,
  X,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';
import { useEditorialTheme } from '../../theme/editorial';
import { startGPSListener } from '../../utils/ride-location';
import { checkAndRequestPermissions } from '../../utils/ride-permissions';
import { rideMMKV } from '../../utils/ride-storage';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

export default function StartRideScreen() {
  const router = useRouter();
  const { isDark } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const startRide = useRideStore((s) => s.startRide);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasUnfinished, setHasUnfinished] = useState(false);
  const [showBikePicker, setShowBikePicker] = useState(false);

  const { data, isLoading } = useQuery({
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
        }>;
      }
    )?.myMotorcycles ?? [];

  const selectedBike = motorcycles.find((m) => m.id === selectedBikeId);
  const selectedBikeLabel = selectedBike
    ? selectedBike.nickname || `${selectedBike.year} ${selectedBike.make} ${selectedBike.model}`
    : selectedBikeId === null
      ? 'Quick Ride'
      : '';
  const hasSingleBike = motorcycles.length === 1;

  // Default to primary bike
  useEffect(() => {
    if (motorcycles.length > 0 && selectedBikeId === null) {
      const primary = motorcycles.find((m) => m.isPrimary);
      setSelectedBikeId(primary?.id ?? motorcycles[0].id);
    }
  }, [motorcycles, selectedBikeId]);

  // Crash recovery: check for unfinished ride
  useEffect(() => {
    const currentId = rideMMKV.getCurrentId();
    if (currentId) {
      setHasUnfinished(true);
    }
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
        variables: {
          input: {
            rideId,
            endedAt: new Date().toISOString(),
          },
        },
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
        Alert.alert(
          'Location Required',
          'MotoVault needs location access to record your ride. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
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
          input: {
            rideId,
            motorcycleId: selectedBikeId,
            startedAt,
          },
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
      Alert.alert('Error', 'Failed to start ride. Please try again.');
    } finally {
      setIsStarting(false);
    }
  }, [selectedBikeId, startRide, router]);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.surfaceDark : palette.neutral50 }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 32,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
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
            backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <X size={18} color={isDark ? palette.neutral400 : palette.neutral500} />
        </Pressable>

        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={{ alignItems: 'center', marginBottom: 32 }}
        >
          <Animated.View
            entering={ZoomIn.delay(100).springify().damping(12)}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.accentTint : palette.accentBgLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Navigation size={32} color={palette.accent500} />
          </Animated.View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: isDark ? palette.white : palette.neutral950,
              letterSpacing: -0.5,
            }}
          >
            Ready to Ride
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: isDark ? palette.neutral400 : palette.neutral500,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            GPS tracking, speed, and route recording
          </Text>
        </Animated.View>

        {/* Unfinished ride banner */}
        {hasUnfinished && (
          <Animated.View
            entering={FadeInUp.delay(50).duration(280)}
            style={{
              backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              gap: 12,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: palette.warningBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color={palette.warning500} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.warning500 }}>
                Unfinished ride detected
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleResume}
                accessibilityRole="button"
                accessibilityLabel="Resume unfinished ride"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: palette.accent500,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                  Resume
                </Text>
              </Pressable>
              <Pressable
                onPress={handleEndUnfinished}
                accessibilityRole="button"
                accessibilityLabel="End unfinished ride"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  borderColor: palette.neutral600,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: palette.neutral300 }}>
                  End Ride
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Bike selector — compact for single bike, expandable for multi */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)}>
          {isLoading && motorcycles.length === 0 ? (
            /* Offline with no cache — Quick Ride fallback */
            <View
              style={{
                backgroundColor: isDark ? palette.cardDark : palette.white,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.signatureBgDark : palette.signatureBgLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={20} color={palette.signature500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: isDark ? palette.neutral500 : palette.neutral600,
                    letterSpacing: 0.5,
                  }}
                >
                  RIDING WITH
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: isDark ? palette.white : palette.neutral950,
                    marginTop: 2,
                  }}
                >
                  Quick Ride
                </Text>
              </View>
            </View>
          ) : hasSingleBike ? (
            /* Single bike — compact display, no picker needed */
            <View
              style={{
                backgroundColor: isDark ? palette.cardDark : palette.white,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.accentTint : palette.accentBgLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bike size={20} color={palette.accent500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: isDark ? palette.neutral500 : palette.neutral600,
                    letterSpacing: 0.5,
                  }}
                >
                  RIDING WITH
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: isDark ? palette.white : palette.neutral950,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {selectedBikeLabel}
                </Text>
              </View>
            </View>
          ) : (
            /* Multi-bike — compact selected bike with expandable picker */
            <View>
              <Pressable
                onPress={() => setShowBikePicker((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`Selected bike: ${selectedBikeLabel}. Tap to change.`}
                style={{
                  backgroundColor: isDark ? palette.cardDark : palette.white,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderCurve: 'continuous',
                    backgroundColor: selectedBikeId
                      ? isDark
                        ? palette.accentTint
                        : palette.accentBgLight
                      : isDark
                        ? palette.signatureBgDark
                        : palette.signatureBgLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedBikeId ? (
                    <Bike size={20} color={palette.accent500} />
                  ) : (
                    <Zap size={20} color={palette.signature500} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: isDark ? palette.neutral500 : palette.neutral600,
                      letterSpacing: 0.5,
                    }}
                  >
                    RIDING WITH
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: isDark ? palette.white : palette.neutral950,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {selectedBikeLabel || 'Select motorcycle'}
                  </Text>
                </View>
                <ChevronDown
                  size={20}
                  color={isDark ? palette.neutral400 : palette.neutral500}
                  style={{
                    transform: [{ rotate: showBikePicker ? '180deg' : '0deg' }],
                  }}
                />
              </Pressable>

              {/* Expandable bike list */}
              {showBikePicker && (
                <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 8, gap: 6 }}>
                  {motorcycles.map((bike) => {
                    const isSelected = selectedBikeId === bike.id;
                    const label = bike.nickname || `${bike.year} ${bike.make} ${bike.model}`;
                    return (
                      <Pressable
                        key={bike.id}
                        onPress={() => {
                          if (process.env.EXPO_OS === 'ios') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          setSelectedBikeId(bike.id);
                          setShowBikePicker(false);
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={label}
                        accessibilityState={{ checked: isSelected }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          borderRadius: 14,
                          borderCurve: 'continuous',
                          backgroundColor: isSelected
                            ? palette.accentTintSubtle
                            : isDark
                              ? palette.cardDark
                              : palette.white,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? palette.accent500
                            : isDark
                              ? palette.surfaceElevated
                              : palette.neutral200,
                          gap: 12,
                        }}
                      >
                        {/* Radio indicator */}
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 2,
                            borderColor: isSelected ? palette.accent500 : palette.neutral600,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && (
                            <View
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: palette.accent500,
                              }}
                            />
                          )}
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 15,
                            fontWeight: '600',
                            color: isDark ? palette.white : palette.neutral950,
                          }}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        {bike.isPrimary && (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 8,
                              borderCurve: 'continuous',
                              backgroundColor: isDark ? palette.accentTint : palette.accentBgLight,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: palette.accent500,
                                letterSpacing: 0.5,
                              }}
                            >
                              PRIMARY
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}

                  {/* Quick ride — de-emphasized */}
                  <Pressable
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setSelectedBikeId(null);
                      setShowBikePicker(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel="Quick ride without a bike"
                    accessibilityState={{ checked: selectedBikeId === null }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor:
                        selectedBikeId === null
                          ? isDark
                            ? palette.signatureBgDark
                            : palette.signatureBgLight
                          : isDark
                            ? palette.cardDark
                            : palette.white,
                      borderWidth: 1,
                      borderColor:
                        selectedBikeId === null
                          ? palette.signature500
                          : isDark
                            ? palette.surfaceElevated
                            : palette.neutral200,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor:
                          selectedBikeId === null ? palette.signature500 : palette.neutral600,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedBikeId === null && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: palette.signature500,
                          }}
                        />
                      )}
                    </View>
                    <Zap
                      size={16}
                      color={selectedBikeId === null ? palette.signature500 : palette.neutral500}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: '600',
                        color: palette.neutral300,
                      }}
                    >
                      Quick Ride (no bike)
                    </Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Spacer to push button to bottom */}
        <View style={{ flex: 1, minHeight: 32 }} />

        {/* Start button — gradient CTA */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)}>
          <Pressable
            onPress={handleStartRide}
            disabled={isStarting || hasUnfinished}
            accessibilityRole="button"
            accessibilityLabel="Start ride"
            accessibilityState={{ disabled: isStarting || hasUnfinished }}
            style={({ pressed }) => ({
              borderRadius: 20,
              borderCurve: 'continuous',
              overflow: 'hidden',
              opacity: isStarting || hasUnfinished ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <LinearGradient
              colors={[palette.accent400, palette.accent500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                paddingVertical: 18,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {isStarting ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: palette.white }}>
                    Start Ride
                  </Text>
                  <ChevronRight size={20} color={palette.white} />
                </>
              )}
            </LinearGradient>
          </Pressable>

          {hasUnfinished && (
            <Animated.Text
              entering={FadeIn.delay(300).duration(200)}
              style={{
                fontSize: 13,
                color: palette.warning500,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              Resolve the unfinished ride above to start a new one
            </Animated.Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
