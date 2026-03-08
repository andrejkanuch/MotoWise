import { palette } from '@motolearn/design-system';
import { MeDocument, MyMotorcyclesDocument, SearchArticlesDocument } from '@motolearn/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  ChevronRight,
  CircuitBoard,
  Eye,
} from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

function getGreetingKey():
  | 'home.greetingMorning'
  | 'home.greetingAfternoon'
  | 'home.greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

const DIFFICULTY_COLORS = {
  beginner: palette.success500,
  intermediate: palette.warning500,
  advanced: palette.danger500,
} as const;

const QUICK_ACTIONS = [
  {
    key: 'diagnostic',
    icon: Camera,
    titleKey: 'home.takeDiagnostic',
    descKey: 'home.takeDiagnosticDesc',
    route: '/(tabs)/(diagnose)',
    color: palette.moduleEngine,
    bgLight: palette.dangerBgLight,
    bgDark: palette.dangerBgDark,
  },
  {
    key: 'learn',
    icon: BookOpen,
    titleKey: 'home.learnNew',
    descKey: 'home.learnNewDesc',
    route: '/(tabs)/(learn)',
    color: palette.moduleSuspension,
    bgLight: palette.primary100,
    bgDark: palette.primary900,
  },
  {
    key: 'quiz',
    icon: Brain,
    titleKey: 'home.testKnowledge',
    descKey: 'home.testKnowledgeDesc',
    route: '/(tabs)/(learn)',
    color: palette.moduleMaintenance,
    bgLight: palette.successBgLight,
    bgDark: palette.successBgDark,
  },
] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const articlesQuery = useQuery({
    queryKey: queryKeys.articles.list({ sortBy: 'popular' }),
    queryFn: () =>
      gqlFetcher(SearchArticlesDocument, {
        input: { first: 6 },
      }),
  });

  const user = meQuery.data?.me;
  const preferences = user?.preferences as
    | { onboardingCompleted?: boolean; experienceLevel?: string }
    | null
    | undefined;
  const motorcycles = bikesQuery.data?.myMotorcycles ?? [];
  const primaryBike = motorcycles.find((b: { isPrimary: boolean }) => b.isPrimary) as
    | { make: string; model: string; year: number }
    | undefined;
  const articles = articlesQuery.data?.searchArticles?.edges ?? [];

  const showSetupCta = !preferences?.onboardingCompleted || motorcycles.length === 0;
  const isLoading = meQuery.isLoading && bikesQuery.isLoading;
  const isRefreshing =
    meQuery.isRefetching || bikesQuery.isRefetching || articlesQuery.isRefetching;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
  }, [queryClient]);

  const firstName = user?.fullName?.split(' ')[0];
  const greetingKey = getGreetingKey();

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color={palette.primary500} />
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
        {/* Greeting Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          className="flex-row items-center justify-between px-5 pt-3 pb-1"
        >
          <View className="flex-1 mr-3">
            <Text className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              {firstName ? t(greetingKey, { name: firstName }) : t('home.greetingFallback')}
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('home.readyToLearn')}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/(profile)');
            }}
          >
            <View
              className="w-10 h-10 rounded-full bg-primary-500 items-center justify-center"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="text-white text-sm font-bold">
                {user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Setup Rider Profile CTA */}
        {showSetupCta && (
          <Animated.View entering={FadeInUp.delay(50).duration(400)} className="px-5 mt-4">
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios')
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(onboarding)');
              }}
              style={{ borderCurve: 'continuous' }}
            >
              <LinearGradient
                colors={[palette.gradientCTAStart, palette.gradientCTAEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 16, padding: 20, borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center">
                      <CircuitBoard size={20} color={palette.white} strokeWidth={1.5} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-base font-bold">
                        {t('home.setupProfile')}
                      </Text>
                      <Text className="text-white/70 text-sm mt-0.5">
                        {t('home.setupProfileDesc')}
                      </Text>
                    </View>
                  </View>
                  <ArrowRight size={20} color={palette.white} strokeWidth={2} />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Rider Profile Card */}
        {!showSetupCta && user && (
          <Animated.View entering={FadeInUp.delay(50).duration(400)} className="px-5 mt-4">
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios')
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/(profile)');
              }}
            >
              <LinearGradient
                colors={[palette.gradientCTAStart, palette.gradientCTAEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 16, padding: 16, borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-3"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-white text-lg font-bold">
                      {user.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base font-bold">{user.fullName}</Text>
                    <View className="flex-row items-center gap-2 mt-0.5">
                      {preferences?.experienceLevel && (
                        <View
                          className="bg-white/15 rounded-md px-2 py-0.5"
                          style={{ borderCurve: 'continuous' }}
                        >
                          <Text className="text-white/90 text-xs font-medium capitalize">
                            {preferences.experienceLevel}
                          </Text>
                        </View>
                      )}
                      {primaryBike && (
                        <Text className="text-white/70 text-xs">
                          {primaryBike.year} {primaryBike.make} {primaryBike.model}
                        </Text>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={18} color={palette.white} strokeWidth={2} />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(150).duration(400)} className="px-5 mt-5">
          <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-3">
            {t('home.quickActions')}
          </Text>
          <View className="flex-row gap-3">
            {QUICK_ACTIONS.map((action, index) => {
              const Icon = action.icon;
              return (
                <Animated.View
                  key={action.key}
                  entering={FadeInUp.delay(200 + index * 50).duration(400)}
                  className="flex-1"
                >
                  <Pressable
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(action.route as never);
                    }}
                    className="bg-white dark:bg-neutral-800 rounded-2xl p-3.5 items-center"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <View
                      className="w-11 h-11 rounded-xl items-center justify-center mb-2"
                      style={{
                        backgroundColor: action.bgLight,
                        borderCurve: 'continuous',
                      }}
                    >
                      <Icon size={22} color={action.color} strokeWidth={1.8} />
                    </View>
                    <Text
                      className="text-xs font-semibold text-neutral-950 dark:text-neutral-50 text-center"
                      numberOfLines={2}
                    >
                      {t(action.titleKey)}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Popular Topics */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)} className="mt-6">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50">
              {t('home.popularTopics')}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/(learn)')}
              className="flex-row items-center gap-1"
            >
              <Text className="text-sm font-medium text-primary-500">{t('home.viewAll')}</Text>
              <ChevronRight size={14} color={palette.primary500} strokeWidth={2.5} />
            </Pressable>
          </View>

          {articlesQuery.isLoading ? (
            <View className="h-36 items-center justify-center">
              <ActivityIndicator size="small" color={palette.primary500} />
            </View>
          ) : articles.length === 0 ? (
            <View className="h-36 items-center justify-center px-5">
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">
                {t('learn.noResults')}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {articles.map(
                (
                  edge: {
                    node: {
                      id: string;
                      slug: string;
                      title: string;
                      difficulty: string;
                      category: string;
                      viewCount: number;
                    };
                  },
                  index: number,
                ) => {
                  const article = edge.node;
                  const diffColor =
                    DIFFICULTY_COLORS[article.difficulty as keyof typeof DIFFICULTY_COLORS] ??
                    palette.neutral400;
                  return (
                    <Animated.View
                      key={article.id}
                      entering={FadeInUp.delay(400 + index * 50).duration(400)}
                    >
                      <Pressable
                        onPress={() => {
                          if (process.env.EXPO_OS === 'ios')
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push(`/(tabs)/(learn)` as never);
                        }}
                        className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden"
                        style={{ width: 200, borderCurve: 'continuous' }}
                      >
                        {/* Thumbnail placeholder */}
                        <View
                          className="h-24 items-center justify-center"
                          style={{ backgroundColor: `${diffColor}15` }}
                        >
                          <BookOpen size={28} color={diffColor} strokeWidth={1.5} />
                        </View>
                        <View className="p-3">
                          <Text
                            className="text-sm font-semibold text-neutral-950 dark:text-neutral-50"
                            numberOfLines={2}
                          >
                            {article.title}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-2">
                            <View
                              className="rounded-md px-1.5 py-0.5"
                              style={{
                                backgroundColor: `${diffColor}20`,
                                borderCurve: 'continuous',
                              }}
                            >
                              <Text
                                className="text-[10px] font-semibold capitalize"
                                style={{ color: diffColor }}
                              >
                                {article.difficulty}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-0.5">
                              <Eye size={10} color={palette.neutral400} strokeWidth={2} />
                              <Text className="text-[10px] text-neutral-400">
                                {article.viewCount}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                },
              )}
            </ScrollView>
          )}
        </Animated.View>

        {/* Check Your Bike CTA */}
        <Animated.View entering={FadeInUp.delay(450).duration(400)} className="px-5 mt-5">
          <Pressable
            className="bg-white dark:bg-neutral-800 rounded-2xl p-4 flex-row items-center"
            style={{ borderCurve: 'continuous' }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/(diagnose)');
            }}
          >
            <View className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900 items-center justify-center mr-3">
              <Image
                source={require('../../../assets/icon.png')}
                style={{ width: 28, height: 28, borderRadius: 6 }}
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50">
                {t('home.checkBike')}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('home.checkBikeDesc')}
              </Text>
            </View>
            <View className="w-10 h-10 rounded-full bg-primary-950 dark:bg-primary-500 items-center justify-center">
              <ChevronRight size={18} color={palette.white} strokeWidth={2.5} />
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
