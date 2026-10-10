import { palette } from '@motovault/design-system';
import { ArticleBySlugFullDocument, MarkArticleReadDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, BookOpen, CheckCircle, Clock, Eye } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { MetaAnalytics } from '@/lib/meta-analytics';
import { queryKeys } from '@/lib/query-keys';
import { type EditorialTokens, tint, useEditorialTheme } from '@/theme/editorial';
import { type } from '@/theme/type';

/** Difficulty → theme token (resolved per scheme at render). */
const DIFFICULTY_TOKEN = {
  beginner: 'success',
  intermediate: 'dueInk',
  advanced: 'danger',
} as const satisfies Record<string, keyof EditorialTokens>;

const CATEGORY_COLORS = {
  'engine-basics': palette.moduleEngine,
  suspension: palette.moduleSuspension,
  electrical: palette.moduleElectrical,
  maintenance: palette.moduleMaintenance,
} as const;

interface ContentSection {
  heading: string;
  body: string;
}

interface ContentJson {
  sections?: ContentSection[];
  keyTakeaways?: string[];
  relatedTopics?: string[];
}

export default function ArticleScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.articles.detail(slug ?? ''),
    queryFn: () => gqlFetcher(ArticleBySlugFullDocument, { slug: slug ?? '' }),
    enabled: !!slug,
  });

  const article = data?.articleBySlugFull;
  const content = article?.contentJson as ContentJson | null | undefined;

  // Track article view for Meta and PostHog
  useEffect(() => {
    if (slug) {
      trackEvent(AnalyticsEvent.ARTICLE_VIEWED, { slug });
      MetaAnalytics.trackViewContent('article', slug);
    }
  }, [slug]);

  const markReadMutation = useMutation({
    mutationFn: () => gqlFetcher(MarkArticleReadDocument, { articleId: article?.id ?? '' }),
    onSuccess: () => {
      trackEvent(AnalyticsEvent.ARTICLE_READ, {
        slug: slug ?? '',
        category: article?.category ?? '',
        difficulty: article?.difficulty ?? '',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.ink3} />
      </View>
    );
  }

  if (error || !article) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Text style={{ ...type.body, color: theme.ink3, textAlign: 'center' }}>
          {t('common.error')}
        </Text>
      </View>
    );
  }

  const difficultyToken = (DIFFICULTY_TOKEN as Record<string, keyof EditorialTokens>)[
    article.difficulty
  ];
  const difficultyColor = difficultyToken ? theme[difficultyToken] : theme.ink3;
  const categoryColor = (CATEGORY_COLORS as Record<string, string>)[article.category] ?? theme.ink2;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-4">
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: theme.ink }}>
            {article.title}
          </Text>

          {/* Badges row */}
          <View className="flex-row items-center gap-2 mt-3 flex-wrap">
            {/* Category */}
            <View
              className="rounded-lg px-2.5 py-1"
              style={{
                backgroundColor: `${categoryColor}15`,
                borderCurve: 'continuous',
              }}
            >
              <Text className="text-xs font-medium capitalize" style={{ color: categoryColor }}>
                {article.category.replace(/-/g, ' ')}
              </Text>
            </View>
            {/* Difficulty */}
            <View
              className="rounded-lg px-2.5 py-1"
              style={{
                backgroundColor: `${difficultyColor}15`,
                borderCurve: 'continuous',
              }}
            >
              <Text className="text-xs font-medium capitalize" style={{ color: difficultyColor }}>
                {article.difficulty}
              </Text>
            </View>
            {/* Read time */}
            {article.readTime != null && (
              <View className="flex-row items-center gap-1">
                <Clock size={12} color={theme.ink3} strokeWidth={2} />
                <Text style={{ ...type.caption, color: theme.ink3 }}>
                  {t('article.readTime', { minutes: article.readTime })}
                </Text>
              </View>
            )}
            {/* View count */}
            <View className="flex-row items-center gap-1">
              <Eye size={12} color={theme.ink3} strokeWidth={2} />
              <Text style={{ ...type.caption, color: theme.ink3 }}>
                {t('article.views', { count: article.viewCount })}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Content Sections */}
        {content?.sections?.map((section, index) => (
          <Animated.View
            key={`section-${section.heading}`}
            entering={FadeInUp.delay(100 + index * 50).duration(400)}
            className="px-5 mt-5"
          >
            <Text style={{ ...type.sectionTitle, color: theme.ink, marginBottom: 8 }}>
              {section.heading}
            </Text>
            <Text style={{ ...type.body, color: theme.ink2 }}>{section.body}</Text>
          </Animated.View>
        ))}

        {/* Key Takeaways */}
        {content?.keyTakeaways && content.keyTakeaways.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(200 + (content.sections?.length ?? 0) * 50).duration(400)}
            className="px-5 mt-6"
          >
            <View
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 20,
              }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <BookOpen size={18} color={theme.ink2} strokeWidth={2} />
                <Text style={{ ...type.bodyStrong, color: theme.ink }}>
                  {t('article.keyTakeaways')}
                </Text>
              </View>
              {content.keyTakeaways.map((takeaway) => (
                <View key={takeaway} className="flex-row gap-2 mt-1.5">
                  <Text style={{ ...type.subhead, color: theme.ink3 }}>{'\u2022'}</Text>
                  <Text style={{ ...type.subhead, color: theme.ink2, flex: 1 }}>{takeaway}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Related Topics */}
        {content?.relatedTopics && content.relatedTopics.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(300 + (content.sections?.length ?? 0) * 50).duration(400)}
            className="px-5 mt-5"
          >
            <Text style={{ ...type.sectionTitle, color: theme.ink, marginBottom: 12 }}>
              {t('article.relatedTopics')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {content.relatedTopics.map((topic) => (
                <Pressable
                  key={topic}
                  style={{
                    backgroundColor: theme.surface2,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                  onPress={() => {
                    router.navigate({
                      pathname: '/(tabs)/(learn)',
                      params: { q: topic },
                    });
                  }}
                >
                  <Text style={{ ...type.label, color: theme.ink2 }}>{topic}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* AI Content Disclaimer */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)} className="px-5 mt-6">
          <View
            style={{
              backgroundColor: tint(theme.plateDue, 0.12),
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <AlertTriangle size={16} color={theme.dueInk} strokeWidth={2} />
            <Text style={{ ...type.caption, color: theme.ink2, flex: 1 }}>
              {t('article.aiDisclaimer')}
            </Text>
          </View>
        </Animated.View>

        {/* Mark as Read Button */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} className="px-5 mt-4">
          <Pressable
            style={{
              backgroundColor: markReadMutation.isSuccess ? tint(theme.success, 0.14) : theme.warm,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={() => markReadMutation.mutate()}
            disabled={markReadMutation.isPending || markReadMutation.isSuccess}
          >
            {markReadMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.onWarm} />
            ) : markReadMutation.isSuccess ? (
              <>
                <CheckCircle size={18} color={theme.success} strokeWidth={2} />
                <Text style={{ ...type.bodyStrong, color: theme.success }}>
                  {t('article.alreadyRead')}
                </Text>
              </>
            ) : (
              <>
                <BookOpen size={18} color={theme.onWarm} strokeWidth={2} />
                <Text style={{ ...type.bodyStrong, color: theme.onWarm }}>
                  {t('article.markAsRead')}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
