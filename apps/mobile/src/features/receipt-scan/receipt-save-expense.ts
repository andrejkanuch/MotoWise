import { RECEIPT_REVIEW_TYPE } from './scan-flow-constants';

/**
 * Whether a saved record put a row in `expenses`: an expense save always does,
 * a maintenance save does when it carries a cost (the server's linked
 * auto-expense, see MaintenanceTasksService.createAutoExpenseIfNeeded).
 */
export function receiptSaveCreatesExpense(recordType: string, amount: number | null): boolean {
  return recordType === RECEIPT_REVIEW_TYPE.EXPENSE || (amount ?? 0) > 0;
}
