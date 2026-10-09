import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from '@expo/ui/jetpack-compose';
import { useEditorialTheme } from '../../theme/editorial';
import type { ThemedSegmentedControlProps } from './themed-segmented-control';

/** Android: Material segmented buttons in graphite tokens (selection is a raised surface, never copper). */
export function ThemedSegmentedControl({
  values,
  selectedIndex,
  onChange,
  style,
}: ThemedSegmentedControlProps) {
  const { t, isDark } = useEditorialTheme();
  const colors = {
    activeContainerColor: t.surface3,
    activeContentColor: t.ink,
    activeBorderColor: t.line,
    inactiveContainerColor: t.surface,
    inactiveContentColor: t.ink2,
    inactiveBorderColor: t.line,
  };
  return (
    <Host matchContents={{ vertical: true }} style={style} colorScheme={isDark ? 'dark' : 'light'}>
      <SingleChoiceSegmentedButtonRow>
        {values.map((label, index) => (
          <SegmentedButton
            key={label}
            selected={index === selectedIndex}
            onClick={() => onChange(index)}
            colors={colors}
          >
            <SegmentedButton.Label>
              <Text>{label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
