import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Search, Wrench, ChevronRight, Star } from 'lucide-react-native';
import { ArticleCarousel } from '../../../components/home/article-carousel';
import { EmptyState } from '../../../components/home/empty-state';
import { ExpenseSummaryWidget } from '../../../components/home/expense-summary-widget';
import { MaintenanceSummary } from '../../../components/home/maintenance-summary';
import { MileageOverview } from '../../../components/home/mileage-overview';
import { NextServiceDue } from '../../../components/home/next-service-due';
import { PriorityActionCard } from '../../../components/home/priority-action-card';
import { RecentRidesWidget } from '../../../components/home/recent-rides-widget';
import { SetupCtaBanner } from '../../../components/home/setup-cta-banner';
import { useHomeData } from '../../../components/home/use-home-data';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { SkeletonProvider } from '../../../components/skeleton/skeleton-provider';
import { useEditorialTheme, tint } from '../../../theme/editorial';
import {
  ECard,
  EDisplay,
  EDisplayAccent,
  ESectionMasthead,
} from '../../../components/ui/editorial';

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
    subtitleText,
    avatarInitial,
    hasMotorcycles,
    showSetupCta,
    fleetHealth,
    singleBikeName,
    priorityAction,
    motorcycles,
    nextService,
    sortedTasks,
    bikeNames,
    articles,
    recentRides,
    ridesTotalDistance,
    router,
  } = useHomeData();

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const primaryBike = motorcycles?.[0];

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
        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink, marginBottom: 8 }}>
          {t('common.error')}
        </Text>
        <Text style={{ fontSize: 14, color: theme.ink3, marginBottom: 16, textAlign: 'center' }}>
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
        {/* ── Top bar — avatar, greeting, icons ── */}
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
              <Text style={{ fontSize: 11, color: theme.ink3, letterSpacing: 0.2 }}>
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

        {/* ── Editorial masthead ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 22 }}>
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

        {/* ── Empty state ── */}
        {!hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <EmptyState
              isDark={isDark}
              onAddBike={() => router.push('/(tabs)/(garage)/add-bike')}
              onExplore={() => router.push('/(tabs)/(learn)')}
            />
          </View>
        )}

        {/* ── Hero bike card ── */}
        {primaryBike && (
          <Animated.View entering={FadeIn.delay(100).duration(400)}>
            <Pressable
              onPress={() =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: { id: primaryBike.id, _ts: Date.now().toString() },
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
                {primaryBike.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: primaryBike.primaryPhotoUrl }}
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
                {/* Gradient overlay */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'transparent',
                    // Multi-stop gradient simulated with layered views
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '40%',
                      backgroundColor: `${theme.bg}50`,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      backgroundColor: `${theme.bg}F0`,
                    }}
                  />
                </View>

                {/* Top badge */}
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
                    backgroundColor: 'rgba(0,0,0,0.35)',
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

                {/* Bottom copy */}
                <View style={{ position: 'absolute', bottom: 18, left: 20, right: 20 }}>
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
                      lineHeight: 38,
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
                      lineHeight: 38,
                      marginBottom: 14,
                    }}
                  >
                    {primaryBike.model}
                  </Text>
                  {/* Metrics strip */}
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
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          marginBottom: 3,
                        }}
                      >
                        Odo
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 22,
                          color: '#fff',
                          letterSpacing: -0.4,
                        }}
                      >
                        {primaryBike.currentMileage != null
                          ? `${(primaryBike.currentMileage / 1000).toFixed(1)}k`
                          : '—'}
                        <Text style={{ fontSize: 10, opacity: 0.65 }}> km</Text>
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 1,
                        alignSelf: 'stretch',
                        backgroundColor: 'rgba(255,255,255,0.18)',
                        marginHorizontal: 8,
                      }}
                    />
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
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 22,
                          color: '#fff',
                          letterSpacing: -0.4,
                        }}
                      >
                        {nextService?.dueDate ? '—' : '—'}
                        <Text style={{ fontSize: 10, opacity: 0.65 }}> days</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Priority alert banner ── */}
        {priorityAction && hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
            <Pressable
              onPress={priorityAction.onPress}
              style={{
                padding: 12,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: tint(theme.danger, 0.1),
                borderWidth: 1,
                borderColor: tint(theme.danger, 0.34),
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
                  backgroundColor: tint(theme.danger, 0.22),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wrench size={15} color={theme.danger} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: theme.ink,
                    letterSpacing: -0.05,
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

        {/* ── Quick actions ── */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 16, marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                {
                  icon: Star,
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

        {/* ── Setup CTA ── */}
        {hasMotorcycles && showSetupCta && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <SetupCtaBanner isDark={isDark} onPress={() => router.push('/(onboarding)')} />
          </View>
        )}

        {/* ── Mileage overview ── */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <MileageOverview
              motorcycles={motorcycles}
              isDark={isDark}
              onBikePress={(bikeId) =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: { id: bikeId, _ts: Date.now().toString() },
                })
              }
            />
          </View>
        )}

        {/* ── Recent rides ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <RecentRidesWidget
            rides={recentRides}
            totalDistanceM={ridesTotalDistance}
            totalRides={recentRides.length}
            isDark={isDark}
          />
        </View>

        {/* ── Expenses summary ── */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <ExpenseSummaryWidget
              isDark={isDark}
              motorcycles={motorcycles}
              onViewDetails={(motorcycleId) =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/expense-dashboard',
                  params: { motorcycleId },
                })
              }
            />
          </View>
        )}

        {/* ── Next service ── */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <NextServiceDue
              task={
                nextService
                  ? {
                      id: nextService.id,
                      motorcycleId: nextService.motorcycleId,
                      title: nextService.title,
                      dueDate: nextService.dueDate as string,
                    }
                  : null
              }
              bikeName={nextService ? (bikeNames[nextService.motorcycleId] ?? '') : ''}
              isDark={isDark}
              onPress={() => {
                if (nextService) {
                  router.navigate({
                    pathname: '/(tabs)/(garage)/bike/[id]',
                    params: {
                      id: nextService.motorcycleId,
                      highlightTask: nextService.id,
                      _ts: Date.now().toString(),
                    },
                  });
                }
              }}
            />
          </View>
        )}

        {/* ── Maintenance summary ── */}
        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <MaintenanceSummary
              tasks={sortedTasks}
              bikeNames={bikeNames}
              isDark={isDark}
              onViewAll={() => router.navigate('/(tabs)/(garage)')}
              onTaskPress={(motorcycleId, taskId) =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: {
                    id: motorcycleId,
                    highlightTask: taskId,
                    _ts: Date.now().toString(),
                  },
                })
              }
            />
          </View>
        )}

        {/* ── Articles ── */}
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
