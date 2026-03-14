import { palette } from '@motovault/design-system';
import { ArticleBySlugFullDocument, MarkArticleReadDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, BookOpen, CheckCircle, Clock, Eye, HelpCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';

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

  const markReadMutation = useMutation({
    mutationFn: () => gqlFetcher(MarkArticleReadDocument, { articleId: article?.id ?? '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  if (error || !article) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center p-5">
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center">
          {t('common.error')}
        </Text>
      </View>
    );
  }

  const difficultyColor =
    (DIFFICULTY_COLORS as Record<string, string>)[article.difficulty] ?? palette.neutral400;
  const categoryColor =
    (CATEGORY_COLORS as Record<string, string>)[article.category] ?? palette.primary500;

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-4">
          <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
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
                <Clock size={12} color={palette.neutral400} strokeWidth={2} />
                <Text className="text-xs text-neutral-500">
                  {t('article.readTime', { minutes: article.readTime })}
                </Text>
              </View>
            )}
            {/* View count */}
            <View className="flex-row items-center gap-1">
              <Eye size={12} color={palette.neutral400} strokeWidth={2} />
              <Text className="text-xs text-neutral-500">
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
            <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-2">
              {section.heading}
            </Text>
            <Text className="text-base text-neutral-700 dark:text-neutral-300 leading-6">
              {section.body}
            </Text>
          </Animated.View>
        ))}

        {/* Key Takeaways */}
        {content?.keyTakeaways && content.keyTakeaways.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(200 + (content.sections?.length ?? 0) * 50).duration(400)}
            className="px-5 mt-6"
          >
            <View
              className="bg-primary-50 dark:bg-primary-950 rounded-2xl p-5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <BookOpen size={18} color={palette.primary500} strokeWidth={2} />
                <Text className="text-base font-bold text-primary-700 dark:text-primary-300">
                  {t('article.keyTakeaways')}
                </Text>
              </View>
              {content.keyTakeaways.map((takeaway) => (
                <View key={takeaway} className="flex-row gap-2 mt-1.5">
                  <Text className="text-primary-500 text-sm">{'\u2022'}</Text>
                  <Text className="text-sm text-primary-800 dark:text-primary-200 flex-1 leading-5">
                    {takeaway}
                  </Text>
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
            <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-3">
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
                  className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5"
                  style={{ borderCurve: 'continuous' }}
                  onPress={() => {
                    router.navigate({ pathname: '/(tabs)/(learn)', params: { q: topic } });
                  }}
                >
                  <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {topic}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* AI Content Disclaimer */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)} className="px-5 mt-6">
          <View
            className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-4 flex-row gap-3"
            style={{ borderCurve: 'continuous' }}
          >
            <AlertTriangle size={16} color={palette.warning500} strokeWidth={2} />
            <Text className="text-xs text-amber-800 dark:text-amber-200 flex-1 leading-4">
              {t('article.aiDisclaimer')}
            </Text>
          </View>
        </Animated.View>

        {/* Take Quiz Button */}
        {article.id && (
          <Animated.View entering={FadeInUp.delay(380).duration(400)} className="px-5 mt-6">
            <Pressable
              className="bg-accent-500 dark:bg-accent-400 rounded-2xl py-4 items-center flex-row justify-center gap-2"
              style={{ borderCurve: 'continuous' }}
              onPress={() => router.push(`/(tabs)/(learn)/quiz/${article.id}` as `/${string}`)}
            >
              <HelpCircle size={18} color={palette.white} strokeWidth={2} />
              <Text className="text-white font-semibold text-base">{t('article.takeQuiz')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Mark as Read Button */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} className="px-5 mt-4">
          <Pressable
            className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
              markReadMutation.isSuccess ? 'bg-green-100 dark:bg-green-900' : 'bg-primary-500'
            }`}
            style={{ borderCurve: 'continuous' }}
            onPress={() => markReadMutation.mutate()}
            disabled={markReadMutation.isPending || markReadMutation.isSuccess}
          >
            {markReadMutation.isPending ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : markReadMutation.isSuccess ? (
              <>
                <CheckCircle size={18} color={palette.success500} strokeWidth={2} />
                <Text className="text-green-700 dark:text-green-300 font-semibold text-base">
                  {t('article.alreadyRead')}
                </Text>
              </>
            ) : (
              <>
                <BookOpen size={18} color={palette.white} strokeWidth={2} />
                <Text className="text-white font-semibold text-base">
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
