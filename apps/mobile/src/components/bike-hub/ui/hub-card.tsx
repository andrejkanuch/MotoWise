import type { ReactNode } from 'react';
import { type AccessibilityRole, Pressable, View, type ViewStyle } from 'react-native';
import { triggerImpact } from '../../../utils/haptics';
import { HUB_PRESSED_SCALE, HUB_RADIUS, hub } from './tokens';

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
  backgroundColor: hub.card,
  borderWidth: 1,
  borderColor: hub.hairline,
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
  if (!onPress) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        style={[SURFACE, style]}
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
        style,
        { transform: [{ scale: pressed ? HUB_PRESSED_SCALE : 1 }], opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}
