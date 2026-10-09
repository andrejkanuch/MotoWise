import type { LucideIcon } from 'lucide-react-native';
import { Check, HelpCircle, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { useDiagnosticColors } from './diagnostic-colors';

export const CHIP_VARIANT = {
  DEFAULT: 'default',
  DONT_KNOW: 'dont-know',
  CUSTOM: 'custom',
} as const;
type ChipVariant = (typeof CHIP_VARIANT)[keyof typeof CHIP_VARIANT];

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
  variant = CHIP_VARIANT.DEFAULT,
  onPress,
  onRemove,
}: WizardOptionChipProps) {
  const { t } = useTranslation();
  const colors = useDiagnosticColors();

  const handlePress = () => {
    triggerImpact();
    onPress();
  };

  const isDontKnow = variant === CHIP_VARIANT.DONT_KNOW;

  // "I don't know" is an escape hatch, not an answer — it never takes copper.
  const borderColor = isDontKnow
    ? selected
      ? colors.dontKnowBorderSelected
      : colors.dontKnowBorder
    : selected
      ? colors.cardBorderSelected
      : colors.cardBorder;

  const bgColor = selected ? colors.cardBgSelected : isDontKnow ? 'transparent' : colors.cardBg;
  const textColor = selected ? colors.textPrimary : colors.textSecondary;
  const iconColor = selected && !isDontKnow ? colors.accent : colors.textMuted;

  return (
    <Pressable
      style={{
        borderRadius: radius.control,
        paddingVertical: space.sm,
        paddingHorizontal: space.sm + 2,
        borderWidth: 1.5,
        borderColor,
        backgroundColor: bgColor,
        borderCurve: 'continuous',
        minHeight: 48,
        justifyContent: 'center',
      }}
      android_ripple={{ color: colors.cardBorder }}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {isDontKnow ? (
          <HelpCircle size={16} color={iconColor} strokeWidth={1.75} />
        ) : IconComponent ? (
          <IconComponent size={16} color={iconColor} strokeWidth={1.75} />
        ) : null}
        <Text style={[type.label, { fontSize: 15, flexGrow: 1, flexShrink: 1, color: textColor }]}>
          {label}
        </Text>
        {selected && variant === CHIP_VARIANT.DEFAULT && (
          <Animated.View entering={FadeIn.duration(150)}>
            <Check size={16} color={colors.accent} strokeWidth={2.5} />
          </Animated.View>
        )}
        {variant === CHIP_VARIANT.CUSTOM && onRemove && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onRemove();
            }}
            hitSlop={12}
            style={{ padding: space.xs }}
            accessibilityRole="button"
            accessibilityLabel={t('diagnoseV2.removeOption', { label })}
          >
            <X size={14} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      {subtitle && (
        <Text style={[type.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
      )}
    </Pressable>
  );
}
