import type { ReactNode } from 'react';
import { type AccessibilityRole, Pressable, View, type ViewStyle } from 'react-native';
import { triggerImpact } from '@/utils/haptics';
import { HUB_PRESSED_SCALE, HUB_RADIUS, useHubTheme } from './tokens';

interface HubCardProps {
  children: ReactNode;
  /** Makes the whole card one pressable. Do not put another pressable inside it. */
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Defaults to "button" when the card is pressable. */
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
  testID?: string;
}

const SURFACE: ViewStyle = {
  borderWidth: 1,
  borderRadius: HUB_RADIUS.card,
  borderCurve: 'continuous',
};

/** The hub's card surface: warm dark card, hairline border, 16 px continuous corners. */
export function HubCard({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityRole,
  disabled = false,
  testID,
}: HubCardProps) {
  const hub = useHubTheme();
  if (!onPress) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        style={[SURFACE, { backgroundColor: hub.card, borderColor: hub.hairline }, style]}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        SURFACE,
        { backgroundColor: hub.card, borderColor: hub.hairline },
        style,
        { transform: [{ scale: pressed ? HUB_PRESSED_SCALE : 1 }], opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}
