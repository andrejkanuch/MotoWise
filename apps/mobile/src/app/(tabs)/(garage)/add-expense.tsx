import {
  AddExpensePhotoDocument,
  ExpensePhotosDocument,
  LogExpenseDocument,
} from '@motovault/graphql';
import { EXPENSE_CATEGORIES } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import type { ParseKeys } from 'i18next';
import { Check, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { hubCategoryColor, useHubTheme } from '../../../components/bike-hub/ui/tokens';
import { ExpensePhotoGallery } from '../../../components/expense-photo-gallery';
import {
  AmountField,
  ChoiceChip,
  FormCard,
  FormDateRow,
  FormSection,
  inputTextStyle,
  MAX_EXPENSE_AMOUNT,
  SHEET_CONTENT_STYLE,
  SHEET_CONTROL_HEIGHT,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '../../../components/ui/sheet-form';
import { useCurrency } from '../../../hooks/use-currency';
import {
  EXPENSE_ENTRY_SOURCE,
  parseExpenseEntrySource,
  trackExpenseAdded,
} from '../../../lib/expense-analytics';
import { CATEGORY_LABELS } from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { uploadExpensePhoto } from '../../../lib/image-upload';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../../lib/store-review';
import { useAuthStore } from '../../../stores/auth.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { space, type } from '../../../theme/type';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
import { toISODateInput } from '../../../utils/trip-form-dates';

const CATEGORIES = EXPENSE_CATEGORIES;
type Category = (typeof CATEGORIES)[number];

// Category-aware hints for the optional item-name field. Falls back to a generic
// placeholder for categories where a product name rarely applies (fuel, tolls…).
const ITEM_NAME_HINT_KEY: Partial<Record<Category, ParseKeys>> = {
  accessories: 'expenses.itemNamePlaceholder_accessories',
  parts: 'expenses.itemNamePlaceholder_parts',
  gear: 'expenses.itemNamePlaceholder_gear',
  tires: 'expenses.itemNamePlaceholder_tires',
  modifications: 'expenses.itemNamePlaceholder_modifications',
};
const MULTILINE_MIN_HEIGHT = 88;

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
    entrySource: entrySourceParam,
  } = useLocalSearchParams<{
    motorcycleId: string;
    category?: string;
    amount?: string;
    date?: string;
    itemName?: string;
    description?: string;
    photoUri?: string;
    /** Set by callers that are not the plain manual form (receipt-scan fallback). */
    entrySource?: string;
  }>();
  const entrySource = parseExpenseEntrySource(entrySourceParam, EXPENSE_ENTRY_SOURCE.MANUAL);
  const hub = useHubTheme();
  const { t: theme, isDark } = useEditorialTheme();
  const { currency } = useCurrency();
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

  const hintKey = ITEM_NAME_HINT_KEY[category];
  const itemNamePlaceholder = hintKey
    ? t(hintKey)
    : t('expenses.itemNamePlaceholder', { defaultValue: 'What did you buy?' });

  const parsedAmount = Number.parseFloat(amount) || 0;
  const isValid =
    parsedAmount > 0 && parsedAmount <= MAX_EXPENSE_AMOUNT && date <= new Date() && !!motorcycleId;

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
      trackExpenseAdded({
        entrySource,
        bikeId: motorcycleId,
        date,
        properties: { category, amount: parsedAmount, currency },
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

  const primaryState = saved
    ? SHEET_PRIMARY_STATE.DONE
    : isValid && !logMutation.isPending
      ? SHEET_PRIMARY_STATE.READY
      : SHEET_PRIMARY_STATE.DISABLED;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={20}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={SHEET_CONTENT_STYLE}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetTitle>{t('expenses.logExpenseTitle')}</SheetTitle>

        {/* Amount — the one big number on the sheet */}
        <Animated.View entering={FadeIn.duration(250)}>
          <AmountField
            testID="expense-amount"
            label={t('expenses.amountLabel')}
            value={amount}
            onChange={setAmount}
            autoFocus
          />
        </Animated.View>

        {/* Category — always-visible chips, the category's own hue as a dot */}
        <FormSection label={t('expenses.category')} card={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {CATEGORIES.map((c) => (
              <ChoiceChip
                key={c}
                testID={`expense-category-${c}`}
                label={t(`expenses.category_${c}`, { defaultValue: CATEGORY_LABELS[c] })}
                dotColor={hubCategoryColor(c, hub)}
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </FormSection>

        <FormCard>
          <FormDateRow
            label={t('expenses.date', { defaultValue: 'Date' })}
            value={date}
            open={showDatePicker}
            onToggle={() => setShowDatePicker(!showDatePicker)}
            onClose={() => setShowDatePicker(false)}
            onChange={setDate}
            maximumDate={new Date()}
            testID="expense-date"
          />
        </FormCard>

        {/* Item name — optional structured product name (distinct from notes) */}
        <FormSection
          label={
            <>
              {t('expenses.itemName', { defaultValue: 'Item name' })}
              <Text style={{ color: theme.ink4 }}>
                {' · '}
                {t('common.optional', { defaultValue: 'optional' })}
              </Text>
            </>
          }
        >
          <TextInput
            value={itemName}
            onChangeText={(val) => setItemName(val.slice(0, 120))}
            placeholder={itemNamePlaceholder}
            placeholderTextColor={theme.ink4}
            returnKeyType="next"
            style={[
              inputTextStyle(theme),
              { minHeight: SHEET_CONTROL_HEIGHT, paddingHorizontal: space.md },
            ]}
          />
        </FormSection>

        <FormSection
          label={t('expenses.detailsLabel')}
          trailing={
            <Text
              style={[
                type.caption,
                { color: description.length > 180 ? theme.dueInk : theme.ink3 },
              ]}
            >
              {description.length}/200
            </Text>
          }
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
            style={[
              inputTextStyle(theme),
              {
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                minHeight: MULTILINE_MIN_HEIGHT,
              },
            ]}
          />
        </FormSection>

        {/* Receipt Photos (MOT-143) — only available after the expense is saved */}
        {savedExpenseId && userId && (
          <Animated.View entering={FadeInDown.duration(250)}>
            <FormSection
              label={
                <>
                  {t('expenses.receipts', { defaultValue: 'Receipts' })}
                  <Text style={{ color: theme.ink4 }}>
                    {' · '}
                    {t('common.optional', { defaultValue: 'optional' })}
                  </Text>
                </>
              }
            >
              <View style={{ padding: space.sm }}>
                <ExpensePhotoGallery
                  expenseId={savedExpenseId}
                  userId={userId}
                  motorcycleId={motorcycleId}
                  photos={photos}
                  isDark={isDark}
                />
              </View>
            </FormSection>
          </Animated.View>
        )}
      </KeyboardAwareScrollView>

      {/* Saving keeps the sheet open (receipts attach to the saved expense);
          the primary then turns into "Done", which closes it. */}
      <SheetFooter
        primaryTestID="expense-save"
        primaryState={primaryState}
        primaryPressableWhenDone
        primaryIcon={saved ? Check : Plus}
        primaryLabel={
          saved
            ? t('common.done', { defaultValue: 'Done' })
            : logMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving...' })
              : t('expenses.save', { defaultValue: 'Save expense' })
        }
        onPrimary={() => {
          triggerImpact();
          if (saved) {
            router.back();
          } else {
            logMutation.mutate();
          }
        }}
        onCancel={() => router.back()}
      />
    </View>
  );
}
