import { palette } from '@motovault/design-system';
import {
  GenerateArticleDocument,
  ListPopularArticlesDocument,
  MyMotorcyclesDocument,
  MyProgressDocument,
  SearchArticlesDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  BookOpen,
  Cog,
  Eye,
  Search,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LearnOnboardingCard } from '../../../components/learn/onboarding-card';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { SkeletonProvider } from '../../../components/skeleton/skeleton-provider';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { presentPaywall } from '../../../lib/subscription';
import { useEditorialTheme } from '../../../theme/editorial';

const MODULES = [
  { key: 'engine', icon: Cog, color: palette.moduleEngine, category: 'engine-basics' },
  { key: 'suspension', icon: Sparkles, color: palette.moduleSuspension, category: 'suspension' },
  { key: 'electrical', icon: Zap, color: palette.moduleElectrical, category: 'electrical' },
  { key: 'maintenance', icon: Wrench, color: palette.moduleMaintenance, category: 'maintenance' },
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

function isFreeTierLimitError(error: Error): boolean {
  return /free plan allows|upgrade to pro/i.test(error.message);
}

export default function LearnScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useEditorialTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const generateGuardRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const modulesOffsetY = useRef(0);

  // Sync q param to search — intentionally only trigger on q changes, not searchQuery
  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when URL param changes
  useEffect(() => {
    if (q && q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [q]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      setDebouncedQuery(trimmed);
      if (trimmed.length > 0) {
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: progressData, isLoading: isProgressLoading } = useQuery({
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

  const { data: popularData, isLoading: isPopularLoading } = useQuery({
    queryKey: queryKeys.articles.popular(10),
    queryFn: () => gqlFetcher(ListPopularArticlesDocument),
    staleTime: 5 * 60 * 1000,
  });
  const popularArticles = popularData?.popularArticles ?? [];

  const queryClient = useQueryClient();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: queryKeys.articles.popular(10),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.progress.all, refetchType: 'active' }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.motorcycles.all,
          refetchType: 'active',
        }),
      ]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [queryClient]);

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
      setGenerateError(err.message ?? tr('common.error'));
      if (isFreeTierLimitError(err)) {
        presentPaywall({
          source: 'feature_gate',
          feature: 'unlimited_articles',
          placement: 'feature_gate',
          surface: 'learn_article_limit',
        });
      }
    },
  });

  const isGenerating = generateMutation.isPending;
  const handleGenerate = () => {
    if (generateGuardRef.current || isGenerating) return;
    generateGuardRef.current = true;
    setGenerateError(null);
    generateMutation.mutate(debouncedQuery, {
      onSettled: () => {
        generateGuardRef.current = false;
      },
    });
  };

  const handleClear = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    router.setParams({ q: undefined });
  };

  const handleBrowseModules = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: modulesOffsetY.current, animated: true });
  }, []);

  const handleGenerateFromBanner = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const onModulesLayout = useCallback((e: LayoutChangeEvent) => {
    modulesOffsetY.current = e.nativeEvent.layout.y;
  }, []);

  const isInitialLoading = (isProgressLoading || isPopularLoading) && !progressData && !popularData;

  if (isInitialLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: insets.top,
          paddingHorizontal: 20,
        }}
      >
        <SkeletonProvider>
          {/* Header placeholder */}
          <Animated.View entering={FadeInUp.delay(0).duration(300)} style={{ marginTop: 12 }}>
            <Skeleton width="30%" height={28} borderRadius={8} />
          </Animated.View>
          {/* Search bar placeholder */}
          <Animated.View entering={FadeInUp.delay(50).duration(300)} style={{ marginTop: 12 }}>
            <Skeleton width="100%" height={44} borderRadius={12} />
          </Animated.View>
          {/* Hero card placeholder */}
          <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ marginTop: 16 }}>
            <Skeleton width="100%" height={200} borderRadius={16} />
          </Animated.View>
          {/* Article row placeholders */}
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              entering={FadeInUp.delay(150 + i * 50).duration(300)}
              style={{ marginTop: 12 }}
            >
              <Skeleton width="100%" height={80} borderRadius={16} />
            </Animated.View>
          ))}
        </SkeletonProvider>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={t.warm} />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: t.ink }}>{tr('tabs.learn')}</Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 12 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: t.line,
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 8,
            }}
          >
            <Search size={18} color={t.ink3} strokeWidth={2} />
            <TextInput
              ref={searchInputRef}
              style={{ flex: 1, fontSize: 16, color: t.ink }}
              placeholder={tr('learn.searchPlaceholder')}
              placeholderTextColor={t.ink3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={8}>
                <X size={16} color={t.ink3} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {isSearchActive ? (
          /* Search Results */
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={{ paddingHorizontal: 20, marginTop: 16 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: t.ink2,
                  textTransform: 'uppercase',
                  letterSpacing: 2.2,
                }}
              >
                {tr('learn.searchResults')}
              </Text>
              <Pressable
                onPress={handleClear}
                hitSlop={8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: t.surface2,
                }}
              >
                <X size={14} color={t.ink3} strokeWidth={2} />
                <Text style={{ fontSize: 12, fontWeight: '500', color: t.ink3 }}>
                  {tr('common.back')}
                </Text>
              </Pressable>
            </View>

            {isSearching ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={t.warm} />
              </View>
            ) : searchResults.length === 0 ? (
              <View
                style={{
                  backgroundColor: t.surface,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: t.line,
                  padding: 24,
                  alignItems: 'center',
                }}
              >
                <Search size={36} color={t.ink4} strokeWidth={1.5} />
                <Text style={{ fontSize: 14, color: t.ink3, marginTop: 12, textAlign: 'center' }}>
                  {tr('learn.noResults')}
                </Text>
                <Pressable
                  style={{
                    marginTop: 16,
                    backgroundColor: t.warm,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onPress={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color={palette.white} />
                  ) : (
                    <Sparkles size={16} color={palette.white} strokeWidth={2} />
                  )}
                  <Text style={{ color: palette.white, fontWeight: '600', fontSize: 14 }}>
                    {isGenerating ? tr('learn.generating') : tr('learn.generateArticle')}
                  </Text>
                </Pressable>
                {generateError && (
                  <View
                    style={{
                      marginTop: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={14} color={t.danger} strokeWidth={2} />
                    <Text style={{ fontSize: 12, color: t.danger, flex: 1 }}>{generateError}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {searchResults.map(({ node }, index) => (
                  <Animated.View key={node.id} entering={FadeInUp.delay(index * 50).duration(400)}>
                    <Pressable
                      style={{
                        backgroundColor: t.surface,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        borderWidth: 1,
                        borderColor: t.line,
                        padding: 16,
                      }}
                      onPress={() =>
                        router.push(`/(tabs)/(learn)/article/${node.slug}` as `/${string}`)
                      }
                    >
                      <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>
                        {node.title}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Category badge */}
                        <View
                          style={{
                            borderRadius: 8,
                            borderCurve: 'continuous',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            backgroundColor: `${(CATEGORY_COLORS as Record<string, string>)[node.category] ?? t.warm}15`,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '500',
                              textTransform: 'capitalize',
                              color:
                                (CATEGORY_COLORS as Record<string, string>)[node.category] ??
                                t.warm,
                            }}
                          >
                            {node.category.replace(/-/g, ' ')}
                          </Text>
                        </View>
                        {/* Difficulty badge */}
                        <View
                          style={{
                            borderRadius: 8,
                            borderCurve: 'continuous',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            backgroundColor: `${(DIFFICULTY_COLORS as Record<string, string>)[node.difficulty] ?? t.ink3}15`,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '500',
                              textTransform: 'capitalize',
                              color:
                                (DIFFICULTY_COLORS as Record<string, string>)[node.difficulty] ??
                                t.ink3,
                            }}
                          >
                            {node.difficulty}
                          </Text>
                        </View>
                        {/* View count */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Eye size={12} color={t.ink3} strokeWidth={2} />
                          <Text style={{ fontSize: 12, color: t.ink3 }}>{node.viewCount}</Text>
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
            {/* Onboarding Card */}
            <LearnOnboardingCard
              onBrowse={handleBrowseModules}
              onGenerate={handleGenerateFromBanner}
            />

            {/* Progress Card */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(400)}
              style={{ paddingHorizontal: 20, marginTop: 16 }}
            >
              <View
                className="bg-primary-950 dark:bg-primary-800"
                style={{
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 20,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BookOpen size={20} color={palette.white} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.white, fontSize: 18, fontWeight: '700' }}>
                      {tr('learn.motorcycleBasics')}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      {tr('learn.articlesRead', { count: totalRead })}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View
                  style={{
                    height: 8,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    className="bg-accent-400"
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      width: `${Math.min((totalRead / 20) * 100, 100)}%`,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    marginTop: 8,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {tr('learn.progressLabel', { current: totalRead, total: 20 })}
                </Text>
              </View>
            </Animated.View>

            {/* Module Grid */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              style={{ paddingHorizontal: 20, marginTop: 20 }}
              onLayout={onModulesLayout}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: t.ink2,
                  textTransform: 'uppercase',
                  letterSpacing: 2.2,
                  marginBottom: 12,
                }}
              >
                {tr('learn.modules')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {MODULES.map((mod, index) => {
                  const Icon = mod.icon;
                  return (
                    <Animated.View
                      key={mod.key}
                      entering={FadeInUp.delay(350 + index * 60).duration(400)}
                      style={{ width: '48%' }}
                    >
                      <Pressable
                        style={{
                          backgroundColor: t.surface,
                          borderRadius: 14,
                          borderCurve: 'continuous',
                          borderWidth: 1,
                          borderColor: t.line,
                          padding: 16,
                        }}
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
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: t.ink,
                            marginTop: 12,
                            textTransform: 'capitalize',
                          }}
                        >
                          {tr(`learn.module.${mod.key}`)}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Popular in the Community */}
            {popularArticles.length >= 5 && (
              <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ marginTop: 20 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: t.ink2,
                    textTransform: 'uppercase',
                    letterSpacing: 2.2,
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  {tr('learn.popularInCommunity', { defaultValue: 'Popular in the Community' })}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                >
                  {popularArticles.map((article, index) => (
                    <Animated.View
                      key={article.id}
                      entering={FadeInUp.delay(520 + index * 40).duration(400)}
                    >
                      <Pressable
                        style={{
                          width: 200,
                          backgroundColor: t.surface,
                          borderRadius: 14,
                          borderCurve: 'continuous',
                          borderWidth: 1,
                          borderColor: t.line,
                          padding: 14,
                        }}
                        onPress={() =>
                          router.push(`/(tabs)/(learn)/article/${article.slug}` as `/${string}`)
                        }
                      >
                        <Text
                          style={{ fontSize: 14, fontWeight: '600', color: t.ink }}
                          numberOfLines={2}
                        >
                          {article.title}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* Category badge */}
                          <View
                            style={{
                              borderRadius: 8,
                              borderCurve: 'continuous',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              backgroundColor: `${(CATEGORY_COLORS as Record<string, string>)[article.category] ?? t.warm}15`,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '500',
                                color:
                                  (CATEGORY_COLORS as Record<string, string>)[article.category] ??
                                  t.warm,
                                textTransform: 'capitalize',
                              }}
                            >
                              {article.category.replace(/-/g, ' ')}
                            </Text>
                          </View>
                          {/* Difficulty badge */}
                          <View
                            style={{
                              borderRadius: 8,
                              borderCurve: 'continuous',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              backgroundColor: `${(DIFFICULTY_COLORS as Record<string, string>)[article.difficulty] ?? t.ink3}15`,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '500',
                                color:
                                  (DIFFICULTY_COLORS as Record<string, string>)[
                                    article.difficulty
                                  ] ?? t.ink3,
                                textTransform: 'capitalize',
                              }}
                            >
                              {article.difficulty}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 6,
                          }}
                        >
                          <Eye size={11} color={t.ink3} strokeWidth={2} />
                          <Text style={{ fontSize: 11, color: t.ink3 }}>{article.viewCount}</Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
