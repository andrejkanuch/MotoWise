import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  ChevronRight,
  DollarSign,
  MapPin,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCarousel } from '../../../components/home/article-carousel';
import { EmptyState } from '../../../components/home/empty-state';
import { useHomeData } from '../../../components/home/use-home-data';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { SkeletonProvider } from '../../../components/skeleton/skeleton-provider';
import { ECard, ESectionMasthead } from '../../../components/ui/editorial';
import { useEditorialTheme, tint } from '../../../theme/editorial';

// ── Weekly bar chart (Mon–Sun) ──
function WeekBars({ values }: { values: number[] }) {
  const { t: theme } = useEditorialTheme();
  const max = Math.max(...values, 1);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {values.map((v, i) => {
        const h = v === 0 ? 3 : Math.max(10, (v / max) * 70);
        const active = v > 0;
        return (
          <View
            key={`${days[i]}-${i}`}
            style={{ flex: 1, alignItems: 'center', gap: 5 }}
          >
            <View
              style={{
                width: '100%',
                height: h,
                borderRadius: 4,
                borderCurve: 'continuous',
                backgroundColor: active ? theme.warm : theme.surface2,
                opacity: active ? 1 : 0.7,
              }}
            />
            <Text style={{ fontSize: 10, color: theme.ink3, fontWeight: '500' }}>
              {days[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { t: theme, isDark } = useEditorialTheme();

  const {
    isLoading,
    hasCriticalError,
    errorMessage,
    isRefreshing,
    onRefresh,
    greetingText,
    avatarInitial,
    hasMotorcycles,
    priorityAction,
    motorcycles,
    primaryBike,
    nextService,
    sortedTasks,
    bikeNames,
    articles,
    recentRides,
    ridesTotalDistance,
    router,
  } = useHomeData();

  const hour = new Date().getHours();
  const greet =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Compute next service days
  const nextServiceDays = nextService?.dueDate
    ? Math.max(
        0,
        Math.floor(
          (new Date(nextService.dueDate).getTime() - Date.now()) / 86400000,
        ),
      )
    : null;

  // This month stats from rides
  const thisMonthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRides = recentRides.filter(
      (r) => new Date(r.startedAt) >= monthStart,
    );
    const distanceKm = Math.round(
      monthRides.reduce((sum, r) => sum + (r.distanceM ?? 0), 0) / 1000,
    );
    return { distanceKm, rideCount: monthRides.length };
  }, [recentRides]);

  // Weekly km data (last 7 days, Mon-Sun)
  const weeklyKm = useMemo(() => {
    const now = new Date();
    const today = now.getDay(); // 0=Sun
    const mondayOffset = today === 0 ? 6 : today - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const bars = [0, 0, 0, 0, 0, 0, 0];
    for (const ride of recentRides) {
      const rideDate = new Date(ride.startedAt);
      if (rideDate >= monday) {
        const dayIdx = rideDate.getDay() === 0 ? 6 : rideDate.getDay() - 1;
        bars[dayIdx] += Math.round((ride.distanceM ?? 0) / 1000);
      }
    }
    return bars;
  }, [recentRides]);

  // ── Loading ──
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          paddingTop: insets.top,
          paddingHorizontal: 20,
        }}
      >
        <SkeletonProvider>
          <Animated.View
            entering={FadeInUp.delay(0).duration(300)}
            style={{ marginTop: 16 }}
          >
            <Skeleton width="60%" height={24} borderRadius={8} />
          </Animated.View>
          <Animated.View
            entering={FadeInUp.delay(50).duration(300)}
            style={{ marginTop: 8 }}
          >
            <Skeleton width="40%" height={16} borderRadius={6} />
          </Animated.View>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              entering={FadeInUp.delay(100 + i * 50).duration(300)}
              style={{ marginTop: 16 }}
            >
              <Skeleton width="100%" height={120} borderRadius={16} />
            </Animated.View>
          ))}
        </SkeletonProvider>
      </View>
    );
  }

  // ── Error ──
  if (hasCriticalError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: theme.ink,
            marginBottom: 8,
          }}
        >
          {t('common.error')}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.ink3,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          {errorMessage}
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
          <Text style={{ color: '#1a1208', fontWeight: '600' }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.warm}
          />
        }
      >
        {/* ═══ 1. Top bar ═══ */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={() => router.push('/(tabs)/(profile)')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.surface3,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.line,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}
              >
                {avatarInitial}
              </Text>
            </View>
            <View>
              <Text
                style={{ fontSize: 11, color: theme.ink3, letterSpacing: 0.2 }}
              >
                {greet}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: theme.ink,
                  letterSpacing: -0.1,
                }}
              >
                {greetingText}
              </Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Search size={17} color={theme.ink2} />
            </View>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={17} color={theme.ink2} />
              <View
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 9,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: theme.warm,
                  borderWidth: 1.5,
                  borderColor: theme.surface,
                }}
              />
            </View>
          </View>
        </View>

        {/* ═══ 2. Editorial masthead ═══ */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 14,
            paddingBottom: 22,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <View
              style={{ width: 18, height: 1, backgroundColor: theme.ink3 }}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: theme.ink3,
              }}
            >
              {dateLabel}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 40,
              lineHeight: 40,
              color: theme.ink,
              letterSpacing: -0.8,
            }}
          >
            Today in your{' '}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: theme.warm2,
              }}
            >
              garage.
            </Text>
          </Text>
        </View>

        {/* ═══ Empty state ═══ */}
        {!hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <EmptyState
              isDark={isDark}
              onAddBike={() => router.push('/(tabs)/(garage)/add-bike')}
              onExplore={() => router.push('/(tabs)/(learn)')}
            />
          </View>
        )}

        {/* ═══ 3. Hero bike card ═══ */}
        {primaryBike && (
          <Animated.View entering={FadeIn.delay(100).duration(400)}>
            <Pressable
              onPress={() =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: {
                    id: primaryBike.id,
                    _ts: Date.now().toString(),
                  },
                })
              }
              style={{ marginHorizontal: 16, marginBottom: 18 }}
            >
              <View
                style={{
                  borderRadius: 24,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  aspectRatio: 4 / 5,
                }}
              >
                {/* Photo or placeholder */}
                {primaryBike.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: primaryBike.primaryPhotoUrl }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                    }}
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

                {/* Smooth gradient overlay */}
                <LinearGradient
                  colors={[
                    `${theme.bg}50`,
                    'transparent',
                    'transparent',
                    `${theme.bg}F5`,
                  ]}
                  locations={[0, 0.3, 0.55, 1]}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />

                {/* Top chrome — Ready to ride + more */}
                <View
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 14,
                    right: 14,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingVertical: 5,
                      paddingLeft: 8,
                      paddingRight: 11,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0,0,0,0.45)',
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: theme.success,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        color: '#fff',
                      }}
                    >
                      Ready to ride
                    </Text>
                  </View>
                </View>

                {/* Bottom editorial copy */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 18,
                    left: 20,
                    right: 20,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: '#fff',
                      opacity: 0.75,
                      fontWeight: '600',
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Vol. 01 — Your ride
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'InstrumentSerif-Regular',
                      fontSize: 38,
                      color: '#fff',
                      letterSpacing: -0.7,
                      lineHeight: 37,
                      marginBottom: 2,
                    }}
                  >
                    {primaryBike.make}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'InstrumentSerif-Italic',
                      fontSize: 38,
                      color: theme.warm2,
                      letterSpacing: -0.7,
                      lineHeight: 37,
                      marginBottom: 14,
                    }}
                  >
                    {primaryBike.model}
                  </Text>

                  {/* 3-column metrics strip */}
                  <View
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 10,
                      paddingHorizontal: 2,
                      borderTopWidth: 1,
                      borderTopColor: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    {/* Odo */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.7)',
                          fontWeight: '700',
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          marginBottom: 3,
                        }}
                      >
                        Odo
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 22,
                            color: '#fff',
                            letterSpacing: -0.4,
                            lineHeight: 22,
                          }}
                        >
                          {primaryBike.currentMileage != null
                            ? `${(primaryBike.currentMileage / 1000).toFixed(1)}k`
                            : '—'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: '500',
                          }}
                        >
                          km
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        width: 1,
                        alignSelf: 'stretch',
                        backgroundColor: 'rgba(255,255,255,0.18)',
                        marginHorizontal: 8,
                      }}
                    />

                    {/* Next service */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.7)',
                          fontWeight: '700',
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          marginBottom: 3,
                        }}
                      >
                        Next service
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 22,
                            color: '#fff',
                            letterSpacing: -0.4,
                            lineHeight: 22,
                          }}
                        >
                          {nextServiceDays != null
                            ? String(nextServiceDays)
                            : '—'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: '500',
                          }}
                        >
                          days
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        width: 1,
                        alignSelf: 'stretch',
                        backgroundColor: 'rgba(255,255,255,0.18)',
                        marginHorizontal: 8,
                      }}
                    />

                    {/* This month */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.7)',
                          fontWeight: '700',
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          marginBottom: 3,
                        }}
                      >
                        This mo
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 22,
                            color: '#fff',
                            letterSpacing: -0.4,
                            lineHeight: 22,
                          }}
                        >
                          {thisMonthStats.distanceKm}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: '500',
                          }}
                        >
                          km
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ═══ 4. Attention banner (compact) ═══ */}
        {priorityAction && priorityAction.type !== 'allClear' && hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
            <Pressable
              onPress={priorityAction.onPress}
              style={{
                padding: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: tint(priorityAction.accentColor, 0.1),
                borderWidth: 1,
                borderColor: tint(priorityAction.accentColor, 0.34),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: tint(priorityAction.accentColor, 0.22),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wrench size={15} color={priorityAction.accentColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: theme.ink,
                    letterSpacing: -0.05,
                  }}
                  numberOfLines={1}
                >
                  {priorityAction.title}
                </Text>
                <Text
                  style={{ fontSize: 11, color: theme.ink3, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {priorityAction.subtitle}
                </Text>
              </View>
              <ChevronRight size={15} color={theme.ink3} />
            </Pressable>
          </View>
        )}

        {/* All-clear banner */}
        {priorityAction && priorityAction.type === 'allClear' && hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
            <Pressable
              onPress={priorityAction.onPress}
              style={{
                padding: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: tint(theme.success, 0.1),
                borderWidth: 1,
                borderColor: tint(theme.success, 0.34),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: tint(theme.success, 0.22),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <priorityAction.icon size={15} color={theme.success} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: theme.ink,
                  }}
                >
                  {priorityAction.title}
                </Text>
                <Text style={{ fontSize: 11, color: theme.ink3, marginTop: 1 }}>
                  {priorityAction.subtitle}
                </Text>
              </View>
              <ChevronRight size={15} color={theme.ink3} />
            </Pressable>
          </View>
        )}

        {/* ═══ 5. Quick actions — 4-column grid ═══ */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                {
                  icon: Sparkles,
                  label: 'Diagnose',
                  color: theme.warm,
                  onPress: () => router.push('/(tabs)/(diagnose)'),
                },
                {
                  icon: Wrench,
                  label: 'Add task',
                  color: theme.info,
                  onPress: () => router.push('/(tabs)/(garage)'),
                },
                {
                  icon: DollarSign,
                  label: 'Expense',
                  color: theme.success,
                  onPress: () => {
                    if (primaryBike) {
                      router.push({
                        pathname: '/(tabs)/(garage)/add-expense',
                        params: { motorcycleId: primaryBike.id },
                      });
                    }
                  },
                },
                {
                  icon: MapPin,
                  label: 'Plan',
                  color: theme.purple,
                  onPress: () => router.push('/(tabs)/(discover)'),
                },
              ].map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    paddingHorizontal: 8,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.line,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      backgroundColor: tint(a.color, 0.18),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <a.icon size={17} color={a.color} />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.ink2,
                      fontWeight: '500',
                    }}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ═══ 6. This month — editorial spread ═══ */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <ESectionMasthead
              label="This month"
              kicker={new Date().toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            />
            <ECard pad={18} style={{ marginBottom: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.ink3,
                      marginBottom: 2,
                      letterSpacing: 0.2,
                    }}
                  >
                    Distance
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'InstrumentSerif-Regular',
                        fontSize: 42,
                        color: theme.ink,
                        letterSpacing: -0.6,
                        lineHeight: 40,
                      }}
                    >
                      {thisMonthStats.distanceKm}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.ink3,
                        fontWeight: '500',
                      }}
                    >
                      / 600 km
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.ink3,
                      marginBottom: 2,
                    }}
                  >
                    Rides
                  </Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '600',
                      color: theme.ink,
                      fontFamily: 'InstrumentSerif-Regular',
                    }}
                  >
                    {thisMonthStats.rideCount}
                  </Text>
                </View>
              </View>
              {/* Distance progress */}
              <View style={{ marginTop: 14 }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: theme.surface2,
                    overflow: 'hidden',
                  }}
                >
                  <LinearGradient
                    colors={[theme.warm, theme.warm2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      width: `${Math.min(100, (thisMonthStats.distanceKm / 600) * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, color: theme.ink3 }}>0</Text>
                  <Text style={{ fontSize: 10, color: theme.ink3 }}>300</Text>
                  <Text style={{ fontSize: 10, color: theme.ink3 }}>
                    600 km goal
                  </Text>
                </View>
              </View>
            </ECard>

            {/* Weekly sparkline */}
            <ECard pad={16}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: theme.ink3,
                  }}
                >
                  Last 7 days
                </Text>
                <Text style={{ fontSize: 11, color: theme.ink3 }}>km / day</Text>
              </View>
              <WeekBars values={weeklyKm} />
            </ECard>
          </View>
        )}

        {/* ═══ 7. Upcoming tasks — numbered editorial ═══ */}
        {hasMotorcycles && sortedTasks.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <ESectionMasthead
              label="Upcoming"
              action="All tasks"
              onAction={() => router.navigate('/(tabs)/(garage)')}
            />
            <View style={{ gap: 8 }}>
              {sortedTasks.slice(0, 2).map((task, i) => {
                const accent =
                  task.priority === 'critical'
                    ? theme.danger
                    : task.priority === 'high'
                      ? theme.warm
                      : theme.info;
                const relDays = task.relative.daysAway;
                const dueText = task.relative.isOverdue
                  ? `Overdue by ${Math.abs(relDays)} days`
                  : `Due in ${relDays} days`;
                return (
                  <ECard
                    key={task.id}
                    pad={14}
                    onPress={() =>
                      router.navigate({
                        pathname: '/(tabs)/(garage)/bike/[id]',
                        params: {
                          id: task.motorcycleId,
                          highlightTask: task.id,
                          _ts: Date.now().toString(),
                        },
                      })
                    }
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 28,
                          color: theme.ink3,
                          width: 28,
                          textAlign: 'center',
                          letterSpacing: -0.4,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <View
                        style={{
                          width: 1,
                          height: 36,
                          backgroundColor: theme.line,
                        }}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: theme.ink,
                            marginBottom: 3,
                            letterSpacing: -0.1,
                          }}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: theme.ink3 }}
                          numberOfLines={1}
                        >
                          {dueText}
                          {bikeNames[task.motorcycleId]
                            ? ` · ${bikeNames[task.motorcycleId]}`
                            : ''}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: accent,
                          flexShrink: 0,
                        }}
                      />
                    </View>
                  </ECard>
                );
              })}
            </View>
          </View>
        )}

        {/* ═══ 8. Your other rides — horizontal carousel ═══ */}
        {motorcycles.length > 1 && (
          <View style={{ paddingLeft: 16, marginBottom: 22 }}>
            <View style={{ paddingRight: 16 }}>
              <ESectionMasthead
                label="Your other rides"
                action="Garage"
                onAction={() => router.navigate('/(tabs)/(garage)')}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 16 }}
            >
              {motorcycles
                .filter(
                  (b: { id: string }) => b.id !== primaryBike?.id,
                )
                .map(
                  (b: {
                    id: string;
                    make: string;
                    model: string;
                    year: number;
                    currentMileage?: number | null;
                    primaryPhotoUrl?: string | null;
                  }) => (
                    <Pressable
                      key={b.id}
                      onPress={() =>
                        router.navigate({
                          pathname: '/(tabs)/(garage)/bike/[id]',
                          params: {
                            id: b.id,
                            _ts: Date.now().toString(),
                          },
                        })
                      }
                      style={{
                        width: 220,
                        borderRadius: 16,
                        borderCurve: 'continuous',
                        overflow: 'hidden',
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.line,
                      }}
                    >
                      <View style={{ height: 110 }}>
                        {b.primaryPhotoUrl ? (
                          <Image
                            source={{ uri: b.primaryPhotoUrl }}
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
                      </View>
                      <View style={{ padding: 10, paddingHorizontal: 12 }}>
                        <Text
                          style={{
                            fontSize: 10,
                            color: theme.ink3,
                            marginBottom: 2,
                            letterSpacing: 0.5,
                          }}
                        >
                          {b.year}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: theme.ink,
                            letterSpacing: -0.1,
                          }}
                          numberOfLines={1}
                        >
                          {b.make} {b.model}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: theme.ink3,
                            marginTop: 2,
                          }}
                        >
                          {(b.currentMileage ?? 0).toLocaleString()} km
                        </Text>
                      </View>
                    </Pressable>
                  ),
                )}
            </ScrollView>
          </View>
        )}

        {/* ═══ 9. Articles ═══ */}
        {articles.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <ArticleCarousel
              articles={articles}
              isDark={isDark}
              onViewAll={() => router.push('/(tabs)/(learn)')}
              onArticlePress={() => router.push('/(tabs)/(learn)' as never)}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
