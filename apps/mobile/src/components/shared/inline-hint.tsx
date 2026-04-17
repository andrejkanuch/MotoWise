import { palette } from '@motovault/design-system';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface InlineHintProps {
  /** Short label next to the ⓘ icon. Keep under ~24 chars. */
  label: string;
  /** Explanation shown when the icon is tapped. */
  hint: string;
  /** If true the hint is shown expanded on mount (first-use coachmark). */
  defaultOpen?: boolean;
}

/**
 * Minimal inline hint — replaces floating helper-text blocks.
 *
 * Renders a tappable row: `label ⓘ`. Tapping toggles an explanatory line.
 * Saves vertical space and removes "tooltip boxes" that chip away at focus.
 */
export function InlineHint({ label, hint, defaultOpen = false }: InlineHintProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isDark = useColorScheme() === 'dark';

  const labelColor = isDark ? palette.neutral300 : palette.neutral700;
  const iconColor = isDark ? palette.neutral400 : palette.neutral500;
  const hintColor = isDark ? palette.neutral400 : palette.neutral500;

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityHint="Toggles an explanation"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor }}>{label}</Text>
        <Info size={13} color={iconColor} />
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(140)}>
          <Text style={{ fontSize: 12, color: hintColor, marginTop: 4, lineHeight: 17 }}>
            {hint}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
