import { palette } from '@motovault/design-system';
import { MyDiagnosticsDocument, MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Clock,
  Crown,
  Disc,
  Droplets,
  ScanLine,
  ShieldAlert,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProGateModal } from '../../../components/ProGateModal';
import { useProGate } from '../../../hooks/useProGate';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const SEVERITY_COLORS = {
  critical: {
    bg: palette.dangerBgLight,
    bgDark: palette.dangerBgDark,
    icon: palette.danger500,
    iconDark: '#fca5a5',
    label: 'Critical',
  },
  high: {
    bg: palette.signatureBgLight,
    bgDark: palette.signatureBgDark,
    icon: palette.signature500,
    iconDark: palette.signature400,
    label: 'High',
  },
  warning: {
    bg: palette.warningBgLight,
    bgDark: palette.warningBgDark,
    icon: palette.warning500,
    iconDark: '#fbbf24',
    label: 'Warning',
  },
  medium: {
    bg: palette.warningBgLight,
    bgDark: palette.warningBgDark,
    icon: palette.warning500,
    iconDark: '#fbbf24',
    label: 'Medium',
  },
  low: {
    bg: palette.successBgLight,
    bgDark: palette.successBgDark,
    icon: palette.success500,
    iconDark: '#4ade80',
    label: 'OK',
  },
  default: {
    bg: palette.successBgLight,
    bgDark: palette.successBgDark,
    icon: palette.success500,
    iconDark: '#4ade80',
    label: 'OK',
  },
} as const;

