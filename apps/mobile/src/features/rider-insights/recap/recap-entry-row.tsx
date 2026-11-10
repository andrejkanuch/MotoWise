import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import type { RiderInsightsData } from '../use-rider-insights';
import { recapSeasonYear } from './recap-model';

const ROW_MIN_HEIGHT = 56;
const PRESS_TINT = 0.06;

/** The row under "How you ride" that opens the season recap, named for the season shown. */
export function RecapEntryRow({
  insights,
  onPress,
}: {
  insights: RiderInsightsData;
  onPress: () => void;
}) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  const title = i18n('riderInsights.recap.entry', { year: recapSeasonYear(insights) });
  const caption = insights.isPro
    ? i18n('riderInsights.recap.entryCaptionPro')
    : i18n('riderInsights.recap.entryCaptionFree');

  return (
    <Pressable
      testID="insights-recap-entry"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      onPress={onPress}
      android_ripple={{ color: t.line }}
      style={({ pressed }) => ({
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, PRESS_TINT) : t.surface,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.bodyStrong, { color: t.ink }]}>{title}</Text>
        <Text style={[type.caption, { color: t.ink3 }]}>{caption}</Text>
      </View>
      <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>
        {i18n('riderInsights.recap.open')}
      </Text>
    </Pressable>
  );
}
