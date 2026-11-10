import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';

/** Graphite fill: a raised step of ink over whatever ground the row sits on. */
const FILL_ALPHA = 0.08;
/** Chrome label: stops growing here so the chip never crowds the row title. */
const MAX_FONT_SCALE = 1.3;

/**
 * The small "New" chip on the entry row of a feature the rider has not used
 * yet. Graphite, never copper: copper means an action, and the chip is not one.
 */
export function NewChip({ testID }: { testID?: string }) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: space.xs,
        paddingVertical: space.xxs / 2,
        borderRadius: radius.chip,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: tint(t.ink, FILL_ALPHA),
      }}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[type.label, { color: t.ink2 }]}>
        {i18n('whatsNew.carousel.newChip')}
      </Text>
    </View>
  );
}