function getSeverityColors(severity: string, isDark: boolean) {
  const config =
    SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ?? SEVERITY_COLORS.default;
  return {
    bg: isDark ? config.bgDark : config.bg,
    icon: isDark ? config.iconDark : config.icon,
    label: config.label,
  };
}

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showPaywall, blockedFeature, dismissPaywall, isPro } = useProGate();

  const { data } = useQuery({
    queryKey: queryKeys.diagnostics.all,
    queryFn: () => gqlFetcher(MyDiagnosticsDocument),
  });
  const diagnostics = data?.myDiagnostics ?? [];

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesData?.myMotorcycles ?? [];

  // monthlyDiagCount removed — diagnostics are now a paid feature, no free tier limit

  // CTA glow pulse animation
  const glowOpacity = useSharedValue(0.3);
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 1500 }), withTiming(0.3, { duration: 1500 })),
      -1,
    );
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  // Press scale animation
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const handleNewDiagnostic = () => {
    router.push('/(diagnose)/new');
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.surfaceDark : palette.neutral50 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.5,
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {t('tabs.diagnose')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: isDark ? palette.neutral400 : palette.neutral500,
              marginTop: 4,
            }}
          >
            {t('diagnose.subtitle')}
          </Text>
        </Animated.View>

        {/* Hero CTA with gradient */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 16 }}
        >
          <Animated.View
            style={[
              glowStyle,
              {
                shadowColor: palette.signature500,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 24,
                elevation: 12,
              },
            ]}
          >
            <Pressable
              onPress={handleNewDiagnostic}
              onPressIn={() => {
                ctaScale.value = withSpring(0.97, { damping: 15 });
              }}
              onPressOut={() => {
                ctaScale.value = withSpring(1, { damping: 15 });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('diagnose.startNew')}
            >
              <Animated.View style={ctaAnimatedStyle}>
                <LinearGradient
                  colors={
                    isDark
                      ? [
                          palette.gradientHeroStart,
                          palette.gradientHeroMid,
                          palette.gradientHeroEnd,
                        ]
                      : [palette.gradientHeroStart, palette.gradientHeroMid, '#1d4ed8']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 20,
                    padding: 24,
                    alignItems: 'center',
                    borderCurve: 'continuous',
                  }}
                >
                  {/* Frosted icon */}
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.25)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                      borderCurve: 'continuous',
                    }}
                  >
                    <Camera size={28} color={palette.white} strokeWidth={1.5} />
                  </View>

                  <Text style={{ color: palette.white, fontSize: 18, fontWeight: '700' }}>
                    {t('diagnose.startNew')}
                  </Text>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 14,
                      marginTop: 4,
                      textAlign: 'center',
                    }}
                  >
                    {t('diagnose.scanDescription')}
                  </Text>

                  {/* Pro badge */}
                  {!isPro && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 12,
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderCurve: 'continuous',
                      }}
                    >
                      <Crown size={14} color={palette.signature400} strokeWidth={2} />
                      <Text
                        style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}
                      >
                        Pro
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Recent Diagnostics OR Empty State + Capabilities */}
        {diagnostics.length === 0 ? (
          <>
            {/* Empty state — inspiring, not sad */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(400)}
              style={{ paddingHorizontal: 20, marginTop: 24, alignItems: 'center' }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScanLine size={32} color={isDark ? '#818CF8' : '#6366F1'} strokeWidth={1.5} />
              </View>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  marginTop: 16,
                  color: isDark ? palette.neutral50 : palette.neutral950,
                }}
              >
                {t('diagnose.emptyTitle')}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: isDark ? palette.neutral400 : palette.neutral500,
                  marginTop: 6,
                  textAlign: 'center',
                  maxWidth: 260,
                }}
              >
                {t('diagnose.emptyBody')}
              </Text>
            </Animated.View>

            {/* What can AI diagnose? */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              style={{ paddingHorizontal: 20, marginTop: 32 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: isDark ? palette.neutral500 : palette.neutral400,
                  marginBottom: 16,
                }}
              >
                {t('diagnose.capTitle')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CAPABILITIES.map(({ icon: Icon, labelKey }, index) => (
                  <Animated.View
                    key={labelKey}
                    entering={FadeInUp.delay(350 + index * 40).duration(300)}
                    style={{
                      width: '47%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : palette.white,
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderCurve: 'continuous',
                    }}
                  >
                    <Icon
                      size={16}
                      color={isDark ? palette.neutral400 : palette.neutral500}
                      strokeWidth={1.5}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: isDark ? palette.neutral300 : palette.neutral700,
                        flex: 1,
                      }}
                    >
                      {t(labelKey)}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Tips for better results */}
            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              style={{ paddingHorizontal: 20, marginTop: 28 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: isDark ? palette.neutral500 : palette.neutral400,
                  marginBottom: 12,
                }}
              >
                {t('diagnose.tipsTitle')}
              </Text>
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : palette.white,
                  borderRadius: 16,
                  padding: 16,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderCurve: 'continuous',
                }}
              >
                {(['diagnose.tip1', 'diagnose.tip2', 'diagnose.tip3'] as const).map((key, i) => (
                  <View
                    key={key}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: isDark ? '#818CF8' : '#6366F1',
                        }}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        color: isDark ? palette.neutral300 : palette.neutral600,
                        flex: 1,
                        lineHeight: 20,
                      }}
                    >
                      {/* biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key */}
                      {t(key as any)}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </>
        ) : (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={{ paddingHorizontal: 20, marginTop: 24 }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: isDark ? palette.neutral500 : palette.neutral400,
                marginBottom: 12,
              }}
            >
              {t('diagnose.recent')}
            </Text>

            <View style={{ gap: 10 }}>
              {diagnostics.slice(0, 5).map((diag, index) => {
                const sevColors = getSeverityColors(diag.severity ?? 'default', isDark);
                const bike = motorcycles.find((m) => m.id === diag.motorcycleId);
                // resultJson is only in the detail query, use status for the list
                const displayTitle =
                  diag.status === 'completed' ? (diag.severity ?? 'Completed') : diag.status;

                return (
                  <Animated.View
                    key={diag.id}
                    entering={FadeInUp.delay(250 + index * 60).duration(400)}
                  >
                    <Pressable
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : palette.white,
                        borderRadius: 16,
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        borderCurve: 'continuous',
                      }}
                      onPress={() => router.push(`/(diagnose)/${diag.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${displayTitle}, ${sevColors.label} severity, ${bike ? `${bike.make} ${bike.model}` : ''}`}
                    >
                      {/* Severity indicator bar */}
                      <View
                        style={{
                          width: 3,
                          height: 36,
                          borderRadius: 2,
                          backgroundColor: sevColors.icon,
                          marginRight: 12,
                        }}
                      />

                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: sevColors.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          borderCurve: 'continuous',
                        }}
                      >
                        <ScanLine size={16} color={sevColors.icon} strokeWidth={2} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: isDark ? palette.neutral50 : palette.neutral950,
                          }}
                          numberOfLines={1}
                        >
                          {displayTitle}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 3,
                          }}
                        >
                          {bike && (
                            <Text
                              style={{
                                fontSize: 12,
                                color: isDark ? palette.neutral400 : palette.neutral500,
                              }}
                              numberOfLines={1}
                            >
                              {bike.make} {bike.model}
                            </Text>
                          )}
                          <Text
                            style={{
                              fontSize: 3,
                              color: isDark ? palette.neutral600 : palette.neutral300,
                            }}
                          >
                            {'\u25CF'}
                          </Text>
                          <Clock
                            size={10}
                            color={isDark ? palette.neutral500 : palette.neutral400}
                            strokeWidth={2}
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDark ? palette.neutral500 : palette.neutral400,
                            }}
                          >
                            {new Date(diag.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      {/* Severity badge */}
                      <View
                        style={{
                          backgroundColor: sevColors.bg,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderCurve: 'continuous',
                          marginLeft: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: sevColors.icon,
                            textTransform: 'capitalize',
                          }}
                        >
                          {diag.severity ?? 'ok'}
                        </Text>
                      </View>

                      <ChevronRight
                        size={16}
                        color={isDark ? palette.neutral600 : palette.neutral400}
                        strokeWidth={2}
                        style={{ marginLeft: 4 }}
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
      <ProGateModal visible={showPaywall} feature={blockedFeature} onDismiss={dismissPaywall} />
    </View>
  );
}
