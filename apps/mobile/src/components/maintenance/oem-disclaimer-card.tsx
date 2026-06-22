import { palette, spacing } from '@motovault/design-system';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface OemDisclaimerCardProps {
  /** Surface theme. Defaults to dark (mobile is dark-first). */
  isDark?: boolean;
  /** Stagger delay (ms) for the FadeInUp entrance. */
  delay?: number;
  /** Optional extra layout style (margins/padding) for the host surface. */
  style?: object;
}

/**
 * Release-blocking spec-data disclaimer card (R5 / plan U6). Mirrors the
 * canonical diagnose-screen disclaimer card (FadeInUp, AlertTriangle, warm
 * amber tint, continuous border curve, selectable copy) and renders the shared
 * `oem.disclaimer` copy. Used on every spec-bearing maintenance surface so the
 * "informative only / verify against the manual" caveat is always present.
 */
export function OemDisclaimerCard({ isDark = true, delay = 0, style }: OemDisclaimerCardProps) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={style}>
      <View
        style={{
          backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
          borderRadius: 16,
          padding: spacing[4],
          flexDirection: 'row',
          gap: spacing[3],
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: palette.warningBorder,
        }}
      >
        <AlertTriangle
          size={16}
          color={isDark ? palette.editorialDarkWarm2 : palette.warning500}
          strokeWidth={2}
          style={{ marginTop: 1 }}
        />
        <Text
          selectable
          style={{
            fontSize: 12,
            color: isDark ? palette.editorialDarkWarm2 : palette.editorialLightWarm,
            flex: 1,
            lineHeight: 17,
          }}
        >
          {t('oem.disclaimer')}
        </Text>
      </View>
    </Animated.View>
  );
}
