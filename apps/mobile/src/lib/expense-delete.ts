import type { TFunction } from 'i18next';
import { Alert } from 'react-native';

type ConfirmDeleteExpenseOptions = {
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * Shared native confirm dialog for deleting an expense (list swipe + detail).
 * Keeps copy and button roles identical across surfaces.
 */
export function confirmDeleteExpenseAlert(
  t: TFunction,
  { onConfirm, onCancel }: ConfirmDeleteExpenseOptions,
): void {
  Alert.alert(
    t('expenses.deleteTitle', { defaultValue: 'Delete Expense' }),
    t('expenses.deleteMessage', {
      defaultValue: 'Are you sure you want to delete this expense?',
    }),
    [
      {
        text: t('common.cancel', { defaultValue: 'Cancel' }),
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: t('common.delete', { defaultValue: 'Delete' }),
        style: 'destructive',
        onPress: onConfirm,
      },
    ],
  );
}
