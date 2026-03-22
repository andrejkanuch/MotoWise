import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, StartRideDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertTriangle, Bike, ChevronRight, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';
import { startGPSListener } from '../../utils/ride-location';
import { checkAndRequestPermissions } from '../../utils/ride-permissions';
import { rideMMKV } from '../../utils/ride-storage';
import { enqueue } from '../../utils/ride-sync-queue';

export default function StartRideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const startRide = useRideStore((s) => s.startRide);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasUnfinished, setHasUnfinished] = useState(false);

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
      enqueue('endRide', {
        variables: {
          input: {
            rideId,
            endedAt: new Date().toISOString(),
          },
        },
      });
    }
    // Clear MMKV state
    rideMMKV.setCurrentId('');
    setHasUnfinished(false);
  }, []);

  const handleStartRide = useCallback(async () => {
    setIsStarting(true);
    try {
      // 1. Request permissions
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

      // 2. Generate client UUID
      const rideId = Crypto.randomUUID();
      const startedAt = new Date().toISOString();

      // 3. Save to MMKV
      rideMMKV.setCurrentId(rideId);
      rideMMKV.setStartedAt(Date.now());

      // 4. Update Zustand store
      startRide();

      // 5. Enqueue mutation
      enqueue('startRide', {
        mutationDocument: StartRideDocument,
        variables: {
          input: {
            rideId,
            motorcycleId: selectedBikeId,
            startedAt,
          },
        },
      });

      // 6. Start GPS
      await startGPSListener(() => {});

      // 7. Navigate to HUD
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
    <View style={{ flex: 1, backgroundColor: palette.surfaceDark }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={{ alignItems: 'center', marginBottom: 28 }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(45,158,120,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Bike size={28} color={palette.accent500} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '800',
              color: palette.white,
              letterSpacing: -0.5,
            }}
          >
            Start a Ride
          </Text>
        </Animated.View>

        {/* Unfinished ride banner */}
        {hasUnfinished && (
          <Animated.View
            entering={FadeInUp.delay(50).duration(280)}
            style={{
              backgroundColor: palette.warningBgDark,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              gap: 12,
              marginBottom: 20,
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
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.accent500,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.white }}>
                  Resume
                </Text>
              </Pressable>
              <Pressable
                onPress={handleEndUnfinished}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  borderColor: palette.neutral600,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.neutral300 }}>
                  End Ride
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Bike picker */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: palette.neutral400,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Select Motorcycle
          </Text>

          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={palette.accent500} />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
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
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      borderWidth: isSelected ? 2 : 1.5,
                      borderColor: isSelected ? palette.accent500 : 'rgba(255,255,255,0.1)',
                      backgroundColor: isSelected ? 'rgba(45,158,120,0.08)' : 'transparent',
                      gap: 12,
                    }}
                  >
                    <Bike size={20} color={isSelected ? palette.accent500 : palette.neutral500} />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: '600',
                        color: palette.white,
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    {bike.isPrimary && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 8,
                          borderCurve: 'continuous',
                          backgroundColor: 'rgba(45,158,120,0.15)',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.accent500 }}>
                          PRIMARY
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Quick ride option */}
              <Pressable
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setSelectedBikeId(null);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  borderWidth: selectedBikeId === null ? 2 : 1.5,
                  borderColor:
                    selectedBikeId === null ? palette.signature500 : 'rgba(255,255,255,0.1)',
                  backgroundColor: selectedBikeId === null ? 'rgba(212,98,46,0.08)' : 'transparent',
                  gap: 12,
                }}
              >
                <Zap
                  size={20}
                  color={selectedBikeId === null ? palette.signature500 : palette.neutral500}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '600',
                    color: palette.white,
                  }}
                >
                  Quick Ride (no bike)
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Start button */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ marginTop: 28 }}>
          <Pressable
            onPress={handleStartRide}
            disabled={isStarting || hasUnfinished}
            style={({ pressed }) => ({
              backgroundColor: palette.accent500,
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: isStarting || hasUnfinished ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <>
                <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
                  Start Ride
                </Text>
                <ChevronRight size={18} color={palette.white} />
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
