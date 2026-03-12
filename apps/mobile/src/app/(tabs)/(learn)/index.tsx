import { palette } from '@motolearn/design-system';
import {
  GenerateArticleDocument,
  MyMotorcyclesDocument,
  MyProgressDocument,
  SearchArticlesDocument,
} from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  BookOpen,
  Cog,
  Crown,
  Eye,
  Search,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProGateModal } from '../../../components/ProGateModal';
import { useProGate } from '../../../hooks/useProGate';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const MODULES = [
  { key: 'engine', icon: Cog, color: palette.moduleEngine, lessons: 12, category: 'engine-basics' },
  {
    key: 'suspension',
    icon: Sparkles,
    color: palette.moduleSuspension,
    lessons: 8,
    category: 'suspension',
  },
  {
    key: 'electrical',
    icon: Zap,
    color: palette.moduleElectrical,
    lessons: 10,
    category: 'electrical',
  },
  {
    key: 'maintenance',
    icon: Wrench,
    color: palette.moduleMaintenance,
    lessons: 15,
    category: 'maintenance',
  },
] as const;

const DIFFICULTY_COLORS = {
  beginner: palette.success500,
  intermediate: palette.warning500,
  advanced: palette.danger500,
} as const;

const CATEGORY_COLORS = {
  'engine-basics': palette.moduleEngine,
  suspension: palette.moduleSuspension,
  electrical: palette.moduleElectrical,
  maintenance: palette.moduleMaintenance,
} as const;

