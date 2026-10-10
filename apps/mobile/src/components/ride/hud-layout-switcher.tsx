import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Gauge, Map as MapIcon } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { tint } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

export type HudLayout = 'A' | 'B';

interface HudLayoutSwitcherProps {
  activeLayout: HudLayout;
  onSwitch: (layout: HudLayout) => void;
  isNightMode: boolean;
}

const SEGMENTS: { layout: HudLayout; Icon: typeof Gauge }[] = [
  { layout: 'A', Icon: Gauge },
  { layout: 'B', Icon: MapIcon },
];

export function HudLayoutSwitcher({ activeLayout, onSwitch, isNightMode }: HudLayoutSwitcherProps) {
  const containerBg = isNightMode ? tint(palette.nightBg, 0.85) : tint(palette.neutral900, 0.65);
  const activeBg = isNightMode ? palette.nightAccent : palette.controlBgActive;
  const activeIconColor = isNightMode ? palette.nightText : palette.white;
  const inactiveIconColor = isNightMode ? tint(palette.nightText, 0.4) : palette.iconMuted;

  const handlePress = useCallback(
    (layout: HudLayout) => {
      if (layout === activeLayout) return;
      triggerImpact(Haptics.ImpactFeedbackStyle.Light);
      onSwitch(layout);
    },
    [activeLayout, onSwitch],
  );

  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <View
        style={{
          flexDirection: 'row',
          width: 80,
          height: 32,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: containerBg,
          padding: 2,
          gap: 2,
        }}
      >
        {SEGMENTS.map(({ layout, Icon }) => {
          const isActive = activeLayout === layout;
          return (
            <Pressable
              key={layout}
              onPress={() => handlePress(layout)}
              accessibilityRole="button"
              accessibilityLabel={`Switch to layout ${layout}`}
              accessibilityState={{ selected: isActive }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isActive ? activeBg : 'transparent',
              }}
            >
              <Icon
                size={14}
                color={isActive ? activeIconColor : inactiveIconColor}
                strokeWidth={2.5}
              />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}
