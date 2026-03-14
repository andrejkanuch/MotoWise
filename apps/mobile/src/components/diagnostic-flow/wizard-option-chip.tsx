import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';

type ChipVariant = 'default' | 'dont-know' | 'custom';

interface WizardOptionChipProps {
  label: string;
  subtitle?: string;
  selected: boolean;
  IconComponent?: LucideIcon;
  variant?: ChipVariant;
  onPress: () => void;
  onRemove?: () => void;
}

export function WizardOptionChip({
  label,
  subtitle,
  selected,
  IconComponent,
  variant = 'default',
  onPress,
  onRemove,
}: WizardOptionChipProps) {
  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const isDontKnow = variant === 'dont-know';

  const borderColor = isDontKnow
    ? selected
      ? 'rgba(255,255,255,0.3)'
      : 'rgba(255,255,255,0.15)'
    : selected
      ? DIAGNOSTIC_COLORS.cardBorderSelected
      : DIAGNOSTIC_COLORS.cardBorder;

  const bgColor = isDontKnow
    ? selected
      ? DIAGNOSTIC_COLORS.cardBgSelected
      : 'transparent'
    : selected
      ? DIAGNOSTIC_COLORS.cardBgSelected
      : DIAGNOSTIC_COLORS.cardBg;

  const textColor = isDontKnow
    ? selected
      ? DIAGNOSTIC_COLORS.textSecondary
      : DIAGNOSTIC_COLORS.textMuted
    : selected
      ? DIAGNOSTIC_COLORS.textPrimary
      : DIAGNOSTIC_COLORS.textSecondary;

  const iconColor = isDontKnow
    ? selected
      ? DIAGNOSTIC_COLORS.textSecondary
      : DIAGNOSTIC_COLORS.textMuted
    : selected
      ? DIAGNOSTIC_COLORS.accent
      : DIAGNOSTIC_COLORS.textMuted;

  return (
    <Pressable
      style={{
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderStyle: isDontKnow && !selected ? 'dashed' : 'solid',
        borderColor,
        backgroundColor: bgColor,
        borderCurve: 'continuous',
      }}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isDontKnow ? (
          <HelpCircle size={18} color={iconColor} strokeWidth={1.5} />
        ) : IconComponent ? (
          <IconComponent size={16} color={iconColor} strokeWidth={1.5} />
        ) : null}
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            flex: 1,
            color: textColor,
          }}
        >
          {label}
        </Text>
        {variant === 'custom' && onRemove && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onRemove();
            }}
            hitSlop={8}
            style={{ padding: 2 }}
          >
            <X size={14} color={DIAGNOSTIC_COLORS.textMuted} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      {subtitle && (
        <Text style={{ fontSize: 12, color: DIAGNOSTIC_COLORS.textMuted, marginTop: 4 }}>
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}
