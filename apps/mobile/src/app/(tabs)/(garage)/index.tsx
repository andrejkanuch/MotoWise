import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Crown, MoreHorizontal, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LottieMotorcycle } from '../../../components/lottie-motorcycle';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { SkeletonProvider } from '../../../components/skeleton/skeleton-provider';
import { ECard, ESectionMasthead } from '../../../components/ui/editorial';
import { useProGate } from '../../../hooks/use-pro-gate';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { presentPaywall } from '../../../lib/subscription';
import { useEditorialTheme } from '../../../theme/editorial';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function GarageScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requireAccess, isPro } = useProGate();
  const [view, setView] = useState<'shelf' | 'grid'>('shelf');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const motorcycles = data?.myMotorcycles ?? [];
  const totalKm = motorcycles.reduce((sum, b) => sum + (b.currentMileage ?? 0), 0);

  const handleAddBike = () => {
    if (!requireAccess('MAX_BIKES', motorcycles.length)) return;
    haptic();
    router.push('/(tabs)/(garage)/add-bike');
  };

  if (isLoading && !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          padding: 20,
          paddingTop: insets.top + 20,
        }}
      >
        <SkeletonProvider>
          <Animated.View entering={FadeInUp.delay(0).duration(300)}>
            <Skeleton width="50%" height={16} borderRadius={6} />
          </Animated.View>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              entering={FadeInUp.delay(100 + i * 50).duration(300)}
              style={{ marginTop: 16 }}
            >
              <Skeleton width="100%" height={180} borderRadius={20} />
            </Animated.View>
          ))}
        </SkeletonProvider>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: theme.ink, marginBottom: 16, textAlign: 'center' }}>
          {t('common.error')}
        </Text>
        <Pressable
          onPress={onRefresh}
          style={{
            backgroundColor: theme.warm,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: '#1a1208', fontSize: 15, fontWeight: '600' }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (motorcycles.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 28,
                color: theme.ink,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {t('garage.emptyTitle')}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.ink3,
                textAlign: 'center',
                lineHeight: 20,
                marginBottom: 32,
              }}
            >
              {t('garage.emptySubtitle')}
            </Text>
            <Pressable
              onPress={handleAddBike}
              style={{
                backgroundColor: theme.warm,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingHorizontal: 28,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Plus size={20} color="#1a1208" strokeWidth={2.5} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1a1208' }}>
                {t('garage.addFirstBike')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.warm} />
        }
      >
        {/* ── Masthead ── */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <View style={{ width: 14, height: 1, backgroundColor: theme.ink3 }} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 2.2,
                    textTransform: 'uppercase',
                    color: theme.ink3,
                  }}
                >
                  {motorcycles.length}{' '}
                  {motorcycles.length === 1
                    ? t('garage.bike', { defaultValue: 'bike' })
                    : t('garage.bikes', { defaultValue: 'bikes' })}{' '}
                  · {totalKm.toLocaleString()} km
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Regular',
                  fontSize: 46,
                  color: theme.ink,
                  letterSpacing: -1.2,
                  lineHeight: 54,
                }}
              >
                {t('garage.mastheadThe')}{' '}
                <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: theme.warm2 }}>
                  {t('garage.mastheadGarage')}
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={
                !isPro && motorcycles.length >= 1
                  ? () =>
                      presentPaywall({
                        source: 'garage',
                        feature: 'unlimited_bikes',
                        surface: 'garage_add_bike_header',
                      })
                  : handleAddBike
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: theme.warm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!isPro && motorcycles.length >= 1 ? (
                <Crown size={19} color="#1a1208" />
              ) : (
                <Plus size={19} color="#1a1208" />
              )}
            </Pressable>
          </View>
        </View>

        {/* ── View toggle ── */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              padding: 3,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 10,
              borderCurve: 'continuous',
            }}
          >
            {[
              { key: 'shelf' as const, label: t('garage.viewShelf') },
              { key: 'grid' as const, label: t('garage.viewGrid') },
            ].map((v) => (
              <Pressable
                key={v.key}
                onPress={() => setView(v.key)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 7,
                  borderCurve: 'continuous',
                  backgroundColor: view === v.key ? theme.surface2 : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: view === v.key ? theme.ink : theme.ink3,
                  }}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: theme.ink3 }}>{t('garage.sortedByPrimary')}</Text>
        </View>

        {view === 'shelf' ? (
          <>
            {/* ── SHELF VIEW — horizontal carousel ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              decelerationRate="fast"
              snapToInterval={312}
            >
              {motorcycles.map((bike, i) => (
                <Animated.View key={bike.id} entering={FadeIn.delay(i * 100).duration(400)}>
                  <Pressable
                    onPress={() => {
                      haptic();
                      router.push(`/(tabs)/(garage)/bike/${bike.id}`);
                    }}
                    style={{
                      width: 300,
                      aspectRatio: 3 / 4,
                      borderRadius: 22,
                      borderCurve: 'continuous',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Background */}
                    {bike.primaryPhotoUrl ? (
                      <Image
                        source={{ uri: bike.primaryPhotoUrl }}
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          backgroundColor: theme.surface2,
                        }}
                      />
                    )}
                    {/* Bottom gradient for text readability */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.65)']}
                      locations={[0.3, 1]}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                      }}
                    />

                    {/* Primary badge */}
                    {bike.isPrimary && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingVertical: 5,
                          paddingHorizontal: 11,
                          borderRadius: 999,
                          backgroundColor: theme.warm,
                        }}
                      >
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: '#1a1208',
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            letterSpacing: 1.2,
                            textTransform: 'uppercase',
                            color: '#1a1208',
                          }}
                        >
                          {t('garage.primary')}
                        </Text>
                      </View>
                    )}

                    {/* More button */}
                    <View
                      style={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MoreHorizontal size={14} color="#fff" />
                    </View>

                    {/* Bottom info */}
                    <View style={{ position: 'absolute', bottom: 18, left: 18, right: 18 }}>
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#fff',
                          opacity: 0.8,
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                          fontWeight: '600',
                          marginBottom: 6,
                        }}
                      >
                        N°{String(i + 1).padStart(2, '0')} · {bike.year}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 28,
                          color: '#fff',
                          letterSpacing: -0.5,
                          lineHeight: 28,
                        }}
                      >
                        {bike.make}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Italic',
                          fontSize: 28,
                          color: theme.warm2,
                          letterSpacing: -0.5,
                          lineHeight: 28,
                          marginBottom: 12,
                        }}
                      >
                        {bike.model}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: 'rgba(255,255,255,0.18)',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 9,
                              color: 'rgba(255,255,255,0.7)',
                              fontWeight: '700',
                              letterSpacing: 1,
                              textTransform: 'uppercase',
                            }}
                          >
                            {t('garage.odo')}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'InstrumentSerif-Regular',
                              fontSize: 20,
                              color: '#fff',
                              letterSpacing: -0.4,
                            }}
                          >
                            {(bike.currentMileage ?? 0).toLocaleString()}{' '}
                            <Text style={{ fontSize: 11, opacity: 0.7 }}>km</Text>
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 9,
                              color: 'rgba(255,255,255,0.7)',
                              fontWeight: '700',
                              letterSpacing: 1,
                              textTransform: 'uppercase',
                            }}
                          >
                            {t('garage.since')}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'InstrumentSerif-Regular',
                              fontSize: 20,
                              color: '#fff',
                              letterSpacing: -0.4,
                            }}
                          >
                            {new Date(bike.createdAt).getFullYear()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}

              {/* Add bike card */}
              <Pressable
                onPress={handleAddBike}
                style={{
                  width: 300,
                  aspectRatio: 3 / 4,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  backgroundColor: `${theme.surface}66`,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: theme.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={22} color={theme.ink2} />
                </View>
                <Text style={{ fontSize: 13, color: theme.ink2, fontWeight: '600' }}>
                  {t('garage.addBike')}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.ink3,
                    textAlign: 'center',
                    paddingHorizontal: 30,
                  }}
                >
                  {t('garage.freePlanLimit')}
                </Text>
              </Pressable>
            </ScrollView>

            {/* ── Summary shelf ── */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <ESectionMasthead label={t('garage.byTheNumbers')} />
              <ECard pad={0}>
                {[
                  {
                    label: t('garage.totalKilometres'),
                    value: `${totalKm.toLocaleString()} km`,
                  },
                  {
                    label: t('garage.oldestBike'),
                    value:
                      motorcycles.length > 0
                        ? `${Math.min(...motorcycles.map((b) => b.year))}`
                        : '—',
                  },
                  { label: t('garage.openTasks'), value: '—' },
                ].map((r, i, a) => (
                  <View
                    key={r.label}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottomWidth: i < a.length - 1 ? 1 : 0,
                      borderBottomColor: theme.line2,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: theme.ink2 }}>{r.label}</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.ink,
                        fontWeight: '600',
                        letterSpacing: -0.05,
                      }}
                    >
                      {r.value}
                    </Text>
                  </View>
                ))}
              </ECard>
            </View>
          </>
        ) : (
          /* ── GRID VIEW — compact 2-up ── */
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {motorcycles.map((bike, i) => (
                <Animated.View
                  key={bike.id}
                  entering={FadeInUp.delay(i * 80).duration(400)}
                  style={{ width: '48%' }}
                >
                  <Pressable
                    onPress={() => {
                      haptic();
                      router.push(`/(tabs)/(garage)/bike/${bike.id}`);
                    }}
                    style={{
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: theme.line,
                      backgroundColor: theme.surface,
                    }}
                  >
                    <View style={{ height: 120, position: 'relative' }}>
                      {bike.primaryPhotoUrl ? (
                        <Image
                          source={{ uri: bike.primaryPhotoUrl }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: theme.surface2,
                          }}
                        />
                      )}
                      {bike.isPrimary && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            paddingVertical: 3,
                            paddingHorizontal: 8,
                            borderRadius: 999,
                            backgroundColor: theme.warm,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: '700',
                              letterSpacing: 1,
                              textTransform: 'uppercase',
                              color: '#1a1208',
                            }}
                          >
                            {t('garage.primary')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ padding: 12, paddingTop: 10 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          color: theme.ink3,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                          fontWeight: '600',
                          marginBottom: 3,
                        }}
                      >
                        {bike.year}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: theme.ink,
                          letterSpacing: -0.1,
                          lineHeight: 15,
                        }}
                      >
                        {bike.make}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '500',
                          color: theme.ink2,
                          fontFamily: 'InstrumentSerif-Italic',
                          marginTop: 1,
                        }}
                      >
                        {bike.model}
                      </Text>
                      <View
                        style={{
                          marginTop: 8,
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: theme.line2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: theme.ink3,
                          }}
                        >
                          {(bike.currentMileage ?? 0).toLocaleString()} km
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
              {/* Add bike grid cell */}
              <View style={{ width: '48%' }}>
                <Pressable
                  onPress={handleAddBike}
                  style={{
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: theme.line,
                    aspectRatio: 3 / 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Plus size={22} color={theme.ink2} />
                  <Text style={{ fontSize: 12, color: theme.ink2, fontWeight: '600' }}>
                    {t('garage.addBike')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
