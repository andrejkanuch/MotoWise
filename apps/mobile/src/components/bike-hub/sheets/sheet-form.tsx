import DateTimePicker from '@expo/ui/community/datetime-picker';
import { MaintenancePriority } from '@motovault/graphql';
import { Calendar, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../../hooks/use-currency';
import { formatCurrencyInput, ZERO_DECIMAL_CURRENCIES } from '../../../lib/expense-constants';
import {
  EDITORIAL_SCHEME,
  type EditorialTokens,
  useEditorialTheme,
} from '../../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';
import { expenseIconFor } from './log-options';
import { sheetBottomPadding } from './sheet-scroll';

/**
 * The one anatomy every form sheet shares (Add expense, Add / Edit task,
 * Complete task, Add document, ride expense): a plain condensed title at the
 * top left, inset grouped sections with a system caption above each, and a
 * footer pinned above the keyboard with Cancel beside the copper primary.
 */

/** Footer buttons and grouped rows share one height. */
export const SHEET_CONTROL_HEIGHT = 52;
/** Icons in grouped rows. */
const ROW_ICON_SIZE = 18;
const PRESSED_OPACITY = 0.7;

/** Screen padding of a form sheet's scroll content. */
export const SHEET_CONTENT_STYLE: ViewStyle = {
  paddingHorizontal: space.md,
  paddingTop: space.md,
  paddingBottom: space.xl,
  gap: space.xl,
};

/** Text style of a free-text input inside a grouped section. */
export function inputTextStyle(theme: EditorialTokens): TextStyle {
  return { ...type.body, color: theme.ink };
}

export function SheetTitle({ children }: { children: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <Text accessibilityRole="header" style={[type.sheetTitle, { color: theme.ink }]}>
      {children}
    </Text>
  );
}

interface FormSectionProps {
  label: ReactNode;
  /** Right side of the caption row (a character counter). */
  trailing?: ReactNode;
  children: ReactNode;
  /** False = the children draw their own surface (a chip row). */
  card?: boolean;
  testID?: string;
}

/** A system caption, then the section's inset grouped card. */
export function FormSection({ label, trailing, children, card = true, testID }: FormSectionProps) {
  const { t: theme } = useEditorialTheme();
  return (
    <View testID={testID}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.xs,
          marginBottom: space.xs,
          marginHorizontal: space.xxs,
        }}
      >
        <Text style={[type.label, { color: theme.ink3, flexShrink: 1 }]}>{label}</Text>
        {trailing}
      </View>
      {card ? <FormCard>{children}</FormCard> : children}
    </View>
  );
}

export function FormCard({ children }: { children: ReactNode }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

/** Hairline between rows, inset past the row icon. */
export function FormDivider({ inset = space.md }: { inset?: number }) {
  const { t: theme } = useEditorialTheme();
  return <View style={{ height: 0.5, backgroundColor: theme.line, marginLeft: inset }} />;
}

/** Inset of a divider that follows an icon row. */
export const ROW_DIVIDER_INSET = space.md + ROW_ICON_SIZE + space.sm;

interface FormRowProps {
  icon: LucideIcon;
  label: string;
  /** Second line under the label (e.g. the current reading). */
  hint?: string;
  /** Set = the row is a button (opens a picker). */
  onPress?: () => void;
  /** Right side: a value, an input, a toggle. */
  children?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

/** One grouped row: neutral icon, system label, value or control on the right. */
export function FormRow({
  icon: Icon,
  label,
  hint,
  onPress,
  children,
  accessibilityLabel,
  testID,
}: FormRowProps) {
  const { t: theme } = useEditorialTheme();
  const content = (
    <>
      <Icon size={ROW_ICON_SIZE} color={theme.ink2} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: theme.ink }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: theme.ink3 }]}>{hint}</Text> : null}
      </View>
      {children}
    </>
  );
  const rowStyle: ViewStyle = {
    minHeight: SHEET_CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  };
  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: theme.line2 }}
      style={({ pressed }) => ({
        ...rowStyle,
        opacity: pressed && process.env.EXPO_OS === 'ios' ? PRESSED_OPACITY : 1,
      })}
    >
      {content}
    </Pressable>
  );
}

