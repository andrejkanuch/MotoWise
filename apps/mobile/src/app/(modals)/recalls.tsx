import { palette } from '@motovault/design-system';
import { MotorcycleRecallsDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ChevronLeft, ExternalLink, ShieldCheck } from 'lucide-react-native';
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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../lib/graphql-client';

/**
 * MOT-142: Safety recall results screen.
 *
 * Takes a motorcycleId param, runs the server-side NHTSA check (which uses
 * VIN when available and falls back to make/model/year), and renders each
 * recall campaign. Empty state is a clear "No open recalls" banner — the
 * absence of a recall is as valuable as the presence of one.
 */
export default function RecallsScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['motorcycle-recalls', motorcycleId],
    queryFn: () => gqlFetcher(MotorcycleRecallsDocument, { motorcycleId }),
    enabled: !!motorcycleId,
    staleTime: 60 * 60 * 1000, // 1 hour client-side (server caches 24h)
  });

  const result = data?.motorcycleRecalls;
  const recalls = result?.recalls ?? [];
  const count = result?.count ?? 0;
  const hasRecalls = count > 0;

  const bg = isDark ? palette.neutral950 : palette.neutral50;
  const card = isDark ? palette.neutral800 : palette.white;
  const textColor = isDark ? palette.neutral50 : palette.neutral950;
  const mutedText = isDark ? palette.neutral400 : palette.neutral600;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={24} color={textColor} strokeWidth={2} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: textColor, flex: 1 }}>
          {t('recalls.title', { defaultValue: 'Safety Recalls' })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {bikeName && (
          <Text style={{ fontSize: 14, color: mutedText, marginBottom: 4 }}>{bikeName}</Text>
        )}

        {isLoading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={palette.primary500} />
            <Text style={{ marginTop: 12, fontSize: 14, color: mutedText }}>
              {t('recalls.checking', { defaultValue: 'Checking NHTSA database…' })}
            </Text>
          </View>
        )}

        {error && !isLoading && (
          <View
            style={{
              backgroundColor: isDark ? palette.dangerBgDark : palette.dangerBgLight,
              padding: 16,
              borderRadius: 12,
              borderCurve: 'continuous',
            }}
          >
            <Text style={{ color: palette.danger500, fontWeight: '600' }}>
              {t('recalls.error', {
                defaultValue: 'Could not reach the NHTSA database. Please try again.',
              })}
            </Text>
          </View>
        )}

        {!isLoading && !error && !hasRecalls && (
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={{
              backgroundColor: isDark ? palette.successBgDark : palette.successBgLight,
              padding: 20,
              borderRadius: 14,
              borderCurve: 'continuous',
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <ShieldCheck size={24} color={palette.success500} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.success500 }}>
                {t('recalls.none', { defaultValue: 'No open recalls found' })}
              </Text>
              <Text style={{ fontSize: 13, color: mutedText, marginTop: 4 }}>
                {t('recalls.noneDescription', {
                  defaultValue:
                    'NHTSA has no open safety recall campaigns for this motorcycle at this time.',
                })}
              </Text>
            </View>
          </Animated.View>
        )}

        {!isLoading && hasRecalls && (
          <>
            <View
              style={{
                backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
                padding: 16,
                borderRadius: 14,
                borderCurve: 'continuous',
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={22} color={palette.warning500} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: palette.warning500 }}>
                {t('recalls.openCount', {
                  defaultValue: `${count} open recall${count === 1 ? '' : 's'} found`,
                  count,
                })}
              </Text>
            </View>

            {recalls.map((recall, index) => (
              <Animated.View
                key={recall.campaignNumber}
                entering={FadeInUp.delay(index * 60).duration(300)}
                style={{
                  backgroundColor: card,
                  padding: 16,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderLeftWidth: 4,
                  borderLeftColor: palette.danger500,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.danger500 }}>
                    {recall.component.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 11, color: mutedText }}>{recall.reportDate}</Text>
                </View>

                <Text style={{ fontSize: 13, color: textColor, lineHeight: 19 }}>
                  {recall.summary}
                </Text>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: isDark ? palette.neutral700 : palette.neutral200,
                    paddingTop: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: mutedText }}>
                    {t('recalls.consequence', { defaultValue: 'CONSEQUENCE' })}
                  </Text>
                  <Text style={{ fontSize: 13, color: textColor, lineHeight: 19 }}>
                    {recall.consequence}
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: mutedText }}>
                    {t('recalls.remedy', { defaultValue: 'REMEDY' })}
                  </Text>
                  <Text style={{ fontSize: 13, color: textColor, lineHeight: 19 }}>
                    {recall.remedy}
                  </Text>
                </View>

                <Text style={{ fontSize: 11, color: mutedText, marginTop: 4 }}>
                  {t('recalls.campaign', { defaultValue: 'Campaign' })}: {recall.campaignNumber}
                </Text>
              </Animated.View>
            ))}
          </>
        )}

        {/* NHTSA attribution */}
        <Pressable
          onPress={() => Linking.openURL('https://www.nhtsa.gov/recalls')}
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 12,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: isDark ? palette.neutral800 : palette.white,
          }}
        >
          <Text style={{ fontSize: 12, color: mutedText }}>
            {t('recalls.attribution', { defaultValue: 'Recall data from NHTSA' })}
          </Text>
          <ExternalLink size={12} color={mutedText} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
