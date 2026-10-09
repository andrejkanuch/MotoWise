import {
  MyDiagnosticsDocument,
  type MyDiagnosticsQuery,
  MyMotorcyclesDocument,
  type MyMotorcyclesQuery,
} from '@motovault/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChevronRight,
  Disc,
  Droplets,
  ScanLine,
  ShieldAlert,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DIAGNOSTIC_STATUS,
  formatDiagnosisDate,
  isStuckProcessing,
} from '../../../components/diagnosis/diagnostic-status';
import { SeverityChip, useSeverityLabel } from '../../../components/diagnosis/severity-chip';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, radius, readableWidth, space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';

type Diagnostic = MyDiagnosticsQuery['myDiagnostics'][number];
type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

const RECENT_LIMIT = 5;
const ROW_MIN_HEIGHT = 60;
const CTA_HEIGHT = 52;

const CAPABILITIES = [
  { icon: Wrench, labelKey: 'diagnose.capEngine' },
  { icon: Zap, labelKey: 'diagnose.capElectrical' },
  { icon: Disc, labelKey: 'diagnose.capBrakes' },
  { icon: Droplets, labelKey: 'diagnose.capFluids' },
  { icon: AlertTriangle, labelKey: 'diagnose.capWarnings' },
  { icon: ShieldAlert, labelKey: 'diagnose.capTires' },
] as const;

export default function DiagnoseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);

  const onRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: queryKeys.diagnostics.all,
          refetchType: 'active',
        }),
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

  const { data } = useQuery({
    queryKey: queryKeys.diagnostics.all,
    queryFn: () => gqlFetcher(MyDiagnosticsDocument),
  });
  const diagnostics = (data?.myDiagnostics ?? []).filter((d) => {
    if (d.status === DIAGNOSTIC_STATUS.FAILED) return false;
    // Hide stuck diagnostics (processing > 2 min)
    if (d.status === DIAGNOSTIC_STATUS.PROCESSING) return !isStuckProcessing(d.createdAt);
    return true;
  });

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesData?.myMotorcycles ?? [];

  useEffect(() => {
    trackEvent(AnalyticsEvent.DIAGNOSTIC_LIST_VIEWED);
  }, []);

  const handleNewDiagnostic = () => {
    triggerImpact();
    router.push('/(diagnose)/new');
  };

  const recent = diagnostics.slice(0, RECENT_LIMIT);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          ...readableWidth,
          paddingTop: insets.top + space.xs,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: GUTTER,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.ink3}
            colors={[theme.warm]}
          />
        }
      >
        <Text accessibilityRole="header" style={[type.largeTitle, { color: theme.ink }]}>
          {t('tabs.diagnose')}
        </Text>
        <Text style={[type.subhead, { color: theme.ink2, marginTop: space.xxs }]}>
          {t('diagnose.headerSubhead')}
        </Text>

        <Pressable
          onPress={handleNewDiagnostic}
          accessibilityRole="button"
          accessibilityLabel={t('diagnose.startCta')}
          android_ripple={{ color: theme.onPlate, foreground: true }}
          style={({ pressed }) => ({
            marginTop: space.lg,
            minHeight: CTA_HEIGHT,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: theme.warm,
            opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.xs,
            paddingHorizontal: space.md,
          })}
        >
          <ScanLine size={20} color={theme.onWarm} strokeWidth={2} />
          <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('diagnose.startCta')}</Text>
        </Pressable>

        {recent.length === 0 ? (
          <View style={{ marginTop: space.xxl }}>
            <Text style={[type.body, { color: theme.ink2 }]}>{t('diagnose.emptyExplainer')}</Text>

            <Text
              accessibilityRole="header"
              style={[
                type.sectionTitle,
                { color: theme.ink, marginTop: space.xl, marginBottom: space.xs },
              ]}
            >
              {t('diagnose.capTitle')}
            </Text>
            <InsetGroup>
              {CAPABILITIES.map(({ icon: Icon, labelKey }, index) => (
                <Fragment key={labelKey}>
                  {index > 0 && <RowSeparator inset={space.md + 20 + space.sm} />}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      minHeight: 48,
                      paddingHorizontal: space.md,
                      paddingVertical: space.sm,
                    }}
                  >
                    <Icon size={20} color={theme.ink3} strokeWidth={1.75} />
                    <Text style={[type.body, { color: theme.ink, flex: 1 }]}>{t(labelKey)}</Text>
                  </View>
                </Fragment>
              ))}
            </InsetGroup>
          </View>
        ) : (
          <View style={{ marginTop: space.xxl }}>
            <Text
              accessibilityRole="header"
              style={[type.sectionTitle, { color: theme.ink, marginBottom: space.xs }]}
            >
              {t('diagnose.recent')}
            </Text>
            <InsetGroup>
              {recent.map((diag, index) => (
                <Animated.View key={diag.id} entering={FadeInUp.delay(index * 50).duration(250)}>
                  {index > 0 && <RowSeparator inset={space.md} />}
                  <DiagnosisRow
                    diagnostic={diag}
                    bike={motorcycles.find((m) => m.id === diag.motorcycleId)}
                    onPress={() => router.push(`/(diagnose)/${diag.id}`)}
                  />
                </Animated.View>
              ))}
            </InsetGroup>
          </View>
        )}
      </ScrollView>
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

function RowSeparator({ inset }: { inset: number }) {
  const { t: theme } = useEditorialTheme();
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: theme.line }} />;
}

function DiagnosisRow({
  diagnostic,
  bike,
  onPress,
}: {
  diagnostic: Diagnostic;
  bike: Motorcycle | undefined;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const isProcessing = diagnostic.status === DIAGNOSTIC_STATUS.PROCESSING;
  const severityLabel = useSeverityLabel(diagnostic.severity);
  const chipLabel = isProcessing ? t('diagnose.statusAnalyzing') : undefined;

  const title = bike ? `${bike.make} ${bike.model}` : t('diagnose.untitledDiagnosis');
  const date = formatDiagnosisDate(diagnostic.createdAt, i18n.language);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${date}, ${chipLabel ?? t('diagnose.severityA11y', { level: severityLabel })}`}
      android_ripple={{ color: theme.line }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: ROW_MIN_HEIGHT,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        backgroundColor: pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : 'transparent',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.caption, { color: theme.ink3, marginTop: 2 }]}>{date}</Text>
      </View>
      <SeverityChip severity={diagnostic.severity} label={chipLabel} />
      <ChevronRight size={18} color={theme.ink4} strokeWidth={2} />
    </Pressable>
  );
}
