import { palette, spacing, radii } from '@motovault/design-system';
import { DiagnosticByIdDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HardHat,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const SEVERITY_CONFIG = {
  critical: {
    light: { color: palette.danger500, bg: palette.dangerBgLight, text: '#991b1b' },
    dark: { color: '#fca5a5', bg: palette.dangerBgDark, text: '#fca5a5' },
  },
  high: {
    light: { color: palette.signature500, bg: palette.signatureBgLight, text: palette.signature600 },
    dark: { color: palette.signature400, bg: palette.signatureBgDark, text: palette.signature400 },
  },
  medium: {
    light: { color: palette.warning500, bg: palette.warningBgLight, text: '#92400e' },
    dark: { color: '#fbbf24', bg: palette.warningBgDark, text: '#fbbf24' },
  },
  low: {
    light: { color: palette.success500, bg: palette.successBgLight, text: '#166534' },
    dark: { color: '#4ade80', bg: palette.successBgDark, text: '#4ade80' },
  },
} as const;

const DIFFICULTY_CONFIG = {
  easy: { light: palette.success500, dark: '#4ade80', label: 'Easy — DIY Friendly' },
  moderate: { light: palette.warning500, dark: '#fbbf24', label: 'Moderate — Some Experience' },
  hard: { light: palette.signature500, dark: palette.signature400, label: 'Hard — Advanced' },
  professional: { light: palette.danger500, dark: '#fca5a5', label: 'Professional Only' },
} as const;

interface DiagnosticResult {
  part?: string;
  description?: string;
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.detail(id ?? ''),
    queryFn: () => gqlFetcher(DiagnosticByIdDocument, { id: id ?? '' }),
    enabled: !!id,
  });

  const diagnostic = data?.diagnosticById;
  const resultJson = (diagnostic?.resultJson ?? null) as DiagnosticResult | null;

  // Theme colors
  const bg = isDark ? palette.surfaceDark : palette.white;
  const cardBg = isDark ? palette.cardDark : palette.neutral50;
  const textPrimary = isDark ? palette.neutral50 : palette.neutral950;
  const textSecondary = isDark ? palette.neutral400 : palette.neutral500;
  const textTertiary = isDark ? palette.neutral500 : palette.neutral400;
  const trackBg = isDark ? palette.neutral700 : palette.neutral200;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary500} />
        <Text style={{ fontSize: 14, color: textSecondary, marginTop: spacing[3] }}>
          {t('diagnose.processing')}
        </Text>
      </View>
    );
  }

  if (error || !diagnostic) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: spacing[6] }}>
        <AlertTriangle size={40} color={palette.danger500} strokeWidth={1.5} />
        <Text style={{ fontSize: 16, color: textSecondary, textAlign: 'center', marginTop: spacing[3] }}>
          {t('diagnose.failed')}
        </Text>
        <Pressable
          style={{
            marginTop: spacing[4],
            backgroundColor: palette.primary500,
            borderRadius: radii.card,
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            borderCurve: 'continuous',
          }}
          onPress={() => refetch()}
        >
          <RefreshCw size={16} color={palette.white} strokeWidth={2} />
          <Text style={{ color: palette.white, fontWeight: '600', fontSize: 14 }}>
            {t('diagnose.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (diagnostic.status === 'processing') {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary500} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, marginTop: spacing[4] }}>
          {t('diagnose.processing')}
        </Text>
      </View>
    );
  }

  if (diagnostic.status === 'failed') {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: spacing[6] }}>
        <AlertTriangle size={40} color={palette.danger500} strokeWidth={1.5} />
        <Text style={{ fontSize: 16, color: textSecondary, textAlign: 'center', marginTop: spacing[3] }}>
          {t('diagnose.failed')}
        </Text>
        <Pressable
          style={{
            marginTop: spacing[4],
            backgroundColor: palette.primary500,
            borderRadius: radii.card,
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            borderCurve: 'continuous',
          }}
          onPress={() => router.push('/(diagnose)/new')}
        >
          <RefreshCw size={16} color={palette.white} strokeWidth={2} />
          <Text style={{ color: palette.white, fontWeight: '600', fontSize: 14 }}>
            {t('diagnose.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const sevKey = (diagnostic.severity ?? 'low') as keyof typeof SEVERITY_CONFIG;
  const sevTheme = SEVERITY_CONFIG[sevKey]?.[isDark ? 'dark' : 'light'] ?? SEVERITY_CONFIG.low[isDark ? 'dark' : 'light'];
  const confidence = diagnostic.confidence ?? 0;
  const diffKey = (resultJson?.difficulty ?? '') as keyof typeof DIFFICULTY_CONFIG;
  const diffConfig = DIFFICULTY_CONFIG[diffKey];

  const confidenceColor =
    confidence > 0.7 ? (isDark ? '#4ade80' : palette.success500) :
    confidence > 0.4 ? (isDark ? '#fbbf24' : palette.warning500) :
    (isDark ? '#fca5a5' : palette.danger500);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100, gap: spacing[3] }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Header: Part + Description */}
        {resultJson?.part && (
          <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: spacing[1] }}>
              {t('diagnose.part')}
            </Text>
            <Text selectable style={{ fontSize: 24, fontWeight: '700', color: textPrimary, lineHeight: 30 }}>
              {resultJson.part}
            </Text>
            {resultJson.description && (
              <Text selectable style={{ fontSize: 14, color: textSecondary, lineHeight: 20, marginTop: spacing[2] }}>
                {resultJson.description}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Severity Badge */}
        <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ paddingHorizontal: spacing[5] }}>
          <View
            style={{
              backgroundColor: sevTheme.bg,
              borderRadius: 16,
              padding: spacing[4],
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : `${sevTheme.color}20`,
            }}
          >
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${sevTheme.color}18`,
              alignItems: 'center',
              justifyContent: 'center',
              borderCurve: 'continuous',
            }}>
              <ShieldAlert size={18} color={sevTheme.color} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '500', color: textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('diagnose.severity')}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: sevTheme.text, textTransform: 'capitalize', marginTop: 2 }}>
                {diagnostic.severity ?? 'unknown'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Consult a Mechanic CTA — critical/high */}
        {(sevKey === 'critical' || sevKey === 'high') && (
          <Animated.View entering={FadeInUp.delay(75).duration(400)} style={{ paddingHorizontal: spacing[5] }}>
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
              }}
              style={{
                backgroundColor: isDark ? palette.dangerBgDark : palette.dangerBgLight,
                borderRadius: 16,
                padding: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)',
              }}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${palette.danger500}18`,
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}>
                <HardHat size={18} color={isDark ? '#fca5a5' : palette.danger500} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#fca5a5' : '#991b1b' }}>
                  {t('diagnose.consultMechanic')}
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? '#fca5a5' : '#b91c1c', opacity: 0.8, marginTop: 2, lineHeight: 16 }}>
                  {t('diagnose.consultMechanicSubtitle')}
                </Text>
              </View>
              <ChevronRight size={16} color={isDark ? '#fca5a5' : '#991b1b'} strokeWidth={2} />
            </Pressable>
          </Animated.View>
        )}

        {/* Confidence */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ paddingHorizontal: spacing[5] }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: spacing[4],
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '500', color: textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2] }}>
              {t('diagnose.confidence')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <View style={{ flex: 1, height: 6, backgroundColor: trackBg, borderRadius: 3, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    borderRadius: 3,
                    width: `${confidence * 100}%`,
                    backgroundColor: confidenceColor,
                  }}
                />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: confidenceColor, width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                {Math.round(confidence * 100)}%
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Issues Found */}
        {resultJson?.issues && resultJson.issues.length > 0 && (
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={{ paddingHorizontal: spacing[5] }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary, marginBottom: spacing[2] }}>
              {t('diagnose.issues')}
            </Text>
            <View style={{ gap: spacing[2] }}>
              {resultJson.issues.map((issue, i) => {
                const prob = issue.probability ?? 0;
                const issueColor =
                  prob > 0.5 ? (isDark ? palette.signature400 : palette.signature500) :
                  prob > 0.25 ? (isDark ? '#93c5fd' : palette.primary500) :
                  (isDark ? palette.neutral400 : palette.neutral500);

                return (
                  <View
                    key={issue.description}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: radii.card,
                      padding: spacing[3],
                      borderCurve: 'continuous',
                      borderWidth: 1,
                      borderColor,
                    }}
                  >
                    <Text selectable style={{ fontSize: 14, color: isDark ? palette.neutral200 : palette.neutral700, lineHeight: 20 }}>
                      {issue.description}
                    </Text>
                    {issue.probability != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] }}>
                        <View style={{ flex: 1, height: 4, backgroundColor: trackBg, borderRadius: 2, overflow: 'hidden' }}>
                          <View
                            style={{
                              height: '100%',
                              borderRadius: 2,
                              width: `${prob * 100}%`,
                              backgroundColor: issueColor,
                            }}
                          />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: issueColor, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                          {Math.round(prob * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Tools Needed */}
        {resultJson?.toolsNeeded && resultJson.toolsNeeded.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ paddingHorizontal: spacing[5], marginTop: spacing[1] }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary, marginBottom: spacing[2] }}>
              {t('diagnose.toolsNeeded')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {resultJson.toolsNeeded.map((tool) => (
                <View
                  key={tool}
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: radii.button,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <Wrench size={12} color={textSecondary} strokeWidth={2} />
                  <Text style={{ fontSize: 13, color: isDark ? palette.neutral300 : palette.neutral700 }}>
                    {tool}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Difficulty */}
        {diffConfig && (
          <Animated.View entering={FadeInUp.delay(250).duration(400)} style={{ paddingHorizontal: spacing[5], marginTop: spacing[1] }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2] }}>
              {t('diagnose.difficulty')}
            </Text>
            <View
              style={{
                borderRadius: radii.button,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                alignSelf: 'flex-start',
                backgroundColor: `${isDark ? diffConfig.dark : diffConfig.light}18`,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: `${isDark ? diffConfig.dark : diffConfig.light}25`,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? diffConfig.dark : diffConfig.light }}>
                {diffConfig.label}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Next Steps */}
        {resultJson?.nextSteps && resultJson.nextSteps.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ paddingHorizontal: spacing[5], marginTop: spacing[1] }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary, marginBottom: spacing[2] }}>
              {t('diagnose.nextSteps')}
            </Text>
            <View style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: spacing[4],
              gap: spacing[3],
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor,
            }}>
              {resultJson.nextSteps.map((step: string, stepIndex: number) => (
                <View key={step} style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: isDark ? `${palette.primary400}20` : `${palette.primary500}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? palette.primary300 : palette.primary600 }}>
                      {stepIndex + 1}
                    </Text>
                  </View>
                  <Text selectable style={{ fontSize: 14, color: isDark ? palette.neutral300 : palette.neutral700, flex: 1, lineHeight: 20 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Related Article */}
        {diagnostic.relatedArticleId && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={{ paddingHorizontal: spacing[5] }}>
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.push(`/(tabs)/(learn)/article/${diagnostic.relatedArticleId}` as `/${string}`);
              }}
              style={{
                backgroundColor: isDark ? `${palette.primary500}15` : palette.primary50,
                borderRadius: 16,
                padding: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: isDark ? `${palette.primary500}20` : `${palette.primary500}12`,
              }}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${palette.primary500}18`,
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}>
                <BookOpen size={16} color={isDark ? palette.primary300 : palette.primary600} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? palette.primary300 : palette.primary700, flex: 1 }}>
                {t('diagnose.findArticle')}
              </Text>
              <ArrowRight size={16} color={isDark ? palette.primary400 : palette.primary500} strokeWidth={2} />
            </Pressable>
          </Animated.View>
        )}

        {/* Disclaimer */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={{ paddingHorizontal: spacing[5], marginTop: spacing[1] }}>
          <View
            style={{
              backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
              borderRadius: 16,
              padding: spacing[4],
              flexDirection: 'row',
              gap: spacing[3],
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.15)',
            }}
          >
            <AlertTriangle size={16} color={isDark ? '#fbbf24' : palette.warning500} strokeWidth={2} style={{ marginTop: 1 }} />
            <Text selectable style={{ fontSize: 12, color: isDark ? '#fde68a' : '#92400e', flex: 1, lineHeight: 17 }}>
              {t('diagnose.disclaimer')}
            </Text>
          </View>
        </Animated.View>

        {/* Timestamp */}
        <Animated.View entering={FadeInUp.delay(450).duration(400)} style={{ paddingHorizontal: spacing[5] }}>
          <Text style={{ fontSize: 12, color: textTertiary, textAlign: 'center' }}>
            {new Date(diagnostic.createdAt).toLocaleString()}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
