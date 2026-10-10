import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { triggerImpact } from '@/utils/haptics';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_HEIGHT,
  HUB_PRESSED_SCALE,
  HUB_RADIUS,
  SYSTEM_WEIGHT,
  useHubTheme,
} from './tokens';

interface ActionPillProps {
  /** Shown beside the icon. Without it the pill is a 52 px icon-only circle. */
  label?: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Required: an icon-only pill has no visible name. */
  accessibilityLabel: string;
  testID?: string;
}

/**
 * The segment's one primary action: copper with dark ink (white on copper fails
 * contrast). Labelled "Log" on Overview where it opens a chooser, icon-only on
 * the other segments where it opens that segment's form. The parent positions
 * it above the tab bar.
 */
export function ActionPill({
  label,
  icon: Icon,
  onPress,
  accessibilityLabel,
  testID,
}: ActionPillProps) {
  const hub = useHubTheme();
  const labelled = !!label;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        minHeight: HUB_HEIGHT.primary,
        minWidth: HUB_HEIGHT.primary,
        paddingLeft: labelled ? 16 : 0,
        paddingRight: labelled ? 20 : 0,
        borderRadius: HUB_RADIUS.pill,
        borderCurve: 'continuous',
        backgroundColor: hub.copper,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: hub.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 6,
        transform: [{ scale: pressed ? HUB_PRESSED_SCALE : 1 }],
      })}
    >
      <Icon size={20} color={hub.ink} strokeWidth={2.5} />
      {labelled ? (
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{ ...SYSTEM_WEIGHT.bold, fontSize: 15, color: hub.ink }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
