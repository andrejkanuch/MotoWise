import { Check, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { tint } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { useOnboardingColors } from './onboarding-colors';

export const OPTION_MODE = {
  SINGLE: 'single',
  MULTI: 'multi',
} as const;
export type OptionMode = (typeof OPTION_MODE)[keyof typeof OPTION_MODE];

export interface OnboardingOption<K extends string> {
  key: K;
  label: string;
  description?: string;
  /** Optional plain leading glyph (no tile). */
  icon?: LucideIcon;
  testID?: string;
}

interface OnboardingOptionListProps<K extends string> {
  options: ReadonlyArray<OnboardingOption<K>>;
  isSelected: (key: K) => boolean;
  onSelect: (key: K) => void;
  mode?: OptionMode;
  /** Stagger the rows in (FadeInUp, 50ms apart). Off when Reduce Motion is on. */
  animated?: boolean;
}

const CHECK_SIZE = 24;

/**
 * Choice rows for onboarding questions — one row per answer, 56pt+, system
 * type. Selection is a copper border plus a copper check; never a filled tile.
 * Single-choice rows are radios, multi-choice rows checkboxes, for VoiceOver /
 * TalkBack.
 */
export function OnboardingOptionList<K extends string>({
  options,
  isSelected,
  onSelect,
  mode = OPTION_MODE.SINGLE,
  animated = true,
}: OnboardingOptionListProps<K>) {
  const oc = useOnboardingColors();
  const reduceMotion = useReducedMotion();
  const multi = mode === OPTION_MODE.MULTI;

  return (
    <View style={{ gap: space.xs }} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {options.map((option, index) => {
        const selected = isSelected(option.key);
        const Icon = option.icon;
        return (
          <Animated.View
            key={option.key}
            entering={
              animated && !reduceMotion ? FadeInUp.delay(index * 50).duration(240) : undefined
            }
          >
            <Pressable
              testID={option.testID}
              onPress={() => {
                triggerImpact();
                onSelect(option.key);
              }}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={multi ? { checked: selected } : { selected }}
              accessibilityLabel={
                option.description ? `${option.label}, ${option.description}` : option.label
              }
              android_ripple={{ color: oc.line, foreground: true }}
              style={({ pressed }) => ({
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: oc.surface,
                // Constant 2pt border so selection never shifts the layout.
                borderWidth: 2,
                borderColor: selected ? oc.warm : 'transparent',
                opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
              })}
            >
              {Icon ? <Icon size={20} color={selected ? oc.textPrimary : oc.textMuted} /> : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>{option.label}</Text>
                {option.description ? (
                  <Text style={[type.subhead, { color: oc.textSecondary }]}>
                    {option.description}
                  </Text>
                ) : null}
              </View>
              <CheckMark selected={selected} multi={multi} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

function CheckMark({ selected, multi }: { selected: boolean; multi: boolean }) {
  const oc = useOnboardingColors();
  if (selected) {
    return (
      <View
        style={{
          width: CHECK_SIZE,
          height: CHECK_SIZE,
          borderRadius: multi ? radius.chip / 2 : radius.pill,
          borderCurve: 'continuous',
          backgroundColor: oc.warm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={15} strokeWidth={3} color={oc.textOnAccent} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: CHECK_SIZE,
        height: CHECK_SIZE,
        borderRadius: multi ? radius.chip / 2 : radius.pill,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: tint(oc.textMuted, 0.6),
      }}
    />
  );
}
