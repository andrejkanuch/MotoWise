import { Host, Toggle } from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  environment,
  tint as tintModifier,
} from '@expo/ui/swift-ui/modifiers';
import { palette } from '@motovault/design-system';
import { useMemo } from 'react';
import { Switch } from 'react-native';

interface NativeToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  tint?: string;
  disabled?: boolean;
  /**
   * The toggle sits on a dark surface whatever the system scheme (the bike
   * hub): iOS draws it in the dark scheme, whose off track stays visible on a
   * dark card; Android uses `offTrack` for the off track.
   */
  darkSurface?: boolean;
  /** Android off-track colour (SwiftUI's off track is the system's own). */
  offTrack?: string;
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
  darkSurface = false,
  offTrack = palette.neutral300,
}: NativeToggleProps) {
  const modifiers = useMemo(() => {
    const mods = [tintModifier(tint)];
    if (disabled) mods.push(disabledModifier(true));
    if (darkSurface) mods.push(environment('colorScheme', 'dark'));
    return mods;
  }, [tint, disabled, darkSurface]);

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
      trackColor={{ false: offTrack, true: tint }}
      thumbColor={palette.white}
      disabled={disabled}
    />
  );
}
