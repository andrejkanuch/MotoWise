import { palette } from '@motovault/design-system';
import { Host, Toggle } from '@expo/ui/swift-ui';
import { tint as tintModifier, disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';
import { useMemo } from 'react';
import { Switch } from 'react-native';

interface NativeToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  tint?: string;
  disabled?: boolean;
}

/**
 * Cross-platform toggle using Expo UI (SwiftUI) on iOS, RN Switch on Android.
 * Drop-in replacement for `<Switch>` from react-native.
 */
export function NativeToggle({
  value,
  onValueChange,
  tint = palette.primary500,
  disabled,
}: NativeToggleProps) {
  const modifiers = useMemo(() => {
    const mods = [tintModifier(tint)];
    if (disabled) mods.push(disabledModifier(true));
    return mods;
  }, [tint, disabled]);

  if (process.env.EXPO_OS === 'ios') {
    return (
      <Host matchContents>
        <Toggle isOn={value} onIsOnChange={onValueChange} modifiers={modifiers} />
      </Host>
    );
  }

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: palette.neutral300, true: tint }}
      thumbColor={palette.white}
      disabled={disabled}
    />
  );
}
