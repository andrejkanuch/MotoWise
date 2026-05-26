import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Check, HelpCircle, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDiagnosticColors } from './diagnostic-colors';

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
  const colors = useDiagnosticColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isDontKnow = variant === 'dont-know';

  const borderColor = isDontKnow
    ? selected
      ? colors.dontKnowBorderSelected
      : colors.dontKnowBorder
    : selected
      ? colors.cardBorderSelected
      : colors.cardBorder;

  const bgColor = isDontKnow
    ? selected
      ? colors.cardBgSelected
      : 'transparent'
    : selected
      ? colors.cardBgSelected
      : colors.cardBg;

  const textColor = isDontKnow
    ? selected
      ? colors.textSecondary
      : colors.textMuted
    : selected
      ? colors.textPrimary
      : colors.textSecondary;

  const iconColor = isDontKnow
    ? selected
      ? colors.textSecondary
      : colors.textMuted
    : selected
      ? colors.accent
      : colors.textMuted;

  return (
    <Pressable
      style={{
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        borderColor,
        backgroundColor: bgColor,
        borderCurve: 'continuous',
        minHeight: 44,
      }}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isDontKnow ? (
          <HelpCircle size={16} color={iconColor} strokeWidth={1.5} />
        ) : IconComponent ? (
          <IconComponent size={15} color={iconColor} strokeWidth={1.5} />
        ) : null}
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            flexGrow: 1,
            flexShrink: 1,
            color: textColor,
          }}
        >
          {label}
        </Text>
        {selected && variant === 'default' && (
          <Animated.View entering={FadeIn.duration(150)}>
            <Check size={14} color={colors.accent} strokeWidth={2.5} />
          </Animated.View>
        )}
        {variant === 'custom' && onRemove && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onRemove();
            }}
            hitSlop={12}
            style={{ padding: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
          >
            <X size={14} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      {subtitle && (
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>{subtitle}</Text>
      )}
    </Pressable>
  );
}
