import { palette } from '@motolearn/design-system';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCarousel } from '../../../components/home/article-carousel';
import { EmptyState } from '../../../components/home/empty-state';
import { FleetHealthHero } from '../../../components/home/fleet-health-hero';
import { GreetingHeader } from '../../../components/home/greeting-header';
import { MaintenanceSummary } from '../../../components/home/maintenance-summary';
import { PriorityActionCard } from '../../../components/home/priority-action-card';
import { QuickActionsGrid } from '../../../components/home/quick-actions-grid';
import { SetupCtaBanner } from '../../../components/home/setup-cta-banner';
import { useHomeData } from '../../../components/home/use-home-data';

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
    quickActions,
    sortedTasks,
    bikeNames,
    articles,
    router,
  } = useHomeData();

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color={palette.primary500} />
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
            tintColor={palette.primary500}
          />
        }
      >
        <GreetingHeader
          greetingText={greetingText}
          subtitleText={subtitleText}
          avatarInitial={avatarInitial}
          isDark={isDark}
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

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <QuickActionsGrid
            actions={quickActions}
            isDark={isDark}
            onActionPress={(route) => router.push(route as never)}
          />
        </View>

        {hasMotorcycles && (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <MaintenanceSummary
              tasks={sortedTasks}
              bikeNames={bikeNames}
              isDark={isDark}
              onViewAll={() => router.navigate('/(tabs)/(garage)')}
              onTaskPress={(motorcycleId) =>
                router.navigate({
                  pathname: '/(tabs)/(garage)/bike/[id]',
                  params: { id: motorcycleId },
                })
              }
            />
          </View>
        )}

        {articles.length > 0 && (
          <View style={{ marginTop: 24 }}>
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
