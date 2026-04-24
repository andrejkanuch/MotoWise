import { palette } from '@motovault/design-system';
import { ExpensePhotosDocument, LogExpenseDocument } from '@motovault/graphql';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Camera, Check, ChevronDown, DollarSign, Plus, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ExpensePhotoGallery } from '../../../components/ExpensePhotoGallery';
import { useCurrency } from '../../../hooks/use-currency';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatCurrencyInput,
} from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
import { useEditorialTheme } from '../../../theme/editorial';

const CATEGORIES = [
  'fuel',
  'maintenance',
  'parts',
  'tires',
  'gear',
  'insurance',
  'registration',
  'tolls',
  'parking',
  'modifications',
  'training',
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { color: string; label: string }> = Object.fromEntries(
  CATEGORIES.map((c) => [c, { color: CATEGORY_COLORS[c], label: CATEGORY_LABELS[c] }]),
) as Record<Category, { color: string; label: string }>;

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const { isDark } = useEditorialTheme();
  const { currency, symbol } = useCurrency();
  const queryClient = useQueryClient();

  const userId = useAuthStore((s) => s.session?.user?.id);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('fuel');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saved, setSaved] = useState(false);
  // MOT-143: Receipt photos. Populated after the expense is saved so we have an ID.
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(null);

  // Fetch photos for the newly-created expense (enabled once we have an id)
  const photosQuery = useQuery({
    queryKey: ['expense-photos', savedExpenseId ?? ''],
    queryFn: () => gqlFetcher(ExpensePhotosDocument, { expenseId: savedExpenseId ?? '' }),
    enabled: !!savedExpenseId,
  });
  const photos = photosQuery.data?.expensePhotos ?? [];

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
          currency,
        },
      }),
    onSuccess: (result) => {
      trackEvent(AnalyticsEvent.EXPENSE_ADDED, { category, amount: parsedAmount, currency });
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
      setSaved(true);
      // MOT-143: keep the screen open so the user can attach receipt photos.
      // The expense id is now available from the mutation result.
      setSavedExpenseId(result.logExpense.id);
      triggerNotification(Haptics.NotificationFeedbackType.Success);
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
    <KeyboardAwareScrollView
      bottomOffset={20}
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
            {symbol}
          </Text>
          <TextInput
            value={amount}
            onChangeText={(val) => setAmount(formatCurrencyInput(val, currency))}
            placeholder={currency === 'JPY' ? '0' : '0.00'}
            placeholderTextColor={palette.neutral400}
            keyboardType={currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
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

      {/* Validation hint */}
      {parsedAmount > 99999.99 && (
        <Text style={{ fontSize: 12, color: palette.danger500, marginTop: 4, marginLeft: 4 }}>
          {t('expenses.amountTooHigh', { defaultValue: 'Maximum amount is 99,999.99' })}
        </Text>
      )}

      {/* Category selector */}
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
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {/* Selected category row */}
          <Pressable
            onPress={() => {
              triggerImpact();
              setShowCategoryPicker(!showCategoryPicker);
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
                backgroundColor: `${CATEGORY_META[category].color}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Tag size={16} color={CATEGORY_META[category].color} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                }}
              >
                {t(`expenses.category_${category}`, {
                  defaultValue: CATEGORY_META[category].label,
                })}
              </Text>
            </View>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: CATEGORY_META[category].color,
                marginRight: 4,
              }}
            />
            <ChevronDown
              size={16}
              color={palette.neutral400}
              strokeWidth={2}
              style={{
                transform: [{ rotate: showCategoryPicker ? '180deg' : '0deg' }],
              }}
            />
          </Pressable>

          {/* Category options list */}
          {showCategoryPicker && (
            <View
              style={{
                borderTopWidth: 0.5,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }}
            >
              {CATEGORIES.map((c) => {
                const selected = category === c;
                const meta = CATEGORY_META[c];
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      triggerImpact();
                      setCategory(c);
                      setShowCategoryPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      gap: 12,
                      backgroundColor: selected ? `${meta.color}10` : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: meta.color,
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: selected ? '600' : '400',
                        color: selected
                          ? meta.color
                          : isDark
                            ? palette.neutral200
                            : palette.neutral800,
                      }}
                    >
                      {t(`expenses.category_${c}`, { defaultValue: meta.label })}
                    </Text>
                    {selected && <Check size={16} color={meta.color} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>
          )}
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
              triggerImpact();
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
                display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (process.env.EXPO_OS === 'android') {
                    setShowDatePicker(false);
                  }
                  if (event.type === 'set' && selectedDate) {
                    setDate(selectedDate);
                  }
                }}
                style={process.env.EXPO_OS === 'ios' ? { height: 320 } : undefined}
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
                    triggerImpact();
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

      {/* Receipt Photos (MOT-143) — only available after the expense is saved */}
      {savedExpenseId && userId && (
        <Animated.View entering={FadeInDown.duration(250)}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            <Camera size={14} color={palette.neutral500} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.neutral500 }}>
              {t('expenses.receipts', { defaultValue: 'Receipts' })}
              <Text style={{ fontWeight: '400' }}>
                {' '}
                ({t('common.optional', { defaultValue: 'optional' })})
              </Text>
            </Text>
          </View>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 12,
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <ExpensePhotoGallery
              expenseId={savedExpenseId}
              userId={userId}
              motorcycleId={motorcycleId}
              photos={photos}
              isDark={isDark}
            />
          </View>
        </Animated.View>
      )}

      {/* Save / Done Button */}
      <Animated.View entering={FadeInDown.delay(200).duration(250)}>
        <Pressable
          onPress={() => {
            triggerImpact();
            if (saved) {
              router.back();
            } else {
              logMutation.mutate();
            }
          }}
          disabled={logMutation.isPending || (!isValid && !saved)}
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
              ? t('common.done', { defaultValue: 'Done' })
              : logMutation.isPending
                ? t('common.saving', { defaultValue: 'Saving...' })
                : t('expenses.save', { defaultValue: 'Log Expense' })}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}
