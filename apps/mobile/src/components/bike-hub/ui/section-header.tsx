import { Pressable, Text, View } from 'react-native';
import type { DueTone } from '../../../lib/bike-hub/constants';
import { triggerImpact } from '../../../utils/haptics';
import { DUE_TONE_COLOR, HUB_TOUCH_TARGET, SYSTEM_WEIGHT, useHubTheme } from './tokens';

const TITLE_SIZE = 17;
const TITLE_LINE_HEIGHT = 22;
const ACTION_LINE_HEIGHT = 18;
// Vertical slop that grows the one-line text action to a full touch target.
const ACTION_SLOP = Math.ceil((HUB_TOUCH_TARGET - ACTION_LINE_HEIGHT) / 2);

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface SectionHeaderProps {
  label: string;
  /** Appended to the label as "Label · 6". */
  count?: number;
  /** Colours the title (e.g. the Overdue group in R2). Ink by default. */
  tone?: DueTone;
  /** Copper text action on the right. */
  action?: SectionHeaderAction;
  /** Grey rule-of-sorting hint on the right, when there is no action. */
  hint?: string;
  /** Title colour for a header that sits on a non-hub ground (the interim Bike tab). */
  color?: string;
}

/**
 * The one section header of the bike hub: a system semibold title in sentence
 * case with an optional count, and either a copper text action or a grey hint
 * on the right. No eyebrows, no serif (DESIGN.md → Typography).
 */
export function SectionHeader({ label, count, tone, action, hint, color }: SectionHeaderProps) {
  const hub = useHubTheme();
  const title = count === undefined ? label : `${label} · ${count}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: 4,
        paddingHorizontal: 2,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          flexShrink: 1,
          ...SYSTEM_WEIGHT.semibold,
          fontSize: TITLE_SIZE,
          lineHeight: TITLE_LINE_HEIGHT,
          color: tone ? hub[DUE_TONE_COLOR[tone]] : (color ?? hub.text),
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={() => {
            triggerImpact();
            action.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={{ top: ACTION_SLOP, bottom: ACTION_SLOP, left: 12, right: 12 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              ...SYSTEM_WEIGHT.semibold,
              fontSize: 15,
              lineHeight: ACTION_LINE_HEIGHT,
              color: hub.copperText,
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
      {!action && hint ? (
        <Text style={{ ...SYSTEM_WEIGHT.regular, fontSize: 12, color: hub.muted }}>{hint}</Text>
      ) : null}
    </View>
  );
}
