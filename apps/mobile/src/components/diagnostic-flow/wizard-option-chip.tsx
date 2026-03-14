import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { HelpCircle, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';

type ChipVariant = 'default' | 'dont-know' | 'custom';

interface WizardOptionChipProps {
  label: string;
  subtitle?: string;
  selected: boolean;
  /** @deprecated Use variant="dont-know" instead */
  isIDontKnow?: boolean;
  /** @deprecated Use IconComponent instead */
  icon?: ReactNode;
  IconComponent?: LucideIcon;
  variant?: ChipVariant;
  onPress: () => void;
  onRemove?: () => void;
}

export function WizardOptionChip({
  label,
  subtitle,
  selected,
  isIDontKnow,
  icon,
  IconComponent,
  variant: variantProp,
  onPress,
  onRemove,
}: WizardOptionChipProps) {
  const variant = variantProp ?? (isIDontKnow ? 'dont-know' : 'default');

  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const getBorderColor = () => {
    if (variant === 'dont-know') {
      return selected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)';
    }
    if (variant === 'custom') {
      return selected ? DIAGNOSTIC_COLORS.cardBorderSelected : DIAGNOSTIC_COLORS.cardBorder;
    }
    return selected ? DIAGNOSTIC_COLORS.cardBorderSelected : DIAGNOSTIC_COLORS.cardBorder;
  };

  const getBgColor = () => {
    if (variant === 'dont-know') {
      return selected ? DIAGNOSTIC_COLORS.cardBgSelected : 'transparent';
    }
    return selected ? DIAGNOSTIC_COLORS.cardBgSelected : DIAGNOSTIC_COLORS.cardBg;
  };

  const getTextColor = () => {
    if (variant === 'dont-know') {
      return selected ? DIAGNOSTIC_COLORS.textSecondary : DIAGNOSTIC_COLORS.textMuted;
    }
    return selected ? DIAGNOSTIC_COLORS.textPrimary : DIAGNOSTIC_COLORS.textSecondary;
  };

  const getIconColor = () => {
    if (variant === 'dont-know') {
      return selected ? DIAGNOSTIC_COLORS.textSecondary : DIAGNOSTIC_COLORS.textMuted;
    }
    return selected ? DIAGNOSTIC_COLORS.accent : DIAGNOSTIC_COLORS.textMuted;
  };

  return (
    <Pressable
      style={{
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderStyle: variant === 'dont-know' && !selected ? 'dashed' : 'solid',
        borderColor: getBorderColor(),
        backgroundColor: getBgColor(),
        borderCurve: 'continuous',
      }}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {variant === 'dont-know' ? (
          <HelpCircle size={18} color={getIconColor()} strokeWidth={1.5} />
        ) : IconComponent ? (
          <IconComponent size={16} color={getIconColor()} strokeWidth={1.5} />
        ) : icon ? (
          icon
        ) : null}
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            flex: 1,
            color: getTextColor(),
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
