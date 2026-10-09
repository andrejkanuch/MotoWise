import { DiagnosticByIdDocument, MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  HardHat,
  type LucideIcon,
  RefreshCw,
  Share2,
  Wrench,
} from 'lucide-react-native';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DIAGNOSTIC_STATUS,
  isStuckProcessing,
  PROCESSING_POLL_MS,
} from '../../../components/diagnosis/diagnostic-status';
import {
  SEVERITY_CHIP_SIZE,
  SeverityChip,
  URGENT_SEVERITIES,
} from '../../../components/diagnosis/severity-chip';
import { gqlFetcher } from '../../../lib/graphql-client';
import { exportDiagnosticReport } from '../../../lib/pdf-export';
import { queryKeys } from '../../../lib/query-keys';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, radius, space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';

const DIFFICULTY_LABEL_KEY = {
  easy: 'diagnose.difficultyLevel.easy',
  moderate: 'diagnose.difficultyLevel.moderate',
  hard: 'diagnose.difficultyLevel.hard',
  professional: 'diagnose.difficultyLevel.professional',
} as const;
type Difficulty = keyof typeof DIFFICULTY_LABEL_KEY;

function isDifficulty(value: string | undefined): value is Difficulty {
  return value != null && value in DIFFICULTY_LABEL_KEY;
}

const METER_HEIGHT = 4;
const ICON_SIZE = 20;
const ROW_MIN_HEIGHT = 52;

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

const toPercent = (fraction: number) => Math.round(fraction * 100);

