import { DeleteExpenseDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { triggerNotification } from '../utils/haptics';

type UseDeleteExpenseOptions = {
  motorcycleId: string;
  /** Extra work after cache invalidation (e.g. router.back when still focused). */
  onSuccess?: (expenseId: string) => void | Promise<void>;
  /** Haptic flavor — list uses Success, detail uses Warning. */
  successHaptic?: 'success' | 'warning';
};

/**
 * Shared DeleteExpense mutation: invalidates motorcycle expense queries and
 * evicts the expense's photo cache. Used by ExpensesSection and expense-detail.
 */
export function useDeleteExpense({
  motorcycleId,
  onSuccess,
  successHaptic = 'success',
}: UseDeleteExpenseOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) => gqlFetcher(DeleteExpenseDocument, { id: expenseId }),
    onSuccess: async (_data, expenseId) => {
      if (successHaptic === 'warning') {
        triggerNotification(Haptics.NotificationFeedbackType.Warning);
      } else if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      queryClient.removeQueries({
        queryKey: queryKeys.expensePhotos.byExpense(expenseId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
      await onSuccess?.(expenseId);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('expenses.deleteFailed', { defaultValue: 'Failed to delete expense.' }),
      );
    },
  });
}
