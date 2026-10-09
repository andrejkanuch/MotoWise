import { LogExpenseDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { hubCategoryColor, useHubTheme } from '../../components/bike-hub/ui/tokens';
import {
  AmountField,
  ChoiceChip,
  FormCard,
  FormDateRow,
  FormSection,
  inputTextStyle,
  MAX_EXPENSE_AMOUNT,
  SHEET_CONTENT_STYLE,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '../../components/ui/sheet-form';
import { useCurrency } from '../../hooks/use-currency';
import { EXPENSE_ENTRY_SOURCE, trackExpenseAdded } from '../../lib/expense-analytics';
import { CATEGORY_LABELS, PRIMARY_CATEGORIES } from '../../lib/expense-constants';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../lib/store-review';
import { useEditorialTheme } from '../../theme/editorial';
import { space, type } from '../../theme/type';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import { toISODateInput } from '../../utils/trip-form-dates';

// Aligned with the primary chip set from the single source of truth
// (packages/types EXPENSE_CATEGORY_META) so this quick logger matches add-expense.
const CATEGORIES = PRIMARY_CATEGORIES;
type Category = (typeof CATEGORIES)[number];

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const hub = useHubTheme();
  const { t: theme } = useEditorialTheme();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('fuel');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const parsedAmount = Number.parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= MAX_EXPENSE_AMOUNT && date <= new Date();

  const logMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(LogExpenseDocument, {
        input: {
          motorcycleId,
          amount: parsedAmount,
          category,
          date: toISODateInput(date),
          description: description.trim() || undefined,
          currency,
        },
      }),
    onSuccess: () => {
      trackExpenseAdded({
        entrySource: EXPENSE_ENTRY_SOURCE.RIDE,
        bikeId: motorcycleId,
        date,
        properties: { category, amount: parsedAmount, currency },
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
      setSaved(true);
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED);
      setTimeout(() => router.back(), 600);
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

        <Animated.View entering={FadeIn.duration(250)}>
          <AmountField
            testID="ride-expense-amount"
            label={t('expenses.amountLabel')}
            value={amount}
            onChange={setAmount}
            autoFocus
          />
        </Animated.View>

        <FormSection label={t('expenses.category', { defaultValue: 'Category' })} card={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {CATEGORIES.map((c) => (
              <ChoiceChip
                key={c}
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
          />
        </FormCard>

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
              defaultValue: 'What was this expense for?',
            })}
            placeholderTextColor={theme.ink4}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[
              inputTextStyle(theme),
              { paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 88 },
            ]}
          />
        </FormSection>
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID="ride-expense-save"
        primaryState={primaryState}
        primaryIcon={saved ? Check : Plus}
        primaryLabel={
          saved
            ? t('expenses.saved', { defaultValue: 'Expense Logged!' })
            : logMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving...' })
              : t('expenses.save', { defaultValue: 'Log Expense' })
        }
        onPrimary={() => {
          triggerImpact();
          logMutation.mutate();
        }}
        onCancel={() => router.back()}
      />
    </View>
  );
}
