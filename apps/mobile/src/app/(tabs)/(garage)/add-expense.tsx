import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette } from '@motovault/design-system';
import {
  AddExpensePhotoDocument,
  ExpensePhotosDocument,
  LogExpenseDocument,
} from '@motovault/graphql';
import { EXPENSE_CATEGORIES } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Camera, Check, DollarSign, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ExpensePhotoGallery } from '../../../components/expense-photo-gallery';
import { useCurrency } from '../../../hooks/use-currency';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatCurrencyInput,
  ZERO_DECIMAL_CURRENCIES,
} from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { uploadExpensePhoto } from '../../../lib/image-upload';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../../lib/store-review';
import { useAuthStore } from '../../../stores/auth.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
import { toISODateInput } from '../../../utils/trip-form-dates';

const CATEGORIES = EXPENSE_CATEGORIES;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { color: string; label: string }> = Object.fromEntries(
  CATEGORIES.map((c) => [c, { color: CATEGORY_COLORS[c], label: CATEGORY_LABELS[c] }]),
) as Record<Category, { color: string; label: string }>;

// Category-aware hints for the optional item-name field. Falls back to a generic
// placeholder for categories where a product name rarely applies (fuel, tolls…).
const ITEM_NAME_HINTS: Partial<Record<Category, string>> = {
  accessories: 'e.g. GPR-Tech Alpi-Tech 55L top case',
  parts: 'e.g. EBC front brake pads',
  gear: 'e.g. Shoei NXR2 helmet',
  tires: 'e.g. Michelin Road 6',
  modifications: 'e.g. Akrapovič exhaust',
};

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  // `category` may be prefilled by the expense-dashboard quick-add chips (MOT-273).
  // The remaining fields carry a receipt-scan partial-salvage (U7d): a failed/partial
  // extraction routes here pre-filled with whatever was recovered + the captured photo.
  const {
    motorcycleId,
    category: categoryParam,
    amount: amountParam,
    date: dateParam,
    itemName: itemNameParam,
    description: descriptionParam,
    photoUri: photoUriParam,
  } = useLocalSearchParams<{
    motorcycleId: string;
    category?: string;
    amount?: string;
    date?: string;
    itemName?: string;
    description?: string;
    photoUri?: string;
  }>();
  const { t: theme, isDark } = useEditorialTheme();
  const { currency, symbol } = useCurrency();
  const queryClient = useQueryClient();

  const userId = useAuthStore((s) => s.session?.user?.id);
  const [amount, setAmount] = useState(amountParam ?? '');
  const [category, setCategory] = useState<Category>(
    categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam)
      ? (categoryParam as Category)
      : 'fuel',
  );
  const [date, setDate] = useState(() => {
    const parsed = dateParam ? new Date(dateParam) : null;
    return parsed && !Number.isNaN(parsed.getTime()) && parsed <= new Date() ? parsed : new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itemName, setItemName] = useState(itemNameParam ?? '');
  const [description, setDescription] = useState(descriptionParam ?? '');
  // showCategoryPicker removed — chips are always visible
  const [saved, setSaved] = useState(false);
  // MOT-143: Receipt photos. Populated after the expense is saved so we have an ID.
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(null);

  // Fetch photos for the newly-created expense (enabled once we have an id)
  const photosQuery = useQuery({
    queryKey: queryKeys.expensePhotos.byExpense(savedExpenseId ?? ''),
    queryFn: () => gqlFetcher(ExpensePhotosDocument, { expenseId: savedExpenseId ?? '' }),
    enabled: !!savedExpenseId,
  });
  const photos = photosQuery.data?.expensePhotos ?? [];

  // Partial-salvage (U7d): once the expense exists, auto-attach the receipt photo
  // carried over from a failed/partial scan. One-shot + best-effort — a failure
  // just leaves the manual gallery for the user to retry.
  const salvagePhotoAttached = useRef(false);
  useEffect(() => {
    if (!savedExpenseId || !photoUriParam || !userId || salvagePhotoAttached.current) return;
    salvagePhotoAttached.current = true;
    void (async () => {
      try {
        const { storagePath, fileSizeBytes } = await uploadExpensePhoto(
          photoUriParam,
          userId,
          savedExpenseId,
        );
        await gqlFetcher(AddExpensePhotoDocument, {
          input: { expenseId: savedExpenseId, storagePath, fileSizeBytes },
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.expensePhotos.byExpense(savedExpenseId),
        });
      } catch {
        // Non-fatal: the expense itself already stands (it was created before this
        // effect). Un-latch the one-shot guard so the auto-attach can be retried,
        // and the receipt gallery below still lets the user attach manually.
        salvagePhotoAttached.current = false;
      }
    })();
  }, [savedExpenseId, photoUriParam, userId, queryClient]);

  const parsedAmount = Number.parseFloat(amount) || 0;
  const isValid =
    parsedAmount > 0 && parsedAmount <= 99999.99 && date <= new Date() && !!motorcycleId;

  const logMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(LogExpenseDocument, {
        input: {
          motorcycleId,
          amount: parsedAmount,
          category,
          date: toISODateInput(date),
          itemName: itemName.trim() || undefined,
          description: description.trim() || undefined,
          currency,
        },
      }),
    onSuccess: (result) => {
      trackEvent(AnalyticsEvent.EXPENSE_ADDED, {
        category,
        amount: parsedAmount,
        currency,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
      setSaved(true);
      // MOT-143: keep the screen open so the user can attach receipt photos.
      // The expense id is now available from the mutation result.
      setSavedExpenseId(result.logExpense.id);
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('expenses.createFailed', { defaultValue: 'Failed to log expense. Please try again.' }),
      );
    },
  });

  const cardBg = theme.surface;
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
      {/* Editorial header */}
      <View style={{ paddingTop: 8, marginBottom: 8 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: theme.ink3,
            marginBottom: 6,
          }}
        >
          {t('expenses.expensesEyebrow')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 32,
              color: theme.ink,
              letterSpacing: -0.6,
            }}
          >
            {t('expenses.logAn')}{' '}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Italic',
              fontSize: 32,
              color: theme.warm,
              letterSpacing: -0.6,
            }}
          >
            {t('expenses.expenseWord')}
          </Text>
        </View>
      </View>

      {/* Amount input */}
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: theme.ink3,
          marginBottom: 8,
          marginLeft: 4,
        }}
      >
        AMOUNT
      </Text>
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
              color: theme.ink,
            }}
          >
            {symbol}
          </Text>
          <TextInput
            value={amount}
            onChangeText={(val) => setAmount(formatCurrencyInput(val, currency))}
            placeholder={ZERO_DECIMAL_CURRENCIES.has(currency) ? '0' : '0.00'}
            placeholderTextColor={theme.ink4}
            keyboardType={ZERO_DECIMAL_CURRENCIES.has(currency) ? 'number-pad' : 'decimal-pad'}
            style={{
              flex: 1,
              fontSize: 24,
              fontWeight: '700',
              color: theme.ink,
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

      {/* Category selector — horizontal chips */}
      <Animated.View entering={FadeInDown.delay(50).duration(250)}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: theme.ink3,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          CATEGORY
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => {
            const selected = category === c;
            const meta = CATEGORY_META[c];
            return (
              <Pressable
                key={c}
                onPress={() => {
                  triggerImpact();
                  setCategory(c);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: selected ? `${meta.color}18` : theme.surface,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? meta.color : theme.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: selected ? '700' : '500',
                    color: selected ? meta.color : theme.ink2,
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
              <Calendar size={16} color={theme.warm} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.ink,
                }}
              >
                {t('expenses.date', { defaultValue: 'Date' })}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: theme.warm,
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
                borderTopColor: theme.line,
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
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
                    {t('common.done', { defaultValue: 'Done' })}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Item name — optional structured product name (distinct from notes) */}
      <Animated.View entering={FadeInDown.delay(140).duration(250)}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: theme.ink3,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          {t('expenses.itemName', { defaultValue: 'Item name' })}
          <Text style={{ fontWeight: '500', letterSpacing: 0 }}>
            {'  '}
            {t('common.optional', { defaultValue: 'optional' })}
          </Text>
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
          <TextInput
            value={itemName}
            onChangeText={(val) => setItemName(val.slice(0, 120))}
            placeholder={t(`expenses.itemNamePlaceholder_${category}`, {
              defaultValue:
                ITEM_NAME_HINTS[category] ??
                t('expenses.itemNamePlaceholder', { defaultValue: 'What did you buy?' }),
            })}
            placeholderTextColor={theme.ink4}
            returnKeyType="next"
            style={{
              fontSize: 15,
              color: theme.ink,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          />
        </View>
      </Animated.View>

      {/* Description */}
      <Animated.View entering={FadeInDown.delay(150).duration(250)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginLeft: 4,
            }}
          >
            DETAILS
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: description.length > 180 ? palette.warning500 : theme.ink3,
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
              defaultValue: 'Note — vendor, part number, etc.',
            })}
            placeholderTextColor={theme.ink4}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{
              fontSize: 15,
              color: theme.ink,
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
            <Camera size={14} color={theme.ink3} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.ink3 }}>
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

      {/* Cancel + Save footer */}
      <Animated.View entering={FadeInDown.delay(200).duration(250)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 16, paddingHorizontal: 12 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink2 }}>
              {t('common.cancel')}
            </Text>
          </Pressable>
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
              flex: 1,
              backgroundColor: saved
                ? palette.success500
                : isValid
                  ? theme.warm
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
                  : t('expenses.save', { defaultValue: 'Save expense' })}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}
