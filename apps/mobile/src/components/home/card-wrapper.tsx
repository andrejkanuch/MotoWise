import { palette } from '@motolearn/design-system';
import type { ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

type ShadowTier = 'subtle' | 'medium' | 'prominent';

const SHADOW_CONFIG = {
  subtle: {
    light: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffsetY: 2, elevation: 2 },
    dark: { shadowOpacity: 0.024, shadowRadius: 8, shadowOffsetY: 2, elevation: 2 },
  },
  medium: {
    light: { shadowOpacity: 0.1, shadowRadius: 12, shadowOffsetY: 4, elevation: 4 },
    dark: { shadowOpacity: 0.04, shadowRadius: 12, shadowOffsetY: 4, elevation: 4 },
  },
  prominent: {
    light: { shadowOpacity: 0.15, shadowRadius: 20, shadowOffsetY: 8, elevation: 8 },
    dark: { shadowOpacity: 0.06, shadowRadius: 20, shadowOffsetY: 8, elevation: 8 },
  },
} as const;

interface CardWrapperProps {
  tier?: ShadowTier;
  borderRadius?: number;
  children: ReactNode;
  style?: Record<string, unknown>;
}

export function CardWrapper({
  tier = 'subtle',
  borderRadius = 20,
  children,
  style,
}: CardWrapperProps) {
  const isDark = useColorScheme() === 'dark';
  const config = SHADOW_CONFIG[tier][isDark ? 'dark' : 'light'];

  return (
    <View
      style={{
        backgroundColor: isDark ? '#2a2a2a' : palette.white,
        borderRadius,
        borderCurve: 'continuous',
        shadowColor: palette.black,
        shadowOpacity: config.shadowOpacity,
        shadowRadius: config.shadowRadius,
        shadowOffset: { width: 0, height: config.shadowOffsetY },
        elevation: config.elevation,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