export default function LearnScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requirePro, showPaywall, blockedFeature, dismissPaywall } = useProGate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: progressData } = useQuery({
    queryKey: queryKeys.progress.all,
    queryFn: () => gqlFetcher(MyProgressDocument),
  });
  const progress = progressData?.myProgress ?? [];
  const totalRead = useMemo(
    () => progress.filter((p: { articleRead: boolean }) => p.articleRead).length,
    [progress],
  );

  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: queryKeys.articles.list({ query: debouncedQuery }),
    queryFn: () =>
      gqlFetcher(SearchArticlesDocument, {
        input: { query: debouncedQuery, first: 20 },
      }),
    enabled: debouncedQuery.length > 0,
  });

  const searchResults = searchData?.searchArticles?.edges ?? [];
  const isSearchActive = debouncedQuery.length > 0;

  const queryClient = useQueryClient();
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Fetch user's motorcycles to pass bike context to article generation
  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const primaryBike = useMemo(() => {
    const bikes = motorcyclesData?.myMotorcycles ?? [];
    return bikes.find((b: { isPrimary: boolean }) => b.isPrimary) ?? bikes[0] ?? null;
  }, [motorcyclesData]);

  const generateMutation = useMutation({
    mutationFn: (topic: string) => {
      // Enrich topic with bike context if available
      const bikeContext = primaryBike
        ? ` for ${primaryBike.year} ${primaryBike.make} ${primaryBike.model}`
        : '';
      return gqlFetcher(GenerateArticleDocument, {
        input: { topic: `${topic}${bikeContext}` },
      });
    },
    onSuccess: (data) => {
      setGenerateError(null);
      // Invalidate article list cache so the new article appears
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      // Navigate to the newly generated article
      const slug = data.generateArticle.slug;
      router.push(`/(tabs)/(learn)/article/${slug}` as `/${string}`);
    },
    onError: (err: Error) => {
      setGenerateError(err.message ?? t('common.error'));
    },
  });

  const isGenerating = generateMutation.isPending;
  const handleGenerate = () => {
    if (!requirePro('unlimited_articles')) return;
    setGenerateError(null);
    generateMutation.mutate(debouncedQuery);
  };

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-3 pb-1">
          <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
            {t('tabs.learn')}
          </Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-5 mt-3">
          <View
            className="flex-row items-center bg-white dark:bg-neutral-800 rounded-xl px-4 py-3 gap-2"
            style={{ borderCurve: 'continuous' }}
          >
            <Search size={18} color={palette.neutral400} strokeWidth={2} />
            <TextInput
              className="flex-1 text-base text-neutral-950 dark:text-neutral-50"
              placeholder={t('learn.searchPlaceholder')}
              placeholderTextColor={palette.neutral400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
        </Animated.View>

        {isSearchActive ? (
          /* Search Results */
          <Animated.View entering={FadeInUp.duration(300)} className="px-5 mt-4">
            <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-3">
              {t('learn.searchResults')}
            </Text>

            {isSearching ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color={palette.primary500} />
              </View>
            ) : searchResults.length === 0 ? (
              <View
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 items-center"
                style={{ borderCurve: 'continuous' }}
              >
                <Search size={36} color={palette.neutral300} strokeWidth={1.5} />
                <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-3 text-center">
                  {t('learn.noResults')}
                </Text>
                <Pressable
                  className="mt-4 bg-primary-500 rounded-xl px-6 py-3 flex-row items-center gap-2"
                  style={{ borderCurve: 'continuous' }}
                  onPress={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color={palette.white} />
                  ) : (
                    <>
                      <Crown size={14} color="#FACC15" strokeWidth={2} />
                      <Sparkles size={16} color={palette.white} strokeWidth={2} />
                    </>
                  )}
                  <Text className="text-white font-semibold text-sm">
                    {isGenerating ? t('learn.generating') : t('learn.generateArticle')}
                  </Text>
                </Pressable>
                {generateError && (
                  <View className="mt-3 flex-row items-center gap-2">
                    <AlertCircle size={14} color={palette.danger500} strokeWidth={2} />
                    <Text className="text-xs text-red-600 dark:text-red-400 flex-1">
                      {generateError}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="gap-3">
                {searchResults.map(({ node }, index) => (
                  <Animated.View key={node.id} entering={FadeInUp.delay(index * 50).duration(400)}>
                    <Pressable
                      className="bg-white dark:bg-neutral-800 rounded-2xl p-4"
                      style={{ borderCurve: 'continuous' }}
                      onPress={() =>
                        router.push(`/(tabs)/(learn)/article/${node.slug}` as `/${string}`)
                      }
                    >
                      <Text className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
                        {node.title}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-2 flex-wrap">
                        {/* Category badge */}
                        <View
                          className="rounded-lg px-2.5 py-1"
                          style={{
                            backgroundColor: `${(CATEGORY_COLORS as Record<string, string>)[node.category] ?? palette.primary500}15`,
                            borderCurve: 'continuous',
                          }}
                        >
                          <Text
                            className="text-xs font-medium capitalize"
                            style={{
                              color:
                                (CATEGORY_COLORS as Record<string, string>)[node.category] ??
                                palette.primary500,
                            }}
                          >
                            {node.category.replace(/-/g, ' ')}
                          </Text>
                        </View>
                        {/* Difficulty badge */}
                        <View
                          className="rounded-lg px-2.5 py-1"
                          style={{
                            backgroundColor: `${(DIFFICULTY_COLORS as Record<string, string>)[node.difficulty] ?? palette.neutral400}15`,
                            borderCurve: 'continuous',
                          }}
                        >
                          <Text
                            className="text-xs font-medium capitalize"
                            style={{
                              color:
                                (DIFFICULTY_COLORS as Record<string, string>)[node.difficulty] ??
                                palette.neutral400,
                            }}
                          >
                            {node.difficulty}
                          </Text>
                        </View>
                        {/* View count */}
                        <View className="flex-row items-center gap-1">
                          <Eye size={12} color={palette.neutral400} strokeWidth={2} />
                          <Text className="text-xs text-neutral-500">{node.viewCount}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : (
          <>
            {/* Progress Card */}
            <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-5 mt-4">
              <View
                className="bg-primary-950 dark:bg-primary-800 rounded-2xl p-5 overflow-hidden"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-3 mb-3">
                  <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center">
                    <BookOpen size={20} color={palette.white} strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-lg font-bold">
                      {t('learn.motorcycleBasics')}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      {t('learn.articlesRead', { count: totalRead })}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="h-2 bg-white/15 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-accent-400 rounded-full"
                    style={{ width: `${Math.min((totalRead / 20) * 100, 100)}%` }}
                  />
                </View>
                <Text
                  className="text-white/50 text-xs mt-2"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {t('learn.progressLabel', { current: totalRead, total: 20 })}
                </Text>
              </View>
            </Animated.View>

            {/* Module Grid */}
            <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-5 mt-5">
              <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-3">
                {t('learn.modules')}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {MODULES.map((mod, index) => {
                  const Icon = mod.icon;
                  return (
                    <Animated.View
                      key={mod.key}
                      entering={FadeInUp.delay(350 + index * 60).duration(400)}
                      style={{ width: '48%' }}
                    >
                      <Pressable
                        className="bg-white dark:bg-neutral-800 rounded-2xl p-4"
                        style={{ borderCurve: 'continuous' }}
                        onPress={() => {
                          setSearchQuery(mod.category);
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: `${mod.color}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderCurve: 'continuous',
                          }}
                        >
                          <Icon size={22} color={mod.color} strokeWidth={2} />
                        </View>
                        <Text className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mt-3 capitalize">
                          {t(`learn.module.${mod.key}`)}
                        </Text>
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          {t('learn.lessonsCount', { count: mod.lessons })}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
      <ProGateModal visible={showPaywall} feature={blockedFeature} onDismiss={dismissPaywall} />
    </View>
  );
}
