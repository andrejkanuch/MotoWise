import type { LucideIcon } from 'lucide-react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { FormDivider, ROW_DIVIDER_INSET, SHEET_CONTROL_HEIGHT } from '../ui/sheet-form';

/**
 * Rows for the bike sheets' make / model typeahead (Add a Bike, Edit
 * Motorcycle). They sit inside a `FormSection` card: a search row, then the
 * matches as inset grouped rows in the same card, text aligned with the
 * input's text column.
 */

const ROW_ICON_SIZE = 18;
/** At most this many matches are listed; the rider narrows by typing. */
export const MAX_PICKER_RESULTS = 20;
const RESULTS_MAX_HEIGHT = 220;
const RESULT_ROW_MIN_HEIGHT = 44;
const DISABLED_OPACITY = 0.45;
/** Inset grouped row press tint on iOS (ink at 6%). */
const PRESS_TINT_ALPHA = 0.06;
const RESULTS_FADE_MS = 180;

/** The iOS inset-grouped press highlight; Android shows its ripple instead. */
function pressedRowTint(pressed: boolean, ink: string): string {
  return pressed && process.env.EXPO_OS === 'ios' ? tint(ink, PRESS_TINT_ALPHA) : 'transparent';
}

const ROW_STYLE: ViewStyle = {
  minHeight: SHEET_CONTROL_HEIGHT,
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
  paddingHorizontal: space.md,
};

interface IconInputRowProps extends TextInputProps {
  icon: LucideIcon;
}

/** A neutral 18pt icon and a free-text input across the row. */
export function IconInputRow({ icon: Icon, style, ...input }: IconInputRowProps) {
  const { t: theme } = useEditorialTheme();
  return (
    <View style={ROW_STYLE}>
      <Icon size={ROW_ICON_SIZE} color={theme.ink2} strokeWidth={2} />
      <TextInput
        placeholderTextColor={theme.ink4}
        {...input}
        style={[type.body, { flex: 1, color: theme.ink, paddingVertical: space.sm }, style]}
      />
    </View>
  );
}

/** A spinner in place of a row while its list loads. */
export function PickerLoadingRow() {
  const { t: theme } = useEditorialTheme();
  return (
    <View style={[ROW_STYLE, { justifyContent: 'center' }]}>
      <ActivityIndicator color={theme.ink3} />
    </View>
  );
}

/** The row before it can be used (model, until a make and year are set). */
export function PickerDisabledRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View
      accessibilityState={{ disabled: true }}
      style={[ROW_STYLE, { opacity: DISABLED_OPACITY }]}
    >
      <Icon size={ROW_ICON_SIZE} color={theme.ink2} strokeWidth={2} />
      <Text style={[type.body, { flex: 1, color: theme.ink3 }]}>{label}</Text>
    </View>
  );
}

interface PickerValueRowProps {
  icon: LucideIcon;
  value: string;
  /** The rider typed it themselves (not an NHTSA match). */
  custom?: boolean;
  onPress: () => void;
  testID?: string;
}

/** The chosen make or model; tapping it reopens the search. */
export function PickerValueRow({
  icon: Icon,
  value,
  custom,
  onPress,
  testID,
}: PickerValueRowProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const changeLabel = t('garage.tapToChange');
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${value}, ${changeLabel}`}
      android_ripple={{ color: theme.line2 }}
      style={({ pressed }) => ({
        ...ROW_STYLE,
        paddingVertical: space.xs,
        backgroundColor: pressedRowTint(pressed, theme.ink),
      })}
    >
      <Icon size={ROW_ICON_SIZE} color={theme.ink2} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]}>{value}</Text>
        {custom ? (
          <Text style={[type.caption, { color: theme.ink3 }]}>
            {t('garage.customEntry', { defaultValue: 'Custom' })}
          </Text>
        ) : null}
      </View>
      <Text style={[type.caption, { color: theme.ink3 }]}>{changeLabel}</Text>
    </Pressable>
  );
}

interface PickerResultsProps<T> {
  items: readonly T[];
  keyOf: (item: T) => string | number;
  labelOf: (item: T) => string;
  onSelect: (item: T) => void;
  testIDPrefix?: string;
}

/** The matches under the search row, as inset grouped rows in the same card. */
export function PickerResults<T>({
  items,
  keyOf,
  labelOf,
  onSelect,
  testIDPrefix,
}: PickerResultsProps<T>) {
  const { t: theme } = useEditorialTheme();
  const shown = items.slice(0, MAX_PICKER_RESULTS);
  return (
    <Animated.View entering={FadeIn.duration(RESULTS_FADE_MS)}>
      <FormDivider inset={ROW_DIVIDER_INSET} />
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: RESULTS_MAX_HEIGHT }}
      >
        {shown.map((item, i) => (
          <View key={keyOf(item)}>
            {i > 0 ? <FormDivider inset={ROW_DIVIDER_INSET} /> : null}
            <Pressable
              testID={testIDPrefix ? `${testIDPrefix}-${keyOf(item)}` : undefined}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              android_ripple={{ color: theme.line2 }}
              style={({ pressed }) => ({
                minHeight: RESULT_ROW_MIN_HEIGHT,
                justifyContent: 'center',
                paddingVertical: space.sm,
                paddingLeft: ROW_DIVIDER_INSET,
                paddingRight: space.md,
                backgroundColor: pressedRowTint(pressed, theme.ink),
              })}
            >
              <Text style={[type.body, { color: theme.ink }]}>{labelOf(item)}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

/** "No makes found" inside the card, aligned with the input text. */
export function PickerEmptyRow({ label }: { label: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <>
      <FormDivider inset={ROW_DIVIDER_INSET} />
      <View
        style={{
          minHeight: RESULT_ROW_MIN_HEIGHT,
          justifyContent: 'center',
          paddingVertical: space.sm,
          paddingLeft: ROW_DIVIDER_INSET,
          paddingRight: space.md,
        }}
      >
        <Text style={[type.subhead, { color: theme.ink3 }]}>{label}</Text>
      </View>
    </>
  );
}

/** Copper action row: keep what the rider typed as a custom make or model. */
export function PickerCustomRow({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { t: theme } = useEditorialTheme();
  return (
    <>
      <FormDivider inset={ROW_DIVIDER_INSET} />
      <Pressable
        testID={testID}
        onPress={() => {
          triggerImpact();
          onPress();
        }}
        accessibilityRole="button"
        android_ripple={{ color: theme.line2 }}
        style={({ pressed }) => ({
          ...ROW_STYLE,
          paddingVertical: space.xs,
          backgroundColor: pressedRowTint(pressed, theme.ink),
        })}
      >
        <Plus size={ROW_ICON_SIZE} color={theme.warm2} strokeWidth={2.25} />
        <Text style={[type.body, SYSTEM_WEIGHT.semibold, { flex: 1, color: theme.warm2 }]}>
          {label}
        </Text>
      </Pressable>
    </>
  );
}
