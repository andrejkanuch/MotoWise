import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  badge?: ReactNode;
}

export function SettingsRow({
  icon: Icon,
  label,
  value,
  onPress,
  tone = 'default',
  badge,
}: SettingsRowProps) {
  const isDark = useColorScheme() === 'dark';
  const isDanger = tone === 'danger';
  const isInteractive = !!onPress;

  const labelColor = isDanger ? palette.danger500 : isDark ? palette.neutral50 : palette.neutral950;
  const iconColor = isDanger ? palette.danger500 : isDark ? palette.neutral300 : palette.neutral600;
  const iconBg = isDanger
    ? isDark
      ? palette.dangerTintDark
      : palette.dangerTintLight
    : isDark
      ? palette.iconBubbleDark
      : palette.neutral100;

  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const content = (
    <>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={17} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: isDanger ? '600' : '400',
          color: labelColor,
          marginLeft: 12,
        }}
      >
        {label}
      </Text>
      {badge ? <View style={{ marginRight: 8 }}>{badge}</View> : null}
      {value ? (
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            color: palette.neutral500,
            marginRight: isInteractive ? 6 : 0,
            maxWidth: 160,
          }}
        >
          {value}
        </Text>
      ) : null}
      {isInteractive ? <ChevronRight size={17} color={palette.neutral400} strokeWidth={2} /> : null}
    </>
  );

  const containerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
  };

  if (!isInteractive) {
    return <View style={containerStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        ...containerStyle,
        backgroundColor: pressed
          ? isDark
            ? palette.pressedDark
            : palette.pressedLight
          : 'transparent',
      })}
    >
      {content}
    </Pressable>
  );
}