/** A number typed at the right of a row ("15000 km"). */
export function RowNumberInput(props: TextInputProps & { unit?: string }) {
  const { t: theme } = useEditorialTheme();
  const { unit, style, ...input } = props;
  return (
    <>
      <TextInput
        keyboardType="number-pad"
        placeholderTextColor={theme.ink4}
        textAlign="right"
        {...input}
        style={[type.body, { color: theme.ink, minWidth: 96, paddingVertical: space.xxs }, style]}
      />
      {unit ? <Text style={[type.subhead, { color: theme.ink3 }]}>{unit}</Text> : null}
    </>
  );
}

export const TEXT_ACTION_TONE = { ACTION: 'action', DANGER: 'danger' } as const;
export type TextActionTone = (typeof TEXT_ACTION_TONE)[keyof typeof TEXT_ACTION_TONE];

/** Copper text action inside a section (Done / Clear under a date picker). */
export function TextAction({
  label,
  onPress,
  tone = TEXT_ACTION_TONE.ACTION,
}: {
  label: string;
  onPress: () => void;
  tone?: TextActionTone;
}) {
  const { t: theme } = useEditorialTheme();
  return (
    <Pressable
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      hitSlop={space.xs}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: space.xs,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <Text
        style={[
          type.subhead,
          SYSTEM_WEIGHT.semibold,
          { color: tone === TEXT_ACTION_TONE.DANGER ? theme.danger : theme.warm2 },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** A category's own hue, as a dot before the label. */
  dotColor?: string;
  /** Grow to share the row equally (priority). */
  grow?: boolean;
  testID?: string;
}

/** Selectable chip: graphite fill; selected = copper border and copper text. */
export function ChoiceChip({
  label,
  selected,
  onPress,
  dotColor,
  grow = false,
  testID,
}: ChoiceChipProps) {
  const { t: theme } = useEditorialTheme();
  const border = selected ? theme.warm : theme.surface2;
  const ink = selected ? theme.warm2 : theme.ink2;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: theme.line2 }}
      style={({ pressed }) => ({
        flex: grow ? 1 : undefined,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radius.chip,
        borderCurve: 'continuous',
        backgroundColor: theme.surface2,
        borderWidth: 1.5,
        borderColor: border,
        overflow: 'hidden',
        opacity: pressed && process.env.EXPO_OS === 'ios' ? PRESSED_OPACITY : 1,
      })}
    >
      {dotColor ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[type.label, selected ? SYSTEM_WEIGHT.semibold : null, { color: ink }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The primary's state: ready to save, saving / invalid, or saved. */
export const SHEET_PRIMARY_STATE = {
  READY: 'ready',
  DISABLED: 'disabled',
  DONE: 'done',
} as const;
export type SheetPrimaryState = (typeof SHEET_PRIMARY_STATE)[keyof typeof SHEET_PRIMARY_STATE];

interface SheetFooterProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryState: SheetPrimaryState;
  /** A DONE primary can still be pressed (Add expense: "Done" closes the sheet). */
  primaryPressableWhenDone?: boolean;
  primaryIcon?: LucideIcon;
  primaryTestID?: string;
  onCancel: () => void;
  cancelDisabled?: boolean;
  /** Primary only (a sheet whose only way out is the primary or a swipe). */
  hideCancel?: boolean;
}

/**
 * Cancel (graphite) + primary (copper, dark ink), 52 pt, pinned above the
 * keyboard so Save is reachable while typing.
 */
export function SheetFooter({
  primaryLabel,
  onPrimary,
  primaryState,
  primaryPressableWhenDone = false,
  primaryIcon: PrimaryIcon,
  primaryTestID,
  onCancel,
  cancelDisabled = false,
  hideCancel = false,
}: SheetFooterProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const fill = {
    [SHEET_PRIMARY_STATE.READY]: theme.warm,
    [SHEET_PRIMARY_STATE.DISABLED]: theme.surface3,
    [SHEET_PRIMARY_STATE.DONE]: theme.success,
  }[primaryState];
  const ink = {
    [SHEET_PRIMARY_STATE.READY]: theme.onWarm,
    [SHEET_PRIMARY_STATE.DISABLED]: theme.ink4,
    [SHEET_PRIMARY_STATE.DONE]: theme.onWarm,
  }[primaryState];
  const primaryDisabled =
    primaryState === SHEET_PRIMARY_STATE.DISABLED ||
    (primaryState === SHEET_PRIMARY_STATE.DONE && !primaryPressableWhenDone);

  const androidOpenedOffset =
    process.env.EXPO_OS === 'android' ? sheetBottomPadding(insets.bottom) + insets.bottom : 0;

  return (
    // On Android the keyboard height already spans the navigation-bar inset that
    // the footer pads for, so the lifted footer floated that much too high.
    <KeyboardStickyView offset={{ closed: 0, opened: androidOpenedOffset }}>
      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: sheetBottomPadding(insets.bottom),
          backgroundColor: theme.bg,
          borderTopWidth: 0.5,
          borderTopColor: theme.line,
        }}
      >
        {hideCancel ? null : (
          <Pressable
            onPress={onCancel}
            disabled={cancelDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: cancelDisabled }}
            android_ripple={{ color: theme.line2 }}
            style={({ pressed }) => ({
              height: SHEET_CONTROL_HEIGHT,
              paddingHorizontal: space.lg,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              opacity: cancelDisabled ? 0.45 : pressed ? PRESSED_OPACITY : 1,
            })}
          >
            <Text style={[type.bodyStrong, { color: theme.ink }]}>{t('common.cancel')}</Text>
          </Pressable>
        )}
        <Pressable
          testID={primaryTestID}
          onPress={onPrimary}
          disabled={primaryDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: primaryDisabled }}
          android_ripple={{ color: theme.line2 }}
          style={({ pressed }) => ({
            flex: 1,
            height: SHEET_CONTROL_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.xs,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: fill,
            overflow: 'hidden',
            opacity: pressed && !primaryDisabled ? 0.85 : 1,
          })}
        >
          {PrimaryIcon ? <PrimaryIcon size={18} color={ink} strokeWidth={2.5} /> : null}
          <Text numberOfLines={1} style={[type.bodyStrong, { color: ink }]}>
            {primaryLabel}
          </Text>
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
}

