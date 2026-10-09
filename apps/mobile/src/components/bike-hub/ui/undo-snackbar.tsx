import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { triggerImpact } from '../../../utils/haptics';
import { HUB_HEIGHT, HUB_RADIUS, HUB_TOUCH_TARGET, SYSTEM_WEIGHT, useHubTheme } from './tokens';

const ENTER_MS = 250;
const EXIT_MS = 200;
const ACTION_SLOP = Math.ceil((HUB_TOUCH_TARGET - 20) / 2);

export interface SnackbarAction {
  label: string;
  onPress: () => void;
}

interface UndoSnackbarProps {
  message: string;
  /** The primary action — "Undo". */
  action: SnackbarAction;
  /** A second action left of it (R2: "Add details"). */
  secondaryAction?: SnackbarAction;
}

function ActionText({ action }: { action: SnackbarAction }) {
  const hub = useHubTheme();
  return (
    <Pressable
      onPress={() => {
        triggerImpact();
        action.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      hitSlop={{ top: ACTION_SLOP, bottom: ACTION_SLOP, left: 8, right: 8 }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ ...SYSTEM_WEIGHT.bold, fontSize: 14, color: hub.copperText }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

/**
 * "Note deleted · Undo". Rendered by the screen while a deferred delete is
 * pending (`useDeferredDelete` owns the timer); the screen positions it above
 * its composer or action pill. Announced politely to screen readers.
 */
export function UndoSnackbar({ message, action, secondaryAction }: UndoSnackbarProps) {
  const hub = useHubTheme();
  return (
    <Animated.View
      entering={FadeInUp.duration(ENTER_MS)}
      exiting={FadeOutDown.duration(EXIT_MS)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        minHeight: HUB_HEIGHT.secondary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: HUB_RADIUS.button,
        borderCurve: 'continuous',
        backgroundColor: hub.raised,
        borderWidth: 1,
        borderColor: hub.hairlineStrong,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <Text style={{ flex: 1, ...SYSTEM_WEIGHT.medium, fontSize: 14, color: hub.text }}>
        {message}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        {secondaryAction ? <ActionText action={secondaryAction} /> : null}
        <ActionText action={action} />
      </View>
    </Animated.View>
  );
}
