import { Text, View } from 'react-native';
import type { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';

const STAT_LABEL_STYLE = type.label;

const STAT_VALUE_STYLE = {
  ...type.figureSmall,
  marginTop: space.xxs,
};

/**
 * One label/value cell in the cost-of-ownership card. The card carries four of
 * them across two rows (purchase + all expenses, then invested + cost of
 * riding); inlining the styles four times is what the mobile "inline unless
 * reused" rule stops covering.
 */
export function StatColumn({
  theme,
  label,
  value,
}: {
  theme: ReturnType<typeof useEditorialTheme>['t'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...STAT_LABEL_STYLE, color: theme.ink2 }}>{label}</Text>
      <Text style={{ ...STAT_VALUE_STYLE, color: theme.ink }}>{value}</Text>
    </View>
  );
}
