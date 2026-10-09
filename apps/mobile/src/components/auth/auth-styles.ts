import type { ViewStyle } from 'react-native';
import { radius, space } from '../../theme/type';

/**
 * Shared auth button frame (Race Plate). Fields live in `auth-field.tsx`; this
 * is the 52pt row used by the OAuth and "Continue with email" buttons.
 */
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