export default function DiagnosticResultScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.detail(id ?? ''),
    queryFn: () => gqlFetcher(DiagnosticByIdDocument, { id: id ?? '' }),
    enabled: !!id,
    refetchInterval: (query) => {
      const diag = query.state.data?.diagnosticById;
      if (diag?.status !== DIAGNOSTIC_STATUS.PROCESSING) return false;
      // Stop polling if processing for more than 2 minutes (stuck)
      return isStuckProcessing(diag.createdAt) ? false : PROCESSING_POLL_MS;
    },
  });

  const diagnostic = data?.diagnosticById;
  const resultJson = (diagnostic?.resultJson ?? null) as DiagnosticResult | null;

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bike = motorcyclesData?.myMotorcycles?.find((m) => m.id === diagnostic?.motorcycleId);
  const bikeName = bike ? `${bike.year} ${bike.make} ${bike.model}` : t('diagnoseV2.reviewBike');

  const handleShareReport = async () => {
    if (diagnostic?.status !== DIAGNOSTIC_STATUS.COMPLETED) return;
    triggerImpact();
    try {
      await exportDiagnosticReport(
        {
          severity: diagnostic.severity,
          confidence: diagnostic.confidence,
          description: diagnostic.description,
          createdAt: diagnostic.createdAt,
          resultJson,
        },
        bikeName,
      );
    } catch (_e) {
      // User cancelled the share sheet — no action needed
    }
  };

  const startNew = () => router.push('/(diagnose)/new');

  if (isLoading) {
    return <ProcessingState label={t('diagnose.processing')} />;
  }

  if (error || !diagnostic) {
    return <FailedState onRetry={() => refetch()} />;
  }

  if (diagnostic.status === DIAGNOSTIC_STATUS.PROCESSING) {
    // If processing for more than 2 minutes, it's stuck — show failed state
    if (isStuckProcessing(diagnostic.createdAt)) return <FailedState onRetry={startNew} />;
    return <ProcessingState label={t('diagnose.processing')} />;
  }

  if (diagnostic.status === DIAGNOSTIC_STATUS.FAILED) {
    return <FailedState onRetry={startNew} />;
  }

  const confidence = diagnostic.confidence ?? 0;
  const isUrgent = diagnostic.severity != null && URGENT_SEVERITIES.has(diagnostic.severity);
  const difficulty = isDifficulty(resultJson?.difficulty) ? resultJson.difficulty : null;
  const issues = resultJson?.issues ?? [];
  const tools = resultJson?.toolsNeeded ?? [];
  const nextSteps = resultJson?.nextSteps ?? [];
  const timestamp = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parseISO(diagnostic.createdAt));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.md,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + space.xl,
          gap: space.xl,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Severity + part */}
        <Animated.View entering={FadeIn.duration(250)}>
          <SeverityChip severity={diagnostic.severity} size={SEVERITY_CHIP_SIZE.REGULAR} />
          {resultJson?.part ? (
            <Text
              selectable
              accessibilityRole="header"
              style={[type.sheetTitle, { color: theme.ink, marginTop: space.sm }]}
            >
              {resultJson.part}
            </Text>
          ) : null}
          {resultJson?.description ? (
            <Text selectable style={[type.body, { color: theme.ink2, marginTop: space.xs }]}>
              {resultJson.description}
            </Text>
          ) : null}
        </Animated.View>

        {/* Consult a mechanic — high/critical */}
        {isUrgent && (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.danger, 0.12),
            }}
          >
            <HardHat size={ICON_SIZE} color={theme.danger} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: theme.ink }]}>
                {t('diagnose.consultMechanic')}
              </Text>
              <Text style={[type.subhead, { color: theme.ink2, marginTop: 2 }]}>
                {t('diagnose.consultMechanicSubtitle')}
              </Text>
            </View>
          </View>
        )}

        {/* Confidence */}
        <Section title={t('diagnose.confidence')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={[type.figure, { color: theme.ink }]}>{toPercent(confidence)}%</Text>
            <Meter fraction={confidence} />
          </View>
        </Section>

        {/* Issues found */}
        {issues.length > 0 && (
          <Section title={t('diagnose.issues')}>
            <InsetGroup>
              {issues.map((issue, index) => (
                <Fragment key={issue.description}>
                  {index > 0 && <RowSeparator />}
                  <View style={{ padding: space.md, gap: space.xs }}>
                    <Text selectable style={[type.body, { color: theme.ink }]}>
                      {issue.description}
                    </Text>
                    {issue.probability != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <Meter fraction={issue.probability} />
                        <Text
                          style={[
                            type.figureSmall,
                            { color: theme.ink2, minWidth: 44, textAlign: 'right' },
                          ]}
                        >
                          {toPercent(issue.probability)}%
                        </Text>
                      </View>
                    )}
                  </View>
                </Fragment>
              ))}
            </InsetGroup>
          </Section>
        )}

        {/* Tools needed */}
        {tools.length > 0 && (
          <Section title={t('diagnose.toolsNeeded')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {tools.map((tool) => (
                <View
                  key={tool}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.xs - 2,
                    paddingHorizontal: space.sm,
                    paddingVertical: space.xs,
                    borderRadius: radius.chip,
                    borderCurve: 'continuous',
                    backgroundColor: theme.surface2,
                  }}
                >
                  <Wrench size={14} color={theme.ink3} strokeWidth={2} />
                  <Text style={[type.label, { color: theme.ink }]}>{tool}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Difficulty */}
        {difficulty && (
          <Section title={t('diagnose.difficulty')}>
            <Text style={[type.body, { color: theme.ink }]}>
              {t(DIFFICULTY_LABEL_KEY[difficulty])}
            </Text>
          </Section>
        )}

        {/* Next steps */}
        {nextSteps.length > 0 && (
          <Section title={t('diagnose.nextSteps')}>
            <InsetGroup>
              {nextSteps.map((step, stepIndex) => (
                <Fragment key={step}>
                  {stepIndex > 0 && <RowSeparator />}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: space.sm,
                      padding: space.md,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Text style={[type.figureSmall, { color: theme.ink3, minWidth: 16 }]}>
                      {stepIndex + 1}
                    </Text>
                    <Text selectable style={[type.body, { color: theme.ink, flex: 1 }]}>
                      {step}
                    </Text>
                  </View>
                </Fragment>
              ))}
            </InsetGroup>
          </Section>
        )}

        {/* Actions */}
        <InsetGroup>
          {diagnostic.relatedArticleId && (
            <>
              <ActionRow
                icon={BookOpen}
                label={t('diagnose.findArticle')}
                onPress={() => {
                  triggerImpact();
                  router.push(
                    `/(tabs)/(learn)/article/${diagnostic.relatedArticleId}` as `/${string}`,
                  );
                }}
              />
              <RowSeparator />
            </>
          )}
          <ActionRow
            icon={Share2}
            label={t('diagnose.shareReport', { defaultValue: 'Share Diagnostic Report' })}
            onPress={handleShareReport}
          />
        </InsetGroup>

        {/* Disclaimer + timestamp */}
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <AlertTriangle size={14} color={theme.ink3} strokeWidth={2} style={{ marginTop: 1 }} />
            <Text selectable style={[type.caption, { color: theme.ink3, flex: 1 }]}>
              {t('diagnose.disclaimer')}
            </Text>
          </View>
          <Text style={[type.caption, { color: theme.ink4 }]}>{timestamp}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function InsetGroup({ children }: { children: ReactNode }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function RowSeparator() {
  const { t: theme } = useEditorialTheme();
  return <View style={{ height: 1, marginLeft: space.md, backgroundColor: theme.line }} />;
}

/** A thin neutral meter — certainty is information, not a verdict, so it stays uncoloured. */
function Meter({ fraction }: { fraction: number }) {
  const { t: theme } = useEditorialTheme();
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return (
    <View
      style={{
        flex: 1,
        height: METER_HEIGHT,
        borderRadius: radius.pill,
        backgroundColor: theme.surface3,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: theme.ink2,
        }}
      />
    </View>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { t: theme } = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: theme.line }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: ROW_MIN_HEIGHT,
        paddingHorizontal: space.md,
        backgroundColor: pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : 'transparent',
      })}
    >
      <Icon size={ICON_SIZE} color={theme.warm} strokeWidth={2} />
      <Text style={[type.body, { color: theme.ink, flex: 1 }]}>{label}</Text>
      <ChevronRight size={18} color={theme.ink4} strokeWidth={2} />
    </Pressable>
  );
}

function ProcessingState({ label }: { label: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
        gap: space.md,
      }}
    >
      <ActivityIndicator size="large" color={theme.ink3} />
      <Text style={[type.bodyStrong, { color: theme.ink, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function FailedState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
        gap: space.md,
      }}
    >
      <AlertTriangle size={36} color={theme.danger} strokeWidth={1.75} />
      <Text style={[type.body, { color: theme.ink2, textAlign: 'center' }]}>
        {t('diagnose.failed')}
      </Text>
      <Pressable
        onPress={() => {
          triggerImpact();
          onRetry();
        }}
        accessibilityRole="button"
        android_ripple={{ color: theme.onPlate, foreground: true }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          minHeight: 48,
          paddingHorizontal: space.xl,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: theme.warm,
          opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
        })}
      >
        <RefreshCw size={16} color={theme.onWarm} strokeWidth={2} />
        <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('diagnose.retry')}</Text>
      </Pressable>
    </View>
  );
}
