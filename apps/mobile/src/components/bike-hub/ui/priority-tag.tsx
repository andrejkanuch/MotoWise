import type { MaintenancePriority } from '@motovault/graphql';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import {
  HUB_FONT,
  HUB_RADIUS,
  type HubCopyKey,
  PRIORITY_TAG,
  type TagVariant,
  VARIANT_TAG,
} from './tokens';

const TAG_SIZE = 10;
const FIXED_WIDTH = 44;

type PriorityTagProps = (
  | { priority: MaintenancePriority }
  | {
      variant: TagVariant;
      /** CRIT fill — a severe recall or an expired document. */
      critical?: boolean;
    }
) & {
  /** 44 px column so titles align in a task list (used from R2). */
  fixedWidth?: boolean;
};

function resolve(props: PriorityTagProps): { labelKey: HubCopyKey; bg: string; fg: string } {
  if ('priority' in props) return PRIORITY_TAG[props.priority];
  const variant = VARIANT_TAG[props.variant];
  return { labelKey: variant.labelKey, ...(props.critical ? variant.critical : variant.normal) };
}

/**
 * Mono tag: CRIT / HIGH / MED / LOW for a task, SAFETY / DOC on attention rows.
 * Priority is always the tag; lateness is always the due line.
 */
export function PriorityTag(props: PriorityTagProps) {
  const { t } = useTranslation();
  const { labelKey, bg, fg } = resolve(props);
  const fixedWidth = props.fixedWidth ?? false;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: HUB_RADIUS.tag,
        borderCurve: 'continuous',
        paddingVertical: 3,
        paddingHorizontal: fixedWidth ? 0 : 6,
        width: fixedWidth ? FIXED_WIDTH : undefined,
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          fontFamily: HUB_FONT.monoMedium,
          fontSize: TAG_SIZE,
          lineHeight: 12,
          letterSpacing: TAG_SIZE * 0.06,
          color: fg,
        }}
      >
        {t(labelKey)}
      </Text>
    </View>
  );
}
