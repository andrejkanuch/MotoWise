import { palette } from '@motovault/design-system';
import {
  ExpensesByMotorcycleDocument,
  GenerateBikeHealthReportDocument,
  GetMyHealthReportsDocument,
  type GetMyHealthReportsQuery,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  HeartPulse,
  RefreshCw,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../../lib/store-review';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';

const MIN_RECORDS_REQUIRED = 3;

type HealthReport = GetMyHealthReportsQuery['getMyHealthReports'][number];

export default function HealthReportScreen() {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  const { bikeId } = useLocalSearchParams<{ bikeId: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (bikeId) {
      trackEvent(AnalyticsEvent.HEALTH_REPORT_VIEWED, { bike_id: bikeId });
    }
  }, [bikeId]);

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bike = motorcyclesData?.myMotorcycles?.find((m) => m.id === bikeId);
  const bikeName = bike ? `${bike.year} ${bike.make} ${bike.model}` : '';

  const { data: tasksData } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(bikeId ?? ''),
    queryFn: () =>
      gqlFetcher(MaintenanceTasksByMotorcycleDocument, {
        motorcycleId: bikeId ?? '',
      }),
    enabled: !!bikeId,
  });

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
      maybeRequestReview(REVIEW_MILESTONE.HEALTH_REPORT_VIEWED);
    },
    onError: () => {
      setGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!bikeId || isGenerating) return;
    triggerImpact();
    trackEvent(AnalyticsEvent.HEALTH_REPORT_GENERATED, { bike_id: bikeId });
    setGenerating(true);
    generateMutation.mutate();
  };

  const handleRetry = () => {
    if (!bikeId) return;
    triggerImpact();
    trackEvent(AnalyticsEvent.HEALTH_REPORT_RETRIED, { bike_id: bikeId });
    setGenerating(true);
    generateMutation.mutate();
  };

  if (reportsLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={t.warm} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Bike header */}
        {bike && (
          <Animated.View
            entering={FadeIn.duration(280)}
            style={{ paddingHorizontal: 20, paddingTop: 16 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                backgroundColor: t.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: tint(t.warm, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HeartPulse size={20} color={t.warm} />
              </View>
              <View style={{ flex: 1 }}>
                {bike.nickname ? (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: t.warm, marginBottom: 1 }}>
                    {bike.nickname}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink }}>{bikeName}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Status / action card */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(280)}
          style={{ paddingHorizontal: 20, marginTop: 16 }}
        >
          {isGenerating ? (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                gap: 10,
                backgroundColor: t.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              <ActivityIndicator size="small" color={t.warm} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: t.ink, textAlign: 'center' }}>
                {i18n('healthReport.generating')}
              </Text>
              <Text style={{ fontSize: 13, color: t.ink3, textAlign: 'center', lineHeight: 18 }}>
                {i18n('healthReport.generatingSubtitle')}
              </Text>
            </View>
          ) : latestReport?.status === 'completed' ? (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                gap: 12,
                backgroundColor: t.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: tint(t.success, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle size={24} color={t.success} strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Regular',
                  fontSize: 22,
                  color: t.ink,
                  textAlign: 'center',
                }}
              >
                {i18n('healthReport.readyTitle')}
              </Text>
              {latestReport.pdfUrl && (
                <Pressable
                  onPress={async () => {
                    triggerImpact();
                    trackEvent(AnalyticsEvent.HEALTH_REPORT_DOWNLOADED, { bike_id: bikeId });
                    if (latestReport.pdfUrl) {
                      await Linking.openURL(latestReport.pdfUrl);
                    }
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: t.warm,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Download size={16} color={palette.white} strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                    {i18n('healthReport.downloadReport')}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : latestReport?.status === 'failed' ? (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                gap: 12,
                backgroundColor: t.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: tint(t.danger, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={24} color={t.danger} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 14, color: t.ink3, textAlign: 'center', lineHeight: 20 }}>
                {i18n('healthReport.failedMessage')}
              </Text>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => ({
                  backgroundColor: t.warm,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <RefreshCw size={16} color={palette.white} strokeWidth={2} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                  {i18n('common.retry', { defaultValue: 'Retry' })}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={handleGenerate}
                disabled={!hasEnoughData}
                style={({ pressed }) => ({
                  backgroundColor: hasEnoughData ? t.warm : t.surface2,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: !hasEnoughData ? 0.5 : 1,
                  transform: [{ scale: pressed && hasEnoughData ? 0.97 : 1 }],
                })}
              >
                <HeartPulse
                  size={18}
                  color={hasEnoughData ? palette.white : t.ink3}
                  strokeWidth={2}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: hasEnoughData ? palette.white : t.ink3,
                  }}
                >
                  {i18n('healthReport.generateButton')}
                </Text>
              </Pressable>

              {!hasEnoughData && (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    padding: 12,
                    backgroundColor: t.surface,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: t.line,
                  }}
                >
                  <AlertTriangle
                    size={14}
                    color={t.warm}
                    strokeWidth={2}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ fontSize: 12, color: t.ink3, flex: 1, lineHeight: 17 }}>
                    {i18n('healthReport.insufficientData')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Description */}
        <Animated.View
          entering={FadeInUp.delay(120).duration(280)}
          style={{ paddingHorizontal: 20, marginTop: 14 }}
        >
          <Text style={{ fontSize: 13, color: t.ink3, lineHeight: 19, textAlign: 'center' }}>
            {i18n('healthReport.description')}
          </Text>
        </Animated.View>

        {/* Past reports */}
        {bikeReports.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(160).duration(280)}
            style={{ paddingHorizontal: 20, marginTop: 20 }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: t.ink2,
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: 2.2,
              }}
            >
              {i18n('healthReport.pastReports')}
            </Text>
            <View style={{ gap: 8 }}>
              {bikeReports.map((report, idx) => (
                <ReportRow key={report.id} report={report} index={idx} onRetry={handleRetry} />
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function ReportRow({
  report,
  index,
  onRetry,
}: {
  report: HealthReport;
  index: number;
  onRetry: () => void;
}) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();

  const dateStr = new Date(report.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statusLabel =
    report.status === 'completed'
      ? i18n('healthReport.statusCompleted')
      : report.status === 'pending'
        ? i18n('healthReport.statusPending')
        : i18n('healthReport.statusFailed');

  const statusColor =
    report.status === 'completed' ? t.success : report.status === 'pending' ? t.warm : t.danger;

  const StatusIcon =
    report.status === 'completed'
      ? CheckCircle
      : report.status === 'pending'
        ? Clock
        : AlertTriangle;

  const handlePress = async () => {
    if (report.status === 'completed' && report.pdfUrl) {
      triggerImpact();
      await Linking.openURL(report.pdfUrl);
    } else if (report.status === 'failed') {
      triggerImpact();
      onRetry();
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(200)}>
      <Pressable
        onPress={handlePress}
        disabled={report.status === 'pending'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          backgroundColor: t.surface,
          borderRadius: 14,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: t.line,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: tint(statusColor, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <StatusIcon size={18} color={statusColor} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>{statusLabel}</Text>
          <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{dateStr}</Text>
        </View>
        {report.status === 'completed' && report.pdfUrl && (
          <Download size={16} color={t.ink3} strokeWidth={2} />
        )}
        {report.status === 'failed' && <RefreshCw size={14} color={t.ink3} strokeWidth={2} />}
      </Pressable>
    </Animated.View>
  );
}
