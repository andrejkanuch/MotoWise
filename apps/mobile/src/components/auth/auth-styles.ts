import type { TextStyle, ViewStyle } from 'react-native';
import { radius, space, type } from '../../theme/type';
import type { OnboardingColors } from '../onboarding/onboarding-colors';

/**
 * Shared auth field + button styles (Race Plate). Used by the login and
 * register screens, the onboarding account / sign-in steps and the account
 * prompt sheet so every auth surface reads as one control set.
 */
export const authInput = {
  ...type.body,
  borderWidth: 1,
  borderRadius: radius.control,
  borderCurve: 'continuous',
  minHeight: 52,
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
} as const satisfies TextStyle;

/** The scheme's colors for `authInput` — `style={[authInput, authInputColors(oc)]}`. */
export function authInputColors(oc: OnboardingColors): TextStyle {
  return { backgroundColor: oc.surface2, borderColor: oc.cardBorderDefault, color: oc.textPrimary };
}

/** A 52pt auth button; pass copper for the primary action, surface2 for the rest. */
export function authButton(backgroundColor: string, borderColor?: string): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    backgroundColor,
    borderWidth: borderColor ? 1 : 0,
    borderColor: borderColor ?? 'transparent',
  };
}
