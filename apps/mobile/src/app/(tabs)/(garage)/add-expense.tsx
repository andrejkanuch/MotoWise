import { palette } from '@motovault/design-system';
import { LogExpenseDocument } from '@motovault/graphql';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, DollarSign, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const CATEGORIES = ['fuel', 'maintenance', 'parts', 'gear'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { color: string; label: string }> = {
  fuel: { color: palette.warning500, label: 'Fuel' },
  maintenance: { color: palette.primary500, label: 'Maintenance' },
  parts: { color: palette.success500, label: 'Parts' },
  gear: { color: palette.danger500, label: 'Gear' },
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/[^0-9.]/g, '');
  const parts = digits.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join('')}`;
  if (parts[1] && parts[1].length > 2) return `${parts[0]}.${parts[1].slice(0, 2)}`;
  return digits;
}

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('fuel');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const parsedAmount = Number.parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= 99999.99 && date <= new Date();

  const logMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(LogExpenseDocument, {
        input: {
          motorcycleId,
          amount: parsedAmount,
          category,
          date: formatDate(date),
          description: description.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
      setSaved(true);
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setTimeout(() => router.back(), 600);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('expenses.createFailed', { defaultValue: 'Failed to log expense. Please try again.' }),
      );
    },
  });

  const cardBg = isDark ? palette.neutral800 : palette.white;
  const sectionGap = 24;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: sectionGap }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Amount input */}
      <Animated.View entering={FadeIn.duration(250)}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.successBgDark : palette.successBgLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DollarSign size={18} color={palette.success500} strokeWidth={2} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            $
          </Text>
          <TextInput
            value={amount}
            onChangeText={(val) => setAmount(formatCurrencyInput(val))}
            placeholder="0.00"
            placeholderTextColor={palette.neutral400}
            keyboardType="decimal-pad"
            style={{
              flex: 1,
              fontSize: 24,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
              paddingVertical: 2,
            }}
            autoFocus
          />
        </View>
      </Animated.View>

      {/* Category pills */}
      <Animated.View entering={FadeInDown.delay(50).duration(250)}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: palette.neutral500,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          {t('expenses.category', { defaultValue: 'Category' })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CATEGORIES.map((c) => {
            const selected = category === c;
            const meta = CATEGORY_META[c];
            return (
              <Pressable
                key={c}
                onPress={() => {
                  haptic();
                  setCategory(c);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  backgroundColor: selected
                    ? `${meta.color}18`
                    : isDark
                      ? palette.neutral800
                      : palette.white,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected
                    ? meta.color
                    : isDark
                      ? palette.neutral700
                      : palette.neutral200,
                  boxShadow: selected ? 'none' : isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: meta.color,
                    marginBottom: 4,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selected ? '700' : '500',
                    color: selected ? meta.color : isDark ? palette.neutral400 : palette.neutral600,
                    textTransform: 'capitalize',
                  }}
                >
                  {t(`expenses.category_${c}`, { defaultValue: meta.label })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Date picker */}
      <Animated.View entering={FadeInDown.delay(100).duration(250)}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: palette.neutral500,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          {t('expenses.date', { defaultValue: 'Date' })}
        </Text>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <Pressable
            onPress={() => {
              haptic();
              setShowDatePicker(!showDatePicker);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.primary900 : palette.primary50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={16} color={palette.primary500} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                }}
              >
                {t('expenses.date', { defaultValue: 'Date' })}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: palette.primary500,
                fontWeight: '600',
              }}
            >
              {date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </Pressable>

          {showDatePicker && (
            <View
              style={{
                borderTopWidth: 0.5,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                paddingHorizontal: 8,
              }}
            >
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setDate(selectedDate);
                }}
                style={{ height: 320 }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  paddingBottom: 8,
                  paddingRight: 8,
                }}
              >
                <Pressable
                  onPress={() => {
                    haptic();
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary500 }}>
                    {t('common.done', { defaultValue: 'Done' })}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Description */}
      <Animated.View entering={FadeInDown.delay(150).duration(250)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              marginLeft: 4,
            }}
          >
            {t('expenses.description', { defaultValue: 'Description' })}{' '}
            <Text style={{ fontWeight: '400' }}>
              ({t('common.optional', { defaultValue: 'optional' })})
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: description.length > 180 ? palette.warning500 : palette.neutral400,
              marginRight: 4,
            }}
          >
            {description.length}/200
          </Text>
        </View>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <TextInput
            value={description}
            onChangeText={(val) => setDescription(val.slice(0, 200))}
            placeholder={t('expenses.descriptionPlaceholder', {
              defaultValue: 'e.g. Shell V-Power, rear brake pads...',
            })}
            placeholderTextColor={palette.neutral400}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{
              fontSize: 15,
              color: isDark ? palette.neutral50 : palette.neutral950,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 14,
              minHeight: 80,
            }}
          />
        </View>
      </Animated.View>

      {/* Save Button */}
      <Animated.View entering={FadeInDown.delay(200).duration(250)}>
        <Pressable
          onPress={() => {
            haptic();
            logMutation.mutate();
          }}
          disabled={logMutation.isPending || !isValid || saved}
          style={{
            backgroundColor: saved
              ? palette.success500
              : isValid
                ? palette.primary500
                : isDark
                  ? palette.neutral700
                  : palette.neutral300,
            borderRadius: 14,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 16,
            gap: 8,
          }}
        >
          {saved ? (
            <Check size={18} color={palette.white} strokeWidth={2.5} />
          ) : (
            <Plus size={18} color={palette.white} strokeWidth={2.5} />
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
            {saved
              ? t('expenses.saved', { defaultValue: 'Expense Logged!' })
              : logMutation.isPending
                ? t('common.saving', { defaultValue: 'Saving...' })
                : t('expenses.save', { defaultValue: 'Log Expense' })}
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}
