import { palette } from '@motovault/design-system';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface RideSummaryCardProps {
  /** AI-generated summary text, null while generating */
  aiSummary: string | null;
  /** Whether the summary is still being generated */
  isGenerating?: boolean;
  /** Animation delay index */
  index?: number;
}

export function RideSummaryCard({ aiSummary, isGenerating, index = 0 }: RideSummaryCardProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const cardBg = isDark ? palette.surfaceElevated : palette.neutral50;
  const textColor = isDark ? palette.neutral200 : palette.neutral700;
  const mutedColor = isDark ? palette.neutral500 : palette.neutral400;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : palette.neutral200;

  // Still generating
  if (!aiSummary && isGenerating) {
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor,
          }}
        >
          <ActivityIndicator size="small" color={palette.accent500} />
          <Text style={{ fontSize: 14, color: mutedColor, fontStyle: 'italic' }}>
            {t('community.summaryGenerating')}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // No summary at all
  if (!aiSummary) return null;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 8,
          borderWidth: 1,
          borderColor,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color={palette.accent500} strokeWidth={2} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: palette.accent500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('community.aiSummary')}
          </Text>
        </View>

        {/* Content */}
        <Text style={{ fontSize: 15, color: textColor, lineHeight: 22 }}>{aiSummary}</Text>
      </View>
    </Animated.View>
  );
}
