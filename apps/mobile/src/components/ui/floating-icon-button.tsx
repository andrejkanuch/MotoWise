/**
 * FloatingIconButton — a circular, translucent icon button used as a map overlay
 * control (back, edit, share, map style, AI assistant…). Supports an optional
 * caption rendered beneath the circle.
 */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

export function FloatingIconButton({
  icon,
  onPress,
  label,
  size = 48,
  bordered = false,
  haptics = false,
  accessibilityLabel,
}: {
  icon: ReactNode;
  onPress: () => void;
  label?: string;
  size?: number;
  bordered?: boolean;
  haptics?: boolean;
  accessibilityLabel?: string;
}) {
  const { t } = useEditorialTheme();

  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderCurve: 'continuous',
        backgroundColor: tint(t.bg, 0.7),
        borderWidth: bordered ? 1 : 0,
        borderColor: bordered ? t.line : undefined,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </View>
  );

  return (
    <Pressable
      onPress={() => {
        if (haptics) triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={label ? { alignItems: 'center', gap: 3 } : undefined}
    >
      {circle}
      {label ? <Text style={{ fontSize: 9, fontWeight: '600', color: t.ink }}>{label}</Text> : null}
    </Pressable>
  );
}
