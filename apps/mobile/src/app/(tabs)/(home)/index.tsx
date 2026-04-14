import { palette } from '@motovault/design-system';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCarousel } from '../../../components/home/article-carousel';
import { EmptyState } from '../../../components/home/empty-state';
import { ExpenseSummaryWidget } from '../../../components/home/expense-summary-widget';
import { FleetHealthHero } from '../../../components/home/fleet-health-hero';
import { GreetingHeader } from '../../../components/home/greeting-header';
import { MaintenanceSummary } from '../../../components/home/maintenance-summary';
import { MileageOverview } from '../../../components/home/mileage-overview';
import { NextServiceDue } from '../../../components/home/next-service-due';
import { PriorityActionCard } from '../../../components/home/priority-action-card';
import { RecentRidesWidget } from '../../../components/home/recent-rides-widget';
import { SetupCtaBanner } from '../../../components/home/setup-cta-banner';
import { useHomeData } from '../../../components/home/use-home-data';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { SkeletonProvider } from '../../../components/skeleton/skeleton-provider';

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

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

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? palette.neutral950 : palette.neutral50,
          paddingTop: insets.top,
          paddingHorizontal: 20,
        }}
      >
        <SkeletonProvider>
          {/* Greeting bar */}
          <Animated.View entering={FadeInUp.delay(0).duration(300)} style={{ marginTop: 16 }}>
            <Skeleton width="60%" height={24} borderRadius={8} />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(50).duration(300)} style={{ marginTop: 8 }}>
            <Skeleton width="40%" height={16} borderRadius={6} />
          </Animated.View>
          {/* Card placeholders */}
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
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center px-6">
        <Text className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-2 text-center">
          {t('common.error')}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 text-center">
          {errorMessage}
        </Text>
        <Pressable
          onPress={onRefresh}
          className="bg-primary-950 dark:bg-primary-500 rounded-xl px-6 py-3"
          style={{ borderCurve: 'continuous' }}
        >
          <Text className="text-white text-base font-semibold">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? palette.white : palette.primary500}
          />
        }
      >
        <GreetingHeader
          greetingText={greetingText}
          subtitleText={subtitleText}
          avatarInitial={avatarInitial}
          isDark={isDark}
          healthScore={fleetHealth?.score}
          onAvatarPress={() => router.push('/(tabs)/(profile)')}
        />

        {!hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <EmptyState
              isDark={isDark}
              onAddBike={() => router.push('/(tabs)/(garage)/add-bike')}
              onExplore={() => router.push('/(tabs)/(learn)')}
            />
          </View>
        )}

        {hasMotorcycles && fleetHealth && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <FleetHealthHero
              score={fleetHealth.score}
              hasData={fleetHealth.hasData}
              bikeCount={fleetHealth.bikeCount}
              singleBikeName={singleBikeName}
              needsAttention={fleetHealth.needsAttention}
              totalOverdue={fleetHealth.totalOverdue}
              upcomingTasks={fleetHealth.upcomingTasks}
              onPress={() => router.navigate('/(tabs)/(garage)')}
            />
          </View>
        )}

        {hasMotorcycles && showSetupCta && (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <SetupCtaBanner isDark={isDark} onPress={() => router.push('/(onboarding)')} />
          </View>
        )}

        {priorityAction && hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <PriorityActionCard action={priorityAction} isDark={isDark} />
          </View>
        )}

        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
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

        {/* Recent Rides */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <RecentRidesWidget
            rides={recentRides}
            totalDistanceM={ridesTotalDistance}
            totalRides={recentRides.length}
            isDark={isDark}
          />
        </View>

        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
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

        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
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

        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
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

        {articles.length > 0 && (
          <View style={{ marginTop: 28 }}>
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