const DATE_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};
const IOS_INLINE_PICKER_HEIGHT = 320;

interface FormDateRowProps {
  label: string;
  value: Date | null;
  /** What the row says while no date is set. */
  emptyLabel?: string;
  open: boolean;
  /** Row tapped: open or close the inline picker. */
  onToggle: () => void;
  onClose: () => void;
  onChange: (date: Date) => void;
  /** Set = a "Clear" action under the picker. */
  onClear?: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

/**
 * A date row that opens the native picker in place: inline calendar on iOS
 * (with Done / Clear under it), the Material dialog on Android.
 */
export function FormDateRow({
  label,
  value,
  emptyLabel,
  open,
  onToggle,
  onClose,
  onChange,
  onClear,
  minimumDate,
  maximumDate,
  testID,
}: FormDateRowProps) {
  const { t } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();
  const shown = value ? value.toLocaleDateString(undefined, DATE_LABEL_FORMAT) : emptyLabel;
  const isIos = process.env.EXPO_OS === 'ios';
  return (
    <>
      <FormRow icon={Calendar} label={label} onPress={onToggle} testID={testID}>
        <Text
          style={[
            type.subhead,
            SYSTEM_WEIGHT.semibold,
            { color: value ? theme.warm2 : theme.ink3 },
          ]}
        >
          {shown}
        </Text>
      </FormRow>
      {open && value ? (
        <View
          style={{ borderTopWidth: 0.5, borderTopColor: theme.line, paddingHorizontal: space.xs }}
        >
          <DateTimePicker
            value={value}
            mode="date"
            display={isIos ? 'inline' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            accentColor={theme.warm}
            themeVariant={isDark ? EDITORIAL_SCHEME.DARK : EDITORIAL_SCHEME.LIGHT}
            onChange={(event, selectedDate) => {
              // Android's dialog fires onChange for both OK and Cancel and must
              // be hidden straight away.
              if (!isIos) onClose();
              if (event.type === 'set' && selectedDate) onChange(selectedDate);
            }}
            style={isIos ? { height: IOS_INLINE_PICKER_HEIGHT } : undefined}
          />
          {isIos ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: space.xs,
                paddingBottom: space.xxs,
                paddingRight: space.xxs,
              }}
            >
              {onClear ? (
                <TextAction
                  label={t('maintenance.clearDate', { defaultValue: 'Clear' })}
                  tone={TEXT_ACTION_TONE.DANGER}
                  onPress={onClear}
                />
              ) : null}
              <TextAction label={t('common.done', { defaultValue: 'Done' })} onPress={onClose} />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const PRIORITY_ORDER = [
  MaintenancePriority.Low,
  MaintenancePriority.Medium,
  MaintenancePriority.High,
  MaintenancePriority.Critical,
] as const;

/** Priority → its dot: neutral for low and medium, status ink for high and critical. */
function priorityDot(theme: EditorialTokens, priority: MaintenancePriority): string {
  const dot: Record<MaintenancePriority, string> = {
    [MaintenancePriority.Low]: theme.ink3,
    [MaintenancePriority.Medium]: theme.ink2,
    [MaintenancePriority.High]: theme.dueInk,
    [MaintenancePriority.Critical]: theme.overdueInk,
  };
  return dot[priority];
}

/** The four priorities as one row of equal chips; selection is copper like every chip. */
export function PriorityPicker({
  value,
  onChange,
}: {
  value: MaintenancePriority;
  onChange: (priority: MaintenancePriority) => void;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }}>
      {PRIORITY_ORDER.map((p) => (
        <ChoiceChip
          key={p}
          testID={`priority-${p}`}
          grow
          label={t(`maintenance.priority_${p}`)}
          dotColor={priorityDot(theme, p)}
          selected={value === p}
          onPress={() => onChange(p)}
        />
      ))}
    </View>
  );
}

/** The amount reads as the sheet's one big figure (condensed, tabular). */
const AMOUNT_FIGURE: TextStyle = { ...type.figure, fontSize: 40, lineHeight: 44 };
const AMOUNT_ROW_HEIGHT = 76;
/** Largest amount an expense accepts. */
export const MAX_EXPENSE_AMOUNT = 99999.99;

interface AmountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * The expense amount: the rider's currency receipt and symbol, then the number
 * as a big condensed figure. A caption warns past the maximum.
 */
export function AmountField({ label, value, onChange, autoFocus, testID }: AmountFieldProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { currency, symbol } = useCurrency();
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency);
  const AmountIcon = expenseIconFor(currency);
  const tooHigh = (Number.parseFloat(value) || 0) > MAX_EXPENSE_AMOUNT;
  return (
    <View>
      <FormSection label={label}>
        <View
          style={{
            minHeight: AMOUNT_ROW_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
          }}
        >
          <AmountIcon size={22} color={theme.ink2} strokeWidth={2} />
          <Text style={[AMOUNT_FIGURE, { color: theme.ink3 }]}>{symbol}</Text>
          <TextInput
            testID={testID}
            value={value}
            onChangeText={(val) => onChange(formatCurrencyInput(val, currency))}
            placeholder={zeroDecimal ? '0' : '0.00'}
            placeholderTextColor={theme.ink4}
            keyboardType={zeroDecimal ? 'number-pad' : 'decimal-pad'}
            accessibilityLabel={label}
            style={[AMOUNT_FIGURE, { flex: 1, color: theme.ink, paddingVertical: space.xs }]}
            autoFocus={autoFocus}
          />
        </View>
      </FormSection>
      {tooHigh ? (
        <Text
          style={[
            type.caption,
            { color: theme.danger, marginTop: space.xs, marginLeft: space.xxs },
          ]}
        >
          {t('expenses.amountTooHigh', { defaultValue: 'Maximum amount is 99,999.99' })}
        </Text>
      ) : null}
    </View>
  );
}
