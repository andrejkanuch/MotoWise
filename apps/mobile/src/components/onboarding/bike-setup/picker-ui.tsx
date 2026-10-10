import { Check, ChevronRight, Search } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Children, Fragment } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { radius, space, type } from '@/theme/type';
import { useOnboardingColors } from '../onboarding-colors';

/**
 * Bike-setup picker primitives — the same field card and inset grouped rows the
 * app's sheets use, so the make / model lists read as native searchable lists.
 */

/** A system-face label above a field or group. */
export function PickerLabel({ children }: { children: ReactNode }) {
  const oc = useOnboardingColors();
  return (
    <Text
      style={[
        type.label,
        { color: oc.textSecondary, marginBottom: space.xs, marginLeft: space.xxs },
      ]}
    >
      {children}
    </Text>
  );
}

/** Search field card: surface fill, leading glyph, 48pt. */
export function PickerSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  maxLength,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  maxLength?: number;
}) {
  const oc = useOnboardingColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        backgroundColor: oc.surface,
      }}
    >
      <Search size={17} color={oc.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={oc.textMuted}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        maxLength={maxLength}
        selectionColor={oc.warm}
        style={[type.body, { flex: 1, minHeight: 48, paddingVertical: 0, color: oc.textPrimary }]}
      />
    </View>
  );
}

/** Inset grouped list: one surface card, hairlines between rows. */
export function PickerGroup({ children }: { children: ReactNode }) {
  const oc = useOnboardingColors();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: oc.surface,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional children
        <Fragment key={i}>
          {i > 0 ? (
            <View style={{ height: 1, marginLeft: space.md, backgroundColor: oc.line }} />
          ) : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** A tappable row: optional leading badge, title, optional trailing detail. */
export function PickerRow({
  title,
  detail,
  leading,
  selected,
  chevron,
  accent,
  onPress,
  accessibilityLabel,
  testID,
}: {
  title: string;
  detail?: string;
  leading?: ReactNode;
  selected?: boolean;
  chevron?: boolean;
  /** Copper title — for actions inside a list ("Other make"). */
  accent?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const oc = useOnboardingColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={selected === undefined ? undefined : { selected }}
      android_ripple={{ color: oc.line }}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        backgroundColor: pressed && process.env.EXPO_OS === 'ios' ? oc.surface2 : 'transparent',
      })}
    >
      {leading}
      <Text style={[type.body, { flex: 1, color: accent ? oc.warm2 : oc.textPrimary }]}>
        {title}
      </Text>
      {detail ? <Text style={[type.figureSmall, { color: oc.textMuted }]}>{detail}</Text> : null}
      {selected ? <Check size={18} strokeWidth={3} color={oc.warm} /> : null}
      {chevron ? <ChevronRight size={18} color={oc.textMuted} /> : null}
    </Pressable>
  );
}

/** The make-initial badge (brand colour is identity data, bone ink in both schemes). */
export function MakeBadge({ makeName, color }: { makeName: string; color?: string }) {
  const oc = useOnboardingColors();
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: radius.chip / 1.5,
        borderCurve: 'continuous',
        backgroundColor: color ?? oc.brandMarkFallback,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[type.label, { color: oc.brandMarkInk }]} maxFontSizeMultiplier={1.2}>
        {makeName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
