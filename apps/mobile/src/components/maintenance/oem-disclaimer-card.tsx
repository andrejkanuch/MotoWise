import { palette, spacing } from '@motovault/design-system';
import { AlertTriangle, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SYSTEM_WEIGHT, useHubTheme } from '../bike-hub/ui/tokens';

export const OEM_DISCLAIMER_VARIANT = {
  /** Amber warning card — onboarding, where the schedule is first imported. */
  CARD: 'card',
  /** A muted footnote in hub tokens — the bike hub's Service segment. */
  QUIET: 'quiet',
} as const;
export type OemDisclaimerVariant =
  (typeof OEM_DISCLAIMER_VARIANT)[keyof typeof OEM_DISCLAIMER_VARIANT];

interface OemDisclaimerCardProps {
  /** Surface theme for the card variant. Defaults to dark (mobile is dark-first). */
  isDark?: boolean;
  /** Stagger delay (ms) for the card variant's FadeInUp entrance. */
  delay?: number;
  /** Optional extra layout style (margins/padding) for the host surface. */
  style?: ViewStyle;
  variant?: OemDisclaimerVariant;
}

/**
 * The hub's footnote: same copy, no alarm. Next to a task list the caveat is
 * reference material, not a warning — amber there would compete with the
 * Due-soon colour.
 */
function QuietDisclaimer({ style }: { style?: ViewStyle }) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  return (
    <View style={[{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }, style]}>
      <Info size={14} color={hub.muted} strokeWidth={2} style={{ marginTop: 1 }} />
      <Text
        selectable
        style={{
          flex: 1,
          ...SYSTEM_WEIGHT.regular,
          fontSize: 12,
          lineHeight: 16,
          color: hub.muted,
        }}
      >
        {t('oem.disclaimer')}
      </Text>
    </View>
  );
}

/**
 * Release-blocking spec-data disclaimer (R5 / plan U6), rendering the shared
 * `oem.disclaimer` copy on every spec-bearing maintenance surface so the
 * "informative only / verify against the manual" caveat is always present.
 * The card variant mirrors the diagnose-screen disclaimer (FadeInUp,
 * AlertTriangle, warm amber tint); the quiet variant is the bike hub's footnote.
 */
export function OemDisclaimerCard({
  isDark = true,
  delay = 0,
  style,
  variant = OEM_DISCLAIMER_VARIANT.CARD,
}: OemDisclaimerCardProps) {
  const { t } = useTranslation();

  if (variant === OEM_DISCLAIMER_VARIANT.QUIET) return <QuietDisclaimer style={style} />;

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
