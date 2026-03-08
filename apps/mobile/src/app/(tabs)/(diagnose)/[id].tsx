import { palette } from '@motolearn/design-system';
import { DiagnosticByIdDocument } from '@motolearn/graphql';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ArrowRight, BookOpen, RefreshCw, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const SEVERITY_CONFIG = {
  critical: { color: palette.danger500, bg: palette.dangerBgLight },
  high: { color: '#f97316', bg: '#fff7ed' },
  medium: { color: palette.warning500, bg: palette.warningBgLight },
  low: { color: palette.success500, bg: palette.successBgLight },
} as const;

const DIFFICULTY_CONFIG: Record<string, string> = {
  easy: palette.success500,
  moderate: palette.warning500,
  hard: '#f97316',
  professional: palette.danger500,
};

interface DiagnosticResult {
  part?: string;
  issues?: Array<{ description: string; probability?: number }>;
  toolsNeeded?: string[];
  difficulty?: string;
  nextSteps?: string[];
  confidence?: number;
  relatedArticleId?: string | null;
}

export default function DiagnosticResultScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.detail(id ?? ''),
    queryFn: () => gqlFetcher(DiagnosticByIdDocument, { id: id ?? '' }),
    enabled: !!id,
  });

  const diagnostic = data?.diagnosticById;
  const resultJson = (diagnostic?.resultJson ?? null) as DiagnosticResult | null;

  if (isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color={palette.primary500} />
        <Text className="text-sm text-neutral-500 mt-3">{t('diagnose.processing')}</Text>
      </View>
    );
  }

  if (error || !diagnostic) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center p-6">
        <AlertTriangle size={40} color={palette.danger500} strokeWidth={1.5} />
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mt-3">
          {t('diagnose.failed')}
        </Text>
        <Pressable
          className="mt-4 bg-primary-500 rounded-xl px-6 py-3 flex-row items-center gap-2"
          style={{ borderCurve: 'continuous' }}
          onPress={() => refetch()}
        >
          <RefreshCw size={16} color={palette.white} strokeWidth={2} />
          <Text className="text-white font-semibold text-sm">{t('diagnose.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (diagnostic.status === 'processing') {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color={palette.primary500} />
        <Text className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mt-4">
          {t('diagnose.processing')}
        </Text>
      </View>
    );
  }

  if (diagnostic.status === 'failed') {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center p-6">
        <AlertTriangle size={40} color={palette.danger500} strokeWidth={1.5} />
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mt-3">
          {t('diagnose.failed')}
        </Text>
        <Pressable
          className="mt-4 bg-primary-500 rounded-xl px-6 py-3 flex-row items-center gap-2"
          style={{ borderCurve: 'continuous' }}
          onPress={() => router.push('/(diagnose)/new')}
        >
          <RefreshCw size={16} color={palette.white} strokeWidth={2} />
          <Text className="text-white font-semibold text-sm">{t('diagnose.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const sevKey = (diagnostic.severity ?? 'low') as keyof typeof SEVERITY_CONFIG;
  const sevConfig = SEVERITY_CONFIG[sevKey] ?? SEVERITY_CONFIG.low;
  const confidence = diagnostic.confidence ?? 0;

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Part Identified */}
        {resultJson?.part && (
          <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-4">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              {t('diagnose.part')}
            </Text>
            <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
              {resultJson.part}
            </Text>
          </Animated.View>
        )}

        {/* Severity Badge */}
        <Animated.View entering={FadeInUp.delay(50).duration(400)} className="px-5 mt-4">
          <View
            className="rounded-2xl p-4 flex-row items-center gap-3"
            style={{ backgroundColor: sevConfig.bg, borderCurve: 'continuous' }}
          >
            <AlertTriangle size={20} color={sevConfig.color} strokeWidth={2} />
            <View className="flex-1">
              <Text className="text-xs text-neutral-500 uppercase tracking-wider">
                {t('diagnose.severity')}
              </Text>
              <Text className="text-base font-bold capitalize" style={{ color: sevConfig.color }}>
                {diagnostic.severity ?? 'unknown'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Confidence */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-5 mt-3">
          <View
            className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-4"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
              {t('diagnose.confidence')}
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${confidence * 100}%`,
                    backgroundColor:
                      confidence > 0.7
                        ? palette.success500
                        : confidence > 0.4
                          ? palette.warning500
                          : palette.danger500,
                  }}
                />
              </View>
              <Text className="text-sm font-bold text-neutral-950 dark:text-neutral-50 w-12 text-right">
                {Math.round(confidence * 100)}%
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Issues */}
        {resultJson?.issues && resultJson.issues.length > 0 && (
          <Animated.View entering={FadeInUp.delay(150).duration(400)} className="px-5 mt-3">
            <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-2">
              {t('diagnose.issues')}
            </Text>
            <View className="gap-2">
              {resultJson.issues.map((issue) => (
                <View
                  key={issue.description}
                  className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-3"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                    {issue.description}
                  </Text>
                  {issue.probability != null && (
                    <View className="flex-row items-center gap-2 mt-2">
                      <View className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${issue.probability * 100}%` }}
                        />
                      </View>
                      <Text className="text-xs text-neutral-500 w-10 text-right">
                        {Math.round(issue.probability * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Tools Needed */}
        {resultJson?.toolsNeeded && resultJson.toolsNeeded.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-5 mt-4">
            <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-2">
              {t('diagnose.toolsNeeded')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {resultJson.toolsNeeded.map((tool) => (
                <View
                  key={tool}
                  className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-3 py-2 flex-row items-center gap-1.5"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Wrench size={12} color={palette.neutral500} strokeWidth={2} />
                  <Text className="text-sm text-neutral-700 dark:text-neutral-300">{tool}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Difficulty */}
        {resultJson?.difficulty && (
          <Animated.View entering={FadeInUp.delay(250).duration(400)} className="px-5 mt-4">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              {t('diagnose.difficulty')}
            </Text>
            <View
              className="rounded-lg px-3 py-1.5 self-start"
              style={{
                backgroundColor: `${DIFFICULTY_CONFIG[resultJson.difficulty] ?? palette.neutral400}15`,
                borderCurve: 'continuous',
              }}
            >
              <Text
                className="text-sm font-semibold capitalize"
                style={{
                  color: DIFFICULTY_CONFIG[resultJson.difficulty] ?? palette.neutral400,
                }}
              >
                {resultJson.difficulty}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Next Steps */}
        {resultJson?.nextSteps && resultJson.nextSteps.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-5 mt-4">
            <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-2">
              {t('diagnose.nextSteps')}
            </Text>
            <View className="gap-2">
              {resultJson.nextSteps.map((step: string, stepIndex: number) => (
                <View key={step} className="flex-row gap-3 items-start">
                  <View
                    className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 items-center justify-center mt-0.5"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-xs font-bold text-primary-600">{stepIndex + 1}</Text>
                  </View>
                  <Text className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 leading-5">
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Find Related Article */}
        {diagnostic.relatedArticleId && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)} className="px-5 mt-5">
            <Pressable
              className="bg-primary-50 dark:bg-primary-950 rounded-2xl p-4 flex-row items-center gap-3"
              style={{ borderCurve: 'continuous' }}
              onPress={() =>
                router.push(
                  `/(tabs)/(learn)/article/${diagnostic.relatedArticleId}` as `/${string}`,
                )
              }
            >
              <BookOpen size={20} color={palette.primary500} strokeWidth={2} />
              <Text className="text-base font-semibold text-primary-700 dark:text-primary-300 flex-1">
                {t('diagnose.findArticle')}
              </Text>
              <ArrowRight size={18} color={palette.primary500} strokeWidth={2} />
            </Pressable>
          </Animated.View>
        )}

        {/* Disclaimer */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} className="px-5 mt-6">
          <View
            className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-4 flex-row gap-3"
            style={{ borderCurve: 'continuous' }}
          >
            <AlertTriangle size={18} color={palette.warning500} strokeWidth={2} />
            <Text className="text-xs text-amber-800 dark:text-amber-200 flex-1 leading-4">
              {t('diagnose.disclaimer')}
            </Text>
          </View>
        </Animated.View>

        {/* Timestamp */}
        <Animated.View entering={FadeInUp.delay(450).duration(400)} className="px-5 mt-4">
          <Text className="text-xs text-neutral-400 text-center">
            {new Date(diagnostic.createdAt).toLocaleString()}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
