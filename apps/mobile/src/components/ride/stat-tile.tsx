import * as Haptics from 'expo-haptics';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../theme/editorial';

interface StatTileProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  unit?: string;
  active?: boolean;
  hasChart?: boolean;
  onPress?: () => void;
}

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  active = false,
  hasChart = false,
  onPress,
}: StatTileProps) {
  const { t } = useEditorialTheme();

  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const content = (
    <View
      style={{
        backgroundColor: active ? tint(t.warm, 0.1) : t.surface,
        borderWidth: 1,
        borderColor: active ? t.warm : t.line,
        borderRadius: 14,
        borderCurve: 'continuous',
        paddingTop: 11,
        paddingHorizontal: 12,
        paddingBottom: 10,
      }}
    >
      {/* Icon + label row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginBottom: 6,
        }}
      >
        <Icon size={11} color={active ? t.warm : t.ink3} />
        <Text
          style={{
            fontSize: 9,
            fontWeight: '600',
            color: active ? t.warm : t.ink3,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {label}
        </Text>
      </View>

      {/* Value + unit */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: t.ink,
            fontFamily: 'InstrumentSerif_400Regular',
          }}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={{
              fontSize: 10,
              fontWeight: '500',
              color: t.ink3,
              marginLeft: 3,
            }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (hasChart && onPress) {
    return (
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        {content}
      </Pressable>
    );
  }

  return <View style={{ flex: 1 }}>{content}</View>;
}
