import { palette } from '@motolearn/design-system';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Clock, ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gql, useQuery } from 'urql';

const MyDiagnosticsQuery = gql`
  query MyDiagnostics {
    myDiagnostics {
      id
      severity
      confidence
      status
      createdAt
    }
  }
`;

const SEVERITY_COLORS = {
  critical: { bg: palette.dangerBgLight, icon: palette.danger500 },
  warning: { bg: palette.warningBgLight, icon: palette.warning500 },
  default: { bg: palette.successBgLight, icon: palette.success500 },
} as const;

function getSeverityColors(severity: string) {
  if (severity === 'critical') return SEVERITY_COLORS.critical;
  if (severity === 'warning') return SEVERITY_COLORS.warning;
  return SEVERITY_COLORS.default;
}

export default function DiagnoseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [{ data }] = useQuery({ query: MyDiagnosticsQuery });
  const diagnostics = data?.myDiagnostics ?? [];

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-3 pb-1">
          <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
            {t('tabs.diagnose')}
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('diagnose.subtitle')}
          </Text>
        </Animated.View>

        {/* Scan CTA */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-5 mt-5">
          <Pressable
            className="bg-primary-950 dark:bg-primary-700 rounded-2xl p-6 items-center"
            style={{ borderCurve: 'continuous' }}
            onPress={() => router.push('/(diagnose)/new')}
          >
            <View className="w-16 h-16 rounded-2xl bg-white/15 items-center justify-center mb-4">
              <Camera size={32} color={palette.white} strokeWidth={1.5} />
            </View>
            <Text className="text-white text-lg font-bold">{t('diagnose.startNew')}</Text>
            <Text className="text-white/60 text-sm mt-1 text-center">
              {t('diagnose.scanDescription')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Recent Diagnostics */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-5 mt-6">
          <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-3">
            {t('diagnose.recent')}
          </Text>

          {diagnostics.length === 0 ? (
            <View
              className="bg-white dark:bg-neutral-800 rounded-2xl p-6 items-center"
              style={{ borderCurve: 'continuous' }}
            >
              <ScanLine size={36} color={palette.neutral300} strokeWidth={1.5} />
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-3 text-center">
                {t('diagnose.noDiagnostics')}
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {diagnostics.slice(0, 5).map(
                (
                  diag: {
                    id: string;
                    severity: string;
                    confidence: number;
                    status: string;
                    createdAt: string;
                  },
                  index: number,
                ) => {
                  const sevColors = getSeverityColors(diag.severity);
                  return (
                    <Animated.View
                      key={diag.id}
                      entering={FadeInUp.delay(250 + index * 60).duration(400)}
                    >
                      <Pressable
                        className="bg-white dark:bg-neutral-800 rounded-2xl p-4 flex-row items-center"
                        style={{ borderCurve: 'continuous' }}
                        onPress={() => router.push(`/(diagnose)/${diag.id}`)}
                      >
                        <View
                          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                          style={{ backgroundColor: sevColors.bg }}
                        >
                          <ScanLine size={18} color={sevColors.icon} strokeWidth={2} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 capitalize">
                            {diag.status}
                          </Text>
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Clock size={12} color={palette.neutral400} strokeWidth={2} />
                            <Text className="text-xs text-neutral-500">
                              {new Date(diag.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                        <ChevronRight size={18} color={palette.neutral400} strokeWidth={2} />
                      </Pressable>
                    </Animated.View>
                  );
                },
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
