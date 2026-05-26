import SegmentedControl from '@expo/ui/community/segmented-control';
import { palette } from '@motovault/design-system';
import * as Sentry from '@sentry/react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, DollarSign, MapPin, Sparkles, WifiOff, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BikeSwitcher } from '../../../components/home/bike-switcher';
import { EmptyState } from '../../../components/home/empty-state';
import { FocusHistory } from '../../../components/home/focus-history';
import { FocusStats } from '../../../components/home/focus-stats';
import { OnboardingChecklist } from '../../../components/home/onboarding-checklist';
import { useHomeData } from '../../../components/home/use-home-data';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { SkeletonProvider } from '../../../components/skeleton/skeleton-provider';
import { ECard, ESectionMasthead } from '../../../components/ui/editorial';
import { tint, useEditorialTheme } from '../../../theme/editorial';

type FocusTab = 'stats' | 'trip' | 'history';
const FOCUS_TABS: FocusTab[] = ['stats', 'trip', 'history'];

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { t: theme, isDark } = useEditorialTheme();

  const {
    isLoading,
    hasCriticalError,
    isOffline,
    isOfflineEmpty,
    dataUpdatedAt,
    errorMessage,
    isRefreshing,
    onRefresh,
    greetingText,
    avatarInitial,
    hasMotorcycles,
    priorityAction,
    motorcycles,
    nextService,
    sortedTasks,
    bikeNames,
    recentRides,
    bikeHealthScores,
    upcomingTrips,
    router,
  } = useHomeData();

  const [selectedBikeIdx, setSelectedBikeIdx] = useState(0);
  const [focusTab, setFocusTab] = useState<FocusTab>('stats');

  const hour = new Date().getHours();
  const greet =
    hour < 12
      ? t('home.greetingMorningShort')
      : hour < 18
        ? t('home.greetingAfternoonShort')
        : t('home.greetingEveningShort');
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Find primary bike index on first render
  const primaryIdx = useMemo(() => {
    const idx = motorcycles.findIndex((b) => b.isPrimary);
    return idx >= 0 ? idx : 0;
  }, [motorcycles]);

  // Selected bike based on switcher (defaults to primary)
  const activeBikeIdx = motorcycles.length > 1 ? selectedBikeIdx : primaryIdx;
  const activeBike = motorcycles[activeBikeIdx] ?? motorcycles[0] ?? null;

  // Compute next service days for the active bike
  const nextServiceForBike = useMemo(() => {
    if (!activeBike) return null;
    const upcoming = sortedTasks.find(
      (task) => !task.relative.isOverdue && task.motorcycleId === activeBike.id,
    );
    return upcoming ?? nextService;
  }, [activeBike, sortedTasks, nextService]);

  const nextServiceDays = useMemo(() => {
    if (!nextServiceForBike?.dueDate) return null;
    return Math.max(
      0,
      Math.floor((new Date(nextServiceForBike.dueDate).getTime() - Date.now()) / 86400000),
    );
  }, [nextServiceForBike]);

  // Health score for active bike
  const healthScore = activeBike ? (bikeHealthScores[activeBike.id] ?? 100) : 100;

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
          <Animated.View entering={FadeInUp.delay(0).duration(300)} style={{ marginTop: 16 }}>
            <Skeleton width="60%" height={24} borderRadius={8} />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(50).duration(300)} style={{ marginTop: 8 }}>
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

  // ── Offline with no cached data ──
  if (isOfflineEmpty) {
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
        <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center' }}>
          <WifiOff size={40} color={theme.ink3} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.ink,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            {t('home.offlineTitle')}
          </Text>
          <Text style={{ fontSize: 14, color: theme.ink3, textAlign: 'center' }}>
            {t('home.offlineSubtitle')}
          </Text>
        </Animated.View>
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
          <Text style={{ color: '#1a1208', fontWeight: '600' }}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Sentry.TimeToInitialDisplay record />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.warm} />
        }
      >
        {/* Offline banner */}
        {isOffline && !isOfflineEmpty && dataUpdatedAt > 0 && (
          <Animated.View
            entering={FadeInUp.duration(200)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginHorizontal: 20,
              marginTop: 8,
              backgroundColor: palette.warningBgLight,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderCurve: 'continuous',
            }}
          >
            <WifiOff size={14} color={palette.warning500} />
            <Text style={{ fontSize: 13, color: palette.warning500, fontWeight: '500' }}>
              {t('home.offlineBanner')} · {new Date(dataUpdatedAt).toLocaleTimeString()}
            </Text>
          </Animated.View>
        )}

        {/* Onboarding checklist — appears after onboarding completion, above all other content */}
        <OnboardingChecklist />

        {/* 1. Top bar */}
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
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>
                {avatarInitial}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: theme.ink3, letterSpacing: 0.2 }}>{greet}</Text>
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
        </View>

        {/* 2. Editorial masthead */}
        <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <View style={{ width: 18, height: 1, backgroundColor: theme.ink3 }} />
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
              lineHeight: 48,
              color: theme.ink,
              letterSpacing: -0.8,
            }}
          >
            {t('home.mastheadTitle')}{' '}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: theme.warm2,
              }}
            >
              {t('home.mastheadGarage')}
            </Text>
          </Text>
        </View>

        {/* Empty state */}
        {!hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <EmptyState
              isDark={isDark}
              onAddBike={() => router.push('/(tabs)/(garage)/add-bike')}
              onExplore={() => router.push('/(tabs)/(learn)')}
            />
          </View>
        )}

        {/* 3. Bike switcher — horizontal pill row */}
        {hasMotorcycles && (
          <BikeSwitcher
            bikes={motorcycles}
            selectedIndex={activeBikeIdx}
            onSelect={setSelectedBikeIdx}
            onAddBike={() => router.push('/(tabs)/(garage)/add-bike')}
          />
        )}

        {/* 4. Hero bike card — bound to selected bike */}
        {activeBike && (
          <Animated.View entering={FadeIn.delay(100).duration(400)}>
            <Pressable
              onPress={() =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: {
                    id: activeBike.id,
                    _ts: Date.now().toString(),
                  },
                })
              }
              style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 18 }}
            >
              <View
                style={{
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  aspectRatio: 5 / 4,
                }}
              >
                {activeBike.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: activeBike.primaryPhotoUrl }}
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

                {/* Bottom gradient for text readability only */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  locations={[0.35, 1]}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
                      {t('home.readyToRideBadge')}
                    </Text>
                  </View>
                </View>

                {/* Bottom editorial copy */}
                <View style={{ position: 'absolute', bottom: 16, left: 18, right: 18 }}>
                  <Text
                    style={{
                      fontFamily: 'InstrumentSerif-Regular',
                      fontSize: 30,
                      color: '#fff',
                      letterSpacing: -0.7,
                      lineHeight: 30,
                      marginBottom: 2,
                    }}
                  >
                    {activeBike.make}{' '}
                    <Text
                      style={{
                        fontFamily: 'InstrumentSerif-Italic',
                        color: theme.warm2,
                      }}
                    >
                      {activeBike.model}
                    </Text>
                  </Text>

                  {/* 3-column metrics strip */}
                  <View
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 10,
                      paddingHorizontal: 2,
                      marginTop: 12,
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
                        {t('home.odo')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 22,
                            color: '#fff',
                            letterSpacing: -0.4,
                            lineHeight: 22,
                          }}
                        >
                          {activeBike.currentMileage != null
                            ? `${(activeBike.currentMileage / 1000).toFixed(1)}k`
                            : '—'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: '500',
                          }}
                        >
                          {activeBike.mileageUnit ?? 'km'}
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
                        {t('home.nextServiceLabel')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 22,
                            color: '#fff',
                            letterSpacing: -0.4,
                            lineHeight: 22,
                          }}
                        >
                          {nextServiceDays != null ? String(nextServiceDays) : '—'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: '500',
                          }}
                        >
                          {t('home.days')}
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

                    {/* Ready % */}
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
                        {t('home.readyLabel')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 22,
                            color: '#fff',
                            letterSpacing: -0.4,
                            lineHeight: 22,
                          }}
                        >
                          {healthScore}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: '500',
                          }}
                        >
                          %
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        <Sentry.TimeToFullDisplay record />

        {/* 5. Attention banner (compact) */}
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
                <Text style={{ fontSize: 11, color: theme.ink3, marginTop: 1 }} numberOfLines={1}>
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
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.ink }}>
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

        {/* 6. Quick actions — 4-column grid */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                {
                  icon: Sparkles,
                  label: t('home.actionDiagnose'),
                  color: theme.warm,
                  onPress: () => router.push('/(tabs)/(diagnose)'),
                },
                {
                  icon: Wrench,
                  label: t('home.actionAddTask'),
                  color: theme.info,
                  onPress: () => router.push('/(tabs)/(garage)'),
                },
                {
                  icon: DollarSign,
                  label: t('home.expenses'),
                  color: theme.success,
                  onPress: () => {
                    if (activeBike) {
                      router.push({
                        pathname: '/(tabs)/(garage)/add-expense',
                        params: { motorcycleId: activeBike.id },
                      });
                    }
                  },
                },
                {
                  icon: MapPin,
                  label: t('home.actionPlan'),
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
                  <Text style={{ fontSize: 11, color: theme.ink2, fontWeight: '500' }}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 7. Upcoming tasks — numbered editorial */}
        {hasMotorcycles && sortedTasks.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <ESectionMasthead
              label={t('home.upcoming')}
              action={t('home.allTasks')}
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
                  ? t('home.overdueByDays', { count: Math.abs(relDays) })
                  : t('home.dueInDays', { count: relDays });
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                      <View style={{ width: 1, height: 36, backgroundColor: theme.line }} />
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
                        <Text style={{ fontSize: 11, color: theme.ink3 }} numberOfLines={1}>
                          {dueText}
                          {bikeNames[task.motorcycleId] ? ` · ${bikeNames[task.motorcycleId]}` : ''}
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

        {/* 8. Focus picker — rotating lens: stats / trip / history */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <SegmentedControl
              values={[
                t('home.focusThisMonth'),
                t('home.focusUpcomingTrip'),
                t('home.focusRideHistory'),
              ]}
              selectedIndex={FOCUS_TABS.indexOf(focusTab)}
              onChange={(e) => {
                const idx = e.nativeEvent.selectedSegmentIndex;
                setFocusTab(FOCUS_TABS[idx]);
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            />
            <View style={{ marginTop: 12 }}>
              {focusTab === 'stats' && <FocusStats recentRides={recentRides} />}
              {focusTab === 'history' && <FocusHistory rides={recentRides} />}
              {focusTab === 'trip' &&
                (upcomingTrips.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {upcomingTrips.map((trip) => (
                      <Pressable
                        key={trip.id}
                        onPress={() =>
                          router.push({
                            pathname: '/(modals)/trip-detail',
                            params: { tripId: trip.id },
                          })
                        }
                        style={{
                          borderRadius: 16,
                          borderCurve: 'continuous',
                          overflow: 'hidden',
                          backgroundColor: theme.surface,
                          borderWidth: 1,
                          borderColor: theme.line,
                          padding: 16,
                          gap: 6,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: theme.ink,
                            letterSpacing: -0.3,
                          }}
                        >
                          {trip.title}
                        </Text>
                        {trip.startDate && (
                          <Text
                            style={{
                              fontFamily: 'GeistMono',
                              fontSize: 11,
                              color: theme.ink3,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                            }}
                          >
                            {new Date(trip.startDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {trip.endDate && trip.endDate !== trip.startDate
                              ? ` — ${new Date(trip.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                              : ''}
                          </Text>
                        )}
                        {trip.description && (
                          <Text
                            numberOfLines={2}
                            style={{ fontSize: 13, color: theme.ink2, lineHeight: 18 }}
                          >
                            {trip.description}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => router.push('/(tabs)/(discover)')}
                    style={{
                      borderRadius: 20,
                      borderCurve: 'continuous',
                      overflow: 'hidden',
                      backgroundColor: theme.surface,
                      borderWidth: 1,
                      borderColor: theme.line,
                      padding: 20,
                      alignItems: 'center',
                    }}
                  >
                    <MapPin size={28} color={theme.warm} style={{ marginBottom: 12 }} />
                    <Text
                      style={{
                        fontFamily: 'InstrumentSerif-Regular',
                        fontSize: 22,
                        color: theme.ink,
                        marginBottom: 6,
                      }}
                    >
                      {t('home.planNextTrip')}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.ink3,
                        textAlign: 'center',
                        marginBottom: 14,
                      }}
                    >
                      {t('home.planNextTripDesc')}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.warm, fontWeight: '600' }}>
                      {t('home.exploreRoutes')}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
