import SegmentedControl from '@expo/ui/community/segmented-control';
import type { StyleProp, ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';

export type ThemedSegmentedControlProps = {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Segmented control that follows the APP scheme (not the system one). iOS keeps
 * the native UISegmentedControl; Android (`.android.tsx`) draws Material
 * segmented buttons in the graphite ramp instead of the default slate blue.
 */
export function ThemedSegmentedControl({
  values,
  selectedIndex,
  onChange,
  style,
  testID,
}: ThemedSegmentedControlProps) {
  const { isDark } = useEditorialTheme();
  return (
    <SegmentedControl
      testID={testID}
      values={values}
      selectedIndex={selectedIndex}
      appearance={isDark ? 'dark' : 'light'}
      onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
      style={style}
    />
  );
}
