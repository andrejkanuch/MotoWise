import { palette, radii, spacing } from '@motovault/design-system';
import {
  ExpensesByMotorcycleDocument,
  GenerateBikeHealthReportDocument,
  GetMyHealthReportsDocument,
  type GetMyHealthReportsQuery,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  Bike,
  CheckCircle,
  ClipboardList,
  FileText,
  RefreshCw,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HealthReportCard } from '../../../components/garage/HealthReportCard';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { presentPaywall } from '../../../lib/subscription';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

const MIN_RECORDS_REQUIRED = 3;

type HealthReport = GetMyHealthReportsQuery['getMyHealthReports'][number];

export default function HealthReportScreen() {
  const { t } = useTranslation();
  const { bikeId } = useLocalSearchParams<{ bikeId: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (bikeId) {
      trackEvent(AnalyticsEvent.HEALTH_REPORT_VIEWED, { bike_id: bikeId });
    }
  }, [bikeId]);

  // Fetch bike info
  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bike = motorcyclesData?.myMotorcycles?.find((m) => m.id === bikeId);
  const bikeName = bike ? `${bike.year} ${bike.make} ${bike.model}` : '';

  // Fetch maintenance tasks to check minimum records
  const { data: tasksData } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(bikeId ?? ''),
    queryFn: () =>
      gqlFetcher(MaintenanceTasksByMotorcycleDocument, {
        motorcycleId: bikeId ?? '',
      }),
    enabled: !!bikeId,
  });

  // Fetch expenses to check minimum records
  const { data: expensesData } = useQuery({
    queryKey: queryKeys.expenses.byMotorcycle(bikeId ?? ''),
    queryFn: () =>
      gqlFetcher(ExpensesByMotorcycleDocument, {
        motorcycleId: bikeId ?? '',
        year: new Date().getFullYear(),
      }),
    enabled: !!bikeId,
  });

  const maintenanceCount = tasksData?.maintenanceTasks?.length ?? 0;
  const expenseCategories =
    (expensesData as { expenses?: { categories?: { expenses?: unknown[] }[] } })?.expenses
      ?.categories ?? [];
  const expenseCount = expenseCategories.reduce((sum, cat) => sum + (cat.expenses?.length ?? 0), 0);
  const hasEnoughData =
    maintenanceCount >= MIN_RECORDS_REQUIRED || expenseCount >= MIN_RECORDS_REQUIRED;

  // Fetch existing reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: queryKeys.healthReports.byMotorcycle(bikeId ?? ''),
    queryFn: () => gqlFetcher(GetMyHealthReportsDocument),
    enabled: !!bikeId,
    refetchInterval: (query) => {
      const reports = query.state.data?.getMyHealthReports ?? [];
      const hasPending = reports.some((r) => r.status === 'pending');
      return hasPending ? 3000 : false;
    },
  });

  const bikeReports = useMemo(() => {
    const allReports = reportsData?.getMyHealthReports ?? [];
    return allReports
      .filter((r) => r.motorcycleId === bikeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reportsData, bikeId]);

  const latestReport = bikeReports[0] as HealthReport | undefined;
  const isGenerating = generating || latestReport?.status === 'pending';

  // Generate report mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(GenerateBikeHealthReportDocument, {
        input: { bikeId: bikeId ?? '' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.healthReports.byMotorcycle(bikeId ?? ''),
      });
      setGenerating(false);
    },
    onError: () => {
      setGenerating(false);
    },
  });

  const handleGenerate = async () => {
    if (!bikeId || isGenerating) return;
    triggerImpact();

    // Purchase flow
    const result = await presentPaywall({
      offeringIdentifier: 'health_report',
    });

    if (result === 'purchased' || result === 'restored') {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      setGenerating(true);
      generateMutation.mutate();
    }
  };

  const handleRetry = () => {
    triggerImpact();
    setGenerating(true);
    generateMutation.mutate();
  };

  // Theme colors
  const bg = isDark ? palette.surfaceDark : palette.white;
  const cardBg = isDark ? palette.cardDark : palette.neutral50;
  const textPrimary = isDark ? palette.neutral50 : palette.neutral950;
  const textSecondary = isDark ? palette.neutral400 : palette.neutral500;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  if (reportsLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          gap: spacing[4],
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Bike Info Header */}
        {bike && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}
          >
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 16,
                padding: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark ? `${palette.primary400}18` : `${palette.primary500}12`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderCurve: 'continuous',
                }}
              >
                <Bike
                  size={20}
                  color={isDark ? palette.primary300 : palette.primary600}
                  strokeWidth={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                {bike.nickname && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: palette.primary500,
                      marginBottom: 1,
                    }}
                  >
                    &ldquo;{bike.nickname}&rdquo;
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: textPrimary,
                  }}
                >
                  {bikeName}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Generate Button or Status */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={{ paddingHorizontal: spacing[5] }}
        >
          {isGenerating ? (
            /* Generating state */
            <View
              style={{
                backgroundColor: isDark ? `${palette.primary500}15` : palette.primary50,
                borderRadius: 16,
                padding: spacing[5],
                alignItems: 'center',
                gap: spacing[3],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: isDark ? `${palette.primary500}20` : `${palette.primary500}12`,
              }}
            >
              <ActivityIndicator size="small" color={palette.primary500} />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isDark ? palette.primary300 : palette.primary700,
                  textAlign: 'center',
                }}
              >
                {t('healthReport.generating')}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: textSecondary,
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                {t('healthReport.generatingSubtitle')}
              </Text>
            </View>
          ) : latestReport?.status === 'completed' ? (
            /* Completed — show download */
            <View
              style={{
                backgroundColor: isDark ? palette.successBgDark : palette.successBgLight,
                borderRadius: 16,
                padding: spacing[5],
                alignItems: 'center',
                gap: spacing[3],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)',
              }}
            >
              <CheckCircle
                size={32}
                color={isDark ? '#4ade80' : palette.success500}
                strokeWidth={2}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: isDark ? '#4ade80' : '#166534',
                  textAlign: 'center',
                }}
              >
                {t('healthReport.readyTitle')}
              </Text>
              {latestReport.pdfUrl && (
                <Pressable
                  onPress={async () => {
                    triggerImpact();
                    if (latestReport.pdfUrl) {
                      await Linking.openURL(latestReport.pdfUrl);
                    }
                  }}
                  style={{
                    backgroundColor: palette.primary500,
                    borderRadius: radii.card,
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[3],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                    borderCurve: 'continuous',
                  }}
                >
                  <FileText size={16} color={palette.white} strokeWidth={2} />
                  <Text
                    style={{
                      color: palette.white,
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    {t('healthReport.downloadReport')}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : latestReport?.status === 'failed' ? (
            /* Failed — retry option */
            <View
              style={{
                backgroundColor: isDark ? palette.dangerBgDark : palette.dangerBgLight,
                borderRadius: 16,
                padding: spacing[5],
                alignItems: 'center',
                gap: spacing[3],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)',
              }}
            >
              <AlertTriangle
                size={32}
                color={isDark ? '#fca5a5' : palette.danger500}
                strokeWidth={2}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isDark ? '#fca5a5' : '#991b1b',
                  textAlign: 'center',
                }}
              >
                {t('healthReport.failedMessage')}
              </Text>
              <Pressable
                onPress={handleRetry}
                style={{
                  backgroundColor: palette.primary500,
                  borderRadius: radii.card,
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  borderCurve: 'continuous',
                }}
              >
                <RefreshCw size={16} color={palette.white} strokeWidth={2} />
                <Text
                  style={{
                    color: palette.white,
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  {t('common.retry')}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Default — generate button */
            <View style={{ gap: spacing[3] }}>
              <Pressable
                onPress={handleGenerate}
                disabled={!hasEnoughData}
                style={({ pressed }) => ({
                  backgroundColor: hasEnoughData
                    ? palette.primary500
                    : isDark
                      ? palette.neutral700
                      : palette.neutral200,
                  borderRadius: 16,
                  padding: spacing[4],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[2],
                  borderCurve: 'continuous',
                  opacity: pressed && hasEnoughData ? 0.9 : 1,
                  transform: [{ scale: pressed && hasEnoughData ? 0.98 : 1 }],
                })}
              >
                <ClipboardList
                  size={18}
                  color={
                    hasEnoughData ? palette.white : isDark ? palette.neutral500 : palette.neutral400
                  }
                  strokeWidth={2}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: hasEnoughData
                      ? palette.white
                      : isDark
                        ? palette.neutral500
                        : palette.neutral400,
                  }}
                >
                  {t('healthReport.generateButton')}
                </Text>
              </Pressable>

              {/* Disabled tooltip */}
              {!hasEnoughData && (
                <View
                  style={{
                    backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
                    borderRadius: radii.card,
                    padding: spacing[3],
                    flexDirection: 'row',
                    gap: spacing[2],
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.15)',
                  }}
                >
                  <AlertTriangle
                    size={14}
                    color={isDark ? '#fbbf24' : palette.warning500}
                    strokeWidth={2}
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? '#fde68a' : '#92400e',
                      flex: 1,
                      lineHeight: 17,
                    }}
                  >
                    {t('healthReport.insufficientData')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Description */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(400)}
          style={{ paddingHorizontal: spacing[5] }}
        >
          <Text
            style={{
              fontSize: 13,
              color: textSecondary,
              lineHeight: 19,
              textAlign: 'center',
            }}
          >
            {t('healthReport.description')}
          </Text>
        </Animated.View>

        {/* Past Reports */}
        {bikeReports.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={{ paddingHorizontal: spacing[5] }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: textPrimary,
                marginBottom: spacing[3],
              }}
            >
              {t('healthReport.pastReports')}
            </Text>
            <View style={{ gap: spacing[2] }}>
              {bikeReports.map((report, idx) => (
                <HealthReportCard
                  key={report.id}
                  id={report.id}
                  status={report.status}
                  pdfUrl={report.pdfUrl}
                  createdAt={report.createdAt}
                  index={idx}
                  onRetry={handleRetry}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
