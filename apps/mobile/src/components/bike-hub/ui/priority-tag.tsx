import type { MaintenancePriority } from '@motovault/graphql';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import {
  HUB_FIGURE_STRONG,
  HUB_RADIUS,
  type HubColorKey,
  type HubCopyKey,
  PRIORITY_TAG,
  type TagVariant,
  useHubTheme,
  VARIANT_TAG,
} from './tokens';

const TAG_SIZE = 12;
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

function resolve(props: PriorityTagProps): {
  labelKey: HubCopyKey;
  bg: HubColorKey;
  fg: HubColorKey;
} {
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
  const hub = useHubTheme();
  const tag = resolve(props);
  const { labelKey } = tag;
  const bg = hub[tag.bg];
  const fg = hub[tag.fg];
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
          ...HUB_FIGURE_STRONG,
          fontSize: TAG_SIZE,
          lineHeight: 14,
          letterSpacing: TAG_SIZE * 0.04,
          color: fg,
        }}
      >
        {t(labelKey)}
      </Text>
    </View>
  );
}
