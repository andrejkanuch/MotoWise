import { palette } from '@motovault/design-system';
import { Info } from 'lucide-react-native';
import { Text, useColorScheme, View } from 'react-native';

interface InlineHintProps {
  children: string;
  tone?: 'muted' | 'warning';
  size?: 'sm' | 'md';
}

/**
 * Lightweight advisory hint. Sits inline with content, no pill/box background.
 * Use for non-blocking guidance; for blocking alerts keep a full warning banner.
 */
export function InlineHint({ children, tone = 'muted', size = 'sm' }: InlineHintProps) {
  const isDark = useColorScheme() === 'dark';

  const color =
    tone === 'warning' ? palette.warning500 : isDark ? palette.neutral400 : palette.neutral500;

  const iconSize = size === 'sm' ? 13 : 15;
  const fontSize = size === 'sm' ? 12 : 13;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 2 }}>
      <Info size={iconSize} color={color} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize, lineHeight: fontSize + 4, color }}>{children}</Text>
    </View>
  );
}
