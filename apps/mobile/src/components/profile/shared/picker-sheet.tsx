import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';

interface PickerSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: readonly T[];
  selectedValue: T;
  onSelect: (value: T) => void;
  renderLabel: (value: T, selected: boolean) => ReactNode;
  renderLeft?: (value: T, selected: boolean) => ReactNode;
}

/**
 * Bottom form-sheet picker used by Settings > Language, Settings > Currency, etc.
 * Consolidates the prior two near-duplicate modals into a single parametric sheet.
 */
export function PickerSheet<T extends string>({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  renderLabel,
  renderLeft,
}: PickerSheetProps<T>) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderColor: isDark ? palette.neutral700 : palette.neutral200,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: palette.primary500 }}>
              {t('common.done', { defaultValue: 'Done' })}
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
          {options.map((opt) => {
            const selected = selectedValue === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onSelect(opt);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: pressed
                    ? isDark
                      ? palette.neutral800
                      : palette.neutral100
                    : selected
                      ? isDark
                        ? `${palette.primary500}20`
                        : `${palette.primary500}10`
                      : 'transparent',
                })}
              >
                {renderLeft?.(opt, selected)}
                <View style={{ flex: 1 }}>{renderLabel(opt, selected)}</View>
                {selected ? (
                  <Check
                    size={18}
                    color={isDark ? palette.primary400 : palette.primary600}
                    strokeWidth={2.5}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
