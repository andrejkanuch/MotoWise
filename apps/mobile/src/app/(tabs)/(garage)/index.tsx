import { palette } from '@motolearn/design-system';
import { MyMotorcyclesDocument } from '@motolearn/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, Plus, Star, Wrench } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LottieMotorcycle } from '../../../components/LottieMotorcycle';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const BIKE_GRADIENT_PAIRS = [
  ['#1a1a2e', '#16213e'] as const,
  ['#1b2838', '#1e3a5f'] as const,
  ['#2d1b2e', '#4a1942'] as const,
  ['#1b2e1b', '#1e4d2b'] as const,
  ['#2e2a1b', '#4d3319'] as const,
] as const;

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function BikeCard({
  bike,
  index,
  onPress,
  isDark,
}: {
  bike: {
    id: string;
    make: string;
    model: string;
    year: number;
    nickname?: string | null;
    isPrimary: boolean;
    createdAt: string;
  };
  index: number;
  onPress: () => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const gradientPair = BIKE_GRADIENT_PAIRS[index % BIKE_GRADIENT_PAIRS.length];

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <Pressable
        onPress={() => {
          haptic();
          onPress();
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 20,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <LinearGradient
            colors={isDark ? gradientPair : [palette.primary50, palette.primary100]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: 120,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <LottieMotorcycle animation="cardPlaceholder" size={120} loop speed={0.5} />

            {bike.isPrimary && (
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(245,158,11,0.9)',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 20,
                  borderCurve: 'continuous',
                }}
              >
                <Star size={12} color={palette.white} strokeWidth={2.5} fill={palette.white} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: palette.white }}>
                  Primary
                </Text>
              </View>
            )}
          </LinearGradient>

          <View style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                {bike.nickname && (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: palette.primary500,
                      marginBottom: 2,
                    }}
                  >
                    &ldquo;{bike.nickname}&rdquo;
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: 19,
                    fontWeight: '700',
                    color: isDark ? palette.neutral50 : palette.neutral950,
                  }}
                  numberOfLines={1}
                >
                  {bike.make} {bike.model}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronRight size={16} color={palette.neutral400} strokeWidth={2} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Calendar size={13} color={palette.neutral400} strokeWidth={2} />
                <Text style={{ fontSize: 13, color: palette.neutral500, fontWeight: '500' }}>
                  {bike.year}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Wrench size={13} color={palette.neutral400} strokeWidth={2} />
                <Text style={{ fontSize: 13, color: palette.neutral500, fontWeight: '500' }}>
                  {t('garage.serviceRecords', { defaultValue: 'Service' })}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyGarage({ onAdd, isDark }: { onAdd: () => void; isDark: boolean }) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 80,
      }}
    >
      <Animated.View entering={FadeInUp.duration(500)} style={{ alignItems: 'center' }}>
        <LottieMotorcycle
          animation="emptyGarage"
          size={160}
          loop={false}
          style={{ marginBottom: 8 }}
        />

        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: isDark ? palette.neutral50 : palette.neutral950,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {t('garage.emptyTitle', { defaultValue: 'Your garage is empty' })}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: palette.neutral500,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 32,
          }}
        >
          {t('garage.emptySubtitle', {
            defaultValue:
              'Add your first motorcycle to get personalized diagnostics and maintenance tips',
          })}
        </Text>

        <Pressable
          onPress={() => {
            haptic();
            onAdd();
          }}
          style={{ borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[palette.primary600, palette.primary500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 28,
              paddingVertical: 16,
              gap: 10,
            }}
          >
            <Plus size={20} color={palette.white} strokeWidth={2.5} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
              {t('garage.addFirstBike')}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function GarageScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const motorcycles = data?.myMotorcycles ?? [];

  if (isLoading && !data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            color: isDark ? palette.neutral50 : palette.neutral950,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          {t('common.error')}
        </Text>
        <Pressable
          onPress={onRefresh}
          style={{
            backgroundColor: palette.primary500,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: palette.white, fontSize: 15, fontWeight: '600' }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (motorcycles.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <EmptyGarage onAdd={() => router.push('/(garage)/add-bike')} isDark={isDark} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={palette.primary500}
          />
        }
      >
        <Animated.View entering={FadeInUp.duration(300)}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: palette.neutral500,
              marginBottom: 4,
            }}
          >
            {motorcycles.length} {motorcycles.length === 1 ? 'motorcycle' : 'motorcycles'}
          </Text>
        </Animated.View>

        {motorcycles.map((bike, index) => (
          <BikeCard
            key={bike.id}
            bike={bike}
            index={index}
            isDark={isDark}
            onPress={() => router.push(`/(garage)/bike/${bike.id}`)}
          />
        ))}
      </ScrollView>

      {/* FAB */}
      <View style={{ position: 'absolute', bottom: 100, right: 20 }}>
        <Pressable
          onPress={() => {
            haptic();
            router.push('/(garage)/add-bike');
          }}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: 28,
            borderCurve: 'continuous',
            overflow: 'hidden',
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <LinearGradient
            colors={[palette.primary600, palette.primary500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(51,102,230,0.35)',
            }}
          >
            <Plus size={24} color={palette.white} strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
